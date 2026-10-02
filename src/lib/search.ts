import { ALL_LESSONS, isReady } from "../content/registry";
import { TOOLS } from "../content/tools";
import { GLOSSARY } from "../content/glossary";
import cases from "../content/legacy/cases.json";
import curriculum from "../content/legacy/curriculum.json";

export interface SearchItem { title: string; sub: string; to: string; icon: string; kind: string; text: string }

const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const legacyText: Record<string, string> = {};
for (const L of curriculum as any[]) for (const m of L.modules) for (const l of m.lessons) legacyText[l.id] = strip(l.html);

let INDEX: SearchItem[] | null = null;
function build(): SearchItem[] {
  const out: SearchItem[] = [];
  for (const l of ALL_LESSONS) {
    out.push({
      title: l.title, sub: `${l.part.title}${isReady(l) ? "" : " · próximamente"}`, to: l.path, icon: l.part.icon, kind: "Lección",
      text: norm([l.title, l.summary, (l.tags ?? []).join(" "), l.source.kind === "legacy" ? legacyText[l.source.id] ?? "" : ""].join(" ")),
    });
  }
  for (const t of TOOLS) out.push({ title: t.nombre, sub: t.uso.slice(0, 90) + "…", to: `/herramientas#${t.id}`, icon: t.icon, kind: "Herramienta", text: norm(t.nombre + " " + t.uso + " " + t.tips.join(" ")) });
  for (const c of cases as any[]) out.push({ title: c.titulo, sub: `Caso · ${c.categoria}`, to: `/casos/${c.id}`, icon: "🚗", kind: "Caso", text: norm(c.titulo + " " + c.sintomas.join(" ") + " " + c.causas.join(" ")) });
  for (const g of GLOSSARY) out.push({ title: g.term, sub: g.def.slice(0, 90) + "…", to: `/glosario#${encodeURIComponent(g.term)}`, icon: "📖", kind: "Glosario", text: norm(g.term + " " + (g.alias ?? []).join(" ") + " " + g.def) });
  const pages: [string, string, string][] = [
    ["Banco de pruebas", "/banco", "🧪"], ["Tester virtual", "/banco/tester", "🔢"], ["Osciloscopio virtual", "/banco/osciloscopio", "📈"],
    ["Banco de motor con scanner", "/banco/motor", "🖥️"], ["Calculadoras", "/banco/calculadoras", "🧮"], ["Herramientas", "/herramientas", "🧰"],
    ["Casos de falla", "/casos", "🚗"], ["Práctica intensiva", "/practica", "🎯"], ["Biblioteca técnica", "/biblioteca", "📕"],
    ["GNC 5ª generación", "/gnc", "⛽"], ["Mi progreso", "/progreso", "📈"], ["Glosario", "/glosario", "📖"], ["Mapa del curso", "/ruta", "🗺️"],
  ];
  for (const [t, to, ic] of pages) out.push({ title: t, sub: "Sección", to, icon: ic, kind: "Sección", text: norm(t) });
  return out;
}

export function search(q: string, limit = 30): SearchItem[] {
  INDEX ??= build();
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const scored: { s: number; it: SearchItem }[] = [];
  for (const it of INDEX) {
    const title = norm(it.title);
    let s = 0;
    for (const t of terms) {
      if (title.startsWith(t)) s += 12;
      else if (title.includes(t)) s += 8;
      else if (it.text.includes(t)) s += 2;
      else { s = 0; break; }
    }
    if (s > 0) scored.push({ s: s + (it.kind === "Lección" ? 1 : 0), it });
  }
  return scored.sort((a, b) => b.s - a.s).slice(0, limit).map((x) => x.it);
}
