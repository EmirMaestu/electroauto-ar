/* La ECU como lazo de control: mapa base → corrección (STFT + LTFT) → inyectores → motor → sonda → ECU.
   STFT reacciona en décimas de segundo (zigzag); LTFT aprende de a poco el promedio del STFT y lo guarda.
   El aprendizaje está acelerado: en un auto real tarda minutos. */
import { useId, useRef, useState } from "react";
import { AnimFrame, Readout, Toggle, useAnimClock, fmt, clamp, Arrow } from "../ui/anim-kit";
import { lambdaVolts } from "./SondaLambda";
import { useNarrowScreen, narrowFonts } from "./RuedaFonica";

const DT = 0.02;
const HIST = 1000; // 20 s
const DELAY = 12; // 0,24 s de transporte hasta la sonda

interface Sim {
  t: number; stft: number; ltft: number; vs: number; rich: boolean; lamQ: number[];
  vH: Float32Array; sH: Float32Array; lH: Float32Array; head: number;
}
const blank = (): Sim => ({
  t: 0, stft: 0, ltft: 0, vs: 0.45, rich: false, lamQ: new Array(DELAY).fill(1),
  vH: new Float32Array(HIST).fill(0.45), sH: new Float32Array(HIST), lH: new Float32Array(HIST), head: 0,
});
/** Un paso de 20 ms del lazo */
function step(S: Sim, fuga: boolean, frio: boolean) {
  const closed = !frio;
  const lamCmd = frio ? 0.86 : 1.0; // en frío la ECU enriquece por mapa
  const lam = (lamCmd * (fuga ? 1.18 : 1)) / (1 + (closed ? S.stft : 0) + S.ltft);
  S.lamQ.push(lam);
  const lamS = S.lamQ.shift()!;
  S.vs += (lambdaVolts(lamS) - S.vs) * Math.min(1, DT / 0.05);
  if (closed) {
    const rich = S.vs > 0.45;
    if (rich !== S.rich) S.stft += rich ? -0.025 : 0.025;
    S.stft += (rich ? -0.04 : 0.04) * DT;
    // el LTFT "se lleva" de a poco el promedio del STFT
    const move = S.stft * 0.45 * DT;
    S.ltft = clamp(S.ltft + move, -0.25, 0.25);
    S.stft = clamp(S.stft - move, -0.25, 0.25);
    S.rich = rich;
  } else {
    S.stft += (0 - S.stft) * Math.min(1, DT / 0.2);
  }
  S.vH[S.head] = S.vs; S.sH[S.head] = S.stft * 100; S.lH[S.head] = S.ltft * 100;
  S.head = (S.head + 1) % HIST;
  S.t += DT;
}
const newSim = (): Sim => {
  const S = blank();
  for (let i = 0; i < HIST; i++) step(S, false, false);
  S.t = 0;
  return S;
};

export function LazoCerrado() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const svgId = "lazo-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [fuga, setFuga] = useState(false);
  const [frio, setFrio] = useState(false);
  const sim = useRef<Sim | null>(null);
  if (!sim.current) sim.current = newSim();
  const resetPending = useRef(false);

  if (clock.t < sim.current.t - 0.5) sim.current = newSim();
  const S = sim.current;
  if (resetPending.current) { S.ltft = 0; resetPending.current = false; }
  let steps = 0;
  while (S.t < clock.t && steps < 400) { steps++; step(S, fuga, frio); }
  const last = (a: Float32Array) => a[(S.head + HIST - 1) % HIST];
  const v = last(S.vH), stft = last(S.sH), ltft = last(S.lH);
  const total = stft + ltft;

  // gráfico de historia
  const GX0 = 56, GX1 = 704;
  const mx = (i: number) => GX0 + (i / (HIST - 1)) * (GX1 - GX0);
  const VY0 = 176, VY1 = narrow ? 250 : 226; // sonda
  const TY0 = narrow ? 270 : 244, TY1 = narrow ? 410 : 330; // trims
  const myV = (x: number) => VY1 - clamp(x, 0, 1) * (VY1 - VY0);
  const myT = (p: number) => (TY0 + TY1) / 2 - (clamp(p, -25, 25) / 25) * ((TY1 - TY0) / 2);
  const path = (a: Float32Array, map: (x: number) => number) => {
    let d = "";
    for (let i = 0; i < HIST; i += 2) d += `${i ? "L" : "M"}${mx(i).toFixed(1)},${map(a[(S.head + i) % HIST]).toFixed(1)}`;
    return d;
  };

  // diagrama de bloques
  const boxes = [
    { x: 14, y: 26, w: 112, t1: "Mapa base", t2: "rpm × carga" },
    { x: 150, y: 26, w: 128, t1: "× (1 + STFT + LTFT)", t2: `= ${total >= 0 ? "+" : ""}${fmt(total, 1)} %` },
    { x: 302, y: 26, w: 100, t1: "Inyectores", t2: "ancho de pulso" },
    { x: 426, y: 26, w: 120, t1: "Motor", t2: fuga ? "¡entra aire falso!" : "quema la mezcla" },
    { x: 570, y: 26, w: 136, t1: "Sonda λ", t2: `${fmt(v, 2)} V · ${v > 0.45 ? "rica" : "pobre"}` },
    { x: 570, y: 100, w: 136, t1: "ECU compara", t2: frio ? "lazo abierto: ignora" : "con 0,45 V" },
    { x: 360, y: 100, w: 150, t1: "STFT (rápido)", t2: frio ? "congelado en 0" : "zigzag ± pocos %" },
    { x: 150, y: 100, w: 150, t1: "LTFT (aprende)", t2: "guarda el promedio" },
  ];
  // punto que recorre el lazo
  const loopPts: [number, number][] = [[70, 48], [214, 48], [352, 48], [486, 48], [638, 48], [638, 122], [435, 122], [225, 122], [225, 72], [214, 48]];
  const segL = loopPts.map((p, i) => (i ? Math.hypot(p[0] - loopPts[i - 1][0], p[1] - loopPts[i - 1][1]) : 0));
  const totL = segL.reduce((a, b) => a + b, 0);
  let dd = (clock.t * 260) % totL, px = loopPts[0][0], py = loopPts[0][1];
  for (let i = 1; i < loopPts.length; i++) {
    if (dd <= segL[i]) { const f = dd / segL[i]; px = loopPts[i - 1][0] + (loopPts[i][0] - loopPts[i - 1][0]) * f; py = loopPts[i - 1][1] + (loopPts[i][1] - loopPts[i - 1][1]) * f; break; }
    dd -= segL[i];
  }

  return (
    <AnimFrame
      title="La ECU en lazo cerrado: STFT corrige, LTFT aprende"
      clock={clock}
      controls={
        <>
          <Toggle label="Crear pérdida de vacío" checked={fuga} onChange={setFuga} />
          <Toggle label="Motor frío (lazo abierto)" checked={frio} onChange={setFrio} />
          <button className="btn ghost sm" onClick={() => { resetPending.current = true; clock.step(0.0001); }}>Borrar adaptaciones</button>
        </>
      }
      readouts={
        <>
          <Readout label="STFT" value={(stft >= 0 ? "+" : "") + fmt(stft, 1)} unit="%" tone={Math.abs(stft) > 10 ? "bad" : "ok"} />
          <Readout label="LTFT" value={(ltft >= 0 ? "+" : "") + fmt(ltft, 1)} unit="%" tone={Math.abs(ltft) > 10 ? "bad" : "ok"} />
          <Readout label="Corrección total" value={(total >= 0 ? "+" : "") + fmt(total, 1)} unit="%" tone={Math.abs(total) > 20 ? "bad" : Math.abs(total) > 10 ? "warn" : "ok"} />
          <Readout label="Sonda" value={fmt(v, 2)} unit="V" />
          <Readout label="Estado" value={<span style={{ fontSize: ".82rem" }}>{frio ? "Lazo abierto (frío)" : "Lazo cerrado"}</span>} tone={frio ? "warn" : "accent"} />
          <Readout label="Diagnóstico" value={<span style={{ fontSize: ".78rem" }}>{Math.abs(total) > 20 ? "P0171: sistema pobre" : Math.abs(total) > 10 ? "corrigiendo mucho" : "normal (±10 %)"}</span>} tone={Math.abs(total) > 20 ? "bad" : Math.abs(total) > 10 ? "warn" : "ok"} />
        </>
      }
      legend={[
        { color: "#c9a800", label: "Sonda lambda (V)" },
        { color: "var(--accent)", label: "STFT (corto plazo)" },
        { color: "var(--violet)", label: "LTFT (largo plazo)" },
        { color: "var(--ok)", label: "Rango normal ±10 %" },
      ]}
      caption={
        <>
          <p>
            La ECU arranca de un <b>mapa base</b> y lo corrige con dos números. El <b>STFT</b> mira la sonda y zigzaguea alrededor
            de λ = 1. El <b>LTFT</b> aprende despacio el promedio del STFT y lo guarda en memoria, para que la próxima vez arranque ya
            corregido. Sumados son lo que tenés que mirar en el scanner.
          </p>
          <p>
            Tocá <b>pérdida de vacío</b>: entra aire que nadie midió, el STFT salta para arriba y en unos segundos el LTFT lo absorbe
            (acá está acelerado; en un auto real tarda minutos). Si la corrección total pasa ~+20–25 %, la ECU ya no llega y guarda
            <b> P0171</b>. Con <b>motor frío</b> la ECU ignora la sonda y enriquece por mapa: el STFT queda en 0 aunque la sonda marque
            rica. <b>Borrar adaptaciones</b> es lo que pasa al desconectar la batería: el LTFT vuelve a 0 y tiene que reaprender.
          </p>
        </>
      }
    >
      <svg id={svgId} viewBox={narrow ? "0 150 720 282" : "0 0 720 340"} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Lazo de control de mezcla de la ECU">
        {narrow && <style>{narrowFonts(svgId, 20, 20)}</style>}
        {/* flechas del lazo */}
        <Arrow x1={126} y1={48} x2={148} y2={48} color="var(--muted)" />
        <Arrow x1={278} y1={48} x2={300} y2={48} color="var(--muted)" />
        <Arrow x1={402} y1={48} x2={424} y2={48} color="var(--muted)" />
        <Arrow x1={546} y1={48} x2={568} y2={48} color="var(--muted)" />
        <Arrow x1={638} y1={70} x2={638} y2={98} color="var(--muted)" />
        <Arrow x1={570} y1={122} x2={512} y2={122} color={frio ? "var(--border-strong)" : "var(--muted)"} dash={frio ? "4 4" : undefined} />
        <Arrow x1={360} y1={122} x2={302} y2={122} color="var(--muted)" />
        <Arrow x1={225} y1={100} x2={225} y2={72} color="var(--muted)" />
        <path d="M435,100 L435,86 L265,86 L265,72" fill="none" stroke="var(--muted)" strokeWidth={2} />
        <polygon points="265,70 261,78 269,78" fill="var(--muted)" />
        {fuga && (
          <>
            <Arrow x1={486} y1={98} x2={486} y2={72} color="var(--c-air)" width={3} />
            <text x={492} y={94} className="svg-small" style={{ fill: "var(--c-air)", fontWeight: 700 }}>aire falso</text>
          </>
        )}
        {boxes.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={44} rx={8} fill="var(--surface)"
              stroke={i === 6 ? "var(--accent)" : i === 7 ? "var(--violet)" : i === 4 ? "#c9a800" : i === 3 && fuga ? "var(--c-air)" : "var(--border-strong)"} strokeWidth={i >= 6 || i === 4 ? 2 : 1.4} />
            <text x={b.x + b.w / 2} y={b.y + 18} textAnchor="middle" className="svg-label" style={{ fill: "var(--text)" }}>{b.t1}</text>
            <text x={b.x + b.w / 2} y={b.y + 34} textAnchor="middle" className="svg-small">{b.t2}</text>
          </g>
        ))}
        <circle cx={px} cy={py} r={5} fill="var(--accent)" opacity={0.85} />

        {/* historia */}
        <text x={GX0} y={VY0 - 8} className="svg-small">sonda lambda (0–1 V), últimos 20 s</text>
        <rect x={GX0} y={VY0} width={GX1 - GX0} height={VY1 - VY0} fill="var(--surface)" stroke="var(--border)" />
        <line x1={GX0} y1={myV(0.45)} x2={GX1} y2={myV(0.45)} stroke="var(--border-strong)" strokeDasharray="3 4" />
        <path d={path(S.vH, myV)} fill="none" stroke="#c9a800" strokeWidth={1.6} />
        <text x={GX0 - 6} y={myV(0.9) + 4} textAnchor="end" className="svg-small">0,9</text>
        <text x={GX0 - 6} y={myV(0.1) + 4} textAnchor="end" className="svg-small">0,1</text>

        <rect x={GX0} y={TY0} width={GX1 - GX0} height={TY1 - TY0} fill="var(--surface)" stroke="var(--border)" />
        <rect x={GX0} y={myT(10)} width={GX1 - GX0} height={myT(-10) - myT(10)} fill="var(--ok)" opacity={0.1} />
        <line x1={GX0} y1={myT(0)} x2={GX1} y2={myT(0)} stroke="var(--border-strong)" />
        {(narrow ? [25, 0, -25] : [25, 10, 0, -10, -25]).map((p) => (
          <text key={p} x={GX0 - 6} y={myT(p) + 4} textAnchor="end" className="svg-small">{p > 0 ? `+${p}` : p}%</text>
        ))}
        <path d={path(S.lH, myT)} fill="none" stroke="var(--violet)" strokeWidth={2.4} />
        <path d={path(S.sH, myT)} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
        <text x={GX1} y={TY1 + 12} textAnchor="end" className="svg-small">ahora →</text>
      </svg>
    </AnimFrame>
  );
}
