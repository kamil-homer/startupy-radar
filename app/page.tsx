"use client";

import { useCallback, useEffect, useState } from "react";
import { CAT_LABEL, type Category, type NewsItem } from "@/lib/feeds";
import { DEFAULT_CONTEXT } from "@/lib/context";

type Filter = "all" | Category;

const USED_KEY = "startupy-radar:used";
const CONTEXT_KEY = "startupy-radar:context";

function relTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const h = Math.floor(diffMs / 3600000);
  if (h < 1) return "przed chwilą";
  if (h < 24) return `${h} godz. temu`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} dni temu`;
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

interface TransState {
  loading: boolean;
  text: string;
  error: string;
}

interface BufferState {
  sending: boolean;
  ok: boolean;
  error: string;
}

export default function Page() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Namierzanie sygnału...");
  const [scanTime, setScanTime] = useState("—");
  const [trans, setTrans] = useState<Record<string, TransState>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [buffer, setBuffer] = useState<Record<string, BufferState>>({});
  const [context, setContext] = useState(DEFAULT_CONTEXT);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextSaved, setContextSaved] = useState(false);

  // load used set + narrative memory from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(USED_KEY);
      if (raw) setUsed(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
    try {
      const ctx = localStorage.getItem(CONTEXT_KEY);
      if (ctx !== null) setContext(ctx);
    } catch {
      /* ignore */
    }
  }, []);

  const saveContext = () => {
    try {
      localStorage.setItem(CONTEXT_KEY, context);
      setContextSaved(true);
      setTimeout(() => setContextSaved(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const resetContext = () => {
    setContext(DEFAULT_CONTEXT);
    try {
      localStorage.setItem(CONTEXT_KEY, DEFAULT_CONTEXT);
    } catch {
      /* ignore */
    }
  };

  const persistUsed = (next: Set<string>) => {
    try {
      localStorage.setItem(USED_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setStatus("Namierzanie sygnału...");
    try {
      const res = await fetch("/api/feeds", { cache: "no-store" });
      if (!res.ok) throw new Error("http " + res.status);
      const data: { items: NewsItem[]; failed: number } = await res.json();
      setItems(data.items);
      setScanTime(
        new Date().toLocaleTimeString("pl-PL", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
      setStatus(
        data.failed > 0
          ? `Złapano ${data.items.length} sygnałów (${data.failed} ${
              data.failed === 1 ? "źródło niedostępne" : "źródeł niedostępnych"
            } — bywa, spróbuj odświeżyć).`
          : `Złapano ${data.items.length} sygnałów.`
      );
    } catch {
      setStatus("Sygnał przerwany — nie udało się pobrać newsów. Spróbuj odświeżyć.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const toggleUsed = (id: string) => {
    setUsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      persistUsed(next);
      return next;
    });
  };

  const generatePost = async (it: NewsItem) => {
    setTrans((t) => ({ ...t, [it.id]: { loading: true, text: "", error: "" } }));
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: it.title,
          source: it.source,
          cat: it.cat,
          snippet: it.snippet,
          link: it.link,
          context,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.text) throw new Error(data.error || "pusta odpowiedź");
      setTrans((t) => ({ ...t, [it.id]: { loading: false, text: data.text, error: "" } }));
    } catch (e) {
      setTrans((t) => ({
        ...t,
        [it.id]: {
          loading: false,
          text: "",
          error: (e as Error).message || "Sygnał przerwany — spróbuj jeszcze raz.",
        },
      }));
    }
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    });
  };

  const sendToBuffer = async (id: string, text: string) => {
    setBuffer((b) => ({ ...b, [id]: { sending: true, ok: false, error: "" } }));
    try {
      const res = await fetch("/api/buffer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "nie udało się wysłać");
      setBuffer((b) => ({ ...b, [id]: { sending: false, ok: true, error: "" } }));
    } catch (e) {
      setBuffer((b) => ({
        ...b,
        [id]: { sending: false, ok: false, error: (e as Error).message },
      }));
    }
  };

  const counts = {
    all: items.length,
    lokalne: items.filter((i) => i.cat === "lokalne").length,
    polskie: items.filter((i) => i.cat === "polskie").length,
    globalne: items.filter((i) => i.cat === "globalne").length,
  };

  const visible = filter === "all" ? items : items.filter((i) => i.cat === filter);

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "Wszystko" },
    { key: "lokalne", label: "Lokalne" },
    { key: "polskie", label: "Polskie" },
    { key: "globalne", label: "Globalne" },
  ];

  return (
    <div className="wrap">
      <div className="hero">
        <div className="radar-orb" />
        <div className="eyebrow">Startupy Trójmiasto · namierzanie sygnału</div>
        <h1>
          Trójmiasto
          <br />
          Startup Radar
        </h1>
        <p className="sub">
          Lokalne, polskie i globalne newsy startupowe w jednym miejscu — z gotowym
          pomysłem na post LinkedIn jednym kliknięciem.
        </p>
        <div className="scan-row">
          <span>
            <span className="dot lokalne" />
            Lokalne
          </span>
          <span>
            <span className="dot polskie" />
            Polskie
          </span>
          <span>
            <span className="dot globalne" />
            Globalne
          </span>
          <span id="scanTime">ostatni skan: {scanTime}</span>
          <button className="refresh-btn" onClick={loadAll} disabled={loading}>
            ↻ Skanuj ponownie
          </button>
        </div>
      </div>

      <div className="memory">
        <button
          className="memory-toggle"
          onClick={() => setContextOpen((o) => !o)}
          aria-expanded={contextOpen}
        >
          {contextOpen ? "▾" : "▸"} Pamięć narracji
          <span className="memory-hint">— kontekst, którym karmię każdy generowany post</span>
        </button>
        {contextOpen && (
          <div className="memory-body">
            <textarea
              className="memory-text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              spellCheck={false}
              rows={14}
            />
            <div className="memory-actions">
              <button className="gen-btn" onClick={saveContext}>
                {contextSaved ? "zapisano ✓" : "zapisz pamięć"}
              </button>
              <button className="used-toggle" onClick={resetContext}>
                przywróć domyślną
              </button>
              <span className="memory-hint">
                Im konkretniej (firmy, ludzie, wątki) — tym mniej generyczne posty.
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={"tab" + (filter === t.key ? " active" : "")}
            onClick={() => setFilter(t.key)}
          >
            {t.label} <span className="count">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      <div className="list">
        <div className="status-line">{status}</div>
        <div>
          {visible.length === 0 ? (
            <div className="empty">
              {loading
                ? "Namierzanie sygnału..."
                : "Brak sygnałów w tej kategorii. Spróbuj odświeżyć skan."}
            </div>
          ) : (
            visible.map((it) => {
              const isUsed = used.has(it.id);
              const tr = trans[it.id];
              return (
                <div key={it.id} className={"card" + (isUsed ? " used" : "")}>
                  {isUsed && <div className="stamp">użyte</div>}
                  <div className={"tab-strip " + it.cat} />
                  <div className="card-body">
                    <div className="card-meta">
                      <span className="src">{it.source}</span> · {CAT_LABEL[it.cat]} ·{" "}
                      {relTime(it.date)}
                    </div>
                    <p className="card-title">{it.title}</p>
                    {it.snippet && <p className="card-snippet">{it.snippet}</p>}
                    <div className="card-actions">
                      {it.link && (
                        <a
                          className="read-link"
                          href={it.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          czytaj →
                        </a>
                      )}
                      <button
                        className="gen-btn"
                        onClick={() => generatePost(it)}
                        disabled={tr?.loading}
                      >
                        {tr?.loading ? "⟳ namierzam..." : "💡 pomysł na post"}
                      </button>
                      <button className="used-toggle" onClick={() => toggleUsed(it.id)}>
                        {isUsed ? "odznacz" : "oznacz jako użyte"}
                      </button>
                    </div>

                    {tr?.loading && (
                      <div className="transmission">
                        <div className="transmission-label">
                          <span className="pulse" />
                          generuję pomysł...
                        </div>
                      </div>
                    )}
                    {tr?.error && (
                      <div className="transmission">
                        <div className="transmission-label">{tr.error}</div>
                      </div>
                    )}
                    {tr?.text && (
                      <div className="transmission">
                        <div className="transmission-label">
                          💡 pomysł na post — przejrzyj przed publikacją
                        </div>
                        <p className="transmission-text">{tr.text}</p>
                        <div className="card-actions">
                          <button
                            className="copy-btn"
                            onClick={() => copyText(it.id, tr.text)}
                          >
                            {copied === it.id ? "skopiowano ✓" : "kopiuj"}
                          </button>
                          <button
                            className="gen-btn"
                            onClick={() => sendToBuffer(it.id, tr.text)}
                            disabled={buffer[it.id]?.sending || buffer[it.id]?.ok}
                          >
                            {buffer[it.id]?.ok
                              ? "✓ draft w Buffer"
                              : buffer[it.id]?.sending
                                ? "⟳ wysyłam..."
                                : "→ wyślij do Buffer"}
                          </button>
                        </div>
                        {buffer[it.id]?.error && (
                          <div className="transmission-label" style={{ marginTop: 8 }}>
                            Buffer: {buffer[it.id].error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <footer className="note">
        Źródła: Google News (zapytania Trójmiasto/Pomorze, polskie startupy), MamStartup,
        TechCrunch, EU-Startups, Sifted, Crunchbase News. Pomysły na posty generowane przez
        Claude — zawsze przejrzyj przed publikacją.
      </footer>
    </div>
  );
}
