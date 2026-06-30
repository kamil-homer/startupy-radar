export type Category = "lokalne" | "polskie" | "globalne";

export interface Feed {
  name: string;
  cat: Category;
  url: string;
}

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  snippet: string;
  source: string;
  cat: Category;
  date: string;
  ts: number;
}

const gnews = (q: string, hl: string, gl: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`;

export const FEEDS: Feed[] = [
  { name: "Google News · Trójmiasto", cat: "lokalne", url: gnews("Trójmiasto OR Gdańsk OR Gdynia OR Sopot startup", "pl", "PL") },
  { name: "MamStartup · Gdańsk", cat: "lokalne", url: "https://mamstartup.pl/tag/gdansk/feed/" },
  { name: "MamStartup", cat: "polskie", url: "https://mamstartup.pl/feed/" },
  { name: "Startup Poland", cat: "polskie", url: "https://startuppoland.org/feed/" },
  { name: "Google News · PFR / VC Polska", cat: "polskie", url: gnews('"PFR Ventures" OR "Polski Fundusz Rozwoju" OR fundusz VC Polska startup', "pl", "PL") },
  { name: "Google News · Polskie startupy", cat: "polskie", url: gnews("polski startup runda inwestycyjna OR finansowanie", "pl", "PL") },
  { name: "TechCrunch", cat: "globalne", url: "https://techcrunch.com/feed/" },
  { name: "EU-Startups", cat: "globalne", url: "https://www.eu-startups.com/feed/" },
  { name: "Sifted", cat: "globalne", url: "https://sifted.eu/feed" },
  { name: "Crunchbase News", cat: "globalne", url: "https://news.crunchbase.com/feed/" },
];

export const CAT_LABEL: Record<Category, string> = {
  lokalne: "Lokalne",
  polskie: "Polskie",
  globalne: "Globalne",
};
