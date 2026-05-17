import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { adjustUserBalance } from "@/lib/server/wallet";
import { sendTelegramMessage } from "@/lib/server/telegram-notify";

type RouteContext = { params: Promise<{ id: string }> };

function shortOrderId(id: string) {
  return id.slice(-6).toUpperCase();
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  const { data: order, error } = await supabase.from("orders").select("*").eq("id", id).single();

  if (error || !order) return NextResponse.json({ ok: false, error: "Заказ не найден." }, { status: 404 });
  if (order.seller_uid !== auth.userId) return NextResponse.json({ ok: false, error: "Нет доступа." }, { status: 403 });
  if (order.status !== "pending") return NextResponse.json({ ok: false, error: "Заказ уже обработан." }, { status: 400 });

  try {
    await adjustUserBalance({
      userId: order.seller_uid,
      currency: order.cur,
      amount: Number(order.price || 0),
      type: "order_payout",
      reason: `Manual order confirmation ${order.id}`,
      refType: "order",
      refId: order.id,
      createdBy: auth.userId,
      metadata: { buyer_id: order.buyer_uid, offer_id: order.offer_id },
    });

    const { data: seller } = await supabase.from("users").select("worth,sales").eq("id", order.seller_uid).single();
    if (seller) {
      await supabase
        .from("users")
        .update({ worth: Number(seller.worth || 0) + Number(order.price || 0), sales: Number(seller.sales || 0) + 1 })
        .eq("id", order.seller_uid);
    }

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", order.id)
      .select()
      .single();

    if (updateError || !updated) throw new Error(updateError?.message || "Не удалось подтвердить заказ.");

    const text = `Заказ #${shortOrderId(order.id)} подтвержден продавцом. Теперь ты можешь оставить отзыв в разделе заказов.`;
    await supabase.from("messages").insert({
      id: `sys_${Date.now()}_${randomUUID().slice(0, 8)}`,
      from_uid: auth.userId,
      to_uid: order.buyer_uid,
      text,
      img: null,
      read: false,
      file_type: "system",
    });
    await sendTelegramMessage(order.buyer_uid, text, "Открыть маркет", process.env.NEXT_PUBLIC_APP_URL || "");

    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось подтвердить заказ.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
