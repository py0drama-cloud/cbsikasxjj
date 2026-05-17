import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { adjustUserBalance } from "@/lib/server/wallet";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { logAdminAction, requirePermission } from "@/lib/server/rbac";

type RouteContext = { params: Promise<{ id: string }> };

function shortOrderId(id: string) {
  return id.slice(-6).toUpperCase();
}

export async function POST(req: NextRequest, context: RouteContext) {
  const guard = await requirePermission(req, "refund_orders");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", id).single();
  if (!order) return NextResponse.json({ ok: false, error: "Заказ не найден." }, { status: 404 });
  if (order.status === "cancelled") return NextResponse.json({ ok: false, error: "Заказ уже отменен." }, { status: 400 });

  try {
    await adjustUserBalance({
      userId: order.buyer_uid,
      currency: order.cur,
      amount: Number(order.price || 0),
      type: "admin_refund_credit",
      reason: `Admin refund ${order.id}`,
      refType: "order",
      refId: order.id,
      createdBy: guard.auth.userId,
    });

    if (order.status === "confirmed") {
      await adjustUserBalance({
        userId: order.seller_uid,
        currency: order.cur,
        amount: -Number(order.price || 0),
        type: "admin_refund_debit",
        reason: `Admin refund ${order.id}`,
        refType: "order",
        refId: order.id,
        createdBy: guard.auth.userId,
      });
    }

    const { data: updated, error } = await supabase
      .from("orders")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString(), refunded_at: new Date().toISOString() })
      .eq("id", order.id)
      .select()
      .single();
    if (error || !updated) throw new Error(error?.message || "Refund update failed.");

    await supabase.from("messages").insert({
      id: `sys_${Date.now()}_${randomUUID().slice(0, 8)}`,
      from_uid: guard.auth.userId,
      to_uid: order.seller_uid,
      text: `Система: администратор оформил возврат по заказу #${shortOrderId(order.id)}.`,
      img: null,
      read: false,
      file_type: "system",
    });

    await logAdminAction({
      actorUid: guard.auth.userId,
      action: "admin.order.refund",
      targetType: "order",
      targetId: order.id,
      beforeData: order,
      afterData: updated,
    });

    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось оформить возврат.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
