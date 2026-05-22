import { NextResponse } from "next/server";

type TelegramChat = {
  id: number | string;
};

type TelegramMessage = {
  chat: TelegramChat;
  text?: string;
  from?: {
    first_name?: string;
  };
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: {
    chat: TelegramChat;
  };
  from?: {
    first_name?: string;
  };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type InlineKeyboardButton = {
  text: string;
  web_app?: { url: string };
  callback_data?: string;
};

const MARKET_BUTTON_TEXT = "Открыть маркет";

function getBotToken() {
  return process.env.BOT_TOKEN || "";
}

function getAppUrl(req: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  return (configuredUrl || new URL(req.url).origin).replace(/\/+$/, "");
}

async function callTelegram(method: string, payload: Record<string, unknown>) {
  const token = getBotToken();
  if (!token) throw new Error("BOT_TOKEN is not configured");

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.description || `Telegram ${method} failed`);
  }

  return data;
}

function marketKeyboard(appUrl: string, includeAbout = true) {
  const keyboard: InlineKeyboardButton[][] = [[{ text: MARKET_BUTTON_TEXT, web_app: { url: appUrl } }]];
  if (includeAbout) keyboard.push([{ text: "О боте", callback_data: "about" }]);
  return { inline_keyboard: keyboard };
}

async function sendMarketIntro(chatId: number | string, appUrl: string, firstName?: string) {
  const name = firstName || "друг";
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: `Привет, ${name}!\n\nRoWorth - маркетплейс для Roblox-разработчиков. Открывай маркет кнопкой ниже.`,
    disable_web_page_preview: true,
    reply_markup: marketKeyboard(appUrl),
  });
}

async function sendAbout(chatId: number | string, appUrl: string) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text:
      "RoWorth Marketplace\n\n" +
      "Покупка и продажа скриптов, карт, UI, моделей и услуг для Roblox прямо в Telegram Web App.",
    disable_web_page_preview: true,
    reply_markup: marketKeyboard(appUrl, false),
  });
}

export async function POST(req: Request) {
  const token = getBotToken();
  if (!token) {
    return NextResponse.json({ ok: false, error: "BOT_TOKEN is not configured" }, { status: 500 });
  }

  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret && req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret) {
    return NextResponse.json({ ok: false, error: "Invalid webhook secret" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) {
    return NextResponse.json({ ok: false, error: "Invalid update" }, { status: 400 });
  }

  const appUrl = getAppUrl(req);

  try {
    const message = update.message;
    if (message?.chat?.id) {
      if (message.text?.startsWith("/start") || message.text?.startsWith("/market")) {
        await sendMarketIntro(message.chat.id, appUrl, message.from?.first_name);
      } else {
        await callTelegram("sendMessage", {
          chat_id: message.chat.id,
          text: "Используй кнопку ниже, чтобы открыть RoWorth.",
          disable_web_page_preview: true,
          reply_markup: marketKeyboard(appUrl, false),
        });
      }
    }

    const callback = update.callback_query;
    if (callback?.id) {
      await callTelegram("answerCallbackQuery", { callback_query_id: callback.id });
      if (callback.data === "about" && callback.message?.chat?.id) {
        await sendAbout(callback.message.chat.id, appUrl);
      }
    }
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Telegram webhook failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "telegram-webhook" });
}
