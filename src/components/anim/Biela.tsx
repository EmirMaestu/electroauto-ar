/* Mecanismo biela-cigüeñal con cinemática real.
   Muestra posición, velocidad del pistón y el brazo de palanca efectivo (de dónde sale el torque). */
import { useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, useAnimClock, plotPath, TAU, deg, fmt, Arrow } from "../ui/anim-kit";

/** Cinemática exacta del mecanismo. θ en rad desde PMS, r y l en mm. */
export function crankKinematics(theta: number, r: number, l: number) {
  const s = Math.sin(theta), c = Math.cos(theta);
  const root = Math.sqrt(l * l - r * r * s * s);
  const x = r * (1 - c) + (l - root); // desplazamiento desde PMS [mm]
  const beta = Math.asin((r / l) * s); // ángulo de la biela
  const vFactor = s * (1 + (r * c) / root); // v = r·ω·vFactor
  const arm = (r * Math.sin(theta + beta)) / Math.cos(beta); // brazo efectivo [mm]
  return { x, beta, vFactor, arm };
}

export function Biela({ title = "Biela y cigüeñal: de empuje a giro" }: { title?: string }) {
  const clock = useAnimClock({ speed: 0.5 });
  const [rpm, setRpm] = useState(3000);
  const [lever, setLever] = useState(true);
  const [rodLen, setRodLen] = useState(135);
  const r = 40; // radio de manivela [mm] → carrera 80 mm
  const theta = (clock.t * TAU * 0.5) % TAU;
  const k = crankKinematics(theta, r, rodLen);
  const omega = (rpm / 60) * TAU;
  const v = (r / 1000) * omega * k.vFactor; // m/s

  // Escala y ubicación (unidades SVG = mm * S)
  const S = 1.45, CX = 170, CY = 330;
  const pin = { x: CX + r * S * Math.sin(theta), y: CY - r * S * Math.cos(theta) };
  const pistonPinY = CY - (r + rodLen) * S + k.x * S; // en PMS: CY-(r+l)
  const bore = 92, pistonH = 58;
  const cylTop = CY - (r + rodLen) * S - pistonH * 0.55 - 26;
  const firing = theta < Math.PI; // carrera hacia abajo (para mostrar fuerza)

  // Gráfico
  const GX = 360, GY = 70, GW = 330, GH = 240;
  const maxX = 2 * r;
  const mapX = (a: number) => GX + (a / TAU) * GW;
  const mapPos = (x: number) => GY + 10 + (x / maxX) * (GH * 0.42);
  const vMax = 1.35;
  const mapV = (f: number) => GY + GH * 0.74 - (f / vMax) * (GH * 0.22);
  const posPath = plotPath((a) => crankKinematics(a, r, rodLen).x, 0, TAU, 120, mapX, mapPos);
  const velPath = plotPath((a) => crankKinematics(a, r, rodLen).vFactor, 0, TAU, 120, mapX, mapV);

  // Línea perpendicular del brazo de palanca (desde el centro a la línea de la biela)
  const dx = pin.x - CX, dy = pin.y - pistonPinY;
  const len = Math.hypot(CX - pin.x, pistonPinY - pin.y);
  const ux = (CX - pin.x) / len, uy = (pistonPinY - pin.y) / len;
  const tproj = (CX - pin.x) * ux + (CY - pin.y) * uy;
  const foot = { x: pin.x + ux * tproj, y: pin.y + uy * tproj };
  void dx; void dy;

  return (
    <AnimFrame
      title={title}
      clock={clock}
      controls={
        <>
          <Slider label="RPM" value={rpm} min={800} max={7000} step={100} onChange={setRpm} />
          <Slider label="Largo de biela" value={rodLen} min={110} max={170} step={5} onChange={setRodLen} unit="mm" />
          <Toggle label="Brazo de palanca" checked={lever} onChange={setLever} />
        </>
      }
      readouts={
        <>
          <Readout label="Ángulo de cigüeñal" value={fmt(deg(theta), 0)} unit="°" />
          <Readout label="Pistón desde PMS" value={fmt(k.x, 1)} unit="mm" />
          <Readout label="Velocidad del pistón" value={fmt(Math.abs(v), 1)} unit="m/s" tone="accent" />
          <Readout label="Brazo de palanca" value={fmt(Math.abs(k.arm), 1)} unit="mm" tone={Math.abs(k.arm) > r * 0.85 ? "ok" : undefined} />
        </>
      }
      legend={[
        { color: "var(--c-metal)", label: "Pistón" },
        { color: "var(--c-metal-2)", label: "Biela" },
        { color: "var(--c-metal-dark)", label: "Cigüeñal y contrapeso" },
        { color: "var(--accent)", label: "Muñón de biela" },
        { color: "var(--ok)", label: "Brazo de palanca efectivo" },
      ]}
      caption={
        <>
          <p>
            La biela empuja el muñón del cigüeñal, que está <b>desplazado {r} mm</b> del eje: ese desplazamiento es la palanca.
            Fijate que el <b>brazo efectivo</b> (verde) cambia todo el tiempo: es <b>cero en el PMS y en el PMI</b> (la biela empuja
            derecho contra el eje y no genera giro) y es máximo un poco antes de los 90°. Por eso la chispa se da para que la presión
            máxima llegue unos grados <i>después</i> del PMS, cuando ya hay palanca.
          </p>
          <p>
            El pistón tampoco va a velocidad constante: frena hasta cero en cada punto muerto y acelera en el medio. A {rpm} rpm llega a
            unos <b>{fmt((r / 1000) * omega * 1.03, 1)} m/s</b> de pico. Con biela más corta, la curva se deforma más (más aceleración, más vibración).
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 400" role="img" aria-label="Mecanismo biela-cigüeñal">
        {/* Cilindro */}
        <rect x={CX - bore / 2 - 16} y={cylTop} width={16} height={CY - 70 - cylTop} fill="var(--c-block)" />
        <rect x={CX + bore / 2} y={cylTop} width={16} height={CY - 70 - cylTop} fill="var(--c-block)" />
        <rect x={CX - bore / 2 - 22} y={cylTop - 22} width={bore + 44} height={24} rx={5} fill="var(--c-metal-dark)" />
        <text x={CX} y={cylTop - 6} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-metal-light)" }}>tapa de cilindros</text>
        {/* gases */}
        <rect x={CX - bore / 2} y={cylTop + 2} width={bore} height={Math.max(0, pistonPinY - pistonH * 0.55 - cylTop - 2)}
          fill={firing ? "var(--c-hot)" : "var(--c-air)"} opacity={firing ? 0.25 + 0.35 * (1 - theta / Math.PI) : 0.18} />
        {/* Pistón */}
        <g>
          <rect x={CX - bore / 2 + 2} y={pistonPinY - pistonH * 0.55} width={bore - 4} height={pistonH} rx={6} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
          {[8, 15, 22].map((o) => (
            <line key={o} x1={CX - bore / 2 + 2} y1={pistonPinY - pistonH * 0.55 + o} x2={CX + bore / 2 - 2} y2={pistonPinY - pistonH * 0.55 + o} stroke="var(--c-metal-dark)" strokeWidth={o === 22 ? 3 : 2} />
          ))}
        </g>
        {firing && (
          <Arrow x1={CX} y1={pistonPinY - pistonH * 0.55 - 34} x2={CX} y2={pistonPinY - pistonH * 0.55 - 4} color="var(--c-hot)" width={3} head={10} />
        )}
        {/* Biela */}
        <line x1={CX} y1={pistonPinY} x2={pin.x} y2={pin.y} stroke="var(--c-metal-2)" strokeWidth={16} strokeLinecap="round" />
        <line x1={CX} y1={pistonPinY} x2={pin.x} y2={pin.y} stroke="var(--c-metal-light)" strokeWidth={3} strokeLinecap="round" opacity={0.6} />
        <circle cx={CX} cy={pistonPinY} r={7} fill="var(--c-metal-dark)" />
        {/* Cigüeñal: contrapeso + manivela */}
        {(() => {
          const cr = r * S + 20, w = 1.1;
          const p1 = { x: CX - cr * Math.sin(theta - w), y: CY + cr * Math.cos(theta - w) };
          const p2 = { x: CX - cr * Math.sin(theta + w), y: CY + cr * Math.cos(theta + w) };
          return <path d={`M${CX},${CY} L${p1.x},${p1.y} A${cr},${cr} 0 0 1 ${p2.x},${p2.y} Z`} fill="var(--c-metal-dark)" />;
        })()}
        <line x1={CX} y1={CY} x2={pin.x} y2={pin.y} stroke="var(--c-metal-dark)" strokeWidth={24} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={r * S} fill="none" stroke="var(--border-strong)" strokeDasharray="3 5" />
        <circle cx={CX} cy={CY} r={13} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={pin.x} cy={pin.y} r={10} fill="var(--accent)" />
        {/* Brazo de palanca */}
        {lever && Math.abs(k.arm) > 0.5 && (
          <g>
            <line x1={pin.x} y1={pin.y} x2={foot.x} y2={foot.y} stroke="var(--ok)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6} />
            <line x1={CX} y1={CY} x2={foot.x} y2={foot.y} stroke="var(--ok)" strokeWidth={3.5} strokeLinecap="round" />
          </g>
        )}
        <text x={CX} y={CY + 78} textAnchor="middle" className="svg-small">eje del cigüeñal</text>
        {/* PMS / PMI */}
        <line x1={CX + bore / 2 + 22} y1={CY - (r + rodLen) * S} x2={CX + bore / 2 + 40} y2={CY - (r + rodLen) * S} stroke="var(--muted)" />
        <text x={CX + bore / 2 + 44} y={CY - (r + rodLen) * S + 4} className="svg-small">PMS</text>
        <line x1={CX + bore / 2 + 22} y1={CY - (rodLen - r) * S} x2={CX + bore / 2 + 40} y2={CY - (rodLen - r) * S} stroke="var(--muted)" />
        <text x={CX + bore / 2 + 44} y={CY - (rodLen - r) * S + 4} className="svg-small">PMI</text>

        {/* Gráfico */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX + 10} y={GY - 10} className="svg-title" style={{ fontSize: 13 }}>Una vuelta de cigüeñal</text>
        <text x={GX + 8} y={GY + 22} className="svg-small" style={{ fill: "var(--primary)" }}>posición del pistón (baja →)</text>
        <path d={posPath} fill="none" stroke="var(--primary)" strokeWidth={2.5} />
        <line x1={GX} y1={mapV(0)} x2={GX + GW} y2={mapV(0)} stroke="var(--border-strong)" strokeDasharray="2 4" />
        <text x={GX + 8} y={GY + GH * 0.56} className="svg-small" style={{ fill: "var(--accent)" }}>velocidad del pistón</text>
        <path d={velPath} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
        {[0, 90, 180, 270, 360].map((d) => (
          <g key={d}>
            <line x1={mapX((d / 360) * TAU)} y1={GY + GH} x2={mapX((d / 360) * TAU)} y2={GY + GH + 5} stroke="var(--muted)" />
            <text x={mapX((d / 360) * TAU)} y={GY + GH + 18} textAnchor="middle" className="svg-small">{d}°</text>
          </g>
        ))}
        <text x={mapX(0) + 4} y={GY + GH + 32} className="svg-small">PMS</text>
        <text x={mapX(Math.PI)} y={GY + GH + 32} textAnchor="middle" className="svg-small">PMI</text>
        <line x1={mapX(theta)} y1={GY} x2={mapX(theta)} y2={GY + GH} stroke="var(--text)" strokeWidth={1.2} opacity={0.5} />
        <circle cx={mapX(theta)} cy={mapPos(k.x)} r={5} fill="var(--primary)" />
        <circle cx={mapX(theta)} cy={mapV(k.vFactor)} r={5} fill="var(--accent)" />
      </svg>
    </AnimFrame>
  );
}
