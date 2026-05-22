import { NextResponse } from "next/server";

function mask(value?: string) {
  if (!value) return null;
  if (value.length <= 10) return "***";
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
    botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME || null,
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasJwtSecret: Boolean(process.env.JWT_SECRET),
    hasBotToken: Boolean(process.env.BOT_TOKEN),
    anonKeyPreview: mask(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  });
}
