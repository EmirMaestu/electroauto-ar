/* Presión absoluta vs manométrica, con la altura de la Ruta 7. El manómetro de cubiertas y el vacuómetro miden
   "contra la atmósfera"; el sensor MAP mide contra el vacío perfecto. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, fmt } from "../ui/anim-kit";

const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;
const pAtm = (h: number) => 101.325 * Math.pow(1 - 2.2558e-5 * h, 5.2559); // kPa (atmósfera estándar)
const PSI = 6.895; // kPa
const MAP_IDLE = 34; // kPa absolutos en ralentí (valor típico)

const PLACES = [
  { h: 0, x: 440, n: "Nivel del mar" },
  { h: 750, x: 498, n: "Mendoza" },
  { h: 1350, x: 556, n: "Potrerillos" },
  { h: 1900, x: 612, n: "Uspallata" },
  { h: 3200, x: 692, n: "Cristo Redentor" },
];

export function FisPresionAbsoluta() {
  const [alt, setAlt] = useState(750);
  const [psi, setPsi] = useState(30);
  const [ref, setRef] = useState<"mza" | "aca">("mza");

  const pa = pAtm(alt);
  const pRef = ref === "mza" ? pAtm(750) : pa;
  const tireAbs = pRef + psi * PSI;
  const gauge = tireAbs - pa;
  const vac = (pa - MAP_IDLE) / 3.386; // inHg
  const mapWot = pa * 0.97;

  // escala vertical
  const Y0 = 330, Y1 = 40, PMAX = 340;
  const my = (p: number) => Y0 - (p / PMAX) * (Y0 - Y1);
  const cols = [
    { x: 120, label: "Atmósfera", sub: "acá", p: pa, color: "var(--c-air)" },
    { x: 205, label: "Cubierta", sub: "absoluta", p: tireAbs, color: "var(--c-metal-2)" },
    { x: 290, label: "Admisión", sub: "ralentí", p: MAP_IDLE, color: "var(--c-mix)" },
    { x: 375, label: "Admisión", sub: "a fondo", p: mapWot, color: "var(--c-mix)" },
  ];
  const W = 46;

  // perfil de la ruta
  const ry = (h: number) => 180 - (h / 3200) * 120;
  let carX = PLACES[0].x;
  for (let i = 0; i < PLACES.length - 1; i++) {
    const a = PLACES[i], b = PLACES[i + 1];
    if (alt >= a.h && alt <= b.h) carX = a.x + ((alt - a.h) / (b.h - a.h)) * (b.x - a.x);
  }
  const route = PLACES.map((p, i) => `${i ? "L" : "M"}${p.x},${ry(p.h)}`).join(" ");

  return (
    <AnimFrame
      title="Presión absoluta y manométrica: lo que mide cada instrumento"
      controls={
        <>
          <Slider label="Altura" value={alt} min={0} max={3200} step={50} onChange={setAlt} unit="m" />
          <Slider label="Inflado" value={psi} min={20} max={40} step={1} onChange={setPsi} unit="psi" />
          <Seg value={ref} onChange={setRef} options={[{ value: "mza", label: "Inflada en Mendoza" }, { value: "aca", label: "Inflada acá" }]} ariaLabel="Dónde se infló" />
        </>
      }
      readouts={
        <>
          <Readout label="Presión atmosférica" value={fmt(pa * 10, 0)} unit="hPa" />
          <Readout label="Manómetro de cubierta" value={fmt(gauge / PSI, 1)} unit="psi" tone={Math.abs(gauge / PSI - psi) > 1 ? "warn" : "ok"} />
          <Readout label="Cubierta absoluta" value={fmt(tireAbs, 0)} unit="kPa" />
          <Readout label="MAP en ralentí" value={fmt(MAP_IDLE, 0)} unit="kPa abs" />
          <Readout label="Vacuómetro en ralentí" value={fmt(vac, 1)} unit="inHg" tone="accent" />
          <Readout label="MAP a fondo" value={fmt(mapWot, 0)} unit="kPa abs" />
        </>
      }
      legend={[
        { color: "var(--c-air)", label: "Presión atmosférica" },
        { color: "var(--accent)", label: "Lo que marca un manómetro (diferencia con la atmósfera)" },
      ]}
      caption={
        <>
          <p>
            Todas las barras arrancan del <b>vacío perfecto</b> (presión absoluta cero). El sensor MAP mide así: en absoluta. El manómetro de
            cubiertas y el vacuómetro, en cambio, miden <b>la diferencia con la atmósfera</b> (lo naranja). Por eso una cubierta "a 30 psi"
            tiene adentro 30 psi <i>más</i> que el aire de afuera.
          </p>
          <p>
            Con la cubierta inflada en Mendoza, mové la altura: el aire de adentro no cambió, pero el de afuera tiene menos presión, así que
            el manómetro <b>marca más</b> (en el Cristo Redentor, unos 3,5 psi de más; sin contar que la cubierta se calienta andando). Ahora,
            a {fmt(alt, 0)} m, marca <b>{fmt(gauge / PSI, 1)} psi</b>. Y el vacuómetro en ralentí marca menos con la altura aunque el motor esté
            sano: acá da ≈ {fmt(vac, 0)} inHg, contra ≈ 20 a nivel del mar.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 370" role="img" aria-label="Barras de presión absoluta y manométrica">
        {/* escala */}
        <line x1={70} y1={Y0} x2={70} y2={Y1} stroke="var(--border-strong)" />
        {[0, 50, 100, 150, 200, 250, 300].map((p) => (
          <g key={p}>
            <line x1={66} y1={my(p)} x2={420} y2={my(p)} stroke="var(--border)" strokeDasharray="2 5" />
            <text x={62} y={my(p) + 4} textAnchor="end" className="svg-small">{p}</text>
          </g>
        ))}
        <text x={62} y={Y1 - 14} textAnchor="end" className="svg-small">kPa abs</text>
        <text x={74} y={Y0 + 16} className="svg-small">0 = vacío perfecto</text>
        {/* línea de la atmósfera */}
        <line x1={70} y1={my(pa)} x2={420} y2={my(pa)} stroke="var(--c-air)" strokeWidth={1.5} strokeDasharray="6 4" />
        {cols.map((c) => (
          <g key={c.x + c.sub}>
            <rect x={c.x - W / 2} y={my(c.p)} width={W} height={Y0 - my(c.p)} rx={4} fill={c.color} opacity={0.75} />
            <text x={c.x} y={my(c.p) - 6} textAnchor="middle" className="svg-mono" style={{ fontSize: 11 }}>{fmt(c.p, 0)}</text>
            <text x={c.x} y={Y0 + 30} textAnchor="middle" className="svg-small">{c.label}</text>
            <text x={c.x} y={Y0 + 42} textAnchor="middle" className="svg-small">{c.sub}</text>
          </g>
        ))}
        {/* manométrica de la cubierta */}
        <rect x={205 + W / 2 + 4} y={my(tireAbs)} width={8} height={my(pa) - my(tireAbs)} fill="var(--accent)" />
        <text x={205 + W / 2 + 16} y={(my(tireAbs) + my(pa)) / 2 - 4} className="svg-label" style={{ ...HALO, fill: "var(--accent)" }}>manómetro:</text>
        <text x={205 + W / 2 + 16} y={(my(tireAbs) + my(pa)) / 2 + 12} className="svg-label" style={{ ...HALO, fill: "var(--accent)" }}>{fmt(gauge / PSI, 1)} psi</text>
        {/* vacuómetro */}
        <rect x={290 + W / 2 + 4} y={my(pa)} width={8} height={my(MAP_IDLE) - my(pa)} fill="var(--accent)" opacity={0.85} />
        <text x={290 + W / 2 + 16} y={(my(pa) + my(MAP_IDLE)) / 2} className="svg-small" style={{ ...HALO, fill: "var(--accent)" }}>vacío</text>
        <text x={290 + W / 2 + 16} y={(my(pa) + my(MAP_IDLE)) / 2 + 13} className="svg-small" style={{ ...HALO, fill: "var(--accent)" }}>{fmt(vac, 1)} inHg</text>
        <text x={250} y={my(pa) - 6} className="svg-small" style={{ ...HALO, fill: "var(--c-air)" }}>atmósfera a {fmt(alt, 0)} m</text>

        {/* cómo mide cada uno: membrana entre dos cámaras */}
        <Membrana x={440} y={262} title="Sensor MAP" left="vacío sellado" leftP={0} right="admisión" rightP={MAP_IDLE} note="mide presión absoluta" />
        <Membrana x={582} y={262} title="Manómetro" left="atmósfera" leftP={pa} right="cubierta" rightP={tireAbs} note="mide la diferencia" />

        {/* perfil de la ruta 7 */}
        <text x={440} y={40} className="svg-label">Ruta 7, de Mendoza a Chile</text>
        <path d={`${route} L692,184 L440,184 Z`} fill="var(--c-block)" opacity={0.5} />
        <path d={route} fill="none" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {PLACES.map((p) => (
          <g key={p.n}>
            <circle cx={p.x} cy={ry(p.h)} r={3} fill="var(--c-metal-dark)" />
            <text x={p.x} y={ry(p.h) - 8} textAnchor={p.x > 650 ? "end" : "middle"} className="svg-small" style={{ fontSize: 9.5 }}>{p.n}</text>
          </g>
        ))}
        <circle cx={carX} cy={ry(alt)} r={7} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        <text x={440} y={204} className="svg-small">{fmt(alt, 0)} m · {fmt(pa * 10, 0)} hPa · aire {fmt((1 - pa / 101.325) * 100, 0)} % menos denso*</text>
        <text x={440} y={222} className="svg-small" style={{ fontSize: 9.5 }}>* a igual temperatura</text>
      </svg>
    </AnimFrame>
  );
}

/** Cámara con una membrana en el medio que se curva hacia el lado de menor presión. */
function Membrana(p: { x: number; y: number; title: string; left: string; leftP: number; right: string; rightP: number; note: string }) {
  const w = 120, h = 64;
  const bow = Math.max(-14, Math.min(14, ((p.rightP - p.leftP) / 300) * 14)); // + = se curva hacia la izquierda
  const mx = p.x + w / 2;
  return (
    <g>
      <text x={p.x} y={p.y - 8} className="svg-label">{p.title}</text>
      <rect x={p.x} y={p.y} width={w} height={h} rx={6} fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      <rect x={p.x + 2} y={p.y + 2} width={w / 2 - 2} height={h - 4} rx={4} fill={p.leftP > 0 ? "var(--c-air)" : "var(--surface-2)"} opacity={0.25} />
      <path d={`M${mx},${p.y + 2} Q${mx - bow * 2},${p.y + h / 2} ${mx},${p.y + h - 2}`} fill="none" stroke="var(--accent)" strokeWidth={3} />
      <text x={p.x + w / 4} y={p.y + h / 2 - 2} textAnchor="middle" className="svg-small" style={{ fontSize: 9.5 }}>{p.left}</text>
      <text x={p.x + w / 4} y={p.y + h / 2 + 11} textAnchor="middle" className="svg-mono" style={{ fontSize: 10 }}>{fmt(p.leftP, 0)}</text>
      <text x={p.x + (3 * w) / 4} y={p.y + h / 2 - 2} textAnchor="middle" className="svg-small" style={{ fontSize: 9.5 }}>{p.right}</text>
      <text x={p.x + (3 * w) / 4} y={p.y + h / 2 + 11} textAnchor="middle" className="svg-mono" style={{ fontSize: 10 }}>{fmt(p.rightP, 0)}</text>
      <text x={p.x + w / 2} y={p.y + h + 14} textAnchor="middle" className="svg-small" style={{ fill: "var(--accent)" }}>{p.note}</text>
    </g>
  );
}
