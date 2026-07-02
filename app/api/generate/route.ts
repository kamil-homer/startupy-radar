import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CAT_LABEL, type Category } from "@/lib/feeds";
import { DEFAULT_CONTEXT } from "@/lib/context";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM_PROMPT = `Jesteś asystentem researchu dla Kamila, lidera Startupy Trójmiasto (część ekosystemu Gdańsk Bay Tech). NIE piszesz gotowego posta — pisaniem na LinkedIn zajmuje się osobny agent w jego Claude Project. Twoje zadanie: przygotować krótkie podsumowanie newsa, na podstawie którego Kamil szybko oceni, czy chce o tym pisać.

Przygotuj:
1. 2-4 punkty z najciekawszymi/najistotniejszymi faktami z newsa — konkret: liczby, nazwy, kwoty, daty. Priorytet dla kontrastów (przed/po, strata/zysk, prywatna/publiczna wycena) i nieoczywistych kątów — patrz PRZYKŁADY POSTÓW w PAMIĘCI NARRACJI, to wzorzec typu historii, który Kamila interesuje. Bez ocen, bez lania wody, bez frazesów.
2. Opcjonalnie, tylko jeśli realnie pasuje do PAMIĘCI NARRACJI poniżej (wątki, wartości, przykłady postów) — jedno zdanie, czemu to może zainteresować Kamila. Nie ogranicza się to do newsów lokalnych z Trójmiasta — przykłady pokazują, że interesują go też uniwersalne historie founderskie. Jeśli nic nie pasuje, pomiń ten punkt. Nie zmyślaj powiązań, których nie ma w PAMIĘCI NARRACJI.
3. Na końcu osobną linią przepisz dokładnie pole "Link" z danych newsa poniżej, bez zmian, w formacie: Link: <url>

Format: krótkie punkty (myślniki), po polsku. Bez wstępu, bez cudzysłowów, bez komentarza meta, bez hashtagów, bez emotek.

# PAMIĘĆ NARRACJI (kontekst od Kamila — trzymaj się go ściśle, nie zmyślaj faktów spoza tej listy)
${DEFAULT_CONTEXT.trim()}`;

interface GenBody {
  title?: string;
  source?: string;
  cat?: Category;
  snippet?: string;
  link?: string;
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

  const { title, source, cat, snippet, link } = body;
  if (!title) {
    return NextResponse.json({ error: "Brak tytułu newsa." }, { status: 400 });
  }

  const userPrompt = `News:
Tytuł: ${title}
Źródło: ${source ?? ""}
Kategoria: ${cat ? CAT_LABEL[cat] : ""}
Opis: ${snippet || "(brak opisu, bazuj na tytule)"}
Link: ${link ?? ""}

Przygotuj na podstawie tego newsa krótkie podsumowanie faktów dla Kamila (patrz instrukcje systemowe).`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
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
