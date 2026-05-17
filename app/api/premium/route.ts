import { NextRequest, NextResponse } from "next/server";
import { PREMIUM_PRICE_STARS } from "@/lib/monetization";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { adjustUserBalance } from "@/lib/server/wallet";

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const supabase = createServiceSupabaseClient();
  const { data: user, error: userError } = await supabase.from("users").select("*").eq("id", auth.userId).single();

  if (userError || !user) {
    return NextResponse.json({ ok: false, error: userError?.message || "User not found." }, { status: 404 });
  }

  if (user.market_banned) {
    return NextResponse.json({ ok: false, error: "Аккаунт ограничен." }, { status: 403 });
  }

  if (user.plan === "PREMIUM") {
    return NextResponse.json({ ok: true, user, alreadyPremium: true });
  }

  try {
    await adjustUserBalance({
      userId: auth.userId,
      currency: "STARS",
      amount: -PREMIUM_PRICE_STARS,
      type: "premium_purchase",
      reason: "Premium seller status",
      refType: "premium",
      refId: auth.userId,
      createdBy: auth.userId,
    });

    const { data: updated, error: updateError } = await supabase
      .from("users")
      .update({ plan: "PREMIUM" })
      .eq("id", auth.userId)
      .select()
      .single();

    if (updateError || !updated) {
      await adjustUserBalance({
        userId: auth.userId,
        currency: "STARS",
        amount: PREMIUM_PRICE_STARS,
        type: "premium_refund",
        reason: "Premium update failed",
        refType: "premium",
        refId: auth.userId,
        createdBy: auth.userId,
      });
      return NextResponse.json({ ok: false, error: updateError?.message || "Premium update failed." }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Premium purchase failed.";
    const status = message.includes("insufficient_funds") ? 402 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
