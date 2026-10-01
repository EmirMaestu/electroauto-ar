/* Llave sobre un bulón de rueda: torque = fuerza × brazo efectivo.
   Largo de llave, fuerza y ángulo ajustables. Si el torque alcanza, el bulón cede (gira en sentido antihorario). */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, Arrow, plotPath, fmt, rad, smoothstep, clamp } from "../ui/anim-kit";

const G = 9.81;
/** Texto con "halo" del color de fondo para que se lea encima de cualquier dibujo. */
const HALO = { paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" } as const;

const NEEDS = [
  { value: 25, label: "Bujía 25 N·m" },
  { value: 110, label: "Bulón de rueda 110 N·m" },
  { value: 165, label: "Bulón pegado ≈165 N·m" },
];

export function Palanca() {
  const clock = useAnimClock({ speed: 1 });
  const [L, setL] = useState(0.25); // largo de la llave [m]
  const [F, setF] = useState(300); // fuerza [N]
  const [ang, setAng] = useState(90); // ángulo entre la llave y la fuerza [°]
  const [need, setNeed] = useState(110); // torque que pide el bulón [N·m]

  const sinA = Math.sin(rad(ang));
  const d = L * sinA; // brazo efectivo [m]
  const T = F * d; // torque [N·m]
  const ok = T >= need;
  const Fmin = need / Math.max(d, 1e-6);
  const Lmin = need / (F * sinA);

  // Ciclo de 3,2 s: empuja, y si alcanza, el bulón cede y la llave baja ~18°
  const ph = clock.t % 3.2;
  const push = smoothstep(0.1, 0.5, ph) * (1 - smoothstep(2.7, 3.1, ph));
  const phi = ok
    ? rad(18) * smoothstep(0.6, 1.6, ph) * (1 - smoothstep(2.6, 3.1, ph))
    : rad(0.7) * Math.sin(ph * 45) * smoothstep(0.5, 0.8, ph) * (1 - smoothstep(1.9, 2.2, ph));

  // Escena
  const W = { x: 605, y: 185 }; // centro de la rueda
  const B = { x: 565, y: 185 }; // bulón donde está la llave
  const K = 500; // px por metro
  const u = { x: -Math.cos(phi), y: Math.sin(phi) }; // dirección del mango (del bulón hacia la punta)
  const P = { x: B.x + u.x * L * K, y: B.y + u.y * L * K }; // punta (donde empujás)
  const n = { x: u.y, y: -u.x }; // perpendicular "hacia abajo" respecto del mango
  // dirección de la fuerza: hacia abajo y, si no es perpendicular, inclinada hacia afuera de la llave
  const f = { x: u.x * Math.cos(rad(ang)) + n.x * sinA, y: u.y * Math.cos(rad(ang)) + n.y * sinA };
  const aLen = (28 + (F / 800) * 80) * (0.35 + 0.65 * push);
  const proj = (B.x - P.x) * f.x + (B.y - P.y) * f.y;
  const foot = { x: P.x + f.x * proj, y: P.y + f.y * proj };
  // Etiqueta del brazo: cerca del pie de la perpendicular, corrida hacia afuera de la llave
  const gx = foot.x - B.x, gy = foot.y - B.y, gl = Math.hypot(gx, gy) || 1;
  const dLab = ang >= 88
    ? { x: B.x + gx * 0.62, y: B.y + gy * 0.62 + 46 }
    : { x: B.x + gx * 0.55 - (gy / gl) * 16, y: B.y + gy * 0.55 + (gx / gl) * 16 };
  const gripLen = Math.min(70, L * K * 0.35);
  const G0 = { x: P.x - u.x * gripLen, y: P.y - u.y * gripLen };

  // Gráfico: fuerza necesaria vs largo de llave
  const CX0 = 64, CX1 = 392, CY0 = 322, CY1 = 422;
  const Fmax = 1200;
  const mapL = (l: number) => CX0 + ((l - 0.1) / 0.6) * (CX1 - CX0);
  const mapF = (v: number) => CY1 - (clamp(v, 0, Fmax) / Fmax) * (CY1 - CY0);
  const lStart = Math.max(0.1, need / (Fmax * sinA));
  const curve = plotPath((l) => need / (l * sinA), lStart, 0.7, 80, mapL, mapF);

  // Barras de torque
  const BX0 = 450, BX1 = 700, Tmax = 250;
  const mapT = (v: number) => BX0 + (clamp(v, 0, Tmax) / Tmax) * (BX1 - BX0);

  return (
    <AnimFrame
      title="Llave y bulón: el torque es fuerza por brazo"
      clock={clock}
      controls={
        <>
          <Slider label="Largo de la llave" value={L} min={0.1} max={0.7} step={0.01} onChange={setL} format={(v) => `${Math.round(v * 100)} cm`} />
          <Slider label="Fuerza" value={F} min={50} max={800} step={10} onChange={setF} format={(v) => `${v} N`} />
          <Slider label="Ángulo de empuje" value={ang} min={20} max={90} step={1} onChange={setAng} unit="°" />
          <Seg value={need} onChange={setNeed} options={NEEDS} ariaLabel="Qué querés aflojar" />
        </>
      }
      readouts={
        <>
          <Readout label="Brazo efectivo" value={fmt(d * 100, 1)} unit="cm" />
          <Readout label="Torque que hacés" value={fmt(T, 0)} unit="N·m" tone={ok ? "ok" : "bad"} />
          <Readout label="Torque que pide" value={fmt(need, 0)} unit="N·m" />
          <Readout label="Fuerza mínima" value={fmt(Fmin, 0)} unit="N" tone="accent" />
          <Readout label="Eso es como colgar" value={fmt(Fmin / G, 0)} unit="kg" />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Fuerza que hacés" },
        { color: "var(--ok)", label: "Brazo efectivo (perpendicular)" },
        { color: "var(--primary)", label: "Fuerza necesaria según el largo" },
      ]}
      caption={
        <>
          <p>
            El bulón no "siente" cuánta fuerza hacés: siente el <b>torque</b>, que es la fuerza multiplicada por la distancia
            perpendicular desde el eje del bulón hasta la línea por donde empujás (la raya verde). Con una llave de{" "}
            {Math.round(L * 100)} cm y empujando a {ang}°, necesitás al menos <b>{fmt(Fmin, 0)} N</b> (como colgarte{" "}
            {fmt(Fmin / G, 0)} kg) para aflojar {need} N·m. {ok ? "Alcanza: fijate cómo el bulón cede." : "No alcanza: el bulón no se mueve."}
          </p>
          <p>
            Probá bajar el ángulo: si empujás "en diagonal" el brazo efectivo se achica y desperdiciás fuerza. Y mirá la curva azul:
            duplicar el largo de la llave reduce a la mitad la fuerza necesaria. Con tu fuerza actual, la llave tendría que medir por lo menos{" "}
            <b>{Number.isFinite(Lmin) ? `${Math.round(Lmin * 100)} cm` : "—"}</b>.
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 450" role="img" aria-label="Llave aflojando un bulón de rueda">
        {/* Piso */}
        <line x1={20} y1={285} x2={700} y2={285} stroke="var(--border-strong)" strokeWidth={2} />
        {/* Rueda */}
        <circle cx={W.x} cy={W.y} r={99} fill="var(--c-rubber)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={W.x} cy={W.y} r={74} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" strokeWidth={2} />
        <circle cx={W.x} cy={W.y} r={57} fill="none" stroke="var(--c-metal-2)" strokeWidth={1} strokeDasharray="2 4" />
        <circle cx={W.x} cy={W.y} r={18} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {[90, 0, 270].map((a) => {
          const x = W.x + 40 * Math.cos(rad(a)), y = W.y - 40 * Math.sin(rad(a));
          return <circle key={a} cx={x} cy={y} r={9} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />;
        })}
        <text x={W.x} y={W.y + 116} textAnchor="middle" className="svg-small">rueda (vista de afuera)</text>

        {/* Línea de acción de la fuerza y brazo efectivo */}
        <line x1={P.x - f.x * (Math.max(130, -proj) + 30)} y1={P.y - f.y * (Math.max(130, -proj) + 30)} x2={P.x + f.x * 40} y2={P.y + f.y * 40}
          stroke="var(--accent)" strokeWidth={1} strokeDasharray="5 4" opacity={0.55} />
        <line x1={B.x} y1={B.y} x2={foot.x} y2={foot.y} stroke="var(--ok)" strokeWidth={4} strokeLinecap="round" />
        <circle cx={foot.x} cy={foot.y} r={3.5} fill="var(--ok)" />
        <text x={dLab.x} y={dLab.y} textAnchor="middle" className="svg-label" style={{ ...HALO, fill: "var(--ok)" }}>
          d = {fmt(d * 100, 1)} cm
        </text>

        {/* Llave */}
        <line x1={B.x} y1={B.y} x2={P.x} y2={P.y} stroke="var(--c-metal-dark)" strokeWidth={13} strokeLinecap="round" />
        <line x1={B.x} y1={B.y} x2={P.x} y2={P.y} stroke="var(--c-metal-light)" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        <line x1={G0.x} y1={G0.y} x2={P.x} y2={P.y} stroke="var(--c-metal-dark)" strokeWidth={18} strokeLinecap="round" />
        <line x1={G0.x} y1={G0.y} x2={P.x} y2={P.y} stroke="var(--c-rubber)" strokeWidth={15} strokeLinecap="round" />
        {/* Tubo de la llave sobre el bulón (hexágono que gira con la llave) */}
        <g transform={`rotate(${(-phi * 180) / Math.PI} ${B.x} ${B.y})`}>
          <polygon
            points={Array.from({ length: 6 }, (_, i) => `${B.x + 15 * Math.cos(rad(i * 60))},${B.y + 15 * Math.sin(rad(i * 60))}`).join(" ")}
            fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={2}
          />
          <line x1={B.x} y1={B.y} x2={B.x + 12} y2={B.y} stroke="var(--accent)" strokeWidth={2.5} />
        </g>
        <circle cx={B.x} cy={B.y} r={3} fill="var(--c-metal-dark)" />

        {/* Fuerza */}
        <Arrow x1={P.x - f.x * aLen} y1={P.y - f.y * aLen} x2={P.x - f.x * 4} y2={P.y - f.y * 4} color="var(--accent)" width={4} head={13} />
        <text x={P.x - f.x * aLen + 6} y={P.y - f.y * aLen - 8} textAnchor="middle" className="svg-label" style={{ ...HALO, fill: "var(--accent)" }}>
          F = {F} N
        </text>
        {ang < 88 && (
          <text x={P.x + 6} y={P.y + 44} className="svg-small" style={HALO}>{ang}° respecto de la llave</text>
        )}
        <text x={P.x + 6} y={P.y + 26} className="svg-label" style={HALO}>L = {Math.round(L * 100)} cm</text>

        {/* Estado */}
        {ok ? (
          ph > 1.3 && ph < 2.7 && (
            <text x={24} y={34} className="svg-title" style={{ ...HALO, fill: "var(--ok)" }}>¡Cedió! El bulón gira</text>
          )
        ) : (
          <text x={24} y={34} className="svg-title" style={{ ...HALO, fill: "var(--bad)" }}>
            No alcanza: faltan {fmt(need - T, 0)} N·m
          </text>
        )}
        {ok && (
          <path d={`M${B.x - 26},${B.y - 22} A34,34 0 0 0 ${B.x - 30},${B.y + 18}`} fill="none" stroke="var(--ok)" strokeWidth={2} opacity={0.4 + 0.6 * push} />
        )}

        {/* Gráfico: fuerza necesaria vs largo */}
        <text x={CX0} y={CY0 - 12} className="svg-label">Fuerza necesaria [N] según el largo de la llave</text>
        <line x1={CX0} y1={CY1} x2={CX1} y2={CY1} stroke="var(--border-strong)" />
        <line x1={CX0} y1={CY0} x2={CX0} y2={CY1} stroke="var(--border-strong)" />
        {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7].map((l) => (
          <text key={l} x={mapL(l)} y={CY1 + 13} textAnchor="middle" className="svg-small">{Math.round(l * 100)}</text>
        ))}
        <text x={CX1} y={CY1 + 25} textAnchor="end" className="svg-small">largo [cm]</text>
        {[0, 400, 800, 1200].map((v) => (
          <text key={v} x={CX0 - 5} y={mapF(v) + 4} textAnchor="end" className="svg-small">{v}</text>
        ))}
        <path d={curve} fill="none" stroke="var(--primary)" strokeWidth={2.5} />
        <line x1={CX0} y1={mapF(F)} x2={CX1} y2={mapF(F)} stroke="var(--accent)" strokeDasharray="4 3" />
        <text x={CX1 - 4} y={mapF(F) - 5} textAnchor="end" className="svg-small" style={{ fill: "var(--accent)" }}>tu fuerza</text>
        <line x1={mapL(L)} y1={CY0} x2={mapL(L)} y2={CY1} stroke="var(--text)" opacity={0.35} />
        <circle cx={mapL(L)} cy={mapF(Fmin)} r={5} fill={ok ? "var(--ok)" : "var(--bad)"} stroke="var(--surface)" strokeWidth={1.5} />

        {/* Barras de torque */}
        <text x={BX0} y={CY0 - 12} className="svg-label">Torque</text>
        <text x={BX0} y={CY0 + 12} className="svg-small">el que hacés</text>
        <rect x={BX0} y={CY0 + 18} width={BX1 - BX0} height={18} rx={4} fill="var(--surface-2)" stroke="var(--border)" />
        <rect x={BX0} y={CY0 + 18} width={mapT(T) - BX0} height={18} rx={4} fill={ok ? "var(--ok)" : "var(--bad)"} opacity={0.85} />
        <text x={Math.min(mapT(T) + 6, BX1 - 60)} y={CY0 + 31} className="svg-mono" style={{ fontSize: 11 }}>{fmt(T, 0)} N·m</text>
        <text x={BX0} y={CY0 + 58} className="svg-small">el que pide el bulón</text>
        <rect x={BX0} y={CY0 + 64} width={BX1 - BX0} height={18} rx={4} fill="var(--surface-2)" stroke="var(--border)" />
        <rect x={BX0} y={CY0 + 64} width={mapT(need) - BX0} height={18} rx={4} fill="var(--c-metal-2)" />
        <text x={mapT(need) + 6} y={CY0 + 77} className="svg-mono" style={{ fontSize: 11 }}>{need} N·m</text>
        <line x1={mapT(need)} y1={CY0 + 14} x2={mapT(need)} y2={CY0 + 86} stroke="var(--text)" strokeDasharray="3 3" opacity={0.5} />
        <text x={BX0} y={CY1 + 13} className="svg-small">T = F · d = {F} N × {fmt(d, 3)} m</text>
      </svg>
    </AnimFrame>
  );
}
