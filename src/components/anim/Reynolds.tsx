/* Experimento de Reynolds: hilos de tinta en un caño. Laminar (capas paralelas, perfil parabólico) vs turbulento
   (remolinos, mezcla, perfil chato). Re = v·D/ν con fluidos del auto. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, Arrow, fmt, smoothstep, clamp } from "../ui/anim-kit";

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;

const FLUIDS = [
  { id: "aceiteF", label: "Aceite frío (20 °C)", nu: 250e-6, color: "var(--c-oil)" },
  { id: "aceiteC", label: "Aceite caliente (100 °C)", nu: 14e-6, color: "var(--c-oil)" },
  { id: "refri", label: "Refrigerante (90 °C)", nu: 0.6e-6, color: "var(--c-coolant)" },
  { id: "aire", label: "Aire (20 °C)", nu: 15e-6, color: "var(--c-air)" },
];
const DYES = ["var(--bad)", "var(--violet)", "var(--accent)", "var(--ok)", "var(--primary)"];

const RND = Array.from({ length: 80 }, (_, i) => {
  const s = Math.sin(i * 91.7 + 17.3) * 43758.5453;
  return s - Math.floor(s);
});

export function Reynolds() {
  const clock = useAnimClock({ speed: 1 });
  const [fid, setFid] = useState("aceiteC");
  const [v, setV] = useState(1.5); // m/s
  const [D, setD] = useState(10); // mm
  const F = FLUIDS.find((f) => f.id === fid) ?? FLUIDS[1];
  const Re = (v * (D / 1000)) / F.nu;
  const tau = smoothstep(2300, 4000, Re); // 0 laminar → 1 turbulento
  const regime = Re < 2300 ? "Laminar" : Re < 4000 ? "Transición" : "Turbulento";
  const t = clock.t;

  const X0 = 30, X1 = 690, CY = 140, R = 66, INJ = 52;
  const vis = 55 + 18 * Math.log10(clamp(v, 0.05, 50) / 0.05); // px/s medio (sólo visual)
  const lam = (yr: number) => 2 * (1 - yr * yr); // perfil laminar normalizado (media 1)
  const tur = (yr: number) => 1.22 * Math.pow(Math.max(0, 1 - Math.abs(yr)), 1 / 7); // ley 1/7
  const prof = (yr: number) => (1 - tau) * lam(yr) + tau * tur(yr);
  const L = X1 - INJ;

  // hilos de tinta inyectados aguas arriba
  const lanes = [-0.6, -0.3, 0, 0.3, 0.6];
  const streaks = lanes.map((y0, k) => {
    let d = "";
    for (let x = INJ; x <= X1; x += 6) {
      const grow = clamp((x - INJ) / 160, 0, 1);
      const w = tau * R * 0.3 * grow * (Math.sin(0.035 * x - 3.1 * t + k * 1.7) + 0.6 * Math.sin(0.085 * x + 2.3 * t + k * 2.9) + 0.25 * Math.sin(0.16 * x - 4 * t + k));
      const tr = Re >= 2300 && Re < 4000 ? 0.4 + 0.6 * Math.max(0, Math.sin(t * 1.3 + x * 0.01)) : 1; // en transición, ráfagas
      let yy = y0 * R + w * tr;
      const lim = 0.78 * R;
      if (Math.abs(yy) > lim) yy = Math.sign(yy) * (lim + (Math.abs(yy) - lim) * 0.3);
      const y = clamp(CY + yy, CY - R + 4, CY + R - 4);
      d += `${x === INJ ? "M" : "L"}${x},${y.toFixed(1)}`;
    }
    return <path key={k} d={d} fill="none" stroke={DYES[k]} strokeWidth={2 + tau * 3} opacity={0.85 - tau * 0.25} strokeLinecap="round" />;
  });
  // partículas que viajan con la velocidad local
  const parts = Array.from({ length: 46 }, (_, i) => {
    const y0 = (RND[i] - 0.5) * 1.84;
    const x = INJ + ((RND[i + 20] * L + vis * prof(y0) * t) % L);
    const wob = tau * R * 0.35 * (Math.sin(t * 3.3 + i * 1.9 + x * 0.03) + 0.5 * Math.sin(t * 7.1 + i));
    const y = clamp(CY + y0 * R + wob, CY - R + 3, CY + R - 3);
    return <circle key={i} cx={x} cy={y} r={2.2} fill="var(--text)" opacity={0.35} />;
  });
  // perfil de velocidades
  const PX = 560;
  const arrows = [-0.85, -0.6, -0.35, -0.12, 0.12, 0.35, 0.6, 0.85].map((yr) => (
    <Arrow key={yr} x1={PX} y1={CY + yr * R} x2={PX + 6 + prof(yr) * 46} y2={CY + yr * R} color="var(--text)" width={1.6} head={6} opacity={0.75} />
  ));
  let profPath = "";
  for (let i = 0; i <= 40; i++) {
    const yr = -1 + (2 * i) / 40;
    profPath += `${i ? "L" : "M"}${(PX + 6 + prof(yr) * 46).toFixed(1)},${(CY + yr * R).toFixed(1)}`;
  }

  return (
    <AnimFrame
      title="Laminar o turbulento: el número de Reynolds"
      clock={clock}
      controls={
        <>
          <Seg value={fid} onChange={setFid} options={FLUIDS.map((f) => ({ value: f.id, label: f.label }))} ariaLabel="Fluido" />
          <Slider label="Velocidad" value={v} min={0.1} max={30} step={0.1} onChange={setV} unit="m/s" />
          <Slider label="Ø del conducto" value={D} min={4} max={60} step={1} onChange={setD} unit="mm" />
        </>
      }
      readouts={
        <>
          <Readout label="Número de Reynolds" value={fmt(Re, 0)} tone={Re < 2300 ? "ok" : Re < 4000 ? "warn" : "bad"} />
          <Readout label="Régimen" value={regime} tone={Re < 2300 ? "ok" : Re < 4000 ? "warn" : "bad"} />
          <Readout label="Viscosidad cinemática" value={fmt(F.nu * 1e6, 1)} unit="mm²/s" />
        </>
      }
      legend={[
        { color: "var(--bad)", label: "Hilos de tinta" },
        { color: "var(--text)", label: "Perfil de velocidades" },
      ]}
      caption={
        <>
          <p>
            Re = v · D / ν (ν, la letra griega "nu", es la viscosidad cinemática) compara las fuerzas de inercia (el fluido quiere seguir de largo) con las viscosas (el fluido "pegajoso" que frena
            los remolinos). Por debajo de <b>≈ 2.300</b> el flujo es <b>laminar</b>: los hilos de tinta corren paralelos y el perfil de
            velocidades es una parábola (rápido en el centro, quieto en la pared). Por encima de <b>≈ 4.000</b> es <b>turbulento</b>: la tinta
            se mezcla enseguida y el perfil se aplana.
          </p>
          <p>
            Probá: aceite frío en una galería de 10 mm, siempre laminar. Refrigerante en una manguera de 30 mm a 1 m/s: turbulento (y está
            bien, porque la turbulencia <b>transmite mucho mejor el calor</b> en el radiador). Aire en la admisión: turbulento casi siempre.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 270" role="img" aria-label="Caño con hilos de tinta, flujo laminar o turbulento">
        <rect x={X0} y={CY - R} width={X1 - X0} height={2 * R} style={{ fill: `color-mix(in srgb, ${F.color} 16%, var(--surface))` }} />
        {parts}
        {streaks}
        <line x1={X0} y1={CY - R} x2={X1} y2={CY - R} stroke="var(--c-metal-dark)" strokeWidth={4} />
        <line x1={X0} y1={CY + R} x2={X1} y2={CY + R} stroke="var(--c-metal-dark)" strokeWidth={4} />
        {/* inyectores de tinta */}
        {lanes.map((y0, k) => (
          <line key={k} x1={INJ - 18} y1={CY + y0 * R} x2={INJ} y2={CY + y0 * R} stroke={DYES[k]} strokeWidth={3} />
        ))}
        <text x={X0} y={CY - R - 12} className="svg-small">tinta</text>
        {/* perfil */}
        <line x1={PX} y1={CY - R} x2={PX} y2={CY + R} stroke="var(--text)" strokeDasharray="3 3" opacity={0.6} />
        {arrows}
        <path d={profPath} fill="none" stroke="var(--text)" strokeWidth={2} opacity={0.8} />
        <text x={PX} y={CY + R + 18} textAnchor="middle" className="svg-small">perfil de velocidades</text>
        <text x={X0} y={28} className="svg-title" style={{ ...HALO, fill: Re < 2300 ? "var(--ok)" : Re < 4000 ? "var(--warn)" : "var(--bad)" }}>
          Re = {fmt(Re, 0)} → {regime.toLowerCase()}
        </text>
        <text x={X1} y={28} textAnchor="end" className="svg-small">{F.label} · Ø {D} mm · {fmt(v, 1)} m/s</text>
        {/* escala de Re */}
        {(() => {
          const sx0 = 120, sx1 = 600, sy = 246;
          const mx = (r: number) => sx0 + ((Math.log10(clamp(r, 10, 1e6)) - 1) / 5) * (sx1 - sx0);
          return (
            <g>
              <rect x={sx0} y={sy - 5} width={mx(2300) - sx0} height={10} fill="var(--ok)" opacity={0.5} />
              <rect x={mx(2300)} y={sy - 5} width={mx(4000) - mx(2300)} height={10} fill="var(--warn)" opacity={0.6} />
              <rect x={mx(4000)} y={sy - 5} width={sx1 - mx(4000)} height={10} fill="var(--bad)" opacity={0.45} />
              {[10, 100, 1000, 10000, 100000, 1000000].map((r) => (
                <text key={r} x={mx(r)} y={sy + 20} textAnchor="middle" className="svg-small">{r >= 1e6 ? "1M" : r >= 1000 ? `${r / 1000}k` : r}</text>
              ))}
              <path d={`M${mx(Re)},${sy - 8} l-6,-9 l12,0 Z`} fill="var(--text)" />
              <text x={sx0 - 8} y={sy + 4} textAnchor="end" className="svg-small">Re</text>
            </g>
          );
        })()}
      </svg>
    </AnimFrame>
  );
}
