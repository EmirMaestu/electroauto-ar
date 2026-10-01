import { useState } from "react";
import { Link } from "react-router";
import { TOOLS, TOOL_CATS, type ToolCat } from "../content/tools";

const PRIO = { 1: "Comprala primero", 2: "Cuando ya trabajás seguido", 3: "Nivel pro" } as const;

export default function Herramientas() {
  const [cat, setCat] = useState<ToolCat | "">("");
  const list = TOOLS.filter((t) => !cat || t.cat === cat);
  return (
    <div className="page">
      <div className="eyebrow">Herramientas</div>
      <h1>Con qué se trabaja</h1>
      <p className="muted" style={{ maxWidth: "68ch" }}>
        Para qué sirve cada herramienta, cómo usarla bien y qué fijarte al comprarla. Si recién arrancás, empezá por las marcadas
        <b> “Comprala primero”</b>: con eso ya diagnosticás la mayoría de las fallas comunes.
      </p>
      <div className="chip-row">
        <span className={`chip ${cat === "" ? "on" : ""}`} onClick={() => setCat("")}>Todas</span>
        {(Object.keys(TOOL_CATS) as ToolCat[]).map((c) => (
          <span key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{TOOL_CATS[c].icon} {TOOL_CATS[c].label}</span>
        ))}
      </div>
      <div className="grid cols-2">
        {list.map((t) => (
          <div key={t.id} id={t.id} className="card tool-card">
            <div className="head">
              <div className="ic">{t.icon}</div>
              <div>
                <h3>{t.nombre}</h3>
                <div className="row" style={{ gap: ".4rem", marginTop: ".25rem" }}>
                  <span className={`pill ${t.prioridad === 1 ? "ok" : t.prioridad === 2 ? "taller" : "experto"}`}>{PRIO[t.prioridad]}</span>
                  <span className="pill">{TOOL_CATS[t.cat].label}</span>
                </div>
              </div>
            </div>
            <p className="mb-0" style={{ color: "var(--text-2)" }}>{t.uso}</p>
            {t.tips.length > 0 && (<><div className="k">Cómo usarla bien</div><ul>{t.tips.map((x, i) => <li key={i}>{x}</li>)}</ul></>)}
            {t.comprar && (<><div className="k">Al comprarla</div><p className="mb-0" style={{ fontSize: ".9rem" }}>{t.comprar}</p></>)}
            {t.cuidado && (<><div className="k" style={{ color: "var(--bad)" }}>Cuidado</div><p className="mb-0" style={{ fontSize: ".9rem" }}>{t.cuidado}</p></>)}
          </div>
        ))}
      </div>
      <div className="card mt-4 center">
        <h3>¿Querés practicar sin romper nada?</h3>
        <p className="muted">El tester, el osciloscopio y el scanner los podés usar en el banco de pruebas virtual.</p>
        <Link className="btn accent" to="/banco">Ir al banco de pruebas 🧪</Link>
      </div>
    </div>
  );
}
