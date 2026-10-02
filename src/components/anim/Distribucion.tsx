/* Distribución por correa dentada (DOHC), vista de frente.
   - Piñón de cigüeñal de 21 dientes y piñones de levas de 42: relación 2:1 real.
   - La correa (geometría de tangentes exacta) se mueve con los dientes.
   - Marcas de puesta a punto que coinciden cada 2 vueltas de cigüeñal.
   - Abajo/derecha: los 4 cilindros con sus levas y válvulas.
   - "1 diente corrido" (P0016) y "correa cortada" en motor interferente. */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Seg, useAnimClock, fmt, wrap } from "../ui/anim-kit";
import { D2R, STROKES, camPath, liftAdm, liftEsc, pistonX, strokeIndex, useWide } from "./motor1-kit";

const DEG_PER_S = 120;
const OFF = [0, 180, 540, 360]; // orden 1-3-4-2
const TOOTH_CAM = 360 / 42; // un diente del piñón de levas, en grados de leva
const CLR = 3.5; // luz pistón-válvula en el PMS con válvula cerrada [mm] (incluye el rebaje del pistón)

type Pul = { x: number; y: number; r: number; s: 1 | -1 };
/** Correa alrededor de poleas: tangentes exactas. s = +1 polea adentro del lazo, −1 rodillo por la espalda. Recorrido horario. */
function belt(ps: Pul[]) {
  const n = ps.length;
  const tg = ps.map((p1, i) => {
    const p2 = ps[(i + 1) % n];
    const r1 = p1.s * p1.r, r2 = p2.s * p2.r;
    const Dx = p2.x - p1.x, Dy = p2.y - p1.y, D = Math.hypot(Dx, Dy);
    const al = Math.atan2(Dy, Dx) + Math.acos((r2 - r1) / D);
    const nx = Math.cos(al), ny = Math.sin(al);
    return { a: { x: p1.x - r1 * nx, y: p1.y - r1 * ny }, b: { x: p2.x - r2 * nx, y: p2.y - r2 * ny } };
  });
  const W = (a: number) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let d = `M${tg[n - 1].b.x.toFixed(2)},${tg[n - 1].b.y.toFixed(2)}`;
  let L = 0;
  ps.forEach((p, i) => {
    const inn = tg[(i - 1 + n) % n].b, out = tg[i].a;
    const a0 = Math.atan2(inn.y - p.y, inn.x - p.x), a1 = Math.atan2(out.y - p.y, out.x - p.x);
    const sw = p.s > 0 ? W(a1 - a0) : W(a0 - a1);
    L += sw * p.r;
    d += ` A${p.r},${p.r} 0 ${sw > Math.PI ? 1 : 0} ${p.s > 0 ? 1 : 0} ${out.x.toFixed(2)},${out.y.toFixed(2)}`;
    d += ` L${tg[i].b.x.toFixed(2)},${tg[i].b.y.toFixed(2)}`;
    L += Math.hypot(tg[i].b.x - tg[i].a.x, tg[i].b.y - tg[i].a.y);
  });
  return { d, L, tg };
}
/** contorno de un piñón dentado centrado en 0,0 */
function gear(r: number, N: number, depth = 3.2) {
  let d = "";
  for (let k = 0; k < N; k++) {
    const t = (k / N) * Math.PI * 2, w = Math.PI / N;
    const pts = [
      [t - w * 0.95, r - depth], [t - w * 0.45, r + 0.8], [t + w * 0.45, r + 0.8], [t + w * 0.95, r - depth],
    ];
    pts.forEach(([a, rr], j) => { d += `${k === 0 && j === 0 ? "M" : "L"}${(rr * Math.cos(a)).toFixed(1)},${(rr * Math.sin(a)).toFixed(1)}`; });
  }
  return d + "Z";
}

const CRANK: Pul = { x: 180, y: 384, r: 27, s: 1 };
const TENS: Pul = { x: 104, y: 268, r: 17, s: -1 };
const CAMI: Pul = { x: 112, y: 86, r: 54, s: 1 };
const CAME: Pul = { x: 248, y: 86, r: 54, s: 1 };
const WP: Pul = { x: 290, y: 262, r: 28, s: 1 };
const BELT = belt([CRANK, TENS, CAMI, CAME, WP]);
const NT = Math.round(BELT.L / ((2 * Math.PI * CRANK.r) / 21));
const PITCH = BELT.L / NT;
const G_CRANK = gear(CRANK.r - 1, 21);
const G_CAM = gear(CAMI.r - 1, 42);
const G_WP = gear(WP.r - 1, 22);

type Mode = "ok" | "diente" | "cortada";

export function Distribucion() {
  const clock = useAnimClock({ speed: 1 });
  const [mode, setMode] = useState<Mode>("ok");
  const [base, setBase] = useState(0);
  const [cut, setCut] = useState<{ tb: number; phb: number; hit: { at: number; cyl: number; valve: "adm" | "esc" } | null } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const wide = useWide(boxRef, 600);
  const toothOff = mode === "diente" ? -TOOTH_CAM : 0;

  const rawNow = clock.t * DEG_PER_S + base;
  const COAST = 380, TAUS = 1.4;
  let crank = rawNow, cam = rawNow / 2 + toothOff, hitNow = false;
  if (cut) {
    const dt = Math.max(0, clock.t - cut.tb);
    crank = cut.phb + COAST * (1 - Math.exp(-dt / TAUS));
    if (cut.hit && crank >= cut.hit.at) { crank = cut.hit.at; hitNow = true; }
    cam = cut.phb / 2;
  }

  // valores de válvulas y pistones de cada cilindro
  const cylState = (i: number, crankDeg: number, camDeg: number) => {
    const cv = wrap(2 * camDeg + OFF[i], 720);
    const lA = liftAdm(cv), lE = liftEsc(cv);
    const x = pistonX(wrap(crankDeg + OFF[i], 360));
    return { cv, lA, lE, x, si: strokeIndex(wrap(crankDeg + OFF[i], 720)) };
  };
  const changeMode = (m: Mode) => {
    if (m === "cortada" && mode !== "cortada") {
      const phb = rawNow;
      let hit: { at: number; cyl: number; valve: "adm" | "esc" } | null = null;
      for (let f = phb; f <= phb + COAST - 2 && !hit; f += 0.5) {
        for (let i = 0; i < 4 && !hit; i++) {
          const s = cylState(i, f, phb / 2 + toothOff);
          if (s.lA > s.x + CLR) hit = { at: f, cyl: i, valve: "adm" };
          else if (s.lE > s.x + CLR) hit = { at: f, cyl: i, valve: "esc" };
        }
      }
      setCut({ tb: clock.t, phb, hit });
      if (!clock.playing) clock.setPlaying(true);
    } else if (m !== "cortada" && mode === "cortada") {
      setBase(crank - clock.t * DEG_PER_S);
      setCut(null);
    }
    setMode(m);
  };

  const phi = wrap(crank, 720);
  const camW = wrap(cam, 360);
  const aligned = mode === "ok" && !cut && (phi < 3 || phi > 717);
  const crankMarkOk = wrap(crank, 360) < 3 || wrap(crank, 360) > 357;
  const camErrCrank = mode === "diente" ? -TOOTH_CAM * 2 : 0;
  const beltS = (cut ? cut.phb : crank) * D2R * CRANK.r;

  // ======================================================== PANEL A: frente
  const mark = (x: number, y: number, r: number, ang: number, color: string) => {
    const a = (ang - 90) * D2R;
    return <circle cx={x + (r - 9) * Math.cos(a)} cy={y + (r - 9) * Math.sin(a)} r={4} fill={color} stroke="var(--surface)" strokeWidth={1} />;
  };
  const pointer = (x: number, y: number) => <path d={`M${x - 6},${y - 9} L${x + 6},${y - 9} L${x},${y} Z`} fill="var(--text)" />;
  const sprocket = (p: Pul, path: string, ang: number, fill: string) => (
    <g transform={`translate(${p.x},${p.y}) rotate(${ang})`}>
      <path d={path} fill={fill} stroke="var(--c-metal-dark)" strokeWidth={1} />
      <circle r={p.r * 0.62} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1} opacity={0.5} />
      <circle r={7} fill="var(--c-metal-dark)" />
      {p.r > 40 && [0, 120, 240].map((a) => <circle key={a} cx={p.r * 0.38 * Math.cos(a * D2R)} cy={p.r * 0.38 * Math.sin(a * D2R)} r={6} fill="var(--surface)" opacity={0.8} />)}
    </g>
  );
  const cutPt = BELT.tg[3].a; // tramo de escape hacia la bomba
  const front = (
    <g>
      {/* contorno de la tapa y el block */}
      <path d="M30,30 Q30,12 48,12 L312,12 Q330,12 330,30 L330,170 L318,182 L318,430 L42,430 L42,182 L30,170 Z" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth={1.2} />
      <line x1={30} y1={170} x2={330} y2={170} stroke="var(--border-strong)" strokeDasharray="5 4" />
      {/* piñones */}
      {sprocket(CAMI, G_CAM, camW, "var(--c-metal)")}
      {sprocket(CAME, G_CAM, camW, "var(--c-metal)")}
      {sprocket(WP, G_WP, ((cut ? cut.phb : crank) * CRANK.r) / WP.r, "var(--c-metal-light)")}
      {sprocket(CRANK, G_CRANK, crank, "var(--c-metal)")}
      {/* tensor */}
      <g>
        <line x1={TENS.x} y1={TENS.y} x2={TENS.x - 28} y2={TENS.y + 30} stroke="var(--c-metal-dark)" strokeWidth={8} strokeLinecap="round" />
        <circle cx={TENS.x - 28} cy={TENS.y + 30} r={5} fill="var(--c-metal-dark)" />
        <circle cx={TENS.x} cy={TENS.y} r={TENS.r} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <circle cx={TENS.x + 4} cy={TENS.y - 2} r={5} fill="var(--c-metal-dark)" />
      </g>
      {/* correa */}
      <path d={BELT.d} fill="none" stroke="var(--border-strong)" strokeWidth={11} strokeLinejoin="round" opacity={cut ? 0.3 : 1} />
      <path d={BELT.d} fill="none" stroke="var(--c-belt)" strokeWidth={9} strokeLinejoin="round" opacity={cut ? 0.35 : 1} />
      <path d={BELT.d} pathLength={BELT.L} fill="none" stroke="var(--c-metal-dark)" strokeWidth={9} strokeDasharray={`${(PITCH * 0.42).toFixed(2)} ${(PITCH * 0.58).toFixed(2)}`}
        strokeDashoffset={-wrap(beltS, PITCH)} opacity={cut ? 0.3 : 0.9} />
      {cut && (
        <path d={`M${cutPt.x - 9},${cutPt.y + 8} l18,10 M${cutPt.x + 9},${cutPt.y + 8} l-18,10`} stroke="var(--bad)" strokeWidth={4} strokeLinecap="round" />
      )}
      {/* marcas */}
      {pointer(CAMI.x, CAMI.y - CAMI.r - 8)}
      {pointer(CAME.x, CAME.y - CAME.r - 8)}
      {mark(CAMI.x, CAMI.y, CAMI.r, camW, "var(--accent)")}
      {mark(CAME.x, CAME.y, CAME.r, camW, "var(--accent)")}
      <path d={`M${CRANK.x - 6},${CRANK.y - CRANK.r - 16} L${CRANK.x + 6},${CRANK.y - CRANK.r - 16} L${CRANK.x},${CRANK.y - CRANK.r - 7} Z`} fill="var(--text)" />
      {mark(CRANK.x, CRANK.y, CRANK.r + 2, crank, "var(--accent)")}
      {/* rótulos */}
      <text x={CAMI.x + 14} y={160} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>levas admisión</text>
      <text x={CAMI.x + 14} y={173} textAnchor="middle" className="svg-small">42 dientes</text>
      <text x={CAME.x - 8} y={160} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>levas escape</text>
      <text x={CAME.x - 8} y={173} textAnchor="middle" className="svg-small">42 dientes</text>
      <text x={CRANK.x} y={CRANK.y - CRANK.r - 34} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>cigüeñal</text>
      <text x={CRANK.x} y={CRANK.y - CRANK.r - 21} textAnchor="middle" className="svg-small">21 dientes</text>
      <text x={TENS.x - 32} y={TENS.y - 22} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>tensor</text>
      <text x={WP.x - 36} y={WP.y + 4} textAnchor="end" style={{ fontSize: 11, fontWeight: 700, fill: "var(--text)" }}>bomba de agua</text>
      <g>
        <rect x={93} y={196} width={174} height={22} rx={11} fill={cut ? "var(--bad)" : aligned ? "var(--ok)" : "var(--surface)"} stroke={aligned || cut ? "none" : "var(--border)"} />
        <text x={180} y={211} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: aligned || cut ? "#fff" : "var(--muted)" }}>
          {cut ? "¡correa cortada!" : aligned ? "✓ las 3 marcas coinciden" : mode === "diente" && crankMarkOk ? "✗ cigüeñal en marca, levas no" : "marcas de puesta a punto"}
        </text>
      </g>
    </g>
  );

  // ======================================================== PANEL B: los 4 cilindros
  const K = 0.75; // px/mm
  const cell = (i: number) => {
    const s = cylState(i, crank, cam);
    const st = STROKES[s.si];
    const hitHere = hitNow && cut?.hit?.cyl === i;
    const crown = 98 + (CLR + s.x) * K;
    const valveG = (vx: number, liftMm: number, which: "adm" | "esc") => {
      const l = liftMm * K;
      const bent = hitHere && cut?.hit?.valve === which;
      const fn = which === "adm" ? (f: number) => liftAdm(f + OFF[i]) : (f: number) => liftEsc(f + OFF[i]);
      return (
        <g>
          <g transform={`translate(${vx},34)`}>
            <path d={camPath(2 * cam, fn, 13, K)} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1} />
            <circle r={4.5} fill="var(--c-metal-dark)" />
          </g>
          <g transform={bent ? `rotate(${which === "adm" ? -7 : 7} ${vx} 60)` : undefined}>
            <rect x={vx - 9} y={47 + l} width={18} height={10} rx={2} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
            <rect x={vx - 1.8} y={57 + l} width={3.6} height={38} fill="var(--c-metal-2)" />
            <path d={`M${vx - 13},${98 + l} L${vx + 13},${98 + l} L${vx + 3},${92 + l} L${vx - 3},${92 + l} Z`} fill={bent ? "var(--bad)" : which === "adm" ? "var(--c-air)" : "var(--c-exhaust)"} stroke="var(--c-metal-dark)" strokeWidth={0.8} />
          </g>
        </g>
      );
    };
    return (
      <g>
        <rect x={4} y={0} width={172} height={200} rx={8} fill="var(--surface)" stroke={hitHere ? "var(--bad)" : "var(--border)"} strokeWidth={hitHere ? 2.5 : 1} />
        <text x={12} y={16} style={{ fontSize: 12, fontWeight: 800, fill: "var(--text)" }}>cil. {i + 1}</text>
        <rect x={98} y={5} width={72} height={15} rx={7.5} fill={st.color} />
        <text x={134} y={16} textAnchor="middle" style={{ fontSize: 9, fontWeight: 800, fill: "#fff" }}>{st.name.toUpperCase()}</text>
        {/* tapa */}
        <rect x={40} y={62} width={100} height={36} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" strokeWidth={0.8} />
        {/* cilindro */}
        <rect x={44} y={98} width={92} height={98} fill="var(--surface-2)" />
        <rect x={36} y={98} width={8} height={98} fill="var(--c-block)" />
        <rect x={136} y={98} width={8} height={98} fill="var(--c-block)" />
        <rect x={45} y={98} width={90} height={Math.max(0, crown - 98)} fill={st.color} opacity={0.18} />
        {/* pistón */}
        <rect x={45} y={crown} width={90} height={24} rx={2} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <path d={`M${66},${crown} l0,2.5 l20,0 l0,-2.5 M${94},${crown} l0,2.5 l20,0 l0,-2.5`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={0.8} />
        <line x1={90} y1={crown + 16} x2={90} y2={196} stroke="var(--c-metal-2)" strokeWidth={6} />
        {valveG(68, s.lA, "adm")}
        {valveG(112, s.lE, "esc")}
        {hitHere && (
          <g>
            <circle cx={cut?.hit?.valve === "adm" ? 68 : 112} cy={crown} r={16} fill="var(--bad)" opacity={0.3} />
            <text x={90} y={150} textAnchor="middle" style={{ fontSize: 15, fontWeight: 900, fill: "var(--bad)" }}>¡CLONC!</text>
            <text x={90} y={166} textAnchor="middle" className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>válvula doblada</text>
          </g>
        )}
      </g>
    );
  };
  const cyls = (
    <g>
      <text x={8} y={14} className="svg-label">Las levas de cada cilindro (corte)</text>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} transform={`translate(${(i % 2) * 180},${22 + Math.floor(i / 2) * 208})`}>{cell(i)}</g>
      ))}
    </g>
  );

  const W = wide ? 720 : 360, HA = 436, HB = 440;
  const camErr = mode === "diente" ? `${fmt(Math.abs(camErrCrank), 0)}° de cigüeñal` : "0°";
  return (
    <AnimFrame
      title="Distribución por correa: relación 2:1, marcas y motor interferente"
      clock={clock}
      controls={
        <Seg value={mode} onChange={changeMode} ariaLabel="Estado de la distribución"
          options={[{ value: "ok" as Mode, label: "Puesta a punto OK" }, { value: "diente" as Mode, label: "1 diente corrido" }, { value: "cortada" as Mode, label: "Correa cortada" }]} />
      }
      readouts={
        <>
          <Readout label="Vueltas de cigüeñal" value={fmt(crank / 360, 2)} />
          <Readout label="Vueltas de levas" value={fmt(cam / 360 - (mode === "diente" ? toothOff / 360 : 0), 2)} />
          <Readout label="Desfase levas" value={camErr} tone={mode === "diente" ? "warn" : "ok"} />
          <Readout label="Scanner" value={mode === "diente" ? "P0016" : cut ? (cut.hit ? "no arranca" : "—") : "sin códigos"} tone={mode === "ok" && !cut ? "ok" : "bad"} />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Marca de puesta a punto" },
        { color: "var(--c-air)", label: "Válvula de admisión" },
        { color: "var(--c-exhaust)", label: "Válvula de escape" },
      ]}
      caption={
        <>
          <p>
            El piñón del cigüeñal tiene <b>21 dientes</b> y los de levas <b>42</b>: por cada vuelta de cigüeñal las levas dan media. Seguí
            las marcas naranjas: la del cigüeñal pasa por su flecha en cada vuelta, pero las tres coinciden juntas <b>sólo cada dos vueltas</b>.
            Por eso al hacer la distribución no alcanza con que el cigüeñal esté “en marca”: tienen que estar las tres, y se trabán con las
            herramientas del kit antes de sacar la correa vieja.
          </p>
          <p>
            Probá <b>1 diente corrido</b>: el motor anda (mal), pero las levas abren {fmt(TOOTH_CAM * 2, 0)}° de cigüeñal tarde; la ECU lo ve
            comparando el sensor de cigüeñal (CKP) con el de levas (CMP) y guarda <b>P0016</b>. Y probá <b>correa cortada</b>: las levas
            se clavan donde estaban, con alguna válvula abierta, pero el cigüeñal sigue girando por inercia. En un motor{" "}
            <b>interferente</b> el pistón sube y se la lleva puesta.
          </p>
        </>
      }
    >
      <div ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${wide ? Math.max(HA, HB) : HA + HB}`} role="img" aria-label="Distribución por correa dentada">
          <g>{front}</g>
          <g transform={wide ? "translate(360,0)" : `translate(0,${HA})`}>{cyls}</g>
        </svg>
      </div>
    </AnimFrame>
  );
}
