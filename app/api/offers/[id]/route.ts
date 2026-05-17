import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase.from("offers").select("*, user:users(*)").eq("id", id).single();

  if (error || !data) return NextResponse.json({ ok: false, error: "Предложение не найдено." }, { status: 404 });
  return NextResponse.json({ ok: true, offer: data });
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const { id } = await context.params;
  const body = await req.json().catch(() => ({}));
  const allowed = ["title", "description", "price", "cur", "kind", "type", "auto", "auto_content", "banner", "stock", "cover_index"] as const;
  const payload: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) payload[key] = body[key];
  }

  const supabase = createServiceSupabaseClient();
  const { data: offer } = await supabase.from("offers").select("uid").eq("id", id).single();
  if (!offer) return NextResponse.json({ ok: false, error: "Предложение не найдено." }, { status: 404 });
  if (offer.uid !== auth.userId) return NextResponse.json({ ok: false, error: "Нет доступа." }, { status: 403 });

  const { data, error } = await supabase.from("offers").update(payload).eq("id", id).select("*, user:users(*)").single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Не удалось обновить предложение." }, { status: 500 });

  return NextResponse.json({ ok: true, offer: data });
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  const { data: offer } = await supabase.from("offers").select("uid").eq("id", id).single();
  if (!offer) return NextResponse.json({ ok: false, error: "Предложение не найдено." }, { status: 404 });
  if (offer.uid !== auth.userId) return NextResponse.json({ ok: false, error: "Нет доступа." }, { status: 403 });

  const { error } = await supabase.from("offers").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted: true });
}
