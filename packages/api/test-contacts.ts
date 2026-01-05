
import { storage } from "./src/services/storage";

console.log("Testing storage.getContacts()...");
try {
    const contacts = await storage.getContacts();
    console.log("Success!");
    console.log(`Found ${contacts.length} contacts.`);
    console.log(JSON.stringify(contacts, null, 2));
} catch (e) {
    console.error("FAILED to get contacts:", e);
}
