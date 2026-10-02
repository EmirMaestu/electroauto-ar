/* Sensor de temperatura (ECT) como divisor de tensión: 5 V de la ECU → resistencia de pull-up → pin de señal → NTC → masa.
   El NTC sigue la ecuación Beta; la ECU mide la tensión del pin y la convierte en °C con la misma curva. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, fmt, clamp, plotPath } from "../ui/anim-kit";
import { useNarrowScreen } from "./RuedaFonica";

const R20 = 2500, BETA = 3560, RPU = 2490, VREF = 5;
const K = (c: number) => c + 273.15;
/** Resistencia del NTC (Ω) a una temperatura (°C) */
export function ntcOhms(c: number) { return R20 * Math.exp(BETA * (1 / K(c) - 1 / K(20))); }
/** Temperatura (°C) a partir de la resistencia del NTC */
export function ntcTemp(r: number) { return 1 / (Math.log(r / R20) / BETA + 1 / K(20)) - 273.15; }

type Falla = "ok" | "abierto" | "corto" | "sulfatado";

export function DivisorNTC() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const [temp, setTemp] = useState(20);
  const [falla, setFalla] = useState<Falla>("ok");

  const rNtc = ntcOhms(temp);
  const rSerie = falla === "sulfatado" ? 1500 : 0;
  let vPin: number;
  if (falla === "abierto") vPin = VREF * 0.995;
  else if (falla === "corto") vPin = 0.0;
  else vPin = (VREF * (rNtc + rSerie)) / (rNtc + rSerie + RPU);
  const iMa = falla === "abierto" ? 0 : ((VREF - vPin) / RPU) * 1000;
  // Lo que calcula la ECU
  const rLeida = vPin >= 4.95 ? Infinity : (RPU * vPin) / (VREF - vPin);
  let tEcu = rLeida === Infinity ? -40 : rLeida <= 1 ? 150 : ntcTemp(rLeida);
  tEcu = clamp(tEcu, -40, 150);
  const fueraDeRango = vPin > 4.9 || vPin < 0.1;
  const codigo = vPin > 4.9 ? "P0118 · circuito alto" : vPin < 0.1 ? "P0117 · circuito bajo" : falla === "sulfatado" ? "sin código (dentro de rango)" : "—";
  const scanner = fueraDeRango ? (vPin > 4.9 ? "−40" : "140+") : fmt(tEcu, 0);

  // Gráfico V vs T
  const GX = 470, GY = 40, GW = 225, GH = 190;
  const mapT = (c: number) => GX + ((c + 40) / 170) * GW;
  const mapV = (vv: number) => GY + GH - (vv / 5) * GH;
  const curve = plotPath((c) => (VREF * ntcOhms(c)) / (ntcOhms(c) + RPU), -40, 130, 85, mapT, mapV);
  const curveSul = plotPath((c) => (VREF * (ntcOhms(c) + 1500)) / (ntcOhms(c) + 1500 + RPU), -40, 130, 85, mapT, mapV);

  // corriente animada (puntitos) por el lazo: 5 V → pull-up → pin → cable → NTC → masa → ECU
  const loop = [[150, 62], [150, 150], [380, 150], [380, 200], [150, 200], [150, 245]];
  const segLen = loop.map((p, i) => (i === 0 ? 0 : Math.hypot(p[0] - loop[i - 1][0], p[1] - loop[i - 1][1])));
  const total = segLen.reduce((a, b) => a + b, 0);
  const pointAt = (d: number) => {
    let acc = 0;
    for (let i = 1; i < loop.length; i++) {
      if (acc + segLen[i] >= d) {
        const f = (d - acc) / segLen[i];
        return [loop[i - 1][0] + (loop[i][0] - loop[i - 1][0]) * f, loop[i - 1][1] + (loop[i][1] - loop[i - 1][1]) * f];
      }
      acc += segLen[i];
    }
    return loop[loop.length - 1];
  };
  const speed = iMa * 18;
  const coolantHot = clamp((temp + 30) / 150, 0, 1);

  return (
    <AnimFrame
      title="Sensor de temperatura: un divisor de tensión"
      clock={clock}
      controls={
        <>
          <Slider label="Temperatura real" value={temp} min={-30} max={120} step={1} onChange={setTemp} unit="°C" />
          <Seg value={falla} onChange={setFalla} ariaLabel="Falla" options={[
            { value: "ok", label: "Sano" }, { value: "abierto", label: "Cable cortado" },
            { value: "corto", label: "Corto a masa" }, { value: "sulfatado", label: "Ficha sulfatada" },
          ]} />
        </>
      }
      readouts={
        <>
          <Readout label="R del NTC" value={rNtc >= 10000 ? fmt(rNtc / 1000, 1) : fmt(rNtc, 0)} unit={rNtc >= 10000 ? "kΩ" : "Ω"} />
          <Readout label="Tensión en el pin" value={fmt(vPin, 2)} unit="V" tone={fueraDeRango ? "bad" : undefined} />
          <Readout label="Corriente" value={fmt(iMa, 2)} unit="mA" />
          <Readout label="Scanner: ECT" value={scanner} unit="°C" tone={fueraDeRango ? "bad" : Math.abs(tEcu - temp) > 4 ? "warn" : "ok"} />
          <Readout label="Código" value={<span style={{ fontSize: ".8rem" }}>{codigo}</span>} tone={fueraDeRango ? "bad" : falla === "sulfatado" ? "warn" : undefined} />
        </>
      }
      legend={[
        { color: "var(--bad)", label: "5 V de referencia" },
        { color: "var(--c-signal)", label: "Señal (lo que mide la ECU)" },
        { color: "var(--c-metal-dark)", label: "Masa de sensores" },
        { color: "var(--c-elec)", label: "Corriente (puntitos)" },
      ]}
      caption={
        <>
          <p>
            La ECU no mide temperatura: mide <b>tensión</b>. Pone 5 V a través de una resistencia fija interna (pull-up, unos 2,5 kΩ)
            y el NTC hace de “otra mitad” del divisor. Motor frío: NTC alto, el pin queda cerca de 5 V. Motor caliente: NTC bajo, el
            pin cae a menos de 1 V. Con la curva del sensor grabada, la ECU traduce volts a grados.
          </p>
          <p>
            Cortá el cable: el pin sube a 5 V y el scanner muestra <b>−40 °C</b> (P0118). Ponelo a masa: 0 V y <b>140 °C o más</b> (P0117).
            La trampa es la <b>ficha sulfatada</b>: suma resistencia, la tensión sigue “en rango”, no hay código, pero la ECU cree que
            el motor está más frío: enriquece, consume más y el electroventilador entra tarde.
          </p>
        </>
      }
    >
      <svg viewBox={narrow ? "0 24 455 646" : "0 0 720 280"} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Circuito del sensor de temperatura">
        {/* ECU */}
        <rect x={20} y={30} width={190} height={240} rx={12} fill="var(--surface)" stroke="var(--c-elec)" strokeWidth={2} />
        <text x={36} y={52} className="svg-title" style={{ fill: "var(--c-elec)" }}>ECU</text>
        <rect x={40} y={62} width={64} height={26} rx={5} fill="var(--surface-2)" stroke="var(--border)" />
        <text x={72} y={79} textAnchor="middle" className="svg-mono" style={{ fontSize: 11 }}>5 V reg.</text>
        <line x1={104} y1={75} x2={150} y2={75} stroke="var(--bad)" strokeWidth={2.5} />
        <line x1={150} y1={60} x2={150} y2={96} stroke="var(--bad)" strokeWidth={2.5} />
        {/* resistencia pull-up */}
        <rect x={141} y={96} width={18} height={40} rx={3} fill="var(--surface-2)" stroke="var(--text-2)" strokeWidth={1.5} />
        <text x={136} y={112} textAnchor="end" className="svg-small">pull-up</text>
        <text x={136} y={125} textAnchor="end" className="svg-small">2,49 kΩ</text>
        <line x1={150} y1={136} x2={150} y2={150} stroke="var(--c-signal)" strokeWidth={2.5} />
        {/* ADC */}
        <line x1={150} y1={150} x2={112} y2={150} stroke="var(--c-signal)" strokeWidth={2} />
        <rect x={40} y={136} width={72} height={30} rx={5} fill="var(--violet-soft)" stroke="var(--violet)" />
        <text x={76} y={155} textAnchor="middle" className="svg-mono" style={{ fontSize: 11, fill: "var(--violet)" }}>ADC</text>
        <text x={76} y={182} textAnchor="middle" className="svg-mono" style={{ fontSize: 13 }}>{fmt(vPin, 2)} V</text>
        {/* masa de sensores */}
        <line x1={150} y1={200} x2={150} y2={245} stroke="var(--c-metal-dark)" strokeWidth={2.5} />
        <line x1={136} y1={245} x2={164} y2={245} stroke="var(--c-metal-dark)" strokeWidth={2.5} />
        <line x1={141} y1={251} x2={159} y2={251} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <line x1={146} y1={257} x2={154} y2={257} stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        <text x={40} y={232} className="svg-small">masa de sensores</text>
        <text x={40} y={245} className="svg-small">(dentro de la ECU)</text>
        {/* pines */}
        <circle cx={210} cy={150} r={5} fill="var(--surface)" stroke="var(--text-2)" />
        <circle cx={210} cy={200} r={5} fill="var(--surface)" stroke="var(--text-2)" />
        <line x1={150} y1={200} x2={205} y2={200} stroke="var(--c-metal-dark)" strokeWidth={2.5} />
        <line x1={150} y1={150} x2={205} y2={150} stroke="var(--c-signal)" strokeWidth={2.5} />
        {/* cables al sensor */}
        <line x1={215} y1={150} x2={falla === "abierto" ? 262 : 300} y2={150} stroke="var(--c-signal)" strokeWidth={3} />
        {falla === "abierto" && (
          <>
            <line x1={276} y1={150} x2={300} y2={150} stroke="var(--c-signal)" strokeWidth={3} />
            <text x={269} y={140} textAnchor="middle" className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>✂</text>
          </>
        )}
        <line x1={215} y1={200} x2={300} y2={200} stroke="var(--c-metal-dark)" strokeWidth={3} />
        {falla === "corto" && (
          <>
            <line x1={250} y1={150} x2={250} y2={176} stroke="var(--bad)" strokeWidth={3} />
            <line x1={240} y1={176} x2={260} y2={176} stroke="var(--bad)" strokeWidth={3} />
            <text x={256} y={170} className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>roce a masa</text>
          </>
        )}
        {/* ficha */}
        <rect x={296} y={140} width={18} height={70} rx={3} fill={falla === "sulfatado" ? "var(--c-coolant)" : "var(--c-rubber)"} opacity={falla === "sulfatado" ? 0.85 : 1} />
        {falla === "sulfatado" && <text x={305} y={226} textAnchor="middle" className="svg-small" style={{ fill: "var(--warn)", fontWeight: 700 }}>+1,5 kΩ</text>}
        <line x1={314} y1={150} x2={330} y2={150} stroke="var(--c-signal)" strokeWidth={3} />
        <line x1={314} y1={200} x2={330} y2={200} stroke="var(--c-metal-dark)" strokeWidth={3} />
        {/* sensor en la camisa de agua */}
        <rect x={340} y={118} width={100} height={150} rx={10} fill="var(--c-coolant)" opacity={0.12 + coolantHot * 0.3} />
        <text x={390} y={262} textAnchor="middle" className="svg-small">refrigerante a {fmt(temp, 0)} °C</text>
        <rect x={318} y={140} width={34} height={70} rx={5} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <rect x={352} y={158} width={60} height={34} rx={14} fill="var(--c-oil)" opacity={0.85} />
        <rect x={360} y={166} width={40} height={18} rx={4} fill="var(--surface)" stroke="var(--text-2)" />
        <line x1={364} y1={182} x2={396} y2={168} stroke="var(--text-2)" strokeWidth={1.4} />
        <text x={380} y={152} textAnchor="middle" className="svg-small">NTC</text>
        <text x={380} y={206} textAnchor="middle" className="svg-mono" style={{ fontSize: 11 }}>
          {rNtc >= 10000 ? `${fmt(rNtc / 1000, 1)} kΩ` : `${fmt(rNtc, 0)} Ω`}
        </text>
        {/* puntitos de corriente */}
        {falla !== "abierto" && Array.from({ length: falla === "corto" ? 6 : 14 }, (_, k, ) => {
          // en corto la corriente se va a masa por el roce y no llega al sensor
          const len = falla === "corto" ? 88 + 100 : total;
          const n = falla === "corto" ? 6 : 14;
          const d = ((k / n) * len + clock.t * speed) % len;
          const [x, y] = pointAt(d);
          return <circle key={k} cx={x} cy={y} r={3} fill="var(--c-elec)" />;
        })}

        {/* gráfico (en celular va abajo y más grande) */}
        <g transform={narrow ? "translate(-668 266) scale(1.6)" : undefined}>
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX} y={GY - 12} className="svg-title" style={{ fontSize: 13 }}>Tensión en el pin vs temperatura</text>
        {[0, 1, 2, 3, 4, 5].map((vv) => (
          <g key={vv}>
            <line x1={GX} y1={mapV(vv)} x2={GX + GW} y2={mapV(vv)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={GX - 5} y={mapV(vv) + 4} textAnchor="end" className="svg-small">{vv} V</text>
          </g>
        ))}
        {[-40, 0, 40, 80, 120].map((c) => (
          <text key={c} x={mapT(c)} y={GY + GH + 15} textAnchor="middle" className="svg-small">{c}°</text>
        ))}
        {falla === "sulfatado" && <path d={curveSul} fill="none" stroke="var(--warn)" strokeWidth={2} strokeDasharray="5 4" />}
        <path d={curve} fill="none" stroke="var(--c-signal)" strokeWidth={2.5} />
        {/* zonas de falla */}
        <rect x={GX} y={GY} width={GW} height={mapV(4.9) - GY} fill="var(--bad)" opacity={0.12} />
        <rect x={GX} y={mapV(0.1)} width={GW} height={GY + GH - mapV(0.1)} fill="var(--bad)" opacity={0.12} />
        <text x={GX + GW - 4} y={GY + 11} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>&gt; 4,9 V: circuito abierto</text>
        <text x={GX + GW - 4} y={GY + GH - 4} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>&lt; 0,1 V: corto</text>
        {/* punto actual: temperatura real vs lo que lee la ECU */}
        <line x1={mapT(temp)} y1={GY} x2={mapT(temp)} y2={GY + GH} stroke="var(--text)" opacity={0.35} />
        <circle cx={mapT(temp)} cy={mapV(vPin)} r={6} fill={fueraDeRango ? "var(--bad)" : falla === "sulfatado" ? "var(--warn)" : "var(--c-signal)"} stroke="var(--surface)" strokeWidth={2} />
        {falla === "sulfatado" && (
          <>
            <circle cx={mapT(tEcu)} cy={mapV(vPin)} r={5} fill="none" stroke="var(--c-signal)" strokeWidth={2} />
            <line x1={mapT(temp)} y1={mapV(vPin)} x2={mapT(tEcu) + 6} y2={mapV(vPin)} stroke="var(--warn)" strokeDasharray="3 3" />
            <text x={mapT(tEcu)} y={mapV(vPin) - 10} textAnchor="middle" className="svg-small" style={{ fill: "var(--warn)" }}>ECU cree {fmt(tEcu, 0)}°</text>
          </>
        )}
        </g>
      </svg>
    </AnimFrame>
  );
}
