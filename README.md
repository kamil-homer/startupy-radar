# Trójmiasto Startup Radar

Lokalne, polskie i globalne newsy startupowe w jednym miejscu — z gotowym
pomysłem na post LinkedIn jednym kliknięciem.

Next.js (App Router) + TypeScript. RSS-y i wywołania Claude lecą po stronie
serwera, więc nie ma już błędów CORS/408 z przeglądarki.

## Architektura

- `app/page.tsx` — UI (client component), filtrowanie, oznaczanie „użyte" (localStorage).
- `app/api/feeds/route.ts` — serwer pobiera i parsuje wszystkie feedy RSS/Atom, dedup + sort.
- `app/api/generate/route.ts` — serwer woła Claude (`claude-sonnet-5`) kluczem z env.
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

## Dostęp tylko dla Ciebie (hasło + 2FA)

Apka jest chroniona globalnym proxy Next.js 16 (`proxy.ts`, dawniej `middleware.ts`).
Logowanie to **dwa czynniki**: hasło (coś, co wiesz) + 6-cyfrowy kod TOTP z
aplikacji typu Google Authenticator (coś, co masz). Ochrona stoi PRZED UI i przed
każdym `/api/*`, więc bez zalogowania nikt nie dotknie klucza Anthropic ani Buffera.

Jak to działa:

- wejście bez sesji → przekierowanie na `/login` (dla `/api/*` → `401`),
- na `/login` podajesz hasło + kod 2FA → `/api/login` weryfikuje oba i ustawia
  podpisane ciasteczko sesji (HttpOnly, ważne 30 dni),
- `/api/logout` kasuje sesję.

Zmienne środowiskowe:

- `AUTH_PASSWORD` — hasło (najlepiej długie, losowe),
- `TOTP_SECRET` — sekret base32 sparowany z Authenticatorem,
- `SESSION_SECRET` — losowy klucz do podpisu ciasteczek.

Zachowanie bez konfiguracji: na produkcji apka zwraca **503** (fail-closed, nie
wystawi się publicznie); lokalnie (`npm run dev`) wpuszcza, by nie męczyć logowaniem.

### Wygenerowanie sekretów 2FA

```bash
node scripts/totp-setup.mjs        # wypisze TOTP_SECRET, SESSION_SECRET, otpauth URI
```

W Google Authenticator: „+" → **Enter a setup key** → wklej `TOTP_SECRET` (Time based).
`AUTH_PASSWORD` wymyślasz sam, np. `openssl rand -base64 24`.

## Deploy (Vercel)

1. Wypchnij repo na GitHub.
2. Zaimportuj projekt w Vercel (Framework: Next.js — wykryje sam).
3. W **Settings → Environment Variables** dodaj (Production + Preview):
   - `AUTH_PASSWORD`, `TOTP_SECRET`, `SESSION_SECRET` — logowanie (patrz wyżej),
   - `ANTHROPIC_API_KEY` — klucz do generowania postów,
   - opcjonalnie `BUFFER_API_KEY`, `BUFFER_CHANNEL_ID`.
4. **Deploy**. Dostaniesz adres `https://twoja-apka.vercel.app`.

## Na telefonie

1. Otwórz adres z Vercela w przeglądarce telefonu.
2. Na ekranie logowania podaj hasło + kod 2FA z Authenticatora. Hasło możesz zapisać
   w menedżerze haseł; sesja trzyma się 30 dni, więc nie logujesz się za każdym razem.
3. „Dodaj do ekranu głównego" (Safari: Udostępnij → Dodaj do ekranu początkowego;
   Chrome: ⋮ → Dodaj do ekranu głównego). Apka odpali się pełnoekranowo, jak natywna.

## Źródła

Google News (Trójmiasto/Pomorze, polskie startupy), MamStartup, Antyweb,
TechCrunch, EU-Startups, Sifted, Crunchbase News. Dodaj/zmień w `lib/feeds.ts`.
