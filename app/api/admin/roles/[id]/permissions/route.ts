import { NextRequest, NextResponse } from "next/server";
import { PERMISSIONS, logAdminAction, requireOwner } from "@/lib/server/rbac";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: RouteContext) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  if (id === "owner") return NextResponse.json({ ok: false, error: "Права owner нельзя ограничить из панели." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const permissionIds = Array.isArray(body.permissionIds)
    ? body.permissionIds.map(String).filter((permission: string) => (PERMISSIONS as readonly string[]).includes(permission))
    : [];

  const supabase = createServiceSupabaseClient();
  const { data: before } = await supabase.from("role_permissions").select("*").eq("role_id", id);
  await supabase.from("role_permissions").delete().eq("role_id", id);
  if (permissionIds.length) {
    await supabase.from("role_permissions").insert(permissionIds.map((permissionId: string) => ({ role_id: id, permission_id: permissionId })));
  }
  const { data: after } = await supabase.from("role_permissions").select("*").eq("role_id", id);

  await logAdminAction({
    actorUid: guard.auth.userId,
    action: "admin.role.permissions.update",
    targetType: "role",
    targetId: id,
    beforeData: before || [],
    afterData: after || [],
  });

  return NextResponse.json({ ok: true, rolePermissions: after || [] });
}
