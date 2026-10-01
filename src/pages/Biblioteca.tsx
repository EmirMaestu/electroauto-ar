import { useState } from "react";
import lib from "../content/legacy/library.json";

const TABS = ["Valores de sensores", "Fórmulas", "Fusibles y relés", "Procedimientos", "Guías rápidas"];

export default function Biblioteca() {
  const [tab, setTab] = useState(0);
  const L = lib as any;
  return (
    <div className="page narrow" style={{ maxWidth: 980 }}>
      <div className="eyebrow">Biblioteca técnica</div>
      <h1>Referencia rápida</h1>
      <p className="muted">Valores típicos y guías para tener a mano. Siempre confirmá con el dato del fabricante del modelo.</p>
      <div className="chip-row">{TABS.map((t, i) => <span key={t} className={`chip ${i === tab ? "on" : ""}`} onClick={() => setTab(i)}>{t}</span>)}</div>
      {tab === 0 && (
        <div className="table-wrap"><table className="tbl"><thead><tr><th>Sensor</th><th>En frío</th><th>Caliente</th><th>Señal</th></tr></thead>
          <tbody>{L.sensores.map((s: any) => <tr key={s.nombre}><td><b>{s.nombre}</b><br /><small className="muted">{s.nota}</small></td><td className="mono">{s.frio}</td><td className="mono">{s.caliente}</td><td className="mono">{s.senal}</td></tr>)}</tbody></table></div>
      )}
      {tab === 1 && (
        <div className="grid cols-2">{L.formulas.map((f: any) => (
          <div key={f.nombre} className="formula" style={{ margin: 0 }}>
            <div className="formula-name">{f.nombre}</div>
            <div className="formula-main">{f.f}</div>
            <div style={{ padding: ".6rem 1rem", fontSize: ".88rem", color: "var(--muted)", borderTop: "1px dashed var(--border)" }}>{f.desc}</div>
          </div>
        ))}</div>
      )}
      {tab === 2 && (
        <div className="grid cols-2">
          <div><h3>Color → amperaje (fusible de uña)</h3><table className="tbl"><thead><tr><th>Color</th><th>Amperaje</th></tr></thead><tbody>{L.fusibles.colores.map((c: any) => <tr key={c.color}><td>{c.color}</td><td className="mono">{c.amp}</td></tr>)}</tbody></table></div>
          <div><h3>Siglas de la fusiblera</h3><table className="tbl"><thead><tr><th>Sigla</th><th>Significado</th></tr></thead><tbody>{L.fusibles.abreviaturas.map((a: any) => <tr key={a.sigla}><td><b>{a.sigla}</b></td><td>{a.sig}</td></tr>)}</tbody></table></div>
        </div>
      )}
      {tab === 3 && (
        <div className="stack">{L.procedimientos.map((p: any) => (
          <div key={p.nombre} className="card"><h3>{p.nombre}</h3><div className="pasos-host"><ol>{p.pasos.map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></div></div>
        ))}</div>
      )}
      {tab === 4 && <div className="grid cols-2">{L.guias.map((g: any) => <div key={g.t} className="card"><h3>{g.t}</h3><p className="mb-0">{g.c}</p></div>)}</div>}
    </div>
  );
}
