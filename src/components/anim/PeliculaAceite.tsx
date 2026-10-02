/* Película hidrodinámica en un metal (cojinete de deslizamiento).
   Teoría del cojinete corto (Ocvirk): con la carga W, la velocidad y la viscosidad se resuelve la excentricidad ε;
   el espesor mínimo es h_min = c·(1 − ε) y el muñón se corre un ángulo φ en el sentido de giro.
   Metal de 48 mm de diámetro, 18 mm de ancho y 25 µm de luz radial (0,05 mm diametral). */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Seg, useAnimClock, Arrow, plotPath, clamp, fmt, TAU } from "../ui/anim-kit";

const R_M = 0.024, L_M = 0.018, C_M = 25e-6;
const OILS = [
  { id: "0W-20", mu100: 7.2 },
  { id: "5W-30", mu100: 8.9 },
  { id: "10W-40", mu100: 11.9 },
  { id: "20W-50", mu100: 15.3 },
];

const loadFn = (e: number) => (e * Math.sqrt(Math.PI ** 2 * (1 - e * e) + 16 * e * e)) / (1 - e * e) ** 2;
function solveEps(sInv: number) {
  let lo = 0, hi = 0.99999;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (loadFn(mid) < sInv) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** forma de la presión (sin dimensiones) en el plano medio, θ desde el espesor máximo */
const pShape = (th: number, e: number) => (th > 0 && th < Math.PI ? (e * Math.sin(th)) / (1 + e * Math.cos(th)) ** 3 : 0);

export function PeliculaAceite() {
  const clock = useAnimClock({ speed: 1 });
  const [W, setW] = useState(12); // kN
  const [rpm, setRpm] = useState(2500);
  const [tOil, setTOil] = useState(110);
  const [oil, setOil] = useState("5W-30");
  const st = useRef({ last: clock.t, rot: 0, flow: 0 });
  const s = st.current;
  let dt = clock.t - s.last;
  if (dt < 0) dt = 0;
  s.last = clock.t;
  dt = Math.min(dt, 0.1);

  const mu = ((OILS.find((o) => o.id === oil)?.mu100 ?? 8.9) * Math.exp(-0.025 * (tOil - 100))) / 1000; // Pa·s
  const omega = (rpm / 60) * TAU;
  const U = omega * R_M;
  const sInv = (W * 1000 * 4 * C_M * C_M) / (mu * U * L_M ** 3);
  const eps = solveEps(sInv);
  const hMin = C_M * (1 - eps) * 1e6; // µm
  const phi = Math.atan2(Math.PI * Math.sqrt(1 - eps * eps), 4 * eps);
  const p0 = (3 * mu * omega * L_M * L_M) / (4 * C_M * C_M); // Pa
  let gMax = 0, thMax = Math.PI;
  for (let i = 1; i < 360; i++) {
    const th = (i / 360) * Math.PI;
    const g = pShape(th, eps);
    if (g > gMax) { gMax = g; thMax = th; }
  }
  const pMax = (p0 * gMax) / 1e6; // MPa
  const regime = hMin < 1 ? "bad" : hMin < 2 ? "warn" : "ok";

  // ------------------------------------------------------------ dibujo
  const CX = 200, CY = 210, RB = 150, CPX = 20;
  const RJ = RB - CPX;
  const alpha = -Math.PI / 2 + phi; // dirección (matemática) del desplazamiento del muñón
  const jx = CX + eps * CPX * Math.cos(alpha);
  const jy = CY - eps * CPX * Math.sin(alpha);
  const P = (ang: number, r: number, cx = CX, cy = CY) => ({ x: cx + r * Math.cos(ang), y: cy - r * Math.sin(ang) });
  // punto de la superficie del muñón en la dirección ψ (aprox. radial desde el centro del metal)
  const thOf = (psi: number) => {
    const v = (psi - (alpha + Math.PI)) % TAU;
    return v < 0 ? v + TAU : v;
  };

  s.rot += (rpm / 600) * dt;
  s.flow += (rpm / 1200) * dt;

  const N = 90;
  const segs = Array.from({ length: N }, (_, i) => {
    const a0 = (i / N) * TAU, a1 = ((i + 1) / N) * TAU;
    const th = thOf((a0 + a1) / 2);
    const pn = gMax > 0 ? pShape(th, eps) / gMax : 0;
    if (pn < 0.02) return null;
    const b0 = P(a0, RB), b1 = P(a1, RB);
    const j0 = P(a0, RJ, jx, jy), j1 = P(a1, RJ, jx, jy);
    return <path key={i} d={`M${b0.x},${b0.y} L${b1.x},${b1.y} L${j1.x},${j1.y} L${j0.x},${j0.y} Z`} fill={regime === "bad" && pn > 0.6 ? "var(--bad)" : "var(--c-hot)"} opacity={0.15 + 0.85 * pn} />;
  });

  // "lóbulo" de presión dibujado hacia adentro del muñón (como un diagrama polar)
  const lobe = (() => {
    const out: string[] = [], back: string[] = [];
    for (let k = 0; k <= 120; k++) {
      const th = (k / 120) * Math.PI;
      const psi = alpha + Math.PI + th;
      const pn = gMax > 0 ? pShape(th, eps) / gMax : 0;
      const a = P(psi, RJ - 3 - 84 * pn, jx, jy), b = P(psi, RJ - 3, jx, jy);
      out.push(`${k ? "L" : "M"}${a.x.toFixed(1)},${a.y.toFixed(1)}`);
      back.unshift(`L${b.x.toFixed(1)},${b.y.toFixed(1)}`);
    }
    return out.join(" ") + " " + back.join(" ") + " Z";
  })();
  const arrows = Array.from({ length: 48 }, (_, i) => {
    const psi = (i / 48) * TAU;
    const pn = gMax > 0 ? pShape(thOf(psi), eps) / gMax : 0;
    if (pn < 0.12) return null;
    const len = 8 + 76 * pn;
    const a = P(psi, RJ - 4, jx, jy);
    const b = P(psi, RJ - 4 - len, jx, jy);
    return <Arrow key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} color="var(--c-hot)" width={2} head={7} opacity={0.9} />;
  });

  // partículas de aceite en la luz (giran con el muñón, a la mitad de su velocidad)
  const oilDots = Array.from({ length: 48 }, (_, i) => {
    const psi = (i / 48) * TAU + s.flow;
    const th = thOf(psi);
    const h = 1 + eps * Math.cos(th); // espesor local relativo a la luz
    // punto medio entre la superficie del metal y la del muñón
    const sb = P(psi, RB), sj = P(psi, RJ, jx, jy);
    return <circle key={i} cx={(sb.x + sj.x) / 2} cy={(sb.y + sj.y) / 2} r={clamp(1 + h * 1.6, 1, 3.4)} fill="var(--c-oil)" opacity={0.9} />;
  });

  const minPt = P(alpha, RB);
  const minPtJ = P(alpha, RJ, jx, jy);

  // gráficos de la derecha
  const GX = 440, GW = 262;
  const H1 = { y: 50, h: 120 }, H2 = { y: 222, h: 120 };
  const mx = (th: number) => GX + (th / TAU) * GW;
  const myH = (hum: number) => H1.y + H1.h - (hum / 50) * H1.h;
  const pScale = Math.max(50, Math.ceil(pMax / 50) * 50);
  const myP = (mpa: number) => H2.y + H2.h - (clamp(mpa, 0, pScale) / pScale) * H2.h;
  const hPath = plotPath((th) => C_M * (1 + eps * Math.cos(th)) * 1e6, 0, TAU, 120, mx, myH);
  const pPath = plotPath((th) => (p0 * pShape(th, eps)) / 1e6, 0, TAU, 180, mx, myP);

  return (
    <AnimFrame
      title="La película de aceite: el cigüeñal flota, no apoya"
      clock={clock}
      controls={
        <>
          <Slider label="Carga" value={W} min={1} max={40} step={1} unit="kN" onChange={setW} />
          <Slider label="RPM" value={rpm} min={100} max={6000} step={100} onChange={setRpm} />
          <Slider label="Temp. aceite" value={tOil} min={40} max={150} step={1} unit="°C" onChange={setTOil} />
          <Seg value={oil} onChange={setOil} ariaLabel="Aceite" options={OILS.map((o) => ({ value: o.id, label: o.id }))} />
        </>
      }
      readouts={
        <>
          <Readout label="Espesor mínimo" value={fmt(hMin, hMin < 10 ? 1 : 0)} unit="µm" tone={regime} />
          <Readout label="Excentricidad" value={fmt(eps * 100, 0)} unit="%" />
          <Readout label="Presión máx." value={fmt(pMax, 0)} unit="MPa" tone="accent" />
          <Readout label="Viscosidad" value={fmt(mu * 1000, 1)} unit="mPa·s" />
          <Readout label="Régimen" value={regime === "ok" ? "flota" : regime === "warn" ? "mixto" : "¡roza!"} tone={regime} />
        </>
      }
      legend={[
        { color: "var(--c-oil)", label: "Aceite" },
        { color: "var(--c-hot)", label: "Presión en la película" },
        { color: "var(--c-metal-light)", label: "Metal (cojinete)" },
        { color: "var(--c-metal-2)", label: "Muñón" },
      ]}
      caption={
        <>
          <p>
            El muñón gira y <b>arrastra aceite</b> hacia la zona donde la luz se achica (la <b>cuña</b>). Como el aceite no tiene por dónde
            escapar tan rápido, se le sube la presión —decenas de MPa, cientos de veces más que el manómetro del tablero— y esa presión
            levanta el eje. El muñón no queda abajo de todo: se corre un poco <b>en el sentido de giro</b>. La luz está dibujada unas 130
            veces más grande de lo real (es de 0,02–0,03 mm por lado).
          </p>
          <p>
            Más carga o menos vueltas → el muñón se acerca al metal. Aceite más caliente o más finito → también. Si el espesor mínimo baja
            de ~1 µm, las rugosidades se tocan: <b>metal contra metal</b>. Fijate que con 100–300 rpm (dando arranque) casi no hay película:
            por eso la mayor parte del desgaste pasa en los arranques en frío.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 420" role="img" aria-label="Corte de un cojinete con película de aceite">
        {/* alojamiento y metal */}
        <circle cx={CX} cy={CY} r={RB + 30} fill="var(--c-metal-2)" />
        <circle cx={CX} cy={CY} r={RB + 10} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <circle cx={CX} cy={CY} r={RB} fill="var(--c-oil)" opacity={0.35} />
        {/* presión en la cuña */}
        {segs}
        {oilDots}
        {/* muñón */}
        <circle cx={jx} cy={jy} r={RJ} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={jx} cy={jy} r={RJ - 16} fill="none" stroke="var(--c-metal)" strokeWidth={1.5} opacity={0.6} />
        {[0, 1, 2, 3, 4, 5].map((k) => {
          const a = s.rot + (k * TAU) / 6;
          const p1 = P(a, 20, jx, jy), p2 = P(a, RJ - 22, jx, jy);
          return <line key={k} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--c-metal)" strokeWidth={2} opacity={0.55} />;
        })}
        {(() => {
          const h = P(s.rot, RJ - 34, jx, jy);
          return <circle cx={h.x} cy={h.y} r={7} fill="var(--c-oil)" stroke="var(--c-metal-dark)" />;
        })()}
        <path d={lobe} fill="var(--c-hot)" opacity={0.28} stroke="var(--c-hot)" strokeWidth={1.5} strokeOpacity={0.8} />
        {arrows}
        {/* sentido de giro */}
        {(() => {
          const a0 = Math.PI * 1.05, a1 = Math.PI * 1.32;
          const r = RJ - 46;
          const p0 = P(a0, r, jx, jy), p1 = P(a1, r, jx, jy);
          const tip = P(a1 + 0.06, r, jx, jy);
          const lbl = P(Math.PI * 1.18, r - 18, jx, jy);
          return (
            <g>
              <path d={`M${p0.x},${p0.y} A${r},${r} 0 0 0 ${p1.x},${p1.y}`} fill="none" stroke="var(--text)" strokeWidth={2} opacity={0.6} />
              <Arrow x1={p1.x} y1={p1.y} x2={tip.x} y2={tip.y} color="var(--text)" opacity={0.6} head={9} />
              <text x={lbl.x} y={lbl.y + 4} textAnchor="middle" className="svg-small" style={{ fill: "var(--text)" }}>giro</text>
            </g>
          );
        })()}
        {/* carga */}
        <Arrow x1={jx} y1={jy - 40 - W * 1.8} x2={jx} y2={jy - 8} color="var(--accent)" width={3 + W / 8} head={12 + W / 6} />
        <text x={jx + 12} y={jy - 30 - W * 1.8} className="svg-label" style={{ fill: "var(--accent)" }}>carga {W} kN</text>
        <circle cx={jx} cy={jy} r={4} fill="var(--text)" />
        <circle cx={CX} cy={CY} r={3} fill="none" stroke="var(--text)" />
        {/* espesor mínimo */}
        <circle cx={(minPt.x + minPtJ.x) / 2} cy={(minPt.y + minPtJ.y) / 2} r={regime === "bad" ? 10 + 2 * Math.sin(clock.t * 20) : 5}
          fill={regime === "bad" ? "var(--bad)" : regime === "warn" ? "var(--warn)" : "var(--ok)"} opacity={regime === "bad" ? 0.8 : 0.9} />
        {regime === "bad" && [0, 1, 2, 3].map((k) => {
          const a = alpha + (k - 1.5) * 0.12;
          const q0 = P(alpha, RB + 1), q1 = P(a, RB + 14 + 6 * Math.sin(clock.t * 30 + k * 2));
          return <line key={k} x1={q0.x} y1={q0.y} x2={q1.x} y2={q1.y} stroke="var(--c-spark)" strokeWidth={2} />;
        })}
        <line x1={minPt.x} y1={minPt.y} x2={minPt.x + 40} y2={406} stroke="var(--muted)" strokeDasharray="3 3" />
        <text x={minPt.x + 44} y={410} className="svg-label" style={{ fill: regime === "bad" ? "var(--bad)" : "var(--text-2)" }}>
          h mín = {fmt(hMin, 1)} µm
        </text>
        {(() => {
          const a = P(Math.PI * 0.78, RB + 5);
          return (
            <g>
              <line x1={a.x} y1={a.y} x2={40} y2={34} stroke="var(--muted)" strokeDasharray="3 3" />
              <circle cx={a.x} cy={a.y} r={2.5} fill="var(--muted)" />
              <text x={14} y={28} className="svg-label">metal (cojinete)</text>
            </g>
          );
        })()}

        {/* ---------- gráfico de espesor */}
        <rect x={GX} y={H1.y} width={GW} height={H1.h} rx={6} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX} y={H1.y - 10} className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>Espesor de la película [µm]</text>
        {[0, 25, 50].map((v) => (
          <g key={v}>
            <line x1={GX} x2={GX + GW} y1={myH(v)} y2={myH(v)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={GX - 5} y={myH(v) + 4} textAnchor="end" className="svg-small">{v}</text>
          </g>
        ))}
        <rect x={GX} y={myH(1)} width={GW} height={myH(0) - myH(1)} fill="var(--bad)" opacity={0.35} />
        <path d={hPath} fill="none" stroke="var(--c-oil)" strokeWidth={2.6} />
        <circle cx={mx(Math.PI)} cy={myH(hMin)} r={5} fill={regime === "bad" ? "var(--bad)" : regime === "warn" ? "var(--warn)" : "var(--ok)"} stroke="var(--surface)" strokeWidth={1.5} />
        <text x={mx(Math.PI) + 8} y={myH(hMin) - 6} className="svg-small" style={{ fill: "var(--text-2)", fontWeight: 700 }}>mínimo</text>
        <text x={GX + 4} y={myH(1) - 4} className="svg-small" style={{ fill: "var(--bad)" }}>menos de 1 µm: se tocan</text>

        {/* ---------- gráfico de presión */}
        <rect x={GX} y={H2.y} width={GW} height={H2.h} rx={6} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX} y={H2.y - 10} className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>Presión en la película [MPa]</text>
        {[0, pScale / 2, pScale].map((v) => (
          <g key={v}>
            <line x1={GX} x2={GX + GW} y1={myP(v)} y2={myP(v)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={GX - 5} y={myP(v) + 4} textAnchor="end" className="svg-small">{fmt(v, 0)}</text>
          </g>
        ))}
        <path d={`${pPath} L${GX + GW},${myP(0)} L${GX},${myP(0)} Z`} fill="var(--c-hot)" opacity={0.18} />
        <path d={pPath} fill="none" stroke="var(--c-hot)" strokeWidth={2.6} />
        <circle cx={mx(thMax)} cy={myP(pMax)} r={4.5} fill="var(--c-hot)" />
        {[0, 90, 180, 270, 360].map((d) => (
          <g key={d}>
            <line x1={mx((d / 360) * TAU)} x2={mx((d / 360) * TAU)} y1={H2.y + H2.h} y2={H2.y + H2.h + 5} stroke="var(--muted)" />
            <text x={mx((d / 360) * TAU)} y={H2.y + H2.h + 17} textAnchor="middle" className="svg-small">{d}°</text>
          </g>
        ))}
        <text x={GX} y={H2.y + H2.h + 32} className="svg-small">ángulo desde el espesor máximo, en el sentido de giro</text>
        <text x={mx(Math.PI / 2)} y={H2.y + 16} textAnchor="middle" className="svg-small">cuña que se cierra</text>
        <text x={mx(Math.PI * 1.5)} y={H2.y + 16} textAnchor="middle" className="svg-small">se abre: sin presión</text>
      </svg>
    </AnimFrame>
  );
}
