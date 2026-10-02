/* ==========================================================================
   Modelo físico compartido por las animaciones del motor (agente motor1).
   Sólo exportaciones en minúscula: este archivo NO registra componentes MDX.

   Motor de referencia: naftero atmosférico de 4 cilindros, 80 × 80 mm
   (≈ 402 cm³ por cilindro, ≈ 1,6 L), biela de 133 mm, ε = 10,5:1.
   Ángulo de ciclo φ: 0–720° de cigüeñal.
     0°   = PMS de cruce (arranca la admisión)
     180° = PMI
     360° = PMS de encendido (arranca la explosión)
     540° = PMI
   ========================================================================== */
import { useEffect, useState } from "react";
import { clamp, lerp, smoothstep, wrap } from "../ui/anim-kit";

export const D2R = Math.PI / 180;

/* --------------------------------------------------------- responsive */
/** true si el contenedor mide al menos `min` px de ancho (para pasar de 2 paneles lado a lado a apilados). */
export function useWide(ref: React.RefObject<HTMLElement | null>, min = 600) {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setWide(e.contentRect.width >= min));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, min]);
  return wide;
}

/** id seguro para usar en url(#...) */
export const safeId = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");

/* ---------------------------------------------------------- geometría */
export const GEO = { bore: 80, stroke: 80, r: 40, rod: 133, eps: 10.5, pinToCrown: 30 } as const;
/** volumen barrido de un cilindro [cm³] */
export const VS = (Math.PI / 4) * (GEO.bore / 10) ** 2 * (GEO.stroke / 10);
/** volumen de la cámara [cm³] */
export const VC = VS / (GEO.eps - 1);

/** Desplazamiento del pistón desde el PMS [mm] para un ángulo de cigüeñal en grados. */
export function pistonX(thetaDeg: number, r: number = GEO.r, l: number = GEO.rod) {
  const t = thetaDeg * D2R;
  const s = Math.sin(t), c = Math.cos(t);
  return r * (1 - c) + l - Math.sqrt(l * l - r * r * s * s);
}
/** Ángulo de la biela respecto del eje del cilindro [rad] */
export function rodAngle(thetaDeg: number, r: number = GEO.r, l: number = GEO.rod) {
  return Math.asin((r / l) * Math.sin(thetaDeg * D2R));
}
/** Brazo de palanca efectivo [mm]: torque = fuerza sobre el pistón × brazo. */
export function leverArm(thetaDeg: number, r: number = GEO.r, l: number = GEO.rod) {
  const t = thetaDeg * D2R;
  const b = rodAngle(thetaDeg, r, l);
  return (r * Math.sin(t + b)) / Math.cos(b);
}
/** Volumen sobre el pistón [cm³] */
export const volAt = (phi: number) => VC + (VS * pistonX(wrap(phi, 360))) / GEO.stroke;

/* ---------------------------------------------------------- distribución */
/** Puesta a punto típica (grados de cigüeñal en el ciclo 0–720).
 *  Admisión abre 12° antes del PMS de cruce y cierra 48° después del PMI.
 *  Escape abre 48° antes del PMI y cierra 12° después del PMS de cruce. */
export const VT = { io: -12, ic: 228, eo: 492, ec: 732, liftI: 9, liftE: 8.5 } as const;
const LIFT_EXP = 1.15;

/** Alzada [mm] de una válvula que abre en `open` y cierra en `close` (grados, close > open). */
export function lift(phi: number, open: number, close: number, max: number) {
  const dur = close - open;
  const u = wrap(phi - open, 720) / dur;
  if (u <= 0 || u >= 1) return 0;
  return max * Math.pow(Math.sin(Math.PI * u), LIFT_EXP);
}
/** Alzada de admisión. `shift` > 0 = variador adelantando la admisión (abre y cierra antes). */
export const liftAdm = (phi: number, shift = 0) => lift(phi, VT.io - shift, VT.ic - shift, VT.liftI);
export const liftEsc = (phi: number) => lift(phi, VT.eo, VT.ec, VT.liftE);

/**
 * Perfil de leva exacto para botador plano (taza): se construye a partir de la
 * función de soporte h(β) = R0 + alzada. Devuelve el path SVG de la leva en
 * coordenadas locales (centro en 0,0; el botador está hacia +y, abajo) para el
 * ángulo de cigüeñal φ. La leva gira a la MITAD de vueltas que el cigüeñal.
 */
export function camPath(phi: number, liftFn: (phi: number) => number, R0: number, scale: number, n = 96) {
  const bf = Math.PI / 2; // dirección del botador (abajo)
  const h = (b: number) => R0 + scale * liftFn(phi + (2 * (bf - b)) / D2R);
  const d = 0.004;
  let s = "";
  for (let i = 0; i < n; i++) {
    const b = (i / n) * Math.PI * 2;
    const hb = h(b);
    const hp = (h(b + d) - h(b - d)) / (2 * d);
    const x = hb * Math.cos(b) - hp * Math.sin(b);
    const y = hb * Math.sin(b) + hp * Math.cos(b);
    s += `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return s + "Z";
}

/* ---------------------------------------------------------- tiempos */
export interface StrokeInfo { n: number; name: string; color: string; soft: string; what: string; valves: string }
export const STROKES: StrokeInfo[] = [
  { n: 1, name: "Admisión", color: "var(--c-air)", soft: "var(--primary-soft)", what: "El pistón baja y chupa mezcla nueva", valves: "Admisión abierta · escape cerrada" },
  { n: 2, name: "Compresión", color: "var(--violet)", soft: "var(--violet-soft)", what: "El pistón sube y aprieta la mezcla", valves: "Las dos válvulas cerradas" },
  { n: 3, name: "Explosión", color: "var(--c-hot)", soft: "var(--accent-soft)", what: "La chispa enciende: la presión empuja al pistón", valves: "Las dos válvulas cerradas" },
  { n: 4, name: "Escape", color: "var(--c-exhaust)", soft: "var(--surface-3)", what: "El pistón sube y echa los gases quemados", valves: "Escape abierta · admisión cerrada" },
];
export const strokeIndex = (phi: number) => Math.floor(wrap(phi, 720) / 180) % 4;

/* ---------------------------------------------------------- ciclo */
export interface CycleOpts {
  /** presión absoluta en el múltiple [bar]: ≈ 0,35 en ralentí, ≈ 0,95 a fondo */
  pin: number;
  /** avance de encendido [° antes del PMS] */
  adv: number;
  /** cuánto multiplica la combustión a la presión de compresión */
  R?: number;
  /** grados que tarda en quemarse la mezcla (Wiebe) */
  burn?: number;
  /** ε (relación de compresión) para el ciclo */
  pex?: number;
  Tic?: number;
  Tex?: number;
}
export interface CycleState { p: number; T: number; V: number; xb: number; ign: number }

/** Fracción quemada (función de Wiebe) */
export function burned(phi: number, ign: number, burn = 60) {
  const f = wrap(phi, 720);
  if (f < ign) return 0;
  return 1 - Math.exp(-5 * Math.pow((f - ign) / burn, 3));
}

const NPOLY = 1.32;
/** Presión absoluta [bar] y temperatura del gas [K] en el cilindro para un ángulo φ. Modelo simple pero con forma real. */
export function cycleState(phi: number, o: CycleOpts): CycleState {
  const f = wrap(phi, 720);
  const V = volAt(f);
  const pex = o.pex ?? 1.1;
  const R = o.R ?? 4.2;
  const Tic = o.Tic ?? 340;
  const Tex = o.Tex ?? 1050;
  const Vic = volAt(VT.ic);
  const ign = 360 - o.adv;
  const xb = burned(f, ign, o.burn ?? 60);
  let p: number, T: number;
  if (f < VT.ic) {
    p = o.pin + (pex - o.pin) * (1 - smoothstep(0, 30, f));
    T = lerp(Tex, Tic, smoothstep(0, 90, f));
  } else {
    const pm = o.pin * Math.pow(Vic / V, NPOLY);
    const pf = pm * (1 + R * xb);
    // gas ideal con masa constante; el divisor representa pérdidas de calor a las paredes
    const Tf = (Tic * (pf * V)) / (o.pin * Vic) / (1 + 0.22 * xb);
    if (f > VT.eo) {
      const b = smoothstep(VT.eo, VT.eo + 62, f);
      p = pf * (1 - b) + pex * b;
      T = Tf * (1 - b) + Tex * b;
    } else {
      p = pf;
      T = Tf;
    }
  }
  return { p, T, V, xb, ign };
}

/** Avance típico según rpm y carga (sólo para mostrar valores coherentes). */
export const advanceFor = (rpm: number, fondo: boolean) =>
  clamp(10 + (rpm - 800) * 0.0045 + (fondo ? 0 : 3), 8, 36);

/** Opciones de ciclo coherentes para una rpm y una carga (ralentí = mariposa casi cerrada). */
export function cycleOptsFor(rpm: number, fondo: boolean): CycleOpts {
  return fondo
    ? { pin: 0.95, adv: advanceFor(rpm, true), R: 4.2, burn: 50 + (rpm - 800) * 0.003, Tic: 340, Tex: 1050 }
    : { pin: 0.35, adv: advanceFor(rpm, false), R: 3, burn: 55 + (rpm - 800) * 0.003, Tic: 360, Tex: 820 };
}
