import "dotenv/config";
import { appendFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { storage } from "./services/storage";
import { meta } from "./services/meta";
import { ChatSDK, type Message, type Contact, type CallEvent } from "@repo/chatsdk";

// Ensure temp directory exists
const TEMP_DIR = join(import.meta.dir, "../temp_uploads");
mkdir(TEMP_DIR, { recursive: true }).catch(console.error);

const app = new Elysia()
  .use(cors())
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

  // Enable Calling Settings
  .post("/enable-calling", async () => {
      const result = await meta.enableCalling();
      if (result) {
          return { success: true, data: result };
      } else {
          return new Response("Failed to enable calling", { status: 500 });
      }
  })

  // File Upload Endpoint
  // File Upload Endpoint
  .post("/upload", async ({ body }) => {
      const file = body.file as File;
      if (!file) {
          return new Response("No file uploaded", { status: 400 });
      }

      console.log(`[Upload] Receiving file: ${file.name}, type: ${file.type}, size: ${file.size}`);
      
      const tempId = crypto.randomUUID();
      const tempPath = join(TEMP_DIR, `${tempId}_${file.name}`);
      await Bun.write(tempPath, file);
      
      let uploadPath = tempPath;
      let mimeType = file.type;

      // Convert WebM audio to OGG for WhatsApp compatibility
      if (file.type === 'audio/webm' || file.type === 'video/webm') {
          try {
              console.log("Converting WebM to OGG...", tempPath);
              const { convertToOgg } = await import('./services/converter');
              uploadPath = await convertToOgg(tempPath);
              mimeType = 'audio/ogg; codecs=opus'; // Update MIME for Meta to ensure voice note compatibility
          } catch (e) {
              console.error("Conversion failed, attempting upload of original:", e);
          }
      }
      
      try {
          console.log(`[Upload] Uploading to Meta: ${uploadPath} (${mimeType})`);
          const mediaId = await meta.uploadMedia(uploadPath, mimeType);
          
          // Cleanup - DISABLED per user request
          // unlink(uploadPath).catch(() => {});
          // if (uploadPath !== tempPath) {
          //    unlink(tempPath).catch(() => {});
          // }
          
          if (mediaId) {
              return { id: mediaId };
          } else {
              return new Response("Failed to upload to Meta", { status: 500 });
          }
      } catch (e) {
          console.error("[Upload] Error:", e);
          return new Response("Internal Server Error", { status: 500 });
      }
  }, {
      body: t.Object({
          file: t.File()
      })
  })

  // Get Meta Templates
  .get("/templates", async () => {
      try {
          const templates = await meta.getTemplates();
          return templates;
      } catch (e) {
          console.error("Template Endpoint Error:", e);
          return [];
      }
  })

  // Media Proxy Endpoint
  .get("/media/:id", async ({ params: { id } }) => {
      const url = await meta.retrieveMediaUrl(id);
      if (!url) return new Response("Not Found", { status: 404 });
      
      const response = await fetch(url, {
          headers: {
              "Authorization": `Bearer ${process.env.META_ACCESS_TOKEN}`
          }
      });

      // Create a new response with CORS headers
      const newResponse = new Response(response.body, response);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      return newResponse;
  })

  // Webhook Event Handler (POST)
  .post("/webhook", async ({ body, server }: any) => {
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
          if (change.value.contacts) {
              for (const contact of change.value.contacts) {
                  await storage.saveContact(contact.wa_id, contact.profile.name);
              }
          }
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
                     direction: 'incoming',
                     context: msg.context ? { message_id: msg.context.id } : undefined
                 };
                 
                 // Handle reactions separately if type is reaction
                 if (msg.type === 'reaction') {
                     try {
                         console.log("[Index] Processing reaction...");
                         await storage.addReaction(msg.reaction.message_id, from, msg.reaction.emoji);
                         
                         if (server) {
                             server.publish("chat", JSON.stringify({ type: "reaction", messageId: msg.reaction.message_id, from, emoji: msg.reaction.emoji }));
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
          // Handle calls
          if (change.value.calls) {
              for (const call of change.value.calls) {
                  console.log("[Index] Received Call Event:", JSON.stringify(call));
                  // Try to find contact name in storage
                  const contactId = call.direction === 'BUSINESS_INITIATED' ? call.to : call.from;
                  const contact = await storage.getContacts().then(list => list.find(c => c.id === contactId));
                  const name = contact?.customName || contact?.pushName || contact?.name || contactId;

                  const isOutgoing = call.direction === 'BUSINESS_INITIATED';

                  // Save call (upsert)
                  await storage.saveCall({
                      id: call.id,
                      name: name,
                      from: isOutgoing ? 'me' : call.from,
                      to: isOutgoing ? call.to : 'me',
                      status: call.event === 'connect' ? 'active' : 'ended',
                      timestamp: Date.now(),
                      direction: isOutgoing ? 'outgoing' : 'incoming',
                      sdp: call.session?.sdp || undefined
                  });

                  if (isOutgoing && call.event === 'connect' && call.session?.sdp) {
                      // Handshake answer for outgoing call
                      server?.publish("chat", JSON.stringify({ 
                          type: "call_answered", 
                          data: { callId: call.id, sdp: call.session.sdp } 
                      }));
                  } else if (!isOutgoing && call.event === 'connect') {
                      // Real incoming call
                      server?.publish("chat", JSON.stringify({ 
                          type: "call_incoming", 
                          data: { ...call, fromName: name, sdp: call.session?.sdp } 
                      }));
                  } else if (call.event === 'terminate') {
                      server?.publish("chat", JSON.stringify({ type: "call_ended", callId: call.id }));
                  }
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
        try {
            const contacts = await storage.getContacts();
            ws.send(JSON.stringify({ type: "contacts", data: contacts }));
        } catch (e) {
            console.error("Error in WS open:", e);
        }
    },
    async message(ws, message: any) {
        console.log("WS Message Received:", JSON.stringify(message));
        if (message.type === 'get_messages') {
            const { contactId, limit, beforeTimestamp } = message;
            const msgs = await storage.getMessages(contactId, limit || 50, beforeTimestamp);
            const nextCursor = msgs.length > 0 ? msgs[0].timestamp : null;
            
            ws.send(JSON.stringify({ 
                type: 'messages_loaded', 
                contactId, 
                data: msgs,
                nextCursor
            }));
        }
        else if (message.type === 'update_contact') {
            const { contactId, name } = message;
            const result = await storage.updateContactName(contactId, name);
            app.server?.publish("chat", JSON.stringify({ type: "contact_update", data: result }));
        }
        else if (message.type === 'toggle_favorite') {
            const result = await storage.toggleFavorite(message.contactId);
            app.server?.publish("chat", JSON.stringify({ type: 'contact_update', data: result })); 
        }
        // Handle outgoing messages
        else if (["text", "image", "video", "audio", "document", "template", "interactive"].includes(message.type)) {
            let content = "";
            if (message.type === "text") {
                content = message.content;
            } else if (message.type === "template") {
                content = JSON.stringify({
                    name: message.templateName,
                    language: message.languageCode,
                    components: message.components
                });
            } else if (message.type === "interactive") {
                content = JSON.stringify(message.interactive);
            } else {
                // For media, content is stringified JSON of metadata (id, caption, filename)
                content = JSON.stringify({
                    id: message.id,
                    caption: message.caption,
                    filename: message.fileName
                });
            }

            const outgoingMsg: Message = {
                id: "wamid_" + Date.now(), 
                from: "me",
                to: message.to as string,
                type: message.type as any,
                content: content,
                timestamp: Date.now(),
                status: "sent",
                direction: "outgoing",
                context: message.context ? { message_id: message.context.message_id || message.context.id } : undefined
            };
            
            // Check 24h window
            const contact = await storage.getContact(message.to);
            const lastMsgTime = contact?.lastUserMsgTimestamp || 0;
            const isWindowOpen = (Date.now() - lastMsgTime) < (24 * 60 * 60 * 1000);

            // If window is closed AND it's NOT a template, reject
            if (!isWindowOpen && message.type !== 'template') {
                 console.log(`[Index] 24h Window Closed for ${message.to}. Rejecting non-template message.`);
                 ws.send(JSON.stringify({ 
                     type: "error", 
                     code: "window_closed",
                     message: "24-hour window is closed. Please send a template message." 
                 }));
                 return;
            }

            await storage.saveMessage(outgoingMsg);
            // Broadcast to self and others
            ws.publish("chat", JSON.stringify({ type: "message", data: outgoingMsg }));
            ws.send(JSON.stringify({ type: "message", data: outgoingMsg })); 
            
            let res;
            if (message.type === 'template') {
                res = await meta.sendTemplate(message.to, message.templateName, message.languageCode, message.components);
            } else if (message.type === 'interactive') {
                console.log(`[Index] Sending interactive to ${message.to}:`, JSON.stringify(message.interactive));
                res = await meta.sendInteractive(message.to, message.interactive);
                if (!res || res.error) console.error(`[Index] Meta Interactive Error:`, res?.error || "Unknown");
            } else {
                // Send to Meta normally
                res = await meta.sendMessage(message.to, { 
                    type: message.type, 
                    content: message.content, // Text content
                    id: message.id,           // Media ID
                    caption: message.caption,
                    fileName: message.fileName
                }, message.context);
            }

            if (res && res.messages && res.messages[0]) {
                const realId = res.messages[0].id;
                console.log(`[Index] Received real ID: ${realId}`);
                await storage.updateMessageId(outgoingMsg.id, realId);
                ws.publish("chat", JSON.stringify({ type: "id_update", oldId: outgoingMsg.id, newId: realId }));
                ws.send(JSON.stringify({ type: "id_update", oldId: outgoingMsg.id, newId: realId }));
            }
        }
        else if (message.type === "typing") {
            await meta.sendTypingState(message.to, message.state ? "typing_on" : "typing_off");
        }
        else if (message.type === "reaction") {
            await meta.sendReaction(message.messageId, message.emoji, message.to);
            await storage.addReaction(message.messageId, "me", message.emoji);
            ws.publish("chat", JSON.stringify({ type: "reaction", messageId: message.messageId, from: "me", emoji: message.emoji }));
        }
        else if (message.type === "read") {
            await meta.markAsRead(message.messageId);
            await storage.updateMessageStatus(message.messageId, 'read');
            ws.publish("chat", JSON.stringify({ type: "status", id: message.messageId, status: 'read' }));
        }
        // Call Handling
        else if (message.type === 'call_accept') {
            console.log(`[WS] Accepting call ${message.callId}`);
            await meta.respondToCall(message.callId, 'accept', message.sdp);
            await storage.updateCallStatus(message.callId, 'active');
            // Broadcast that call is answered (maybe optional depending on frontend flow)
        }
        else if (message.type === 'call_reject') {
            console.log(`[WS] Rejecting call ${message.callId}`);
            await meta.respondToCall(message.callId, 'reject');
            await storage.updateCallStatus(message.callId, 'rejected');
        }
        else if (message.type === 'call_start') {
            console.log(`[WS] Starting call to ${message.to}`);
            
            const res = await meta.initiateCall(message.to, message.sdp);
            if (res && res.id) {
                 // IMMEDIATELY send the callId to frontend BEFORE webhook arrives
                 ws.send(JSON.stringify({ type: "call_created", callId: res.id }));
                 
                 // Try to get contact name
                 const contact = await storage.getContacts().then(list => list.find(c => c.id === message.to));
                 const name = contact?.customName || contact?.pushName || contact?.name || message.to;

                 await storage.saveCall({
                     id: res.id,
                     name: name,
                     from: 'me',
                     to: message.to,
                     status: 'active',
                     timestamp: Date.now(),
                     direction: 'outgoing',
                     sdp: message.sdp
                 });
            }
        }
    },
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app;