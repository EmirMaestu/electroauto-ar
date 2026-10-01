/* Qué le pasa al motor con la altura: de nivel del mar al Cristo Redentor por la Ruta 7.
   Atmósfera estándar: presión, densidad del aire, potencia de un atmosférico vs un turbo,
   punto de ebullición con y sin tapa presurizada, compresión, vacío y MAP esperados. */
import { useEffect, useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, useAnimClock, clamp, lerp, fmt, TAU } from "../ui/anim-kit";

/* --------------------------------------------------- física (atmósfera estándar) */
const P0 = 1013.25; // hPa
const presionAtm = (h: number) => P0 * Math.pow(1 - 2.25577e-5 * h, 5.25588); // hPa
const tempStd = (h: number) => 15 - 0.0065 * h; // °C
const densRel = (h: number) => (presionAtm(h) / P0) * (288.15 / (tempStd(h) + 273.15));
/** Potencia relativa de un atmosférico (corrección tipo SAE: p/p0 · √(T0/T)). */
const potAtmo = (h: number) => (presionAtm(h) / P0) * Math.sqrt(288.15 / (tempStd(h) + 273.15));
/** Turbo: mantiene la presión absoluta de soplado mientras le alcance la relación de compresión. */
const potTurbo = (h: number) => Math.min(1, (2.4 * presionAtm(h)) / 1800);
/** Ebullición del agua (Antoine) para una presión absoluta en hPa. */
function hierve(hPa: number) {
  const mmHg = hPa * 0.750062;
  const lg = Math.log10(mmHg);
  const t1 = 1730.63 / (8.07131 - lg) - 233.426;
  return t1 <= 100 ? t1 : 1810.94 / (8.14019 - lg) - 244.485;
}
const COMP_FABRICA = 12.5; // bar relativos, medido a nivel del mar
const compresion = (h: number) => (COMP_FABRICA + P0 / 1000) * (presionAtm(h) / P0) - presionAtm(h) / 1000;
const vacioRalenti = (h: number) => (presionAtm(h) - 350) / 33.8639; // inHg, con MAP ≈ 35 kPa abs

const LUGARES = [
  { h: 0, name: "Nivel del mar", short: "Mar" },
  { h: 750, name: "Mendoza", short: "Mendoza" },
  { h: 1350, name: "Potrerillos", short: "Potrerillos" },
  { h: 1900, name: "Uspallata", short: "Uspallata" },
  { h: 2720, name: "Puente del Inca", short: "P. del Inca" },
  { h: 3150, name: "Las Cuevas", short: "Las Cuevas" },
  { h: 3800, name: "Cristo Redentor", short: "Cristo" },
];
/* Perfil esquemático (x en el dibujo, h en metros). */
const RUTA: [number, number][] = [
  [70, 0], [150, 750], [252, 1350], [362, 1900], [470, 2720], [548, 3150], [626, 3800], [690, 4000],
];
const HMAX = 4000;
const YB = 312, YT = 72;
const yOf = (h: number) => YB - (h / HMAX) * (YB - YT);
function xOf(h: number) {
  for (let i = 1; i < RUTA.length; i++) {
    const [x0, h0] = RUTA[i - 1], [x1, h1] = RUTA[i];
    if (h <= h1) return lerp(x0, x1, (h - h0) / (h1 - h0));
  }
  return RUTA[RUTA.length - 1][0];
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

/* Moléculas: posiciones fijas pseudoaleatorias dentro de la caja. */
const MOL = Array.from({ length: 44 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 12345.678;
  return { x: a - Math.floor(a), y: b - Math.floor(b), ph: (i * 0.37) % 1 };
});

export function AlturaMotor({ inicial = 750 }: { inicial?: number }) {
  const clock = useAnimClock({ speed: 1 });
  const [h, setH] = useState(inicial);
  const [auto, setAuto] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const k = useFontScale(svgRef);
  const fs = 12 * k;
  const t = Math.max(0, clock.t);

  // Viaje automático Mendoza ⇄ Las Cuevas (arranca desde la altura actual)
  const autoRef = useRef<{ t0: number; ph: number } | null>(null);
  useEffect(() => {
    if (!auto) { autoRef.current = null; return; }
    if (!autoRef.current) autoRef.current = { t0: t, ph: Math.acos(clamp(1 - (2 * (h - 750)) / 2400, -1, 1)) };
    const { t0, ph } = autoRef.current;
    const u = (t - t0) * 0.1 * TAU + ph;
    setH(Math.round((750 + 2400 * (0.5 - 0.5 * Math.cos(u))) / 10) * 10);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, auto]);

  const p = presionAtm(h);
  const rho = densRel(h);
  const pa = potAtmo(h);
  const pt = potTurbo(h);
  const bSin = hierve(p);
  const bCon = hierve(p + 1200);
  const comp = compresion(h);
  const vac = vacioRalenti(h);
  const ATMO_CV = 110, TURBO_CV = 150;

  // Auto sobre la ruta
  const cx = xOf(h), cy = yOf(h);
  const ang = (() => {
    const d = 40;
    const x1 = xOf(Math.max(0, h - d)), x2 = xOf(Math.min(HMAX, h + d));
    const y1 = yOf(Math.max(0, h - d)), y2 = yOf(Math.min(HMAX, h + d));
    return (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  })();
  const wheelA = (h * 0.6 + t * (auto ? 400 : 0)) % 360;

  const routeD = RUTA.map(([x, hh], i) => `${i ? "L" : "M"}${x},${yOf(hh)}`).join(" ");
  const groundD = `${routeD} L690,${YB} L70,${YB} Z`;
  const nMol = Math.round(40 * rho);

  const place = LUGARES.reduce((best, l) => (Math.abs(l.h - h) < Math.abs(best.h - h) ? l : best), LUGARES[0]);
  const near = Math.abs(place.h - h) <= 60;

  return (
    <AnimFrame
      title="El motor sube la cordillera: qué cambia con la altura"
      clock={clock}
      controls={
        <>
          <Slider label="Altura" value={h} min={0} max={HMAX} step={10} onChange={(v) => { setAuto(false); setH(v); }} unit="m" format={(v) => fmt(v, 0)} width={170} />
          <Toggle label="Subir y bajar solo" checked={auto} onChange={setAuto} />
          <div className="chip-row" style={{ margin: 0 }}>
            {LUGARES.map((l) => (
              <button key={l.name} className={`chip ${Math.abs(l.h - h) < 1 ? "on" : ""}`} style={{ padding: ".18rem .55rem", fontSize: ".78rem" }} onClick={() => { setAuto(false); setH(l.h); }}>
                {l.short}
              </button>
            ))}
          </div>
        </>
      }
      readouts={
        <>
          <Readout label="Presión atmosférica" value={fmt(p, 0)} unit="hPa" />
          <Readout label="Aire (densidad)" value={fmt(rho * 100, 0)} unit="%" tone={rho < 0.8 ? "warn" : undefined} />
          <Readout label={`Atmosférico (${ATMO_CV} CV)`} value={fmt(ATMO_CV * pa, 0)} unit="CV" tone={pa < 0.8 ? "bad" : pa < 0.93 ? "warn" : "ok"} />
          <Readout label={`Turbo (${TURBO_CV} CV)`} value={fmt(TURBO_CV * pt, 0)} unit="CV" tone={pt < 0.93 ? "warn" : "ok"} />
          <Readout label="Hierve sin tapa" value={fmt(bSin, 1)} unit="°C" tone={bSin < 95 ? "warn" : undefined} />
          <Readout label="Hierve con tapa 1,2 bar" value={fmt(bCon, 0)} unit="°C" tone="ok" />
          <Readout label={`Compresión (fábrica ${fmt(COMP_FABRICA, 1)})`} value={fmt(comp, 1)} unit="bar" tone="accent" />
          <Readout label="Vacío en ralentí" value={fmt(vac, 1)} unit="inHg" />
          <Readout label="MAP con motor parado" value={fmt(p / 10, 0)} unit="kPa" />
        </>
      }
      legend={[
        { color: "var(--c-air)", label: "Moléculas de aire en un mismo volumen" },
        { color: "var(--accent)", label: "Motor atmosférico" },
        { color: "var(--primary)", label: "Motor turbo" },
      ]}
      caption={
        <>
          <p>
            Arriba hay <b>menos aire en cada litro</b>. Un motor atmosférico llena los cilindros con el aire que encuentra, así que pierde
            potencia más o menos <b>1 % cada 100 m</b>: en Mendoza ya anda un 8 % abajo y en Las Cuevas, un 30 %. El <b>turbo</b> comprime el
            aire antes de que entre y compensa casi todo hasta los 2.000–2.500 m; más arriba empieza a perder algo, pero mucho menos.
          </p>
          <p>
            Ojo con las mediciones: el dato de compresión de fábrica está tomado <b>a nivel del mar</b>. Si en Uspallata medís 10 bar en un
            motor que «debería» dar 12,5, puede estar perfecto. Y el agua hierve antes: por eso la <b>tapa del radiador</b> presuriza el
            sistema. Valores de atmósfera estándar; con calor el aire es todavía menos denso.
          </p>
        </>
      }
    >
      <svg ref={svgRef} viewBox="0 0 720 340" role="img" aria-label="Perfil de la Ruta 7 con un auto subiendo">
        {/* grilla de alturas */}
        {[0, 1000, 2000, 3000, 4000].map((hh) => (
          <g key={hh}>
            <line x1={62} y1={yOf(hh)} x2={700} y2={yOf(hh)} stroke="var(--border)" strokeDasharray="3 5" />
            <text x={56} y={yOf(hh) + 4} textAnchor="end" style={{ fontSize: fs * 0.9, fill: "var(--muted)", fontFamily: "var(--font-mono)" }}>
              {hh === 0 ? "0 m" : fmt(hh, 0)}
            </text>
          </g>
        ))}

        {/* cordillera de fondo */}
        <path d="M232,312 L300,200 L340,222 L392,140 L432,170 L478,96 L516,140 L560,58 L596,100 L640,36 L676,84 L690,74 L690,312 Z" fill="var(--c-metal-2)" opacity={0.32} />
        <path d="M478,96 L487,110 L480,107 L473,113 L468,108 Z M560,58 L572,76 L565,73 L558,79 L551,72 Z M640,36 L654,56 L646,52 L639,59 L630,50 Z" fill="var(--c-metal-light)" />
        <path d="M140,312 L210,252 L262,268 L330,206 L380,232 L440,190 L500,215 L560,160 L620,190 L690,150 L690,312 Z" fill="var(--c-metal-2)" opacity={0.2} />
        <text x={700} y={16} textAnchor="end" style={{ fontSize: fs * 0.85, fill: "var(--muted)" }}>Aconcagua 6.961 m ↑</text>

        {/* terreno bajo la ruta y la ruta */}
        <path d={groundD} fill="var(--surface)" />
        <path d={groundD} fill="var(--c-oil)" opacity={0.22} />
        <path d={routeD} fill="none" stroke="var(--c-belt)" strokeWidth={5} strokeLinejoin="round" opacity={0.85} />
        <path d={routeD} fill="none" stroke="var(--c-spark)" strokeWidth={1.2} strokeDasharray="6 7" />

        {/* lugares */}
        {LUGARES.map((l, i) => {
          const x = xOf(l.h), y = yOf(l.h);
          const on = Math.abs(l.h - h) <= 60;
          return (
            <g key={l.name}>
              <circle cx={x} cy={y} r={on ? 6 : 4} fill={on ? "var(--accent)" : "var(--surface)"} stroke="var(--text-2)" strokeWidth={1.5} />
              <text
                x={x > 580 ? x - 8 : x + 8} y={y + 16 + (i % 2) * fs * 1.1} textAnchor={x > 580 ? "end" : "start"}
                style={{ fontSize: fs * 0.88, fontWeight: on ? 800 : 600, fill: on ? "var(--text)" : "var(--text-2)" }}
              >
                {k > 1.3 ? l.short : `${l.name} · ${fmt(l.h, 0)} m`}
              </text>
            </g>
          );
        })}

        {/* línea de altura actual y cartel con la altura */}
        <line x1={62} y1={cy} x2={cx} y2={cy} stroke="var(--accent)" strokeWidth={1.4} strokeDasharray="4 4" />
        <g transform={`translate(${clamp(cx, 40, 680)} ${cy - 30 - fs})`}>
          <rect x={-fs * 2.4} y={-fs - 3} width={fs * 4.8} height={fs + 8} rx={5} fill="var(--accent)" />
          <text x={0} y={0} textAnchor="middle" style={{ fontSize: fs * 0.95, fontWeight: 800, fill: "#fff", fontFamily: "var(--font-mono)" }}>
            {fmt(h, 0)} m
          </text>
        </g>

        {/* auto */}
        <g transform={`translate(${cx} ${cy}) rotate(${ang})`}>
          <path d="M-22,-6 L-20,-14 L-8,-15 L-2,-22 L12,-22 L18,-14 L24,-12 L24,-6 Z" fill="var(--accent)" stroke="var(--c-metal-dark)" strokeWidth={1} />
          <path d="M-5,-15 L0,-20 L10,-20 L14,-15 Z" fill="var(--c-mix)" opacity={0.6} />
          {[-13, 15].map((wx) => (
            <g key={wx} transform={`translate(${wx} -5) rotate(${wheelA})`}>
              <circle r={5.5} fill="var(--c-rubber)" stroke="var(--c-metal-2)" strokeWidth={1} />
              <line x1={-3.5} y1={0} x2={3.5} y2={0} stroke="var(--c-metal-light)" strokeWidth={1.4} />
            </g>
          ))}
        </g>

        {/* caja de aire: moléculas en un mismo volumen */}
        <g>
          <rect x={80} y={20} width={96} height={96} rx={8} fill="var(--surface)" stroke="var(--border-strong)" />
          {MOL.slice(0, nMol).map((m, i) => {
            const jx = Math.sin(t * 3 + m.ph * TAU) * 2.2, jy = Math.cos(t * 2.6 + m.ph * 9) * 2.2;
            return <circle key={i} cx={88 + m.x * 80 + jx} cy={28 + m.y * 80 + jy} r={3.2} fill="var(--c-air)" opacity={0.85} />;
          })}
          <text x={128} y={132} textAnchor="middle" style={{ fontSize: fs * 0.85, fill: "var(--text-2)", fontWeight: 700 }}>
            1 litro de aire: {fmt(rho * 100, 0)} %
          </text>
        </g>

        {/* barras de potencia */}
        <g>
          {[
            { lbl: "Atmosférico", v: pa, cv: ATMO_CV, color: "var(--accent)" },
            { lbl: "Turbo", v: pt, cv: TURBO_CV, color: "var(--primary)" },
          ].map((b, i) => {
            const x0 = 200, w = 190, y = 30 + i * 44;
            return (
              <g key={b.lbl}>
                <text x={x0} y={y} style={{ fontSize: fs * 0.95, fontWeight: 750, fill: "var(--text)" }}>
                  {b.lbl}: <tspan style={{ fontFamily: "var(--font-mono)", fill: b.color }}>{fmt(b.cv * b.v, 0)} CV</tspan>
                  <tspan style={{ fill: "var(--muted)", fontWeight: 500 }}> ({fmt(b.v * 100, 0)} %)</tspan>
                </text>
                <rect x={x0} y={y + 6} width={w} height={12} rx={6} fill="var(--surface-3)" />
                <rect x={x0} y={y + 6} width={w * b.v} height={12} rx={6} fill={b.color} />
                <line x1={x0 + w} y1={y + 3} x2={x0 + w} y2={y + 21} stroke="var(--text-2)" strokeWidth={1.2} />
              </g>
            );
          })}
        </g>

        {near && (
          <text x={700} y={YB + 22} textAnchor="end" style={{ fontSize: fs, fontWeight: 800, fill: "var(--accent)" }}>📍 {place.name}</text>
        )}
      </svg>
    </AnimFrame>
  );
}
