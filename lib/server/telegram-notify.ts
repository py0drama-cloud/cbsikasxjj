import "server-only";

export async function sendTelegramMessage(chatId: string, text: string, buttonText?: string, buttonUrl?: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };

  if (buttonText && buttonUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: buttonText, web_app: { url: buttonUrl } }]],
    };
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
}
