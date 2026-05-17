import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const supabase = createServiceSupabaseClient();
  const [unread, pending] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("to_uid", auth.userId).eq("read", false),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_uid", auth.userId).eq("status", "pending"),
  ]);

  return NextResponse.json({ ok: true, unread: unread.count || 0, pendingOrders: pending.count || 0 });
}
