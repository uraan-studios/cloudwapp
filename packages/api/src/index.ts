import "dotenv/config";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { Elysia, t } from "elysia";
import { storage, type Message } from "./services/storage";
import { meta } from "./services/meta";


const app = new Elysia()
  .get("/", () => "Hello Elysia")
  
  // Webhook Verification (GET)
  .get("/webhook", ({ query }) => {
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === "test") {
      return challenge;
    }
    return new Response("Forbidden", { status: 403 });
  })

  // Webhook Event Handler (POST)
  .post("/webhook", async ({ body, server }: any) => {
    console.log("Webhook Received:", JSON.stringify(body, null, 2));
    console.log("Is Server Available for WS:", !!server);
    
    // Log incoming webhook
    try {
      await appendFile(
        join(import.meta.dir, "../data/logs.json"), 
        JSON.stringify({ timestamp: new Date().toISOString(), body }) + "\n"
      );
    } catch (err) {
      console.error("Failed to log webhook:", err);
    }

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          if (change.value.messages) {
             for (const msg of change.value.messages) {
                 const from = msg.from;
                 // Normalize
                 const newMessage: Message = {
                     id: msg.id,
                     from: from,
                     to: 'me',
                     type: msg.type,
                     content: msg.type === 'text' ? msg.text.body : JSON.stringify(msg[msg.type]),
                     timestamp: parseInt(msg.timestamp) * 1000,
                     status: 'delivered',
                     direction: 'incoming'
                 };
                 
                 // Handle reactions separately if type is reaction
                 if (msg.type === 'reaction') {
                     try {
                         console.log("[Index] Processing reaction...");
                         await storage.addReaction(msg.reaction.message_id, from, msg.reaction.emoji);
                         console.log("[Index] Reaction saved to storage. broadcasting...");
                         
                         if (!server) {
                             console.error("[Index] Server is undefined during reaction broadcast!");
                         } else {
                             const sent = server.publish("chat", JSON.stringify({ type: "reaction", messageId: msg.reaction.message_id, from, emoji: msg.reaction.emoji }));
                             console.log(`[Index] Broadcast reaction to 'chat'. Clients reached: ${sent}`);
                         }
                     } catch (e) {
                         console.error("[Index] Error processing reaction:", e);
                     }
                 } else {
                     await storage.saveMessage(newMessage);
                     server?.publish("chat", JSON.stringify({ type: "message", data: newMessage }));
                 }
             }
          }
          // Handle statuses
          if (change.value.statuses) {
              for(const s of change.value.statuses) {
                  await storage.updateMessageStatus(s.id, s.status);
                  server?.publish("chat", JSON.stringify({ type: "status", id: s.id, status: s.status }));
              }
          }
        }
      }
    }
    return "OK";
  })

  .ws("/chat", {
    body: t.Any(),
    response: t.Any(),
    async open(ws) {
        console.log("WS Opened");
        ws.subscribe("chat");
        // Send initial data (Contacts only)
        try {
            console.log("Fetching contacts for new connection...");
            const contacts = await storage.getContacts();
            ws.send(JSON.stringify({ type: "contacts", data: contacts }));
            console.log(`Sent ${contacts.length} contacts to new client.`);
        } catch (e) {
            console.error("Error in WS open:", e);
        }
    },
    async message(ws, message: any) {
        if (message.type === 'get_messages') {
            const { contactId, limit, beforeTimestamp } = message;
            const msgs = await storage.getMessages(contactId, limit || 50, beforeTimestamp);
            
            // nextCursor is the timestamp of the oldest message in this batch (first one in chronological list)
            // If we got 0 messages, no more to load.
            const nextCursor = msgs.length > 0 ? msgs[0].timestamp : null;
            
            ws.send(JSON.stringify({ 
                type: 'messages_loaded', 
                contactId, 
                data: msgs,
                nextCursor
            }));
        }
        // Handle outgoing messages
        if (message.type === "text") {
            const outgoingMsg: Message = {
                id: "wamid_" + Date.now(), // Temp ID until Meta confirms
                from: "me",
                to: message.to,
                type: "text",
                content: message.content,
                timestamp: Date.now(),
                status: "sent",
                direction: "outgoing",
                context: message.context // Pass replying context if any
            };
            
            await storage.saveMessage(outgoingMsg);
            ws.publish("chat", JSON.stringify({ type: "message", data: outgoingMsg }));
            ws.send(JSON.stringify({ type: "message", data: outgoingMsg })); 
            
            ws.send(JSON.stringify({ type: "message", data: outgoingMsg })); 
            
            // Send to Meta
            const res = await meta.sendMessage(message.to, { type: "text", content: message.content }, message.context);

            // Log sent message
            try {
                await appendFile(
                    join(import.meta.dir, "../data/sent.json"),
                    JSON.stringify({ timestamp: new Date().toISOString(), to: message.to, content: message.content, response: res }) + "\n"
                );
            } catch (err) {
                console.error("Failed to log sent message:", err);
            }
            
            if (res && res.messages && res.messages[0]) {
                const realId = res.messages[0].id;
                console.log(`[Index] Received real ID from Meta: ${realId} for temp ID: ${outgoingMsg.id}`);
                await storage.updateMessageId(outgoingMsg.id, realId);
                ws.publish("chat", JSON.stringify({ type: "id_update", oldId: outgoingMsg.id, newId: realId }));
                ws.send(JSON.stringify({ type: "id_update", oldId: outgoingMsg.id, newId: realId }));
            } else {
                console.error("[Index] Failed to get real ID from Meta response:", JSON.stringify(res));
            }
        }
        else if (message.type === "typing") {
            // Client says "I am typing" -> Send to Meta
            await meta.sendTypingState(message.to, message.state ? "typing_on" : "typing_off");
            // Do NOT broadcast to other clients for now, or maybe yes if we multiple agents support later
        }
        else if (message.type === "reaction") {
            // Client sent a reaction
            await meta.sendReaction(message.messageId, message.emoji, message.to);
            // Broadcast to other clients/self?
            // Ideally we also save it to DB. For now let's just broadcast back so UI updates for everyone.
            // But UI already optimistically updated.
            // Let's verify if we need to save. Yes, reactions are part of persistent state.
            await storage.addReaction(message.messageId, "me", message.emoji);
            ws.publish("chat", JSON.stringify({ type: "reaction", messageId: message.messageId, from: "me", emoji: message.emoji }));
        }
        else if (message.type === "read") {
            // Client says "I read message X" -> Send to Meta
            await meta.markAsRead(message.messageId);
            await storage.updateMessageStatus(message.messageId, 'read');
             ws.publish("chat", JSON.stringify({ type: "status", id: message.messageId, status: 'read' }));
        }
    },
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;