import axios from "axios";

const BOT_TOKEN = "8559993468:AAG8TLMk9SjlP3R0-oDrlVY68Oa4ldiMSWY";
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK_URL = "http://localhost:3001/api/telegram/webhook";

async function startPolling() {
  console.log("🤖 Telegram Bot Polling started...");
  console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);

  let offset = 0;

  // Main polling loop
  const poll = async () => {
    while (true) {
      try {
        const response = await axios.post(`${API_URL}/getUpdates`, {
          offset,
          timeout: 30,
          allowed_updates: ["message", "callback_query", "web_app_info"],
        });

        const updates = response.data.result || [];

        if (updates.length > 0) {
          console.log(`\n📨 ${updates.length} yangi message`);
        }

        for (const update of updates) {
          try {
            // Send to webhook
            await axios.post(WEBHOOK_URL, { update });
            console.log(`✅ Update ${update.update_id} processed`);
          } catch (error) {
            console.error(
              `❌ Error processing update ${update.update_id}:`,
              error.message
            );
          }

          offset = update.update_id + 1;
        }
      } catch (error) {
        console.error("❌ Polling error:", error.message);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  };

  // Start polling
  poll().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

// Start
startPolling();
