#!/usr/bin/env node
import axios from "axios";

const BOT_TOKEN = "8559993468:AAG8TLMk9SjlP3R0-oDrlVY68Oa4ldiMSWY";
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

// First delete any existing webhook
async function deleteWebhook() {
  try {
    const res = await axios.post(`${API_BASE}/deleteWebhook`);
    console.log("✅ Webhook deleted:", res.data.ok);
  } catch (err) {
    console.log("⚠️ Webhook delete failed (maybe none)");
  }
}

async function pollMessages() {
  let offset = 0;

  console.log("🤖 Telegram Bot Polling Service");
  console.log("==============================");
  console.log(`Bot Token: ${BOT_TOKEN.substring(0, 20)}...`);
  console.log(`Status: Listening for messages...\n`);

  await deleteWebhook();
  await new Promise((r) => setTimeout(r, 1000)); // Wait for webhook deletion to process

  while (true) {
    try {
      const response = await axios.get(`${API_BASE}/getUpdates`, {
        params: {
          offset,
          timeout: 30,
          allowed_updates: ["message", "callback_query"],
        },
      });

      if (!response.data.ok) {
        console.error("❌ Telegram API error:", response.data);
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const updates = response.data.result || [];

      if (updates.length > 0) {
        console.log(`\n📥 Received ${updates.length} update(s)`);

        for (const update of updates) {
          try {
            const message = update.message;
            if (message) {
              console.log(
                `  From: @${message.from?.username || message.from?.first_name}`
              );
              console.log(`  Text: ${message.text || "(no text)"}`);
            }

            // Forward to backend webhook
            try {
              const webhookRes = await axios.post(
                "http://localhost:3001/api/telegram/webhook",
                update
              );
              console.log(`  ✅ Processed - Status: ${webhookRes.status}\n`);
            } catch (webhookErr: any) {
              console.log(`  ❌ Webhook Error: ${webhookErr.message}`);
              console.log(`     Status: ${webhookErr.response?.status}`);
              console.log(
                `     Data: ${JSON.stringify(webhookErr.response?.data)}`
              );
              console.log(`\n`);
            }
          } catch (err) {
            console.error(`  ❌ Error:`, err.message);
          }

          offset = update.update_id + 1;
        }
      }
    } catch (error) {
      if (error.code === "ECONNREFUSED") {
        console.log("⚠️ Cannot reach Telegram API (offline?)");
      } else {
        console.log(`❌ Error: ${error.message}`);
      }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

pollMessages();
