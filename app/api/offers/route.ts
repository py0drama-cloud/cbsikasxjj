import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const VALID_KINDS = ["PRODUCT", "SERVICE", "COURSE"] as const;
const VALID_CURRENCIES = ["STARS", "ROBUX"] as const;
const MIN_OFFER_PRICE_STARS = 5;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const supabase = createServiceSupabaseClient();
  let query = supabase.from("offers").select("*, user:users(*)");

  const kind = searchParams.get("kind");
  const currency = searchParams.get("currency");
  const search = searchParams.get("search");

  if (kind && kind !== "ALL") query = query.eq("kind", kind);
  if (currency && currency !== "ALL") query = query.eq("cur", currency);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,type.ilike.%${search}%`);

  const { data, error } = await query.order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, offers: data || [], total: data?.length || 0 });
}

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const kind = String(body.kind || "");
  const type = String(body.type || "").trim();
  const price = Number(body.price || 0);
  const cur = String(body.cur || body.currency || "STARS");
  const stock = Math.max(1, Number(body.stock || 1));

  if (!title || title.length > 60) return NextResponse.json({ ok: false, error: "Некорректное название." }, { status: 400 });
  if (!description || description.length > 1000) return NextResponse.json({ ok: false, error: "Некорректное описание." }, { status: 400 });
  if (!VALID_KINDS.includes(kind as (typeof VALID_KINDS)[number])) return NextResponse.json({ ok: false, error: "Некорректный тип предложения." }, { status: 400 });
  if (!type) return NextResponse.json({ ok: false, error: "Укажи категорию." }, { status: 400 });
  if (!VALID_CURRENCIES.includes(cur as (typeof VALID_CURRENCIES)[number])) return NextResponse.json({ ok: false, error: "Некорректная валюта." }, { status: 400 });
  if (!price || price < MIN_OFFER_PRICE_STARS) return NextResponse.json({ ok: false, error: `Минимальная цена ${MIN_OFFER_PRICE_STARS}.` }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { data: user } = await supabase.from("users").select("id, plan, market_banned").eq("id", auth.userId).single();
  if (!user || user.market_banned) return NextResponse.json({ ok: false, error: "Аккаунт ограничен." }, { status: 403 });

  const { count } = await supabase.from("offers").select("id", { count: "exact", head: true }).eq("uid", auth.userId);
  const limit = user.plan === "PREMIUM" ? 50 : 15;
  if ((count || 0) >= limit) return NextResponse.json({ ok: false, error: `Лимит предложений: ${limit}.` }, { status: 400 });

  const payload = {
    id: `offer_${Date.now()}`,
    uid: auth.userId,
    title,
    description,
    kind,
    type,
    price,
    cur,
    stock,
    auto: Boolean(body.auto ?? body.isAutoDelivery),
    auto_content: body.auto || body.isAutoDelivery ? String(body.auto_content || body.deliveryText || "").trim() || null : null,
    banner: String(body.banner || "").trim() || null,
    boosted: 0,
    boost_end: 0,
    sales: 0,
    rating: 0,
  };

  if (payload.auto && !payload.auto_content) {
    return NextResponse.json({ ok: false, error: "Для автовыдачи нужен контент." }, { status: 400 });
  }

  const { data, error } = await supabase.from("offers").insert(payload).select("*, user:users(*)").single();
  if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Не удалось создать предложение." }, { status: 500 });

  return NextResponse.json({ ok: true, offer: data }, { status: 201 });
}
