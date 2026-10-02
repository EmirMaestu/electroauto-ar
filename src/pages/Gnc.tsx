import { useState } from "react";
import gnc from "../content/legacy/gnc.json";

const TABS = ["Qué es", "Componentes", "Cableado", "Cómo leer", "Fallas", "Seguridad"];

/** Contenido de GNC (se usa como página y como lección). */
export function GncContent() {
  const [tab, setTab] = useState(0);
  const g = gnc as any;
  return (
    <div>
      <div className="callout warn"><div className="callout-head"><span className="ic">⚠️</span><span className="lbl">Importante</span></div><div dangerouslySetInnerHTML={{ __html: g.caveat }} /></div>
      <div className="chip-row">{TABS.map((t, i) => <span key={t} className={`chip ${i === tab ? "on" : ""}`} onClick={() => setTab(i)}>{t}</span>)}</div>
      {tab === 0 && <div className="card prose"><p className="mb-0" dangerouslySetInnerHTML={{ __html: g.intro }} /></div>}
      {tab === 1 && (
        <>
          <p className="muted">Ilustraciones representativas de un Logan 2008 (no a escala).</p>
          <div className="grid cols-2">{g.components.map((c: any) => (
            <div key={c.name} className="card">
              <div className="gnc-fig" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <h3>{c.icon} {c.name}</h3>
              <p><b>Qué es:</b> <span dangerouslySetInnerHTML={{ __html: c.what }} /></p>
              <p><b>Para qué sirve:</b> <span dangerouslySetInnerHTML={{ __html: c.forr }} /></p>
              <p className="muted mb-0"><b>Cómo se ve:</b> <span dangerouslySetInnerHTML={{ __html: c.look }} /></p>
            </div>
          ))}</div>
        </>
      )}
      {tab === 2 && (
        <>
          <p className="muted">Colores <b>típicos</b>: varían según el kit (Tomasetto, BRC, Longas, etc.) y el instalador.</p>
          <div className="table-wrap"><table className="tbl"><thead><tr><th>Cable</th><th>Color típico</th><th>Señal</th><th>Función</th></tr></thead>
            <tbody>{g.cables.map((c: any) => <tr key={c.cable}><td><b>{c.cable}</b></td><td>{c.color}</td><td dangerouslySetInnerHTML={{ __html: c.senal }} /><td dangerouslySetInnerHTML={{ __html: c.funcion }} /></tr>)}</tbody></table></div>
        </>
      )}
      {tab === 3 && <div className="card"><div className="pasos-host"><ol>{g.leer.map((s: string, i: number) => <li key={i} dangerouslySetInnerHTML={{ __html: s }} />)}</ol></div></div>}
      {tab === 4 && <div className="stack">{g.fallas.map((f: any) => (
        <div key={f.sintoma} className="card">
          <h3>🔧 {f.sintoma}</h3>
          <p><b>Causas posibles:</b> <span dangerouslySetInnerHTML={{ __html: f.causas }} /></p>
          <p><b>Diagnóstico:</b> <span dangerouslySetInnerHTML={{ __html: f.diagnostico }} /></p>
          <p className="mb-0"><b>Mediciones esperadas:</b> <span dangerouslySetInnerHTML={{ __html: f.medicion }} /></p>
        </div>
      ))}</div>}
      {tab === 5 && <div className="card"><ul className="mb-0">{g.seguridad.map((s: string, i: number) => <li key={i} style={{ margin: ".4rem 0" }} dangerouslySetInnerHTML={{ __html: s }} />)}</ul></div>}
    </div>
  );
}

export default function Gnc() {
  return (
    <div className="page narrow" style={{ maxWidth: 1000 }}>
      <div className="eyebrow">GNC</div>
      <h1>GNC 5ª generación — Logan 2008</h1>
      <p className="muted">Caso real: cómo funciona, cómo se cablea, cómo se lee y qué falla en un equipo de inyección secuencial de gas.</p>
      <div className="legacy"><GncContent /></div>
    </div>
  );
}
