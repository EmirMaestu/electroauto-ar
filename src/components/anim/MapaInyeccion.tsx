/* Mapas de la ECU: tablas rpm × carga (MAP) para tiempo de inyección, avance y lambda objetivo.
   El punto de funcionamiento recorre un manejo típico; la ECU interpola entre las 4 celdas vecinas. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, fmt, clamp, lerp, smoothstep } from "../ui/anim-kit";
import { useNarrowScreen } from "./RuedaFonica";

const RPMS_W = [800, 1200, 1600, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000];
const MAPS_W = [20, 30, 40, 50, 60, 70, 80, 90, 100];
// en celular, una tabla más chica (menos celdas, letra más grande)
const RPMS_N = [800, 1600, 2500, 3500, 4500, 6000];
const MAPS_N = [20, 40, 60, 80, 100];
type Tabla = "iny" | "avance" | "lambda";

const ve = (rpm: number) => 0.78 + 0.16 * Math.exp(-(((rpm - 3800) / 2200) ** 2));
const lamT = (rpm: number, map: number) => (map < 80 ? 1 : lerp(1, rpm > 4500 ? 0.84 : 0.88, smoothstep(80, 95, map)));
const valIny = (rpm: number, map: number) => 0.9 + (11.5 * (map / 100) * ve(rpm)) / lamT(rpm, map);
const valAv = (rpm: number, map: number) =>
  6 + 18 * Math.min(1, rpm / 3000) + 16 * (1 - map / 100) * Math.min(1, rpm / 2000) + 6 * Math.max(0, (rpm - 3000) / 3000) - 4 * Math.max(0, (map - 80) / 20);
const VAL: Record<Tabla, (r: number, m: number) => number> = { iny: valIny, avance: valAv, lambda: lamT };
const RANGE: Record<Tabla, [number, number]> = { iny: [1, 15], avance: [5, 42], lambda: [0.84, 1] };

/** Recorrido de manejo (s → rpm, kPa, nombre) */
function drive(t: number) {
  const T = t % 26;
  if (T < 3) return { rpm: 800, map: 32, fase: "Ralentí" };
  if (T < 8) { const f = (T - 3) / 5; return { rpm: lerp(900, 4800, f), map: lerp(85, 98, smoothstep(0, 0.2, f)), fase: "Acelerando a fondo" }; }
  if (T < 9) { const f = T - 8; return { rpm: lerp(4800, 3000, f), map: lerp(98, 60, f), fase: "Cambio de marcha" }; }
  if (T < 15) { const f = (T - 9) / 6; return { rpm: lerp(3000, 2500, f), map: lerp(60, 42, smoothstep(0, 0.4, f)), fase: "Crucero" }; }
  if (T < 21) { const f = (T - 15) / 6; return { rpm: lerp(2500, 1100, f), map: 21, fase: "Desacelerando (pie levantado)" }; }
  const f = (T - 21) / 5;
  return { rpm: lerp(1100, 800, smoothstep(0, 0.4, f)), map: lerp(21, 32, smoothstep(0, 0.3, f)), fase: "Volviendo a ralentí" };
}

export function MapaInyeccion() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const RPMS = narrow ? RPMS_N : RPMS_W;
  const MAPS = narrow ? MAPS_N : MAPS_W;
  const [tabla, setTabla] = useState<Tabla>("iny");
  const [modo, setModo] = useState<"auto" | "manual">("auto");
  const [mRpm, setMRpm] = useState(2500);
  const [mMap, setMMap] = useState(45);

  const op = modo === "auto" ? drive(clock.t) : { rpm: mRpm, map: mMap, fase: "Manual" };
  const corte = op.map < 25 && op.rpm > 1300;
  const fn = VAL[tabla];
  const [lo, hi] = RANGE[tabla];
  const value = tabla === "iny" && corte ? 0 : fn(op.rpm, op.map);

  const X0 = narrow ? 52 : 74, Y0 = 34, CW = narrow ? 58 : 52.5, CH = narrow ? 36 : 28;
  const VW = narrow ? 410 : 720, VH = Y0 + CH * MAPS.length + 34;
  const colX = (i: number) => X0 + i * CW;
  const rowY = (j: number) => Y0 + (MAPS.length - 1 - j) * CH; // carga alta arriba
  // posición continua del punto (entre centros de celda)
  const fracIdx = (arr: number[], v: number) => {
    const c = clamp(v, arr[0], arr[arr.length - 1]);
    let i = 0;
    while (i < arr.length - 2 && c > arr[i + 1]) i++;
    return i + (c - arr[i]) / (arr[i + 1] - arr[i]);
  };
  const fi = fracIdx(RPMS, op.rpm), fj = fracIdx(MAPS, op.map);
  const px = colX(fi) + CW / 2, py = rowY(fj) + CH / 2;
  const i0 = Math.min(Math.floor(fi), RPMS.length - 2), j0 = Math.min(Math.floor(fj), MAPS.length - 2);
  const fmtV = (v: number) => (tabla === "lambda" ? fmt(v, 2) : fmt(v, tabla === "iny" ? 1 : 0));
  const color = tabla === "iny" ? "var(--accent)" : tabla === "avance" ? "var(--primary)" : "var(--c-fuel)";
  const unit = tabla === "iny" ? "ms" : tabla === "avance" ? "°" : "λ";

  return (
    <AnimFrame
      title="Los mapas de la ECU: tablas de rpm × carga"
      clock={clock}
      controls={
        <>
          <Seg value={tabla} onChange={setTabla} ariaLabel="Tabla" options={[{ value: "iny", label: "Inyección (ms)" }, { value: "avance", label: "Avance (°)" }, { value: "lambda", label: "λ objetivo" }]} />
          <Seg value={modo} onChange={setModo} ariaLabel="Modo" options={[{ value: "auto", label: "Manejo automático" }, { value: "manual", label: "Manual" }]} />
          {modo === "manual" && (
            <>
              <Slider label="RPM" value={mRpm} min={800} max={6000} step={50} onChange={setMRpm} />
              <Slider label="MAP" value={mMap} min={20} max={100} step={1} onChange={setMMap} unit="kPa" />
            </>
          )}
        </>
      }
      readouts={
        <>
          <Readout label="Situación" value={<span style={{ fontSize: ".8rem" }}>{op.fase}</span>} tone="accent" />
          <Readout label="RPM" value={fmt(op.rpm, 0)} />
          <Readout label="MAP" value={fmt(op.map, 0)} unit="kPa" />
          <Readout label={tabla === "iny" ? "Tiempo de inyección" : tabla === "avance" ? "Avance" : "λ objetivo"}
            value={tabla === "iny" && corte ? "0 (corte)" : fmtV(value)} unit={tabla === "iny" && corte ? undefined : unit}
            tone={tabla === "iny" && corte ? "warn" : "ok"} />
        </>
      }
      caption={
        <>
          <p>
            Cada mapa es una <b>tabla</b> que se armó en el banco de pruebas del fabricante: para cada combinación de rpm y carga
            (acá, presión en el múltiple), cuánto inyectar, cuánto avance dar y qué mezcla buscar. La ECU ubica el punto de
            funcionamiento y <b>interpola</b> entre las cuatro celdas vecinas (el recuadro), así no hay escalones.
          </p>
          <p>
            Fijate: a fondo (arriba) el tiempo de inyección es máximo y la lambda objetivo baja a ~0,88 (enriquece para potencia y
            para cuidar el catalizador); el avance es máximo con poca carga y muchas vueltas, y mínimo con mucha carga y pocas vueltas,
            que es donde aparece la detonación. Al levantar el pie con el motor en vueltas, la ECU <b>corta la inyección</b>.
            “Reprogramar” una ECU es, en buena parte, cambiar los números de estas tablas.
          </p>
        </>
      }
    >
      <svg viewBox={`0 0 ${VW} ${VH}`} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Mapa de la ECU con el punto de funcionamiento">
        <text x={X0 - 8} y={Y0 - 14} textAnchor="end" className="svg-small">kPa</text>
        {RPMS.map((r, i) => (
          <text key={r} x={colX(i) + CW / 2} y={Y0 - 10} textAnchor="middle" className="svg-small">{r >= 1000 ? `${r / 1000}k` : r}</text>
        ))}
        <text x={X0 + (CW * RPMS.length) / 2} y={Y0 + CH * MAPS.length + 26} textAnchor="middle" className="svg-small">rpm →</text>
        {MAPS.map((m, j) => (
          <text key={m} x={X0 - 8} y={rowY(j) + CH / 2 + 4} textAnchor="end" className="svg-small">{m}</text>
        ))}
        <text x={narrow ? 12 : 18} y={Y0 + (CH * MAPS.length) / 2} textAnchor="middle" className="svg-small" transform={`rotate(-90 ${narrow ? 12 : 18} ${Y0 + (CH * MAPS.length) / 2})`}>carga (MAP) →</text>
        {MAPS.map((m, j) =>
          RPMS.map((r, i) => {
            const v = fn(r, m);
            const n = tabla === "lambda" ? (hi - v) / (hi - lo) : (v - lo) / (hi - lo);
            return (
              <g key={`${i}-${j}`}>
                <rect x={colX(i) + 1} y={rowY(j) + 1} width={CW - 2} height={CH - 2} rx={3} fill={color} opacity={0.08 + 0.72 * clamp(n, 0, 1)} />
                <text x={colX(i) + CW / 2} y={rowY(j) + CH / 2 + 4} textAnchor="middle" className="svg-small" style={{ fill: "var(--text)", fontSize: narrow ? 13 : 10 }}>{fmtV(v)}</text>
              </g>
            );
          }),
        )}
        {/* celdas que usa la interpolación */}
        <rect x={colX(i0) + CW / 2} y={rowY(j0 + 1) + CH / 2} width={CW} height={CH} fill="none" stroke="var(--text)" strokeWidth={2} strokeDasharray="5 3" />
        {tabla === "iny" && corte && (
          <text x={px + 12} y={py - 10} className="svg-label" style={{ fill: "var(--warn)" }}>corte de inyección</text>
        )}
        <circle cx={px} cy={py} r={9} fill="none" stroke="var(--text)" strokeWidth={2.5} />
        <circle cx={px} cy={py} r={4} fill="var(--text)" />
      </svg>
    </AnimFrame>
  );
}
