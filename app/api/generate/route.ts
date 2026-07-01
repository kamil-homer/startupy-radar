import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CAT_LABEL, type Category } from "@/lib/feeds";
import { DEFAULT_CONTEXT } from "@/lib/context";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BASE_PROMPT = `Jesteś strategicznym architektem społeczności startupowej dla Kamila, lidera Startupy Trójmiasto (część ekosystemu Gdańsk Bay Tech). Piszesz POMYSŁ NA POST na LinkedIn na podstawie newsa.

Filozofia: Relacje > Transakcje. Sanktuarium Buildera — zero nachalnej sprzedaży, zero pustego networkingu. Gdański Lokalny Patriotyzm — gdy to pasuje, naturalnie łączysz news z Trójmiastem/Pomorzem/GBT, ale na siłę nie wciskasz. Energia i Konkret — krótko, dynamicznie, zero korpomowy (zero słów: synergia, asap, dedykowane rozwiązanie).

Styl: bezpośredni, autentyczny, pierwsza osoba. Max 1-2 emotki w całym poście (często zero). Hook w pierwszej linii — musi zaczepić w pierwszych ~200 znakach (przed "...zobacz więcej"); nie "Świetna wiadomość!", coś osobistego/zaskakującego/kontrariańskiego. Zakończ jednym konkretnym pytaniem (nie "co myślicie?"). Maks 2-3 trafne hashtagi.

DŁUGOŚĆ: krótko i mocno. 40-90 słów, twardy limit ~650 znaków. Lepiej za krótko niż za długo. Tnij każde zdanie, które nie wnosi.

ZAKAZANE (to brzmi jak generyczny LinkedIn / sztuczny insider — NIGDY tak nie pisz):
- Udawane obserwacje o społeczności/ekosystemie, których nie wiesz: "Widzę, że wiele zespołów...", "Wiele firm w naszym ekosystemie...", "Coraz więcej founderów...". Jeśli czegoś realnie nie wiesz z PAMIĘCI NARRACJI — nie twierdź tego.
- Wata i frazesy: "to może być game changer", "najlepszy stosunek X do Y", "to nie tylko news dla...".
- Korpomowa: synergia, asap, dedykowane rozwiązanie.
- Surowe URL-e w treści (zabijają zasięg LinkedIn). Źródło wspominaj tylko z nazwy ("jak donosi TechCrunch"), bez wklejania linku.

Pisz konkret z własnego zdania/obserwacji, nie streszczaj newsa jak prasówka.

Odpowiedz WYŁĄCZNIE gotowym tekstem postu po polsku, bez wstępu, bez cudzysłowów, bez komentarza meta.`;

function buildSystemPrompt(context: string): string {
  const ctx = context.trim();
  if (!ctx) return BASE_PROMPT;
  return `${BASE_PROMPT}

# PAMIĘĆ NARRACJI (kontekst od Kamila — trzymaj się go ściśle, nie zmyślaj faktów spoza tej listy)
${ctx}`;
}

interface GenBody {
  title?: string;
  source?: string;
  cat?: Category;
  snippet?: string;
  link?: string;
  context?: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Brak ANTHROPIC_API_KEY na serwerze." },
      { status: 500 }
    );
  }

  let body: GenBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Zły JSON." }, { status: 400 });
  }

  const { title, source, cat, snippet, link, context } = body;
  if (!title) {
    return NextResponse.json({ error: "Brak tytułu newsa." }, { status: 400 });
  }
  const systemPrompt = buildSystemPrompt(context ?? DEFAULT_CONTEXT);

  const userPrompt = `News:
Tytuł: ${title}
Źródło: ${source ?? ""}
Kategoria: ${cat ? CAT_LABEL[cat] : ""}
Opis: ${snippet || "(brak opisu, bazuj na tytule)"}
Link: ${link ?? ""}

Napisz na podstawie tego newsa pomysł na post LinkedIn dla Kamila.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("\n")
      .trim();
    if (!text) throw new Error("pusta odpowiedź");
    return NextResponse.json({ text });
  } catch (e) {
    console.error("generate failed:", e);
    return NextResponse.json(
      { error: "Sygnał przerwany — generowanie nie powiodło się." },
      { status: 502 }
    );
  }
}
