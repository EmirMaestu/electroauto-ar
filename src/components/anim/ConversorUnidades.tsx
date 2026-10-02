/* Conversor de unidades del taller: torque, potencia, presión, temperatura, volumen, velocidad,
   longitud y magnitudes eléctricas con prefijos. Muestra una regla doble (o una escala de prefijos),
   la regla mental de cada conversión y ejemplos reales. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimFrame, Readout, clamp } from "../ui/anim-kit";

interface Unit { id: string; sym: string; name: string; f: number; off?: number }
interface Ejemplo { label: string; v: number; u: string }
interface Cat {
  id: string;
  label: string;
  icon: string;
  units: Unit[];
  /** par de unidades de la regla doble [arriba, abajo]; si es "log" se dibuja escala de prefijos */
  pair: [string, string] | "log";
  regla: ReactNode;
  trampa: ReactNode;
  rapida?: (a: number) => { txt: string; aprox: number };
  ejemplos: Ejemplo[];
  def: Ejemplo;
}

const CATS: Cat[] = [
  {
    id: "torque", label: "Torque", icon: "🔧",
    units: [
      { id: "Nm", sym: "N·m", name: "newton metro", f: 1 },
      { id: "kgfm", sym: "kgf·m", name: "kilogramo fuerza metro", f: 9.80665 },
      { id: "lbft", sym: "lb·ft", name: "libra pie", f: 1.3558179 },
      { id: "lbin", sym: "lb·in", name: "libra pulgada", f: 0.11298483 },
      { id: "kgfcm", sym: "kgf·cm", name: "kilogramo fuerza centímetro", f: 0.0980665 },
    ],
    pair: ["Nm", "lbft"],
    regla: <><b>1 kgf·m ≈ 10 N·m</b> (exacto: 9,81). <b>1 lb·ft ≈ 1,36 N·m</b>: de N·m a lb·ft, multiplicá por ¾.</>,
    trampa: <>Un manual yanqui puede dar el torque en <b>lb·in</b> (libra pulgada), que es <b>12 veces menos</b> que lb·ft. Confundirlas es pasar un tornillo chico de rosca.</>,
    rapida: (a) => ({ txt: `${n(a)} N·m × ¾`, aprox: a * 0.75 }),
    ejemplos: [
      { label: "Bulones de rueda", v: 110, u: "Nm" },
      { label: "Bujía (rosca 14 mm)", v: 25, u: "Nm" },
      { label: "Torque máximo de un 1.6", v: 155, u: "Nm" },
      { label: "Manual yanqui", v: 80, u: "lbft" },
      { label: "Manual viejo", v: 9, u: "kgfm" },
    ],
    def: { label: "", v: 110, u: "Nm" },
  },
  {
    id: "potencia", label: "Potencia", icon: "⚡",
    units: [
      { id: "kW", sym: "kW", name: "kilowatt", f: 1 },
      { id: "CV", sym: "CV", name: "caballo vapor (métrico)", f: 0.73549875 },
      { id: "HP", sym: "HP", name: "horsepower (EE. UU.)", f: 0.74569987 },
      { id: "W", sym: "W", name: "watt", f: 0.001 },
    ],
    pair: ["kW", "CV"],
    regla: <><b>1 CV ≈ 0,735 kW</b>: los kW son más o menos <b>¾ de los CV</b>. Al revés, <b>1 kW ≈ 1,36 CV</b>. CV y HP son casi lo mismo (1 HP = 1,014 CV).</>,
    trampa: <>No confundas <b>kW</b> (potencia, cuánto rápido entregás energía) con <b>kWh</b> (energía, lo que entra en una batería). Un eléctrico de 100 kW con batería de 50 kWh son dos datos distintos.</>,
    rapida: (a) => ({ txt: `${n(a)} kW × 1,36`, aprox: a * 1.36 }),
    ejemplos: [
      { label: "Un 1.6 naftero", v: 110, u: "CV" },
      { label: "Pick-up diesel mediana", v: 200, u: "CV" },
      { label: "Auto americano", v: 300, u: "HP" },
      { label: "Eléctrico chico", v: 100, u: "kW" },
      { label: "Burro de arranque", v: 1.4, u: "kW" },
    ],
    def: { label: "", v: 110, u: "CV" },
  },
  {
    id: "presion", label: "Presión", icon: "🎚️",
    units: [
      { id: "bar", sym: "bar", name: "bar", f: 100 },
      { id: "psi", sym: "psi", name: "libra por pulgada²", f: 6.8947573 },
      { id: "kPa", sym: "kPa", name: "kilopascal", f: 1 },
      { id: "kgcm2", sym: "kg/cm²", name: "kilogramo por cm²", f: 98.0665 },
      { id: "atm", sym: "atm", name: "atmósfera", f: 101.325 },
      { id: "MPa", sym: "MPa", name: "megapascal", f: 1000 },
      { id: "inHg", sym: "inHg", name: "pulgada de mercurio", f: 3.38639 },
      { id: "hPa", sym: "hPa", name: "hectopascal", f: 0.1 },
    ],
    pair: ["bar", "psi"],
    regla: <><b>1 bar ≈ 14,5 psi ≈ 1 kg/cm² ≈ 100 kPa ≈ 1 atmósfera.</b> De psi a bar: dividí por 14,5 (o por 15 y sumale un poquito).</>,
    trampa: <>¿<b>Relativa o absoluta</b>? El manómetro de cubiertas o de aceite marca <b>relativa</b> (0 = la presión del aire que nos rodea). El sensor <b>MAP</b> y el barómetro marcan <b>absoluta</b> (0 = vacío total). Por eso un MAP con el motor parado marca ~93 kPa en Mendoza y no cero.</>,
    rapida: (a) => ({ txt: `${n(a)} bar × 14,5`, aprox: a * 14.5 }),
    ejemplos: [
      { label: "Cubiertas", v: 32, u: "psi" },
      { label: "Tapa de radiador", v: 1.1, u: "bar" },
      { label: "Nafta multipunto", v: 3.5, u: "bar" },
      { label: "Compresión", v: 12, u: "bar" },
      { label: "Vacío en ralentí", v: 19, u: "inHg" },
      { label: "MAP en ralentí", v: 35, u: "kPa" },
      { label: "Tubo de GNC", v: 200, u: "bar" },
    ],
    def: { label: "", v: 32, u: "psi" },
  },
  {
    id: "temperatura", label: "Temperatura", icon: "🌡️",
    units: [
      { id: "C", sym: "°C", name: "grado Celsius", f: 1 },
      { id: "F", sym: "°F", name: "grado Fahrenheit", f: 5 / 9, off: -32 * (5 / 9) },
      { id: "K", sym: "K", name: "kelvin", f: 1, off: -273.15 },
    ],
    pair: ["C", "F"],
    regla: <><b>°F = °C × 1,8 + 32.</b> Rápido: <b>duplicá y sumá 30</b> (anda bien para temperaturas de todos los días). <b>K = °C + 273.</b></>,
    trampa: <>Las <b>diferencias</b> no llevan el +32: si el motor sube 10 °C, sube 18 °F, no 50 °F. Y la regla rápida se desvía bastante en temperaturas altas: probala con 90 °C.</>,
    rapida: (a) => ({ txt: `${n(a)} °C × 2 + 30`, aprox: a * 2 + 30 }),
    ejemplos: [
      { label: "Abre el termostato", v: 88, u: "C" },
      { label: "Verano en Mendoza", v: 38, u: "C" },
      { label: "Helada en Uspallata", v: -8, u: "C" },
      { label: "Manual en inglés", v: 195, u: "F" },
      { label: "Aceite bien caliente", v: 110, u: "C" },
    ],
    def: { label: "", v: 88, u: "C" },
  },
  {
    id: "volumen", label: "Volumen", icon: "🧴",
    units: [
      { id: "L", sym: "L", name: "litro", f: 1 },
      { id: "cc", sym: "cm³", name: "centímetro cúbico (cc)", f: 0.001 },
      { id: "in3", sym: "in³", name: "pulgada cúbica", f: 0.016387064 },
      { id: "gal", sym: "gal", name: "galón de EE. UU.", f: 3.7854118 },
    ],
    pair: ["L", "in3"],
    regla: <><b>1 L = 1.000 cm³ (cc).</b> Un «1.6» tiene unos 1.600 cm³. <b>1 in³ ≈ 16,4 cm³</b>: un V8 de 350 in³ son unos 5,7 L. <b>1 galón (EE. UU.) ≈ 3,8 L.</b></>,
    trampa: <>El galón <b>inglés</b> (imperial) es más grande: 4,55 L. Fijate de qué país es el manual antes de cargar aceite.</>,
    rapida: (a) => ({ txt: `${n(a)} L × 61`, aprox: a * 61 }),
    ejemplos: [
      { label: "Cilindrada de un 1.6", v: 1598, u: "cc" },
      { label: "V8 americano", v: 350, u: "in3" },
      { label: "Aceite del cárter", v: 4, u: "L" },
      { label: "Tanque de nafta", v: 50, u: "L" },
      { label: "Bidón yanqui", v: 1, u: "gal" },
    ],
    def: { label: "", v: 1598, u: "cc" },
  },
  {
    id: "velocidad", label: "Velocidad", icon: "🏁",
    units: [
      { id: "kmh", sym: "km/h", name: "kilómetros por hora", f: 1 },
      { id: "ms", sym: "m/s", name: "metros por segundo", f: 3.6 },
      { id: "mph", sym: "mph", name: "millas por hora", f: 1.609344 },
    ],
    pair: ["kmh", "ms"],
    regla: <><b>m/s = km/h ÷ 3,6.</b> 100 km/h son casi 28 m/s. <b>mph × 1,6 ≈ km/h.</b></>,
    trampa: <>A 100 km/h, <b>un segundo</b> mirando el celular son <b>28 metros</b> sin mirar el camino. Las fórmulas de física (energía, frenado) siempre van con m/s.</>,
    rapida: (a) => ({ txt: `${n(a)} km/h ÷ 3,6`, aprox: a / 3.6 }),
    ejemplos: [
      { label: "Ruta", v: 110, u: "kmh" },
      { label: "Ciudad", v: 60, u: "kmh" },
      { label: "Velocímetro en millas", v: 60, u: "mph" },
      { label: "Pistón a fondo (promedio)", v: 18, u: "ms" },
    ],
    def: { label: "", v: 110, u: "kmh" },
  },
  {
    id: "longitud", label: "Longitud", icon: "📏",
    units: [
      { id: "mm", sym: "mm", name: "milímetro", f: 1 },
      { id: "in", sym: "″", name: "pulgada", f: 25.4 },
      { id: "thou", sym: "milés.", name: "milésima de pulgada", f: 0.0254 },
      { id: "um", sym: "µm", name: "micrón (micrómetro)", f: 0.001 },
      { id: "cm", sym: "cm", name: "centímetro", f: 10 },
      { id: "m", sym: "m", name: "metro", f: 1000 },
    ],
    pair: ["mm", "in"],
    regla: <><b>1 pulgada = 25,4 mm</b> exactos. <b>½″ = 12,7 mm</b> (casi una llave de 13). <b>1 milésima de pulgada ≈ 0,025 mm</b> (las galgas viejas vienen así).</>,
    trampa: <>Una llave de ½″ «entra» en un bulón de 13 mm, pero con juego: con fuerza <b>redondea la cabeza</b>. Usá siempre la medida justa.</>,
    rapida: (a) => ({ txt: `${n(a)} mm ÷ 25`, aprox: a / 25 }),
    ejemplos: [
      { label: "Luz de bujía", v: 0.9, u: "mm" },
      { label: "Llave de media", v: 0.5, u: "in" },
      { label: "Rosca de bujía", v: 14, u: "mm" },
      { label: "Galga de 10 milésimas", v: 10, u: "thou" },
      { label: "Llanta rodado 15", v: 15, u: "in" },
    ],
    def: { label: "", v: 0.9, u: "mm" },
  },
  {
    id: "tension", label: "Tensión", icon: "🔋",
    units: [
      { id: "V", sym: "V", name: "volt", f: 1 },
      { id: "mV", sym: "mV", name: "milivolt", f: 1e-3 },
      { id: "kV", sym: "kV", name: "kilovolt", f: 1e3 },
      { id: "uV", sym: "µV", name: "microvolt", f: 1e-6 },
    ],
    pair: "log",
    regla: <>Cada prefijo es <b>× 1.000</b>: µ (micro) → m (mili) → la unidad → k (kilo) → M (mega). La sonda lambda trabaja en <b>mV</b>; la bujía, en <b>kV</b>.</>,
    trampa: <>Si el tester marca <b>0,45</b> en la escala de volts, son <b>450 mV</b>. Mirá siempre la letrita que acompaña al número en la pantalla.</>,
    ejemplos: [
      { label: "Sonda lambda", v: 450, u: "mV" },
      { label: "Batería en reposo", v: 12.6, u: "V" },
      { label: "Chispa en la bujía", v: 30, u: "kV" },
      { label: "Batería de un eléctrico", v: 400, u: "V" },
    ],
    def: { label: "", v: 450, u: "mV" },
  },
  {
    id: "corriente", label: "Corriente", icon: "〰️",
    units: [
      { id: "A", sym: "A", name: "ampere", f: 1 },
      { id: "mA", sym: "mA", name: "miliampere", f: 1e-3 },
      { id: "uA", sym: "µA", name: "microampere", f: 1e-6 },
      { id: "kA", sym: "kA", name: "kiloampere", f: 1e3 },
    ],
    pair: "log",
    regla: <><b>1 A = 1.000 mA.</b> Un consumo parásito de 0,03 A son 30 mA. El burro de arranque se come cientos de amperes.</>,
    trampa: <>Para medir corriente el tester va <b>en serie</b> y con la punta en el borne de A o mA. Si te olvidás la punta ahí y medís tensión, <b>quemás el fusible del tester</b> (o algo peor).</>,
    ejemplos: [
      { label: "Consumo con el auto apagado", v: 30, u: "mA" },
      { label: "Burro de arranque", v: 150, u: "A" },
      { label: "Bobina de encendido", v: 7, u: "A" },
      { label: "Señal de un sensor", v: 5, u: "mA" },
    ],
    def: { label: "", v: 30, u: "mA" },
  },
  {
    id: "resistencia", label: "Resistencia", icon: "Ω",
    units: [
      { id: "ohm", sym: "Ω", name: "ohm", f: 1 },
      { id: "kohm", sym: "kΩ", name: "kiloohm", f: 1e3 },
      { id: "Mohm", sym: "MΩ", name: "megaohm", f: 1e6 },
      { id: "mohm", sym: "mΩ", name: "miliohm", f: 1e-3 },
    ],
    pair: "log",
    regla: <><b>1 kΩ = 1.000 Ω. 1 MΩ = 1.000 kΩ = 1.000.000 Ω.</b> Un inyector tiene unos 14 Ω; el secundario de una bobina, varios kΩ.</>,
    trampa: <>Si el tester dice <b>2,5</b> con una <b>k</b> al lado, son <b>2.500 Ω</b>, no 2,5 Ω. Y antes de medir resistencias, el circuito tiene que estar <b>sin tensión</b>.</>,
    ejemplos: [
      { label: "Inyector", v: 14, u: "ohm" },
      { label: "Secundario de bobina", v: 8, u: "kohm" },
      { label: "Sensor de temperatura a 20 °C", v: 2.5, u: "kohm" },
      { label: "Entrada de un buen tester", v: 10, u: "Mohm" },
      { label: "Cable de masa sano", v: 5, u: "mohm" },
    ],
    def: { label: "", v: 14, u: "ohm" },
  },
];

/* ------------------------------------------------------------ números */
function n(x: number) {
  if (!Number.isFinite(x)) return "—";
  const a = Math.abs(x);
  if (a === 0) return "0";
  if (a >= 10000) return x.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  if (a < 1e-6) {
    const e = Math.floor(Math.log10(a));
    return `${(x / 10 ** e).toLocaleString("es-AR", { maximumFractionDigits: 2 })} × 10^${e}`;
  }
  return x.toLocaleString("es-AR", { maximumSignificantDigits: 4 });
}
function errTxt(pct: number) {
  if (pct < 0.1) return "prácticamente igual";
  return `error del ${pct.toLocaleString("es-AR", { maximumFractionDigits: pct < 10 ? 1 : 0 })} %`;
}
function parse(s: string) {
  const t = s.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".").replace("−", "-");
  const v = parseFloat(t);
  return Number.isFinite(v) ? v : NaN;
}
const toBase = (u: Unit, v: number) => v * u.f + (u.off ?? 0);
const fromBase = (u: Unit, b: number) => (b - (u.off ?? 0)) / u.f;
function niceStep(range: number, target = 8) {
  const raw = range / target;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}

function useFontScale(ref: React.RefObject<SVGSVGElement | null>, max = 1.6) {
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setK(clamp(720 / Math.max(1, e.contentRect.width), 1, max)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, max]);
  return k;
}

const X0 = 72, X1 = 690;

export function ConversorUnidades({ inicial = "presion" }: { inicial?: string }) {
  const [catId, setCatId] = useState(inicial);
  const cat = CATS.find((c) => c.id === catId) ?? CATS[0];
  const [text, setText] = useState(String(cat.def.v).replace(".", ","));
  const [unitId, setUnitId] = useState(cat.def.u);
  const svgRef = useRef<SVGSVGElement>(null);
  const k = useFontScale(svgRef, 1.9);
  const fs = 12 * k;
  const nt = k > 1.3 ? 5 : 8; // menos marcas en pantallas chicas
  // Filas de la regla, según el tamaño de letra
  const L = (() => {
    const yP = 6 + fs * 1.15;
    const yA = yP + 8 + fs;
    const bar = yA + 14;
    const yB = bar + 22 + 14 + fs;
    return { yP, yA, bar, yB, H: yB + 10 };
  })();

  const unit = cat.units.find((u) => u.id === unitId) ?? cat.units[0];
  const value = parse(text);
  const base = toBase(unit, value);
  const ok = Number.isFinite(base);

  const pick = (c: Cat, e: Ejemplo) => {
    setCatId(c.id);
    setUnitId(e.u);
    setText(String(e.v).replace(".", ","));
  };

  /* --------- regla doble */
  const ruler = useMemo(() => {
    if (cat.pair === "log" || !ok) return null;
    const A = cat.units.find((u) => u.id === (cat.pair as [string, string])[0])!;
    const B = cat.units.find((u) => u.id === (cat.pair as [string, string])[1])!;
    const va = fromBase(A, base);
    let lo = 0, hi: number;
    if (cat.id === "temperatura") {
      lo = Math.min(-40, Math.floor((va - 20) / 20) * 20);
      hi = Math.max(120, Math.ceil((va * 1.3 + 10) / 20) * 20);
    } else {
      const top = Math.abs(va) > 1e-12 ? Math.abs(va) * 1.5 : 10;
      const st = niceStep(top, 6);
      hi = Math.ceil(top / st) * st;
      if (va < 0) lo = -hi;
    }
    const map = (a: number) => X0 + ((a - lo) / (hi - lo)) * (X1 - X0);
    const stA = niceStep(hi - lo, nt);
    const ticksA: number[] = [];
    for (let a = Math.ceil(lo / stA) * stA; a <= hi + 1e-9; a += stA) ticksA.push(a);
    const bLo = fromBase(B, toBase(A, lo)), bHi = fromBase(B, toBase(A, hi));
    const stB = niceStep(bHi - bLo, nt);
    const ticksB: number[] = [];
    for (let b = Math.ceil(bLo / stB) * stB; b <= bHi + 1e-9; b += stB) ticksB.push(b);
    const mapB = (b: number) => map(fromBase(A, toBase(B, b)));
    return { A, B, va, vb: fromBase(B, base), ticksA, ticksB, map, mapB, stA, stB, x: clamp(map(va), X0, X1) };
  }, [cat, base, ok, nt]);

  /* --------- escala de prefijos (logarítmica) */
  const log = useMemo(() => {
    if (cat.pair !== "log" || !ok || base <= 0) return null;
    const unitSym = cat.units[0].sym;
    const decs = [-6, -3, 0, 3, 6];
    const names: Record<number, string> = { [-6]: "µ micro", [-3]: "m mili", 0: unitSym, 3: "k kilo", 6: "M mega" };
    const lo = -7, hi = 7;
    const map = (e: number) => X0 + ((e - lo) / (hi - lo)) * (X1 - X0);
    const e = Math.log10(base);
    return { decs, names, map, x: clamp(map(e), X0, X1), e };
  }, [cat, base, ok]);

  const rap = ruler && cat.rapida ? cat.rapida(ruler.va) : null;

  return (
    <AnimFrame
      tag="Calculadora"
      title="Conversor de unidades del taller"
      readouts={
        ok ? (
          <>
            {cat.units.map((u) => (
              <Readout key={u.id} label={u.name} value={n(fromBase(u, base))} unit={u.sym} tone={u.id === unit.id ? "accent" : undefined} />
            ))}
          </>
        ) : undefined
      }
      caption={
        <>
          <p style={{ marginBottom: ".45rem" }}>🧠 <b>Regla mental.</b> {cat.regla}</p>
          {rap && ruler && (
            <p style={{ marginBottom: ".45rem" }}>
              ⚡ <b>Cuenta rápida:</b> {rap.txt} ≈ <b>{n(rap.aprox)} {ruler.B.sym}</b> · exacto: <b>{n(ruler.vb)} {ruler.B.sym}</b>
              {Math.abs(ruler.vb) > 1e-9 && <> ({errTxt(Math.abs((rap.aprox - ruler.vb) / ruler.vb) * 100)})</>}
            </p>
          )}
          <p>⚠️ <b>Ojo.</b> {cat.trampa}</p>
        </>
      }
    >
      <div className="chip-row" style={{ margin: "0 0 .6rem" }}>
        {CATS.map((c) => (
          <button key={c.id} className={`chip ${c.id === cat.id ? "on" : ""}`} onClick={() => pick(c, c.def)}>
            <span aria-hidden>{c.icon}</span>{c.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center", marginBottom: ".3rem" }}>
        <input
          type="text" inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} aria-label="Valor"
          style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700, width: "8.5rem", padding: ".35rem .6rem" }}
        />
        <select value={unit.id} onChange={(e) => setUnitId(e.target.value)} aria-label="Unidad" style={{ fontSize: "1rem", padding: ".45rem .55rem" }}>
          {cat.units.map((u) => <option key={u.id} value={u.id}>{u.sym} — {u.name}</option>)}
        </select>
        {!ok && <span style={{ color: "var(--bad)", fontSize: ".88rem" }}>Escribí un número (podés usar coma).</span>}
      </div>

      <svg ref={svgRef} viewBox={`0 0 720 ${L.H}`} role="img" aria-label="Regla de conversión">
        {ruler && (
          <g>
            <rect x={X0} y={L.bar} width={X1 - X0} height={22} rx={4} fill="var(--surface)" stroke="var(--border-strong)" />
            <rect x={X0} y={L.bar} width={Math.max(0, ruler.x - X0)} height={22} rx={4} fill="var(--accent)" opacity={0.18} />
            {ruler.ticksA.map((a) => {
              const x = ruler.map(a);
              return (
                <g key={"a" + a}>
                  <line x1={x} y1={L.bar} x2={x} y2={L.bar - 10} stroke="var(--text-2)" strokeWidth={1.3} />
                  <text x={x} y={L.yA} textAnchor="middle" style={{ fontSize: fs, fill: "var(--text-2)", fontFamily: "var(--font-mono)" }}>{n(a)}</text>
                </g>
              );
            })}
            {ruler.ticksB.map((b) => {
              const x = ruler.mapB(b);
              return (
                <g key={"b" + b}>
                  <line x1={x} y1={L.bar + 22} x2={x} y2={L.bar + 32} stroke="var(--primary)" strokeWidth={1.3} />
                  <text x={x} y={L.yB} textAnchor="middle" style={{ fontSize: fs, fill: "var(--primary)", fontFamily: "var(--font-mono)" }}>{n(b)}</text>
                </g>
              );
            })}
            <text x={X0 - 16} y={L.yA} textAnchor="end" style={{ fontSize: fs * 1.05, fontWeight: 800, fill: "var(--text)" }}>{ruler.A.sym}</text>
            <text x={X0 - 16} y={L.yB} textAnchor="end" style={{ fontSize: fs * 1.05, fontWeight: 800, fill: "var(--primary)" }}>{ruler.B.sym}</text>
            <g style={{ transform: `translateX(${ruler.x}px)`, transition: "transform .35s ease" }}>
              <line x1={0} y1={L.yP + 6} x2={0} y2={L.H - 4} stroke="var(--accent)" strokeWidth={2.5} />
              <polygon points={`-7,${L.bar - 6} 7,${L.bar - 6} 0,${L.bar + 4}`} fill="var(--accent)" />
              <polygon points={`-7,${L.bar + 28} 7,${L.bar + 28} 0,${L.bar + 18}`} fill="var(--accent)" />
            </g>
            <text
              x={clamp(ruler.x, 200, 520)} y={L.yP} textAnchor="middle"
              style={{ fontSize: fs * 1.15, fontWeight: 800, fill: "var(--accent)", fontFamily: "var(--font-mono)", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}
            >
              {n(ruler.va)} {ruler.A.sym} = {n(ruler.vb)} {ruler.B.sym}
            </text>
          </g>
        )}
        {log && (
          <g>
            <text x={360} y={L.yP} textAnchor="middle" style={{ fontSize: fs * 1.1, fontWeight: 800, fill: "var(--accent)", fontFamily: "var(--font-mono)" }}>
              {n(value)} {unit.sym} = {n(base)} {cat.units[0].sym}
            </text>
            <line x1={X0} y1={L.bar + 11} x2={X1} y2={L.bar + 11} stroke="var(--border-strong)" strokeWidth={3} strokeLinecap="round" />
            {Array.from({ length: 15 }, (_, i) => i - 7).map((e) => (
              <line key={e} x1={log.map(e)} y1={L.bar + 5} x2={log.map(e)} y2={L.bar + 17} stroke="var(--border-strong)" strokeWidth={1} />
            ))}
            {log.decs.map((e) => (
              <g key={e}>
                <circle cx={log.map(e)} cy={L.bar + 11} r={6} fill={e === 0 ? "var(--text)" : "var(--primary)"} />
                <text x={log.map(e)} y={L.yA} textAnchor="middle" style={{ fontSize: fs * 1.05, fontWeight: 800, fill: e === 0 ? "var(--text)" : "var(--primary)" }}>{k > 1.3 ? log.names[e].split(" ")[0] : log.names[e]}</text>
                <text x={log.map(e)} y={L.yB} textAnchor="middle" style={{ fontSize: fs * 0.9, fill: "var(--muted)", fontFamily: "var(--font-mono)" }}>
                  {e === 0 ? "× 1" : e > 0 ? `× ${n(10 ** e)}` : `÷ ${n(10 ** -e)}`}
                </text>
              </g>
            ))}
            <g style={{ transform: `translateX(${log.x}px)`, transition: "transform .35s ease" }}>
              <line x1={0} y1={L.yP + 6} x2={0} y2={L.bar + 26} stroke="var(--accent)" strokeWidth={2.5} />
              <polygon points={`-8,${L.bar - 4} 8,${L.bar - 4} 0,${L.bar + 6}`} fill="var(--accent)" />
            </g>
          </g>
        )}
        {!ruler && !log && (
          <text x={360} y={L.bar + 14} textAnchor="middle" style={{ fontSize: fs, fill: "var(--muted)" }}>
            {ok ? "Para la escala de prefijos usá un valor mayor que cero." : "Esperando un número…"}
          </text>
        )}
      </svg>

      <div style={{ display: "flex", flexWrap: "wrap", gap: ".35rem", alignItems: "center", marginTop: ".3rem" }}>
        <span style={{ fontSize: ".8rem", color: "var(--muted)", fontWeight: 650 }}>Ejemplos del taller:</span>
        {cat.ejemplos.map((e) => {
          const u = cat.units.find((x) => x.id === e.u)!;
          const on = unit.id === e.u && Math.abs(value - e.v) < 1e-9;
          return (
            <button key={e.label} className={`chip ${on ? "on" : ""}`} style={{ padding: ".2rem .6rem", fontSize: ".8rem" }} onClick={() => pick(cat, e)}>
              {e.label}: <b style={{ fontFamily: "var(--font-mono)", color: "inherit" }}>{n(e.v)} {u.sym}</b>
            </button>
          );
        })}
      </div>
    </AnimFrame>
  );
}
