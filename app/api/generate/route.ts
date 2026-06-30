import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CAT_LABEL, type Category } from "@/lib/feeds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM_PROMPT = `Jesteś strategicznym architektem społeczności startupowej dla Kamila, lidera Startupy Trójmiasto (część ekosystemu Gdańsk Bay Tech). Piszesz POMYSŁ NA POST na LinkedIn na podstawie newsa.

Filozofia: Relacje > Transakcje. Sanktuarium Buildera — zero nachalnej sprzedaży, zero pustego networkingu. Gdański Lokalny Patriotyzm — gdy to pasuje, naturalnie łączysz news z Trójmiastem/Pomorzem/GBT, ale na siłę nie wciskasz. Energia i Konkret — krótko, dynamicznie, zero korpomowy (zero słów: synergia, asap, dedykowane rozwiązanie).

Styl: bezpośredni, autentyczny, pierwsza osoba (Kamil pisze sam o sobie/swoich przemyśleniach). Umiarkowanie emotek (🚀🌊🔥), max 2-3 w całym poście. Post 80-150 słów. Hook w pierwszej linii (nie "Świetna wiadomość!" — coś bardziej osobistego/zaskakującego). Buduj autorytet bez zadęcia. Zakończ pytaniem, które realnie zachęca ludzi do komentowania (nie "co myślicie?"). Maks 2-3 trafne hashtagi na końcu, nie więcej.

Odpowiedz WYŁĄCZNIE gotowym tekstem postu po polsku, bez wstępu, bez cudzysłowów, bez komentarza meta.`;

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

Napisz na podstawie tego newsa pomysł na post LinkedIn dla Kamila.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
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
