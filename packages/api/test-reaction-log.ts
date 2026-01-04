
const response = await fetch("http://localhost:3000/webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ changes: [{ value: { messages: [{ type: "reaction", reaction: { message_id: "wamid.TEST", emoji: "🧪" }, from: "12345", timestamp: "1600000000" }] } }] }]
  })
});
console.log("Response Status:", response.status);
