import "dotenv/config";

const META_API_URL = "https://graph.facebook.com/v17.0";

export const meta = {
  async sendMessage(to: string, message: { type: "text" | "image" | "audio" | "document" | "template", content: string | any }, context?: { message_id: string }) {
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
    // Add other types as needed
    else {
        // Fallback for simple implementation
        console.log("Unsupported outbound type for now", message.type);
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
