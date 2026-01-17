import "dotenv/config";
import { readFile } from "fs/promises";

const META_API_URL = "https://graph.facebook.com/v18.0";

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

  async sendMessage(to: string, message: { type: "text" | "image" | "audio" | "video" | "document" | "template", content: string | any, id?: string, caption?: string, fileName?: string, isVoiceNote?: boolean }, context?: { message_id: string }) {
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
            id: message.id
        };
        
        // Caption is supported for image, video, document ONLY
        if (["image", "video", "document"].includes(message.type)) {
             mediaPayload.caption = message.caption;
        }
        
        if (message.type === 'document' && message.fileName) {
            mediaPayload.filename = message.fileName;
        }

        // Voice Note specific flag
        if (message.type === 'audio' && message.isVoiceNote) {
            mediaPayload.voice = true;
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
    
  async sendTemplate(to: string, templateName: string, languageCode: string = "en_US", components: any[] = []) {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return;

    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components: components
      }
    };

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
            console.error("Meta Template API Error:", data);
        }
        return data;
    } catch (e) {
        console.error("Meta Template Network Error:", e);
    }
  },


  async getTemplates() {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
    const WABA_ID = process.env.META_WABA_ID;
    
    // Default Mock Templates
    const mockTemplates = [
        { name: "hello_world", language: "en_US", status: "APPROVED", components: [] },
        { 
          name: "utility_update", 
          language: "en_US", 
          status: "APPROVED",
          components: [
              { type: "BODY", text: "Hello {{1}}, we have an update regarding your order {{2}}." }
          ] 
        }
    ];

    if (!ACCESS_TOKEN) return mockTemplates;

    try {
        if (WABA_ID) {
             const res = await fetch(`${META_API_URL}/${WABA_ID}/message_templates?status=APPROVED`, {
                headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` }
             });
             if (res.ok) {
                const data = await res.json();
                if (data.data) return data.data;
             }
        }
        
        // If we have PHONE_NUMBER_ID, we could try to look up WABA, but for now fallback to mock.
        // We explicitly avoid throwing here to prevent 500s.
        return mockTemplates;

    } catch (e) {
        console.error("Meta Template Fetch Error:", e);
        return mockTemplates;
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
  },

  async initiateCall(to: string, sdp: string) {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return;

    console.log(`[Meta] Initiating call to ${to}`);
    const body = {
        messaging_product: "whatsapp",
        to: to,
        action: "connect",
        session: {
            sdp_type: "offer",
            sdp: sdp
        }
    };

    try {
        const res = await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/calls`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error("[Meta] Initiate Call Error:", data);
            return null;
        }
        console.log("[Meta] Initiate Call Success:", data);
        return data; // Should contain call_id
    } catch (e) {
        console.error("[Meta] Initiate Call Network Error:", e);
        return null;
    }
  },

  async respondToCall(callId: string, action: 'accept' | 'reject' | 'pre_accept', sdp?: string) {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return;

    console.log(`[Meta] Responding to call ${callId} with action ${action}`);
    const body: any = {
        messaging_product: "whatsapp",
        call_id: callId,
        action: action
    };

    if (action === 'accept' && sdp) {
        body.session = {
            sdp_type: "answer",
            sdp: sdp
        };
    }

    try {
        const res = await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/calls`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${ACCESS_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
            console.error("[Meta] Respond Call Error:", data);
        } else {
            console.log("[Meta] Respond Call Success");
        }
    } catch (e) {
        console.error("[Meta] Respond Call Network Error:", e);
    }
  },

  async enableCalling() {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
      console.error("Missing Meta Credentials for Enable Calling");
      return null;
    }

    const body = {
      calling: {
        status: "ENABLED",
        call_icon_visibility: "DEFAULT",
        callback_permission_status: "ENABLED",
        call_hours: {
          status: "ENABLED",
          timezone_id: "Asia/Karachi",
          weekly_operating_hours: [
            { day_of_week: "MONDAY", open_time: "0001", close_time: "2359" },
            { day_of_week: "TUESDAY", open_time: "0001", close_time: "2359" },
            { day_of_week: "WEDNESDAY", open_time: "0001", close_time: "2359" },
            { day_of_week: "THURSDAY", open_time: "0001", close_time: "2359" },
            { day_of_week: "FRIDAY", open_time: "0001", close_time: "2359" },
            { day_of_week: "SATURDAY", open_time: "0001", close_time: "2359" },
            { day_of_week: "SUNDAY", open_time: "0001", close_time: "2359" }
          ]
        }
      },
    };

    console.log("[Meta] Enabling Calling with body:", JSON.stringify(body, null, 2));
    try {
      const res = await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/settings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Meta API Settings Error Details:", JSON.stringify(data, null, 2));
        return null;
      }
      console.log("Calling enabled successfully:", data);
      return data;
    } catch (e) {
      console.error("Meta Network Error (Enable Calling):", e);
    }
  },
  async getSettings() {
    const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
    const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;

    if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) return null;

    try {
      const res = await fetch(`${META_API_URL}/${PHONE_NUMBER_ID}/settings?fields=calling`, {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      });

      const data = await res.json();
      console.log("Current Settings:", JSON.stringify(data, null, 2));
      return data;
    } catch (e) {
      console.error("Meta Network Error (Get Settings):", e);
      return null;
    }
  }
};
