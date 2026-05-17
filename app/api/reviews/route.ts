import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/server/telegram-notify";

function getUsername(user: { username?: string | null; tg_username?: string | null } | null | undefined) {
  return user?.username || user?.tg_username || "user";
}

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || "");
  const rating = Number(body.rating || 0);
  const text = String(body.text || "").trim().slice(0, 200);

  if (!orderId) return NextResponse.json({ ok: false, error: "orderId is required." }, { status: 400 });
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return NextResponse.json({ ok: false, error: "Некорректная оценка." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("*, seller:users!seller_uid(*), buyer:users!buyer_uid(*)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) return NextResponse.json({ ok: false, error: "Заказ не найден." }, { status: 404 });
  if (order.buyer_uid !== auth.userId) return NextResponse.json({ ok: false, error: "Нет доступа." }, { status: 403 });
  if (order.status !== "confirmed") return NextResponse.json({ ok: false, error: "Отзыв можно оставить после подтверждения заказа." }, { status: 400 });
  if (order.review_left) return NextResponse.json({ ok: false, error: "Отзыв уже оставлен." }, { status: 400 });

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      id: `rev_${Date.now()}`,
      order_id: order.id,
      seller_uid: order.seller_uid,
      buyer_uid: auth.userId,
      rating,
      text,
    })
    .select("*, buyer:users!buyer_uid(*)")
    .single();

  if (reviewError || !review) return NextResponse.json({ ok: false, error: reviewError?.message || "Не удалось сохранить отзыв." }, { status: 500 });

  await supabase.from("orders").update({ review_left: true }).eq("id", order.id);
  const { data: ratingsData } = await supabase.from("reviews").select("rating").eq("seller_uid", order.seller_uid);
  const ratings = (ratingsData || []).map((row: { rating: number }) => Number(row.rating || 0)).filter(Boolean);
  const average = ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2)) : 0;
  await supabase.from("users").update({ rating: average, review_count: ratings.length }).eq("id", order.seller_uid);

  await sendTelegramMessage(
    order.seller_uid,
    `Новый отзыв от @${getUsername(order.buyer)}\nОценка: ${rating}/5\nПродавец: @${getUsername(order.seller)}`,
    "Открыть маркет",
    process.env.NEXT_PUBLIC_APP_URL || ""
  );

  return NextResponse.json({ ok: true, review });
}
