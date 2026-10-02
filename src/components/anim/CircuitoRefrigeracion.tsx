/* Circuito de refrigeración completo con un modelo térmico simple pero coherente:
   balance de energía del motor (C·dT/dt = Q_motor − Q_radiador − Q_calefacción − Q_pérdidas),
   radiador como intercambiador (conductancia del lado aire en serie con la del lado agua),
   termostato de cera con retardo, electroventilador con histéresis comandado por la ECU con el ECT.
   El tiempo de la simulación corre 20 veces más rápido que el real. */
import { useId, useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Seg, Toggle, useAnimClock, Arrow, clamp, lerp, smoothstep, fmt, TAU } from "../ui/anim-kit";

/* ---------------------------------------------------------------- helpers */
const STOPS: [number, string][] = [
  [10, "var(--c-air)"],
  [55, "var(--c-coolant)"],
  [88, "var(--c-flame)"],
  [108, "var(--c-hot)"],
  [126, "var(--bad)"],
];
/** Color del refrigerante según su temperatura (mezcla de variables CSS: anda en claro y oscuro). */
function tempColor(T: number) {
  if (T <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [t1, c1] = STOPS[i];
    if (T <= t1) {
      const [t0, c0] = STOPS[i - 1];
      const p = Math.round(((T - t0) / (t1 - t0)) * 100);
      return `color-mix(in srgb, ${c1} ${p}%, ${c0})`;
    }
  }
  return STOPS[STOPS.length - 1][1];
}

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
  /** distancia acumulada hasta el vértice i */
  const sAt = (i: number) => acc[i];
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  return { L, at, sAt, d };
}

/** Punto de ebullición [°C] del agua a una presión absoluta [bar] (ecuación de Antoine). */
function boilWater(pBar: number) {
  const mmHg = pBar * 750.06;
  return 1810.94 / (8.14019 - Math.log10(mmHg)) - 244.485;
}

/* ------------------------------------------------------------- geometría */
const PUMP = { x: 420, y: 300 };
const HOUS = { x: 424, y: 128 };
const FAN = { x: 552, y: 222, r: 32 };
const RAD = { x0: 590, x1: 652, top: 86, bot: 356 };

const P_BLOCK = poly([[403, 300], [380, 296], [180, 296], [180, 134], [396, 134], [408, 128]]);
const P_BYPASS = poly([[440, 138], [458, 138], [458, 292], [437, 300]]);
const P_RAD = poly([[442, 121], [478, 121], [498, 97], [592, 97], [621, 104], [621, 340], [592, 346], [472, 346], [458, 330], [458, 310], [437, 300]]);
const RAD_CORE0 = P_RAD.sAt(4), RAD_CORE1 = P_RAD.sAt(5);
const P_HEAT = poly([[168, 120], [71, 120], [71, 152], [71, 260], [71, 380], [420, 380], [420, 318]]);
const HEAT0 = P_HEAT.sAt(2), HEAT1 = P_HEAT.sAt(3);

type Load = "ralenti" | "ruta" | "subida";
type Fault = "ninguna" | "cerrado" | "abierto" | "ventilador" | "bomba";
const LOADS: Record<Load, { q: number; rpm: number; v: number; label: string }> = {
  ralenti: { q: 5, rpm: 800, v: 0, label: "Ralentí (tráfico)" },
  ruta: { q: 26, rpm: 2600, v: 110, label: "Ruta 110 km/h" },
  subida: { q: 48, rpm: 3800, v: 55, label: "Subida con carga" },
};

const SIM = 20; // segundos reales por segundo de animación
const C_TH = 60; // capacidad térmica motor + refrigerante [kJ/K]
const T_OPEN = 88, T_FULL = 100, FAN_ON = 98, FAN_OFF = 94;
const P_ATM = 0.925; // Gran Mendoza, ~750 m [bar]
const CAP = 1.2; // tapa [bar]
const X_WATER = 0.76; // fracción molar de agua en una mezcla 50 % (Raoult)
const T_BOIL = boilWater((P_ATM + CAP) / X_WATER);

interface Sim {
  lastT: number; simTime: number; T: number; x: number; fan: boolean; tLow: number;
  ph: { block: number; bp: number; rad: number; heat: number; fan: number; pump: number };
}
const freshSim = (tAmb: number, now: number): Sim => ({
  lastT: now, simTime: 0, T: tAmb, x: 0, fan: false, tLow: tAmb,
  ph: { block: 0, bp: 0, rad: 0, heat: 0, fan: 0, pump: 0 },
});

export function CircuitoRefrigeracion() {
  const clock = useAnimClock({ speed: 1 });
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [tAmb, setTAmb] = useState(32);
  const [load, setLoad] = useState<Load>("ralenti");
  const [ac, setAc] = useState(false);
  const [heater, setHeater] = useState(false);
  const [fault, setFault] = useState<Fault>("ninguna");
  const sim = useRef<Sim | null>(null);
  if (!sim.current) sim.current = freshSim(tAmb, clock.t);
  const s = sim.current;

  const L = LOADS[load];
  const pumpEff = fault === "bomba" ? 0.22 : 1;
  const mdot = 0.3 * (L.rpm / 1000) * pumpEff; // kg/s
  const qIn = L.q + (ac ? 2 : 0); // kW
  const tAirRad = tAmb + (ac ? 8 : 0); // el condensador del A/C está adelante del radiador
  const ram = 0.02 + 0.98 * Math.pow(Math.min(1, L.v / 100), 0.8);

  /* ------------------------------------------------ integración (idempotente) */
  let dtA = clock.t - s.lastT;
  if (dtA < 0) { Object.assign(s, freshSim(tAmb, clock.t)); dtA = 0; }
  s.lastT = clock.t;
  dtA = Math.min(dtA, 0.1);
  let simDt = dtA * SIM;
  let qRad = 0, kAir = 0, kCool = 0, qHeat = 0;
  const fanAllowed = fault !== "ventilador";
  while (simDt > 1e-6) {
    const h = Math.min(0.5, simDt);
    simDt -= h;
    // termostato: la cera tarda en fundirse (τ ≈ 15 s)
    let xTarget = smoothstep(T_OPEN, T_FULL, s.T);
    if (fault === "cerrado") xTarget = 0.02;
    if (fault === "abierto") xTarget = 1;
    s.x += (xTarget - s.x) * (1 - Math.exp(-h / 15));
    if (fault === "abierto") s.x = 1;
    // ventilador: ECU con histéresis 98/94 °C; con A/C prendido arranca siempre
    if (s.T >= FAN_ON) s.fan = true;
    else if (s.T <= FAN_OFF) s.fan = false;
    const fanRun = fanAllowed && (s.fan || ac);
    const a = ram + (fanRun ? 0.5 * (1 - 0.6 * ram) : 0);
    kAir = 0.95 * a;
    kCool = mdot * s.x * 3.6;
    const kRad = kCool > 1e-4 ? 1 / (1 / kAir + 1 / kCool) : 0;
    qRad = kRad * (s.T - tAirRad);
    const mh = mdot * 0.15 * 3.6;
    const khAir = heater ? 0.09 : 0.012;
    const kHeat = 1 / (1 / khAir + 1 / Math.max(mh, 1e-4));
    qHeat = kHeat * (s.T - tAmb);
    const qLoss = 0.02 * (s.T - tAmb);
    s.T += ((qIn - qRad - qHeat - qLoss) / C_TH) * h;
    if (s.T > T_BOIL) s.T = T_BOIL;
    // manguera inferior (salida del radiador)
    const mRad = mdot * s.x;
    const target = mRad > 0.01 ? s.T - qRad / (mRad * 3.6) : tAirRad + 4;
    s.tLow += (target - s.tLow) * (1 - Math.exp(-h / (mRad > 0.01 ? 5 : 80)));
    s.simTime += h;
  }
  const T = s.T, x = s.x;
  const fanRun = fanAllowed && (s.fan || ac);
  const boiling = T >= T_BOIL - 0.05;

  // fases visuales (px/s de las partículas y giro)
  const vBlock = 22 + 70 * (mdot / 1.14);
  s.ph.block += vBlock * dtA;
  s.ph.bp += vBlock * (1 - x) * dtA * 0.9;
  s.ph.rad += vBlock * x * dtA * 1.1;
  s.ph.heat += vBlock * (heater ? 0.55 : 0.3) * dtA;
  s.ph.fan += (fanRun ? (ac && !s.fan ? 9 : 14) : 0) * dtA;
  s.ph.pump += (L.rpm / 800) * 5 * dtA * (fault === "bomba" ? 1 : 1);

  // temperaturas locales para pintar
  const mRad = mdot * x;
  const tIn = mdot > 0 ? (mRad * s.tLow + (mdot - mRad) * T) / mdot : T;
  const tRise = Math.min(30, qIn / Math.max(mdot * 3.6, 0.05));
  const tInBlock = Math.max(tAmb, Math.min(T, Math.max(tIn, T - tRise)));
  const mh = mdot * 0.15;
  const tHeatOut = T - Math.min(T - tAmb, qHeat / Math.max(mh * 3.6, 0.02));

  const resetSim = () => { Object.assign(s, freshSim(tAmb, clock.t)); clock.setPlaying(true); };

  // aguja del tablero "amortiguada": queda al medio entre ~75 y ~108 °C, como en muchos autos
  const gaugeFrac = T < 75 ? lerp(0, 0.5, clamp((T - 40) / 35, 0, 1)) : T < 108 ? 0.5 : lerp(0.5, 1, clamp((T - 108) / 18, 0, 1));
  const gA = Math.PI * (1 - gaugeFrac);

  const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  const tTone = T > T_BOIL - 6 ? "bad" : T > 108 ? "warn" : T >= 80 ? "ok" : undefined;

  let status: { txt: string; color: string };
  if (boiling) status = { txt: "¡El refrigerante hierve! Sale vapor por la tapa: pará, motor en ralentí con calefacción a fondo y esperá.", color: "var(--bad)" };
  else if (fault === "abierto" && s.simTime > 400 && T < 80) status = { txt: "Termostato trabado abierto: el motor no llega a temperatura (P0128).", color: "var(--warn)" };
  else if (x < 0.05) status = { txt: "Termostato cerrado: circuito corto (motor + calefacción). El motor se calienta rápido.", color: "var(--text-2)" };
  else if (x < 0.95) status = { txt: `Termostato abriendo (${fmt(x * 100, 0)} %): parte del agua pasa por el radiador.`, color: "var(--text-2)" };
  else status = { txt: "Termostato abierto del todo: todo el caudal pasa por el radiador.", color: T > 108 ? "var(--warn)" : "var(--text-2)" };

  const gid = `crg${uid}`;
  const particles = (p: ReturnType<typeof poly>, n: number, phase: number, tempAt: (u: number) => number, r = 3.4) =>
    Array.from({ length: n }, (_, i) => {
      const q = p.at(phase + (i * p.L) / n);
      return <circle key={i} cx={q.x} cy={q.y} r={r} style={{ fill: tempColor(tempAt(q.u)) }} stroke="var(--surface)" strokeWidth={0.8} />;
    });

  const hose = (d: string, w: number, T0: number, op = 1) => (
    <g opacity={op}>
      <path d={d} fill="none" stroke="var(--c-metal-2)" strokeWidth={w + 3} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" stroke="var(--surface)" strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
      <path d={d} fill="none" style={{ stroke: tempColor(T0) }} strokeOpacity={0.45} strokeWidth={w} strokeLinejoin="round" strokeLinecap="round" />
    </g>
  );

  return (
    <AnimFrame
      title="Circuito de refrigeración: arranque en frío, termostato y electroventilador"
      clock={clock}
      speeds={[0.5, 1, 2, 4]}
      controls={
        <>
          <button className="btn ghost sm" onClick={resetSim} title="Volver a arrancar con el motor frío">↺ Arranque en frío</button>
          <Slider label="Temp. ambiente" value={tAmb} min={-5} max={45} step={1} onChange={setTAmb} unit="°C" />
          <Seg value={load} onChange={setLoad} ariaLabel="Carga" options={(Object.keys(LOADS) as Load[]).map((k) => ({ value: k, label: LOADS[k].label }))} />
          <Toggle label="Aire acondicionado" checked={ac} onChange={setAc} />
          <Toggle label="Calefacción a fondo" checked={heater} onChange={setHeater} />
          <label className="ctl">
            <span>Falla</span>
            <select value={fault} onChange={(e) => setFault(e.target.value as Fault)}>
              <option value="ninguna">Ninguna</option>
              <option value="cerrado">Termostato trabado cerrado</option>
              <option value="abierto">Termostato trabado abierto</option>
              <option value="ventilador">Electroventilador no arranca</option>
              <option value="bomba">Bomba de agua con paletas rotas</option>
            </select>
          </label>
        </>
      }
      readouts={
        <>
          <Readout label="ECT (scanner)" value={fmt(T, 0)} unit="°C" tone={tTone} />
          <Readout label="Termostato" value={fmt(x * 100, 0)} unit="% abierto" tone={fault === "cerrado" || fault === "abierto" ? "bad" : undefined} />
          <Readout label="Ventilador" value={!fanAllowed ? "NO ANDA" : fanRun ? (ac && !s.fan ? "ON (A/C)" : "ON") : "OFF"} tone={!fanAllowed ? "bad" : fanRun ? "accent" : undefined} />
          <Readout label="Mang. inferior" value={fmt(s.tLow, 0)} unit="°C" />
          <Readout label="Calor al agua" value={fmt(qIn, 0)} unit="kW" />
          <Readout label="Hierve a" value={fmt(T_BOIL, 0)} unit="°C" />
          <Readout label="Tiempo real" value={fmtTime(s.simTime)} unit="min" />
        </>
      }
      legend={[
        { color: "var(--c-air)", label: "Refrigerante frío" },
        { color: "var(--c-flame)", label: "En temperatura (~90 °C)" },
        { color: "var(--c-hot)", label: "Muy caliente" },
        { color: "var(--c-elec)", label: "Señales (ECT, ventilador, tablero)" },
      ]}
      caption={
        <>
          <p>
            Arranca en frío y mirá cómo el agua da vueltas <b>sólo por el motor y la calefacción</b> mientras el termostato está cerrado:
            así llega rápido a temperatura. Cerca de los <b>{T_OPEN} °C</b> la cera del termostato se funde, empieza a abrir y el agua
            caliente va al radiador (fijate la diferencia entre la manguera de arriba y la de abajo). Si aun así sube a <b>{FAN_ON} °C</b>,
            la ECU prende el electroventilador y lo apaga a {FAN_OFF} °C. El reloj corre {SIM} veces más rápido que en la realidad
            (y el punto de ebullición es el de una tapa de 1,2 bar con refrigerante 50 % en el Gran Mendoza).
          </p>
          <p>
            Probá las fallas: con el <b>termostato trabado cerrado</b> hierve aunque el radiador esté perfecto; <b>trabado abierto</b>, en
            ruta y con frío no pasa de 40–60 °C; <b>sin ventilador</b> anda bien en ruta pero se recalienta parado en el tráfico; con la
            <b> bomba rota</b> el motor y la manguera de arriba hierven mientras la de abajo está bastante más fría. La aguja del tablero está
            “amortiguada” (queda al medio entre ~75 y ~108 °C, como en muchos autos): el dato real lo ves en el ECT por scanner.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 420" role="img" aria-label="Esquema del circuito de refrigeración">
        <defs>
          <linearGradient id={`${gid}core`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: tempColor(lerp(lerp(s.tLow, T, 0.3), T, clamp(x * 6, 0, 1))) }} />
            <stop offset="1" style={{ stopColor: tempColor(s.tLow) }} />
          </linearGradient>
          <linearGradient id={`${gid}heat`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: tempColor(T) }} />
            <stop offset="1" style={{ stopColor: tempColor(tHeatOut) }} />
          </linearGradient>
        </defs>

        {/* ---------- tablero */}
        <rect x={18} y={14} width={124} height={88} rx={10} fill="var(--surface-2)" stroke="var(--border)" />
        <text x={80} y={29} textAnchor="middle" className="svg-small">aguja del tablero</text>
        <path d={`M${80 - 42},84 A42,42 0 0 1 ${80 + 42},84`} fill="none" stroke="var(--border-strong)" strokeWidth={7} />
        <path d={`M${80 + 42 * Math.cos(Math.PI * 0.2)},${84 - 42 * Math.sin(Math.PI * 0.2)} A42,42 0 0 1 ${80 + 42},84`} fill="none" stroke="var(--bad)" strokeWidth={7} />
        <text x={33} y={97} className="svg-small" style={{ fill: "var(--c-air)", fontWeight: 700 }}>C</text>
        <text x={121} y={97} className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>H</text>
        <line x1={80} y1={84} x2={80 + 36 * Math.cos(gA)} y2={84 - 36 * Math.sin(gA)} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={80} cy={84} r={4.5} fill="var(--text)" />

        {/* ---------- ECU y cables */}
        <line x1={142} y1={36} x2={290} y2={36} stroke="var(--c-elec)" strokeWidth={1.4} strokeDasharray="5 3" />
        <text x={216} y={31} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-elec)" }}>CAN → tablero</text>
        <path d={`M416,104 L416,36 L360,36`} fill="none" stroke="var(--c-elec)" strokeWidth={1.4} />
        <path d={`M325,20 L325,8 L${FAN.x},8 L${FAN.x},${FAN.y - FAN.r - 2}`} fill="none" stroke="var(--c-elec)" strokeWidth={1.4} strokeDasharray={fanRun ? undefined : "2 4"} opacity={fanAllowed ? 1 : 0.4} />
        <rect x={290} y={20} width={70} height={32} rx={6} fill="var(--surface-2)" stroke="var(--c-elec)" strokeWidth={1.5} />
        <text x={325} y={41} textAnchor="middle" className="svg-mono" style={{ fill: "var(--c-elec)" }}>ECU</text>
        <text x={404} y={98} textAnchor="end" className="svg-small" style={{ fill: "var(--c-elec)", fontWeight: 700 }}>ECT</text>

        {/* ---------- líneas del depósito (detrás) */}
        <path d="M640,86 L640,50 L528,50" fill="none" stroke="var(--c-metal-2)" strokeWidth={3.5} />
        <path d="M472,72 L472,346" fill="none" stroke="var(--c-metal-2)" strokeWidth={3.5} />

        {/* ---------- mangueras */}
        {hose(P_RAD.d, 9, lerp(lerp(s.tLow, T, 0.35), (T + s.tLow) / 2, clamp(x * 6, 0, 1)))}
        {hose(P_BYPASS.d, 7, T, fault === "abierto" ? 0.45 : 1)}
        {hose(P_HEAT.d, 6, (T + tHeatOut) / 2)}

        {/* ---------- motor */}
        <rect x={168} y={108} width={224} height={40} rx={6} fill="var(--c-metal-2)" />
        <rect x={168} y={146} width={224} height={186} rx={6} fill="var(--c-block)" stroke="var(--c-metal-2)" />
        <rect x={176} y={126} width={210} height={178} rx={5} style={{ fill: tempColor((T + tInBlock) / 2) }} opacity={0.28} />
        {[207, 255, 303, 351].map((cx, i) => {
          const fl = 0.35 + 0.25 * Math.sin(clock.t * (L.rpm / 120) + i * 1.7);
          return (
            <g key={cx}>
              <rect x={cx - 19} y={154} width={38} height={130} rx={4} fill="var(--c-metal-dark)" />
              <rect x={cx - 15} y={158} width={30} height={50} rx={3} fill="var(--c-hot)" opacity={(0.25 + 0.5 * (L.q / 48)) * fl} />
            </g>
          );
        })}
        <text x={280} y={322} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>motor: camisas de agua en block y tapa</text>
        <text x={280} y={124} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-metal-light)" }}>tapa de cilindros</text>

        {/* ---------- calefacción */}
        <text x={78} y={144} className="svg-small" style={{ fill: "var(--text-2)" }}>calefacción</text>
        <rect x={34} y={152} width={74} height={108} rx={6} fill={`url(#${gid}heat)`} opacity={0.8} stroke="var(--c-metal-2)" />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} x1={36} x2={106} y1={162 + i * 11} y2={162 + i * 11} stroke="var(--c-metal-light)" strokeWidth={1} opacity={0.7} />
        ))}
        {heater && [0, 1, 2].map((i) => {
          const k = (clock.t * 0.9 + i / 3) % 1;
          return <Arrow key={`h${i}`} x1={34} y1={172 + i * 34} x2={8} y2={172 + i * 34 - 2} color="var(--c-hot)" width={2} head={7} opacity={0.3 + 0.6 * (1 - k)} />;
        })}
        <text x={78} y={276} className="svg-small">(habitáculo)</text>

        {/* ---------- depósito de expansión */}
        {(() => {
          const lvl = clamp(0.35 + (T - 20) * 0.0035, 0.3, 0.75);
          return (
            <g>
              <rect x={462} y={22} width={66} height={50} rx={8} fill="var(--surface)" stroke="var(--c-metal-2)" strokeWidth={1.5} />
              <rect x={464} y={22 + 48 * (1 - lvl)} width={62} height={48 * lvl} rx={6} style={{ fill: tempColor(T - 10) }} opacity={0.55} />
              <line x1={462} x2={470} y1={40} y2={40} stroke="var(--muted)" />
              <line x1={462} x2={470} y1={58} y2={58} stroke="var(--muted)" />
              <rect x={484} y={14} width={22} height={9} rx={2} fill="var(--c-metal-dark)" />
              <text x={495} y={36} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>depósito</text>
              {boiling && [0, 1, 2, 3].map((i) => {
                const k = (clock.t * 0.7 + i / 4) % 1;
                return <circle key={i} cx={495 + Math.sin(i * 2 + clock.t * 2) * 8} cy={12 - k * 30} r={4 + k * 8} fill="var(--muted)" opacity={0.5 * (1 - k)} />;
              })}
            </g>
          );
        })()}

        {/* ---------- radiador */}
        <rect x={RAD.x0} y={RAD.top} width={RAD.x1 - RAD.x0} height={20} rx={4} fill="var(--c-metal-dark)" />
        <rect x={RAD.x0} y={RAD.bot - 20} width={RAD.x1 - RAD.x0} height={20} rx={4} fill="var(--c-metal-dark)" />
        <rect x={RAD.x0 + 6} y={RAD.top + 20} width={RAD.x1 - RAD.x0 - 12} height={RAD.bot - RAD.top - 40} fill={`url(#${gid}core)`} opacity={x > 0.02 ? 0.85 : 0.35} />
        {Array.from({ length: 8 }, (_, i) => (
          <line key={i} x1={RAD.x0 + 10 + i * 6.3} x2={RAD.x0 + 10 + i * 6.3} y1={RAD.top + 20} y2={RAD.bot - 20} stroke="var(--c-metal-2)" strokeWidth={1.4} />
        ))}
        {Array.from({ length: 22 }, (_, i) => (
          <line key={i} x1={RAD.x0 + 6} x2={RAD.x1 - 6} y1={RAD.top + 26 + i * 10.6} y2={RAD.top + 26 + i * 10.6} stroke="var(--c-metal-light)" strokeWidth={0.6} opacity={0.6} />
        ))}
        <text x={621} y={374} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>radiador</text>
        <text x={659} y={84} className="svg-small">tapa</text>
        <text x={659} y={95} className="svg-small">{fmt(CAP, 1)} bar</text>

        {/* aire de marcha y del ventilador */}
        {(() => {
          const aMarch = clamp(ram, 0, 1);
          const aFan = fanRun ? 0.5 : 0;
          const a = clamp(aMarch + aFan * (1 - 0.6 * aMarch), 0, 1.2);
          return (
            <g>
              {[140, 190, 240, 290].map((y, i) => {
                const k = (clock.t * (0.6 + a) + i * 0.27) % 1;
                return (
                  <g key={y}>
                    <Arrow x1={712 - k * 14} y1={y} x2={666 - k * 14} y2={y} color="var(--c-air)" width={2.2} head={8} opacity={a > 0.05 ? 0.25 + 0.6 * Math.min(1, a) : 0.12} />
                  </g>
                );
              })}
              {a > 0.05 && [200, 244].map((y, i) => (
                <Arrow key={y} x1={514} y1={y} x2={492 - i * 4} y2={y + (i ? 8 : -8)} color="var(--c-air)" width={1.6} head={6} opacity={0.25 + 0.3 * Math.min(1, a)} />
              ))}
              <text x={690} y={130} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-air)" }}>aire</text>
            </g>
          );
        })()}

        {/* ---------- electroventilador */}
        <circle cx={FAN.x} cy={FAN.y} r={FAN.r + 4} fill="none" stroke="var(--c-metal-2)" strokeWidth={3} />
        <g transform={`rotate(${(s.ph.fan * 180) / Math.PI} ${FAN.x} ${FAN.y})`}>
          {[0, 1, 2, 3, 4].map((i) => (
            <ellipse key={i} cx={FAN.x} cy={FAN.y - 16} rx={7} ry={15} fill="var(--c-metal-dark)" opacity={0.92}
              transform={`rotate(${i * 72} ${FAN.x} ${FAN.y})`} />
          ))}
        </g>
        <circle cx={FAN.x} cy={FAN.y} r={7} fill={fanRun ? "var(--accent)" : "var(--c-metal)"} />
        {!fanAllowed && <path d={`M${FAN.x - 26},${FAN.y - 26} L${FAN.x + 26},${FAN.y + 26} M${FAN.x + 26},${FAN.y - 26} L${FAN.x - 26},${FAN.y + 26}`} stroke="var(--bad)" strokeWidth={3} opacity={0.75} />}
        <text x={FAN.x - 4} y={FAN.y + FAN.r + 22} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>electroventilador</text>

        {/* ---------- bypass label */}
        <text x={446} y={216} className="svg-small" transform="rotate(-90 446 216)" textAnchor="middle">bypass (circuito corto)</text>

        {/* ---------- partículas */}
        {particles(P_HEAT, 15, s.ph.heat, (u) => (u < HEAT0 ? T : u < HEAT1 ? lerp(T, tHeatOut, (u - HEAT0) / (HEAT1 - HEAT0)) : tHeatOut), 2.8)}
        {fault !== "abierto" && x < 0.98 && particles(P_BYPASS, 6, s.ph.bp, () => T)}
        {x > 0.03 && particles(P_RAD, 15, s.ph.rad, (u) => (u < RAD_CORE0 ? T : u < RAD_CORE1 ? lerp(T, s.tLow, (u - RAD_CORE0) / (RAD_CORE1 - RAD_CORE0)) : s.tLow))}
        {particles(P_BLOCK, 17, s.ph.block, (u) => lerp(tInBlock, T, u / P_BLOCK.L))}

        {/* ---------- bomba de agua */}
        <circle cx={PUMP.x} cy={PUMP.y} r={18} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {Array.from({ length: fault === "bomba" ? 2 : 6 }, (_, i) => {
          const a = s.ph.pump + (i * TAU) / 6;
          const r1 = fault === "bomba" ? 8 : 14;
          return <line key={i} x1={PUMP.x + 4 * Math.cos(a)} y1={PUMP.y + 4 * Math.sin(a)} x2={PUMP.x + r1 * Math.cos(a)} y2={PUMP.y + r1 * Math.sin(a)} stroke={fault === "bomba" ? "var(--bad)" : "var(--c-metal-dark)"} strokeWidth={3} strokeLinecap="round" />;
        })}
        <circle cx={PUMP.x} cy={PUMP.y} r={3.5} fill="var(--c-metal-dark)" />
        <text x={398} y={352} textAnchor="end" className="svg-small" style={{ fill: "var(--text-2)" }}>bomba de agua</text>

        {/* ---------- caja del termostato */}
        <rect x={HOUS.x - 18} y={HOUS.y - 16} width={36} height={32} rx={5} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <line x1={HOUS.x + 10} y1={HOUS.y - 14} x2={HOUS.x + 10} y2={HOUS.y + 14} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <rect x={HOUS.x + 6 + x * 7} y={HOUS.y - 9} width={4} height={13} rx={1} fill={fault === "cerrado" || fault === "abierto" ? "var(--bad)" : "var(--accent)"} />
        <rect x={HOUS.x - 6} y={HOUS.y - 5} width={10} height={10} rx={3} fill="var(--c-fuel)" opacity={0.5 + 0.5 * x} />
        <rect x={412} y={100} width={8} height={12} rx={2} fill="var(--c-elec)" />
        <text x={HOUS.x} y={HOUS.y + 32} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>termostato</text>

        {/* ---------- estado */}
        <text x={360} y={406} textAnchor="middle" className="svg-label" style={{ fill: status.color }}>{status.txt}</text>
      </svg>
    </AnimFrame>
  );
}
