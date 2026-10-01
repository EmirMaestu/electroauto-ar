/* Un cuarto de auto (masa suspendida + resorte + amortiguador) pasando por un pozo.
   Izquierda: sin amortiguador (D = 0). Derecha: con el D que elijas.
   La respuesta se calcula integrando la ecuación del movimiento de verdad:
   m·x'' = −c·(x − u) − b·(x' − u'), con u = perfil del camino bajo la rueda. */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, useAnimClock, springPath, fmt, TAU } from "../ui/anim-kit";

const M_BASE = 350;   // kg: un cuarto de un auto de 1.400 kg
const DEPTH = 0.05;   // m: profundidad del pozo
const DUR = 0.3;      // s que tarda la rueda en cruzar el pozo
const EVERY = 6;      // s entre pozos automáticos
const FIRST = 0.9;    // s: primer pozo
const H = 1 / 600;    // s: paso de integración
const WIN = 6;        // s de historia en el gráfico
const SY = 650;       // px por metro de desplazamiento vertical (dibujo)
const VPX = 240;      // px/s: velocidad con la que pasa el camino en el dibujo

interface Osc { x: number; v: number }
interface Sample { t: number; a: number; b: number; u: number }
interface Sim { t: number; a: Osc; b: Osc; hist: Sample[]; extra: number[]; nextSample: number }

/** Momentos en que la rueda entra a un pozo, cerca de t. */
function pozosCerca(t: number, extra: number[]) {
  const out: number[] = [];
  const k0 = Math.max(0, Math.floor((t - FIRST) / EVERY) - 1);
  for (let k = k0; k <= k0 + 3; k++) out.push(FIRST + k * EVERY);
  for (const e of extra) if (Math.abs(e - t) < 4) out.push(e);
  return out;
}

/** Altura del camino bajo la rueda (m, negativa en el pozo) y su derivada (m/s). */
function camino(t: number, pozos: number[]) {
  let u = 0, du = 0;
  for (const p of pozos) {
    const s = t - p;
    if (s > 0 && s < DUR) {
      u += -DEPTH * 0.5 * (1 - Math.cos((TAU * s) / DUR));
      du += -DEPTH * 0.5 * Math.sin((TAU * s) / DUR) * (TAU / DUR);
    }
  }
  return { u, du };
}

function newSim(): Sim {
  return { t: 0, a: { x: 0, v: 0 }, b: { x: 0, v: 0 }, hist: [], extra: [], nextSample: 0 };
}

export function ResorteMasa() {
  const clock = useAnimClock({ speed: 1 });
  const [D, setD] = useState(0.3);
  const [rig, setRig] = useState(25); // N/mm
  const [cargado, setCargado] = useState(false);
  const sim = useRef<Sim>(newSim());

  const m = M_BASE + (cargado ? 100 : 0);
  const c = rig * 1000; // N/m
  const w0 = Math.sqrt(c / m);
  const f0 = w0 / TAU;
  const b = 2 * D * Math.sqrt(c * m); // N·s/m

  /* ---- integración hasta el tiempo del reloj (idempotente: si ya está al día no hace nada) */
  const S = sim.current;
  if (clock.t < S.t - 1e-6) sim.current = newSim();
  const s = sim.current;
  while (s.t < clock.t) {
    const h = Math.min(H, clock.t - s.t);
    const pz = pozosCerca(s.t, s.extra);
    const { u, du } = camino(s.t, pz);
    // sin amortiguador
    const aa = (-c * (s.a.x - u)) / m;
    s.a.v += aa * h; s.a.x += s.a.v * h;
    // con amortiguador
    const ab = (-c * (s.b.x - u) - b * (s.b.v - du)) / m;
    s.b.v += ab * h; s.b.x += s.b.v * h;
    s.t += h;
    if (s.t >= s.nextSample) {
      s.hist.push({ t: s.t, a: s.a.x, b: s.b.x, u });
      s.nextSample = s.t + 1 / 50;
      while (s.hist.length && s.hist[0].t < s.t - WIN) s.hist.shift();
    }
  }
  const t = clock.t;
  const pz = pozosCerca(t, s.extra);
  const { u } = camino(t, pz);

  const pozoAhora = () => { s.extra.push(clock.t + 0.55); };

  /* ---- dibujo */
  const ROADY = 262, R = 34, BODY_TOP0 = 96, BODY_H = 44;
  const wheelY = ROADY - R - u * SY;
  const overshoot = D < 1 ? Math.exp((-Math.PI * D) / Math.sqrt(1 - D * D)) * 100 : 0;

  const roadPath = (cx: number) => {
    let d = "";
    for (let dx = -150; dx <= 150; dx += 4) {
      const h = camino(t + dx / VPX, pz).u;
      d += `${dx === -150 ? "M" : "L"}${cx + dx},${(ROADY - h * SY).toFixed(1)}`;
    }
    return d;
  };

  const quarter = (cx: number, x: number, withDamper: boolean, title: string, sub: string, color: string) => {
    const bodyTop = BODY_TOP0 - Math.max(-52, Math.min(52, x * SY)); // el dibujo se limita; el gráfico muestra el valor real
    const bodyBot = bodyTop + BODY_H;
    const tubeTop = wheelY - 66;
    return (
      <g>
        <text x={cx} y={18} textAnchor="middle" className="svg-label" style={{ fill: color, fontSize: 14 }}>{title}</text>
        <text x={cx} y={33} textAnchor="middle" className="svg-small">{sub}</text>
        {/* línea de referencia de la carrocería en reposo */}
        <line x1={cx - 105} y1={BODY_TOP0 + BODY_H / 2} x2={cx + 105} y2={BODY_TOP0 + BODY_H / 2} stroke="var(--border-strong)" strokeDasharray="3 5" />
        {/* camino */}
        <path d={`${roadPath(cx)} L${cx + 150},${ROADY + 22} L${cx - 150},${ROADY + 22} Z`} fill="var(--c-metal-dark)" opacity={0.9} />
        <path d={roadPath(cx)} fill="none" stroke="var(--c-metal-2)" strokeWidth={2} />
        {/* resorte */}
        <path d={springPath(cx - 26, bodyBot, wheelY - 12, 7, 13)} fill="none" stroke="var(--c-metal-dark)" strokeWidth={3.2} strokeLinejoin="round" />
        {/* amortiguador */}
        {withDamper ? (
          <g>
            <line x1={cx + 28} y1={bodyBot} x2={cx + 28} y2={wheelY - 30} stroke="var(--c-metal-light)" strokeWidth={5} />
            <rect x={cx + 19} y={tubeTop} width={18} height={56} rx={3} fill="var(--c-oil)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
            <line x1={cx + 28} y1={wheelY - 10} x2={cx + 28} y2={wheelY} stroke="var(--c-metal-dark)" strokeWidth={4} />
          </g>
        ) : (
          <g opacity={0.5}>
            <rect x={cx + 19} y={tubeTop} width={18} height={56} rx={3} fill="none" stroke="var(--bad)" strokeWidth={1.5} strokeDasharray="4 3" />
            <text x={cx + 45} y={tubeTop + 32} className="svg-small" style={{ fill: "var(--bad)" }}>sin</text>
          </g>
        )}
        {/* rueda */}
        <circle cx={cx} cy={wheelY} r={R} fill="var(--c-rubber)" />
        <circle cx={cx} cy={wheelY} r={R - 10} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <circle cx={cx} cy={wheelY} r={5} fill="var(--c-metal-dark)" />
        {/* carrocería (masa) */}
        <rect x={cx - 80} y={bodyTop} width={160} height={BODY_H} rx={8} fill={color} opacity={0.9} />
        <text x={cx} y={bodyTop + 27} textAnchor="middle" className="svg-label" style={{ fill: "#fff", fontSize: 13 }}>
          carrocería {m} kg
        </text>
      </g>
    );
  };

  /* ---- gráfico temporal */
  const GX = 52, GW = 650, GY = 300, GH = 120, G0 = GY + GH / 2, GS = 750;
  const tx = (ti: number) => GX + GW - ((t - ti) / WIN) * GW;
  const line = (sel: (p: Sample) => number) =>
    s.hist.map((p, i) => `${i ? "L" : "M"}${tx(p.t).toFixed(1)},${(G0 - Math.max(-0.078, Math.min(0.078, sel(p))) * GS).toFixed(1)}`).join("");

  return (
    <AnimFrame
      title="Masa, resorte y amortiguador: el mismo pozo, dos autos"
      clock={clock}
      controls={
        <>
          <button className="btn ghost sm" onClick={pozoAhora}>Pasar por un pozo</button>
          <Slider label="Amortiguamiento D (derecha)" value={D} min={0} max={1.5} step={0.05} onChange={setD} format={(v) => fmt(v, 2)} />
          <Slider label="Rigidez del resorte" value={rig} min={10} max={60} step={1} onChange={setRig} unit="N/mm" />
          <Toggle label="Auto cargado (+100 kg en esta rueda)" checked={cargado} onChange={setCargado} />
        </>
      }
      readouts={
        <>
          <Readout label="Frecuencia natural f₀" value={fmt(f0, 2)} unit="Hz" tone="accent" />
          <Readout label="Período T" value={fmt(1 / f0, 2)} unit="s" />
          <Readout label="Constante del amortiguador b" value={fmt(b, 0)} unit="N·s/m" />
          <Readout label="Rebote tras el pozo (derecha)" value={fmt(overshoot, 0)} unit="%" tone={D < 0.15 ? "bad" : D < 0.2 ? "warn" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--bad)", label: "Sin amortiguador (D = 0)" },
        { color: "var(--ok)", label: `Con amortiguador (D = ${fmt(D, 2)})` },
        { color: "var(--muted)", label: "Camino bajo la rueda" },
      ]}
      caption={
        <>
          <p>
            Cada {EVERY} s la rueda cae en un pozo de {DEPTH * 100} cm (o apretá <b>Pasar por un pozo</b>). Sin amortiguador, el resorte
            devuelve toda la energía y la carrocería <b>sigue rebotando a su frecuencia natural</b> ({fmt(f0, 2)} Hz) hasta el próximo pozo.
            Con amortiguador, esa energía se convierte en calor dentro del aceite y la oscilación se apaga.
          </p>
          <p>
            Probá D = 1 (amortiguamiento crítico): vuelve sin pasarse, pero el golpe se transmite más fuerte a la carrocería. Por eso los autos
            se ajustan alrededor de <b>D ≈ 0,2 a 0,4</b>: un poco de rebote a cambio de confort. Un amortiguador gastado baja a D ≈ 0,1 o menos.
            Endurecé el resorte o cargá el auto y mirá cómo cambia f₀ = 1/2π·√(c/m).
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 436" role="img" aria-label="Dos sistemas masa-resorte pasando por un pozo">
        {quarter(185, s.a.x, false, "Sin amortiguador", "D = 0 · rebota y rebota", "var(--bad)")}
        {quarter(535, s.b.x, true, "Con amortiguador", `D = ${fmt(D, 2)}`, "var(--ok)")}

        {/* gráfico */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <line x1={GX} y1={G0} x2={GX + GW} y2={G0} stroke="var(--border-strong)" strokeDasharray="2 4" />
        <text x={GX - 6} y={G0 + 4} textAnchor="end" className="svg-small">0</text>
        <text x={GX - 6} y={G0 - 0.05 * GS + 4} textAnchor="end" className="svg-small">+5</text>
        <text x={GX - 6} y={G0 + 0.05 * GS + 4} textAnchor="end" className="svg-small">−5</text>
        <text x={GX - 30} y={GY + 10} className="svg-small">cm</text>
        <text x={GX + 8} y={GY + 15} className="svg-small">desplazamiento de la carrocería · últimos {WIN} s</text>
        <text x={GX + GW - 6} y={GY + GH - 6} textAnchor="end" className="svg-small">ahora →</text>
        <path d={line((p) => p.u)} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={line((p) => p.a)} fill="none" stroke="var(--bad)" strokeWidth={2.2} />
        <path d={line((p) => p.b)} fill="none" stroke="var(--ok)" strokeWidth={2.6} />
      </svg>
    </AnimFrame>
  );
}
