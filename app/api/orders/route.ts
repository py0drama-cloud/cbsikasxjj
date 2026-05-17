import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const supabase = createServiceSupabaseClient();
  const [seller, buyer] = await Promise.all([
    supabase
      .from("orders")
      .select("*, buyer:users!buyer_uid(*)")
      .eq("seller_uid", auth.userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("*, seller:users!seller_uid(*)")
      .eq("buyer_uid", auth.userId)
      .order("created_at", { ascending: false }),
  ]);

  if (seller.error || buyer.error) {
    return NextResponse.json({ ok: false, error: seller.error?.message || buyer.error?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sellerOrders: seller.data || [], buyerOrders: buyer.data || [] });
}
