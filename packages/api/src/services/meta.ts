import "dotenv/config";
import { readFile } from "fs/promises";

const META_API_URL = "https://graph.facebook.com/v17.0";

export const meta = {
  async uploadMedia(filePath: string, mimeType: string) {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
         console.error("Missing Meta Credentials for Upload");
         return null;
    }

    try {
        const fileContent = await readFile(filePath);
        const blob = new Blob([fileContent], { type: mimeType });
        const formData = new FormData();
        formData.append("messaging_product", "whatsapp");
        formData.append("file", blob, filePath.split('/').pop() || "file");

        const res = await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/media`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
            },
            body: formData,
        });

        const data = await res.json();
        if (!res.ok) {
            console.error("Meta Media Upload Error:", data);
            return null;
        }
        return data.id;
    } catch (e) {
        console.error("Meta Upload Network Error:", e);
        return null;
    }
  },

  async sendMessage(to: string, message: { type: "text" | "image" | "audio" | "video" | "document" | "template", content: string | any, id?: string, caption?: string, fileName?: string }, context?: { message_id: string }) {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
        console.error("Missing Meta Credentials - Access Token:", !!ACCESS_TOKEN, "Phone ID:", !!PHONE_NUMBER_ID);
        return;
    }

    let body: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
    };

    if (context) {
        body.context = { message_id: context.message_id };
    }

    if (message.type === "text") {
      body.type = "text";
      body.text = { body: message.content };
    } 
    else if (["image", "audio", "video", "document"].includes(message.type)) {
        body.type = message.type;
        const mediaPayload: any = {
            id: message.id, // ID from uploadMedia
            caption: message.caption
        };
        
        if (message.type === 'document' && message.fileName) {
            mediaPayload.filename = message.fileName;
        }

        body[message.type] = mediaPayload;
    }
    else {
        // Fallback or Template
        console.log("Unsupported or Template outbound type:", message.type);
        return;
    }

    try {
      const res = await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Meta API Error:", data);
      }
      return data;
    } catch (e) {
      console.error("Meta Network Error:", e);
    }
  },
    
  async sendReaction(messageId: string, emoji: string, to: string) {
       const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
       const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

       if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return;
       
       const body = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "reaction",
          reaction: {
              message_id: messageId,
              emoji: emoji
          }
       };
       
      await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
  },

  async markAsRead(messageId: string) {
      const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
      const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

      if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return;

      const body = {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId
      };

      await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
  },

  async retrieveMediaUrl(mediaId: string) {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return null;

    try {
        const res = await fetch(`${META_API_URL}/${mediaId}`, {
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
            },
        });
        
        if (!res.ok) return null;
        const data = await res.json();
        return data.url; // This is the authenticated download URL
    } catch (e) {
        console.error("Meta Media Retrieval Error:", e);
        return null;
    }
  },

  async sendTypingState(to: string, state: 'typing_on' | 'typing_off' = 'typing_on') {
      const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
      const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

      if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return;

      const body = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "sender_action",
          sender_action: state
      };

      await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
  }
};
