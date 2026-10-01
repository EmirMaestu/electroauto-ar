/* Circuito de lubricación a presión.
   Modelo: la bomba (de engranajes) manda un caudal proporcional a las rpm (menos su fuga interna, que crece
   cuando el aceite está finito o la bomba gastada). La presión en la galería sale de cuánto le cuesta a ese
   caudal escaparse por las luces de los metales: p = Q / G, con G proporcional a 1/viscosidad.
   La válvula de alivio limita la presión de salida de la bomba; la de by-pass del filtro limita su caída de presión. */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Slider, useAnimClock, Callout, springPath, plotPath, clamp, lerp, fmt, TAU } from "../ui/anim-kit";

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
    return { x: lerp(pts[i - 1][0], pts[i][0], f), y: lerp(pts[i - 1][1], pts[i][1], f) };
  };
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  return { L, at, d };
}

type Fault = "ninguna" | "filtro" | "bomba" | "metales" | "nivel";
const P_RELIEF = 5.0; // bar
const P_BYPASS = 2.0; // bar
const P_LAMP = 0.4; // bar (presostato)

function oilModel(rpm: number, tOil: number, fault: Fault, aer = 1) {
  const mu = 10 * Math.exp(0.0299 * (100 - tOil)); // cSt de un 5W-30 aprox.
  const leak = fault === "bomba" ? 4 : 0.5;
  const eta = clamp(1 - leak / mu, 0.1, 1);
  const q = 0.011 * rpm * eta * aer; // L/min
  const wear = fault === "metales" ? 2.6 : 1;
  const G = 6.27 * (1 + 1.449e-4 * rpm) * Math.pow(10 / mu, 0.9) * wear; // L/min por bar
  const R = (fault === "filtro" ? 0.075 : 0.006) * (mu / 10); // bar por L/min
  let dp = R * q, byp = false;
  if (dp > P_BYPASS) { dp = P_BYPASS; byp = true; }
  let pGal = q / G, qSys = q, relief = 0;
  if (pGal + dp > P_RELIEF) {
    qSys = P_RELIEF / (1 / G + R);
    if (R * qSys > P_BYPASS) { qSys = (P_RELIEF - P_BYPASS) * G; dp = P_BYPASS; byp = true; }
    else { dp = R * qSys; byp = false; }
    pGal = qSys / G;
    relief = q - qSys;
  }
  return { mu, q, qSys, pGal, dp, byp, relief };
}

/* ---------------------------------------------------------- geometría */
const CY = 234; // eje del cigüeñal
const MAINS = [135, 205, 275, 345, 415];
const RODS = [170, 240, 310, 380];
const RPH = [0, Math.PI, Math.PI, 0];
const THROW = 14, ROD_L = 62;
const GAL_Y = 204;
const FIL = { x0: 448, x1: 486, y0: 214, y1: 290 };
const FX = (FIL.x0 + FIL.x1) / 2;

const P_SUCK = poly([[158, 398], [158, 318]]);
const P_PUMP_OUT = poly([[188, 302], [214, 302]]);
const P_RELIEF_RET = poly([[214, 312], [214, 350]]);
const P_TO_FILTER = poly([[224, 302], [FX, 302], [FX, FIL.y1]]);
const P_FILTER = poly([[FX, FIL.y1 - 4], [FX, FIL.y0 + 4]]);
const P_GALLERY = poly([[FX, FIL.y0], [FX, GAL_Y], [124, GAL_Y]]);
const P_RISER = poly([[124, GAL_Y], [124, 34], [380, 34]]);
const P_DRAIN = poly([[432, 66], [432, 352]]);
const P_TURBO_IN = poly([[FX, GAL_Y], [518, GAL_Y], [518, 110], [496, 110], [496, 122]]);
const P_TURBO_OUT = poly([[496, 148], [496, 356]]);

export function CircuitoAceite() {
  const clock = useAnimClock({ speed: 1 });
  const [rpm, setRpm] = useState(800);
  const [tOil, setTOil] = useState(100);
  const [fault, setFault] = useState<Fault>("ninguna");
  const st = useRef({ last: clock.t, crank: 0, ph: {} as Record<string, number> });
  const s = st.current;
  let dt = clock.t - s.last;
  if (dt < 0) dt = 0;
  s.last = clock.t;
  dt = Math.min(dt, 0.1);

  const t = clock.t;
  const aer = fault === "nivel" ? 1 - 0.8 * Math.pow(Math.max(0, Math.sin(t * 1.5)), 6) - 0.12 * (0.5 + 0.5 * Math.sin(t * 7.3)) : 1;
  const m = oilModel(rpm, tOil, fault, aer);
  const lamp = m.pGal < P_LAMP;

  // fases de partículas
  const QREF = 40;
  const adv = (k: string, flow: number) => { s.ph[k] = (s.ph[k] ?? 0) + (flow > 0.05 ? 18 + 95 * clamp(flow / QREF, 0, 1.6) : 0) * dt; return s.ph[k]; };
  s.crank += (2.2 + rpm / 1100) * dt;
  const dirty = m.byp;
  const oilCol = "var(--c-oil)";
  const dirtyCol = "var(--c-metal-dark)";

  const dots = (p: ReturnType<typeof poly>, n: number, ph: number, col: string, r = 3, bubbles = 0) =>
    Array.from({ length: n }, (_, i) => {
      const q = p.at(ph + (i * p.L) / n);
      const isAir = bubbles > 0 && (i * 7) % 10 < bubbles * 10;
      return isAir
        ? <circle key={i} cx={q.x} cy={q.y} r={r + 0.6} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={0.9} />
        : <circle key={i} cx={q.x} cy={q.y} r={r} style={{ fill: col }} stroke="var(--surface)" strokeWidth={0.6} />;
    });

  const pipe = (d: string, w = 7, op = 1) => (
    <g opacity={op}>
      <path d={d} fill="none" stroke="var(--c-metal-2)" strokeWidth={w + 3} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="var(--surface)" strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="var(--c-oil)" strokeOpacity={0.3} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );

  // nivel de aceite en el cárter
  const lvl = fault === "nivel" ? 396 : 370;
  const bubbleShare = fault === "nivel" ? clamp(1 - aer, 0, 0.8) : 0;

  // gráfico presión vs rpm
  const GX = 552, GY = 176, GW = 156, GH = 176;
  const mxp = (r: number) => GX + ((r - 700) / (6500 - 700)) * GW;
  const myp = (p: number) => GY + GH - (clamp(p, 0, 6) / 6) * GH;
  const curNow = plotPath((r) => oilModel(r, tOil, fault, fault === "nivel" ? 0.8 : 1).pGal, 700, 6500, 60, mxp, myp);
  const curRef = plotPath((r) => oilModel(r, 100, "ninguna").pGal, 700, 6500, 60, mxp, myp);

  // manómetro
  const gA = Math.PI * (1 - clamp(m.pGal, 0, 6) / 6);
  const GCX = 592, GCY = 104, GR = 48;

  return (
    <AnimFrame
      title="Circuito de aceite: de dónde sale la presión"
      clock={clock}
      controls={
        <>
          <Slider label="RPM" value={rpm} min={700} max={6500} step={100} onChange={setRpm} />
          <Slider label="Temp. del aceite" value={tOil} min={0} max={140} step={1} unit="°C" onChange={setTOil} />
          <label className="ctl">
            <span>Falla</span>
            <select value={fault} onChange={(e) => setFault(e.target.value as Fault)}>
              <option value="ninguna">Ninguna</option>
              <option value="filtro">Filtro tapado</option>
              <option value="bomba">Bomba gastada</option>
              <option value="metales">Metales gastados (mucha luz)</option>
              <option value="nivel">Nivel bajo (chupa aire)</option>
            </select>
          </label>
        </>
      }
      readouts={
        <>
          <Readout label="Presión galería" value={fmt(m.pGal, 1)} unit="bar" tone={lamp ? "bad" : m.pGal < 1 ? "warn" : "ok"} />
          <Readout label="Caudal bomba" value={fmt(m.q, 0)} unit="L/min" />
          <Readout label="Viscosidad" value={fmt(m.mu, 0)} unit="cSt" />
          <Readout label="Válv. de alivio" value={m.relief > 0.2 ? "ABIERTA" : "cerrada"} tone={m.relief > 0.2 ? "accent" : undefined} />
          <Readout label="By-pass filtro" value={m.byp ? "ABIERTO" : "cerrado"} tone={m.byp ? "warn" : undefined} />
          <Readout label="Testigo" value={lamp ? "ENCENDIDO" : "apagado"} tone={lamp ? "bad" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--c-oil)", label: "Aceite filtrado" },
        { color: "var(--c-metal-dark)", label: "Aceite sin filtrar (by-pass)" },
        { color: "var(--c-elec)", label: "Presostato → testigo" },
        { color: "var(--bad)", label: "Umbral del testigo (~0,4 bar)" },
      ]}
      caption={
        <>
          <p>
            La bomba <b>no fabrica presión: manda caudal</b>. La presión aparece porque ese caudal tiene que escaparse por las luces
            (huelgos) de los metales, que son de centésimas de milímetro. Por eso la presión sube con las <b>rpm</b> (más caudal), baja con
            el <b>aceite caliente</b> (más finito, se escapa más fácil) y baja con los <b>metales gastados</b> (más luz). En frío choca contra
            la <b>válvula de alivio</b> (~{fmt(P_RELIEF, 0)} bar), que manda el sobrante de vuelta al cárter.
          </p>
          <p>
            Probá: metales gastados con aceite a 110 °C y ralentí → se prende el testigo, y al acelerar se apaga. Filtro tapado a 3.000 rpm
            → se abre el <b>by-pass</b>: el motor tiene presión, pero el aceite circula <b>sin filtrar</b>. Nivel bajo → el chupador toma aire
            y la presión se cae a ratos (en curvas y frenadas es peor).
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 420" role="img" aria-label="Esquema del circuito de lubricación">
        {/* ---------- motor: tapa y block */}
        <rect x={112} y={20} width={328} height={60} rx={8} fill="var(--c-metal-2)" opacity={0.55} />
        <rect x={112} y={80} width={328} height={258} rx={6} fill="var(--c-block)" opacity={0.6} />
        {RODS.map((x) => (
          <rect key={x} x={x - 23} y={96} width={46} height={100} rx={3} fill="var(--surface)" opacity={0.55} stroke="var(--c-metal-2)" />
        ))}
        {/* cárter con aceite */}
        <path d="M112,338 L510,338 L510,404 Q510,414 500,414 L122,414 Q112,414 112,404 Z" fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <path d={`M114,${lvl} L508,${lvl} L508,404 Q508,412 500,412 L122,412 Q114,412 114,404 Z`} fill="var(--c-oil)" opacity={0.55} />
        {fault === "nivel" && <line x1={114} x2={508} y1={370} y2={370} stroke="var(--muted)" strokeDasharray="4 4" />}
        {fault === "nivel" && <text x={504} y={366} textAnchor="end" className="svg-small">nivel correcto</text>}

        {/* ---------- cañerías */}
        {pipe(P_SUCK.d, 7)}
        {pipe(P_PUMP_OUT.d)}
        {pipe(P_RELIEF_RET.d, 5, m.relief > 0.2 ? 1 : 0.6)}
        {pipe(P_TO_FILTER.d)}
        {pipe(P_GALLERY.d, 8)}
        {pipe(P_RISER.d, 5)}
        {pipe(P_TURBO_IN.d, 4)}
        {pipe(P_TURBO_OUT.d, 6)}
        {MAINS.map((x) => <line key={x} x1={x} x2={x} y1={GAL_Y} y2={CY - 12} stroke="var(--c-metal-2)" strokeWidth={4} />)}
        {[170, 275, 380].map((x) => <line key={x} x1={x} x2={x} y1={34} y2={44} stroke="var(--c-metal-2)" strokeWidth={3} />)}
        {/* presión en la galería: brillo proporcional */}
        <path d={P_GALLERY.d} fill="none" stroke="var(--c-oil)" strokeWidth={3} opacity={clamp(m.pGal / 5, 0.1, 1)} />

        {/* ---------- árbol de levas */}
        <line x1={130} x2={430} y1={52} y2={52} stroke="var(--c-metal-dark)" strokeWidth={7} strokeLinecap="round" />
        {[170, 275, 380].map((x) => <circle key={x} cx={x} cy={52} r={9} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={2.5} />)}
        {[150, 192, 222, 255, 298, 328, 360, 405].map((x, i) => {
          const a = s.crank / 2 + i * 1.9;
          return <ellipse key={x} cx={x} cy={52} rx={5} ry={10} fill="var(--c-metal)" transform={`rotate(${(a * 180) / Math.PI} ${x} 52)`} />;
        })}

        {/* ---------- cigüeñal, bielas y pistones */}
        {RODS.map((x, i) => {
          const th = s.crank + RPH[i];
          const jx = x + THROW * Math.sin(th), jy = CY - THROW * Math.cos(th);
          const py = jy - Math.sqrt(ROD_L * ROD_L - (jx - x) * (jx - x));
          return (
            <g key={x}>
              <line x1={x - 35} y1={CY} x2={jx} y2={jy} stroke="var(--c-metal-dark)" strokeWidth={9} strokeLinecap="round" />
              <line x1={x + 35} y1={CY} x2={jx} y2={jy} stroke="var(--c-metal-dark)" strokeWidth={9} strokeLinecap="round" />
              <line x1={x} y1={py} x2={jx} y2={jy} stroke="var(--c-metal-2)" strokeWidth={7} strokeLinecap="round" />
              <rect x={x - 21} y={py - 20} width={42} height={28} rx={4} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
              <circle cx={jx} cy={jy} r={7} fill="var(--c-metal-light)" stroke="var(--c-oil)" strokeWidth={2} />
            </g>
          );
        })}
        {MAINS.map((x) => (
          <g key={x}>
            <circle cx={x} cy={CY} r={12} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={3} />
            <circle cx={x} cy={CY} r={9.5} fill="none" stroke="var(--c-oil)" strokeWidth={2} opacity={clamp(m.pGal / 3, 0.15, 1)} />
          </g>
        ))}

        {/* ---------- partículas */}
        {dots(P_SUCK, 4, adv("suck", m.q), oilCol, 3, bubbleShare)}
        {dots(P_PUMP_OUT, 2, adv("pout", m.q), oilCol, 3, bubbleShare)}
        {m.relief > 0.2 && dots(P_RELIEF_RET, 3, adv("rel", m.relief), oilCol)}
        {dots(P_TO_FILTER, 10, adv("tof", m.qSys), oilCol, 3, bubbleShare)}
        {dots(P_FILTER, 4, adv("fil", m.qSys), dirty ? dirtyCol : oilCol)}
        {dots(P_GALLERY, 13, adv("gal", m.qSys * 0.8), dirty ? dirtyCol : oilCol)}
        {dots(P_RISER, 12, adv("ris", m.qSys * 0.25), dirty ? dirtyCol : oilCol, 2.6)}
        {dots(P_TURBO_IN, 8, adv("tin", m.qSys * 0.15), dirty ? dirtyCol : oilCol, 2.4)}
        {dots(P_TURBO_OUT, 6, adv("tout", m.qSys * 0.15), dirty ? dirtyCol : oilCol, 2.8)}
        {dots(P_DRAIN, 7, adv("drn", m.qSys * 0.2), oilCol, 2.6)}
        {MAINS.map((x, i) => {
          const p = poly([[x, GAL_Y], [x, CY - 12]]);
          return <g key={x}>{dots(p, 2, adv(`m${i}`, m.qSys * 0.2) + i * 5, dirty ? dirtyCol : oilCol, 2.4)}</g>;
        })}
        {/* salpicado: gotas que caen de las bielas */}
        {m.qSys > 0.5 && RODS.map((x, i) => {
          const ph = adv(`drip${i}`, m.qSys * 0.3);
          return [0, 1, 2].map((k) => {
            const u = ((ph / 90 + k / 3 + i * 0.21) % 1);
            return <circle key={`${x}-${k}`} cx={x + (k - 1) * 9} cy={250 + u * (lvl - 252)} r={2.2} fill="var(--c-oil)" opacity={0.85 * (1 - u * 0.5)} />;
          });
        })}

        {/* ---------- bomba de engranajes */}
        <rect x={128} y={284} width={60} height={34} rx={6} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {[[147, 1], [169, -1]].map(([gx, dir]) => (
          <g key={gx} transform={`rotate(${(((s.crank * 1.4 * dir) % TAU) * 180) / Math.PI} ${gx} 301)`}>
            <circle cx={gx} cy={301} r={10} fill="var(--c-metal-dark)" />
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k * TAU) / 8;
              return <rect key={k} x={gx - 2} y={301 - 13} width={4} height={5} fill="var(--c-metal-dark)" transform={`rotate(${(a * 180) / Math.PI} ${gx} 301)`} />;
            })}
          </g>
        ))}
        {/* chupador con malla */}
        <path d="M144,398 L172,398 L166,388 L150,388 Z" fill="var(--c-metal-dark)" />
        <line x1={146} x2={170} y1={400} y2={400} stroke="var(--c-metal-light)" strokeDasharray="2 2" strokeWidth={2} />

        {/* ---------- válvula de alivio */}
        <rect x={204} y={288} width={20} height={26} rx={3} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <circle cx={214} cy={302 + (m.relief > 0.2 ? 5 : 0)} r={4.5} fill={m.relief > 0.2 ? "var(--accent)" : "var(--c-metal-dark)"} />
        <path d={springPath(214, 290, 298 + (m.relief > 0.2 ? 5 : 0), 3, 5)} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1.4} transform="rotate(180 214 300)" />

        {/* ---------- filtro con by-pass */}
        <rect x={FIL.x0} y={FIL.y0} width={FIL.x1 - FIL.x0} height={FIL.y1 - FIL.y0} rx={7} fill="var(--accent)" opacity={0.9} />
        <rect x={FIL.x0 + 5} y={FIL.y0 + 14} width={FIL.x1 - FIL.x0 - 10} height={FIL.y1 - FIL.y0 - 32} rx={3}
          fill={fault === "filtro" ? "var(--c-metal-dark)" : "var(--surface)"} opacity={0.85} />
        {Array.from({ length: 5 }, (_, k) => (
          <line key={k} x1={FIL.x0 + 7} x2={FIL.x1 - 7} y1={FIL.y0 + 22 + k * 9} y2={FIL.y0 + 22 + k * 9} stroke="var(--c-metal-2)" strokeWidth={1} />
        ))}
        <rect x={FX - 8} y={FIL.y0 + 4 - (m.byp ? 3 : 0)} width={16} height={5} rx={2} fill={m.byp ? "var(--warn)" : "var(--c-metal-dark)"} />
        <text x={FX} y={FIL.y1 - 5} textAnchor="middle" className="svg-small" style={{ fill: "#fff", fontWeight: 700 }}>filtro</text>

        {/* ---------- turbo */}
        <rect x={484} y={122} width={24} height={26} rx={4} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <ellipse cx={478} cy={135} rx={6} ry={18} fill="var(--c-hot)" opacity={0.7} />
        <ellipse cx={514} cy={135} rx={6} ry={16} fill="var(--c-air)" opacity={0.7} />
        <text x={470} y={164} textAnchor="end" className="svg-small" style={{ fill: "var(--text-2)" }}>turbo</text>

        {/* ---------- presostato y cable */}
        <path d={`M455,${GAL_Y - 12} L455,8 L${GCX - 60},8 L${GCX - 60},40`} fill="none" stroke="var(--c-elec)" strokeWidth={1.4} />
        <rect x={449} y={GAL_Y - 18} width={12} height={12} rx={2} fill="var(--c-elec)" />
        <text x={460} y={70} className="svg-small" style={{ fill: "var(--c-elec)" }}>presostato</text>

        {/* ---------- etiquetas */}
        <Callout x={150} y={52} tx={104} ty={52} text="árbol de levas" anchor="end" />
        <Callout x={124} y={120} tx={104} ty={120} text="subida a la tapa" anchor="end" />
        <Callout x={150} y={GAL_Y} tx={104} ty={GAL_Y - 12} text="galería principal" anchor="end" />
        <Callout x={135} y={CY + 10} tx={104} ty={CY + 14} text="bancada (metales)" anchor="end" />
        <Callout x={128} y={300} tx={104} ty={296} text="bomba" anchor="end" />
        <Callout x={204} y={308} tx={104} ty={322} text="válvula de alivio" anchor="end" />
        <Callout x={150} y={394} tx={104} ty={364} text="chupador" anchor="end" />
        <Callout x={124} y={406} tx={104} ty={398} text="cárter" anchor="end" />
        <text x={426} y={326} textAnchor="end" className="svg-small">vuelve por gravedad</text>

        {/* ---------- tablero: manómetro y testigo */}
        <rect x={528} y={14} width={184} height={124} rx={10} fill="var(--surface-2)" stroke="var(--border)" />
        <text x={GCX} y={32} textAnchor="middle" className="svg-small">manómetro</text>
        <path d={`M${GCX - GR},${GCY} A${GR},${GR} 0 0 1 ${GCX + GR},${GCY}`} fill="none" stroke="var(--border-strong)" strokeWidth={6} />
        {(() => {
          const a1 = Math.PI * (1 - P_LAMP / 6);
          return <path d={`M${GCX - GR},${GCY} A${GR},${GR} 0 0 1 ${GCX + GR * Math.cos(a1)},${GCY - GR * Math.sin(a1)}`} fill="none" stroke="var(--bad)" strokeWidth={6} />;
        })()}
        {[0, 1, 2, 3, 4, 5, 6].map((p) => {
          const a = Math.PI * (1 - p / 6);
          return <text key={p} x={GCX + (GR - 14) * Math.cos(a)} y={GCY - (GR - 14) * Math.sin(a) + 4} textAnchor="middle" className="svg-small">{p}</text>;
        })}
        <line x1={GCX} y1={GCY} x2={GCX + (GR - 4) * Math.cos(gA)} y2={GCY - (GR - 4) * Math.sin(gA)} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={GCX} cy={GCY} r={4.5} fill="var(--text)" />
        <text x={GCX} y={GCY + 22} textAnchor="middle" className="svg-mono">{fmt(m.pGal, 1)} bar</text>
        {/* testigo (aceitera) */}
        <g transform="translate(656 62)" opacity={lamp ? 1 : 0.5}>
          {lamp && <circle cx={14} cy={10} r={24} fill="var(--bad)" opacity={0.18 + 0.12 * Math.sin(t * 10)} />}
          <path d="M-2,8 L20,8 L24,4 L36,8 L24,14 L20,20 L-2,20 Z" fill={lamp ? "var(--bad)" : "var(--border-strong)"} />
          <rect x={4} y={3} width={8} height={5} fill={lamp ? "var(--bad)" : "var(--border-strong)"} />
          <path d="M37,12 q2,5 0,7 q-2,-2 0,-7" fill={lamp ? "var(--bad)" : "var(--border-strong)"} />
        </g>
        <text x={672} y={104} textAnchor="middle" className="svg-small" style={{ fill: lamp ? "var(--bad)" : "var(--muted)", fontWeight: 700 }}>
          {lamp ? "¡TESTIGO!" : "testigo"}
        </text>

        {/* ---------- gráfico presión vs rpm */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={6} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX + GW / 2} y={GY - 10} textAnchor="middle" className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>Presión [bar] vs rpm, aceite a {tOil} °C</text>
        {[0, 2, 4, 6].map((p) => (
          <g key={p}>
            <line x1={GX} x2={GX + GW} y1={myp(p)} y2={myp(p)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={GX - 5} y={myp(p) + 4} textAnchor="end" className="svg-small">{p}</text>
          </g>
        ))}
        {[1000, 3000, 5000].map((r) => (
          <text key={r} x={mxp(r)} y={GY + GH + 14} textAnchor="middle" className="svg-small">{fmt(r, 0)}</text>
        ))}
        <text x={GX + GW} y={GY + GH + 28} textAnchor="end" className="svg-small">rpm</text>
        <line x1={GX} x2={GX + GW} y1={myp(P_LAMP)} y2={myp(P_LAMP)} stroke="var(--bad)" strokeWidth={1.4} strokeDasharray="4 3" />
        <path d={curRef} fill="none" stroke="var(--muted)" strokeWidth={1.5} strokeDasharray="5 4" />
        <path d={curNow} fill="none" stroke="var(--accent)" strokeWidth={2.6} />
        <circle cx={mxp(rpm)} cy={myp(m.pGal)} r={5.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        <text x={GX + 6} y={GY + 14} className="svg-small">- - sano a 100 °C</text>
      </svg>
    </AnimFrame>
  );
}
