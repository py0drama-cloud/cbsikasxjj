import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/server/rbac";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const guard = await requirePermission(req, "view_logs");
  if (!guard.ok) return guard.response;

  const supabase = createServiceSupabaseClient();
  const [users, offers, orders, reviews, banned, pending, latest, recentOrdersData, recentReviewsData, roles, permissions, rolePermissions, logs] =
    await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("offers").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("reviews").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("market_banned", true),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("users").select("*").order("created_at", { ascending: false }).limit(8),
      supabase.from("orders").select("*, buyer:users!buyer_uid(*), seller:users!seller_uid(*)").order("created_at", { ascending: false }).limit(8),
      supabase.from("reviews").select("*, buyer:users!buyer_uid(*)").order("created_at", { ascending: false }).limit(8),
      supabase.from("roles").select("*").order("id", { ascending: true }),
      supabase.from("permissions").select("*").order("id", { ascending: true }),
      supabase.from("role_permissions").select("*"),
      supabase.from("admin_audit_logs").select("*, actor:users!actor_uid(*)").order("created_at", { ascending: false }).limit(20),
    ]);

  return NextResponse.json({
    ok: true,
    access: guard.access,
    stats: {
      users: users.count || 0,
      offers: offers.count || 0,
      orders: orders.count || 0,
      reviews: reviews.count || 0,
      banned: banned.count || 0,
      pending: pending.count || 0,
    },
    latestUsers: latest.data || [],
    recentOrders: recentOrdersData.data || [],
    recentReviews: recentReviewsData.data || [],
    roles: roles.data || [],
    permissions: permissions.data || [],
    rolePermissions: rolePermissions.data || [],
    auditLogs: logs.data || [],
  });
}
