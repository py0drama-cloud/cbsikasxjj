import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { logAdminAction, requirePermission } from "@/lib/server/rbac";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, context: RouteContext) {
  const guard = await requirePermission(req, "delete_reviews");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  const { data: review } = await supabase.from("reviews").select("*").eq("id", id).single();
  if (!review) return NextResponse.json({ ok: false, error: "Отзыв не найден." }, { status: 404 });

  const { error } = await supabase.from("reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const { data: ratingsData } = await supabase.from("reviews").select("rating").eq("seller_uid", review.seller_uid);
  const ratings = (ratingsData || []).map((row: { rating: number }) => Number(row.rating || 0)).filter(Boolean);
  const average = ratings.length ? Number((ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(2)) : 0;
  await supabase.from("users").update({ rating: average, review_count: ratings.length }).eq("id", review.seller_uid);

  await logAdminAction({
    actorUid: guard.auth.userId,
    action: "admin.review.delete",
    targetType: "review",
    targetId: id,
    beforeData: review,
  });

  return NextResponse.json({ ok: true });
}
