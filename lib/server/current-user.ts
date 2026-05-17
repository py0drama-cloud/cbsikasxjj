import "server-only";

import { NextRequest } from "next/server";
import { verifyJWT, type JWTPayload } from "@/lib/jwt";

export const SESSION_COOKIE_NAME = "rw_session";

export async function getCurrentUser(req: NextRequest): Promise<JWTPayload | null> {
  const cookieToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (cookieToken) {
    const payload = await verifyJWT(cookieToken);
    if (payload) return payload;
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return verifyJWT(auth.slice(7));
}

export function unauthorized() {
  return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
