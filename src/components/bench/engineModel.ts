/* ==========================================================================
   Modelo de un motor naftero 1.6 de 4 cilindros, inyección multipunto
   secuencial, con su ECU: control de ralentí, avance, corte en desaceleración,
   lazo cerrado con sonda de banda angosta, correcciones de corto y largo plazo,
   monitores OBD con códigos de falla y prueba de balance de cilindros.

   Es puro (no usa React ni el DOM): se puede correr y testear en Node.
   Los números son típicos de un 1.6 multipunto con MAF, no de un auto puntual.

   Física (resumida):
   - Aire: caudal por la mariposa (flujo compresible, se "ahoga" con mucho vacío)
     = caudal que bombea el motor (VE · cilindrada · rpm/120 · densidad). De ahí
     sale la presión del múltiple (MAP).
   - Cada 180° de cigüeñal se quema un cilindro (orden 1-3-4-2). Su torque depende
     del aire que entró, de la mezcla (λ) y del avance. Si falla, no hay torque y
     el aire con nafta sin quemar va al escape (la sonda ve "pobre").
   - Las temperaturas y la batería corren con el tiempo acelerado (para no esperar
     10 minutos a que caliente el motor).
   ========================================================================== */

export type FaultId =
  | "none" | "vacio" | "inyector3" | "bobina2" | "termostato" | "ect"
  | "maf" | "sonda" | "nafta" | "catalizador" | "alternador";

export const FAULT_IDS: FaultId[] = [
  "vacio", "inyector3", "bobina2", "termostato", "ect", "maf", "sonda", "nafta", "catalizador", "alternador",
];

export type Situation = "neutral" | "dyno";

export interface EngineInputs {
  /** pedal del acelerador 0–100 % */
  pedal: number;
  situation: Situation;
  /** vueltas que sostiene el banco de rodillos (sólo en "dyno") */
  dynoRpm: number;
  /** presión barométrica [kPa] */
  baro: number;
  /** temperatura ambiente [°C] */
  ambient: number;
  fault: FaultId;
}

export const ALTITUDES = [
  { id: "mar", label: "Nivel del mar", short: "0 m", m: 0, kPa: 101.3 },
  { id: "mza", label: "Mendoza", short: "750 m", m: 750, kPa: 92.5 },
  { id: "usp", label: "Uspallata", short: "1.900 m", m: 1900, kPa: 81.0 },
  { id: "cue", label: "Las Cuevas", short: "3.150 m", m: 3150, kPa: 69.5 },
] as const;
export type AltitudeId = (typeof ALTITUDES)[number]["id"];

/* ------------------------------------------------------------- códigos */
export const DTC_INFO: Record<string, { desc: string; mil: boolean }> = {
  P0101: { desc: "Caudalímetro (MAF): fuera de rango / funcionamiento", mil: true },
  P0117: { desc: "Sensor de temperatura del refrigerante: señal baja (en corto)", mil: true },
  P0118: { desc: "Sensor de temperatura del refrigerante: señal alta (circuito abierto)", mil: true },
  P0128: { desc: "Refrigerante por debajo de la temperatura del termostato", mil: true },
  P0133: { desc: "Sonda lambda (banco 1, sensor 1): respuesta lenta", mil: true },
  P0171: { desc: "Mezcla demasiado pobre (banco 1)", mil: true },
  P0172: { desc: "Mezcla demasiado rica (banco 1)", mil: true },
  P0300: { desc: "Fallo de encendido aleatorio / en varios cilindros", mil: true },
  P0301: { desc: "Fallo de encendido detectado en el cilindro 1", mil: true },
  P0302: { desc: "Fallo de encendido detectado en el cilindro 2", mil: true },
  P0303: { desc: "Fallo de encendido detectado en el cilindro 3", mil: true },
  P0304: { desc: "Fallo de encendido detectado en el cilindro 4", mil: true },
  P0562: { desc: "Tensión del sistema baja", mil: true },
};

export interface Dtc { code: string; state: "pendiente" | "confirmado"; t: number }

export interface FreezeFrame {
  code: string; rpm: number; ect: number; load: number; map: number; stft: number; ltft: number; vss: number; loop: string;
}

export interface BalanceTest {
  cyl: number;              // 0..3 (cilindro 1..4)
  stage: "base" | "cut";
  t: number;
  sumBase: number; nBase: number;
  sumCut: number; nCut: number;
  base: number[]; drops: number[];
  idleAir: number; idleSpark: number;
  done: boolean;
}

export type LoopState = "abierto-frio" | "cerrado" | "abierto-carga" | "dfco" | "abierto-falla" | "corte-rpm" | "apagado" | "balance";

export interface EngineState {
  t: number;
  phase: "off" | "crank" | "run";
  stalled: boolean;
  crankT: number;
  tRun: number;
  coldStart: boolean;
  startEct: number;
  omega: number;        // rad/s
  rpmF: number;         // rpm filtradas (lo que muestra el scanner)
  crankDeg: number;     // acumulador de 180°
  evIdx: number;
  tInd: number;         // torque indicado del último cilindro que quemó (equiv. motor) [Nm]
  tBrakeF: number;      // torque al freno filtrado [Nm]
  ectTrue: number;
  iat: number;
  catT: number;
  map: number;          // kPa
  airTot: number;       // g/s que entran a los cilindros
  mafF: number;         // g/s que pasan por el caudalímetro (filtrado)
  throttle: number;     // % apertura de la mariposa
  idleAir: number;      // % de apertura que pone el control de ralentí
  idleSpark: number;    // ° que suma/resta el control de ralentí
  dash: number;         // % extra de mariposa al soltar el pedal (amortiguador)
  adv: number;
  mbt: number;
  stft: number;
  stftAvg: number;
  ltft: [number, number, number];   // celdas: ralentí, carga parcial, carga alta
  closedLoop: boolean;
  clTime: number;
  loop: LoopState;
  dfco: boolean;
  revCut: boolean;
  o2V: number;
  o2Heat: number;       // 0..1
  o2Rich: boolean;
  o2Hi: boolean;        // estado con histéresis (para contar conmutaciones)
  switches: number[];   // tiempos de cruce de 0,45 V (últimos 12 s)
  exhInv: number;       // promedio de 1/λ de los gases (mezcla de cilindros)
  lamHist: Float32Array; lamTime: Float32Array; lamPtr: number;
  injMs: number;
  fuelCmd: number;      // g por cilindro por ciclo (lo que manda la ECU)
  fuelRate: number;     // g/s reales
  battV: number;
  soc: number;
  fuelP: number;
  misCount: [number, number, number, number];
  misRate: [number, number, number, number];
  lastFire: [number, number, number, number];
  lastMis: [number, number, number, number];
  cut: [boolean, boolean, boolean, boolean];
  catFuel: number;      // g/s de nafta sin quemar que llega al catalizador
  fan: boolean;
  ectFail: boolean;
  dtc: Record<string, Dtc>;
  timers: Record<string, number>;
  freeze: FreezeFrame | null;
  milBlink: boolean;
  balance: BalanceTest | null;
  loadPct: number;
  pBack: number;
  rng: number;
}

/* ---------------------------------------------------------- constantes */
const TAU = Math.PI * 2;
const VD = 0.0016;          // cilindrada [m³]
const RAIR = 287;
const STOICH = 14.7;
const INJ_G_PER_MS = 0.00265; // caudal del inyector a 3,5 bar [g/ms]
const P_NOM = 3.5;          // presión de nafta nominal [bar] (sin retorno)
const KT = 375;             // Nm (equiv. motor) por gramo de aire por cilindro y ciclo
const FIRING = [0, 2, 3, 1]; // 1-3-4-2
const THERMAL_ACCEL = 9;    // el calentamiento corre ~9 veces más rápido
const BATT_ACCEL = 60;
const ECT_SUBST = 20;       // valor de reemplazo de ECT cuando el sensor falla

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const lag = (cur: number, target: number, h: number, tau: number) => cur + (target - cur) * (1 - Math.exp(-h / tau));

/** Eficiencia volumétrica según rpm (sin el efecto del vacío). */
export function veRpm(rpm: number) {
  return 0.76 + 0.17 * Math.exp(-(((rpm - 4300) / 2700) ** 2));
}
/** Función de flujo compresible por una restricción (mariposa). */
export function psi(pr: number) {
  if (pr <= 0.528) return 0.6847;
  const g = 1.4;
  const v = (2 * g / (g - 1)) * (Math.pow(pr, 2 / g) - Math.pow(pr, (g + 1) / g));
  return Math.sqrt(Math.max(0, v));
}
/** Torque relativo según la mezcla del cilindro. */
function fLambda(l: number) {
  if (l >= 0.9) return Math.max(0, 1.03 - 1.8 * (l - 0.9) ** 2);
  return Math.max(0, 1.03 - 3 * (0.9 - l) ** 2);
}
/** Cuánto de la nafta inyectada llega a quemarse según la temperatura (se moja en las paredes frías). */
function evap(t: number) { return 0.84 + 0.16 * clamp(t / 85, 0, 1); }
/** NTC del ECT: resistencia [Ω] */
export function ectOhms(tC: number) { return 2050 * Math.exp(3500 * (1 / (tC + 273.15) - 1 / 298.15)); }
/** Tensión de señal del ECT con pull-up de 2,49 kΩ a 5 V */
export function ectVolts(tC: number) { const r = ectOhms(tC); return 5 * r / (r + 2490); }
function ectFromVolts(v: number) {
  if (v >= 4.9) return -40;
  if (v <= 0.08) return 140;
  const r = 2490 * v / (5 - v);
  const t = 1 / (Math.log(r / 2050) / 3500 + 1 / 298.15) - 273.15;
  return clamp(t, -40, 140);
}

function rand(s: EngineState) {
  // mulberry32
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss(s: EngineState) {
  const u = Math.max(1e-9, rand(s)), v = rand(s);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

/* -------------------------------------------------------------- estado */
export function createEngine(inp: EngineInputs, seed = 12345): EngineState {
  const s: EngineState = {
    t: 0, phase: "run", stalled: false, crankT: 0, tRun: 300, coldStart: false, startEct: 90,
    omega: (800 / 60) * TAU, rpmF: 800, crankDeg: 0, evIdx: 0, tInd: 30, tBrakeF: 0,
    ectTrue: 90, iat: inp.ambient + 12, catT: 450, map: 33, airTot: 2.8, mafF: 2.8,
    throttle: 7, idleAir: 7, idleSpark: 0, dash: 0, adv: 10, mbt: 30,
    stft: 0, stftAvg: 0, ltft: [0, 0, 0], closedLoop: true, clTime: 100, loop: "cerrado", dfco: false, revCut: false,
    o2V: 0.45, o2Heat: 1, o2Rich: false, o2Hi: false, switches: [], exhInv: 1,
    lamHist: new Float32Array(256).fill(1), lamTime: new Float32Array(256), lamPtr: 0,
    injMs: 3, fuelCmd: 0.0065, fuelRate: 0.19, battV: 14.2, soc: 1, fuelP: P_NOM,
    misCount: [0, 0, 0, 0], misRate: [0, 0, 0, 0], lastFire: [-1, -1, -1, -1], lastMis: [-9, -9, -9, -9],
    cut: [false, false, false, false], catFuel: 0, fan: false, ectFail: false,
    dtc: {}, timers: {}, freeze: null, milBlink: false, balance: null, loadPct: 25, pBack: inp.baro, rng: seed,
  };
  return s;
}

/** Arranque: en frío (todo a temperatura ambiente) o en caliente. */
export function startEngine(s: EngineState, inp: EngineInputs, cold: boolean) {
  if (cold) {
    s.ectTrue = inp.ambient; s.iat = inp.ambient; s.catT = inp.ambient; s.o2Heat = 0;
  }
  s.phase = "crank"; s.stalled = false; s.crankT = 0; s.tRun = 0; s.coldStart = cold || s.ectTrue < 45;
  s.startEct = s.ectTrue; s.omega = 0; s.map = inp.baro; s.idleAir = 16; s.idleSpark = 0;
  s.stft = 0; s.stftAvg = 0; s.clTime = 0; s.balance = null; s.dfco = false; s.revCut = false;
}

export function stopEngine(s: EngineState) {
  s.phase = "off"; s.balance = null; s.dfco = false;
}

export function clearCodes(s: EngineState) {
  s.dtc = {}; s.timers = {}; s.freeze = null; s.milBlink = false;
  s.misCount = [0, 0, 0, 0]; s.misRate = [0, 0, 0, 0];
  s.ltft = [0, 0, 0]; s.stft = 0; s.stftAvg = 0; s.ectFail = false; s.clTime = 0;
}

export function startBalance(s: EngineState, inp: EngineInputs): string | null {
  if (s.phase !== "run") return "Primero arrancá el motor.";
  if (inp.situation !== "neutral") return "La prueba se hace en punto muerto (sin el banco de rodillos).";
  if (inp.pedal > 0.5) return "Soltá el acelerador: la prueba se hace en ralentí.";
  if (s.rpmF > 1300) return "Esperá a que baje a ralentí.";
  s.balance = {
    cyl: 0, stage: "base", t: 0, sumBase: 0, nBase: 0, sumCut: 0, nCut: 0,
    base: [], drops: [], idleAir: s.idleAir, idleSpark: s.idleSpark, done: false,
  };
  return null;
}
export const BALANCE_BASE_S = 1.3;
export const BALANCE_CUT_S = 2.4;

/* ----------------------------------------------------------- un paso */
export function stepEngine(s: EngineState, inp: EngineInputs, dt: number) {
  let rest = dt;
  while (rest > 1e-7) {
    const h = Math.min(0.004, rest);
    substep(s, inp, h);
    rest -= h;
  }
}

function substep(s: EngineState, inp: EngineInputs, h: number) {
  const fault = inp.fault;
  s.t += h;
  const baro = inp.baro;
  const amb = inp.ambient;
  const rpm = (s.omega * 60) / TAU;
  const running = s.phase !== "off";
  const pedal = clamp(inp.pedal, 0, 100);

  /* ---------- sensores que lee la ECU */
  const ectV = fault === "ect" ? 4.98 : ectVolts(s.ectTrue);
  const ectRead = ectFromVolts(ectV);
  const ectUsed = s.ectFail ? ECT_SUBST : ectRead;

  /* ---------- electroventilador (lo comanda la ECU) */
  if (s.ectFail) s.fan = true;
  else if (ectUsed >= 98) s.fan = true;
  else if (ectUsed <= 93) s.fan = false;

  /* ---------- temperaturas (tiempo acelerado) */
  const vss = inp.situation === "dyno" && running ? rpm * 0.0225 : 0;
  {
    const qIn = running ? s.fuelRate * 43 * 0.28 : 0;                     // kW al refrigerante
    const x = fault === "termostato" ? 1 : smooth(84, 97, s.ectTrue);       // apertura del termostato
    const airflow = 0.035 + (s.fan ? 0.35 : 0) + (vss / 120) * 0.8;
    const qRad = x * 1.1 * airflow * (s.ectTrue - amb);
    const qLoss = 0.015 * (s.ectTrue - amb);
    s.ectTrue += ((qIn - qRad - qLoss) / 16) * THERMAL_ACCEL * h;
    const iatT = amb + 3 + 14 * clamp((s.ectTrue - amb) / 70, 0, 1) * (1 - clamp(s.airTot / 25, 0, 0.85));
    s.iat = lag(s.iat, iatT, h * THERMAL_ACCEL, 25);
    const catTarget = running && s.phase === "run"
      ? 320 + 70 * Math.sqrt(Math.max(0, s.airTot)) + 320 * (1 - Math.exp(-s.catFuel / 0.2))
      : amb;
    s.catT = lag(s.catT, catTarget, h * THERMAL_ACCEL, running ? 40 : 160);
    if (running) s.o2Heat = Math.min(1, s.o2Heat + h / 9);
    else s.o2Heat = Math.max(0, s.o2Heat - h / 60);
  }

  /* ---------- batería y alternador */
  {
    const iLoad = 14 + (s.fan ? 12 : 0);
    const charging = fault !== "alternador" && s.phase === "run" && rpm > 500;
    if (charging) {
      s.soc = Math.min(1, s.soc + (h * BATT_ACCEL * 25) / (45 * 3600));
      const vReg = 14.3 - (s.fan ? 0.12 : 0) - (rpm < 900 ? 0.1 : 0);
      s.battV = lag(s.battV, vReg + (rand(s) - 0.5) * 0.03, h, 0.25);
    } else {
      const drain = s.phase === "off" ? 0.5 : iLoad;
      s.soc = Math.max(-0.4, s.soc - (h * BATT_ACCEL * drain) / (45 * 3600));
      const ocv = 11.9 + 0.75 * s.soc;
      let v = ocv - drain * 0.012;
      if (s.phase === "crank") v = ocv - 2.3 - 0.35 * Math.max(0, Math.sin((s.crankDeg / 180) * Math.PI));
      s.battV = lag(s.battV, v, h, s.phase === "crank" ? 0.03 : 0.25);
    }
    if (s.phase === "crank" && fault !== "alternador") {
      const v = 12.6 - 2.3 - 0.35 * Math.max(0, Math.sin((s.crankDeg / 180) * Math.PI));
      s.battV = lag(s.battV, v, h, 0.03);
    }
  }

  /* ---------- presión de nafta (manómetro) */
  {
    const nominal = running ? P_NOM : (s.phase === "off" ? Math.max(0, s.fuelP - h * 0.02) : P_NOM);
    const target = fault === "nafta" && running ? Math.max(0.8, 2.9 - 0.42 * s.fuelRate) : nominal;
    s.fuelP = lag(s.fuelP, target, h, 0.15);
  }

  if (s.phase === "off") {
    s.omega = Math.max(0, s.omega - h * 120);
    s.map = lag(s.map, baro, h, 0.4);
    s.airTot = lag(s.airTot, 0, h, 0.2); s.mafF = lag(s.mafF, 0, h, 0.2);
    s.rpmF = lag(s.rpmF, (s.omega * 60) / TAU, h, 0.1);
    s.injMs = 0; s.fuelRate = 0; s.closedLoop = false; s.stft = 0; s.loop = "apagado";
    s.throttle = lag(s.throttle, pedal * 0.9, h, 0.05);
    s.o2V = lag(s.o2V, s.o2Heat > 0.5 ? 0.1 : 0.45, h, 1.5);
    s.tInd = 0; s.tBrakeF = 0; s.catFuel = 0; s.loadPct = 0;
    return;
  }

  if (s.phase === "crank") s.crankT += h;
  else s.tRun += h;

  /* ---------- control de ralentí y mariposa motorizada */
  const ectForIdle = s.ectFail ? ECT_SUBST : ectRead;
  let idleTarget = 800 + 380 * clamp((80 - ectForIdle) / 70, 0, 1);
  const catHeating = s.coldStart && s.tRun < 22 && s.startEct < 45;
  if (catHeating) idleTarget += 120;
  if (s.battV < 12.4 && s.phase === "run") idleTarget += 80; // sube el ralentí para ayudar a cargar
  const idleMode = pedal < 0.5 && !(inp.situation === "dyno" && rpm > 1100);
  const bal = s.balance && !s.balance.done ? s.balance : null; // prueba de balance en curso
  if (s.phase === "run" && idleMode && !bal) {
    const err = clamp(idleTarget - s.rpmF, -600, 600);
    // mientras actúa el amortiguador (recién soltaste el pedal) no cierra el paso de aire
    if (s.dash < 0.4 || err > 0) s.idleAir = clamp(s.idleAir + (err > 0 ? 0.009 : 0.0045) * err * h, 2.5, 32);
    s.idleSpark = clamp(0.03 * err, -6, 9);
  } else if (bal) {
    s.idleAir = bal.idleAir; s.idleSpark = bal.idleSpark;
  }
  if (s.phase === "crank") s.idleAir = 10 + 4 * clamp((40 - s.ectTrue) / 50, 0, 1);
  const pedalThr = 100 * Math.pow(pedal / 100, 1.8);
  if (pedal >= 0.5) s.dash = Math.max(s.dash, Math.min(6, 1.2 + pedalThr * 0.12));
  else s.dash = lag(s.dash, 0, h, 1.1);
  const thrTarget = Math.min(100, s.idleAir + s.dash + pedalThr * (1 - s.idleAir / 100));
  s.throttle = lag(s.throttle, thrTarget, h, 0.045);

  /* ---------- aire: mariposa + pérdida de vacío = lo que bombea el motor */
  const aTh = 0.6 + 1500 * Math.pow(s.throttle / 100, 1.8);   // mm²
  const aLeak = fault === "vacio" ? 3.3 : 0;
  const aTot = aTh + aLeak;
  const T = s.iat + 273.15;
  const cExh = fault === "catalizador" ? 0.55 : 0.0035;
  s.pBack = baro + Math.min(260, cExh * s.airTot * s.airTot);
  const extraBack = s.pBack - baro - Math.min(260, 0.0035 * s.airTot * s.airTot);
  const catPenalty = 1 / (1 + (0.55 * extraBack) / Math.max(20, s.map));
  const kEng = veRpm(Math.max(rpm, 60)) * catPenalty * VD * (Math.max(rpm, 0) / 120) / (RAIR * T); // kg/s por Pa (sin el factor de vacío)
  const thrK = (aTot * 1e-6) / Math.sqrt(RAIR * T);
  // lo que bombea el motor es proporcional a (MAP − P0): con mucho vacío vuelve gas de escape al cilindro
  const P0 = 8, kRes = 100 / (100 - P0);
  let lo = 0.02, hi = 1;
  for (let i = 0; i < 28; i++) {
    const pr = (lo + hi) / 2;
    const mThr = thrK * psi(pr) * baro * 1000;
    const mEng = kEng * kRes * Math.max(0, pr * baro - P0) * 1000;
    if (mThr > mEng) lo = pr; else hi = pr;
  }
  const mapT = ((lo + hi) / 2) * baro;
  s.map = lag(s.map, mapT, h, 0.035);
  s.airTot = kEng * kRes * Math.max(0, s.map - P0) * 1e6; // g/s
  const mafTrue = s.airTot * (aTh / aTot);
  s.mafF = lag(s.mafF, mafTrue, h, 0.02);
  const mafFactor = fault === "maf" ? 0.97 - 0.22 * smooth(3, 40, s.mafF) : 1;
  const mafRead = s.mafF * mafFactor;
  const peak = veRpm(Math.max(rpm, 300)) * 1.184 * VD * (Math.max(rpm, 300) / 120) * 1000;
  s.loadPct = clamp((mafRead / peak) * 100, 0, 110);
  const loadFrac = clamp(s.loadPct / 100, 0, 1);

  /* ---------- corte en desaceleración y limitador */
  if (s.phase === "run") {
    const dfcoIn = Math.max(1500, idleTarget + 700), dfcoOut = Math.max(1150, idleTarget + 250);
    if (!s.dfco && pedal < 0.5 && rpm > dfcoIn && ectUsed > 35 && !bal && s.tRun > 3) s.dfco = true;
    if (s.dfco && (pedal >= 0.5 || rpm < dfcoOut)) s.dfco = false;
    if (rpm > 6300) s.revCut = true;
    if (s.revCut && rpm < 6150) s.revCut = false;
  }

  /* ---------- lazo cerrado */
  const wot = pedal > 80;
  const clOk = s.phase === "run" && s.o2Heat >= 1 && ectUsed > 35 && !s.ectFail && ectRead > -39 && !wot && !s.dfco && !s.revCut && s.tRun > 4 && !bal;
  s.closedLoop = clOk;
  s.clTime = clOk ? s.clTime + h : 0;
  s.loop = bal ? "balance" : s.dfco ? "dfco" : s.revCut ? "corte-rpm" : clOk ? "cerrado"
    : (s.ectFail || ectRead <= -39) ? "abierto-falla" : wot ? "abierto-carga" : "abierto-frio";

  /* ---------- cálculo de inyección (lo que hace la ECU) */
  const cps = Math.max(rpm, 30) / 120;                           // ciclos por segundo de cada cilindro
  const airCylEcu = mafRead / (4 * cps);                          // g por cilindro por ciclo (según el MAF)
  const lamWarm = 1 - 0.12 * clamp((80 - ectUsed) / 100, 0, 1.2);
  let lamCmd = clOk ? 1 : Math.min(wot ? 0.87 : 1, lamWarm);
  if (wot && clOk === false) lamCmd = Math.min(lamCmd, 0.87);
  const startEnr = s.phase === "crank" ? 1.3 : 1 + 0.3 * Math.exp(-s.tRun / 2.5);
  const wallComp = 1 / evap(ectUsed);
  const w0 = 1 - smooth(3.6, 6.5, mafRead);
  const w2 = smooth(25, 45, mafRead);
  const w1 = Math.max(0, 1 - w0 - w2);
  const ltftNow = w0 * s.ltft[0] + w1 * s.ltft[1] + w2 * s.ltft[2];
  const trim = 1 + (s.stft + ltftNow) / 100;
  s.fuelCmd = (airCylEcu / (STOICH * lamCmd)) * wallComp * startEnr * trim;
  const dead = 0.45 + Math.max(0, 14 - s.battV) * 0.12;
  const allCut = s.dfco || s.revCut;
  s.injMs = allCut ? 0 : s.fuelCmd / INJ_G_PER_MS + dead;
  const pressF = Math.sqrt(Math.max(0, s.fuelP) / P_NOM);
  const evapTrue = evap(s.ectTrue);

  /* ---------- avance de encendido */
  const mbt = 17 + 15 * clamp(rpm / 5200, 0, 1) + 13 * (1 - loadFrac);
  const knock = (2 + 9 * clamp(1 - (rpm - 1500) / 4000, 0, 1)) * smooth(0.5, 1, loadFrac);
  let advT = mbt - knock;
  if (idleMode && s.phase === "run") advT = 10 + s.idleSpark;
  if (catHeating) advT = 3 + s.idleSpark * 0.5;
  if (s.phase === "crank") advT = 6;
  s.adv = lag(s.adv, advT, h, 0.08);
  s.mbt = mbt;
  const sparkEff = Math.max(0.35, 1 - 0.00038 * (mbt - s.adv) ** 2);

  /* ---------- combustiones: una cada 180° */
  // la pérdida está cerca de los conductos de los cilindros 1 y 2: les llega más aire falso
  const dist = fault === "vacio" ? [1.07, 1.03, 0.97, 0.93] : [1, 1, 1, 1];
  const lamLim = 1.38 - 0.16 * loadFrac; // límite de mezcla pobre: con carga falla antes
  s.crankDeg += rpm * 6 * h;
  let unburnedFuel = 0, fuelThis = 0;
  while (s.crankDeg >= 180) {
    s.crankDeg -= 180;
    const c = FIRING[s.evIdx % 4];
    s.evIdx++;
    const airC = (s.airTot / (4 * cps)) * dist[c];
    const balanceCut = !!bal && bal.stage === "cut" && bal.cyl === c;
    const cut = allCut || balanceCut || (s.phase === "crank" && s.crankT < 0.25);
    s.cut[c] = cut;
    let fuelC = 0;
    if (!cut) {
      const injF = fault === "inyector3" && c === 2 ? 0.72 : 1;
      fuelC = s.fuelCmd * injF * pressF * evapTrue;
    }
    const lam = fuelC > 0 ? airC / (fuelC * STOICH) : 99;
    let pm = 0.00002;
    if (fuelC > 0) {
      if (fault === "bobina2" && c === 1) pm += 0.6 + 0.35 * loadFrac;
      pm += smooth(lamLim - 0.08, lamLim + 0.2, lam);
      pm += smooth(0.66, 0.5, lam);
      if (s.phase === "run" && s.battV < 11) pm += (11 - s.battV) * 0.4;
    }
    pm = clamp(pm, 0, 0.98);
    const burned = fuelC > 0 && rand(s) > pm;
    const cov = 0.025 + 0.3 * smooth(1.04, 1.35, lam) + 0.1 * smooth(0.8, 0.6, lam) + (fault === "vacio" ? 0.07 : 0);
    const tq = burned ? KT * airC * fLambda(lam) * sparkEff * (1 + cov * gauss(s)) : 0;
    s.tInd = Math.max(0, tq);
    const slug = fuelC <= 0 ? 8 : burned ? lam : 2.6;
    s.exhInv += (1 / slug - s.exhInv) * 0.2;
    fuelThis += fuelC;
    if (fuelC > 0 && !burned) {
      unburnedFuel += fuelC;
      if (s.phase === "run" && rpm < 5800 && rand(s) < 0.96) {
        s.misCount[c]++;
        s.lastMis[c] = s.t;
      }
    }
    if (fuelC > 0 && s.phase === "run") s.misRate[c] += ((burned ? 0 : 1) - s.misRate[c]) / 40;
    s.lastFire[c] = s.t;
  }
  s.fuelRate = lag(s.fuelRate, fuelThis / h, h, 0.15);
  s.catFuel = lag(s.catFuel, unburnedFuel / h, h, 0.6);

  /* ---------- dinámica del cigüeñal */
  const cold = 1 + 0.9 * clamp((80 - s.ectTrue) / 100, 0, 1.2);
  const tFric = (15 + 0.0012 * rpm + 0.4e-6 * rpm * rpm) * cold;
  const tPump = 0.1273 * Math.max(0, s.pBack - s.map);
  const charging = fault !== "alternador" && s.phase === "run";
  const iAlt = 14 + (s.fan ? 12 : 0);
  const tAcc = 1.2 + (charging ? (14.2 * iAlt) / (0.55 * Math.max(s.omega, 50)) : 0);
  const tBrake = s.tInd - tFric * Math.sign(rpm || 1) - tPump - tAcc;
  s.tBrakeF = lag(s.tBrakeF, tBrake, h, 0.5);
  if (s.phase === "crank") {
    const starter = 95 * (1 - rpm / 320);
    s.omega = Math.max(0, s.omega + ((starter + tBrake) / 0.16) * h);
    const r = (s.omega * 60) / TAU;
    if (s.crankT > 0.3 && r > 520) s.phase = "run";
    if (s.crankT > 6) { s.phase = "off"; s.stalled = true; }
  } else if (inp.situation === "dyno") {
    const wSet = (clamp(inp.dynoRpm, 900, 6000) / 60) * TAU;
    const tDyno = s.tBrakeF + 12 * (s.omega - wSet);
    s.omega = Math.max(0, s.omega + ((tBrake - tDyno) / 1.2) * h);
  } else {
    s.omega = Math.max(0, s.omega + (tBrake / 0.14) * h);
    if (s.phase === "run" && (s.omega * 60) / TAU < 220) { s.phase = "off"; s.stalled = true; }
  }
  s.rpmF = lag(s.rpmF, (s.omega * 60) / TAU, h, 0.12);

  /* ---------- escape → sonda lambda (con retardo de transporte) */
  {
    s.lamPtr = (s.lamPtr + 1) % 256;
    s.lamHist[s.lamPtr] = 1 / Math.max(0.01, s.exhInv);
    s.lamTime[s.lamPtr] = s.t;
    const delay = 0.05 + 120 / Math.max(rpm, 300);
    let lamS = s.lamHist[s.lamPtr];
    for (let k = 1; k < 256; k++) {
      const j = (s.lamPtr - k + 256) % 256;
      if (s.lamTime[j] <= s.t - delay) { lamS = s.lamHist[j]; break; }
    }
    const aged = fault === "sonda";
    let target = s.o2Heat >= 1 ? 0.47 + 0.42 * Math.tanh(70 * (1 - lamS)) : 0.45;
    if (aged && s.o2Heat >= 1) target = 0.45 + (target - 0.45) * 0.62;
    s.o2V = lag(s.o2V, target, h, aged ? 0.42 : 0.055) + (rand(s) - 0.5) * 0.004;
  }

  /* ---------- correcciones de combustible */
  if (clOk) {
    const rich = s.o2Rich ? s.o2V > 0.42 : s.o2V > 0.48;
    if (rich !== s.o2Rich) {
      s.stft += rich ? -2.5 : 2.5;
      s.o2Rich = rich;
    }
    const hi = s.o2Hi ? s.o2V > 0.3 : s.o2V > 0.6;
    if (hi !== s.o2Hi) { s.o2Hi = hi; s.switches.push(s.t); }
    const I = 3 + 0.45 * Math.min(mafRead, 30);
    s.stft = clamp(s.stft + (rich ? -I : I) * h, -25, 25);
    s.stftAvg = lag(s.stftAvg, s.stft, h, 1.5);
    if (s.clTime > 2) {
      const k = 0.35 * s.stftAvg * h;
      s.ltft[0] = clamp(s.ltft[0] + w0 * k, -25, 25);
      s.ltft[1] = clamp(s.ltft[1] + w1 * k, -25, 25);
      s.ltft[2] = clamp(s.ltft[2] + w2 * k, -25, 25);
    }
  } else if (!bal) {
    s.stft = lag(s.stft, 0, h, 0.2);
    s.stftAvg = lag(s.stftAvg, 0, h, 1);
  }
  while (s.switches.length && s.switches[0] < s.t - 12) s.switches.shift();

  /* ---------- prueba de balance */
  if (bal) {
    if (inp.situation !== "neutral" || pedal > 0.5 || s.phase !== "run") {
      s.balance = null;
    } else {
      bal.t += h;
      const r = s.rpmF;
      if (bal.stage === "base") {
        if (bal.t > 0.5) { bal.sumBase += r * h; bal.nBase += h; }
        if (bal.t >= BALANCE_BASE_S) { bal.stage = "cut"; bal.t = 0; }
      } else {
        if (bal.t > BALANCE_CUT_S - 1.1) { bal.sumCut += r * h; bal.nCut += h; }
        if (bal.t >= BALANCE_CUT_S) {
          const base = bal.sumBase / Math.max(1e-6, bal.nBase);
          const cutAvg = bal.sumCut / Math.max(1e-6, bal.nCut);
          bal.base[bal.cyl] = base;
          bal.drops[bal.cyl] = Math.max(0, base - cutAvg);
          bal.sumBase = bal.nBase = bal.sumCut = bal.nCut = 0;
          bal.t = 0; bal.stage = "base";
          if (bal.cyl >= 3) bal.done = true; else bal.cyl++;
        }
      }
    }
  }

  /* ---------- monitores OBD */
  if (s.phase === "run" && s.tRun > 2) {
    const totalTrim = s.stft + ltftNow;
    const mon = (code: string, cond: boolean, pendAt: number, confAt: number) => {
      const tm = (s.timers[code] ?? 0) + (cond ? h : -h * 0.3);
      s.timers[code] = clamp(tm, 0, confAt + 1);
      const d = s.dtc[code];
      if (s.timers[code] >= pendAt && !d) s.dtc[code] = { code, state: "pendiente", t: s.t };
      if (s.timers[code] >= confAt && s.dtc[code] && s.dtc[code].state === "pendiente") {
        s.dtc[code] = { code, state: "confirmado", t: s.t };
        if (!s.freeze) {
          s.freeze = {
            code, rpm: s.rpmF, ect: ectRead, load: s.loadPct, map: s.map, stft: s.stft, ltft: ltftNow, vss,
            loop: s.loop,
          };
        }
      }
    };
    mon("P0171", clOk && totalTrim > 23, 5, 12);
    mon("P0172", clOk && totalTrim < -23, 5, 12);
    mon("P0118", ectV > 4.9, 1, 1.5);
    mon("P0117", ectV < 0.1, 1, 1.5);
    if (ectV > 4.9 && (s.timers.P0118 ?? 0) >= 1.5) s.ectFail = true;
    mon("P0128", s.tRun > 95 && !s.ectFail && ectRead < 75 && ectRead > -39, 0.5, 1);
    const swHz = s.switches.length / 2 / 12;
    mon("P0133", clOk && s.clTime > 14 && rpm < 3200 && swHz < 0.25, 8, 16);
    const mafModel = kEng * kRes * Math.max(0, s.map - P0) * 1e6;
    mon("P0101", loadFrac > 0.4 && rpm > 1500 && Math.abs(mafRead / Math.max(0.1, mafModel) - 1) > 0.17, 4, 10);
    mon("P0562", s.battV < 12.0, 6, 9);
    let nMis = 0;
    for (let c = 0; c < 4; c++) {
      const bad = s.misRate[c] > 0.05;
      if (bad) nMis++;
      mon(`P030${c + 1}`, bad, 3, 8);
    }
    mon("P0300", nMis >= 2, 3, 8);
    s.milBlink = s.misRate.some((r) => r > 0.16);
  }
}

/* ------------------------------------------------------------ lectura */
export type PidId =
  | "rpm" | "vss" | "ect" | "ectV" | "iat" | "baro" | "map" | "vac" | "maf" | "load" | "app" | "tps" | "tpsV"
  | "o2" | "stft" | "ltft" | "inj" | "adv" | "batt" | "fuelP" | "catT" | "torque" | "power"
  | "mis1" | "mis2" | "mis3" | "mis4";

export interface PidDef {
  id: PidId; label: string; unit: string; dec: number;
  /** rango del gráfico (si min/max fijos) o span mínimo para autoescala */
  min?: number; max?: number; span?: number;
  /** instrumento externo (no lo da el scanner) */
  ext?: string;
  group: "motor" | "aire" | "mezcla" | "encendido" | "electrico" | "fallos";
}

export const PIDS: PidDef[] = [
  { id: "rpm", label: "RPM", unit: "rpm", dec: 0, span: 400, group: "motor" },
  { id: "ect", label: "Temp. refrigerante (ECT)", unit: "°C", dec: 0, span: 20, group: "motor" },
  { id: "ectV", label: "Señal ECT", unit: "V", dec: 2, min: 0, max: 5, group: "motor" },
  { id: "iat", label: "Temp. aire admisión (IAT)", unit: "°C", dec: 0, span: 15, group: "aire" },
  { id: "baro", label: "Presión barométrica", unit: "kPa", dec: 1, span: 10, group: "aire" },
  { id: "map", label: "Presión múltiple (MAP)", unit: "kPa", dec: 1, span: 15, group: "aire" },
  { id: "vac", label: "Vacío", unit: "inHg", dec: 1, span: 6, ext: "vacuómetro", group: "aire" },
  { id: "maf", label: "Caudal de aire (MAF)", unit: "g/s", dec: 1, span: 4, group: "aire" },
  { id: "load", label: "Carga calculada", unit: "%", dec: 0, span: 20, group: "aire" },
  { id: "app", label: "Pedal acelerador (APP)", unit: "%", dec: 0, min: 0, max: 100, group: "aire" },
  { id: "tps", label: "Mariposa (TPS)", unit: "%", dec: 1, span: 10, group: "aire" },
  { id: "tpsV", label: "Señal TPS", unit: "V", dec: 2, min: 0, max: 5, group: "aire" },
  { id: "o2", label: "Sonda lambda B1S1", unit: "V", dec: 2, min: 0, max: 1, group: "mezcla" },
  { id: "stft", label: "Corrección corto plazo (STFT)", unit: "%", dec: 1, span: 20, group: "mezcla" },
  { id: "ltft", label: "Corrección largo plazo (LTFT)", unit: "%", dec: 1, span: 20, group: "mezcla" },
  { id: "inj", label: "Tiempo de inyección", unit: "ms", dec: 2, span: 2, group: "mezcla" },
  { id: "fuelP", label: "Presión de nafta", unit: "bar", dec: 1, span: 1.5, ext: "manómetro", group: "mezcla" },
  { id: "adv", label: "Avance de encendido", unit: "° APMS", dec: 1, span: 15, group: "encendido" },
  { id: "catT", label: "Temp. catalizador (calc.)", unit: "°C", dec: 0, span: 150, group: "encendido" },
  { id: "batt", label: "Tensión de módulo", unit: "V", dec: 2, span: 1.5, group: "electrico" },
  { id: "vss", label: "Velocidad", unit: "km/h", dec: 0, span: 20, group: "motor" },
  { id: "torque", label: "Torque en el rodillo", unit: "Nm", dec: 0, span: 40, ext: "banco", group: "motor" },
  { id: "power", label: "Potencia en el rodillo", unit: "CV", dec: 0, span: 20, ext: "banco", group: "motor" },
  { id: "mis1", label: "Fallos de encendido cil. 1", unit: "", dec: 0, span: 10, group: "fallos" },
  { id: "mis2", label: "Fallos de encendido cil. 2", unit: "", dec: 0, span: 10, group: "fallos" },
  { id: "mis3", label: "Fallos de encendido cil. 3", unit: "", dec: 0, span: 10, group: "fallos" },
  { id: "mis4", label: "Fallos de encendido cil. 4", unit: "", dec: 0, span: 10, group: "fallos" },
];

export type PidValues = Record<PidId, number>;

export function ltftNow(s: EngineState) {
  const maf = s.mafF;
  const w0 = 1 - smooth(3.6, 6.5, maf);
  const w2 = smooth(25, 45, maf);
  const w1 = Math.max(0, 1 - w0 - w2);
  return w0 * s.ltft[0] + w1 * s.ltft[1] + w2 * s.ltft[2];
}

export function readPids(s: EngineState, inp: EngineInputs): PidValues {
  const ectV = inp.fault === "ect" ? 4.98 : ectVolts(s.ectTrue);
  const ect = ectFromVolts(ectV);
  const rpm = Math.max(0, s.rpmF);
  const running = s.phase !== "off";
  const mafRead = s.mafF * (inp.fault === "maf" ? 0.97 - 0.22 * smooth(3, 40, s.mafF) : 1);
  const onDyno = inp.situation === "dyno" && running;
  const tq = onDyno ? Math.max(0, s.tBrakeF) : 0;
  return {
    rpm,
    vss: onDyno ? rpm * 0.0225 : 0,
    ect, ectV,
    iat: s.iat,
    baro: inp.baro,
    map: s.map,
    vac: Math.max(0, (inp.baro - s.map) * 0.2953),
    maf: mafRead,
    load: running ? s.loadPct : 0,
    app: inp.pedal,
    tps: s.throttle,
    tpsV: 0.5 + 0.04 * s.throttle,
    o2: s.o2V,
    stft: s.stft,
    ltft: ltftNow(s),
    inj: s.injMs,
    fuelP: s.fuelP,
    adv: running ? s.adv : 0,
    catT: s.catT,
    batt: s.battV,
    torque: tq,
    power: (tq * (rpm / 60) * TAU) / 1000 / 0.7355,
    mis1: s.misCount[0], mis2: s.misCount[1], mis3: s.misCount[2], mis4: s.misCount[3],
  };
}

export const LOOP_LABEL: Record<LoopState, string> = {
  "abierto-frio": "Lazo abierto (calentando)",
  cerrado: "Lazo cerrado",
  "abierto-carga": "Lazo abierto (plena carga)",
  dfco: "Corte en desaceleración",
  "abierto-falla": "Lazo abierto (por falla)",
  "corte-rpm": "Corte por máximas rpm",
  apagado: "Motor parado",
  balance: "Prueba de balance",
};

export function dtcList(s: EngineState): Dtc[] {
  return Object.values(s.dtc).sort((a, b) => a.t - b.t);
}
export function milOn(s: EngineState) {
  return Object.values(s.dtc).some((d) => d.state === "confirmado" && (DTC_INFO[d.code]?.mil ?? true)) || s.milBlink;
}
export function o2SwitchHz(s: EngineState) {
  return s.switches.length / 2 / 12;
}

/* ------------------------------------------------- recorrido previo */
/** Simula que el auto "llegó al taller": arranque en frío, ralentí, un paseo en carga y vuelta a ralentí.
 *  Sirve para que en modo diagnóstico estén los códigos guardados y las correcciones aprendidas. */
export function preDrive(s: EngineState, base: EngineInputs) {
  const run = (secs: number, patch: Partial<EngineInputs>) => {
    const inp = { ...base, ...patch };
    for (let t = 0; t < secs; t += 0.02) stepEngine(s, inp, 0.02);
  };
  startEngine(s, base, true);
  run(45, { pedal: 0, situation: "neutral" });
  run(25, { pedal: 22, situation: "dyno", dynoRpm: 2500 });
  run(15, { pedal: 45, situation: "dyno", dynoRpm: 3200 });
  run(8, { pedal: 95, situation: "dyno", dynoRpm: 4000 });
  run(15, { pedal: 25, situation: "dyno", dynoRpm: 2800 });
  run(4, { pedal: 0, situation: "dyno", dynoRpm: 2000 });
  run(25, { pedal: 0, situation: "neutral" });
}

/** Estabiliza el motor caliente en ralentí (estado inicial). */
export function settle(s: EngineState, inp: EngineInputs, secs = 12) {
  for (let t = 0; t < secs; t += 0.02) stepEngine(s, inp, 0.02);
}
