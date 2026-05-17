import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, unauthorized } from "@/lib/server/current-user";
import { createServiceSupabaseClient } from "@/lib/supabase/server";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "image";
}

export async function POST(req: NextRequest) {
  const auth = await getCurrentUser(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const dataUrl = String(body.dataUrl || "");
  const fileName = safeName(String(body.fileName || "image"));
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
  if (!match) return NextResponse.json({ ok: false, error: "Поддерживаются только png/jpeg/webp/gif." }, { status: 400 });

  const mime = match[1];
  if (!ALLOWED.has(mime)) return NextResponse.json({ ok: false, error: "Некорректный тип файла." }, { status: 400 });

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_FILE_BYTES) return NextResponse.json({ ok: false, error: "Файл больше 5 MB." }, { status: 400 });

  const supabase = createServiceSupabaseClient();
  const path = `${auth.userId}/${Date.now()}_${fileName}`;
  const { error } = await supabase.storage.from("chat-attachments").upload(path, buffer, {
    contentType: mime,
    upsert: false,
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, path, fileName, fileType: mime });
}
