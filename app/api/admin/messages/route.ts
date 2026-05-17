import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { logAdminAction, requirePermission } from "@/lib/server/rbac";

export async function POST(req: NextRequest) {
  const guard = await requirePermission(req, "support_messages");
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const toUid = String(body.toUid || "");
  const text = String(body.text || "").trim().slice(0, 800);
  if (!toUid || !text) return NextResponse.json({ ok: false, error: "toUid and text are required." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const payload = {
    id: `admin_${Date.now()}_${randomUUID().slice(0, 8)}`,
    from_uid: guard.auth.userId,
    to_uid: toUid,
    text: `[Админ] ${text}`,
    img: null,
    read: false,
    file_type: "system",
  };
  const { error } = await supabase.from("messages").insert(payload);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await logAdminAction({
    actorUid: guard.auth.userId,
    action: "admin.message.send",
    targetType: "user",
    targetId: toUid,
    afterData: payload,
  });

  return NextResponse.json({ ok: true });
}
