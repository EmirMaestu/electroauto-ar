/* Piezas del banco "Motor + scanner": lista de PIDs, testigos del tablero, códigos y prueba de balance. */
import type { ReactNode } from "react";
import { fmt } from "../ui/anim-kit";
import {
  BALANCE_BASE_S, BALANCE_CUT_S, DTC_INFO, LOOP_LABEL, PIDS, dtcList, milOn,
  type EngineInputs, type EngineState, type PidDef, type PidId, type PidValues,
} from "./engineModel";
import { TREND_COLORS } from "./TrendChart";

type Tone = "ok" | "warn" | "bad" | undefined;

const GROUPS: { id: PidDef["group"]; label: string }[] = [
  { id: "motor", label: "Motor" },
  { id: "aire", label: "Aire y carga" },
  { id: "mezcla", label: "Mezcla e inyección" },
  { id: "encendido", label: "Encendido y catalizador" },
  { id: "electrico", label: "Eléctrico" },
  { id: "fallos", label: "Fallos de encendido (desde el último borrado)" },
];

/** Colorea valores fuera de lo típico (ayuda para aprender: un scanner real no lo hace). */
export function toneOf(id: PidId, v: number, s: EngineState, inp: EngineInputs): Tone {
  const running = s.phase === "run";
  const idle = running && inp.situation === "neutral" && inp.pedal < 1 && s.rpmF < 1300 && s.ectTrue > 70 && s.tRun > 20;
  switch (id) {
    case "stft": case "ltft": return !running ? undefined : Math.abs(v) > 20 ? "bad" : Math.abs(v) > 10 ? "warn" : "ok";
    case "ect": return v < -30 || v > 108 ? "bad" : running && s.tRun > 120 && v < 75 ? "warn" : undefined;
    case "ectV": return v > 4.8 || v < 0.15 ? "bad" : undefined;
    case "batt": return running ? (v < 12.6 || v > 14.9 ? "bad" : v < 13.6 ? "warn" : "ok") : v < 12.2 ? "warn" : undefined;
    case "fuelP": return running ? (v < 2.5 ? "bad" : v < 3.0 ? "warn" : "ok") : undefined;
    case "catT": return v > 900 ? "bad" : v > 830 ? "warn" : undefined;
    case "mis1": case "mis2": case "mis3": case "mis4": return v > 40 ? "bad" : v > 0 ? "warn" : undefined;
    case "map": return idle && v > 40 ? "warn" : undefined;
    case "maf": return idle && (v < 2.0 || v > 4.2) ? "warn" : undefined;
    case "rpm": return idle && s.tRun > 60 && v > 1000 && s.ectTrue > 80 ? "warn" : undefined;
    case "inj": return idle && v > 4.3 ? "warn" : undefined;
    case "load": return running && inp.pedal > 80 && v < 0.82 * 90 * (inp.baro / 101.3) ? "warn" : undefined;
    case "o2": return undefined;
    default: return undefined;
  }
}

function Row(props: { label: ReactNode; value: ReactNode; unit?: string; tone?: Tone; color?: string; onClick?: () => void; ext?: string; title?: string }) {
  const col = props.tone === "bad" ? "var(--bad)" : props.tone === "warn" ? "var(--warn)" : props.tone === "ok" ? "var(--ok)" : "var(--text)";
  return (
    <div
      onClick={props.onClick}
      title={props.title}
      role={props.onClick ? "button" : undefined}
      style={{
        display: "grid", gridTemplateColumns: "14px 1fr auto", gap: ".5rem", alignItems: "center",
        padding: ".26rem .55rem", borderRadius: 7, cursor: props.onClick ? "pointer" : "default",
        background: props.color ? "color-mix(in srgb, " + props.color + " 12%, transparent)" : undefined,
      }}
    >
      <span style={{ width: 11, height: 11, borderRadius: 3, border: `1.5px solid ${props.color ?? "var(--border-strong)"}`, background: props.color ?? "transparent" }} />
      <span style={{ fontSize: ".86rem", color: "var(--text-2)", lineHeight: 1.25 }}>
        {props.label}
        {props.ext && <span className="faint" style={{ fontSize: ".72rem" }}> ({props.ext})</span>}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: ".92rem", color: col, whiteSpace: "nowrap", textAlign: "right" }}>
        {props.value}
        {props.unit && <span style={{ fontWeight: 500, fontSize: ".74rem", color: "var(--muted)", marginLeft: 3 }}>{props.unit}</span>}
      </span>
    </div>
  );
}

export function PidList(props: {
  p: PidValues; s: EngineState; inp: EngineInputs; graph: PidId[]; onToggle: (id: PidId) => void; tones: boolean;
}) {
  const { p, s, inp, graph } = props;
  const onDyno = inp.situation === "dyno";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {GROUPS.map((g) => {
        const rows = PIDS.filter((d) => d.group === g.id && (onDyno || !["vss", "torque", "power"].includes(d.id)));
        return (
          <div key={g.id} style={{ marginBottom: ".35rem" }}>
            <div style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 700, color: "var(--faint)", padding: ".35rem .55rem .15rem" }}>{g.label}</div>
            {g.id === "mezcla" && <Row label="Estado de combustible" value={<span style={{ fontFamily: "var(--font-body)", fontSize: ".82rem" }}>{LOOP_LABEL[s.loop]}</span>} />}
            {g.id === "motor" && <Row label="Electroventilador" value={s.fan ? "ON" : "OFF"} tone={props.tones && s.fan && s.ectTrue < 90 ? "warn" : undefined} />}
            {rows.map((d) => {
              const gi = graph.indexOf(d.id);
              return (
                <Row
                  key={d.id}
                  label={d.label}
                  ext={d.ext}
                  value={fmt(p[d.id], d.dec)}
                  unit={d.unit}
                  tone={props.tones ? toneOf(d.id, p[d.id], s, inp) : undefined}
                  color={gi >= 0 ? TREND_COLORS[gi] : undefined}
                  onClick={() => props.onToggle(d.id)}
                  title={gi >= 0 ? "Sacar del gráfico" : "Agregar al gráfico"}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------- testigos */
function EngineIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 34 24" width={30} height={22} aria-hidden>
      <path d="M9 5h9v2.5h-3V9h6l3 3h3V9h3v11h-3v-3h-2.5l-3.5 4H11l-3-3H6v3H3v-9h3v2h2V9h3V7.5H9z" fill={color} />
    </svg>
  );
}
function BatteryIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 30 24" width={26} height={22} aria-hidden>
      <rect x={3} y={7} width={24} height={14} rx={2} fill="none" stroke={color} strokeWidth={2.4} />
      <rect x={7} y={3.5} width={4} height={3.5} fill={color} /><rect x={19} y={3.5} width={4} height={3.5} fill={color} />
      <path d="M8 14h5M19 14h5M21.5 11.5v5" stroke={color} strokeWidth={2} />
    </svg>
  );
}
function TempIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 26 24" width={22} height={22} aria-hidden>
      <path d="M13 3v11" stroke={color} strokeWidth={3} strokeLinecap="round" />
      <circle cx={13} cy={17} r={4} fill={color} />
      <path d="M15 6h4M15 9.5h4M15 13h3" stroke={color} strokeWidth={1.8} />
      <path d="M3 22c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" fill="none" stroke={color} strokeWidth={1.6} />
    </svg>
  );
}

export function DashLamps(props: { s: EngineState; p: PidValues; blinkOn: boolean }) {
  const { s, p } = props;
  const keyOn = true;
  const mil = milOn(s) || (s.phase === "off" && keyOn);
  const milColor = mil && (!s.milBlink || props.blinkOn) ? "#f5a300" : "var(--border-strong)";
  const batt = s.phase === "off" || (s.phase === "run" && p.batt < 13.0);
  const hot = p.ect > 108;
  const cold = s.phase === "run" && p.ect < 50;
  const lamp = (on: boolean, el: ReactNode, label: string) => (
    <div title={label} style={{ display: "grid", placeItems: "center", width: 42, height: 34, borderRadius: 8, background: on ? "rgba(0,0,0,.82)" : "var(--surface-2)", border: "1px solid var(--border)" }}>
      {el}
    </div>
  );
  return (
    <div className="row" style={{ gap: ".4rem" }}>
      {lamp(mil, <EngineIcon color={milColor} />, s.milBlink ? "Check titilando: fallos que dañan el catalizador" : "Luz de check (MIL)")}
      {lamp(batt, <BatteryIcon color={batt ? "#ff3b30" : "var(--border-strong)"} />, "Luz de carga de batería")}
      {lamp(hot || cold, <TempIcon color={hot ? "#ff3b30" : cold ? "#4aa3ff" : "var(--border-strong)"} />, "Temperatura del motor")}
      <span className="pill" style={{ marginLeft: ".25rem" }}>{s.phase === "off" ? (s.stalled ? "Se paró" : "Motor parado") : s.phase === "crank" ? "Arrancando…" : LOOP_LABEL[s.loop]}</span>
    </div>
  );
}

/* --------------------------------------------------------- códigos */
export function DtcPanel(props: { s: EngineState; onClear: () => void }) {
  const list = dtcList(props.s);
  const ff = props.s.freeze;
  return (
    <div>
      {list.length === 0 ? (
        <p className="muted" style={{ margin: ".2rem 0 .6rem", fontSize: ".92rem" }}>Sin códigos guardados.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: ".45rem", marginBottom: ".7rem" }}>
          {list.map((d) => (
            <div key={d.code} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: ".1rem .7rem", alignItems: "baseline" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "1.05rem", color: d.state === "confirmado" ? "var(--bad)" : "var(--warn)" }}>{d.code}</span>
              <span style={{ fontSize: ".9rem", color: "var(--text-2)" }}>
                {DTC_INFO[d.code]?.desc ?? "Código"}{" "}
                <span className={`pill ${d.state === "confirmado" ? "" : "soon"}`} style={{ marginLeft: ".2rem" }}>{d.state}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      {ff && (
        <div style={{ border: "1px dashed var(--border-strong)", borderRadius: 10, padding: ".55rem .7rem", marginBottom: ".7rem" }}>
          <div style={{ fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700, color: "var(--faint)" }}>
            Cuadro congelado ({ff.code}): cómo estaba el motor cuando se guardó
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".2rem 1rem", fontFamily: "var(--font-mono)", fontSize: ".82rem", marginTop: ".3rem" }}>
            <span>{fmt(ff.rpm, 0)} rpm</span>
            <span>ECT {fmt(ff.ect, 0)} °C</span>
            <span>carga {fmt(ff.load, 0)} %</span>
            <span>MAP {fmt(ff.map, 0)} kPa</span>
            <span>STFT {fmt(ff.stft, 1)} %</span>
            <span>LTFT {fmt(ff.ltft, 1)} %</span>
            {ff.vss > 0 && <span>{fmt(ff.vss, 0)} km/h</span>}
            <span style={{ fontFamily: "var(--font-body)" }}>{LOOP_LABEL[ff.loop as keyof typeof LOOP_LABEL] ?? ff.loop}</span>
          </div>
        </div>
      )}
      <div className="row" style={{ gap: ".5rem" }}>
        <button className="btn ghost sm" onClick={props.onClear}>🧹 Borrar códigos</button>
        <span className="faint" style={{ fontSize: ".8rem" }}>Borra también las correcciones aprendidas (LTFT) y los contadores.</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------- balance de cilindros */
export function BalancePanel(props: { s: EngineState; onStart: () => void; msg: string | null }) {
  const b = props.s.balance;
  const running = !!b && !b.done;
  const drops = b?.drops ?? [];
  const maxDrop = Math.max(220, ...drops.filter((x) => Number.isFinite(x)));
  const done = !!b?.done;
  const avg = done ? drops.reduce((a, x) => a + x, 0) / 4 : 0;
  const per = BALANCE_BASE_S + BALANCE_CUT_S;
  const prog = b ? Math.min(1, (b.cyl * per + (b.stage === "cut" ? BALANCE_BASE_S : 0) + b.t) / (4 * per)) : 0;
  return (
    <div>
      <p className="muted" style={{ fontSize: ".9rem", marginTop: 0 }}>
        La ECU corta la inyección de un cilindro por vez (con el ralentí “congelado”) y mira cuánto caen las vueltas. Un cilindro sano,
        al cortarlo, hace caer bastante las rpm; uno que <b>no trabaja</b> casi no cambia nada: ya estaba “muerto”.
      </p>
      <div className="row" style={{ gap: ".6rem", marginBottom: ".7rem" }}>
        <button className="btn accent sm" onClick={props.onStart} disabled={running}>{running ? "Probando…" : done ? "Repetir la prueba" : "Hacer prueba de balance"}</button>
        {running && b && <span className="faint" style={{ fontSize: ".85rem" }}>Cilindro {b.cyl + 1}: {b.stage === "cut" ? "inyección cortada" : "midiendo base"}</span>}
        {props.msg && <span style={{ color: "var(--warn)", fontSize: ".86rem" }}>{props.msg}</span>}
      </div>
      {running && <div className="progress" style={{ marginBottom: ".8rem" }}><span style={{ width: `${prog * 100}%` }} /></div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: ".6rem", alignItems: "end", height: 150 }}>
        {[0, 1, 2, 3].map((c) => {
          const d = drops[c];
          const has = Number.isFinite(d);
          const weak = done && has && d < avg * 0.6;
          const h = has ? Math.max(4, (d / maxDrop) * 110) : 4;
          return (
            <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: ".82rem", fontWeight: 700, color: weak ? "var(--bad)" : "var(--text)" }}>{has ? (d < 5 ? "≈ 0" : `−${fmt(d, 0)}`) : "—"}</span>
              <div style={{ width: "70%", height: h, borderRadius: "6px 6px 2px 2px", background: weak ? "var(--bad)" : has ? "var(--ok)" : "var(--surface-3)", transition: "height .3s" }} />
              <span style={{ fontSize: ".8rem", color: "var(--muted)" }}>cil. {c + 1}</span>
            </div>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: ".8rem", marginBottom: 0 }}>Caída de rpm al cortar cada cilindro. En un motor parejo, todas parecidas (dentro de ≈ 30 %).</p>
    </div>
  );
}
