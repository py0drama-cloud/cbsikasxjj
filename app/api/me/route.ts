import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const supabase = createServiceSupabaseClient();
  const [{ data: user, error: userError }, { data: offers, error: offersError }] = await Promise.all([
    supabase.from("users").select("*").eq("id", auth.userId).single(),
    supabase.from("offers").select("*, user:users(*)").eq("uid", auth.userId).order("created_at", { ascending: false }),
  ]);

  if (userError || !user) return NextResponse.json({ ok: false, error: userError?.message || "User not found." }, { status: 404 });
  if (offersError) return NextResponse.json({ ok: false, error: offersError.message }, { status: 500 });

  return NextResponse.json({ ok: true, user, offers: offers || [] });
}
