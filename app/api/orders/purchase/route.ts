import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { adjustUserBalance } from "@/lib/server/wallet";
import { sendTelegramMessage } from "@/lib/server/telegram-notify";

type Currency = "STARS" | "ROBUX";
type OrderStatus = "pending" | "confirmed";

function shortOrderId(id: string) {
  return id.slice(-6).toUpperCase();
}

function formatPrice(price: number, cur: string) {
  return `${price} ${cur === "STARS" ? "Stars" : cur === "ROBUX" ? "Robux" : cur}`;
}

function getUsername(user: { username?: string | null; tg_username?: string | null } | null | undefined) {
  return user?.username || user?.tg_username || "user";
}

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const offerId = String(body.offerId || "");
  if (!offerId) return NextResponse.json({ ok: false, error: "offerId is required." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const [{ data: buyer }, { data: offer, error: offerError }] = await Promise.all([
    supabase.from("users").select("*").eq("id", auth.userId).single(),
    supabase.from("offers").select("*, user:users(*)").eq("id", offerId).single(),
  ]);

  if (!buyer || buyer.market_banned) return NextResponse.json({ ok: false, error: "Аккаунт ограничен." }, { status: 403 });
  if (offerError || !offer) return NextResponse.json({ ok: false, error: "Предложение не найдено." }, { status: 404 });
  if (offer.uid === auth.userId) return NextResponse.json({ ok: false, error: "Нельзя купить свой собственный товар." }, { status: 400 });
  if (Number(offer.stock ?? 1) < 1) return NextResponse.json({ ok: false, error: "Товар закончился." }, { status: 409 });

  const currency = offer.cur as Currency;
  const price = Number(offer.price || 0);
  const orderId = `ord_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  let debited = false;
  let stockUpdated = false;

  try {
    await adjustUserBalance({
      userId: auth.userId,
      currency,
      amount: -price,
      type: "order_purchase",
      reason: `Purchase ${offer.id}`,
      refType: "order",
      refId: orderId,
      createdBy: auth.userId,
      metadata: { offer_id: offer.id, seller_id: offer.uid },
    });
    debited = true;

    const { data: updatedOffer, error: stockError } = await supabase
      .from("offers")
      .update({
        stock: Math.max(0, Number(offer.stock ?? 1) - 1),
        sales: Number(offer.sales || 0) + 1,
      })
      .eq("id", offer.id)
      .gt("stock", 0)
      .select("*, user:users(*)")
      .single();

    if (stockError || !updatedOffer) {
      throw new Error("Товар закончился.");
    }
    stockUpdated = true;

    const nextStatus: OrderStatus = offer.auto ? "confirmed" : "pending";
    const orderPayload = {
      id: orderId,
      offer_id: offer.id,
      buyer_uid: auth.userId,
      seller_uid: offer.uid,
      offer_snap: updatedOffer,
      price,
      cur: currency,
      status: nextStatus,
      review_left: false,
      paid_at: now,
      confirmed_at: offer.auto ? now : null,
    };

    const { error: orderError } = await supabase.from("orders").insert(orderPayload);
    if (orderError) throw new Error(orderError.message);

    await supabase.from("purchases").insert({
      id: `purchase_${Date.now()}_${randomUUID().slice(0, 8)}`,
      uid: auth.userId,
      offer_snap: updatedOffer,
      price,
      cur: currency,
    });

    await supabase.from("messages").insert({
      id: `sys_${Date.now()}_${randomUUID().slice(0, 8)}`,
      from_uid: auth.userId,
      to_uid: offer.uid,
      text: `Система: покупатель оплатил заказ #${shortOrderId(orderId)}.\n1 шт. на сумму ${formatPrice(price, currency)}.\nПокупатель: @${getUsername(buyer)}`,
      img: null,
      read: false,
      file_type: "system",
    });

    if (offer.auto) {
      await adjustUserBalance({
        userId: offer.uid,
        currency,
        amount: price,
        type: "order_payout",
        reason: `Auto delivery payout ${orderId}`,
        refType: "order",
        refId: orderId,
        createdBy: auth.userId,
        metadata: { offer_id: offer.id, buyer_id: auth.userId },
      });

      const { data: seller } = await supabase.from("users").select("worth,sales").eq("id", offer.uid).single();
      if (seller) {
        await supabase
          .from("users")
          .update({ worth: Number(seller.worth || 0) + price, sales: Number(seller.sales || 0) + 1 })
          .eq("id", offer.uid);
      }
    }

    await sendTelegramMessage(
      offer.uid,
      `Покупатель оплатил заказ #${shortOrderId(orderId)}\n1 шт. на сумму ${formatPrice(price, currency)}\nПокупатель: @${getUsername(buyer)}`,
      "Открыть чат",
      `${process.env.NEXT_PUBLIC_APP_URL || ""}?chat=${auth.userId}`
    );

    const { data: updatedBuyer } = await supabase.from("users").select("*").eq("id", auth.userId).single();
    return NextResponse.json({
      ok: true,
      orderId,
      status: nextStatus,
      buyer: updatedBuyer || null,
      offer: updatedOffer,
      autoContent: offer.auto ? offer.auto_content || "Контент для автовыдачи не указан." : null,
    });
  } catch (error) {
    if (stockUpdated) {
      await supabase
        .from("offers")
        .update({ stock: Number(offer.stock ?? 1), sales: Number(offer.sales || 0) })
        .eq("id", offer.id);
    }

    if (debited) {
      await adjustUserBalance({
        userId: auth.userId,
        currency,
        amount: price,
        type: "order_refund",
        reason: "Purchase failed",
        refType: "order",
        refId: orderId,
        createdBy: auth.userId,
        metadata: { offer_id: offer.id },
      }).catch(() => null);
    }

    const message = error instanceof Error ? error.message : "Не удалось оформить покупку.";
    const status = message.includes("insufficient_funds") ? 402 : message.includes("закончился") ? 409 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
