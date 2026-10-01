import { useState } from "react";
import { Link, useParams } from "react-router";
import { CASES } from "./Casos";
import { Store } from "../lib/progress";
import { NotFound } from "./NotFound";

export default function Caso() {
  const { id } = useParams();
  const c = CASES.find((x) => x.id === id);
  const [show, setShow] = useState(false);
  if (!c) return <NotFound />;
  const idx = CASES.indexOf(c);
  const next = CASES[idx + 1];
  return (
    <div className="page narrow">
      <div className="lesson-head">
        <div className="crumbs"><Link to="/casos">Casos</Link> <span>›</span> <span>{c.categoria}</span></div>
        <h1>{c.titulo}</h1>
        <div className="meta"><span className="pill">{c.categoria}</span><span className="pill taller">Dificultad {c.dificultad}</span></div>
      </div>
      <div className="stack">
        <div className="card"><h3>🩺 Síntomas</h3><ul>{c.sintomas.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        <div className="card"><h3>🤔 Posibles causas</h3><ul>{c.causas.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
        <div className="card"><h3>🔧 Procedimiento</h3><ol className="mb-0">{c.procedimiento.map((s, i) => <li key={i} style={{ margin: ".35rem 0" }}>{s}</li>)}</ol></div>
        <div className="mediciones" style={{ margin: 0 }}>
          <div className="mediciones-head">📐 Mediciones esperadas</div>
          {c.mediciones.map((m, i) => <div key={i} className="medicion"><div className="punto">{m.punto}</div><div className="esperado">{m.esperado}</div></div>)}
        </div>
        <div className="card" style={{ borderLeft: "4px solid var(--ok)" }}>
          <h3>✅ Solución</h3>
          {show ? <p className="mb-0">{c.solucion}</p> : (
            <>
              <button className="btn accent" onClick={() => { setShow(true); Store.markCase(c.id); }}>Revelar solución (+8 ★)</button>
              <p className="muted mt-1 mb-0" style={{ fontSize: ".86rem" }}>Intentá razonar el diagnóstico antes de mirarla.</p>
            </>
          )}
        </div>
      </div>
      {next && <div className="pager"><span /><Link className="next" to={`/casos/${next.id}`}><div className="dir">Siguiente caso →</div><div className="t">{next.titulo}</div></Link></div>}
    </div>
  );
}
