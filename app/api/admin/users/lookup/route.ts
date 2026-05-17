import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/rbac";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, "manage_users");
  if (!guard.ok) return guard.response;

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json({ ok: false, error: "q is required." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const query = /^\d+$/.test(q)
    ? supabase.from("users").select("*").eq("marketplace_id", Number(q))
    : supabase.from("users").select("*").eq("username", q.replace(/^@/, ""));

  const { data: user, error } = await query.maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!user) return NextResponse.json({ ok: false, error: "Пользователь не найден." }, { status: 404 });

  const { data: roleRows } = await supabase.from("user_roles").select("role_id").eq("user_id", user.id);
  return NextResponse.json({ ok: true, user, roleIds: (roleRows || []).map((row: { role_id: string }) => row.role_id) });
}
