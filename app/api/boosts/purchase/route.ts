import { NextRequest, NextResponse } from "next/server";
import { BOOST_PACKAGES, getBoostPackage } from "@/lib/monetization";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { adjustUserBalance } from "@/lib/server/wallet";

const MAX_BOOST_WINDOW_MS = 1000 * 60 * 60 * 24 * 14;

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const offerId = String(body.offerId || "");
  const packageId = String(body.packageId || BOOST_PACKAGES[0].id);
  const boostPackage = getBoostPackage(packageId);

  if (!offerId) return NextResponse.json({ ok: false, error: "offerId is required." }, { status: 400 });
  if (!boostPackage) return NextResponse.json({ ok: false, error: "Некорректный пакет буста." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const [{ data: user }, { data: offer, error: offerError }] = await Promise.all([
    supabase.from("users").select("id, market_banned").eq("id", auth.userId).single(),
    supabase.from("offers").select("*, user:users(*)").eq("id", offerId).single(),
  ]);

  if (!user || user.market_banned) return NextResponse.json({ ok: false, error: "Аккаунт ограничен." }, { status: 403 });
  if (offerError || !offer) return NextResponse.json({ ok: false, error: "Предложение не найдено." }, { status: 404 });
  if (offer.uid !== auth.userId) return NextResponse.json({ ok: false, error: "Бустить можно только свой товар." }, { status: 403 });

  const currentEndMs = Math.max(Number(offer.boost_end || 0), offer.boosted_until ? new Date(offer.boosted_until).getTime() : 0);
  if (currentEndMs - Date.now() > MAX_BOOST_WINDOW_MS) {
    return NextResponse.json({ ok: false, error: "Нельзя накопить буст больше чем на 14 дней вперед." }, { status: 400 });
  }

  const boostId = `boost_${Date.now()}`;
  const startsAtMs = Math.max(Date.now(), currentEndMs || 0);
  const endsAtMs = startsAtMs + boostPackage.durationHours * 60 * 60 * 1000;

  try {
    await adjustUserBalance({
      userId: auth.userId,
      currency: "STARS",
      amount: -boostPackage.price,
      type: "boost_purchase",
      reason: `Boost ${boostPackage.label}`,
      refType: "boost",
      refId: boostId,
      createdBy: auth.userId,
      metadata: { offer_id: offer.id, package_id: boostPackage.id },
    });

    const { error: boostError } = await supabase.from("offer_boosts").insert({
      id: boostId,
      offer_id: offer.id,
      seller_id: auth.userId,
      package_id: boostPackage.id,
      currency: "STARS",
      price: boostPackage.price,
      starts_at: new Date(startsAtMs).toISOString(),
      ends_at: new Date(endsAtMs).toISOString(),
      status: "active",
      metadata: { label: boostPackage.label },
    });

    if (boostError) throw new Error(boostError.message);

    const { data: updatedOffer, error: updateError } = await supabase
      .from("offers")
      .update({
        boosted: Number(offer.boosted || 0) + 1,
        boost_end: endsAtMs,
        boosted_until: new Date(endsAtMs).toISOString(),
        boost_score: Number(offer.boost_score || 0) + boostPackage.price,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offer.id)
      .select("*, user:users(*)")
      .single();

    if (updateError || !updatedOffer) throw new Error(updateError?.message || "Не удалось обновить буст.");

    const { data: updatedUser } = await supabase.from("users").select("*").eq("id", auth.userId).single();
    return NextResponse.json({ ok: true, offer: updatedOffer, user: updatedUser || null, boostEndsAt: endsAtMs });
  } catch (error) {
    try {
      await supabase.from("offer_boosts").update({ status: "cancelled" }).eq("id", boostId);
    } catch {
      // best effort cleanup
    }
    await adjustUserBalance({
      userId: auth.userId,
      currency: "STARS",
      amount: boostPackage.price,
      type: "boost_refund",
      reason: "Boost purchase failed",
      refType: "boost",
      refId: boostId,
      createdBy: auth.userId,
      metadata: { offer_id: offer.id },
    }).catch(() => null);

    const message = error instanceof Error ? error.message : "Не удалось купить буст.";
    const status = message.includes("insufficient_funds") ? 402 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
