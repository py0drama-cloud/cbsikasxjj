import { NextRequest, NextResponse } from "next/server";
import { adjustUserBalance } from "@/lib/server/wallet";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { isConfiguredOwner, logAdminAction, requireOwner, requirePermission } from "@/lib/server/rbac";

type RouteContext = { params: Promise<{ id: string }> };

const USER_UPDATE_KEYS = ["verified", "plan", "market_banned", "ban_reason"] as const;

export async function PATCH(req: NextRequest, context: RouteContext) {
  const body = await req.json().catch(() => ({}));
  const requiresRolePower = "roleIds" in body || body.updates?.is_admin !== undefined;
  const guard = requiresRolePower ? await requireOwner(req) : await requirePermission(req, body.balance ? "manage_balance" : "manage_users");
  if (!guard.ok) return guard.response;

  const { id } = await context.params;
  const supabase = createServiceSupabaseClient();
  const { data: before } = await supabase.from("users").select("*").eq("id", id).single();
  if (!before) return NextResponse.json({ ok: false, error: "Пользователь не найден." }, { status: 404 });

  const targetIsOwner = isConfiguredOwner(before.id);
  const incoming = body.updates || {};

  if (targetIsOwner && (incoming.market_banned === true || incoming.is_admin === false || "roleIds" in body)) {
    return NextResponse.json({ ok: false, error: "Owner cannot be restricted from the admin panel." }, { status: 403 });
  }

  if (Array.isArray(body.roleIds) && body.roleIds.map(String).includes("owner")) {
    return NextResponse.json({ ok: false, error: "Owner role is controlled by OWNER_USER_IDS only." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  USER_UPDATE_KEYS.forEach((key) => {
    if (key in incoming) updates[key] = incoming[key];
  });
  if (requiresRolePower && incoming.is_admin !== undefined) updates.is_admin = Boolean(incoming.is_admin);

  let updated = before;
  if (Object.keys(updates).length > 0) {
    const { data, error } = await supabase.from("users").update(updates).eq("id", id).select().single();
    if (error || !data) return NextResponse.json({ ok: false, error: error?.message || "Не удалось обновить пользователя." }, { status: 500 });
    updated = data;
  }

  if (body.balance) {
    const starsDelta = Number(body.balance.stars || 0);
    const robuxDelta = Number(body.balance.robux || 0);

    if (starsDelta) {
      await adjustUserBalance({
        userId: id,
        currency: "STARS",
        amount: starsDelta,
        type: "admin_adjustment",
        reason: "Admin balance adjustment",
        refType: "admin_user",
        refId: id,
        createdBy: guard.auth.userId,
      });
    }

    if (robuxDelta) {
      await adjustUserBalance({
        userId: id,
        currency: "ROBUX",
        amount: robuxDelta,
        type: "admin_adjustment",
        reason: "Admin balance adjustment",
        refType: "admin_user",
        refId: id,
        createdBy: guard.auth.userId,
      });
    }

    const { data } = await supabase.from("users").select("*").eq("id", id).single();
    if (data) updated = data;
  }

  if (requiresRolePower && Array.isArray(body.roleIds)) {
    const roleIds = body.roleIds.map(String);
    await supabase.from("user_roles").delete().eq("user_id", id);
    if (roleIds.length) {
      await supabase.from("user_roles").insert(roleIds.map((roleId: string) => ({ user_id: id, role_id: roleId, assigned_by: guard.auth.userId })));
    }
  }

  const { data: roleRows } = await supabase.from("user_roles").select("role_id").eq("user_id", id);
  await logAdminAction({
    actorUid: guard.auth.userId,
    action: "admin.user.update",
    targetType: "user",
    targetId: id,
    beforeData: before,
    afterData: { user: updated, roleIds: (roleRows || []).map((row: { role_id: string }) => row.role_id) },
    metadata: { updatedKeys: Object.keys(updates), balance: body.balance || null, rolesChanged: Array.isArray(body.roleIds) },
  });

  return NextResponse.json({ ok: true, user: updated, roleIds: (roleRows || []).map((row: { role_id: string }) => row.role_id) });
}
