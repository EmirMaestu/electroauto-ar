/* ==========================================================================
   Bloques para escribir lecciones en MDX. Están disponibles en TODAS las
   lecciones sin importarlos. Ver docs/AUTORIA.md para ejemplos.
   ========================================================================== */
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { TOOLS } from "../../content/tools";
import { GLOSSARY } from "../../content/glossary";

/* ------------------------------------------------------------ Callout */
const CALLOUTS = {
  dato: { ic: "💡", lbl: "Dato" },
  tip: { ic: "✅", lbl: "Tip" },
  warn: { ic: "⚠️", lbl: "Ojo" },
  peligro: { ic: "⛔", lbl: "Peligro" },
  taller: { ic: "🔧", lbl: "En el taller" },
  electronica: { ic: "🧠", lbl: "Qué pasa electrónicamente" },
  mendoza: { ic: "🏔️", lbl: "En Mendoza" },
  analogia: { ic: "🗣️", lbl: "Para entenderlo" },
} as const;
export type CalloutType = keyof typeof CALLOUTS;

export function Callout({ type = "dato", title, children }: { type?: CalloutType; title?: ReactNode; children: ReactNode }) {
  const c = CALLOUTS[type] ?? CALLOUTS.dato;
  return (
    <aside className={`callout ${type}`}>
      <div className="callout-head">
        <span className="ic">{c.ic}</span>
        <span className="lbl">{c.lbl}</span>
        {title && <span style={{ fontWeight: 650 }}>· {title}</span>}
      </div>
      <div className="callout-body">{children}</div>
    </aside>
  );
}
export const Dato = (p: { title?: ReactNode; children: ReactNode }) => <Callout type="dato" {...p} />;
export const Tip = (p: { title?: ReactNode; children: ReactNode }) => <Callout type="tip" {...p} />;
export const Ojo = (p: { title?: ReactNode; children: ReactNode }) => <Callout type="warn" {...p} />;
export const Peligro = (p: { title?: ReactNode; children: ReactNode }) => <Callout type="peligro" {...p} />;
export const EnElTaller = (p: { title?: ReactNode; children: ReactNode }) => <Callout type="taller" {...p} />;
export const Electronica = (p: { title?: ReactNode; children: ReactNode }) => <Callout type="electronica" {...p} />;
export const Mendoza = (p: { title?: ReactNode; children: ReactNode }) => <Callout type="mendoza" {...p} />;
export const Analogia = (p: { title?: ReactNode; children: ReactNode }) => <Callout type="analogia" {...p} />;

/* ------------------------------------------------------------ Formula */
/** <Formula name="Cilindrada" vars={{ "Vh": "volumen de un cilindro [cm³]", ... }}>Vh = π/4 · d² · s</Formula> */
export function Formula({ name, vars, children }: { name?: string; vars?: Record<string, ReactNode>; children: ReactNode }) {
  return (
    <div className="formula">
      {name && <div className="formula-name">{name}</div>}
      <div className="formula-main">{children}</div>
      {vars && (
        <dl className="formula-vars">
          {Object.entries(vars).map(([k, v]) => (
            <FragmentPair key={k} k={k} v={v} />
          ))}
        </dl>
      )}
    </div>
  );
}
function FragmentPair({ k, v }: { k: string; v: ReactNode }) {
  return (<><dt>{k}</dt><dd>{v}</dd></>);
}

/* ------------------------------------------------------------ Ejemplo */
/** Ejemplo resuelto. Usá <Calc> para las cuentas y <Res> para el resultado. */
export function Ejemplo({ title = "Ejemplo resuelto", children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="ejemplo">
      <div className="ejemplo-head">🧮 {title}</div>
      <div className="ejemplo-body">{children}</div>
    </div>
  );
}
export const Calc = ({ children }: { children: ReactNode }) => <div className="calc">{children}</div>;
export const Res = ({ children }: { children: ReactNode }) => <span className="result">{children}</span>;

/* ---------------------------------------------------------- KeyPoints */
export function PuntosClave({ children, title = "Puntos clave" }: { children: ReactNode; title?: string }) {
  return (
    <div className="keypoints">
      <div className="kp-title">🔑 {title}</div>
      {children}
    </div>
  );
}

/* ---------------------------------------------------------- Mediciones */
export function Mediciones({ title = "Qué medir y qué tenés que ver", children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <div className="mediciones">
      <div className="mediciones-head">📐 {title}</div>
      {children}
    </div>
  );
}
/** Una fila: punto de medición, valor esperado, cómo medirlo y nota/interpretación. */
export function Medicion({ punto, esperado, como, nota }: { punto: ReactNode; esperado: ReactNode; como?: ReactNode; nota?: ReactNode }) {
  return (
    <div className="medicion">
      <div className="punto">{punto}</div>
      <div className="esperado">{esperado}</div>
      {como && <div className="como">🔌 {como}</div>}
      {nota && <div className="nota">{nota}</div>}
    </div>
  );
}

/* -------------------------------------------------------------- Pasos */
/** Procedimiento paso a paso. Cada <li> es un paso; si arranca con **negrita** queda como título del paso. */
export function Pasos({ children }: { children: ReactNode }) {
  return <div className="pasos-host">{children}</div>;
}

/* -------------------------------------------------------- Herramientas */
export function Herramientas({ ids, title = "Herramientas que vas a usar" }: { ids: string[]; title?: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginTop: "1.2rem" }}>🧰 {title}</div>
      <div className="tools-row">
        {ids.map((id) => {
          const t = TOOLS.find((x) => x.id === id);
          if (!t) return <span key={id} className="tool-chip">{id}</span>;
          return (
            <Link key={id} to={`/herramientas#${t.id}`} className="tool-chip" title={t.uso}>
              <span>{t.icon}</span>{t.nombre}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Compare */
export function Comparar({ children }: { children: ReactNode }) {
  return <div className="compare">{children}</div>;
}
export function Lado({ title, children, color }: { title: ReactNode; children: ReactNode; color?: string }) {
  return (
    <div style={color ? { borderTop: `3px solid ${color}` } : undefined}>
      <h4>{title}</h4>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ BookRef */
export function Libro({ pag, children }: { pag: string; children?: ReactNode }) {
  return <span className="bookref">📘 Bosch Automotive Handbook, {pag}{children ? <> · {children}</> : null}</span>;
}

/* --------------------------------------------------------------- Term */
/** Palabra técnica con definición al pasar el mouse. <Term t="PMS">punto muerto superior</Term> */
export function Term({ t, children }: { t: string; children?: ReactNode }) {
  const g = GLOSSARY.find((x) => x.term.toLowerCase() === t.toLowerCase() || x.alias?.some((a) => a.toLowerCase() === t.toLowerCase()));
  const [open, setOpen] = useState(false);
  return (
    <span
      className="term"
      title={g ? `${g.term}: ${g.def}` : undefined}
      onClick={() => setOpen((o) => !o)}
      style={{ position: "relative" }}
    >
      {children ?? t}
      {open && g && (
        <span role="tooltip" style={{ position: "absolute", left: 0, top: "1.6em", zIndex: 20, width: 280, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: ".6rem .75rem", boxShadow: "var(--shadow-lg)", fontSize: ".85rem", color: "var(--text-2)", fontStyle: "normal" }}>
          <b style={{ color: "var(--text)" }}>{g.term}</b> — {g.def}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------- Figura */
export function Figura({ caption, children }: { caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className="anim" style={{ boxShadow: "none" }}>
      <div className="anim-stage">{children}</div>
      {caption && <figcaption className="anim-caption">{caption}</figcaption>}
    </figure>
  );
}
