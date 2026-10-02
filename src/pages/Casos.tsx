import { useState } from "react";
import { Link } from "react-router";
import cases from "../content/legacy/cases.json";
import { useProgress } from "../lib/progress";

export interface Case { id: string; titulo: string; categoria: string; dificultad: string; sintomas: string[]; causas: string[]; procedimiento: string[]; mediciones: { punto: string; esperado: string }[]; solucion: string }
export const CASES = cases as Case[];

export default function Casos() {
  const [cat, setCat] = useState("");
  const progress = useProgress();
  const cats = Array.from(new Set(CASES.map((c) => c.categoria)));
  const list = CASES.filter((c) => !cat || c.categoria === cat);
  return (
    <div className="page narrow" style={{ maxWidth: 900 }}>
      <div className="eyebrow">Casos de falla</div>
      <h1>Diagnosticá como en el taller</h1>
      <p className="muted">Cada caso trae síntomas, causas posibles, el procedimiento y las mediciones. Pensalo vos antes de ver la solución.</p>
      <div className="chip-row">
        <span className={`chip ${!cat ? "on" : ""}`} onClick={() => setCat("")}>Todos</span>
        {cats.map((c) => <span key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</span>)}
      </div>
      <div className="lesson-list">
        {list.map((c, i) => (
          <Link key={c.id} to={`/casos/${c.id}`} className="lesson-row">
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span><div className="t">{c.titulo}</div><div className="s">{c.categoria} · {c.sintomas[0]}</div></span>
            <span className="r">
              <span className={`pill ${c.dificultad === "Baja" ? "base" : c.dificultad === "Media" ? "taller" : "tecnico"}`}>{c.dificultad}</span>
              {progress.cases[c.id] && <span className="check">✓</span>}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
