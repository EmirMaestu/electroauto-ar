/* Onda sonora: el aire no viaja, viaja la compresión.
   Cada partícula oscila alrededor de su lugar: ξ = A·sen(ωt − kx). La presión es p ∝ −∂ξ/∂x = cos(ωt − kx).
   Velocidad del sonido constante (343 m/s a 20 °C): λ = c / f. Todo en cámara lenta. */
import { useId, useMemo, useRef, useState } from "react";
import { AnimFrame, Readout, Slider, useAnimClock, fmt, TAU } from "../ui/anim-kit";

const C = 343;           // m/s a 20 °C
const L_M = 1.0;         // metros de aire que se ven
const X0 = 86, X1 = 704; // px
const PXM = (X1 - X0) / L_M;
const SLOW = 1800;       // cámara lenta
const NC = 44, NR = 6;
const RHO = 1.2;         // kg/m³

export function OndaSonora() {
  const clock = useAnimClock({ speed: 1 });
  const [f, setF] = useState(500);
  const [dB, setDB] = useState(80);
  const ph = useRef({ t: 0, a: 0 });
  const uid = useId().replace(/:/g, "");

  if (clock.t < ph.current.t) ph.current = { t: clock.t, a: 0 };
  ph.current.a += (clock.t - ph.current.t) * (TAU * f) / SLOW;
  ph.current.t = clock.t;
  const P = ph.current.a;

  const k = (TAU * f) / C;           // rad/m
  const lambda = C / f;              // m
  const pRms = 20e-6 * 10 ** (dB / 20);
  const pPeak = pRms * Math.SQRT2;
  const xiReal = pPeak / (RHO * C * TAU * f); // m
  const A = 1.6 + ((dB - 40) / 70) * 5;       // px (exagerado)

  // posiciones de reposo con un poco de desorden (fijo)
  const rest = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let j = 0; j < NR; j++)
      for (let i = 0; i < NC; i++)
        out.push({ x: X0 + ((i + 0.5) * (X1 - X0)) / NC + (rnd() - 0.5) * 5, y: 72 + j * 22 + (rnd() - 0.5) * 8 });
    return out;
  }, []);

  const xi = (x: number) => A * Math.sin(P - k * ((x - X0) / PXM));
  const pr = (x: number) => Math.cos(P - k * ((x - X0) / PXM)); // −1..1

  // picos de compresión visibles: P − k·x = 2πn
  const peaks: number[] = [];
  for (let n = Math.floor(P / TAU) - 12; n <= Math.floor(P / TAU) + 1; n++) {
    const xm = (P - TAU * n) / k;
    if (xm >= 0 && xm <= L_M) peaks.push(X0 + xm * PXM);
  }
  peaks.sort((a, b) => a - b);

  const PY = 268, PA = 34;
  let curve = "";
  for (let x = X0; x <= X1; x += 4) curve += `${x === X0 ? "M" : "L"}${x},${(PY - PA * pr(x)).toFixed(1)}`;
  const area = `${curve} L${X1},${PY} L${X0},${PY} Z`;
  const tracked = Math.floor(NC / 2) + 2 * NC;
  const cone = A * Math.sin(P);

  const tono = f < 300 ? "grave" : f < 1200 ? "medio" : "agudo";

  return (
    <AnimFrame
      title="Onda sonora: compresiones que viajan por el aire"
      clock={clock}
      controls={
        <>
          <Slider label="Frecuencia" value={f} min={200} max={2000} step={10} onChange={setF} unit="Hz" />
          <Slider label="Nivel" value={dB} min={40} max={110} step={1} onChange={setDB} unit="dB" />
        </>
      }
      readouts={
        <>
          <Readout label="Longitud de onda λ" value={lambda >= 1 ? fmt(lambda, 2) : fmt(lambda * 100, 0)} unit={lambda >= 1 ? "m" : "cm"} tone="accent" />
          <Readout label="Período" value={fmt(1000 / f, 2)} unit="ms" />
          <Readout label="Tono" value={tono} />
          <Readout label="Presión eficaz" value={pRms < 0.1 ? fmt(pRms * 1000, 1) : fmt(pRms, 2)} unit={pRms < 0.1 ? "mPa" : "Pa"} />
          <Readout label="Desplazamiento real del aire" value={xiReal < 1e-6 ? fmt(xiReal * 1e9, 0) : fmt(xiReal * 1e6, 1)} unit={xiReal < 1e-6 ? "nm" : "µm"} />
        </>
      }
      legend={[
        { color: "var(--c-hot)", label: "Compresión (presión arriba de la atmosférica)" },
        { color: "var(--c-air)", label: "Rarefacción (presión abajo)" },
        { color: "var(--violet)", label: "Una partícula: sólo va y viene" },
      ]}
      caption={
        <>
          <p>
            El parlante empuja el aire, el aire empuja al de al lado, y así sigue: lo que viaja a <b>343 m/s</b> es la <b>compresión</b>,
            no el aire. Seguí la partícula violeta: va y viene en su lugar. Subí la frecuencia y fijate que las compresiones quedan más
            juntas (λ = c / f más corta) pero <b>avanzan a la misma velocidad</b>.
          </p>
          <p>
            Ojo con la escala: el dibujo exagera muchísimo. A {dB} dB el aire se mueve apenas{" "}
            {xiReal < 1e-6 ? `${fmt(xiReal * 1e9, 0)} nanómetros` : `${fmt(xiReal * 1e6, 1)} micrómetros`} y la presión cambia{" "}
            {pRms < 0.1 ? `${fmt(pRms * 1000, 1)} milipascales` : `${fmt(pRms, 2)} Pa`} sobre los 101.325 Pa de la atmósfera. El oído es un
            instrumento increíblemente sensible.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 330" role="img" aria-label="Onda de presión con partículas de aire">
        <defs>
          <clipPath id={`up${uid}`}><rect x={X0} y={PY - 60} width={X1 - X0} height={60} /></clipPath>
          <clipPath id={`dn${uid}`}><rect x={X0} y={PY} width={X1 - X0} height={60} /></clipPath>
        </defs>
        {/* bandas de presión en el aire */}
        {Array.from({ length: NC }, (_, i) => {
          const x = X0 + (i * (X1 - X0)) / NC;
          const p = pr(x + (X1 - X0) / NC / 2);
          return (
            <rect key={i} x={x} y={58} width={(X1 - X0) / NC + 0.5} height={136}
              fill={p > 0 ? "var(--c-hot)" : "var(--c-air)"} opacity={Math.abs(p) * 0.22} />
          );
        })}
        {/* parlante */}
        <rect x={14} y={96} width={30} height={60} rx={4} fill="var(--c-metal-dark)" />
        <path d={`M${44 + cone},86 L${70 + cone},62 L${70 + cone},190 L${44 + cone},166 Z`} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <text x={42} y={212} textAnchor="middle" className="svg-small">parlante</text>
        {/* partículas */}
        {rest.map((r, i) => (
          i === tracked ? null : <circle key={i} cx={r.x + xi(r.x)} cy={r.y} r={3} fill="var(--c-metal-dark)" opacity={0.8} />
        ))}
        {/* partícula seguida */}
        {(() => {
          const r = rest[tracked];
          return (
            <g>
              <line x1={r.x - A} y1={r.y + 9} x2={r.x + A} y2={r.y + 9} stroke="var(--violet)" strokeWidth={2} />
              <line x1={r.x} y1={r.y + 5} x2={r.x} y2={r.y + 13} stroke="var(--violet)" />
              <circle cx={r.x + xi(r.x)} cy={r.y} r={5.5} fill="var(--violet)" stroke="#fff" strokeWidth={1.5} />
            </g>
          );
        })()}
        {/* λ (escala) */}
        {lambda * PXM <= X1 - X0 ? (
          <g>
            {(() => {
              const a = (X0 + X1) / 2 - (lambda * PXM) / 2, b = (X0 + X1) / 2 + (lambda * PXM) / 2;
              return (
                <g>
                  <line x1={a} y1={44} x2={b} y2={44} stroke="var(--text)" strokeWidth={1.5} />
                  <line x1={a} y1={38} x2={a} y2={50} stroke="var(--text)" strokeWidth={1.5} />
                  <line x1={b} y1={38} x2={b} y2={50} stroke="var(--text)" strokeWidth={1.5} />
                  <text x={(a + b) / 2} y={33} textAnchor="middle" className="svg-label">longitud de onda λ = {lambda >= 1 ? `${fmt(lambda, 2)} m` : `${fmt(lambda * 100, 0)} cm`}</text>
                </g>
              );
            })()}
          </g>
        ) : (
          <text x={(X0 + X1) / 2} y={38} textAnchor="middle" className="svg-label">λ = {fmt(lambda, 2)} m: más larga que el metro de aire dibujado</text>
        )}
        <text x={X1} y={210} textAnchor="end" className="svg-small">1 metro de aire →</text>
        {/* presión vs distancia */}
        <text x={X0} y={PY + PA + 22} className="svg-small">presión a lo largo del aire, en este instante</text>
        <path d={area} fill="var(--c-hot)" opacity={0.25} clipPath={`url(#up${uid})`} />
        <path d={area} fill="var(--c-air)" opacity={0.25} clipPath={`url(#dn${uid})`} />
        <line x1={X0} y1={PY} x2={X1} y2={PY} stroke="var(--border-strong)" />
        <path d={curve} fill="none" stroke="var(--text)" strokeWidth={2} />
        <text x={X0 - 8} y={PY - PA + 4} textAnchor="end" className="svg-small" style={{ fill: "var(--c-hot)" }}>+ p</text>
        <text x={X0 - 8} y={PY + 4} textAnchor="end" className="svg-small">p atm</text>
        <text x={X0 - 8} y={PY + PA + 4} textAnchor="end" className="svg-small" style={{ fill: "var(--c-air)" }}>− p</text>
        {peaks.slice(0, 1).map((x) => (
          <text key={x} x={x} y={PY - PA - 8} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-hot)", fontWeight: 700 }}>compresión</text>
        ))}
      </svg>
    </AnimFrame>
  );
}
