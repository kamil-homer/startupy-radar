import { NextRequest, NextResponse } from "next/server";

/**
 * Globalna ochrona dostępu (HTTP Basic Auth) — Next.js Proxy.
 *
 * W Next.js 16 dawne `middleware.ts` zostało przemianowane na `proxy.ts`
 * (funkcja `proxy`), bo to warstwa proxy z granicą sieciową przed aplikacją.
 * Runtime: Node.js (Edge nie jest tu wspierany w 16) — używane API są przenośne.
 *
 * Działa PRZED każdym żądaniem — także przed endpointami /api/*, więc nikt
 * bez loginu i hasła nie dotknie Twojego klucza Anthropic ani Buffera.
 *
 * Konfiguracja przez zmienne środowiskowe:
 *   BASIC_AUTH_USER     — login
 *   BASIC_AUTH_PASSWORD — hasło
 *
 * Zasady:
 *  - Jeśli oba ustawione → wymagamy logowania.
 *  - Jeśli NIE ustawione, a apka działa na produkcji → blokujemy WSZYSTKO
 *    (fail-closed), żeby przez przypadek nie wystawić apki publicznie.
 *  - Lokalnie (dev) bez ustawionych zmiennych → wpuszczamy, żeby nie męczyć
 *    się logowaniem przy `npm run dev`.
 */

const USER = process.env.BASIC_AUTH_USER;
const PASSWORD = process.env.BASIC_AUTH_PASSWORD;

// Porównanie odporne na proste ataki czasowe (długość + XOR po znakach).
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function unauthorized(): NextResponse {
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Startup Radar", charset="UTF-8"',
    },
  });
}

export function proxy(req: NextRequest): NextResponse {
  // Brak skonfigurowanych danych logowania.
  if (!USER || !PASSWORD) {
    if (process.env.NODE_ENV === "production") {
      // Fail-closed: nie wystawiaj apki publicznie przez przypadek.
      return new NextResponse(
        "Dostęp nieskonfigurowany. Ustaw zmienne BASIC_AUTH_USER i BASIC_AUTH_PASSWORD.",
        { status: 503 },
      );
    }
    // Dev bez konfiguracji — wpuszczamy.
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");
  if (!header || !header.startsWith("Basic ")) {
    return unauthorized();
  }

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return unauthorized();
  }

  // Format: "user:password" (hasło może zawierać dwukropki).
  const sep = decoded.indexOf(":");
  if (sep === -1) return unauthorized();
  const user = decoded.slice(0, sep);
  const password = decoded.slice(sep + 1);

  const ok = safeEqual(user, USER) && safeEqual(password, PASSWORD);
  if (!ok) return unauthorized();

  return NextResponse.next();
}

export const config = {
  /**
   * Chronimy wszystko OPRÓCZ statycznych zasobów Next.js i ikon — dzięki temu
   * strona logowania ładuje style/fonty, ale treść i API są za hasłem.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
