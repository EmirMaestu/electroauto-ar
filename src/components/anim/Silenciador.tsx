/* Silenciador: simulación acústica 1D de verdad (ondas de presión en un tubo de sección variable).
   Ecuaciones linealizadas en diferencias finitas (malla escalonada):
     ∂u/∂t = −∂p/∂x        ∂p/∂t = −(1/A)·∂(A·u)/∂x
   En cada cambio de sección parte de la onda se refleja (cámara de expansión) y en la fibra se
   amortigua (absorción). La energía que sale por la cola (y por el agujero, si está roto) se compara
   con la que entra del motor. */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, fmt, clamp } from "../ui/anim-kit";

type Modo = "directo" | "silenciador" | "roto";
const N = 240;          // celdas
const CFL = 0.9;
const SPS = 80;         // pasos de simulación por segundo de animación
const HIST = 300;       // muestras guardadas para los gráficos
const EWIN = 520;       // pasos guardados para promediar la energía (se usan 2 períodos)
const C1 = [50, 110];   // cámara de reflexión
const C2 = [130, 190];  // cámara con fibra
const HOLE = [76, 84];  // agujero (silenciador roto)

interface Sim {
  modo: Modo; n: number; p: Float64Array; u: Float64Array;
  A: Float64Array; Af: Float64Array; sig: Float64Array; leak: Float64Array;
  hin: number[]; hout: number[]; eOut: number[]; eHole: number[]; holeP: number; steps: number;
}

function newSim(modo: Modo): Sim {
  const A = new Float64Array(N).fill(1), sig = new Float64Array(N), leak = new Float64Array(N);
  if (modo !== "directo") {
    for (let i = C1[0]; i < C1[1]; i++) A[i] = 9;
    for (let i = C2[0]; i < C2[1]; i++) { A[i] = 5; if (modo === "silenciador") sig[i] = 0.02; }
    if (modo === "roto") for (let i = HOLE[0]; i < HOLE[1]; i++) leak[i] = 0.3;
  }
  const Af = new Float64Array(N + 1);
  for (let i = 1; i < N; i++) Af[i] = Math.min(A[i - 1], A[i]);
  Af[0] = A[0]; Af[N] = A[N - 1];
  return { modo, n: 0, p: new Float64Array(N), u: new Float64Array(N + 1), A, Af, sig, leak, hin: [], hout: [], eOut: [], eHole: [], holeP: 0, steps: 0 };
}

/** Pulso de escape: medio seno de ancho W cada PER pasos. */
function pulso(n: number, per: number) {
  const w = Math.max(6, Math.round(per * 0.35));
  const ph = n % per;
  return ph < w ? Math.sin((Math.PI * ph) / w) : 0;
}

function paso(s: Sim, per: number) {
  const { p, u, A, Af, sig, leak } = s;
  const src = pulso(s.n, per);
  u[0] = 2 * src - p[0];                       // entra la onda del motor, sale la reflejada
  for (let i = 1; i < N; i++) u[i] -= CFL * (p[i] - p[i - 1]);
  u[N] = p[N - 1];                              // cola: la onda sale al aire sin volver
  let hole = 0;
  for (let i = 0; i < N; i++) {
    p[i] -= (CFL * (Af[i + 1] * u[i + 1] - Af[i] * u[i])) / A[i];
    if (sig[i]) p[i] *= 1 - sig[i];
    if (leak[i]) { const o = p[i]; p[i] *= 1 - leak[i]; hole += (A[i] * (o * o - p[i] * p[i])) / 2; }
  }
  // energía que sale por la cola y por el agujero en cada paso (ventana deslizante)
  s.eOut.push(A[N - 1] * p[N - 1] * p[N - 1]); s.eHole.push(hole);
  if (s.eOut.length > EWIN) { s.eOut.shift(); s.eHole.shift(); }
  s.holeP = s.holeP * 0.9 + Math.abs(p[(HOLE[0] + HOLE[1]) >> 1]) * 0.1;
  s.hin.push(p[3]); s.hout.push(p[N - 4]);
  if (s.hin.length > HIST) { s.hin.shift(); s.hout.shift(); }
  s.n++; s.steps++;
}

export function Silenciador() {
  const clock = useAnimClock({ speed: 1 });
  const [modo, setModo] = useState<Modo>("silenciador");
  const [rpm, setRpm] = useState(2000);
  const sim = useRef<Sim>(newSim("silenciador"));
  const per = Math.round((100 * 2000) / rpm);

  const target = Math.floor(clock.t * SPS);
  if (sim.current.modo !== modo || target < sim.current.n - 1) {
    sim.current = newSim(modo);
    sim.current.n = Math.max(0, target - 1);
  }
  const s = sim.current;
  let guard = 0;
  while (s.n < target && guard++ < 400) paso(s, per);
  if (s.n < target) s.n = target; // si la pestaña estuvo frenada, no recuperar todo de golpe

  // energía media que entra (pulso de medio seno: ancho/2 por período) contra la que sale
  const w = Math.max(6, Math.round(per * 0.35));
  const eSrc = w / 2 / per;
  const win = Math.min(EWIN, 2 * per);
  const mean = (a: number[]) => { const b = a.slice(-win); return b.reduce((x, y) => x + y, 0) / Math.max(1, b.length); };
  const eOut = mean(s.eOut), eHole = mean(s.eHole);
  const warm = s.steps > N / CFL + win; // los pulsos tienen que recorrer todo el escape antes de medir
  const rel = 10 * Math.log10(Math.max(1e-6, (eOut + eHole) / eSrc));
  const fromHole = eHole / (eOut + eHole + 1e-12);

  /* ---- dibujo */
  const X0 = 40, X1 = 690, CY = 128;
  const cx = (i: number) => X0 + ((X1 - X0) * i) / N;
  const hh = (a: number) => 8 * Math.sqrt(a);
  const LY = 68, LS = 26;
  let pline = "";
  for (let i = 0; i < N; i += 2) pline += `${i ? "L" : "M"}${cx(i + 0.5).toFixed(1)},${(LY - clamp(s.p[i], -1.3, 1.3) * LS).toFixed(1)}`;

  const slices = [];
  for (let i = 0; i < N; i += 2) {
    const pv = (s.p[i] + s.p[i + 1]) / 2;
    const h = hh(s.A[i]);
    const op = Math.min(1, Math.pow(Math.abs(pv), 0.6) * 0.95);
    slices.push(
      <rect key={i} x={cx(i)} y={CY - h} width={cx(2) - cx(0) + 0.4} height={2 * h}
        fill={pv > 0 ? "var(--c-hot)" : "var(--c-air)"} opacity={op} />,
    );
  }
  const chamber = (a: number[], area: number, label: string, sub: string) => (
    <g>
      <rect x={cx(a[0]) - 3} y={CY - hh(area) - 4} width={cx(a[1]) - cx(a[0]) + 6} height={2 * hh(area) + 8} rx={8}
        fill="var(--c-exhaust)" opacity={0.18} stroke="var(--c-metal-dark)" strokeWidth={3} />
      <text x={(cx(a[0]) + cx(a[1])) / 2} y={CY + hh(9) + 24} textAnchor="middle" className="svg-label">{label}</text>
      <text x={(cx(a[0]) + cx(a[1])) / 2} y={CY + hh(9) + 38} textAnchor="middle" className="svg-small">{sub}</text>
    </g>
  );

  /* gráficos */
  const GY = 236, GH = 110, GW = 300;
  const trace = (h: number[], gx: number) => {
    const n = h.length;
    return h.map((v, i) => `${i ? "L" : "M"}${(gx + GW - ((n - 1 - i) / (HIST - 1)) * GW).toFixed(1)},${(GY + GH / 2 - clamp(v, -1.4, 1.4) * 38).toFixed(1)}`).join("");
  };

  return (
    <AnimFrame
      title="El silenciador por dentro: reflejar, mezclar y absorber"
      clock={clock}
      controls={
        <>
          <Seg value={modo} onChange={setModo} ariaLabel="Escape"
            options={[{ value: "directo", label: "Caño directo" }, { value: "silenciador", label: "Con silenciador" }, { value: "roto", label: "Silenciador agujereado" }]} />
          <Slider label="RPM" value={rpm} min={800} max={5000} step={100} onChange={setRpm} />
        </>
      }
      readouts={
        <>
          <Readout label="Ruido que sale vs caño directo" value={!warm ? "…" : rel > -0.5 ? "0" : fmt(rel, 0)} unit="dB" tone={!warm ? undefined : rel > -6 ? "bad" : rel > -12 ? "warn" : "ok"} />
          <Readout label="Energía que sale" value={warm ? fmt(Math.min(100, 100 * 10 ** (rel / 10)), 0) : "…"} unit="%" />
          {modo === "roto" && <Readout label="Sale por el agujero" value={warm ? fmt(fromHole * 100, 0) : "…"} unit="% del ruido" tone="bad" />}
          <Readout label="Pulsos de escape" value={fmt((rpm / 60) * 2, 0)} unit="por segundo (4 cil.)" />
        </>
      }
      legend={[
        { color: "var(--c-hot)", label: "Presión arriba de la atmosférica" },
        { color: "var(--c-air)", label: "Presión abajo (depresión)" },
        { color: "var(--c-exhaust)", label: "Cuerpo del silenciador" },
      ]}
      caption={
        <>
          <p>
            Cada vez que se abre una válvula de escape sale un <b>golpe de presión</b>. Con caño directo, ese golpe llega entero al aire:
            es el &quot;tronar&quot; de un escape libre. En la <b>cámara de reflexión</b>, el caño se ensancha de golpe: buena parte del pulso
            rebota hacia atrás y el resto se reparte y se &quot;estira&quot;, rebotando entre las paredes (fijate la onda azul que vuelve).
            En la <b>cámara con fibra</b>, el gas pasa por un tubo perforado rodeado de lana mineral que convierte la vibración en calor.
          </p>
          <p>
            Con el silenciador agujereado, la presión <b>se escapa por el agujero</b> antes de llegar a la fibra: el ruido sale casi todo por
            ahí. Simulación acústica simplificada, en cámara muy lenta: la proporción es lo que importa, no los valores exactos.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 390" role="img" aria-label="Pulsos de presión dentro de un silenciador">
        {/* presión a lo largo del escape */}
        <text x={X0} y={26} className="svg-small">presión a lo largo del escape</text>
        <line x1={X0} y1={LY} x2={X1} y2={LY} stroke="var(--border-strong)" strokeDasharray="2 4" />
        <path d={pline} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {/* caño + cámaras */}
        <rect x={X0} y={CY - hh(1) - 3} width={X1 - X0} height={2 * hh(1) + 6} fill="var(--c-metal-dark)" />
        {modo !== "directo" && chamber(C1, 9, "Cámara de reflexión", "el pulso rebota y se reparte")}
        {modo !== "directo" && chamber(C2, 5, modo === "roto" ? "Fibra quemada" : "Cámara con fibra", modo === "roto" ? "ya no absorbe" : "tubo perforado + lana mineral")}
        <rect x={X0} y={CY - hh(1)} width={X1 - X0} height={2 * hh(1)} fill="var(--c-exhaust)" opacity={0.15} />
        {modo !== "directo" && <rect x={cx(C1[0])} y={CY - hh(9)} width={cx(C1[1]) - cx(C1[0])} height={2 * hh(9)} fill="var(--c-exhaust)" opacity={0.12} />}
        {slices}
        {modo === "silenciador" && Array.from({ length: 14 }, (_, i) => (
          <g key={i}>
            <circle cx={cx(C2[0] + 2 + i * 4.2)} cy={CY - hh(5) + 4} r={1.6} fill="var(--c-flame)" opacity={0.8} />
            <circle cx={cx(C2[0] + 4 + i * 4.2)} cy={CY + hh(5) - 4} r={1.6} fill="var(--c-flame)" opacity={0.8} />
          </g>
        ))}
        {modo !== "directo" && (
          <g>
            <line x1={cx(C1[1])} y1={CY - hh(9)} x2={cx(C1[1])} y2={CY - hh(1)} stroke="var(--c-metal-dark)" strokeWidth={3} />
            <line x1={cx(C1[1])} y1={CY + hh(1)} x2={cx(C1[1])} y2={CY + hh(9)} stroke="var(--c-metal-dark)" strokeWidth={3} />
          </g>
        )}
        {modo === "roto" && (
          <g>
            <rect x={cx(HOLE[0])} y={CY - hh(9) - 6} width={cx(HOLE[1]) - cx(HOLE[0])} height={9} fill="var(--surface)" />
            {[0, 1, 2].map((k) => {
              const f = ((clock.t * 1.4 + k / 3) % 1);
              return <circle key={k} cx={(cx(HOLE[0]) + cx(HOLE[1])) / 2 + (k - 1) * 6} cy={CY - hh(9) - 10 - f * 34} r={4 + f * 10}
                fill="var(--c-exhaust)" opacity={Math.min(0.8, s.holeP * 3) * (1 - f)} />;
            })}
            <text x={(cx(HOLE[0]) + cx(HOLE[1])) / 2 + 16} y={CY - hh(9) - 18} className="svg-label" style={{ fill: "var(--bad)" }}>agujero</text>
          </g>
        )}
        <text x={X0} y={CY + 40} className="svg-small">← del motor</text>
        <text x={X1} y={CY + 40} textAnchor="end" className="svg-small">al aire →</text>

        {/* entrada y salida */}
        {[
          { h: s.hin, gx: 40, t: "Presión a la entrada (motor)", note: "incluye lo que rebota" },
          { h: s.hout, gx: 390, t: "Presión en la cola (lo que oís)", note: "" },
        ].map((g) => (
          <g key={g.gx}>
            <rect x={g.gx} y={GY} width={GW} height={GH} rx={8} fill="var(--scope-bg)" />
            <line x1={g.gx} y1={GY + GH / 2} x2={g.gx + GW} y2={GY + GH / 2} stroke="var(--scope-grid)" />
            <path d={trace(g.h, g.gx)} fill="none" stroke="var(--c-signal)" strokeWidth={2} />
            <text x={g.gx} y={GY - 8} className="svg-label">{g.t}</text>
            {g.note && <text x={g.gx + GW} y={GY - 8} textAnchor="end" className="svg-small">{g.note}</text>}
          </g>
        ))}
        <text x={X1} y={GY + GH + 20} textAnchor="end" className="svg-small">misma escala en los dos · últimos segundos →</text>
      </svg>
    </AnimFrame>
  );
}
