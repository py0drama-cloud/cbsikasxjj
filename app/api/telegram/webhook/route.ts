import { NextResponse } from "next/server";

type TelegramChat = {
  id: number | string;
};

type TelegramUser = {
  id: number;
  first_name?: string;
};

type TelegramMessage = {
  chat: TelegramChat;
  text?: string;
  from?: TelegramUser;
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  from?: TelegramUser;
  message?: {
    chat: TelegramChat;
  };
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type InlineKeyboardButton = {
  text: string;
  web_app?: { url: string };
  url?: string;
  callback_data?: string;
};

function getBotToken() {
  return process.env.BOT_TOKEN || "";
}

function getAppUrl(req: Request) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  return (configuredUrl || new URL(req.url).origin).replace(/\/+$/, "");
}

function getNewsChannelId() {
  if (process.env.NEWS_CHANNEL_ID) return process.env.NEWS_CHANNEL_ID;
  const username = (process.env.NEWS_CHANNEL_USERNAME || "").trim().replace(/^@+/, "");
  return username ? `@${username}` : "";
}

function getNewsChannelUsername() {
  return (process.env.NEWS_CHANNEL_USERNAME || "").trim().replace(/^@+/, "");
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
  const keyboard: InlineKeyboardButton[][] = [[{ text: "Открыть маркет", web_app: { url: appUrl } }]];
  if (includeAbout) keyboard.push([{ text: "О боте", callback_data: "about" }]);
  return { inline_keyboard: keyboard };
}

function subscribeKeyboard(appUrl: string) {
  const keyboard: InlineKeyboardButton[][] = [];
  const channelUsername = getNewsChannelUsername();
  if (channelUsername) {
    keyboard.push([{ text: "Подписаться на канал", url: `https://t.me/${channelUsername}` }]);
  }
  keyboard.push([{ text: "Открыть маркет", web_app: { url: appUrl } }]);
  return { inline_keyboard: keyboard };
}

function isAllowedMemberStatus(status: string) {
  return ["creator", "administrator", "member"].includes(status);
}

async function ensureSubscribed(userId: number | undefined, chatId: number | string, appUrl: string, callbackId?: string) {
  const newsChannelId = getNewsChannelId();
  if (!newsChannelId || !userId) return true;

  try {
    const data = await callTelegram("getChatMember", { chat_id: newsChannelId, user_id: userId });
    if (isAllowedMemberStatus(data?.result?.status || "")) return true;
  } catch {
    // If Telegram cannot verify the channel member, keep the same UX as the long-polling bot.
  }

  if (callbackId) {
    await callTelegram("answerCallbackQuery", {
      callback_query_id: callbackId,
      text: "Сначала подпишись на новостной канал.",
      show_alert: true,
    }).catch(() => null);
  }

  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: "Для использования бота сначала подпишись на новостной канал, а затем повтори команду.",
    disable_web_page_preview: true,
    reply_markup: subscribeKeyboard(appUrl),
  });

  return false;
}

async function sendStartMessage(chatId: number | string, appUrl: string, firstName?: string) {
  const name = firstName || "друг";
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text:
      `Привет, ${name}!\n\n` +
      "RoWorth - маркетплейс для Roblox-разработчиков.\n\n" +
      "Открывай маркет кнопкой ниже.",
    disable_web_page_preview: true,
    reply_markup: marketKeyboard(appUrl),
  });
}

async function sendAboutMessage(chatId: number | string, appUrl: string) {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text:
      "RoWorth Marketplace\n\n" +
      "Скрипты, карты, UI, модели и услуги для Roblox прямо в Telegram Web App.",
    disable_web_page_preview: true,
    reply_markup: marketKeyboard(appUrl, false),
  });
}

export async function POST(req: Request) {
  if (!getBotToken()) {
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
      if (!(await ensureSubscribed(message.from?.id, message.chat.id, appUrl))) {
        return NextResponse.json({ ok: true });
      }

      if (message.text?.startsWith("/start") || message.text?.startsWith("/market")) {
        await sendStartMessage(message.chat.id, appUrl, message.from?.first_name);
      } else {
        await callTelegram("sendMessage", {
          chat_id: message.chat.id,
          text: "Используй /start или кнопку ниже.",
          disable_web_page_preview: true,
          reply_markup: marketKeyboard(appUrl, false),
        });
      }
    }

    const callback = update.callback_query;
    if (callback?.id && callback.message?.chat?.id) {
      if (!(await ensureSubscribed(callback.from?.id, callback.message.chat.id, appUrl, callback.id))) {
        return NextResponse.json({ ok: true });
      }

      await callTelegram("answerCallbackQuery", { callback_query_id: callback.id }).catch(() => null);
      if (callback.data === "about") {
        await sendAboutMessage(callback.message.chat.id, appUrl);
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
