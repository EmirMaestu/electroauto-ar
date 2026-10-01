/* Resonancia: rueda desbalanceada sobre su suspensión.
   El desbalance genera una fuerza que gira con la rueda (F = m·r·ω²). La rueda + suspensión tiene
   una frecuencia natural f₀; cuando el giro de la rueda coincide con f₀, la vibración se dispara.
   Amplitud de un sistema excitado por masa desbalanceada:
     X = (m·r/M) · η² / √((1−η²)² + (2Dη)²),   η = f/f₀,   desfasaje φ = atan(2Dη / (1−η²)). */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, plotPath, springPath, fmt, TAU, clamp } from "../ui/anim-kit";

const DIAM = 0.62;   // m: diámetro de una cubierta 195/60 R15 aprox.
const F0 = 15.5;     // Hz: frecuencia natural de la rueda sobre su suspensión (típico 10–16 Hz)
const MASA = 45;     // kg: masa que vibra (rueda, freno, mangueta, parte del brazo)
const R_PESA = 0.19; // m: radio donde está el desbalance (borde de la llanta)
const SLOW = 24;     // cámara lenta del dibujo

const kmhAt = (f: number) => f * Math.PI * DIAM * 3.6;
const amplif = (eta: number, D: number) => (eta * eta) / Math.sqrt((1 - eta * eta) ** 2 + (2 * D * eta) ** 2);

export function Resonancia() {
  const clock = useAnimClock({ speed: 1 });
  const [v, setV] = useState(70);
  const [D, setD] = useState(0.12);
  const [grams, setGrams] = useState(30);
  const ph = useRef({ t: 0, a: 0 });

  const f = v / 3.6 / (Math.PI * DIAM); // Hz de giro de la rueda
  const eta = f / F0;
  const A = amplif(eta, D);
  const phi = Math.atan2(2 * D * eta, 1 - eta * eta);
  const X = ((grams / 1000) * R_PESA / MASA) * A; // m
  const Xmm = X * 1000;
  const w = TAU * f;
  const Fdes = (grams / 1000) * R_PESA * w * w;
  const vRes = kmhAt(F0);

  // fase acumulada de la rueda (en cámara lenta) → no salta al mover el slider
  if (clock.t < ph.current.t) ph.current = { t: clock.t, a: 0 };
  ph.current.a += (clock.t - ph.current.t) * (TAU * f) / SLOW;
  ph.current.t = clock.t;
  const theta = -ph.current.a; // gira en sentido horario (auto yendo a la derecha)

  /* ---- dibujo de la rueda */
  const CX = 175, CY0 = 250, RT = 80, RR = 54;
  const PXMM = 34;
  const dy = clamp(Xmm * PXMM, 0, 58) * Math.sin(theta - phi); // hacia arriba positivo
  const CY = CY0 - dy;
  const pesa = { x: CX + (RR - 4) * Math.cos(theta), y: CY - (RR - 4) * Math.sin(theta) };
  const spokes = [0, 1, 2, 3, 4].map((i) => theta + (i * TAU) / 5);
  const steer = clamp(Xmm * 7, 0, 14) * Math.sin(theta - phi); // grados de "temblor" del volante (exagerado)

  /* ---- gráfico */
  const GX = 372, GY = 40, GW = 320, GH = 250, YMAX = 7;
  const mx = (kmh: number) => GX + (kmh / 180) * GW;
  const my = (a: number) => GY + GH - (Math.min(a, YMAX) / YMAX) * GH;
  const curve = (d: number) => plotPath((kmh) => amplif(kmh / 3.6 / (Math.PI * DIAM) / F0, d), 0, 180, 180, mx, my);
  const tone = A > 3 ? "bad" : A > 1.6 ? "warn" : "ok";

  return (
    <AnimFrame
      title="Resonancia: la rueda desbalanceada que hace temblar el volante"
      clock={clock}
      controls={
        <>
          <Slider label="Velocidad" value={v} min={0} max={180} step={1} onChange={setV} unit="km/h" />
          <Slider label="Amortiguamiento D" value={D} min={0.05} max={0.6} step={0.01} onChange={setD} format={(x) => fmt(x, 2)} />
          <Seg value={grams} onChange={setGrams} ariaLabel="Desbalance"
            options={[{ value: 5, label: "Balanceada (5 g)" }, { value: 30, label: "30 g" }, { value: 60, label: "Perdió una pesa (60 g)" }]} />
        </>
      }
      readouts={
        <>
          <Readout label="Giro de la rueda" value={fmt(f, 1)} unit="Hz" />
          <Readout label="f / f₀" value={fmt(eta, 2)} tone={Math.abs(eta - 1) < 0.12 ? "bad" : undefined} />
          <Readout label="Fuerza del desbalance" value={fmt(Fdes, 0)} unit="N" />
          <Readout label="Vibración de la rueda" value={fmt(Xmm, 2)} unit="mm" tone={tone} />
        </>
      }
      legend={[
        { color: "var(--accent)", label: `Respuesta con D = ${fmt(D, 2)}` },
        { color: "var(--muted)", label: "Referencias D = 0,08 y D = 0,40" },
        { color: "var(--bad)", label: "Pesa / desbalance" },
      ]}
      caption={
        <>
          <p>
            La rueda gira <b>{fmt(f, 1)} veces por segundo</b> a {v} km/h, y el desbalance tira de ella hacia afuera en cada vuelta. La rueda,
            colgada de su resorte, tiene una frecuencia natural de unos <b>{fmt(F0, 1)} Hz</b>: cuando el giro coincide con ella
            (≈ {fmt(vRes, 0)} km/h) la vibración <b>se dispara</b> y la sentís en el volante. Pasada esa velocidad, se calma un poco aunque
            vayas más rápido: es la clásica &quot;vibra entre 100 y 120 y después se va&quot;.
          </p>
          <p>
            Bajá el amortiguamiento (amortiguador gastado) y mirá cómo el pico se hace angosto y altísimo. Balanceá la rueda y la fuerza
            casi desaparece: sin excitación no hay resonancia, aunque la frecuencia coincida. El dibujo va en cámara lenta y el movimiento está
            exagerado (en la realidad son décimas de milímetro).
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 360" role="img" aria-label="Rueda desbalanceada y curva de resonancia">
        {/* chasis */}
        <rect x={70} y={44} width={210} height={20} rx={4} fill="var(--c-metal-dark)" />
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={76 + i * 19} y1={44} x2={86 + i * 19} y2={34} stroke="var(--c-metal-2)" strokeWidth={1.5} />
        ))}
        <text x={175} y={28} textAnchor="middle" className="svg-small">carrocería (casi quieta)</text>
        {/* suspensión: resorte + amortiguador hasta la mangueta */}
        <path d={springPath(150, 64, CY - 24, 6, 12)} fill="none" stroke="var(--c-metal-dark)" strokeWidth={3} strokeLinejoin="round" />
        <line x1={203} y1={64} x2={203} y2={CY - 40} stroke="var(--c-metal-light)" strokeWidth={5} />
        <rect x={195} y={CY - 98} width={16} height={74} rx={3} fill="var(--c-oil)" stroke="var(--c-metal-dark)" />
        {/* rueda */}
        <circle cx={CX} cy={CY} r={RT} fill="var(--c-rubber)" />
        {Array.from({ length: 24 }, (_, i) => {
          const a = theta + (i * TAU) / 24;
          return <line key={i} x1={CX + (RT - 9) * Math.cos(a)} y1={CY - (RT - 9) * Math.sin(a)} x2={CX + RT * Math.cos(a)} y2={CY - RT * Math.sin(a)} stroke="var(--c-metal-dark)" strokeWidth={2} />;
        })}
        <circle cx={CX} cy={CY} r={RR} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {spokes.map((a, i) => (
          <line key={i} x1={CX + 12 * Math.cos(a)} y1={CY - 12 * Math.sin(a)} x2={CX + (RR - 6) * Math.cos(a)} y2={CY - (RR - 6) * Math.sin(a)} stroke="var(--c-metal-2)" strokeWidth={8} strokeLinecap="round" />
        ))}
        <circle cx={CX} cy={CY} r={13} fill="var(--c-metal-dark)" />
        {grams > 5 && (
          <g>
            <circle cx={pesa.x} cy={pesa.y} r={grams > 40 ? 8 : 6} fill="var(--bad)" stroke="#fff" strokeWidth={1.5} />
          </g>
        )}
        {/* marca de posición en reposo */}
        <line x1={CX + RT + 8} y1={CY0} x2={CX + RT + 30} y2={CY0} stroke="var(--muted)" strokeDasharray="3 3" />
        <line x1={CX + RT + 8} y1={CY} x2={CX + RT + 30} y2={CY} stroke="var(--accent)" strokeWidth={2} />
        <text x={CX + RT + 34} y={CY0 + 4} className="svg-small">reposo</text>
        <text x={CX} y={352} textAnchor="middle" className="svg-small">movimiento exagerado · cámara lenta</text>

        {/* volante que tiembla */}
        <g transform={`rotate(${steer.toFixed(2)} 312 140)`}>
          <circle cx={312} cy={140} r={26} fill="none" stroke="var(--c-rubber)" strokeWidth={7} />
          <line x1={286} y1={140} x2={338} y2={140} stroke="var(--c-rubber)" strokeWidth={6} />
          <line x1={312} y1={140} x2={312} y2={166} stroke="var(--c-rubber)" strokeWidth={6} />
          <circle cx={312} cy={140} r={8} fill="var(--c-metal-dark)" />
        </g>
        <text x={312} y={186} textAnchor="middle" className="svg-small">volante</text>

        {/* curva de respuesta */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX} y={GY - 14} className="svg-title" style={{ fontSize: 13 }}>Vibración según la velocidad</text>
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <g key={k}>
            <line x1={GX} y1={my(k)} x2={GX + GW} y2={my(k)} stroke="var(--border)" strokeDasharray="2 5" />
            <text x={GX - 6} y={my(k) + 4} textAnchor="end" className="svg-small">{k}×</text>
          </g>
        ))}
        {[0, 30, 60, 90, 120, 150, 180].map((k) => (
          <text key={k} x={mx(k)} y={GY + GH + 16} textAnchor="middle" className="svg-small">{k}</text>
        ))}
        <text x={GX + GW} y={GY + GH + 32} textAnchor="end" className="svg-small">km/h</text>
        <line x1={mx(vRes)} y1={GY} x2={mx(vRes)} y2={GY + GH} stroke="var(--bad)" strokeDasharray="5 4" opacity={0.7} />
        <text x={mx(vRes) + 5} y={GY + 16} className="svg-small" style={{ fill: "var(--bad)" }}>f = f₀ ≈ {fmt(vRes, 0)} km/h</text>
        <path d={curve(0.08)} fill="none" stroke="var(--muted)" strokeWidth={1.2} strokeDasharray="4 3" />
        <path d={curve(0.4)} fill="none" stroke="var(--muted)" strokeWidth={1.2} strokeDasharray="4 3" />
        <path d={curve(D)} fill="none" stroke="var(--accent)" strokeWidth={3} />
        <line x1={mx(v)} y1={GY} x2={mx(v)} y2={GY + GH} stroke="var(--text)" opacity={0.35} />
        <circle cx={mx(v)} cy={my(A)} r={7} fill="var(--accent)" stroke="#fff" strokeWidth={2} />
        <text x={GX + 8} y={GY + 16} className="svg-small">amplificación (veces el desbalance)</text>
      </svg>
    </AnimFrame>
  );
}
