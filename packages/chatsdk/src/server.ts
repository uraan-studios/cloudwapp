
import { readFile } from "fs/promises";

const META_API_URL = "https://graph.facebook.com/v18.0";

export class MetaClient {
  private accessToken: string;
  private phoneNumberId: string;
  private wabaId?: string;

  constructor(config: { accessToken: string; phoneNumberId: string; wabaId?: string }) {
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    this.wabaId = config.wabaId;
  }

  private async fetchAPI(endpoint: string, options: RequestInit = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${META_API_URL}/${endpoint}`;
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    try {
      const res = await fetch(url, { ...options, headers });
      const data = await res.json();
      if (!res.ok) {
        console.error(`[Meta SDK] API Error (${endpoint}):`, JSON.stringify(data, null, 2));
        return { error: data };
      }
      return data;
    } catch (e) {
      console.error(`[Meta SDK] Network Error (${endpoint}):`, e);
      return { error: e };
    }
  }

  async uploadMedia(filePath: string, mimeType: string) {
    try {
      const fileContent = await readFile(filePath);
      const blob = new Blob([fileContent], { type: mimeType });
      const formData = new FormData();
      formData.append("messaging_product", "whatsapp");
      formData.append("file", blob, filePath.split('/').pop() || "file");

      const res = await fetch(`${META_API_URL}/${this.phoneNumberId}/media`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${this.accessToken}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("[Meta SDK] Media Upload Error:", data);
        return null;
      }
      return (data as any).id;
    } catch (e) {
      console.error("[Meta SDK] Upload Network Error:", e);
      return null;
    }
  }

  async sendMessage(to: string, message: { type: "text" | "image" | "audio" | "video" | "document" | "template", content: string | any, id?: string, caption?: string, fileName?: string, isVoiceNote?: boolean }, context?: { message_id: string }) {
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
        
        if (["image", "video", "document"].includes(message.type)) {
             mediaPayload.caption = message.caption;
        }
        
        if (message.type === 'document' && message.fileName) {
            mediaPayload.filename = message.fileName;
        }

        if (message.type === 'audio' && message.isVoiceNote) {
            mediaPayload.voice = true;
        }

        body[message.type] = mediaPayload;
    }
    else {
        console.log("[Meta SDK] Unsupported or Template outbound type:", message.type);
        return;
    }

    return this.fetchAPI(`${this.phoneNumberId}/messages`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
    
  async sendTemplate(to: string, templateName: string, languageCode: string = "en_US", components: any[] = []) {
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

    return this.fetchAPI(`${this.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify(body),
    });
  }

  async sendInteractive(to: string, interactive: any) {
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to,
      type: "interactive",
      interactive: interactive
    };

    return this.fetchAPI(`${this.phoneNumberId}/messages`, {
        method: "POST",
        body: JSON.stringify(body),
    });
  }

  async getTemplates() {
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
        },
        {
          name: "marketing_promo",
          language: "en_US",
          status: "APPROVED",
          components: [
              { type: "HEADER", format: "IMAGE" },
              { type: "BODY", text: "Special offer for you, {{1}}! Use code {{2}} at checkout." },
              { type: "FOOTER", text: "Valid until end of month." },
              { type: "BUTTONS", buttons: [
                  { type: "QUICK_REPLY", text: "Stop Promotions" },
                  { type: "URL", text: "Shop Now", url: "https://example.com/shop" }
              ]}
          ]
        },
        {
          name: "order_tracking",
          language: "en_US",
          status: "APPROVED",
          components: [
              { type: "HEADER", format: "TEXT", text: "Order #{{1}}" },
              { type: "BODY", text: "Your order for {{2}} has been shipped! Track it using the button below." },
              { type: "FOOTER", text: "Thanks for choosing us!" },
              { type: "BUTTONS", buttons: [
                  { type: "URL", text: "Track Order", url: "https://example.com/track/{{1}}" }
              ]}
          ]
        }
    ];

    try {
        if (this.wabaId) {
             const res: any = await this.fetchAPI(`${this.wabaId}/message_templates?status=APPROVED`, { method: "GET" });
             if (res && res.data) return res.data as any[];
        }
        return mockTemplates;
    } catch (e) {
        console.error("[Meta SDK] Template Fetch Error:", e);
        return mockTemplates;
    }
  }

  async sendReaction(messageId: string, emoji: string, to: string) {
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
       return this.fetchAPI(`${this.phoneNumberId}/messages`, {
           method: "POST",
           body: JSON.stringify(body),
       });
  }

  async markAsRead(messageId: string) {
      const body = {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId
      };
      return this.fetchAPI(`${this.phoneNumberId}/messages`, {
          method: "POST",
          body: JSON.stringify(body),
      });
  }

  async retrieveMediaUrl(mediaId: string) {
    try {
        const res = await fetch(`${META_API_URL}/${mediaId}`, {
            headers: {
                "Authorization": `Bearer ${this.accessToken}`,
            },
        });
        
        if (!res.ok) return null;
        const data = await res.json();
        return (data as any).url; 
    } catch (e) {
        console.error("[Meta SDK] Media Retrieval Error:", e);
        return null;
    }
  }

  async sendTypingState(to: string, state: 'typing_on' | 'typing_off' = 'typing_on') {
      const body = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "sender_action",
          sender_action: state
      };
      return this.fetchAPI(`${this.phoneNumberId}/messages`, {
          method: "POST",
          body: JSON.stringify(body),
      });
  }

  async initiateCall(to: string, sdp: string) {
    console.log(`[Meta SDK] Initiating call to ${to}`);
    const body = {
        messaging_product: "whatsapp",
        to: to,
        action: "connect",
        session: {
            sdp_type: "offer",
            sdp: sdp
        }
    };
    return this.fetchAPI(`${this.phoneNumberId}/calls`, {
        method: "POST",
        body: JSON.stringify(body),
    });
  }

  async respondToCall(callId: string, action: 'accept' | 'reject' | 'pre_accept', sdp?: string) {
    console.log(`[Meta SDK] Responding to call ${callId} with action ${action}`);
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
    return this.fetchAPI(`${this.phoneNumberId}/calls`, {
        method: "POST",
        body: JSON.stringify(body),
    });
  }

  async enableCalling() {
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

    console.log("[Meta SDK] Enabling Calling...");
    return this.fetchAPI(`${this.phoneNumberId}/settings`, {
        method: "POST",
        body: JSON.stringify(body),
    });
  }

  async getSettings() {
    return this.fetchAPI(`${this.phoneNumberId}/settings?fields=calling`, { method: "GET" });
  }
}
