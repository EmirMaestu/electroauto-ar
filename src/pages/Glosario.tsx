import { useState } from "react";
import { GLOSSARY } from "../content/glossary";

const CATS: Record<string, string> = { motor: "Motor", electrica: "Eléctrica", electronica: "Electrónica", chasis: "Chasis", fisica: "Física", general: "General" };

export default function Glosario() {
  const [q, setQ] = useState("");
  const n = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, "es")).filter((g) => !q || n(g.term + " " + (g.alias ?? []).join(" ") + " " + g.def).includes(n(q)));
  return (
    <div className="page narrow">
      <div className="eyebrow">Glosario</div>
      <h1>Cómo se dice en el taller</h1>
      <p className="muted">Términos técnicos con su explicación en criollo. También los ves al pasar el mouse por las palabras subrayadas en las lecciones.</p>
      <input type="search" placeholder="Buscar término…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: "100%", padding: ".7rem .9rem", fontSize: "1rem", margin: ".5rem 0 1.2rem" }} />
      <div className="stack" style={{ gap: ".6rem" }}>
        {list.map((g) => (
          <div key={g.term} id={encodeURIComponent(g.term)} className="card" style={{ padding: ".9rem 1.1rem", scrollMarginTop: 90 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 className="mb-0">{g.term}{g.alias?.length ? <span className="faint" style={{ fontWeight: 500, fontSize: ".85rem" }}> · {g.alias.join(", ")}</span> : null}</h3>
              <span className="pill">{CATS[g.cat]}</span>
            </div>
            <p className="mb-0 mt-1" style={{ color: "var(--text-2)" }}>{g.def}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
