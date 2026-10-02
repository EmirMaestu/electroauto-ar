/* Biblioteca de señales del osciloscopio virtual.
   Cada señal es una función pura del tiempo absoluto (ms) → valor de cada canal, con sus fallas.
   Los valores son típicos (orientativos); siempre manda el dato del fabricante. */
import type { ReactNode } from "react";

export interface ScopeChannelDef { label: string; unit: string; color: string; vDivs: number[]; vDiv: number; zero: number }
export interface SignalParam { id: string; label: string; min: number; max: number; step: number; def: number; unit?: string }
export interface SignalFault { id: string; name: string; forma: ReactNode }
export type Params = Record<string, number>;

export interface ScopeSignal {
  id: string; name: string; icon: string; group: string; short: string;
  channels: ScopeChannelDef[];
  msDivs: number[]; msDiv: number;
  params: SignalParam[];
  faults: SignalFault[];
  /** "trig": imagen quieta disparada en un evento; "roll": la traza corre (señales lentas) */
  mode: "trig" | "roll";
  /** período del evento de disparo [ms] y en qué momento del período ocurre */
  period?: (p: Params, f: string) => number;
  trigAt?: (p: Params, f: string) => number;
  sample: (t: number, p: Params, f: string, out: number[]) => void;
  coupling?: string;
  conectar: ReactNode;
  normal: ReactNode;
  /** marcas verticales, en ms relativos al disparo */
  markers?: (p: Params, f: string) => { ms: number; label: string }[];
}

/* ------------------------------------------------------------ helpers */
const TAU = Math.PI * 2;
/** pseudo-aleatorio estable en [0,1) */
export function hash(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
const noise = (t: number, amp: number, k = 53.3) => (hash(Math.floor(t * k)) - 0.5) * amp;
const sstep = (e0: number, e1: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
};
const gaussB = (x: number, w: number) => Math.exp(-((x / w) ** 2));
export const baroKpa = (h: number) => 101.325 * Math.pow(1 - 2.25577e-5 * h, 5.25588);

const C1 = "#ffd23f", C2 = "#3ddc84", C3 = "#5cc8ff";

/* ------------------------------------------------------- CKP inductivo */
function ckpInductive(t: number, rpm: number, f: string) {
  const toothMs = 1000 / rpm;
  const pos = t / toothMs;
  const rev = Math.floor(pos / 60);
  const th = pos - rev * 60;
  let A = 0.35 + rpm * 0.0016;
  if (f === "entrehierro") A *= 0.35;
  let v: number;
  if (th < 58) {
    const k = Math.floor(th);
    const ph = th - k;
    const s = Math.sin(TAU * ph);
    let a = A;
    if (k === 0) a *= 1.3;
    if (k === 57) a *= 1.1;
    if (f === "diente" && k === 21) a *= 0.35;
    v = a * Math.sign(s) * Math.pow(Math.abs(s), 0.8);
    if (f === "diente" && k === 21) v += A * 0.25 * Math.sin(TAU * ph * 2);
  } else {
    const u = (th - 58) / 2;
    v = -A * 1.7 * Math.sin(TAU * u) * (u < 0.5 ? 0.9 : 1.15);
  }
  if (f === "polaridad") v = -v;
  if (f === "ruido") {
    for (const sp of [14, 44]) {
      const d = (th - sp) * toothMs; // ms desde la chispa
      if (d > 0 && d < 0.6) v += 5 * Math.exp(-d / 0.12) * Math.sin(TAU * d / 0.08);
    }
    v += noise(t, 0.5, 9);
  }
  return v + noise(t, 0.03);
}

/* ----------------------------------------------------------- CKP Hall */
function ckpHall(t: number, rpm: number, f: string) {
  if (f === "sinvcc") return 5 + noise(t, 0.02);
  const toothMs = 1000 / rpm;
  const pos = t / toothMs;
  const rev = Math.floor(pos / 60);
  const th = pos - rev * 60;
  const lo = f === "masa" ? 1.3 : 0.15;
  const hi = 5;
  let tooth = false, missing = false;
  if (th < 58) {
    const k = Math.floor(th);
    tooth = th - k < 0.5;
    if (f === "rueda" && k === 21) missing = true;
    if (f === "contacto" && hash(rev * 7.1) < 0.45 && k >= 30 && k < 33) missing = true;
    if (missing) tooth = false;
  }
  // flancos con un poquito de redondeo
  const ph = th - Math.floor(th);
  let v: number;
  if (tooth) v = lo + (hi - lo) * (1 - sstep(0, 0.03, ph));
  else if (th < 58 && ph >= 0.5 && !missing) v = hi - (hi - lo) * (1 - sstep(0.5, 0.53, ph));
  else v = hi;
  if (f === "contacto" && hash(Math.floor(t * 0.7)) < 0.08) v = lo + noise(t, 0.4);
  return v + noise(t, 0.04);
}

/* ---------------------------------------------------------------- CMP */
function cmpHall(t: number, rpm: number, f: string) {
  if (f === "sincmp") return 0.1 + noise(t, 0.03);
  const revMs = 60000 / rpm;
  const phi = ((t % (2 * revMs)) / revMs) * 360; // 0..720 desde el fin del hueco del 1er giro
  const phi0 = 66 + (f === "correa" ? 16 : 0);
  const inWin = phi >= phi0 && phi < phi0 + 180;
  return (inWin ? 4.9 : 0.12) + noise(t, 0.04);
}

/* ----------------------------------------------------------- inyector */
function injector(tau: number, pw: number, f: string, out: number[]) {
  const Vb = 14.1;
  if (f === "sinalim") { out[0] = 0.05 + noise(tau, 0.06); out[1] = noise(tau, 0.01); return; }
  if (f === "comando") { out[0] = Vb + noise(tau, 0.06); out[1] = noise(tau, 0.01); return; }
  const R = f === "corto" ? 5.5 : 14.5;
  const tl = f === "corto" ? 0.32 : 0.5;
  const imax = Vb / R;
  let i = 0, v = Vb;
  if (tau >= 0 && tau < pw) {
    i = imax * (1 - Math.exp(-tau / tl));
    if (f !== "trabado") i -= imax * 0.07 * gaussB(tau - 0.8, 0.13);
    v = 0.25 + i * 0.35;
  } else if (tau >= pw) {
    const x = tau - pw;
    const i0 = imax * (1 - Math.exp(-pw / tl));
    i = i0 * Math.exp(-x / 0.06);
    const clamp = f === "corto" ? 42 : 65;
    if (x < 0.07) v = clamp - x * 20;
    else v = Vb + (clamp - 1.4 - Vb) * Math.exp(-(x - 0.07) / 0.045);
    if (f !== "trabado") v += 1.6 * gaussB(x - 0.55, 0.13);
  }
  out[0] = v + noise(tau, 0.08);
  out[1] = Math.max(-0.02, i + noise(tau, 0.012));
}

/* ------------------------------------------------------- bobina */
interface CoilP { peak: number; burn: number; burnT: number; ring: number; ringTau: number; slope: number }
const COIL: Record<string, CoilP> = {
  normal: { peak: 320, burn: 36, burnT: 1.5, ring: 60, ringTau: 0.35, slope: -6 },
  luz: { peak: 400, burn: 58, burnT: 0.75, ring: 70, ringTau: 0.35, slope: -4 },
  empastada: { peak: 150, burn: 22, burnT: 2.15, ring: 30, ringTau: 0.3, slope: -2 },
  corto: { peak: 165, burn: 30, burnT: 0.9, ring: 8, ringTau: 0.08, slope: -4 },
};
function primary(tau: number, f: string) {
  const c = COIL[f] ?? COIL.normal;
  const Vb = 14;
  const dwell = 3;
  if (tau < 0) return Vb + noise(tau, 0.3);
  if (tau < dwell) return 0.6 + 1.2 * (tau / dwell) + 2.5 * sstep(2.6, 2.9, tau) + noise(tau, 0.25);
  const x = tau - dwell;
  if (x < c.burnT) {
    const peak = Math.min(c.peak, 400);
    const top = x < 0.02 ? peak : c.burn + (peak - c.burn) * Math.exp(-(x - 0.02) / 0.012);
    return top + c.slope * (x / c.burnT) + noise(tau, 3, 90);
  }
  const y = x - c.burnT;
  return Vb + c.ring * Math.exp(-y / c.ringTau) * Math.sin(TAU * y / 0.24) + noise(tau, 0.3);
}
interface SecP { fire: number; spark: number; burnT: number; slope: number; ring: number }
const SEC: Record<string, SecP> = {
  normal: { fire: 11, spark: 1.5, burnT: 1.5, slope: -0.3, ring: 3 },
  luz: { fire: 24, spark: 2.7, burnT: 0.8, slope: -0.2, ring: 4 },
  empastada: { fire: 4.5, spark: 0.8, burnT: 2.2, slope: -0.1, ring: 1.5 },
  pobre: { fire: 14, spark: 1.7, burnT: 1.1, slope: 1.4, ring: 3 },
};
function secondary(tau: number, f: string) {
  const c = SEC[f] ?? SEC.normal;
  const dwell = 3;
  if (tau < 0) return noise(tau, 0.06);
  if (tau < dwell) return -1.4 * Math.exp(-tau / 0.12) * Math.cos(TAU * tau / 0.09) + noise(tau, 0.06);
  const x = tau - dwell;
  if (x < c.burnT) {
    const fireV = x < 0.015 ? c.fire * sstep(0, 0.006, x) : c.spark + (c.fire - c.spark) * Math.exp(-(x - 0.015) / 0.01);
    return fireV + c.slope * (x / c.burnT) + noise(tau, 0.25, 120);
  }
  const y = x - c.burnT;
  return c.ring * Math.exp(-y / 0.3) * Math.sin(TAU * y / 0.22) + noise(tau, 0.05);
}

/* --------------------------------------------------------------- CAN */
const canCache = new Map<number, number[]>();
function canFrame(n: number) {
  const key = n % 24;
  const hit = canCache.get(key);
  if (hit) return hit;
  const bits: number[] = [0]; // SOF dominante
  let run = 1, last = 0;
  for (let i = 1; i < 104; i++) {
    let b = hash(key * 131 + i * 7.3) < 0.5 ? 0 : 1;
    if (run >= 5 && b === last) b = 1 - b; // relleno de bits
    run = b === last ? run + 1 : 1;
    last = b;
    bits.push(b);
  }
  for (let i = 0; i < 16; i++) bits.push(1); // fin de trama + espacio entre tramas
  canCache.set(key, bits);
  return bits;
}
const CAN_BIT = 0.002; // 500 kbit/s → 2 µs
const CAN_FRAME = 120 * CAN_BIT;

/* --------------------------------------------------------- alternador */
function rippleEnvelope(th: number, allowed: number[]) {
  let m = -2;
  for (const k of allowed) m = Math.max(m, Math.cos(th - (k * Math.PI) / 3));
  return m;
}

/* =================================================================== */
export const SIGNALS: ScopeSignal[] = [
  {
    id: "ckp-ind", name: "CKP inductivo", icon: "🧲", group: "Sensores de giro",
    short: "Sensor de rpm de bobina + imán frente a la rueda fónica 60-2.",
    channels: [{ label: "CKP", unit: "V", color: C1, vDivs: [0.5, 1, 2, 5], vDiv: 2, zero: 4 }],
    msDivs: [1, 2, 5, 10, 20], msDiv: 10,
    params: [{ id: "rpm", label: "RPM", min: 150, max: 6000, step: 50, def: 800 }],
    mode: "trig",
    period: (p) => 60000 / p.rpm,
    trigAt: (p) => (60000 / p.rpm),
    sample: (t, p, f, out) => { out[0] = ckpInductive(t, p.rpm, f); },
    faults: [
      { id: "normal", name: "Normal", forma: <p>Una onda alterna por diente, todas iguales, y una onda más grande y más larga en el <b>hueco de los 2 dientes faltantes</b>: es la marca de referencia que la ECU usa para saber dónde está el PMS. Subí las rpm: la amplitud y la frecuencia crecen juntas (un sensor inductivo genera más tensión cuanto más rápido pasan los dientes).</p> },
      { id: "entrehierro", name: "Entrehierro grande", forma: <p>Misma forma pero <b>mucho más chica</b>. En arranque (150–250 rpm) puede no llegar al umbral de la ECU: el motor gira y no arranca, sin pulso de inyección. Causas: sensor flojo o mal apoyado, suciedad metálica en la punta, rueda fónica descentrada.</p> },
      { id: "diente", name: "Diente dañado", forma: <p>Un diente con <b>amplitud baja y deformada</b> que se repite en el mismo lugar en cada vuelta. La ECU lo puede tomar como otro hueco: pierde la sincronización, corta, falla o guarda un código de CKP (P0335/P0336).</p> },
      { id: "polaridad", name: "Cables invertidos", forma: <p>La señal está <b>dada vuelta</b> (fijate el hueco: primero sube en vez de bajar). Pasa con fichas o reparaciones mal hechas. La ECU detecta el flanco equivocado y el punto de encendido queda corrido unos grados: anda mal o no arranca.</p> },
      { id: "ruido", name: "Interferencia", forma: <p><b>Picos</b> en el momento de cada chispa y “pelusa” general: el cable del sensor no está blindado, la malla no está a masa o pasa pegado a los cables de bujía. La ECU puede contar dientes de más: tironeos y cortes a altas vueltas.</p> },
    ],
    conectar: <>Punta del CH1 en el cable de <b>señal</b> del sensor, por atrás de la ficha (pinchacables o punta fina, sin pelar el cable). Masa del osciloscopio a la masa del sensor o al negativo de batería. Acople DC. Para medir la resistencia (200–1.500 Ω típico) desconectá la ficha.</>,
    normal: <><b>≈ 0,5–1 V</b> pico a pico mínimo en arranque, varios volts en ralentí y más de 10 V arriba de 5.000 rpm. Ondas parejas y hueco cada 60 dientes (una vuelta).</>,
  },
  {
    id: "ckp-hall", name: "CKP Hall", icon: "▮▯", group: "Sensores de giro",
    short: "Sensor de efecto Hall: da una señal cuadrada que no depende de las rpm.",
    channels: [{ label: "CKP Hall", unit: "V", color: C1, vDivs: [1, 2, 5], vDiv: 1, zero: 1 }],
    msDivs: [1, 2, 5, 10, 20], msDiv: 5,
    params: [{ id: "rpm", label: "RPM", min: 150, max: 6000, step: 50, def: 800 }],
    mode: "trig",
    period: (p) => 60000 / p.rpm,
    trigAt: (p) => 60000 / p.rpm,
    sample: (t, p, f, out) => { out[0] = ckpHall(t, p.rpm, f); },
    faults: [
      { id: "normal", name: "Normal", forma: <p>Cuadrada limpia de <b>≈ 0 a 5 V</b> (en otros autos 0–12 V), flancos verticales y un “escalón largo” en el hueco. A diferencia del inductivo, la <b>altura no cambia con las rpm</b>: sólo se juntan los pulsos. Por eso funciona bien aun girando muy despacio.</p> },
      { id: "masa", name: "Masa mala", forma: <p>El nivel bajo no llega a 0 V: queda en <b>≈ 1,3 V</b>. Es la caída de tensión en una masa floja o sulfatada. Si sube más, la ECU no distingue el 0 del 1 y pierde pulsos.</p> },
      { id: "sinvcc", name: "Sin alimentación", forma: <p>Línea <b>plana en 5 V</b>: es la resistencia de pull-up de la ECU; el sensor no conmuta porque no tiene alimentación (fusible, cable cortado). Con contacto, medí los 5 V (o 12 V) y la masa en la ficha.</p> },
      { id: "contacto", name: "Falso contacto", forma: <p><b>Faltan pulsos</b> de vez en cuando y aparecen bajadas sueltas. Típico de pines flojos o verdín: el motor se corta en un pozo o con el calor. Mové el mazo mientras mirás la pantalla.</p> },
      { id: "rueda", name: "Rueda dañada", forma: <p>Falta un diente que no tendría que faltar: aparece un segundo “hueco”. La ECU pierde la sincronización (código de CKP) o el motor no arranca.</p> },
    ],
    conectar: <>CH1 en la señal (cable del medio en muchos sensores de 3 cables, según fabricante), masa a la masa del sensor. Antes de la señal, comprobá alimentación (5 V o 12 V) y masa con contacto puesto.</>,
    normal: <>Cuadrada <b>0 V → 5 V</b> (o 0 → 12 V), nivel bajo menor a ≈ 0,5 V, alto cerca de la alimentación. Igual de alta a 150 que a 6.000 rpm.</>,
  },
  {
    id: "ckp-cmp", name: "CKP + CMP (sincronismo)", icon: "⏱️", group: "Sensores de giro",
    short: "Cigüeñal y árbol de levas juntos: así se ve si la distribución está en fase.",
    channels: [
      { label: "CKP", unit: "V", color: C1, vDivs: [1, 2, 5], vDiv: 2, zero: 5.2 },
      { label: "CMP", unit: "V", color: C3, vDivs: [2, 5], vDiv: 2, zero: 0.6 },
    ],
    msDivs: [5, 10, 20, 50], msDiv: 20,
    params: [{ id: "rpm", label: "RPM", min: 150, max: 3000, step: 50, def: 800 }],
    mode: "trig",
    period: (p) => 120000 / p.rpm,
    trigAt: (p) => 60000 / p.rpm,
    sample: (t, p, f, out) => {
      out[0] = ckpInductive(t, p.rpm, f === "ruido" ? "ruido" : "normal");
      out[1] = cmpHall(t - 60000 / p.rpm, p.rpm, f);
    },
    markers: (p) => {
      const tooth = 1000 / p.rpm;
      return [{ ms: -tooth, label: "hueco" }, { ms: 59 * tooth, label: "hueco" }];
    },
    faults: [
      { id: "normal", name: "En fase", forma: <p>El CMP da <b>un pulso cada dos vueltas</b> de cigüeñal (el árbol de levas gira a la mitad). Contá los dientes entre el <b>hueco</b> del CKP y el flanco de subida del CMP: en este motor son <b>11 dientes</b> (66°). Ese número es fijo para cada motor; anotalo en uno sano para comparar.</p> },
      { id: "correa", name: "Correa corrida 1 diente", forma: <p>El flanco del CMP aparece <b>≈ 2–3 dientes más tarde</b> (16° de cigüeñal: un diente de la correa en la polea del árbol). El motor arranca, pero con poca fuerza, consumo alto y a veces P0016 (correlación cigüeñal/árbol). Después de cambiar la correa, esta prueba confirma que quedó en punto.</p> },
      { id: "sincmp", name: "Sin señal de CMP", forma: <p>CMP <b>plano</b>. Muchas ECU arrancan igual (tardan más: inyectan de a pares hasta “adivinar” la fase) y guardan P0340. Revisá alimentación, masa y señal del sensor de fase.</p> },
      { id: "ruido", name: "CKP con ruido", forma: <p>Picos sobre el CKP en cada chispa: la ECU puede perder la cuenta de dientes y desincronizarse con el CMP. Revisá el blindaje y el recorrido del cable.</p> },
    ],
    conectar: <>Dos canales: CH1 en la señal del CKP y CH2 en la señal del CMP, las dos masas a masa motor. Base de tiempo que muestre al menos <b>dos vueltas</b> de cigüeñal (un ciclo completo de 720°).</>,
    normal: <>Un pulso de CMP cada dos huecos de CKP, siempre a la misma cantidad de dientes del hueco (dato del motor sano o del fabricante).</>,
  },
  {
    id: "inyector", name: "Inyector (tensión y corriente)", icon: "💉", group: "Actuadores",
    short: "Pulso de comando de la ECU y corriente por la bobina del inyector.",
    channels: [
      { label: "Tensión", unit: "V", color: C1, vDivs: [5, 10, 20], vDiv: 10, zero: 1 },
      { label: "Corriente", unit: "A", color: C3, vDivs: [0.2, 0.5, 1], vDiv: 0.5, zero: 1 },
    ],
    msDivs: [0.5, 1, 2, 5], msDiv: 1,
    params: [
      { id: "rpm", label: "RPM", min: 700, max: 6000, step: 50, def: 800 },
      { id: "pw", label: "Ancho de pulso", min: 1.5, max: 12, step: 0.1, def: 3, unit: "ms" },
    ],
    mode: "trig",
    period: (p) => 120000 / p.rpm,
    trigAt: () => 0,
    sample: (t, p, f, out) => {
      const per = 120000 / p.rpm;
      const tau = ((t % per) + per) % per;
      injector(tau > per - 2 ? tau - per : tau, p.pw, f, out);
    },
    faults: [
      { id: "normal", name: "Normal", forma: <p>En reposo el cable de comando tiene <b>tensión de batería</b> (el inyector recibe 12 V por el otro lado). La ECU lo <b>manda a masa</b> durante el ancho de pulso: la tensión cae casi a 0 y la corriente sube despacio (es una bobina). La pequeña <b>muesca en la corriente</b> a ≈ 0,8 ms es la aguja abriendo. Al cortar, la bobina devuelve energía: <b>pico de 50–80 V</b> (acá recortado a ≈ 65 V por la ECU) y después una jorobita: la aguja cerrando.</p> },
      { id: "corto", name: "Bobinado en corto", forma: <p>Corriente <b>mucho más alta</b> (≈ 2,5 A en vez de ≈ 1 A) y que sube más rápido; pico inductivo más bajo. La resistencia da ≈ 5 Ω. Además de no abrir bien, puede quemar el transistor de la ECU que lo maneja.</p> },
      { id: "trabado", name: "Aguja trabada", forma: <p>La parte eléctrica está bien, pero <b>no hay muesca</b> en la corriente ni joroba de cierre en la tensión: la aguja no se mueve. Ese cilindro no recibe nafta (o queda goteando, si se trabó abierta).</p> },
      { id: "sinalim", name: "Sin alimentación", forma: <p>Tensión <b>en 0</b> todo el tiempo: no llegan los 12 V al inyector (fusible, relé principal, cable). No hay corriente. Con la lámpara de prueba (noid) en la ficha tampoco destella.</p> },
      { id: "comando", name: "Cable de comando cortado", forma: <p>Tensión de batería <b>fija</b>, sin pulsos: la ECU nunca lo manda a masa (cable cortado entre ECU e inyector, o driver de la ECU dañado). Sin corriente.</p> },
    ],
    conectar: <>CH1 en el cable de <b>comando</b> (el que va a la ECU), por atrás de la ficha; masa a masa motor. Pinza amperométrica de baja corriente (de 10–30 A, con cero hecho) abrazando un cable del inyector. Atenuación del canal x10 si tu osciloscopio no aguanta el pico.</>,
    normal: <>Reposo 12–14 V; durante el pulso &lt; 1 V; ancho 2–4 ms en ralentí caliente; pico 50–80 V; corriente máx ≈ V/R ≈ 0,8–1,2 A (inyector de 12–16 Ω).</>,
  },
  {
    id: "primario", name: "Primario de bobina", icon: "🌀", group: "Encendido",
    short: "Lado de baja tensión de la bobina: carga (dwell), chispa y oscilaciones.",
    channels: [{ label: "Primario", unit: "V", color: C1, vDivs: [20, 50, 100], vDiv: 50, zero: 1 }],
    msDivs: [0.5, 1, 2, 5], msDiv: 1,
    params: [{ id: "rpm", label: "RPM", min: 700, max: 6000, step: 50, def: 800 }],
    mode: "trig",
    period: (p) => 120000 / p.rpm,
    trigAt: () => 0,
    sample: (t, p, f, out) => {
      const per = 120000 / p.rpm;
      const tau = ((t % per) + per) % per;
      out[0] = primary(tau > per - 2 ? tau - per : tau, f);
    },
    faults: [
      { id: "normal", name: "Normal", forma: <p>De izquierda a derecha: 12–14 V; la ECU cierra el circuito y la tensión cae casi a 0 (<b>dwell</b>: la bobina se carga, ≈ 3 ms); al abrir salta el <b>pico</b> (≈ 300–400 V) y queda la <b>línea de quemado</b> (≈ 30–40 V durante ≈ 1,5 ms: la chispa está saltando); al terminar la chispa, la energía que sobra hace <b>oscilaciones</b> (3 o más = bobina sana).</p> },
      { id: "luz", name: "Luz de bujía grande / cable abierto", forma: <p>Pico <b>recortado arriba</b> y línea de quemado <b>alta y corta</b>: cuesta hacer saltar la chispa y dura poco. Bujía gastada, luz excesiva o cable de alta cortado.</p> },
      { id: "empastada", name: "Bujía empastada o en fuga", forma: <p>Pico <b>bajo</b> y línea de quemado <b>baja y larga</b>: la corriente se escapa por el carbón o una fisura sin hacer una chispa buena en los electrodos.</p> },
      { id: "corto", name: "Bobina con espiras en corto", forma: <p>Pico bajo y <b>casi sin oscilaciones</b> al final: la bobina perdió vueltas y energía. Suele fallar con carga y en caliente.</p> },
    ],
    conectar: <>CH1 al negativo del primario (cable de comando de la bobina, del lado de la ECU) con <b>atenuador x10</b> o una punta que aguante 400 V; masa a masa motor. En bobinas lápiz con el transistor adentro no se puede: usá pinza de corriente o captador de secundario.</>,
    normal: <>Pico 250–400 V; quemado 30–60 V durante 1–2 ms; 3 o más oscilaciones; dwell 2–4 ms (lo ajusta la ECU según batería y rpm).</>,
  },
  {
    id: "secundario", name: "Secundario (pinza capacitiva)", icon: "⚡", group: "Encendido",
    short: "La alta tensión de la chispa, tomada sin contacto con una pinza capacitiva.",
    channels: [{ label: "Secundario", unit: "kV", color: C1, vDivs: [2, 5, 10], vDiv: 5, zero: 1 }],
    msDivs: [0.5, 1, 2], msDiv: 1,
    params: [{ id: "rpm", label: "RPM", min: 700, max: 6000, step: 50, def: 800 }],
    mode: "trig",
    period: (p) => 120000 / p.rpm,
    trigAt: () => 0,
    sample: (t, p, f, out) => {
      const per = 120000 / p.rpm;
      const tau = ((t % per) + per) % per;
      out[0] = secondary(tau > per - 2 ? tau - per : tau, f);
    },
    faults: [
      { id: "normal", name: "Normal", forma: <p>La <b>línea de encendido</b> (la tensión que hizo falta para que salte la chispa, ≈ 8–15 kV en ralentí) y la <b>línea de chispa</b> (≈ 1–2 kV durante ≈ 1,5 ms), casi horizontal. Al final, las oscilaciones de la bobina. Al principio, la pequeña oscilación de cuando la ECU empieza a cargar la bobina.</p> },
      { id: "luz", name: "Luz grande / cable abierto", forma: <p>Línea de encendido <b>muy alta</b> (más de 20 kV) y chispa <b>corta y alta</b>. Riesgo de que la chispa busque otro camino (fisuras en el capuchón, en la bobina).</p> },
      { id: "empastada", name: "Bujía en corto / empastada", forma: <p>Línea de encendido <b>muy baja</b> (≈ 3–5 kV) y chispa larga y baja: la corriente se fuga sin saltar con fuerza entre electrodos.</p> },
      { id: "pobre", name: "Mezcla pobre en ese cilindro", forma: <p>La línea de chispa <b>sube</b> en vez de quedarse plana o bajar, y es más corta: la mezcla pobre tiene más resistencia. Típico de un inyector tapado o una entrada de aire en ese cilindro.</p> },
    ],
    conectar: <>Pinza capacitiva (secundario) abrazando el cable de bujía, o el adaptador para bobinas tipo lápiz apoyado sobre la bobina. <b>Nunca</b> conectes la punta del osciloscopio directo a la alta tensión. Masa del equipo a masa motor.</>,
    normal: <>Línea de encendido 8–15 kV en ralentí (parecida entre cilindros, ±3 kV); chispa 1–2 kV, 1–2 ms; disponible de la bobina 30–40 kV.</>,
  },
  {
    id: "lambda", name: "Sonda lambda (banda angosta)", icon: "🔥", group: "Sensores",
    short: "Sonda de zirconio antes del catalizador, en lazo cerrado.",
    channels: [{ label: "O2 B1S1", unit: "V", color: C2, vDivs: [0.1, 0.2, 0.5], vDiv: 0.2, zero: 0.5 }],
    msDivs: [200, 500, 1000], msDiv: 500,
    params: [{ id: "rpm", label: "RPM", min: 800, max: 3500, step: 50, def: 2500 }],
    mode: "roll",
    sample: (t, p, f, out) => {
      const s = t / 1000;
      let fr = 0.5 + p.rpm / 2000;
      if (f === "vieja") fr *= 0.35;
      const ph = TAU * fr * s + 0.7 * Math.sin(TAU * 0.13 * s) + 0.4 * Math.sin(TAU * 0.31 * s);
      let v: number;
      if (f === "vieja") v = 0.45 + 0.13 * Math.tanh(0.9 * Math.sin(ph)) / Math.tanh(0.9);
      else if (f === "pobre") v = 0.16 + 0.07 * Math.sin(ph * 0.7) + (hash(Math.floor(s * 1.3)) < 0.25 ? 0.45 * gaussB(((s * 1.3) % 1) - 0.5, 0.06) : 0);
      else if (f === "rica") v = 0.8 + 0.04 * Math.sin(ph * 0.6) - (hash(Math.floor(s * 1.1)) < 0.2 ? 0.45 * gaussB(((s * 1.1) % 1) - 0.5, 0.05) : 0);
      else v = 0.47 + 0.4 * Math.tanh(2.2 * Math.sin(ph)) / Math.tanh(2.2);
      if (f === "escape") {
        const slot = Math.floor(t / 90);
        if (hash(slot * 3.7) < 0.22) v = Math.min(v, 0.12 + 0.2 * Math.abs(((t % 90) - 45) / 45));
      }
      out[0] = v + noise(t, 0.012);
    },
    faults: [
      { id: "normal", name: "Normal", forma: <p>Conmuta de <b>menos de 0,2 V a más de 0,8 V</b> varias veces por segundo, con subidas y bajadas rápidas. Es la ECU corrigiendo para un lado y para el otro alrededor de λ = 1: lazo cerrado funcionando.</p> },
      { id: "vieja", name: "Sonda vieja (lenta)", forma: <p>Se mueve <b>poco</b> (≈ 0,3–0,6 V) y <b>despacio</b>. La ECU corrige tarde: más consumo, gases fuera de norma, P0133. Revisá también el calentador: una sonda fría se ve igual.</p> },
      { id: "pobre", name: "Mezcla pobre", forma: <p>Casi siempre <b>abajo</b> (0,1–0,3 V) con algún salto suelto. Aire falso, falta de presión de nafta, inyectores tapados… o una sonda contaminada que miente. Mirá las correcciones de combustible en el scanner.</p> },
      { id: "rica", name: "Mezcla rica", forma: <p>Casi siempre <b>arriba</b> (0,8–0,9 V). Inyector goteando, presión alta, sensor de temperatura que miente (motor “frío”), canister trabado.</p> },
      { id: "escape", name: "Pérdida de escape", forma: <p>Forma normal pero con <b>pozos bruscos hacia abajo</b>: por una junta rota del múltiple entra aire a pulsos y la sonda lo ve como mezcla pobre que no existe. La ECU enriquece de más.</p> },
    ],
    conectar: <>CH1 en la <b>señal</b> de la sonda por atrás de la ficha, masa a la masa de la sonda (o al negativo). Motor caliente, a ≈ 2.500 rpm sostenidas. Los colores de los cables cambian según la marca: confirmá con el diagrama.</>,
    normal: <>0,1–0,9 V, al menos ≈ 1 cambio por segundo a 2.500 rpm, transición rica → pobre en menos de ≈ 100–300 ms. Calentador ≈ 2–20 Ω.</>,
  },
  {
    id: "tps", name: "TPS (barrido)", icon: "🎚️", group: "Sensores",
    short: "Posición de la mariposa motorizada: dos pistas que se controlan entre sí.",
    channels: [
      { label: "TPS 1", unit: "V", color: C1, vDivs: [0.5, 1, 2], vDiv: 1, zero: 1 },
      { label: "TPS 2", unit: "V", color: C3, vDivs: [0.5, 1, 2], vDiv: 1, zero: 1 },
    ],
    msDivs: [200, 500, 1000], msDiv: 500,
    params: [],
    mode: "roll",
    sample: (t, _p, f, out) => {
      const c = ((t % 5000) + 5000) % 5000;
      const pos = c < 500 ? 0 : c < 2300 ? sstep(500, 2300, c) : c < 2700 ? 1 : c < 4500 ? 1 - sstep(2700, 4500, c) : 0;
      const ref = f === "vref" ? 4.3 / 5 : 1;
      const off = f === "masa" ? 0.45 : 0;
      let v1 = (0.5 + 4 * pos) * ref + off;
      const v2 = (4.5 - 4 * pos) * ref + off;
      if (f === "punto" && pos > 0.2 && pos < 0.31) {
        const slot = Math.floor(t / 14);
        if (hash(slot * 1.7) < 0.7) v1 = 0.05 + hash(slot * 9.1) * 0.6;
      }
      out[0] = v1 + noise(t, 0.015);
      out[1] = v2 + noise(t + 7, 0.015);
    },
    faults: [
      { id: "normal", name: "Normal", forma: <p>Al abrir despacio, la pista 1 sube de <b>≈ 0,5 a ≈ 4,5 V</b> y la pista 2 hace lo contrario (en otras mariposas va por arriba con un corrimiento). Rampas <b>limpias, sin cortes</b>. La ECU compara las dos todo el tiempo: si no coinciden, “modo emergencia” (motor a ralentí alto, sin respuesta del pedal).</p> },
      { id: "punto", name: "Pista gastada (punto muerto)", forma: <p>En una zona (la que más se usa: poca apertura) la pista 1 <b>cae a 0 V a los saltos</b>. Al pasar por ahí el auto da tirones o la ECU entra en emergencia (P0121 / P2135). Se ve en el barrido lento; con el tester no se llega a ver.</p> },
      { id: "masa", name: "Masa del sensor mala", forma: <p>Las dos señales están <b>corridas para arriba</b> ≈ 0,45 V: la caída en la masa se suma a la lectura. Cerrada marca ≈ 0,95 V y la ECU puede creer que está apenas abierta.</p> },
      { id: "vref", name: "Referencia de 5 V baja", forma: <p>Todo <b>más bajo</b> en proporción (la referencia dio ≈ 4,3 V): el máximo no llega a 4,5. Revisá la alimentación de 5 V: suele ser compartida con otros sensores (MAP, pedal), que también se van a ver raros.</p> },
    ],
    conectar: <>CH1 y CH2 en las dos señales de la mariposa, masa a la masa de sensores. Contacto puesto y <b>motor parado</b>; abrí el acelerador (o la mariposa con la mano, si es de cable) <b>muy despacio</b> de cerrado a abierto y volvé.</>,
    normal: <>≈ 0,5 V cerrada → ≈ 4,5 V abierta (según fabricante). Rampa continua; la suma o la relación entre pistas se mantiene en todo el recorrido.</>,
  },
  {
    id: "map", name: "MAP en aceleración", icon: "🌬️", group: "Sensores",
    short: "Presión del múltiple con un acelerón: ralentí, pico, desaceleración y vuelta.",
    channels: [{ label: "MAP", unit: "V", color: C2, vDivs: [0.5, 1, 2], vDiv: 1, zero: 0.5 }],
    msDivs: [50, 100, 200, 500], msDiv: 500,
    params: [{ id: "alt", label: "Altura", min: 0, max: 3200, step: 50, def: 750, unit: "m" }],
    mode: "roll",
    sample: (t, p, f, out) => {
      const baro = baroKpa(p.alt);
      const P = (tt: number) => {
        const c = ((tt % 3000) + 3000) % 3000;
        const Pi = f === "fuga" ? 45 : 31;
        const Pd = f === "fuga" ? 32 : 18;
        const Pw = baro - 2;
        let v: number;
        if (c < 600) v = Pi;
        else if (c < 900) v = Pi + (Pw - Pi) * (1 - Math.exp(-(c - 600) / 40));
        else {
          const P9 = Pi + (Pw - Pi) * (1 - Math.exp(-300 / 40));
          const x = c - 900;
          v = Pi + (P9 - Pi) * Math.exp(-x / 45) - (Pi - Pd) * (1 - Math.exp(-x / 45)) * Math.exp(-x / 650);
        }
        // pulsos de cada cilindro en ralentí (800 rpm → 26,7 Hz)
        const idle = c < 600 || c > 1800 ? 1 : 0.3;
        const k = Math.floor(tt / 37.5);
        const ph = (tt % 37.5) / 37.5;
        let amp = 0.7;
        if (f === "valvula" && k % 4 === 2) amp = 4;
        v += idle * amp * Math.sin(TAU * ph);
        return v;
      };
      let pres: number;
      if (f === "manguera") {
        // la manguera tapada actúa como un filtro: promedio exponencial de lo que pasó antes
        let acc = 0, w = 0;
        for (let i = 0; i < 40; i++) { const dt = i * 30; const k = Math.exp(-dt / 380); acc += P(t - dt) * k; w += k; }
        pres = acc / w;
      } else pres = P(t);
      out[0] = 5 * (0.009 * pres - 0.095) + noise(t, 0.01);
    },
    faults: [
      { id: "normal", name: "Normal", forma: <p>Ralentí ≈ 1 V (≈ 30 kPa de presión absoluta). En el acelerón sube enseguida casi hasta la <b>presión barométrica</b> (≈ 3,7 V en Mendoza, ≈ 4,1 V al nivel del mar), al soltar baja <b>por debajo del ralentí</b> (corte en desaceleración, mucho vacío) y vuelve suave. Cambiá la altura: el techo baja.</p> },
      { id: "manguera", name: "Manguera tapada o con agua", forma: <p>La señal es <b>lenta y redondeada</b>: no llega al pico ni baja en la desaceleración. La ECU calcula mal la carga en los cambios rápidos: tirones y humo negro al acelerar. Revisá la manguera y el niple del múltiple.</p> },
      { id: "fuga", name: "Pérdida de vacío", forma: <p>El ralentí está <b>más alto</b> (≈ 1,6 V, ≈ 45 kPa) y la desaceleración no baja tanto: entra aire por algún lado. Con MAP, la ECU agrega nafta para ese aire, pero el ralentí sube o queda inestable.</p> },
      { id: "valvula", name: "Válvula quemada", forma: <p>En ralentí, <b>un pulso de cada cuatro mucho más grande</b>: el cilindro con la válvula que no cierra devuelve presión al múltiple. Pasá a 50 ms/div para verlo bien. Confirmalo con compresión y prueba de fugas.</p> },
    ],
    conectar: <>CH1 en la señal del MAP, masa a la masa de sensores. Motor caliente en ralentí; hacé un acelerón rápido (a fondo y soltar) mientras mirás. Con contacto y motor parado, la señal marca la presión barométrica: sirve para chequear el sensor.</>,
    normal: <>Ralentí ≈ 0,9–1,5 V; a fondo ≈ barométrica (≈ 4 V al nivel del mar, menos en altura); desaceleración menor que el ralentí. Sin escalones ni cortes.</>,
  },
  {
    id: "can", name: "CAN H / CAN L", icon: "🔗", group: "Redes",
    short: "La red que une ECU, tablero, ABS: dos cables en espejo, 500 kbit/s.",
    channels: [
      { label: "CAN H", unit: "V", color: C1, vDivs: [0.5, 1, 2], vDiv: 1, zero: 1 },
      { label: "CAN L", unit: "V", color: C2, vDivs: [0.5, 1, 2], vDiv: 1, zero: 1 },
    ],
    msDivs: [0.005, 0.01, 0.02, 0.05], msDiv: 0.01,
    params: [],
    mode: "trig",
    period: () => CAN_FRAME,
    trigAt: () => 0,
    sample: (t, _p, f, out) => {
      const n = Math.floor(t / CAN_FRAME);
      const tf = t - n * CAN_FRAME;
      const bits = canFrame(n);
      const bi = Math.floor(tf / CAN_BIT);
      const b = bits[Math.min(bits.length - 1, bi)];
      const prev = bits[Math.max(0, bi - 1)];
      const tb = tf - bi * CAN_BIT; // ms desde el flanco
      const edge = 1 - Math.exp(-tb / 0.00006);
      const dom = b === 0 ? (prev === 0 ? 1 : edge) : prev === 0 ? 1 - edge : 0;
      let h = 2.5 + 1.0 * dom, l = 2.5 - 1.0 * dom;
      if (f === "terminacion") {
        h = 2.5 + 1.2 * dom; l = 2.5 - 1.2 * dom;
        if (b !== prev) {
          const r = 0.45 * Math.exp(-tb / 0.0004) * Math.sin(TAU * tb / 0.00045) * (b === 0 ? 1 : -1);
          h += r; l -= r;
        }
      }
      if (f === "hmasa") { h = 0.03; l = 0.35 + 0.25 * dom; }
      if (f === "hl") { const d = 0.15 * dom; h = 2.45 - d; l = 2.45 - d; }
      if (f === "labierto") { l = 2.5 - 0.15 * dom + 0.05 * Math.sin(t * 50); }
      out[0] = h + noise(t * 1000, 0.04, 3);
      out[1] = l + noise(t * 1000 + 3, 0.04, 3);
    },
    faults: [
      { id: "normal", name: "Normal", forma: <p>En reposo (bit “recesivo”) los dos cables están en <b>≈ 2,5 V</b>. Para mandar un bit “dominante”, CAN H sube a <b>≈ 3,5 V</b> y CAN L baja a <b>≈ 1,5 V</b>: siempre en espejo. Lo que leen los módulos es la <b>diferencia</b> (≈ 2 V), por eso un ruido que afecta igual a los dos cables no molesta. Cada bit dura 2 µs a 500 kbit/s.</p> },
      { id: "terminacion", name: "Falta una resistencia de 120 Ω", forma: <p>Flancos con <b>rebote</b> (oscilaciones) y escalones un poco más altos. Entre los pines 6 y 14 del conector OBD, con batería desconectada, medís ≈ 120 Ω en vez de ≈ 60 Ω. Fallas intermitentes de comunicación, sobre todo con el motor andando.</p> },
      { id: "hmasa", name: "CAN H a masa", forma: <p>CAN H pegado a <b>0 V</b> y CAN L casi muerto. La red se cae: el scanner no conecta, tablero con muchas luces y códigos U (U0100 “sin comunicación con la ECU”…). Buscá un cable pelado contra la carrocería.</p> },
      { id: "hl", name: "CAN H y CAN L en corto", forma: <p>Los dos cables <b>juntos en ≈ 2,5 V</b>: la diferencia es 0, nadie puede hablar. Medí resistencia entre 6 y 14 del OBD: ≈ 0 Ω.</p> },
      { id: "labierto", name: "CAN L cortado", forma: <p>CAN H se ve bien pero <b>CAN L casi no se mueve</b> desde este punto de la red: hay un corte entre la punta y los módulos. Los módulos de “ese lado” quedan aislados.</p> },
    ],
    conectar: <>CH1 en CAN H (pin <b>6</b> del conector OBD) y CH2 en CAN L (pin <b>14</b>); masas en los pines 4 o 5. Contacto puesto. Base de tiempo de microsegundos (acá 0,01 ms/div = 10 µs/div).</>,
    normal: <>Recesivo 2,5 / 2,5 V; dominante ≈ 3,5 / 1,5 V; diferencia ≈ 2 V; imagen en espejo, flancos limpios. ≈ 60 Ω entre pines 6 y 14 (con todo desconectado).</>,
  },
  {
    id: "ripple", name: "Ripple del alternador", icon: "〰️", group: "Carga y arranque",
    short: "La pequeña ondulación que deja el puente de diodos: muestra diodos y fases.",
    channels: [{ label: "B+ (AC)", unit: "V", color: C1, vDivs: [0.1, 0.2, 0.5, 1], vDiv: 0.2, zero: 4 }],
    msDivs: [0.5, 1, 2, 5], msDiv: 1,
    params: [{ id: "rpm", label: "RPM motor", min: 800, max: 3000, step: 50, def: 1500 }],
    mode: "trig",
    coupling: "AC",
    period: (p) => 1000 / ((p.rpm * 2.6 / 60) * 6),
    trigAt: () => 0,
    sample: (t, p, f, out) => {
      const Te = 1000 / ((p.rpm * 2.6 / 60) * 6);
      const th = (TAU * t) / Te;
      let allowed = [0, 1, 2, 3, 4, 5];
      if (f === "diodo") allowed = [2, 3, 4, 5];
      if (f === "fase") allowed = [0, 3];
      const e = rippleEnvelope(th, allowed);
      let v = 1.5 * (e - 0.955);
      if (f === "corto") v = 1.5 * (e - 0.955) + 0.9 * Math.cos(th - 0.5);
      if (v < 0) v = -0.5 * Math.tanh(-v / 0.5);
      if (f === "diodo") v += 0.25;
      if (f === "fase") v += 0.3;
      out[0] = v + noise(t, 0.02);
    },
    faults: [
      { id: "normal", name: "Normal", forma: <p>Una fila de <b>jorobas todas iguales</b>, chiquitas (≈ 0,1–0,3 V pico a pico): cada una es un diodo del puente rectificador conduciendo. La batería alisa casi todo.</p> },
      { id: "diodo", name: "Diodo quemado (abierto)", forma: <p><b>Falta una parte de cada grupo de jorobas</b> y aparecen pozos grandes: el patrón se repite. El alternador da menos corriente (sobre todo con consumos prendidos) y la batería se descarga de a poco.</p> },
      { id: "corto", name: "Diodo en corto", forma: <p>Ondulación <b>grande y lenta</b> encima del ripple: corriente alterna que se mete en la instalación. Puede descargar la batería con el auto parado y hacer ruido en el audio. Cambiar el puente de diodos.</p> },
      { id: "fase", name: "Fase del estator cortada", forma: <p>Sólo quedan jorobas <b>de a dos</b> con pozos muy profundos: falta una fase completa. El alternador carga a medias.</p> },
    ],
    conectar: <>CH1 en el <b>B+ del alternador</b> (o el + de batería), masa a la carcasa del alternador. <b>Acople AC</b> (así ves sólo la ondulación, no los 14 V). Motor a 1.500–2.000 rpm con consumos prendidos (luces, desempañador) para que el alternador trabaje.</>,
    normal: <>Tensión de carga (DC) 13,8–14,7 V. Ripple parejo, menor a ≈ 0,5 V pico a pico (orientativo; con más carga eléctrica, algo más).</>,
  },
  {
    id: "arranque", name: "Corriente de arranque", icon: "🔋", group: "Carga y arranque",
    short: "Compresión relativa: la corriente del burro sube en cada compresión.",
    channels: [
      { label: "Corriente", unit: "A", color: C1, vDivs: [50, 100, 200], vDiv: 100, zero: 0.5 },
      { label: "Batería", unit: "V", color: C3, vDivs: [1, 2], vDiv: 1, zero: -5 },
    ],
    msDivs: [100, 200, 500], msDiv: 500,
    params: [],
    mode: "roll",
    sample: (t, _p, f, out) => {
      const c = ((t % 6000) + 6000) % 6000;
      let rpm = 220, base = 150, hump = 95, ocv = 12.6, rint = 0.011, inrush = 460;
      if (f === "bateria") { rpm = 150; base = 140; hump = 80; ocv = 12.2; rint = 0.019; inrush = 330; }
      if (f === "burro") { rpm = 160; base = 255; hump = 105; inrush = 520; }
      let I = 0;
      if (c >= 500 && c < 4000) {
        const x = c - 500;
        const evMs = 60000 / rpm / 2;
        const k = Math.floor(x / evMs);
        const ph = (x % evMs) / evMs;
        let h = hump;
        if (f === "cilindro" && k % 4 === 1) h *= 0.3;
        I = base + h * Math.pow(Math.max(0, Math.sin(Math.PI * ph)), 2) + inrush * Math.exp(-x / 55);
        I *= 1 - Math.exp(-x / 6);
      }
      out[0] = I + noise(t, 4);
      out[1] = ocv - rint * I + noise(t + 3, 0.03);
    },
    faults: [
      { id: "normal", name: "Normal (cilindros parejos)", forma: <p>Pico inicial alto (el burro parado consume mucho), después la corriente de arrastre con <b>una joroba por cada compresión</b> (dos por vuelta en un 4 cilindros). Si todas son <b>iguales</b>, las compresiones son parejas. La tensión de batería baja en espejo, sin pasar de ≈ 9,6 V.</p> },
      { id: "cilindro", name: "Un cilindro con baja compresión", forma: <p><b>Una joroba de cada cuatro más baja</b>: ese cilindro cuesta menos de comprimir porque pierde (aros, válvula, junta). No te dice cuál es: para eso sincronizá con el CMP o una pinza en la bobina del 1, o hacé la prueba con compresómetro.</p> },
      { id: "bateria", name: "Batería débil", forma: <p>La tensión se va <b>por debajo de 9,6 V</b> y el motor gira más despacio (jorobas más separadas). Antes de culpar al burro, cargá y probá la batería.</p> },
      { id: "burro", name: "Burro forzado (bujes)", forma: <p>Corriente de arrastre <b>muy alta</b> y giro lento con batería buena: el burro está frenado (bujes gastados, inducido rozando) o el motor está muy duro.</p> },
    ],
    conectar: <><b>Pinza amperométrica de alta corriente</b> (600–1.000 A) en el cable de batería (positivo o negativo, todos los cables juntos); CH2 en bornes de batería. <b>Anulá la inyección</b> (fusible o relé de bomba, o fichas de inyectores) para que no arranque, y dale arranque 4–5 s.</>,
    normal: <>Pico inicial 300–600 A; arrastre ≈ 100–250 A en un naftero 1.6 (más en diesel); jorobas parejas (diferencias menores a ≈ 10–15 %); batería ≥ 9,6 V.</>,
  },
];

export const SIGNAL_GROUPS = Array.from(new Set(SIGNALS.map((s) => s.group)));
