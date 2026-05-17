import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { getAccessForUser } from "@/lib/server/rbac";

type NotifyBody = {
  chatId?: string | number;
  text?: string;
  buttonText?: string;
  buttonUrl?: string;
};

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const token = process.env.BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "BOT_TOKEN is not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as NotifyBody;
  if (!body.chatId || !body.text) {
    return NextResponse.json({ ok: false, error: "chatId and text are required" }, { status: 400 });
  }

  if (String(body.chatId) !== auth.userId) {
    const access = await getAccessForUser(auth.userId, auth.telegramId);
    if (!access.permissions.includes("support_messages")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }
  }

  const payload: Record<string, unknown> = {
    chat_id: body.chatId,
    text: body.text,
    disable_web_page_preview: true,
  };

  if (body.buttonText && body.buttonUrl) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: body.buttonText, web_app: { url: body.buttonUrl } }]],
    };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: data?.description || "Telegram send failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data?.result || null });
}
