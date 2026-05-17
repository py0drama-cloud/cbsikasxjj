import "server-only";

import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export const PERMISSIONS = [
  "manage_users",
  "manage_offers",
  "moderate_reports",
  "manage_balance",
  "manage_boosts",
  "manage_roles",
  "view_logs",
  "project_settings",
  "support_messages",
  "refund_orders",
  "delete_reviews",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const LEGACY_ADMIN_PERMISSIONS: Permission[] = [
  "manage_users",
  "manage_offers",
  "moderate_reports",
  "manage_balance",
  "manage_boosts",
  "view_logs",
  "support_messages",
  "refund_orders",
  "delete_reviews",
];

export type AccessContext = {
  userId: string;
  telegramId: number;
  roles: string[];
  permissions: Permission[];
  isOwner: boolean;
};

function getOwnerIds() {
  return (process.env.OWNER_USER_IDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isConfiguredOwner(userId: string, telegramId?: number | string | null) {
  const ownerIds = getOwnerIds();
  return ownerIds.includes(userId) || (telegramId !== undefined && telegramId !== null && ownerIds.includes(String(telegramId)));
}

export async function getAccessForUser(userId: string, telegramId: number): Promise<AccessContext> {
  const supabase = createServiceSupabaseClient();
  const [{ data: user }, { data: roleRows }] = await Promise.all([
    supabase.from("users").select("id,is_admin").eq("id", userId).single(),
    supabase.from("user_roles").select("role_id").eq("user_id", userId),
  ]);

  const roles = new Set<string>();
  const permissions = new Set<Permission>();
  const isOwner = isConfiguredOwner(userId, telegramId);

  if (isOwner) {
    roles.add("owner");
    PERMISSIONS.forEach((permission) => permissions.add(permission));
  }

  if (user?.is_admin) {
    roles.add("admin");
    LEGACY_ADMIN_PERMISSIONS.forEach((permission) => permissions.add(permission));
  }

  const roleIds = (roleRows || []).map((row: { role_id: string }) => row.role_id);
  roleIds.forEach((roleId) => {
    roles.add(roleId);
  });

  if (roleIds.length > 0) {
    const { data: permissionRows } = await supabase.from("role_permissions").select("permission_id").in("role_id", roleIds);
    (permissionRows || []).forEach((permission: { permission_id: string }) => {
      if ((PERMISSIONS as readonly string[]).includes(permission.permission_id)) {
        permissions.add(permission.permission_id as Permission);
      }
    });
  }

  (roleRows || []).forEach((row: { role_id: string }) => {
    roles.add(row.role_id);
  });

  return {
    userId,
    telegramId,
    roles: [...roles],
    permissions: [...permissions],
    isOwner,
  };
}

export async function requirePermission(req: NextRequest, permission: Permission) {
  const auth = await getCurrentUser(req);
  if (!auth) {
    return { ok: false as const, response: Response.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const access = await getAccessForUser(auth.userId, auth.telegramId);
  if (!access.permissions.includes(permission)) {
    return { ok: false as const, response: Response.json({ ok: false, error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true as const, auth, access };
}

export async function requireOwner(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) {
    return { ok: false as const, response: Response.json({ ok: false, error: "Unauthorized" }, { status: 401 }) };
  }

  const access = await getAccessForUser(auth.userId, auth.telegramId);
  if (!access.isOwner) {
    return { ok: false as const, response: Response.json({ ok: false, error: "Owner access required" }, { status: 403 }) };
  }

  return { ok: true as const, auth, access };
}

export async function logAdminAction(input: {
  actorUid: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createServiceSupabaseClient();
  await supabase.from("admin_audit_logs").insert({
    actor_uid: input.actorUid,
    action: input.action,
    target_type: input.targetType || null,
    target_id: input.targetId || null,
    before_data: input.beforeData || null,
    after_data: input.afterData || null,
    metadata: input.metadata || {},
  });
}
