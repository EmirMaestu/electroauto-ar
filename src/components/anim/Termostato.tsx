/* Termostato de cera (doble efecto) en corte.
   La cera de la cápsula se funde en un rango de temperatura y aumenta de volumen; como el pasador está
   fijo al puente, la que se mueve es la cápsula (con la válvula principal), comprimiendo el resorte.
   La misma carrera cierra la válvula de bypass. Versión "con mapa": una resistencia calienta la cera
   para que abra antes (la ECU decide cuándo). */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Seg, Toggle, useAnimClock, Callout, springPath, plotPath, clamp, lerp, smoothstep, fmt } from "../ui/anim-kit";

type Pt = [number, number];
function poly(pts: Pt[]) {
  const acc: number[] = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = acc[acc.length - 1];
  const at = (s: number) => {
    const u = ((s % L) + L) % L;
    let i = 1;
    while (i < acc.length - 1 && acc[i] < u) i++;
    const f = (u - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    return { x: lerp(pts[i - 1][0], pts[i][0], f), y: lerp(pts[i - 1][1], pts[i][1], f), u };
  };
  return { L, at };
}
const STOPS: [number, string][] = [[20, "var(--c-air)"], [60, "var(--c-coolant)"], [88, "var(--c-flame)"], [110, "var(--c-hot)"]];
function tempColor(T: number) {
  if (T <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (T <= t1) {
      const [t0, c0] = STOPS[i - 1];
      return `color-mix(in srgb, ${c1} ${Math.round(((T - t0) / (t1 - t0)) * 100)}%, ${c0})`;
    }
  }
  return STOPS[STOPS.length - 1][1];
}

const LMAX = 9; // carrera máxima [mm]
const SPAN = 13; // de "empieza a abrir" a "abierto del todo" [°C]
const PX = 4; // px por mm
const CX = 160;

export function Termostato() {
  const clock = useAnimClock({ speed: 1 });
  const [auto, setAuto] = useState(true);
  const [tManual, setTManual] = useState(92);
  const [tOpen, setTOpen] = useState(87);
  const [mapa, setMapa] = useState(false);
  const [pwm, setPwm] = useState(60);
  const st = useRef({ last: clock.t, wax: 60, ph: { a: 0, b: 0, c: 0 } });
  const s = st.current;

  const T = auto ? 60 + 50 * (0.5 - 0.5 * Math.cos((clock.t * Math.PI * 2) / 24)) : tManual;
  const heatK = mapa ? (pwm / 100) * 16 : 0; // °C extra que la resistencia le suma a la cera
  let dt = clock.t - s.last;
  if (dt < 0) dt = 0;
  s.last = clock.t;
  dt = Math.min(dt, 0.1);
  s.wax += (T + heatK - s.wax) * (1 - Math.exp(-dt / 1.6));
  const melt = smoothstep(tOpen - 4, tOpen + SPAN, s.wax);
  const lift = LMAX * smoothstep(tOpen, tOpen + SPAN, s.wax);
  const lp = lift * PX;
  const fr = lift / LMAX;
  s.ph.a += (12 + 110 * fr) * dt * (fr > 0.02 ? 1 : 0);
  s.ph.b += (12 + 110 * fr) * dt * (fr > 0.02 ? 1 : 0);
  s.ph.c += 70 * (1 - fr) * dt;

  // caminos del refrigerante (dependen de la carrera)
  const pA = poly([[350, 268], [262, 268], [244, 200], [CX + 72, 170 + lp], [CX + 58, 150], [CX + 40, 110], [CX + 30, 30], [CX + 30, -6]]);
  const pB = poly([[350, 278], [70, 264], [62, 200], [CX - 72, 170 + lp], [CX - 58, 150], [CX - 40, 110], [CX - 30, 30], [CX - 30, -6]]);
  const pC = poly([[350, 290], [250, 300], [CX + 44, 322 + lp * 0.5], [CX + 10, 360], [CX + 6, 404]]);
  const dots = (p: ReturnType<typeof poly>, n: number, ph: number, col: string, op = 1) =>
    Array.from({ length: n }, (_, i) => {
      const q = p.at(ph + (i * p.L) / n);
      return <circle key={i} cx={q.x} cy={q.y} r={3.6} style={{ fill: col }} opacity={op} stroke="var(--surface)" strokeWidth={0.8} />;
    });

  // gráfico
  const GX = 478, GY = 58, GW = 222, GH = 230;
  const t0 = 60, t1 = 115;
  const mx = (t: number) => GX + ((t - t0) / (t1 - t0)) * GW;
  const my = (l: number) => GY + GH - (l / 10) * GH;
  const curve = plotPath((t) => LMAX * smoothstep(tOpen, tOpen + SPAN, t), t0, t1, 110, mx, my);
  const curveMap = plotPath((t) => LMAX * smoothstep(tOpen, tOpen + SPAN, t + heatK), t0, t1, 110, mx, my);

  const waxCol = `color-mix(in srgb, var(--c-flame) ${Math.round(melt * 85)}%, var(--c-metal-light))`;
  const capTop = 164 + lp, capBot = 244 + lp;

  return (
    <AnimFrame
      title="Termostato de cera: cómo abre solo con la temperatura"
      clock={clock}
      controls={
        <>
          <Toggle label="Barrido automático" checked={auto} onChange={setAuto} />
          <Slider label="Refrigerante" value={Math.round(T)} min={20} max={115} step={1} unit="°C" onChange={(v) => { setAuto(false); setTManual(v); }} />
          <Seg value={tOpen} onChange={setTOpen} ariaLabel="Temperatura de apertura" options={[82, 87, 92].map((v) => ({ value: v, label: `${v} °C` }))} />
          <Toggle label="Con resistencia (mapa)" checked={mapa} onChange={setMapa} />
          {mapa && <Slider label="Calefacción ECU" value={pwm} min={0} max={100} step={5} unit="%" onChange={setPwm} />}
        </>
      }
      readouts={
        <>
          <Readout label="Refrigerante" value={fmt(T, 0)} unit="°C" />
          <Readout label="Cera" value={fmt(s.wax, 0)} unit="°C" tone={mapa && pwm > 0 ? "accent" : undefined} />
          <Readout label="Carrera" value={fmt(lift, 1)} unit="mm" tone={fr > 0.95 ? "ok" : undefined} />
          <Readout label="Al radiador" value={fmt(fr * 100, 0)} unit="%" />
          <Readout label="Por bypass" value={fmt((1 - fr) * 100, 0)} unit="%" />
        </>
      }
      legend={[
        { color: "var(--c-oil)", label: "Cápsula (latón)" },
        { color: "var(--c-flame)", label: "Cera fundida" },
        { color: "var(--c-metal-light)", label: "Cera sólida" },
        { color: "var(--c-elec)", label: "Resistencia (versión con mapa)" },
      ]}
      caption={
        <>
          <p>
            Adentro de la cápsula hay una <b>cera</b> que se funde en un rango de temperatura y, al fundirse, <b>aumenta de volumen</b>.
            El pasador está fijo al puente, así que lo que se mueve es la cápsula: baja, despega la <b>válvula principal</b> de su asiento
            y comprime el resorte. Empieza a abrir a la temperatura grabada en la brida ({tOpen} °C) y abre del todo unos {SPAN} °C más
            arriba, con unos {LMAX} mm de carrera. La misma carrera va cerrando la <b>válvula de bypass</b> de abajo: frío, el agua
            vuelve directo a la bomba; caliente, va toda al radiador.
          </p>
          <p>
            Fijate que la cera <b>tarda</b> en seguir al agua (el punto del gráfico se atrasa en el barrido). Con la versión
            <b> con mapa</b>, la ECU calienta la cera con una resistencia: el termostato abre antes aunque el agua esté más fría
            (la curva punteada se corre a la izquierda). Así el motor anda más caliente en ciudad (gasta menos) y más fresco a plena carga.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 410" role="img" aria-label="Corte de un termostato de cera">
        {/* cañería de salida y entrada */}
        <rect x={CX - 50} y={0} width={100} height={34} fill="var(--surface-2)" />
        <rect x={280} y={246} width={72} height={56} fill="var(--surface-2)" />
        <rect x={CX - 30} y={362} width={60} height={46} fill="var(--surface-2)" />
        <line x1={CX - 50} y1={0} x2={CX - 50} y2={30} stroke="var(--c-metal-dark)" strokeWidth={4} />
        <line x1={CX + 50} y1={0} x2={CX + 50} y2={30} stroke="var(--c-metal-dark)" strokeWidth={4} />
        <line x1={280} y1={246} x2={352} y2={246} stroke="var(--c-metal-dark)" strokeWidth={4} />
        <line x1={280} y1={302} x2={352} y2={302} stroke="var(--c-metal-dark)" strokeWidth={4} />
        <line x1={CX - 30} y1={366} x2={CX - 30} y2={408} stroke="var(--c-metal-dark)" strokeWidth={4} />
        <line x1={CX + 30} y1={366} x2={CX + 30} y2={408} stroke="var(--c-metal-dark)" strokeWidth={4} />

        {/* carcasa */}
        <rect x={50} y={30} width={220} height={326} fill="var(--surface-2)" />
        <rect x={50} y={30} width={220} height={326} style={{ fill: tempColor(T) }} opacity={0.14} />
        <path d={`M${CX - 50},30 L40,30 L40,366 L${CX - 30},366`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={10} strokeLinejoin="round" />
        <path d={`M${CX + 50},30 L280,30 L280,246 M280,302 L280,366 L${CX + 30},366`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={10} strokeLinejoin="round" />
        <text x={CX + 56} y={16} className="svg-label">↑ al radiador</text>
        <text x={292} y={238} className="svg-label">← del motor</text>
        <text x={CX + 38} y={398} className="svg-label">↓ bypass → bomba</text>

        {/* partículas (detrás de las piezas) */}
        {fr > 0.02 && dots(pA, 9, s.ph.a, tempColor(T))}
        {fr > 0.02 && dots(pB, 9, s.ph.b, tempColor(T))}
        {fr < 0.98 && dots(pC, 7, s.ph.c, tempColor(T), 0.4 + 0.6 * (1 - fr))}

        {/* brida con asiento */}
        <rect x={50} y={148} width={CX - 60 - 50} height={9} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <rect x={CX + 60} y={148} width={270 - CX - 60} height={9} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <circle cx={74} cy={152} r={3.5} fill="var(--surface)" stroke="var(--c-metal-dark)" />
        <text x={58} y={174} className="svg-small">purga</text>
        <text x={76} y={143} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)", fontWeight: 700 }}>{tOpen}°</text>
        {/* puente y pasador fijo */}
        <path d={`M${CX - 60},150 L${CX - 30},94 L${CX + 30},94 L${CX + 60},150`} fill="none" stroke="var(--c-metal-2)" strokeWidth={6} strokeLinejoin="round" />
        <line x1={CX} y1={94} x2={CX} y2={220} stroke="var(--c-metal-light)" strokeWidth={6} />
        <line x1={CX} y1={94} x2={CX} y2={220} stroke="var(--c-metal-dark)" strokeWidth={1} />

        {/* yugo inferior */}
        <line x1={CX - 55} y1={157} x2={CX - 55} y2={292} stroke="var(--c-metal-2)" strokeWidth={4} />
        <line x1={CX + 55} y1={157} x2={CX + 55} y2={292} stroke="var(--c-metal-2)" strokeWidth={4} />
        <rect x={CX - 58} y={286} width={116} height={7} rx={2} fill="var(--c-metal-2)" />

        {/* resorte (detrás de la cápsula) */}
        <path d={springPath(CX, 164 + lp, 286, 6, 32)} fill="none" stroke="var(--c-metal-dark)" strokeWidth={3} strokeLinejoin="round" />

        {/* válvula principal */}
        <rect x={CX - 68} y={157 + lp} width={136} height={7} rx={2} fill={fr > 0.01 ? "var(--accent)" : "var(--c-metal-dark)"} />

        {/* cápsula de cera */}
        <rect x={CX - 21} y={capTop} width={42} height={capBot - capTop} rx={7} fill="var(--c-oil)" stroke="var(--c-metal-dark)" />
        <rect x={CX - 16} y={capTop + 5} width={32} height={capBot - capTop - 10} rx={5} style={{ fill: waxCol }} />
        {/* manguito de goma alrededor del pasador */}
        <rect x={CX - 7} y={capTop + 3} width={14} height={Math.max(4, 220 - capTop)} rx={3} fill="var(--c-rubber)" opacity={0.85} />
        <line x1={CX} y1={capTop} x2={CX} y2={220} stroke="var(--c-metal-light)" strokeWidth={5} />
        {/* resistencia calefactora (versión con mapa) */}
        {mapa && (
          <g>
            <path d={`M${CX - 10},${capBot - 26} l5,-6 l5,12 l5,-12 l5,12 l5,-6`} fill="none" stroke={pwm > 0 ? "var(--c-hot)" : "var(--c-elec)"} strokeWidth={2.2} />
            <path d={`M${CX - 10},${capBot - 26} L${CX - 30},${capBot - 10} L58,${capBot - 10}`} fill="none" stroke="var(--c-elec)" strokeWidth={1.6} />
            <path d={`M${CX + 15},${capBot - 26} L${CX + 30},${capBot - 4} L58,${capBot - 4}`} fill="none" stroke="var(--c-elec)" strokeWidth={1.6} />
            <rect x={44} y={capBot - 16} width={14} height={16} rx={2} fill="var(--c-elec)" />
            <text x={58} y={capBot + 16} className="svg-small" style={{ fill: "var(--c-elec)", fontWeight: 700 }}>ECU</text>
          </g>
        )}

        {/* vástago y válvula de bypass */}
        <line x1={CX} y1={capBot} x2={CX} y2={314 + lp} stroke="var(--c-metal-2)" strokeWidth={5} />
        <rect x={CX - 38} y={314 + lp} width={76} height={6} rx={2} fill={fr > 0.98 ? "var(--accent)" : "var(--c-metal-dark)"} />

        {/* etiquetas */}
        <Callout x={CX + 2} y={104} tx={300} ty={84} text="puente y pasador fijo" />
        <Callout x={CX + 64} y={152} tx={300} ty={122} text="asiento (brida)" />
        <Callout x={CX + 66} y={160 + lp} tx={300} ty={160} text="válvula principal" />
        <Callout x={CX + 20} y={(capTop + capBot) / 2} tx={300} ty={196} text="cápsula con cera" />
        <Callout x={CX + 30} y={(capBot + 286) / 2 + 6} tx={364} ty={262} text="resorte" />
        <Callout x={CX + 38} y={317 + lp} tx={300} ty={334} text="válvula de bypass" />

        {/* gráfico carrera vs temperatura */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX} y={GY - 12} className="svg-title" style={{ fontSize: 13 }}>Carrera vs temperatura</text>
        {[0, 3, 6, 9].map((l) => (
          <g key={l}>
            <line x1={GX} x2={GX + GW} y1={my(l)} y2={my(l)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={GX - 5} y={my(l) + 4} textAnchor="end" className="svg-small">{l}</text>
          </g>
        ))}
        <text x={GX - 5} y={GY + 10} textAnchor="end" className="svg-small">mm</text>
        {[60, 70, 80, 90, 100, 110].map((t) => (
          <g key={t}>
            <line x1={mx(t)} x2={mx(t)} y1={GY + GH} y2={GY + GH + 5} stroke="var(--muted)" />
            <text x={mx(t)} y={GY + GH + 18} textAnchor="middle" className="svg-small">{t}</text>
          </g>
        ))}
        <text x={GX + GW} y={GY + GH + 32} textAnchor="end" className="svg-small">temperatura del refrigerante [°C]</text>
        <rect x={mx(tOpen)} y={GY} width={mx(tOpen + SPAN) - mx(tOpen)} height={GH} fill="var(--accent-soft)" />
        <text x={mx(tOpen) + 3} y={GY + 14} className="svg-small" style={{ fill: "var(--accent)" }}>abre</text>
        {mapa && heatK > 0.1 && <path d={curveMap} fill="none" stroke="var(--c-elec)" strokeWidth={2} strokeDasharray="5 4" />}
        <path d={curve} fill="none" stroke="var(--accent)" strokeWidth={2.6} />
        <line x1={mx(clamp(T, t0, t1))} x2={mx(clamp(T, t0, t1))} y1={GY} y2={GY + GH} stroke="var(--text)" opacity={0.35} />
        <circle cx={mx(clamp(T, t0, t1))} cy={my(lift)} r={6} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        {mapa && heatK > 0.1 && (
          <text x={GX + 8} y={GY + 32} className="svg-small" style={{ fill: "var(--c-elec)" }}>
            <tspan x={GX + 8}>con resistencia:</tspan>
            <tspan x={GX + 8} dy={13}>abre antes</tspan>
          </text>
        )}
      </svg>
    </AnimFrame>
  );
}
