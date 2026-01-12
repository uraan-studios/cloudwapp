import { meta } from "../src/services/meta";

async function main() {
    console.log("Fetching current settings...");
    await meta.getSettings();

    console.log("\nEnabling WhatsApp calling...");
    const result = await meta.enableCalling();
    if (result) {
        console.log("Success!");
    } else {
        console.log("Failed. Check console for errors.");
    }
}

main().catch(console.error);
