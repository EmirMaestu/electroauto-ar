/* Piezas de interfaz de las calculadoras: campo numérico "a la argentina", tarjeta, resultado y fórmula. */
import { useEffect, useId, useState, type ReactNode } from "react";
import { fmt } from "../ui/anim-kit";
import { parseNum } from "./hooks";

const toTxt = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 1e6) / 1e6).replace(".", ",") : "");

export function NumField(props: {
  label: string; value: number; onChange: (v: number) => void; unit?: string; hint?: string; min?: number; wide?: boolean;
}) {
  const id = useId();
  const [txt, setTxt] = useState(toTxt(props.value));
  useEffect(() => {
    const cur = parseNum(txt);
    if (!(cur === props.value || (Number.isNaN(cur) && Number.isNaN(props.value)))) setTxt(toTxt(props.value));
  }, [props.value]);
  const parsed = parseNum(txt);
  const bad = txt.trim() !== "" && (Number.isNaN(parsed) || (props.min !== undefined && parsed < props.min));
  return (
    <label htmlFor={id} style={{ display: "flex", flexDirection: "column", gap: ".2rem", gridColumn: props.wide ? "1 / -1" : undefined, minWidth: 0 }}>
      <span style={{ fontSize: ".78rem", color: "var(--muted)", fontWeight: 600 }}>{props.label}</span>
      <span style={{ display: "flex", alignItems: "center", gap: ".35rem" }}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={txt}
          onChange={(e) => {
            setTxt(e.target.value);
            const v = parseNum(e.target.value);
            props.onChange(v);
          }}
          style={{ width: "100%", minWidth: 0, fontFamily: "var(--font-mono)", fontWeight: 600, borderColor: bad ? "var(--bad)" : undefined }}
        />
        {props.unit && <span className="faint" style={{ fontSize: ".8rem", whiteSpace: "nowrap" }}>{props.unit}</span>}
      </span>
      {props.hint && <span className="faint" style={{ fontSize: ".72rem" }}>{props.hint}</span>}
    </label>
  );
}

export function Fields(props: { children: ReactNode; min?: number }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${props.min ?? 120}px, 1fr))`, gap: ".6rem .8rem" }}>
      {props.children}
    </div>
  );
}

export function Results(props: { children: ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: ".5rem", margin: ".9rem 0 .2rem" }}>
      {props.children}
    </div>
  );
}

/** Formatea un resultado: guion si no es un número válido. */
export const out = (v: number, d = 1) => (Number.isFinite(v) ? fmt(v, d) : "—");

export function CalcCard(props: {
  id: string; icon: string; title: string; intro?: ReactNode; children: ReactNode;
  formula: ReactNode; vars?: [string, string][]; ejemplo: ReactNode; onEjemplo?: () => void;
}) {
  return (
    <section id={props.id} className="card" style={{ display: "flex", flexDirection: "column", gap: ".2rem", scrollMarginTop: "80px" }}>
      <h3 style={{ display: "flex", gap: ".5rem", alignItems: "center", margin: "0 0 .3rem" }}>
        <span style={{ fontSize: "1.35rem" }}>{props.icon}</span>{props.title}
      </h3>
      {props.intro && <p className="muted" style={{ fontSize: ".88rem", margin: "0 0 .6rem" }}>{props.intro}</p>}
      {props.children}
      <div className="formula" style={{ margin: ".8rem 0 .4rem" }}>
        <div className="formula-name">Fórmula</div>
        <div className="formula-main" style={{ fontSize: ".98rem", padding: ".7rem .8rem", lineHeight: 1.6 }}>{props.formula}</div>
        {props.vars && (
          <dl className="formula-vars" style={{ margin: 0 }}>
            {props.vars.map(([k, v]) => <div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        )}
      </div>
      <div style={{ fontSize: ".86rem", color: "var(--text-2)", background: "var(--surface-2)", borderRadius: 10, padding: ".55rem .75rem" }}>
        <b>Ejemplo:</b> {props.ejemplo}
        {props.onEjemplo && (
          <button className="btn ghost sm" style={{ marginLeft: ".5rem", height: 26, fontSize: ".78rem" }} onClick={props.onEjemplo}>Cargar ejemplo</button>
        )}
      </div>
    </section>
  );
}
