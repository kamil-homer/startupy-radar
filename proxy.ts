import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/**
 * Globalna ochrona dostępu (hasło + 2FA TOTP) — Next.js Proxy.
 *
 * W Next.js 16 dawne `middleware.ts` zostało przemianowane na `proxy.ts`
 * (funkcja `proxy`), bo to warstwa proxy z granicą sieciową przed aplikacją.
 * Runtime: Node.js.
 *
 * Przepływ:
 *  - logowanie odbywa się na /login (formularz: hasło + 6-cyfrowy kod 2FA),
 *    które weryfikuje /api/login i ustawia podpisane ciasteczko sesji,
 *  - proxy przepuszcza żądanie tylko z ważną sesją; inaczej przekierowuje na
 *    /login (dla stron) albo zwraca 401 (dla /api/*).
 *
 * Konfiguracja (env):
 *   AUTH_PASSWORD   — hasło (najlepiej długie, losowe),
 *   TOTP_SECRET     — sekret base32 sparowany z Google Authenticator,
 *   SESSION_SECRET  — losowy klucz do podpisu ciasteczek sesji.
 *
 * Fail-closed: na produkcji bez kompletu zmiennych blokujemy wszystko (503),
 * żeby przez przypadek nie wystawić apki publicznie. Lokalnie (dev) bez nich
 * wpuszczamy, by nie męczyć logowaniem przy `npm run dev`.
 */

const PASSWORD = process.env.AUTH_PASSWORD;
const TOTP_SECRET = process.env.TOTP_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

// Ścieżki dostępne bez sesji (inaczej nie dałoby się zalogować).
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/logout"]);

function isConfigured(): boolean {
  return Boolean(PASSWORD && TOTP_SECRET && SESSION_SECRET);
}

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!isConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Dostęp nieskonfigurowany. Ustaw AUTH_PASSWORD, TOTP_SECRET i SESSION_SECRET.",
        { status: 503 },
      );
    }
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (verifySession(token, SESSION_SECRET as string)) {
    return NextResponse.next();
  }

  // Brak ważnej sesji.
  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Chronimy wszystko OPRÓCZ statycznych zasobów Next.js i ikon — dzięki temu
   * strona logowania ładuje style/fonty, ale treść i API są za logowaniem.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
