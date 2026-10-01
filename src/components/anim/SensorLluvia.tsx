/* Sensor de lluvia: LED infrarrojo + fotodiodo pegados al parabrisas por dentro.
   El haz entra al vidrio a 45°. Con el vidrio seco, en la cara de afuera hay reflexión total
   (vidrio→aire: ángulo crítico 41,8°) y toda la luz vuelve al fotodiodo. Con una gota, el ángulo
   crítico vidrio→agua sube a 62,5°: a 45° la luz se escapa dentro de la gota y la señal baja. */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, useAnimClock, fmt } from "../ui/anim-kit";

const GY0 = 150, GY1 = 192;        // caras exterior e interior del vidrio
const SPOTS = [362, 377, 392];     // puntos de reflexión en la cara exterior
const ZONE = [346, 408];           // zona sensible
const DT = 1 / 60;
const HIST = 12;                   // s en el gráfico

interface Drop { x: number; r: number }
interface Sim {
  t: number; seed: number; drops: Drop[];
  wipe: { on: boolean; t0: number; stroke: number; xPrev: number };
  lastEnd: number; mode: string; wipes: number[];
  hist: { t: number; s: number }[]; nextS: number; dip: number;
}

function rnd(s: Sim) {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = Math.imul(s.seed ^ (s.seed >>> 15), 1 | s.seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const newSim = (): Sim => ({
  t: 0, seed: 12345, drops: [], wipe: { on: false, t0: 0, stroke: 0.9, xPrev: 18 },
  lastEnd: -99, mode: "Apagado", wipes: [], hist: [], nextS: 0, dip: 0,
});

/** Posición de la escobilla durante una barrida (ida y vuelta). */
function bladeX(w: Sim["wipe"], t: number) {
  if (!w.on) return 18;
  const u = (t - w.t0) / w.stroke; // 0..2
  const e = (v: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, v)));
  return u <= 1 ? 18 + 700 * e(u) : 718 - 700 * e(u - 1);
}

function coverage(drops: Drop[]) {
  let c = 0;
  for (const d of drops) {
    const a = Math.max(ZONE[0], d.x - d.r * 0.9), b = Math.min(ZONE[1], d.x + d.r * 0.9);
    if (b > a) c += b - a;
  }
  return Math.min(1, c / (ZONE[1] - ZONE[0]));
}

export function SensorLluvia() {
  const clock = useAnimClock({ speed: 1 });
  const [rain, setRain] = useState(25);
  const [burbuja, setBurbuja] = useState(false);
  const sim = useRef<Sim>(newSim());

  const base = burbuja ? 72 : 100;
  const thr = base - 16;
  const signal = (s: Sim) => base - 70 * coverage(s.drops) - s.dip;

  if (clock.t < sim.current.t - 0.01) sim.current = newSim();
  const s = sim.current;
  let guard = 0;
  while (s.t + DT <= clock.t && guard++ < 300) {
    s.t += DT;
    // lluvia: gotas nuevas
    const lam = Math.pow(rain / 100, 1.3) * 30 * DT;
    if (rnd(s) < lam && s.drops.length < 90) s.drops.push({ x: 8 + rnd(s) * 704, r: 3 + rnd(s) * (3 + rain / 25) });
    // burbuja en el gel: caídas de señal falsas al azar
    if (burbuja && s.dip === 0 && rnd(s) < 0.35 * DT) s.dip = 17 + rnd(s) * 8;
    else if (s.dip > 0) s.dip = Math.max(0, s.dip - 30 * DT);
    // escobilla
    if (s.wipe.on) {
      const x = bladeX(s.wipe, s.t);
      const a = Math.min(x, s.wipe.xPrev) - 8, b = Math.max(x, s.wipe.xPrev) + 8;
      s.drops = s.drops.filter((d) => d.x < a || d.x > b);
      s.wipe.xPrev = x;
      if (s.t - s.wipe.t0 >= 2 * s.wipe.stroke) { s.wipe.on = false; s.lastEnd = s.t; s.wipe.xPrev = 18; }
    } else {
      const sig = signal(s);
      if (sig < thr) {
        const gap = s.t - s.lastEnd;
        s.mode = gap < 1.2 ? "Rápido" : gap < 4 ? "Lento" : "Interm.";
        s.wipe = { on: true, t0: s.t, stroke: s.mode === "Rápido" ? 0.5 : 0.85, xPrev: 18 };
        s.wipes.push(s.t);
      } else if (s.t - s.lastEnd > 8) s.mode = "Apagado";
    }
    s.wipes = s.wipes.filter((w) => w > s.t - 30);
    if (s.t >= s.nextS) {
      s.hist.push({ t: s.t, s: signal(s) + (rnd(s) - 0.5) * (burbuja ? 3 : 1.2) });
      s.nextS = s.t + 0.1;
      while (s.hist.length && s.hist[0].t < s.t - HIST) s.hist.shift();
    }
  }
  if (s.t + DT <= clock.t) s.t = clock.t; // si la pestaña estuvo frenada

  const t = s.t;
  const sig = signal(s);
  const xb = bladeX(s.wipe, t);
  const wet = (x: number) => s.drops.some((d) => Math.abs(d.x - x) < d.r * 0.9);
  const perMin = s.wipes.filter((w) => w > t - 20).length * 3;

  /* gráfico */
  const GX = 60, GW = 640, GY = 300, GH = 96;
  const gx = (ti: number) => GX + GW - ((t - ti) / HIST) * GW;
  const gy = (v: number) => GY + GH - ((Math.max(30, Math.min(105, v)) - 30) / 75) * GH;
  const path = s.hist.map((p, i) => `${i ? "L" : "M"}${gx(p.t).toFixed(1)},${gy(p.s).toFixed(1)}`).join("");

  return (
    <AnimFrame
      title="Sensor de lluvia: reflexión total interna en el parabrisas"
      clock={clock}
      controls={
        <>
          <Slider label="Lluvia" value={rain} min={0} max={100} step={1} onChange={setRain} unit="%" />
          <Toggle label="Burbuja en el gel de acople (parabrisas mal colocado)" checked={burbuja} onChange={setBurbuja} />
        </>
      }
      readouts={
        <>
          <Readout label="Señal del fotodiodo" value={fmt(Math.max(0, sig), 0)} unit="%" tone={sig < thr ? "bad" : "ok"} />
          <Readout label="Limpiaparabrisas" value={s.mode} tone={s.mode === "Apagado" ? undefined : "accent"} />
          <Readout label="Barridas" value={fmt(perMin, 0)} unit="por minuto" />
          <Readout label="Gotas sobre el sensor" value={s.drops.filter((d) => d.x > ZONE[0] - d.r && d.x < ZONE[1] + d.r).length} />
        </>
      }
      legend={[
        { color: "var(--bad)", label: "Haz infrarrojo (invisible para el ojo)" },
        { color: "var(--teal)", label: "Vidrio y gel de acople" },
        { color: "var(--c-air)", label: "Gotas de agua" },
      ]}
      caption={
        <>
          <p>
            El LED manda luz infrarroja al vidrio a 45°. En la cara de afuera, con el vidrio <b>seco</b>, la luz no puede salir
            (reflexión total, el ángulo crítico vidrio-aire es 41,8°) y vuelve entera al fotodiodo. Donde hay una <b>gota</b>, el ángulo
            crítico pasa a ser 62,5°: a 45° la luz <b>se escapa dentro del agua</b> y la señal baja. Cuando baja de un umbral, el módulo
            manda una barrida; si las barridas se piden seguido, pasa a continuo lento o rápido.
          </p>
          <p>
            Activá la <b>burbuja en el gel</b>: parte de la luz se pierde antes de llegar al vidrio, la señal queda baja y ruidosa, y el
            limpia barre solo con el vidrio seco. Es la falla típica después de cambiar un parabrisas sin el gel o el soporte correctos.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 416" role="img" aria-label="Sensor de lluvia en el parabrisas">
        <text x={12} y={22} className="svg-small">afuera</text>
        <text x={12} y={GY1 + 22} className="svg-small">adentro del auto</text>
        {/* lluvia */}
        {Array.from({ length: Math.round((rain / 100) * 20) }, (_, i) => {
          const x = (i * 97 + 31) % 700 + 10;
          const y = ((t * 420 + i * 53) % 170) - 30;
          return <line key={i} x1={x} y1={y} x2={x - 3} y2={y + 16} stroke="var(--c-air)" strokeWidth={1.5} opacity={0.55} />;
        })}
        {/* vidrio */}
        <rect x={0} y={GY0} width={720} height={GY1 - GY0} fill="var(--teal)" opacity={0.22} />
        <line x1={0} y1={GY0} x2={720} y2={GY0} stroke="var(--teal)" strokeWidth={2} />
        <line x1={0} y1={GY1} x2={720} y2={GY1} stroke="var(--teal)" strokeWidth={2} />
        <text x={706} y={GY0 + 26} textAnchor="end" className="svg-label" style={{ fill: "var(--teal)" }}>parabrisas (n ≈ 1,5)</text>
        {/* zona sensible */}
        <line x1={ZONE[0]} y1={GY0 - 3} x2={ZONE[1]} y2={GY0 - 3} stroke="var(--bad)" strokeWidth={2} strokeDasharray="3 3" opacity={0.6} />
        {/* gotas */}
        {s.drops.map((d, i) => (
          <path key={i} d={`M${d.x - d.r},${GY0} A${d.r},${d.r * 0.85} 0 0 1 ${d.x + d.r},${GY0} Z`} fill="var(--c-air)" opacity={0.75} />
        ))}
        {/* sensor + gel */}
        <rect x={252} y={GY1} width={248} height={6} fill="var(--teal)" opacity={0.55} />
        {burbuja && <ellipse cx={300} cy={GY1 + 3} rx={14} ry={3.2} fill="var(--surface)" stroke="var(--muted)" />}
        <rect x={248} y={GY1 + 6} width={256} height={64} rx={8} fill="var(--c-metal-dark)" />
        <text x={376} y={GY1 + 60} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-metal-light)" }}>módulo del sensor (también mide luz)</text>
        <rect x={270} y={GY1 + 30} width={40} height={14} rx={3} fill="var(--bad)" />
        <text x={290} y={GY1 + 41} textAnchor="middle" className="svg-small" style={{ fill: "#fff", fontWeight: 700 }}>LED</text>
        <rect x={442} y={GY1 + 30} width={40} height={14} rx={3} fill="var(--c-metal-light)" />
        <text x={462} y={GY1 + 41} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-metal-dark)", fontWeight: 700 }}>foto</text>
        {/* haces */}
        {SPOTS.map((xs, j) => {
          const w = wet(xs);
          const loss = burbuja && j === 0 ? 0.35 : 1;
          return (
            <g key={xs}>
              <line x1={xs - (GY1 + 30 - GY0)} y1={GY1 + 30} x2={xs} y2={GY0} stroke="var(--bad)" strokeWidth={2.2} opacity={0.9 * loss} />
              <line x1={xs} y1={GY0} x2={xs + (GY1 + 30 - GY0)} y2={GY1 + 30} stroke="var(--bad)" strokeWidth={2.2} opacity={(w ? 0.12 : 0.9) * loss} />
              {w && <line x1={xs} y1={GY0} x2={xs + 13} y2={GY0 - 10} stroke="var(--bad)" strokeWidth={2.2} opacity={0.9 * loss} />}
            </g>
          );
        })}
        {/* escobilla */}
        <g>
          <line x1={xb} y1={GY0 - 14} x2={xb - 6} y2={GY0 - 60} stroke="var(--c-metal-dark)" strokeWidth={4} />
          <rect x={xb - 4} y={GY0 - 16} width={8} height={16} rx={2} fill="var(--c-rubber)" />
        </g>
        <text x={xb + 8} y={GY0 - 50} className="svg-small">escobilla</text>

        {/* señal */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <line x1={GX} y1={gy(thr)} x2={GX + GW} y2={gy(thr)} stroke="var(--bad)" strokeDasharray="5 4" />
        <text x={GX + GW - 6} y={gy(thr) + 14} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>umbral: barrer</text>
        {s.wipes.filter((w) => w > t - HIST).map((w) => (
          <rect key={w} x={gx(w)} y={GY + GH - 8} width={4} height={8} fill="var(--accent)" />
        ))}
        <path d={path} fill="none" stroke="var(--c-signal)" strokeWidth={2.2} />
        <text x={GX - 6} y={gy(100) + 4} textAnchor="end" className="svg-small">100 %</text>
        <text x={GX - 6} y={gy(30) + 4} textAnchor="end" className="svg-small">30 %</text>
        <text x={GX} y={GY + GH + 14} className="svg-small">señal del fotodiodo · últimos {HIST} s · marcas naranjas = barridas</text>
      </svg>
    </AnimFrame>
  );
}
