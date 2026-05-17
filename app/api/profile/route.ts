import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const supabase = createServiceSupabaseClient();
  const { data: me } = await supabase.from("users").select("plan").eq("id", auth.userId).single();
  const premium = me?.plan === "PREMIUM";

  const payload = {
    bio: String(body.bio || "").slice(0, 400),
    avatar_url: body.avatar_url ? String(body.avatar_url) : null,
    avatar_gif_url: premium && body.avatar_gif_url ? String(body.avatar_gif_url) : null,
    name_color: premium && body.name_color ? String(body.name_color) : null,
    name_font: premium && body.name_font ? String(body.name_font) : "Syne",
    theme_color: premium && body.theme_color ? String(body.theme_color) : null,
    theme_color_2: premium && body.theme_color_2 ? String(body.theme_color_2) : null,
    profile_banner: premium && body.profile_banner ? String(body.profile_banner) : null,
  };

  const { data, error } = await supabase.from("users").update(payload).eq("id", auth.userId).select().single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Не удалось сохранить профиль." }, { status: 500 });

  return NextResponse.json({ ok: true, user: data });
}
