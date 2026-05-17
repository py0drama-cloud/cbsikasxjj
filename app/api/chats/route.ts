import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*, from_user:users!from_uid(*), to_user:users!to_uid(*)")
    .or(`from_uid.eq.${auth.userId},to_uid.eq.${auth.userId}`)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const map = new Map<string, { user: unknown; last: unknown; unread: number }>();
  (data || []).forEach((message: any) => {
    const otherId = message.from_uid === auth.userId ? message.to_uid : message.from_uid;
    const otherUser = message.from_uid === auth.userId ? message.to_user : message.from_user;
    if (!otherUser || otherId === auth.userId) return;
    const prev = map.get(otherId);
    map.set(otherId, {
      user: otherUser,
      last: message,
      unread: (prev?.unread || 0) + (!message.read && message.to_uid === auth.userId ? 1 : 0),
    });
  });

  const conversations = [...map.values()].sort((a: any, b: any) => new Date(b.last.created_at).getTime() - new Date(a.last.created_at).getTime());
  return NextResponse.json({ ok: true, conversations });
}
