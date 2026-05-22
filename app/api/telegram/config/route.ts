import { NextResponse } from "next/server";

function normalizeBotUsername(username: string) {
  return username.trim().replace(/^@+/, "");
}

function isValidBotUsername(username: string) {
  return /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(username);
}

export async function GET() {
  const configuredUsername = normalizeBotUsername(
    process.env.NEXT_PUBLIC_BOT_USERNAME || process.env.BOT_USERNAME || "",
  );

  if (isValidBotUsername(configuredUsername)) {
    return NextResponse.json({ ok: true, botUsername: configuredUsername });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "BOT_TOKEN is not configured" }, { status: 500 });
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  const botUsername = normalizeBotUsername(data?.result?.username || "");

  if (!res.ok || !isValidBotUsername(botUsername)) {
    return NextResponse.json({ ok: false, error: data?.description || "Telegram bot username is invalid" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, botUsername });
}
