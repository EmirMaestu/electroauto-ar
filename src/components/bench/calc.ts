/* Fórmulas de taller (puras, en unidades del taller). */

/* -------------------------------------------------- cilindrada */
/** Volumen de un cilindro [cm³] con diámetro y carrera en mm. */
export const cilindro = (dMm: number, sMm: number) => (Math.PI / 4) * (dMm / 10) ** 2 * (sMm / 10);
/** Relación de compresión con volumen de cilindro y de cámara [cm³]. */
export const relCompresion = (vh: number, vc: number) => (vh + vc) / vc;
/** Volumen que se pierde de cámara al rebajar la tapa [cm³] (aprox.: área del cilindro × rebaje). */
export const volRebaje = (dMm: number, cutMm: number) => (Math.PI / 4) * (dMm / 10) ** 2 * (cutMm / 10);

/* ------------------------------------------- torque y potencia */
export const K_POT = 9549.297; // 60000 / 2π
export const KW_PER_CV = 0.73549875;
export const KW_PER_HP = 0.745699872;
export const potenciaKw = (torqueNm: number, rpm: number) => (torqueNm * rpm) / K_POT;
export const torqueDe = (kw: number, rpm: number) => (kw * K_POT) / rpm;
export const rpmDe = (kw: number, torqueNm: number) => (kw * K_POT) / torqueNm;

/* --------------------------------------------------- altura */
/** Presión de atmósfera estándar [hPa] a una altura [m]. */
export const baroHpa = (h: number) => 1013.25 * Math.pow(1 - 2.25577e-5 * h, 5.25588);
/** Temperatura de ebullición del agua [°C] a una presión absoluta [hPa] (ecuación de Antoine). */
export function hierve(pHpa: number) {
  const mmHg = pHpa * 0.750062;
  let t = 1730.63 / (8.07131 - Math.log10(mmHg)) - 233.426;
  if (t > 99) t = 1810.94 / (8.14019 - Math.log10(mmHg)) - 244.485;
  return t;
}
/** Potencia de un motor atmosférico corregida por presión y temperatura (criterio DIN 70020). */
export const potenciaAltura = (p0: number, pHpa: number, tC: number) => p0 * (pHpa / 1013.25) * Math.sqrt(293.15 / (tC + 273.15));
/** Lectura de compresímetro esperable en altura a partir del dato de nivel del mar [bar manométricos]. */
export const compresionAltura = (cBar: number, pHpa: number) => (cBar + 1.01325) * (pHpa / 1013.25) - pHpa / 1000;

/* ------------------------------------------------ unidades */
export type Magnitud = "torque" | "presion" | "potencia" | "temperatura";
/** factor para pasar a la unidad base (Nm, kPa, kW) */
export const UNIDADES: Record<Exclude<Magnitud, "temperatura">, { id: string; label: string; f: number }[]> = {
  torque: [
    { id: "Nm", label: "Nm", f: 1 },
    { id: "kgfm", label: "kgf·m", f: 9.80665 },
    { id: "lbfft", label: "lbf·ft", f: 1.3558179 },
    { id: "lbfin", label: "lbf·in", f: 0.1129848 },
  ],
  presion: [
    { id: "bar", label: "bar", f: 100 },
    { id: "kPa", label: "kPa", f: 1 },
    { id: "psi", label: "psi", f: 6.894757 },
    { id: "kgfcm2", label: "kgf/cm²", f: 98.0665 },
    { id: "atm", label: "atm", f: 101.325 },
    { id: "inHg", label: "inHg", f: 3.386389 },
    { id: "mmHg", label: "mmHg", f: 0.1333224 },
    { id: "MPa", label: "MPa", f: 1000 },
  ],
  potencia: [
    { id: "kW", label: "kW", f: 1 },
    { id: "CV", label: "CV", f: KW_PER_CV },
    { id: "HP", label: "HP", f: KW_PER_HP },
    { id: "W", label: "W", f: 0.001 },
  ],
};
export const TEMPS = [{ id: "C", label: "°C" }, { id: "F", label: "°F" }, { id: "K", label: "K" }];
export function convTemp(v: number, from: string) {
  const c = from === "F" ? (v - 32) / 1.8 : from === "K" ? v - 273.15 : v;
  return { C: c, F: c * 1.8 + 32, K: c + 273.15 } as Record<string, number>;
}

/* ------------------------------------------------- cables */
export const RHO_CU = 0.0175; // Ω·mm²/m a 20 °C
export const SECCIONES = [0.35, 0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50];
export const resCable = (largoM: number, mm2: number) => (RHO_CU * largoM) / mm2;
/** Sección comercial mínima para no pasar una caída máxima [V]. */
export function seccionPara(largoM: number, amp: number, dvMax: number) {
  const s = (RHO_CU * largoM * amp) / dvMax;
  return SECCIONES.find((x) => x >= s) ?? NaN;
}

/* --------------------------------------------- cubiertas */
/** Diámetro exterior [mm] de una cubierta "ancho/perfil Rrodado". */
export const diamCubierta = (ancho: number, perfil: number, rodado: number) => rodado * 25.4 + 2 * ancho * (perfil / 100);
/** Velocidad [km/h] con rpm, relación de caja, diferencial y diámetro [mm]. */
export const velocidad = (rpm: number, caja: number, dif: number, dMm: number) => (rpm * Math.PI * (dMm / 1000) * 60) / (caja * dif * 1000);
export const rpmA = (kmh: number, caja: number, dif: number, dMm: number) => (kmh * caja * dif * 1000) / (Math.PI * (dMm / 1000) * 60);
