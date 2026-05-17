import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/server/telegram-notify";

type RouteContext = { params: Promise<{ userId: string }> };

const MESSAGE_COOLDOWN_MS = 30_000;

function getUsername(user: { username?: string | null; tg_username?: string | null } | null | undefined) {
  return user?.username || user?.tg_username || "user";
}

async function withSignedAttachments(messages: any[]) {
  const supabase = createServiceSupabaseClient();
  const result = [];
  for (const message of messages) {
    if (message.file_url && !message.img) {
      const { data } = await supabase.storage.from("chat-attachments").createSignedUrl(message.file_url, 60 * 60);
      result.push({ ...message, img: data?.signedUrl || null });
    } else {
      result.push(message);
    }
  }
  return result;
}

export async function GET(req: NextRequest, context: RouteContext) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const { userId } = await context.params;
  if (!userId || userId === auth.userId) return NextResponse.json({ ok: false, error: "Некорректный чат." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .or(`and(from_uid.eq.${auth.userId},to_uid.eq.${userId}),and(from_uid.eq.${userId},to_uid.eq.${auth.userId})`)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabase.from("messages").update({ read: true }).eq("to_uid", auth.userId).eq("from_uid", userId);
  const messages = await withSignedAttachments(data || []);

  return NextResponse.json({ ok: true, messages });
}

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const { userId } = await context.params;
  if (!userId || userId === auth.userId) return NextResponse.json({ ok: false, error: "Некорректный чат." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim().slice(0, 400);
  const img = typeof body.img === "string" && body.img.startsWith("data:image/svg+xml") ? body.img : null;
  const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : null;
  const fileName = body.fileName ? String(body.fileName).slice(0, 120) : null;
  const fileType = body.fileType ? String(body.fileType).slice(0, 80) : null;

  if (!text && !img && !fileUrl) return NextResponse.json({ ok: false, error: "Сообщение пустое." }, { status: 400 });
  if (fileUrl && !fileUrl.startsWith(`${auth.userId}/`)) return NextResponse.json({ ok: false, error: "Некорректный файл." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const { data: latest } = await supabase
    .from("messages")
    .select("created_at")
    .eq("from_uid", auth.userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && Date.now() - new Date(latest.created_at).getTime() < MESSAGE_COOLDOWN_MS) {
    return NextResponse.json({ ok: false, error: "Подожди перед следующим сообщением." }, { status: 429 });
  }

  const { data: sender } = await supabase.from("users").select("username,tg_username").eq("id", auth.userId).single();
  const payload = {
    id: `msg_${Date.now()}_${randomUUID().slice(0, 8)}`,
    from_uid: auth.userId,
    to_uid: userId,
    text,
    img,
    file_url: fileUrl,
    file_name: fileName,
    file_type: fileType,
    read: false,
  };

  const { data: inserted, error } = await supabase.from("messages").insert(payload).select().single();
  if (error || !inserted) return NextResponse.json({ ok: false, error: error?.message || "Не удалось отправить сообщение." }, { status: 500 });

  await sendTelegramMessage(
    userId,
    `Вам пришло новое сообщение в чате от @${getUsername(sender)}.\n\n${fileUrl || img ? "Изображение или стикер" : text.slice(0, 120)}`,
    "Перейти в чат",
    `${process.env.NEXT_PUBLIC_APP_URL || ""}?chat=${auth.userId}`
  );

  const messages = await withSignedAttachments([inserted]);
  return NextResponse.json({ ok: true, message: messages[0] });
}
