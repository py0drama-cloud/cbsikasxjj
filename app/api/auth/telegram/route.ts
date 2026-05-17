import { NextRequest, NextResponse } from "next/server";
import { signJWT } from "@/lib/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import {
  verifyTelegramInitData,
  verifyTelegramLoginWidgetUser,
  type TelegramLoginWidgetUser,
} from "@/lib/auth/telegram-server";
import { isConfiguredOwner } from "@/lib/server/rbac";

type AuthBody = {
  initData?: string;
  user?: TelegramLoginWidgetUser;
  username?: string;
};

function cleanUsername(value?: string | null) {
  return (value || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as AuthBody;
    const verified = body.initData
      ? verifyTelegramInitData(body.initData)
      : body.user
        ? verifyTelegramLoginWidgetUser(body.user)
        : null;

    if (!verified) {
      return NextResponse.json({ ok: false, error: "Telegram auth data is required." }, { status: 400 });
    }

    const telegramUser = verified.user;
    const userId = String(telegramUser.id);
    const username = cleanUsername(body.username || telegramUser.username);
    const supabase = createServiceSupabaseClient();

    const { data: existing, error: existingError } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (existingError) {
      return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
    }

    if ((!existing || !existing.username) && username.length < 3) {
      return NextResponse.json({ ok: true, needsUsername: true, telegramUser });
    }

    if (username.length >= 3) {
      const { data: taken } = await supabase.from("users").select("id").eq("username", username).neq("id", userId).maybeSingle();
      if (taken) {
        return NextResponse.json({ ok: false, error: "Этот username уже занят." }, { status: 409 });
      }
    }

    const telegramUpdates = {
      tg_username: telegramUser.username || null,
      tg_name: `${telegramUser.first_name}${telegramUser.last_name ? ` ${telegramUser.last_name}` : ""}`,
      tg_photo: telegramUser.photo_url || null,
      avatar_url: existing?.avatar_url || telegramUser.photo_url || null,
      ...(isConfiguredOwner(userId, telegramUser.id) ? { is_admin: true } : {}),
    };

    const payload = existing
      ? {
          ...telegramUpdates,
          username: existing.username || username,
        }
      : {
          id: userId,
          username,
          ...telegramUpdates,
          bio: "",
          stars: 300,
          robux: 0,
          rating: 0,
          sales: 0,
          verified: false,
          plan: "FREE",
          worth: 0,
          review_count: 0,
          avatar_gif_url: null,
          name_color: null,
          name_font: "Syne",
          badge_icon: null,
          badge_label: null,
          badge_color: null,
          theme_color: null,
          theme_color_2: null,
          profile_banner: null,
        };

    const query = existing
      ? supabase.from("users").update(payload).eq("id", userId)
      : supabase.from("users").insert(payload);
    const { data: user, error } = await query.select().single();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: error?.message || "Не удалось сохранить профиль." }, { status: 500 });
    }

    const token = await signJWT({ userId, telegramId: telegramUser.id });
    const response = NextResponse.json({ ok: true, user });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram auth failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
