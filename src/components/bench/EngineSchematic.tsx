/* Esquema del motor visto desde arriba, con sensores (violeta) y actuadores (naranja) en vivo.
   Admisión arriba, escape abajo, refrigeración a la izquierda, ECU abajo a la izquierda. */
import { fmt, TAU, clamp } from "../ui/anim-kit";
import type { EngineState, FaultId, PidValues } from "./engineModel";
import { LOOP_LABEL } from "./engineModel";

const CX = [290, 380, 470, 560];
const CY = 159;
const METAL = "color-mix(in srgb, var(--c-metal-light) 70%, var(--surface))";

function Chip(props: { x: number; y: number; text: string; kind: "sensor" | "actuador" | "info"; anchor?: "start" | "middle" | "end"; bad?: boolean }) {
  const w = props.text.length * 6.7 + 12;
  const a = props.anchor ?? "middle";
  const x0 = a === "middle" ? props.x - w / 2 : a === "end" ? props.x - w : props.x;
  const col = props.bad ? "var(--bad)" : props.kind === "sensor" ? "var(--violet)" : props.kind === "actuador" ? "var(--accent)" : "var(--muted)";
  return (
    <g>
      <rect x={x0} y={props.y - 10} width={w} height={19} rx={9.5} fill="var(--surface)" stroke={col} strokeWidth={1.3} />
      <text x={x0 + w / 2} y={props.y + 3.6} textAnchor="middle" style={{ fontSize: 11, fontFamily: "var(--font-mono)", fontWeight: 600, fill: col }}>
        {props.text}
      </text>
    </g>
  );
}

function FaultRing(props: { x: number; y: number; w: number; h: number; label?: string; lx?: number; ly?: number }) {
  return (
    <g>
      <rect x={props.x} y={props.y} width={props.w} height={props.h} rx={8} fill="none" stroke="var(--bad)" strokeWidth={2.2} strokeDasharray="5 3" />
      {props.label && (
        <text x={props.lx ?? props.x + props.w / 2} y={props.ly ?? props.y - 5} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--bad)" }}>
          {props.label}
        </text>
      )}
    </g>
  );
}

export function EngineSchematic(props: { s: EngineState; p: PidValues; fault: FaultId; showFault: boolean }) {
  const { s, p } = props;
  const f = props.showFault ? props.fault : "none";
  const t = s.t;
  const running = s.phase !== "off";
  const thr = clamp(s.throttle, 0, 100);
  const plate = (90 * (1 - thr / 100)) * (Math.PI / 180);
  const crankA = ((s.evIdx * 180 + s.crankDeg) % 360) * (Math.PI / 180);
  const fanA = s.fan ? (t * 14) % TAU : 0.4;
  const airSpeed = Math.min(1.6, 0.12 + p.maf / 25);
  const lamExh = 1 / Math.max(0.05, s.exhInv);
  const exhCol = !running ? "var(--c-metal-2)" : lamExh > 1.15 ? "var(--c-air)" : lamExh < 0.93 ? "var(--c-belt)" : "var(--c-exhaust)";
  const catHot = clamp((p.catT - 350) / 600, 0, 1);
  const o2Rich = p.o2 > 0.45;
  const charging = running && p.batt > 13.2;

  return (
    <svg viewBox="0 0 720 326" role="img" aria-label="Esquema del motor con sensores y actuadores">
      {/* ---------------- admisión */}
      <text x={18} y={20} className="svg-small">aire →</text>
      <rect x={14} y={30} width={70} height={44} rx={8} fill="var(--surface-2)" stroke="var(--border-strong)" />
      {[0, 1, 2, 3, 4, 5].map((i) => <line key={i} x1={22 + i * 11} y1={36} x2={22 + i * 11} y2={68} stroke="var(--border-strong)" strokeWidth={1} />)}
      <text x={49} y={88} textAnchor="middle" className="svg-small">filtro</text>
      <rect x={84} y={44} width={36} height={16} fill={METAL} stroke="var(--c-metal-2)" />
      <rect x={120} y={38} width={40} height={28} rx={5} fill={f === "maf" ? "color-mix(in srgb, var(--c-oil) 55%, var(--c-metal-light))" : "var(--c-metal-light)"} stroke="var(--violet)" strokeWidth={1.6} />
      <line x1={128} y1={52} x2={152} y2={52} stroke={f === "maf" ? "var(--c-oil)" : "var(--c-hot)"} strokeWidth={2} />
      <Chip x={128} y={16} text={`MAF ${fmt(p.maf, 1)} g/s`} kind="sensor" bad={f === "maf"} />
      <rect x={160} y={44} width={36} height={16} fill={METAL} stroke="var(--c-metal-2)" />
      <circle cx={214} cy={52} r={19} fill="var(--c-metal-light)" stroke="var(--violet)" strokeWidth={1.6} />
      <line x1={214 - 15 * Math.cos(plate)} y1={52 - 15 * Math.sin(plate)} x2={214 + 15 * Math.cos(plate)} y2={52 + 15 * Math.sin(plate)} stroke="var(--c-metal-dark)" strokeWidth={4} strokeLinecap="round" />
      <Chip x={224} y={16} text={`TPS ${fmt(thr, 0)}%`} kind="actuador" />
      {/* múltiple */}
      <rect x={234} y={30} width={406} height={44} rx={12} fill={METAL} stroke="var(--c-metal-2)" />
      <rect x={300} y={17} width={16} height={13} rx={2} fill="var(--violet)" />
      <Chip x={322} y={12} text={`MAP ${fmt(p.map, 0)} kPa`} kind="sensor" anchor="start" />
      {/* flujo de aire */}
      {running && Array.from({ length: 10 }, (_, i) => {
        const u = (t * airSpeed * 0.6 + i / 10) % 1;
        const x = 6 + u * 620;
        return <circle key={i} cx={x} cy={52 + Math.sin(i * 2.1) * 6} r={3} fill="var(--c-air)" opacity={0.75} />;
      })}
      {f === "vacio" && (
        <g>
          <path d="M392,30 l6,-6 l4,5 l6,-7" fill="none" stroke="var(--bad)" strokeWidth={2.2} />
          {[0, 1, 2].map((i) => {
            const u = (t * 2 + i / 3) % 1;
            return <circle key={i} cx={402} cy={10 + u * 18} r={2.5} fill="var(--c-air)" />;
          })}
          <text x={414} y={20} style={{ fontSize: 11, fontWeight: 700, fill: "var(--bad)" }}>aire falso</text>
        </g>
      )}
      {/* conductos + inyectores */}
      {CX.map((x, i) => {
        const since = t - s.lastFire[i];
        const inj = running && !s.cut[i] && s.injMs > 0 && since >= 0 && since < Math.max(0.05, s.injMs / 1000 + 0.02);
        return (
          <g key={i}>
            <rect x={x - 12} y={74} width={24} height={40} fill={METAL} stroke="var(--c-metal-2)" />
            <g transform={`rotate(-28 ${x + 15} 96)`}>
              <rect x={x + 10} y={84} width={10} height={22} rx={3} fill={inj ? "var(--c-fuel)" : "var(--c-metal-2)"} stroke="var(--accent)" strokeWidth={1.2} />
            </g>
            {inj && <path d={`M${x + 8},${104} l-9,9 l7,2 z`} fill="var(--c-fuel)" opacity={0.85} />}
            {f === "inyector3" && i === 2 && <FaultRing x={x - 2} y={78} w={34} h={34} label="tapado" lx={x + 46} ly={92} />}
          </g>
        );
      })}
      <line x1={296} y1={84} x2={594} y2={84} stroke="var(--c-fuel)" strokeWidth={4} opacity={0.6} />
      <circle cx={604} cy={86} r={10} fill="var(--surface)" stroke={f === "nafta" ? "var(--bad)" : "var(--c-fuel)"} strokeWidth={2} />
      <line x1={604} y1={86} x2={604 + 7 * Math.cos(Math.PI * (1.15 - (p.fuelP / 5) * 0.9))} y2={86 - 7 * Math.sin(Math.PI * (1.15 - (p.fuelP / 5) * 0.9))} stroke="var(--text)" strokeWidth={1.6} />
      <Chip x={618} y={96} text={`nafta ${fmt(p.fuelP, 1)} bar`} kind="info" anchor="start" bad={f === "nafta"} />
      <Chip x={276} y={100} text={`iny. ${fmt(p.inj, 1)} ms`} kind="actuador" anchor="end" />

      {/* ---------------- tapa / bloque (vista de arriba) */}
      <rect x={240} y={114} width={370} height={92} rx={14} fill="var(--c-block)" stroke="var(--c-metal-2)" />
      {CX.map((x, i) => {
        const since = t - s.lastFire[i];
        const fired = running && since >= 0 && since < 0.08 && !s.cut[i] && t - s.lastMis[i] > 0.08;
        const mis = t - s.lastMis[i] < 0.5;
        const cut = running && s.cut[i] && s.balance !== null;
        return (
          <g key={i}>
            <circle cx={x} cy={CY} r={36} fill="var(--surface)" stroke={mis ? "var(--bad)" : "var(--c-metal-2)"} strokeWidth={mis ? 4 : 1.5} strokeDasharray={cut ? "5 4" : undefined} />
            {fired && <circle cx={x} cy={CY} r={33} fill="var(--c-flame)" opacity={0.55 * (1 - since / 0.08)} />}
            <rect x={x - 11} y={CY - 16} width={22} height={32} rx={6} fill="var(--c-belt)" stroke={f === "bobina2" && i === 1 ? "var(--bad)" : "var(--accent)"} strokeWidth={f === "bobina2" && i === 1 ? 2.5 : 1.2} />
            {fired && <path d={`M${x},${CY - 9} l3,7 l-5,0 l4,9`} fill="none" stroke="var(--c-spark)" strokeWidth={2.2} />}
            <text x={x - 30} y={CY - 22} style={{ fontSize: 12, fontWeight: 700, fill: "var(--text-2)" }}>{i + 1}</text>
            {mis && <text x={x + 18} y={CY - 20} style={{ fontSize: 14, fontWeight: 800, fill: "var(--bad)" }}>✕</text>}
            {cut && <text x={x} y={CY + 30} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "var(--muted)" }}>corte</text>}
          </g>
        );
      })}
      {f === "bobina2" && <text x={380} y={CY + 50} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--bad)" }}>bobina con fuga</text>}
      <Chip x={425} y={226} text={`avance ${fmt(p.adv, 0)}°`} kind="actuador" />

      {/* rueda fónica + CKP */}
      <circle cx={628} cy={CY} r={20} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" />
      {Array.from({ length: 18 }, (_, k) => {
        if (k === 0) return null; // hueco de referencia
        const a = crankA + (k / 18) * TAU;
        return <line key={k} x1={628 + 17 * Math.cos(a)} y1={CY + 17 * Math.sin(a)} x2={628 + 22 * Math.cos(a)} y2={CY + 22 * Math.sin(a)} stroke="var(--c-metal-dark)" strokeWidth={2.5} />;
      })}
      <rect x={652} y={CY - 7} width={16} height={14} rx={2} fill="var(--violet)" />
      <Chip x={704} y={CY - 24} text={`CKP ${fmt(p.rpm, 0)}`} kind="sensor" anchor="end" />

      {/* ---------------- refrigeración */}
      <rect x={14} y={112} width={60} height={110} rx={6} fill="var(--surface-2)" stroke="var(--c-coolant)" strokeWidth={1.5} />
      {Array.from({ length: 9 }, (_, k) => <line key={k} x1={20} y1={122 + k * 11} x2={68} y2={122 + k * 11} stroke="var(--c-coolant)" opacity={0.35} />)}
      <text x={44} y={236} textAnchor="middle" className="svg-small">radiador</text>
      <g transform={`translate(100 167)`}>
        <circle r={22} fill="none" stroke={s.fan ? "var(--accent)" : "var(--border-strong)"} strokeWidth={1.5} />
        {[0, 1, 2, 3].map((k) => {
          const a = fanA + (k * TAU) / 4;
          return <ellipse key={k} cx={11 * Math.cos(a)} cy={11 * Math.sin(a)} rx={10} ry={4} transform={`rotate(${(a * 180) / Math.PI} ${11 * Math.cos(a)} ${11 * Math.sin(a)})`} fill={s.fan ? "var(--accent)" : "var(--c-metal-2)"} opacity={0.85} />;
        })}
      </g>
      <Chip x={100} y={202} text={s.fan ? "ventilador ON" : "ventilador OFF"} kind="actuador" />
      <path d="M214,136 C160,136 120,120 74,124" fill="none" stroke="var(--c-coolant)" strokeWidth={5} opacity={0.75} />
      <path d="M74,212 C140,212 180,198 240,196" fill="none" stroke="var(--c-coolant)" strokeWidth={5} opacity={0.75} />
      <rect x={210} y={124} width={30} height={26} rx={5} fill="var(--surface-2)" stroke={f === "termostato" ? "var(--bad)" : "var(--c-coolant)"} strokeWidth={f === "termostato" ? 2.5 : 1.5} />
      <text x={225} y={141} textAnchor="middle" style={{ fontSize: 9, fill: "var(--text-2)" }}>T</text>
      {f === "termostato" && <text x={160} y={116} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--bad)" }}>termostato abierto</text>}
      <rect x={244} y={160} width={12} height={18} rx={3} fill="var(--violet)" />
      {f === "ect" ? (
        <g>
          <line x1={250} y1={178} x2={238} y2={196} stroke="var(--violet)" strokeWidth={2} />
          <rect x={226} y={194} width={16} height={11} rx={2} fill="var(--surface)" stroke="var(--bad)" strokeWidth={2} />
          <text x={234} y={226} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--bad)" }}>ficha suelta</text>
        </g>
      ) : null}
      <Chip x={178} y={170} text={`ECT ${fmt(p.ect, 0)}°C`} kind="sensor" bad={f === "ect"} />

      {/* ---------------- escape */}
      {CX.map((x, i) => <rect key={i} x={x - 8} y={206} width={16} height={32} fill={exhCol} opacity={0.75} />)}
      <rect x={280} y={234} width={330} height={16} rx={7} fill={exhCol} opacity={0.75} />
      <rect x={604} y={234} width={18} height={16} fill={exhCol} opacity={0.75} />
      {running && Array.from({ length: 8 }, (_, i) => {
        const u = (t * airSpeed * 0.5 + i / 8) % 1;
        return <circle key={i} cx={290 + u * 400} cy={242} r={2.5} fill="var(--c-exhaust)" opacity={0.8} />;
      })}
      <rect x={597} y={250} width={12} height={14} rx={2} fill={running && p.o2 > 0.2 ? (o2Rich ? "var(--c-hot)" : "var(--c-air)") : "var(--violet)"} stroke="var(--violet)" strokeWidth={1.5} />
      <Chip x={603} y={280} text={`O2 ${fmt(p.o2, 2)} V`} kind="sensor" bad={f === "sonda"} anchor="end" />
      <rect x={622} y={226} width={86} height={32} rx={12}
        fill={`color-mix(in srgb, var(--c-hot) ${Math.round(catHot * 70)}%, var(--c-metal-light))`} stroke={f === "catalizador" ? "var(--bad)" : "var(--c-metal-2)"} strokeWidth={f === "catalizador" ? 2.5 : 1.5} />
      {f === "catalizador" && Array.from({ length: 6 }, (_, k) => <line key={k} x1={630 + k * 12} y1={230} x2={622 + k * 12} y2={254} stroke="var(--bad)" opacity={0.5} />)}
      <text x={665} y={246} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>catalizador</text>
      <Chip x={665} y={278} text={`${fmt(p.catT, 0)}°C`} kind="info" />

      {/* ---------------- ECU, batería */}
      <rect x={14} y={250} width={196} height={70} rx={10} fill="var(--surface)" stroke="var(--violet)" strokeWidth={1.8} />
      <text x={26} y={270} style={{ fontSize: 14, fontWeight: 800, fill: "var(--violet)", letterSpacing: ".08em" }}>ECU</text>
      <text x={64} y={270} style={{ fontSize: 11, fontWeight: 600, fill: "var(--text-2)" }}>{LOOP_LABEL[s.loop]}</text>
      <text x={26} y={290} style={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--text)" }}>
        STFT {p.stft >= 0 ? "+" : ""}{fmt(p.stft, 0)}%  LTFT {p.ltft >= 0 ? "+" : ""}{fmt(p.ltft, 0)}%
      </text>
      <text x={26} y={308} style={{ fontSize: 11, fontFamily: "var(--font-mono)", fill: "var(--muted)" }}>
        carga {fmt(p.load, 0)}% · λ obj {s.loop === "abierto-carga" ? "0,87" : s.closedLoop ? "1,00" : "—"}
      </text>
      <rect x={226} y={266} width={64} height={44} rx={6} fill="var(--c-belt)" stroke={f === "alternador" && p.batt < 13 ? "var(--bad)" : "var(--c-metal-2)"} />
      <rect x={234} y={260} width={10} height={7} fill="var(--bad)" />
      <rect x={272} y={260} width={10} height={7} fill="var(--c-metal-2)" />
      <text x={258} y={293} textAnchor="middle" style={{ fontSize: 12, fontFamily: "var(--font-mono)", fontWeight: 700, fill: p.batt < 12.4 ? "var(--warn)" : "#fff" }}>{fmt(p.batt, 1)} V</text>
      <circle cx={322} cy={288} r={17} fill="var(--surface-2)" stroke={f === "alternador" ? "var(--bad)" : "var(--c-metal-2)"} strokeWidth={f === "alternador" ? 2.5 : 1.5} />
      <text x={322} y={292} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "var(--text-2)" }}>ALT</text>
      <text x={344} y={292} style={{ fontSize: 10.5, fill: charging ? "var(--ok)" : "var(--bad)", fontWeight: 600 }}>{charging ? "← carga" : running ? "no carga" : ""}</text>
    </svg>
  );
}
