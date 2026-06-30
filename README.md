# Trójmiasto Startup Radar

Lokalne, polskie i globalne newsy startupowe w jednym miejscu — z gotowym
pomysłem na post LinkedIn jednym kliknięciem.

Next.js (App Router) + TypeScript. RSS-y i wywołania Claude lecą po stronie
serwera, więc nie ma już błędów CORS/408 z przeglądarki.

## Architektura

- `app/page.tsx` — UI (client component), filtrowanie, oznaczanie „użyte" (localStorage).
- `app/api/feeds/route.ts` — serwer pobiera i parsuje wszystkie feedy RSS/Atom, dedup + sort.
- `app/api/generate/route.ts` — serwer woła Claude (`claude-sonnet-4-6`) kluczem z env.
- `app/api/buffer/route.ts` — wysyła post jako **draft** do Buffer (GraphQL API). `GET` listuje kanały.
- `lib/feeds.ts` — lista źródeł + typy.
- `legacy/` — oryginalny prototyp HTML (działał tylko w sandboxie Claude).

## Buffer → LinkedIn

Integracja przez **nowy Buffer GraphQL API** (`https://api.buffer.com`). Stary OAuth
API ma zamkniętą rejestrację aplikacji — używamy personal API key (generuje właściciel
organizacji w ustawieniach Buffer).

Wygenerowany post wpada do Buffer jako **draft** (`saveToDraft: true`) — NIE publikuje
się sam, dopóki nie zatwierdzisz go w Buffer.

Setup:

1. `BUFFER_API_KEY` w `.env.local` (klucz z Buffer).
2. Odpal `npm run dev`, potem `curl http://localhost:3000/api/buffer` — zwróci kanały z `id`.
3. Skopiuj `id` LinkedIna do `BUFFER_CHANNEL_ID`.
4. Przycisk „→ wyślij do Buffer" pod wygenerowanym postem dodaje draft.

## Setup

```bash
npm install
cp .env.local.example .env.local   # wklej swój ANTHROPIC_API_KEY
npm run dev                        # http://localhost:3000
```

Klucz API: https://console.anthropic.com/ → Settings → API Keys.
Bez klucza newsy działają, generowanie postów zwróci błąd.

## Dostęp tylko dla Ciebie (Basic Auth)

Apka jest chroniona globalnym proxy Next.js 16 (`proxy.ts`, dawniej `middleware.ts`) — przeglądarka pyta
o login i hasło PRZED wejściem do UI i przed każdym `/api/*`. Bez hasła nikt nie
dotknie Twojego klucza Anthropic ani Buffera.

Ustaw zmienne:

- `BASIC_AUTH_USER` — login
- `BASIC_AUTH_PASSWORD` — długie, losowe hasło

Zachowanie:

- oba ustawione → wymagane logowanie,
- na produkcji bez nich → apka zwraca **503** (fail-closed, nie wystawi się publicznie),
- lokalnie bez nich → wpuszcza (wygoda przy `npm run dev`).

## Deploy (Vercel)

1. Wypchnij repo na GitHub.
2. Zaimportuj projekt w Vercel (Framework: Next.js — wykryje sam).
3. W **Settings → Environment Variables** dodaj (Production + Preview):
   - `BASIC_AUTH_USER` — Twój login,
   - `BASIC_AUTH_PASSWORD` — długie hasło,
   - `ANTHROPIC_API_KEY` — klucz do generowania postów,
   - opcjonalnie `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID`.
4. **Deploy**. Dostaniesz adres `https://twoja-apka.vercel.app`.

## Na telefonie

1. Otwórz adres z Vercela w przeglądarce telefonu.
2. Podaj login i hasło (Basic Auth) — możesz je zapisać w menedżerze haseł.
3. „Dodaj do ekranu głównego" (Safari: Udostępnij → Dodaj do ekranu początkowego;
   Chrome: ⋮ → Dodaj do ekranu głównego). Apka odpali się pełnoekranowo, jak natywna.

## Źródła

Google News (Trójmiasto/Pomorze, polskie startupy), MamStartup, Antyweb,
TechCrunch, EU-Startups, Sifted, Crunchbase News. Dodaj/zmień w `lib/feeds.ts`.
