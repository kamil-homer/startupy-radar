# Trójmiasto Startup Radar

Lokalne, polskie i globalne newsy startupowe w jednym miejscu — z gotowym
pomysłem na post LinkedIn jednym kliknięciem.

Next.js (App Router) + TypeScript. RSS-y i wywołania Claude lecą po stronie
serwera, więc nie ma już błędów CORS/408 z przeglądarki.

## Architektura

- `app/page.tsx` — UI (client component), filtrowanie, oznaczanie „użyte" (localStorage).
- `app/api/feeds/route.ts` — serwer pobiera i parsuje wszystkie feedy RSS/Atom, dedup + sort.
- `app/api/generate/route.ts` — serwer woła Claude (`claude-sonnet-4-6`) kluczem z env.
- `lib/feeds.ts` — lista źródeł + typy.
- `legacy/` — oryginalny prototyp HTML (działał tylko w sandboxie Claude).

## Setup

```bash
npm install
cp .env.local.example .env.local   # wklej swój ANTHROPIC_API_KEY
npm run dev                        # http://localhost:3000
```

Klucz API: https://console.anthropic.com/ → Settings → API Keys.
Bez klucza newsy działają, generowanie postów zwróci błąd.

## Deploy (Vercel)

1. Wypchnij repo na GitHub.
2. Zaimportuj w Vercel.
3. Dodaj zmienną środowiskową `ANTHROPIC_API_KEY` (Production + Preview).
4. Deploy.

## Źródła

Google News (Trójmiasto/Pomorze, polskie startupy), MamStartup, Antyweb,
TechCrunch, EU-Startups, Sifted, Crunchbase News. Dodaj/zmień w `lib/feeds.ts`.
