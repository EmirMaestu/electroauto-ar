/* Punto de ebullición del refrigerante según la altura, la tapa del radiador y la mezcla.
   Presión atmosférica: p = 1013,25 · (1 − 2,25577·10⁻⁵·h)^5,25588 hPa (atmósfera estándar).
   Agua: ecuación de Antoine. Mezcla 50 % etilenglicol: ley de Raoult (fracción molar del agua ≈ 0,76).
   La tapa abre por presión RELATIVA: la presión absoluta del circuito = atmosférica + tapa. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, fmt } from "../ui/anim-kit";

const LUGARES = [
  { h: 0, name: "Nivel del mar", x: 44 },
  { h: 750, name: "Mendoza", x: 168 },
  { h: 1350, name: "Potrerillos", x: 300 },
  { h: 1900, name: "Uspallata", x: 440 },
  { h: 2720, name: "Puente del Inca", x: 590 },
  { h: 3200, name: "Las Cuevas", x: 690 },
];

export const presionAtm = (h: number) => 1013.25 * (1 - 2.25577e-5 * h) ** 5.25588; // hPa

/** Temperatura de ebullición del agua [°C] para una presión absoluta [bar]. */
export function ebullicionAgua(bar: number) {
  const mmHg = bar * 750.062;
  const lg = Math.log10(mmHg);
  const t = 1730.63 / (8.07131 - lg) - 233.426;
  return t <= 100 ? t : 1810.94 / (8.14019 - lg) - 244.485;
}

export function TermoEbullicion() {
  const clock = useAnimClock({ speed: 1 });
  const [h, setH] = useState(750);
  const [tapa, setTapa] = useState(1.0);
  const [mezcla, setMezcla] = useState<"agua" | "mix">("mix");
  const [tMotor, setTMotor] = useState(102);

  const patm = presionAtm(h);
  const pabs = patm / 1000 + tapa;
  const tb = mezcla === "agua" ? ebullicionAgua(pabs) : ebullicionAgua(pabs / 0.757);
  const margen = tb - tMotor;
  const hierve = margen <= 0;

  /* perfil de la ruta */
  const YB = 186, YS = 0.040;
  const yOf = (alt: number) => YB - alt * YS;
  let cx = LUGARES[0].x;
  for (let i = 1; i < LUGARES.length; i++) {
    const a = LUGARES[i - 1], b = LUGARES[i];
    if (h <= b.h) { cx = a.x + ((h - a.h) / (b.h - a.h)) * (b.x - a.x); break; }
    cx = b.x;
  }
  const cy = yOf(h);
  const ground = LUGARES.map((l, i) => `${i ? "L" : "M"}${l.x},${yOf(l.h)}`).join("") + ` L${LUGARES[LUGARES.length - 1].x},${YB + 10} L${LUGARES[0].x},${YB + 10} Z`;

  /* escala de temperatura */
  const SX0 = 60, SX1 = 540, SY = 300, T0 = 80, T1 = 140;
  const sx = (t: number) => SX0 + ((Math.max(T0, Math.min(T1, t)) - T0) / (T1 - T0)) * (SX1 - SX0);

  /* depósito */
  const DX = 580, DY = 244, DW = 110, DH = 96;
  const bubbles = hierve ? 9 : margen < 5 ? 3 : 0;

  return (
    <AnimFrame
      title="¿A qué temperatura hierve el refrigerante? Altura, tapa y mezcla"
      clock={clock}
      controls={
        <>
          <Slider label="Altura" value={h} min={0} max={3200} step={50} onChange={setH} unit="m" format={(v) => fmt(v, 0)} />
          <Seg value={tapa} onChange={setTapa} ariaLabel="Tapa" options={[{ value: 0, label: "Sin tapa / tapa que no sella" }, { value: 1.0, label: "Tapa 1,0 bar" }, { value: 1.4, label: "Tapa 1,4 bar" }]} />
          <Seg value={mezcla} onChange={setMezcla} ariaLabel="Líquido" options={[{ value: "agua", label: "Agua sola" }, { value: "mix", label: "Refrigerante 50 %" }]} />
          <Slider label="Motor a" value={tMotor} min={80} max={125} step={1} onChange={setTMotor} unit="°C" />
        </>
      }
      readouts={
        <>
          <Readout label="Presión atmosférica" value={fmt(patm, 0)} unit="hPa" />
          <Readout label="Presión en el circuito" value={fmt(pabs, 2)} unit="bar abs." />
          <Readout label="Hierve a" value={fmt(tb, 1)} unit="°C" tone="accent" />
          <Readout label="Margen" value={(margen > 0 ? "+" : "") + fmt(margen, 0)} unit="°C" tone={hierve ? "bad" : margen < 10 ? "warn" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--ok)", label: "Temperatura normal de trabajo (82–105 °C)" },
        { color: "var(--accent)", label: "Temperatura del motor" },
        { color: "var(--bad)", label: "Punto de ebullición" },
      ]}
      caption={
        <>
          <p>
            Arriba hay menos aire encima: la presión baja y el agua hierve antes. Sin tapa, el agua hierve a ≈ 100 °C en el mar,
            {" "}{fmt(ebullicionAgua(presionAtm(750) / 1000), 1)} °C en Mendoza y {fmt(ebullicionAgua(presionAtm(3200) / 1000), 1)} °C en Las Cuevas:
            ¡por debajo de la temperatura normal del motor! La <b>tapa presurizada</b> sube la presión del circuito y con ella el punto de
            ebullición; el <b>anticongelante</b> lo sube unos grados más.
          </p>
          <p>
            Ojo: la tapa trabaja por diferencia con la atmósfera, así que en altura la presión total también baja. Una tapa que no sella es
            como no tener tapa: en la subida a Alta Montaña, el motor hierve. Cálculo con fórmulas de física (Antoine, Raoult): valores
            aproximados; la tapa marca la presión máxima, el circuito no siempre llega a ella.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 360" role="img" aria-label="Punto de ebullición según la altura">
        {/* perfil */}
        <path d={ground} fill="var(--c-metal-light)" opacity={0.55} stroke="var(--c-metal-2)" strokeWidth={1.5} />
        {LUGARES.map((l) => (
          <g key={l.name}>
            <circle cx={l.x} cy={yOf(l.h)} r={3} fill="var(--c-metal-dark)" />
            <text x={l.x} y={yOf(l.h) + 17} textAnchor={l.x > 650 ? "end" : l.x < 60 ? "start" : "middle"} className="svg-label" style={{ fontSize: 11 }}>{l.name}</text>
            <text x={l.x} y={yOf(l.h) + 30} textAnchor={l.x > 650 ? "end" : l.x < 60 ? "start" : "middle"} className="svg-small" style={{ fontSize: 9.5 }}>{fmt(l.h, 0)} m</text>
          </g>
        ))}
        {/* auto */}
        <g transform={`translate(${cx},${cy - 12})`}>
          <rect x={-16} y={-8} width={32} height={12} rx={3} fill="var(--accent)" />
          <rect x={-9} y={-15} width={16} height={8} rx={2} fill="var(--accent)" opacity={0.8} />
          <circle cx={-9} cy={5} r={4} fill="var(--c-rubber)" />
          <circle cx={9} cy={5} r={4} fill="var(--c-rubber)" />
        </g>
        <text x={14} y={24} className="svg-title" style={{ fontSize: 13 }}>Ruta 7 hacia Chile</text>

        {/* escala de temperatura */}
        <rect x={sx(82)} y={SY - 14} width={sx(105) - sx(82)} height={28} fill="var(--ok)" opacity={0.18} />
        <line x1={SX0} y1={SY} x2={SX1} y2={SY} stroke="var(--border-strong)" strokeWidth={3} />
        {[80, 90, 100, 110, 120, 130, 140].map((t) => (
          <g key={t}>
            <line x1={sx(t)} y1={SY - 5} x2={sx(t)} y2={SY + 5} stroke="var(--muted)" />
            <text x={sx(t)} y={SY + 20} textAnchor="middle" className="svg-small">{t} °C</text>
          </g>
        ))}
        <text x={(sx(82) + sx(105)) / 2} y={SY + 36} textAnchor="middle" className="svg-small" style={{ fill: "var(--ok)" }}>trabajo normal</text>
        {/* motor */}
        <polygon points={`${sx(tMotor)},${SY - 4} ${sx(tMotor) - 8},${SY - 18} ${sx(tMotor) + 8},${SY - 18}`} fill="var(--accent)" />
        <text x={sx(tMotor)} y={SY - 24} textAnchor="middle" className="svg-label" style={{ fill: "var(--accent)" }}>motor {tMotor} °C</text>
        {/* ebullición */}
        <line x1={sx(tb)} y1={SY - 44} x2={sx(tb)} y2={SY + 4} stroke="var(--bad)" strokeWidth={3} />
        <text x={Math.min(SX1, sx(tb))} y={SY - 50} textAnchor={tb > 132 ? "end" : "middle"} className="svg-label" style={{ fill: "var(--bad)" }}>
          hierve a {fmt(tb, 1)} °C{tb > T1 ? " →" : ""}
        </text>

        {/* depósito */}
        <rect x={DX} y={DY} width={DW} height={DH} rx={10} fill="var(--surface)" stroke="var(--border-strong)" strokeWidth={2} />
        <rect x={DX + 4} y={DY + 26} width={DW - 8} height={DH - 30} rx={7} fill="var(--c-coolant)" opacity={0.55} />
        <rect x={DX + DW / 2 - 18} y={DY - 12} width={36} height={14} rx={3} fill={tapa > 0 ? "var(--c-metal-dark)" : "var(--bad)"} />
        {Array.from({ length: bubbles }, (_, i) => {
          const f = ((clock.t * (hierve ? 1.2 : 0.6) + i / Math.max(1, bubbles)) % 1);
          return <circle key={i} cx={DX + 16 + ((i * 37) % (DW - 30))} cy={DY + DH - 8 - f * (DH - 38)} r={2.5 + f * 4} fill="none" stroke="#fff" strokeWidth={1.5} opacity={1 - f * 0.6} />;
        })}
        {hierve && [0, 1, 2].map((k) => {
          const f = ((clock.t * 0.8 + k / 3) % 1);
          return <circle key={k} cx={DX + DW / 2 + (k - 1) * 10} cy={DY - 16 - f * 30} r={5 + f * 8} fill="var(--muted)" opacity={(1 - f) * 0.45} />;
        })}
        <text x={DX + DW / 2} y={DY + DH + 16} textAnchor="middle" className="svg-label" style={{ fill: hierve ? "var(--bad)" : "var(--ok)" }}>
          {hierve ? "¡HIERVE!" : margen < 10 ? "al límite" : "no hierve"}
        </text>
      </svg>
    </AnimFrame>
  );
}
