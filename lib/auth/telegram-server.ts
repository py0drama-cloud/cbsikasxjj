import "server-only";

import crypto from "crypto";
import type { TelegramUser } from "@/lib/telegram";

export type TelegramAuthResult = {
  user: TelegramUser;
  authDate: number;
};

export type TelegramLoginWidgetUser = TelegramUser & {
  auth_date?: number;
  hash?: string;
};

function getBotToken() {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is required for Telegram auth verification.");
  return token;
}

function getMaxAgeSeconds() {
  return Number(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || 86_400);
}

function assertFreshAuth(authDate: number) {
  const maxAgeSeconds = getMaxAgeSeconds();
  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (!Number.isFinite(authDate) || ageSeconds < 0 || ageSeconds > maxAgeSeconds) {
    throw new Error("Telegram auth data is expired.");
  }
}

function timingSafeHexEqual(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function buildDataCheckString(params: Array<[string, string]>) {
  return params
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

export function verifyTelegramInitData(initData: string): TelegramAuthResult {
  const token = getBotToken();
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const userRaw = params.get("user");
  const authDate = Number(params.get("auth_date"));

  if (!hash || !userRaw || !authDate) {
    throw new Error("Invalid Telegram initData.");
  }

  assertFreshAuth(authDate);

  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const dataCheckString = buildDataCheckString([...params.entries()]);
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (!timingSafeHexEqual(hash, expected)) {
    throw new Error("Telegram initData signature mismatch.");
  }

  return {
    user: JSON.parse(userRaw) as TelegramUser,
    authDate,
  };
}

export function verifyTelegramLoginWidgetUser(loginUser: TelegramLoginWidgetUser): TelegramAuthResult {
  const token = getBotToken();
  const { hash, ...rest } = loginUser;
  const authDate = Number(loginUser.auth_date);

  if (!hash || !authDate) {
    throw new Error("Invalid Telegram login widget data.");
  }

  assertFreshAuth(authDate);

  const secret = crypto.createHash("sha256").update(token).digest();
  const params = Object.entries(rest)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => [key, String(value)] as [string, string]);
  const dataCheckString = buildDataCheckString(params);
  const expected = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  if (!timingSafeHexEqual(hash, expected)) {
    throw new Error("Telegram login widget signature mismatch.");
  }

  return {
    user: loginUser,
    authDate,
  };
}
