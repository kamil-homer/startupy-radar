import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  signSession,
  timingSafeEqualStr,
  verifyTotp,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PASSWORD = process.env.AUTH_PASSWORD;
const TOTP_SECRET = process.env.TOTP_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

const SESSION_DAYS = 30;

/**
 * Best-effort limiter prób logowania (per instancja serverless — NIE globalny,
 * ale wystarczająco psuje masowy brute-force; przy 2FA i mocnym haśle to tylko
 * dodatkowa warstwa).
 */
const attempts = new Map<string, { n: number; ts: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.ts > WINDOW_MS) {
    attempts.set(ip, { n: 1, ts: now });
    return false;
  }
  rec.n += 1;
  return rec.n > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  if (!PASSWORD || !TOTP_SECRET || !SESSION_SECRET) {
    return NextResponse.json(
      { error: "Logowanie nieskonfigurowane na serwerze." },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Za dużo prób. Spróbuj ponownie za chwilę." },
      { status: 429 },
    );
  }

  let body: { password?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Błędne żądanie." }, { status: 400 });
  }

  // Liczymy oba czynniki niezależnie od wyniku, żeby nie zdradzać, który
  // element zawiódł (hasło vs kod).
  const passOk = timingSafeEqualStr(body.password ?? "", PASSWORD);
  const codeOk = verifyTotp(body.code ?? "", TOTP_SECRET);

  if (!passOk || !codeOk) {
    return NextResponse.json(
      { error: "Błędne hasło lub kod 2FA." },
      { status: 401 },
    );
  }

  const maxAgeSec = SESSION_DAYS * 24 * 60 * 60;
  const token = signSession(Date.now() + maxAgeSec * 1000, SESSION_SECRET);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSec,
  });
  return res;
}
