import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const supabase = createServiceSupabaseClient();
  const [{ data: user, error: userError }, { data: transactions, error: txError }] = await Promise.all([
    supabase.from("users").select("id, stars, robux, plan, premium_until").eq("id", auth.userId).single(),
    supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (userError || txError) {
    return NextResponse.json({ ok: false, error: userError?.message || txError?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, user, transactions: transactions || [] });
}
