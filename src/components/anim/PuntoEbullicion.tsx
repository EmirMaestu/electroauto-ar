/* Punto de ebullición del refrigerante según la altura y la presión de la tapa.
   Presión atmosférica: atmósfera estándar. Ebullición del agua: ecuación de Antoine.
   Mezcla 50 % con etilenglicol: ley de Raoult (fracción molar de agua ≈ 0,76; el glicol casi no se evapora). */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Seg, useAnimClock, plotPath, clamp, fmt, springPath } from "../ui/anim-kit";

/** Presión atmosférica [hPa] a una altura [m] (atmósfera estándar). */
function patm(h: number) {
  return 1013.25 * Math.pow(1 - 2.25577e-5 * h, 5.25588);
}
/** Temperatura de ebullición del agua [°C] a una presión absoluta [bar]. */
function boilWater(pBar: number) {
  const mm = pBar * 750.06;
  const low = 1730.63 / (8.07131 - Math.log10(mm)) - 233.426;
  if (low <= 100) return low;
  return 1810.94 / (8.14019 - Math.log10(mm)) - 244.485;
}
const X_WATER = 0.76;
const boil = (pBar: number, mix: boolean) => boilWater(mix ? pBar / X_WATER : pBar);

const PLACES = [
  { h: 750, name: "Mendoza", row: 0 },
  { h: 1350, name: "Potrerillos", row: 1 },
  { h: 1900, name: "Uspallata", row: 0 },
  { h: 3150, name: "Las Cuevas", row: 1 },
];
const CAPS = [0, 1.0, 1.4];

function tempColor(T: number) {
  const stops: [number, string][] = [[20, "var(--c-air)"], [60, "var(--c-coolant)"], [90, "var(--c-flame)"], [115, "var(--c-hot)"]];
  if (T <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    if (T <= t1) {
      const [t0, c0] = stops[i - 1];
      return `color-mix(in srgb, ${c1} ${Math.round(((T - t0) / (t1 - t0)) * 100)}%, ${c0})`;
    }
  }
  return stops[stops.length - 1][1];
}

export function PuntoEbullicion() {
  const clock = useAnimClock({ speed: 1 });
  const [h, setH] = useState(750);
  const [cap, setCap] = useState(1.0);
  const [mix, setMix] = useState(true);
  const [tMot, setTMot] = useState(102);
  const seeds = useRef(Array.from({ length: 18 }, (_, i) => ({ x: (i * 37) % 100 / 100, sp: 0.6 + ((i * 53) % 40) / 100, ph: ((i * 71) % 100) / 100 })));

  const pa = patm(h); // hPa
  const pAbs = pa / 1000 + cap; // bar
  const tb = boil(pAbs, mix);
  const margin = tb - tMot;
  const boiling = margin <= 0;
  const nearBoil = !boiling && margin < 4;

  // gráfico
  const GX = 60, GY = 46, GW = 408, GH = 272;
  const H0 = 0, H1 = 4000, T0 = 80, T1 = 140;
  const mx = (hh: number) => GX + ((hh - H0) / (H1 - H0)) * GW;
  const my = (t: number) => GY + GH - ((clamp(t, T0, T1) - T0) / (T1 - T0)) * GH;
  const curves = CAPS.map((c) => ({ c, d: plotPath((hh) => boil(patm(hh) / 1000 + c, mix), H0, H1, 80, mx, my) }));

  // tanque de la derecha
  const TX = 560, TW = 130, TY = 168, TH = 150;
  const lvl = TY + TH * 0.38;
  const t = clock.t;
  const intensity = boiling ? 1 : nearBoil ? 0.35 * (1 - margin / 4) : 0;
  const capLift = boiling ? 5 + 2 * Math.sin(t * 9) : 0;

  return (
    <AnimFrame
      title="Punto de ebullición: altura, tapa y refrigerante"
      clock={clock}
      controls={
        <>
          <Slider label="Altura" value={h} min={0} max={4000} step={50} unit="m" onChange={setH} format={(v) => fmt(v, 0)} />
          <Seg value={cap} onChange={setCap} ariaLabel="Tapa" options={[{ value: 0, label: "Tapa vencida (0 bar)" }, { value: 1.0, label: "1,0 bar" }, { value: 1.4, label: "1,4 bar" }]} />
          <Seg value={mix ? 1 : 0} onChange={(v) => setMix(v === 1)} ariaLabel="Líquido" options={[{ value: 0, label: "Agua sola" }, { value: 1, label: "Refrigerante 50 %" }]} />
          <Slider label="Temp. del motor" value={tMot} min={85} max={125} step={1} unit="°C" onChange={setTMot} />
        </>
      }
      readouts={
        <>
          <Readout label="Presión atmosf." value={fmt(pa, 0)} unit="hPa" />
          <Readout label="Presión absoluta" value={fmt(pAbs, 2)} unit="bar" />
          <Readout label="Hierve a" value={fmt(tb, 1)} unit="°C" tone="accent" />
          <Readout label="Margen" value={(margin > 0 ? "+" : "") + fmt(margin, 0)} unit="°C" tone={boiling ? "bad" : margin < 8 ? "warn" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Tapa elegida" },
        { color: "var(--border-strong)", label: "Las otras tapas" },
        { color: "var(--warn-soft)", label: "Temperatura normal de trabajo (90–105 °C)" },
      ]}
      caption={
        <>
          <p>
            El agua hierve cuando la presión de su vapor iguala a la presión que tiene encima. Arriba de la cordillera hay menos aire
            encima, así que hierve antes: más o menos <b>1 °C menos cada 300 m</b>. La tapa del radiador (o del depósito) es una
            válvula con resorte que deja subir la presión del sistema hasta su valor (1,0–1,5 bar <i>por encima</i> de la atmosférica);
            esa presión extra le sube el punto de ebullición unos 20–25 °C. El glicol del refrigerante suma unos 7–8 °C más.
          </p>
          <p>
            Probá esto: <b>Las Cuevas (3.150 m), tapa vencida, 50 %</b>. Hierve a unos 96 °C, justo donde trabaja el motor. Por eso una
            tapa con el resorte cansado (que en el llano “anda bien”) te puede dejar tirado subiendo al Cristo Redentor con calor.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 370" role="img" aria-label="Gráfico de punto de ebullición según altura y tapa">
        {/* marco del gráfico */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX} y={GY - 16} className="svg-title" style={{ fontSize: 13 }}>Temperatura de ebullición vs altura</text>
        <rect x={GX} y={my(105)} width={GW} height={my(90) - my(105)} fill="var(--warn-soft)" />
        <text x={GX + 6} y={my(90) - 5} className="svg-small" style={{ fill: "var(--warn)" }}>el motor trabaja acá</text>
        {[80, 90, 100, 110, 120, 130, 140].map((tt) => (
          <g key={tt}>
            <line x1={GX} x2={GX + GW} y1={my(tt)} y2={my(tt)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={GX - 6} y={my(tt) + 4} textAnchor="end" className="svg-small">{tt}</text>
          </g>
        ))}
        <text x={GX - 6} y={GY - 4} textAnchor="end" className="svg-small">°C</text>
        {[0, 1000, 2000, 3000, 4000].map((hh) => (
          <g key={hh}>
            <line x1={mx(hh)} x2={mx(hh)} y1={GY + GH} y2={GY + GH + 5} stroke="var(--muted)" />
            <text x={mx(hh)} y={GY + GH + 18} textAnchor="middle" className="svg-small">{fmt(hh, 0)}</text>
          </g>
        ))}
        <text x={GX + GW} y={GY + GH + 34} textAnchor="end" className="svg-small">altura sobre el nivel del mar [m]</text>

        {PLACES.map((p) => (
          <g key={p.name}>
            <line x1={mx(p.h)} x2={mx(p.h)} y1={GY} y2={GY + GH} stroke="var(--teal)" strokeDasharray="3 4" opacity={0.7} />
            <text x={mx(p.h)} y={GY + GH - 8 - p.row * 12} textAnchor="middle" className="svg-small" style={{ fill: "var(--teal)", fontWeight: 600 }}>{p.name}</text>
          </g>
        ))}

        {curves.map(({ c, d }) => (
          <g key={c}>
            <path d={d} fill="none" stroke={c === cap ? "var(--accent)" : "var(--border-strong)"} strokeWidth={c === cap ? 3 : 1.8} />
            <text x={GX + GW + 5} y={my(boil(patm(H1) / 1000 + c, mix)) + 4} className="svg-small"
              style={{ fill: c === cap ? "var(--accent)" : "var(--muted)", fontWeight: 600 }}>
              {c === 0 ? "0 bar" : `${fmt(c, 1)} bar`}
            </text>
          </g>
        ))}

        <text x={GX + GW + 5} y={GY + 12} className="svg-small" style={{ fontWeight: 700 }}>tapa:</text>
        {/* temperatura del motor y altura elegida */}
        <line x1={GX} x2={GX + GW} y1={my(tMot)} y2={my(tMot)} stroke={boiling ? "var(--bad)" : "var(--text)"} strokeWidth={1.2} strokeDasharray="6 3" opacity={0.75} />
        <text x={GX + 6} y={my(tMot) - 5} className="svg-small" style={{ fill: boiling ? "var(--bad)" : "var(--text-2)", fontWeight: 600 }}>motor {tMot} °C</text>
        <line x1={mx(h)} x2={mx(h)} y1={GY} y2={GY + GH} stroke="var(--text)" strokeWidth={1.4} opacity={0.6} />
        {CAPS.map((c) => (
          <circle key={c} cx={mx(h)} cy={my(boil(patm(h) / 1000 + c, mix))} r={c === cap ? 6.5 : 3.5}
            fill={c === cap ? "var(--accent)" : "var(--border-strong)"} stroke="var(--surface)" strokeWidth={2} />
        ))}
        {(() => {
          const right = mx(h) < GX + GW - 70;
          return (
            <text x={mx(h) + (right ? 9 : -9)} y={my(tb) - 9} textAnchor={right ? "start" : "end"} className="svg-mono" style={{ fill: "var(--accent)" }}>
              {fmt(tb, 1)} °C
            </text>
          );
        })()}

        {/* ---------- depósito con tapa */}
        <text x={TX + TW / 2} y={GY - 16} textAnchor="middle" className="svg-title" style={{ fontSize: 13 }}>Adentro del depósito</text>
        {/* vapor que escapa por la tapa */}
        {boiling && [0, 1, 2, 3, 4].map((i) => {
          const k = (t * 0.6 + i / 5) % 1;
          return <circle key={i} cx={TX + TW / 2 + Math.sin(i * 1.9 + t * 1.5) * 10} cy={TY - 62 - k * 50} r={5 + k * 10} fill="var(--muted)" opacity={0.45 * (1 - k)} />;
        })}
        {/* cuello y tapa */}
        <rect x={TX + TW / 2 - 18} y={TY - 30} width={36} height={32} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <rect x={TX + TW / 2 - 28} y={TY - 62 - capLift} width={56} height={16} rx={4} fill={cap === 0 ? "var(--bad)" : "var(--c-metal-dark)"} />
        <path d={springPath(TX + TW / 2, TY - 46 - capLift, TY - 26, 4, 9)} fill="none" stroke={cap === 0 ? "var(--bad)" : "var(--c-metal-light)"} strokeWidth={2} />
        <rect x={TX + TW / 2 - 14} y={TY - 27} width={28} height={5} rx={2} fill="var(--c-rubber)" />
        <text x={TX + TW / 2 - 34} y={TY - 50} textAnchor="end" className="svg-small" style={{ fill: cap === 0 ? "var(--bad)" : "var(--text-2)", fontWeight: 600 }}>
          {cap === 0 ? "resorte vencido" : `tapa ${fmt(cap, 1)} bar`}
        </text>
        {/* cuerpo */}
        <rect x={TX} y={TY} width={TW} height={TH} rx={14} fill="var(--surface)" stroke="var(--c-metal-2)" strokeWidth={2} />
        <rect x={TX + 3} y={lvl} width={TW - 6} height={TY + TH - lvl - 3} rx={11} style={{ fill: tempColor(tMot) }} opacity={0.6} />
        <line x1={TX + 3} x2={TX + TW - 3} y1={lvl} y2={lvl} style={{ stroke: tempColor(tMot) }} strokeWidth={2} />
        {/* burbujas */}
        {intensity > 0 && seeds.current.slice(0, Math.max(3, Math.round(18 * intensity))).map((b, i) => {
          const k = (t * b.sp * (0.6 + intensity) + b.ph) % 1;
          const y = TY + TH - 8 - k * (TY + TH - 8 - lvl);
          return <circle key={i} cx={TX + 12 + b.x * (TW - 24)} cy={y} r={2 + 3 * k * intensity + (boiling ? 1.5 : 0)} fill="var(--surface)" stroke="var(--text-2)" strokeWidth={0.8} opacity={0.85} />;
        })}
        <text x={TX + TW / 2} y={TY + 22} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>
          {fmt(pAbs, 2)} bar absolutos
        </text>
        <text x={TX + TW / 2} y={TY + TH + 22} textAnchor="middle" className="svg-label" style={{ fill: boiling ? "var(--bad)" : nearBoil ? "var(--warn)" : "var(--ok)" }}>
          {boiling ? "¡HIERVE!" : nearBoil ? "hierve en los puntos calientes" : "no hierve"}
        </text>
        <text x={TX + TW / 2} y={TY + TH + 38} textAnchor="middle" className="svg-small">
          motor {tMot} °C · hierve a {fmt(tb, 0)} °C
        </text>
      </svg>
    </AnimFrame>
  );
}
