/* Faros: alcance de la luz alta según la tecnología (ley inversa del cuadrado E = I / d²)
   y geometría de la luz baja: el corte inclinado (−1 % típico) define dónde toca el piso
   y si encandila al que viene de frente. Valores típicos aproximados. */
import { useState, type ReactNode } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, plotPath, fmt } from "../ui/anim-kit";

type Tec = "hal" | "xen" | "led" | "las";
const TEC: Record<Tec, { name: string; I: number; K: number; ef: string; color: string }> = {
  hal: { name: "Halógeno", I: 40000, K: 3200, ef: "≈ 25", color: "var(--c-flame)" },
  xen: { name: "Xenón", I: 90000, K: 4200, ef: "≈ 90", color: "var(--teal)" },
  led: { name: "LED", I: 125000, K: 5700, ef: "≈ 100", color: "var(--primary)" },
  las: { name: "Láser", I: 360000, K: 5500, ef: "≈ 170", color: "var(--violet)" },
};
const H_FARO = 0.65; // m
const OJO = 1.1;     // m: ojos del que viene de frente
const D_ON = 50;     // m: auto de frente

export function FarosAlcance() {
  const [tec, setTec] = useState<Tec>("hal");
  const [haz, setHaz] = useState<"larga" | "cruce">("larga");
  const [dist, setDist] = useState(150);
  const [incl, setIncl] = useState(-1);
  const [carga, setCarga] = useState(false);
  const T = TEC[tec];
  const larga = haz === "larga";
  const dMax = larga ? 600 : 120;
  const d = Math.min(dist, dMax);

  /* larga */
  const E = T.I / (d * d);
  const alcance = Math.sqrt(T.I); // distancia a la que E = 1 lux

  /* cruce */
  const s = (incl + (carga ? 1.5 : 0)) / 100;       // pendiente del corte
  const hCorte = (x: number) => H_FARO + s * x;      // altura del corte a x metros
  const dPiso = s < 0 ? H_FARO / -s : Infinity;
  const h50 = hCorte(D_ON);
  const glare = h50 >= 1.0 ? "bad" : h50 >= 0.6 ? "warn" : "ok";

  /* dibujo: vista lateral */
  const X0 = 100, X1 = 706, ROAD = 196, VS = 48;
  const sx = (X1 - X0) / dMax;
  const px = (m: number) => X0 + m * sx;
  const py = (h: number) => ROAD - h * VS;
  const HX = X0 - 4, HY = py(H_FARO);

  let beam: ReactNode;
  if (larga) {
    const n = 26;
    beam = (
      <g>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * dMax, b = ((i + 1) / n) * dMax;
          const mid = Math.max(4, (a + b) / 2);
          const op = Math.min(0.8, Math.sqrt(T.I / (mid * mid) / 6) * 0.8);
          const top = (x: number) => py(H_FARO + Math.min(2.8, x * 0.012));
          return <polygon key={i} points={`${px(a)},${top(a)} ${px(b)},${top(b)} ${px(b)},${ROAD} ${px(a)},${ROAD}`} fill="var(--c-spark)" opacity={op} />;
        })}
      </g>
    );
  } else {
    const xEnd = Math.min(dPiso, dMax);
    const hEnd = Math.max(0, Math.min(3.4, hCorte(xEnd)));
    beam = (
      <g>
        <polygon points={`${HX},${HY} ${px(xEnd)},${py(hEnd)} ${px(xEnd)},${ROAD} ${px(2)},${ROAD}`} fill="var(--c-spark)" opacity={0.45} />
        <line x1={HX} y1={HY} x2={px(xEnd)} y2={py(hEnd)} stroke="var(--warn)" strokeWidth={2} />
      </g>
    );
  }

  // peatón
  const PH = 1.7;
  const pedX = px(d);
  const litTo = larga ? PH : d < dPiso ? Math.max(0, Math.min(PH, hCorte(d))) : 0;
  const pedOp = larga ? Math.min(1, Math.sqrt(E / 3)) : litTo > 0 ? 0.95 : 0;

  /* gráfico lux vs distancia (larga) */
  const GX = 64, GY = 282, GW = 636, GH = 150, YM = 10;
  const gx = (m: number) => GX + (m / 600) * GW;
  const gy = (lx: number) => GY + GH - (Math.min(lx, YM) / YM) * GH;

  return (
    <AnimFrame
      title="Faros: cuánto alcanza la luz y por qué importa la regulación"
      tag="Interactivo"
      controls={
        <>
          <Seg value={tec} onChange={setTec} ariaLabel="Tecnología" options={(Object.keys(TEC) as Tec[]).map((k) => ({ value: k, label: TEC[k].name }))} />
          <Seg value={haz} onChange={setHaz} ariaLabel="Haz" options={[{ value: "larga", label: "Luz alta" }, { value: "cruce", label: "Luz baja (cruce)" }]} />
          <Slider label="Peatón a" value={d} min={10} max={dMax} step={5} onChange={setDist} unit="m" />
          {!larga && <Slider label="Inclinación del corte" value={incl} min={-3} max={1} step={0.1} onChange={setIncl} unit="%" format={(v) => (v > 0 ? "+" : "") + fmt(v, 1)} />}
          {!larga && <Toggle label="Baúl cargado (trompa +1,5 %)" checked={carga} onChange={setCarga} />}
        </>
      }
      readouts={
        larga ? (
          <>
            <Readout label="Intensidad máxima" value={fmt(T.I / 1000, 0)} unit="mil cd" />
            <Readout label="Luz sobre el peatón" value={fmt(E, E < 10 ? 1 : 0)} unit="lux" tone={E >= 1 ? "ok" : "bad"} />
            <Readout label="Alcance útil (1 lux)" value={fmt(alcance, 0)} unit="m" tone="accent" />
            <Readout label="Color · eficacia" value={`${fmt(T.K, 0)} K`} unit={`${T.ef} lm/W`} />
          </>
        ) : (
          <>
            <Readout label="Inclinación real" value={(s > 0 ? "+" : "") + fmt(s * 100, 1)} unit="%" />
            <Readout label="El corte toca el piso a" value={Number.isFinite(dPiso) ? fmt(dPiso, 0) : "nunca"} unit={Number.isFinite(dPiso) ? "m" : ""} tone={!Number.isFinite(dPiso) ? "bad" : dPiso < 40 ? "warn" : "ok"} />
            <Readout label={`Altura del corte a ${D_ON} m`} value={fmt(Math.max(0, h50) * 100, 0)} unit="cm" />
            <Readout label="¿Encandila al de enfrente?" value={glare === "bad" ? "Sí" : glare === "warn" ? "Al límite" : "No"} tone={glare} />
          </>
        )
      }
      legend={[
        { color: "var(--c-spark)", label: "Zona iluminada" },
        { color: "var(--warn)", label: "Línea de corte de la luz baja" },
        ...(Object.keys(TEC) as Tec[]).map((k) => ({ color: TEC[k].color, label: `${TEC[k].name}: lux a cada distancia` })),
      ]}
      caption={
        larga ? (
          <p>
            La luz de un faro se reparte en un área que crece con el cuadrado de la distancia: a <b>el doble de distancia, un cuarto de luz</b>{" "}
            (E = I / d²). Por eso el alcance no crece tanto como la intensidad: el láser tiene 9 veces la intensidad del halógeno y llega
            &quot;sólo&quot; 3 veces más lejos. Como referencia práctica se toma 1 lux como lo mínimo para distinguir un obstáculo. Valores
            típicos aproximados: cada faro es distinto.
          </p>
        ) : (
          <p>
            La luz baja tiene un <b>corte</b>: arriba de esa línea casi no hay luz, para no encandilar. De fábrica el corte apunta un poco hacia
            abajo (−1 % a −1,5 %: baja 10 a 15 cm cada 10 m) y toca el piso a unos 45–65 m. Subí la inclinación o cargá el baúl: la trompa se
            levanta, el corte pasa a la altura de los ojos del que viene y <b>lo encandilás</b>. Bajala de más y la luz muere a 20 m: ves tarde
            al peatón. Para eso está la ruedita de regulación del tablero.
          </p>
        )
      }
    >
      <svg viewBox="0 0 720 460" role="img" aria-label="Alcance de los faros">
        {/* camino */}
        <rect x={0} y={ROAD} width={720} height={14} fill="var(--c-rubber)" opacity={0.8} />
        {Array.from({ length: 10 }, (_, i) => (
          <line key={i} x1={px((i + 0.2) * dMax / 10)} y1={ROAD + 7} x2={px((i + 0.6) * dMax / 10)} y2={ROAD + 7} stroke="var(--c-metal-light)" strokeWidth={2} opacity={0.6} />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={px(f * dMax)} y={ROAD + 28} textAnchor="middle" className="svg-small">{fmt(f * dMax, 0)} m</text>
        ))}
        {beam}
        {larga && alcance <= dMax && (
          <g>
            <line x1={px(alcance)} y1={40} x2={px(alcance)} y2={ROAD} stroke={T.color} strokeDasharray="5 4" strokeWidth={2} />
            <text x={px(alcance) + (alcance > 480 ? -6 : 6)} y={52} textAnchor={alcance > 480 ? "end" : "start"} className="svg-label" style={{ fill: T.color }}>1 lux a {fmt(alcance, 0)} m</text>
          </g>
        )}
        {/* auto */}
        <path d={`M8,${ROAD - 6} L8,${ROAD - 30} L30,${ROAD - 34} L48,${ROAD - 58} L74,${ROAD - 58} L90,${ROAD - 38} L98,${ROAD - 34} L98,${ROAD - 6} Z`} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" />
        <circle cx={26} cy={ROAD - 6} r={9} fill="var(--c-rubber)" />
        <circle cx={80} cy={ROAD - 6} r={9} fill="var(--c-rubber)" />
        <circle cx={HX} cy={HY} r={4} fill="var(--c-spark)" stroke="var(--c-metal-dark)" />
        {/* auto de frente (cruce): mira hacia nosotros, ojos del conductor cerca del frente */}
        {!larga && (() => {
          const ox = px(D_ON);
          return (
            <g>
              <path d={`M${ox + 44},${ROAD - 6} L${ox + 44},${ROAD - 30} L${ox + 34},${ROAD - 34} L${ox + 26},${ROAD - 56} L${ox + 10},${ROAD - 56} L${ox + 4},${ROAD - 38} L${ox - 2},${ROAD - 34} L${ox - 2},${ROAD - 6} Z`}
                fill="var(--c-metal)" stroke="var(--c-metal-dark)" opacity={0.9} />
              <circle cx={ox + 6} cy={ROAD - 6} r={6} fill="var(--c-rubber)" />
              <circle cx={ox + 34} cy={ROAD - 6} r={6} fill="var(--c-rubber)" />
              <circle cx={ox + 14} cy={py(OJO)} r={5} fill={glare === "bad" ? "var(--bad)" : glare === "warn" ? "var(--warn)" : "var(--ok)"} stroke="#fff" strokeWidth={1.5} />
              <text x={ox + 20} y={ROAD + 44} textAnchor="middle" className="svg-small" style={{ fontWeight: 700 }}>auto de frente ({D_ON} m) · punto = ojos</text>
            </g>
          );
        })()}
        {/* peatón */}
        <g>
          <rect x={pedX - 5} y={py(PH)} width={10} height={PH * VS} rx={4} fill="var(--c-metal-dark)" opacity={0.5} />
          {litTo > 0 && <rect x={pedX - 5} y={py(litTo)} width={10} height={litTo * VS} rx={4} fill="var(--c-spark)" opacity={pedOp} stroke="var(--warn)" />}
          <circle cx={pedX} cy={py(PH) - 7} r={7} fill={larga && pedOp > 0.3 ? "var(--c-spark)" : "var(--c-metal-dark)"} opacity={larga ? Math.max(0.5, pedOp) : 0.7} />
          <text x={pedX} y={py(PH) - 20} textAnchor="middle" className="svg-small">peatón</text>
        </g>
        <text x={14} y={24} className="svg-title" style={{ fontSize: 13 }}>{larga ? "Luz alta" : "Luz baja"} · vista de costado (alturas exageradas)</text>

        {/* gráfico */}
        <rect x={GX} y={GY} width={GW} height={GH} rx={8} fill="var(--surface)" stroke="var(--border)" />
        <text x={GX} y={GY - 10} className="svg-small">luz alta: lux sobre el camino según la distancia (E = I / d²)</text>
        {[2, 4, 6, 8, 10].map((k) => (
          <g key={k}>
            <line x1={GX} y1={gy(k)} x2={GX + GW} y2={gy(k)} stroke="var(--border)" strokeDasharray="2 5" />
            <text x={GX - 6} y={gy(k) + 4} textAnchor="end" className="svg-small">{k}</text>
          </g>
        ))}
        <line x1={GX} y1={gy(1)} x2={GX + GW} y2={gy(1)} stroke="var(--bad)" strokeDasharray="5 4" />
        <text x={GX + GW - 4} y={gy(1) - 4} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>1 lux</text>
        <text x={GX - 6} y={GY - 10} textAnchor="end" className="svg-small">lux</text>
        {[0, 100, 200, 300, 400, 500, 600].map((m) => (
          <text key={m} x={gx(m)} y={GY + GH + 15} textAnchor={m === 600 ? "end" : "middle"} className="svg-small">{m === 600 ? "600 m" : m}</text>
        ))}
        {(Object.keys(TEC) as Tec[]).map((k) => (
          <path key={k} d={plotPath((m) => TEC[k].I / (m * m), 40, 600, 140, gx, gy)} fill="none" stroke={TEC[k].color}
            strokeWidth={k === tec ? 3.2 : 1.4} opacity={k === tec ? 1 : 0.55} />
        ))}
        {larga && (
          <g>
            <line x1={gx(d)} y1={GY} x2={gx(d)} y2={GY + GH} stroke="var(--text)" opacity={0.35} />
            <circle cx={gx(d)} cy={gy(E)} r={6} fill={T.color} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
    </AnimFrame>
  );
}
