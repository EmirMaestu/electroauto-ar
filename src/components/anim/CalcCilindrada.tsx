/* Calculadora de cilindrada y relación de compresión con el cilindro dibujado a escala. */
import { useRef, useState, type CSSProperties } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, Arrow, fmt } from "../ui/anim-kit";
import { pistonX, useWide } from "./motor1-kit";

const PRESETS = {
  nafta: { label: "1.6 nafta", d: 79.5, s: 80.5, z: 4, vc: 44.4 },
  diesel: { label: "2.8 diésel", d: 92, s: 103.6, z: 4, vc: 47.4 },
  moto: { label: "Moto 150", d: 57.3, s: 57.8, z: 1, vc: 17.5 },
} as const;
type PresetKey = keyof typeof PRESETS | "libre";

const mono: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: ".86rem", color: "var(--text)" };
const n2 = (v: number, d = 1) => fmt(v, d);

export function CalcCilindrada() {
  const clock = useAnimClock({ speed: 1 });
  const [d, setD] = useState<number>(PRESETS.nafta.d);
  const [s, setS] = useState<number>(PRESETS.nafta.s);
  const [z, setZ] = useState<number>(4);
  const [vc, setVc] = useState<number>(PRESETS.nafta.vc);
  const [preset, setPreset] = useState<PresetKey>("nafta");
  const boxRef = useRef<HTMLDivElement>(null);
  const wide = useWide(boxRef, 620);

  const apply = (k: PresetKey) => {
    setPreset(k);
    if (k === "libre") return;
    const p = PRESETS[k];
    setD(p.d); setS(p.s); setZ(p.z); setVc(p.vc);
  };
  const free = <T,>(fn: (v: T) => void) => (v: T) => { setPreset("libre"); fn(v); };

  const vh = (Math.PI / 4) * (d / 10) ** 2 * (s / 10); // cm³
  const VH = vh * z;
  const eps = (vh + vc) / vc;
  const hc = (vc * 1000) / ((Math.PI / 4) * d * d); // altura equivalente de la cámara [mm]
  const ratio = s / d;
  const tipo = ratio > 1.03 ? "carrera larga (subcuadrado)" : ratio < 0.97 ? "carrera corta (supercuadrado)" : "cuadrado";
  const vm = (2 * (s / 1000) * 6000) / 60;

  // ---------- dibujo a escala
  const K = 1.9; // px por mm
  const CX = 180, TOP = 34;
  const bw = d * K;
  const yPMS = TOP + hc * K;
  const yPMI = yPMS + s * K;
  const r = s / 2, l = 1.65 * s;
  const ang = ((clock.t * 0.35) % 1) * 360;
  const crown = yPMS + pistonX(ang, r, l) * K;
  const ph = Math.min(46, 0.55 * d * K);
  const H = Math.max(330, yPMI + ph + 44);
  const drawing = (
    <svg viewBox={`0 0 360 ${H}`} role="img" aria-label="Cilindro dibujado a escala">
      {/* camisa */}
      <rect x={CX - bw / 2 - 14} y={TOP - 14} width={bw + 28} height={14} rx={4} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" />
      <rect x={CX - bw / 2 - 14} y={TOP} width={14} height={yPMI + ph - TOP + 6} fill="var(--c-block)" stroke="var(--c-metal-2)" strokeWidth={0.8} />
      <rect x={CX + bw / 2} y={TOP} width={14} height={yPMI + ph - TOP + 6} fill="var(--c-block)" stroke="var(--c-metal-2)" strokeWidth={0.8} />
      <rect x={CX - bw / 2} y={TOP} width={bw} height={yPMI + ph - TOP + 6} fill="var(--surface)" />
      {/* volúmenes */}
      <rect x={CX - bw / 2} y={yPMS} width={bw} height={s * K} fill="var(--c-air)" opacity={0.1} />
      <rect x={CX - bw / 2} y={yPMS} width={bw} height={Math.max(0, crown - yPMS)} fill="var(--c-air)" opacity={0.28} />
      <rect x={CX - bw / 2} y={TOP} width={bw} height={hc * K} fill="var(--violet)" opacity={0.45} />
      <text x={CX} y={TOP + (hc * K) / 2 + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>
        {hc * K > 13 ? `Vc = ${n2(vc)} cm³` : ""}
      </text>
      <line x1={CX - bw / 2 - 30} y1={yPMS} x2={CX + bw / 2 + 30} y2={yPMS} stroke="var(--muted)" strokeDasharray="4 3" />
      <line x1={CX - bw / 2 - 30} y1={yPMI} x2={CX + bw / 2 + 30} y2={yPMI} stroke="var(--muted)" strokeDasharray="4 3" />
      <text x={CX - bw / 2 - 32} y={yPMS + 4} textAnchor="end" className="svg-small" style={{ fontWeight: 700 }}>PMS</text>
      <text x={CX - bw / 2 - 32} y={yPMI + 4} textAnchor="end" className="svg-small" style={{ fontWeight: 700 }}>PMI</text>
      <text x={CX} y={(yPMS + yPMI) / 2 + 4} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: "var(--c-air)" }}>
        Vh = {n2(vh)} cm³
      </text>
      {/* pistón */}
      <rect x={CX - bw / 2 + 1.5} y={crown} width={bw - 3} height={ph} rx={3} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
      {[4, 8, 13].map((o) => <line key={o} x1={CX - bw / 2 + 1.5} y1={crown + o} x2={CX + bw / 2 - 1.5} y2={crown + o} stroke="var(--c-metal-dark)" strokeWidth={o === 13 ? 2.5 : 1.6} />)}
      <circle cx={CX} cy={crown + ph * 0.6} r={Math.min(9, ph * 0.18)} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
      {/* cotas */}
      <Arrow x1={CX} y1={TOP - 24} x2={CX - bw / 2} y2={TOP - 24} color="var(--accent)" width={1.5} head={7} />
      <Arrow x1={CX} y1={TOP - 24} x2={CX + bw / 2} y2={TOP - 24} color="var(--accent)" width={1.5} head={7} />
      <text x={CX} y={TOP - 29} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, fill: "var(--accent)" }}>d = {n2(d)} mm</text>
      {(() => {
        const x = CX + bw / 2 + 32;
        return (
          <g>
            <Arrow x1={x} y1={(yPMS + yPMI) / 2} x2={x} y2={yPMS} color="var(--accent)" width={1.5} head={7} />
            <Arrow x1={x} y1={(yPMS + yPMI) / 2} x2={x} y2={yPMI} color="var(--accent)" width={1.5} head={7} />
            <text x={x + 6} y={(yPMS + yPMI) / 2 + 4} style={{ fontSize: 12, fontWeight: 800, fill: "var(--accent)" }}>s</text>
            <text x={x + 6} y={(yPMS + yPMI) / 2 + 18} className="svg-small">{n2(s)} mm</text>
          </g>
        );
      })()}
      <text x={8} y={H - 22} className="svg-small">Todo a la misma escala (1 mm = {fmt(K, 1)} px).</text>
      <text x={8} y={H - 8} className="svg-small">La cámara se dibuja como un cilindro del mismo volumen.</text>
    </svg>
  );

  const row = (label: string, a: string, b: string, res: string, tone = "var(--accent)") => (
    <div style={{ padding: ".55rem .7rem", border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface)", marginBottom: ".5rem" }}>
      <div style={{ fontSize: ".72rem", textTransform: "uppercase", letterSpacing: ".08em", color: "var(--faint)", fontWeight: 700 }}>{label}</div>
      <div style={mono}>{a}</div>
      <div style={{ ...mono, color: "var(--text-2)" }}>{b}</div>
      <div style={{ ...mono, fontWeight: 800, fontSize: "1rem", color: tone }}>{res}</div>
    </div>
  );
  const barMax = 1;
  const calc = (
    <div style={{ padding: ".25rem .25rem .25rem 0", fontSize: ".9rem" }}>
      {row("Cilindrada de un cilindro", "Vh = π/4 · d² · s", `= 0,7854 × (${n2(d / 10, 2)} cm)² × ${n2(s / 10, 2)} cm`, `= ${n2(vh, 1)} cm³`, "var(--c-air)")}
      {row("Cilindrada total", "VH = Vh · z", `= ${n2(vh, 1)} × ${z}`, `= ${fmt(VH, 0)} cm³ ≈ ${n2(VH / 1000, 1)} L`)}
      {row("Relación de compresión", "ε = (Vh + Vc) / Vc", `= (${n2(vh, 1)} + ${n2(vc, 1)}) / ${n2(vc, 1)}`, `= ${n2(eps, 1)} : 1`, "var(--violet)")}
      <div style={{ fontSize: ".8rem", color: "var(--muted)", margin: ".2rem 0 .3rem" }}>El gas que ocupaba todo esto…</div>
      <div style={{ height: 14, borderRadius: 4, background: "linear-gradient(90deg, var(--violet) 0, var(--violet) " + (100 / eps) * barMax + "%, var(--c-air) " + (100 / eps) * barMax + "%)", opacity: 0.85 }} />
      <div style={{ fontSize: ".8rem", color: "var(--muted)", margin: ".3rem 0 .3rem" }}>…queda apretado en esto ({n2(eps, 1)} veces menos):</div>
      <div style={{ height: 14, width: `${100 / eps}%`, minWidth: 6, borderRadius: 4, background: "var(--violet)" }} />
      <div style={{ fontSize: ".82rem", color: "var(--text-2)", marginTop: ".6rem" }}>
        Relación carrera/diámetro <b>{n2(ratio, 2)}</b>: motor <b>{tipo}</b>. Velocidad media del pistón a 6.000 rpm:{" "}
        <b>{n2(vm, 1)} m/s</b>{vm > 20 ? " (muy alta: piezas muy exigidas)" : ""}.
      </div>
    </div>
  );

  return (
    <AnimFrame
      title="Calculadora de cilindrada y relación de compresión"
      tag="Interactivo"
      clock={clock}
      controls={
        <>
          <Seg value={preset} onChange={apply} ariaLabel="Ejemplos"
            options={[...Object.entries(PRESETS).map(([k, p]) => ({ value: k as PresetKey, label: p.label })), { value: "libre" as PresetKey, label: "Libre" }]} />
          <Slider label="Diámetro" value={d} min={50} max={110} step={0.5} unit="mm" onChange={free(setD)} format={(v) => fmt(v, 1)} />
          <Slider label="Carrera" value={s} min={45} max={110} step={0.5} unit="mm" onChange={free(setS)} format={(v) => fmt(v, 1)} />
          <Slider label="Cámara Vc" value={vc} min={10} max={90} step={0.5} unit="cm³" onChange={free(setVc)} format={(v) => fmt(v, 1)} />
          <span className="ctl"><span>Cilindros</span>
            <Seg value={z} onChange={free(setZ)} ariaLabel="Cilindros" options={[1, 2, 3, 4, 5, 6, 8].map((n) => ({ value: n, label: String(n) }))} />
          </span>
        </>
      }
      readouts={
        <>
          <Readout label="Por cilindro" value={fmt(vh, 1)} unit="cm³" />
          <Readout label="Total" value={fmt(VH, 0)} unit="cm³" tone="accent" />
          <Readout label="Relación de compresión" value={`${fmt(eps, 1)}:1`} tone={eps > 14 ? "warn" : undefined} />
          <Readout label="Carrera / diámetro" value={fmt(ratio, 2)} />
        </>
      }
      legend={[
        { color: "var(--c-air)", label: "Volumen barrido Vh (lo que 'chupa' el pistón)" },
        { color: "var(--violet)", label: "Cámara de combustión Vc" },
      ]}
      caption={
        <p>
          Movés el diámetro o la carrera y el dibujo cambia a escala. Fijate que el diámetro pesa <b>al cuadrado</b>: agrandar 1 mm el
          diámetro suma más cilindrada que alargar 1 mm la carrera. La relación de compresión, en cambio, depende de la <b>cámara</b>: si
          rectificás la tapa (le sacás material) la cámara se achica y la compresión sube; si ponés una junta más gruesa, baja. Los nafteros
          andan entre 9:1 y 13:1; los diésel, entre 15:1 y 20:1 (por eso el preset de diésel da tan alto). Los ejemplos son valores
          típicos de esos motores: para un trabajo real, siempre el dato del fabricante.
        </p>
      }
    >
      <div ref={boxRef} style={{ display: "grid", gridTemplateColumns: wide ? "minmax(0,1fr) minmax(0,1fr)" : "1fr", gap: ".8rem", alignItems: "center" }}>
        <div>{drawing}</div>
        {calc}
      </div>
    </AnimFrame>
  );
}
