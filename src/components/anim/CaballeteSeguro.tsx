/* Crique solo vs caballetes: qué pasa si el crique cede con la trompa levantada.
   El auto gira alrededor del apoyo de las ruedas traseras; la caída es libre (g real). */
import { useEffect, useId, useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Toggle, useAnimClock, clamp, rad } from "../ui/anim-kit";

const F = 292; // piso
const PV = { x: 190, y: 292 }; // pivote: apoyo de las ruedas traseras
const BODY =
  "M96 250 L92 206 Q90 170 112 162 L168 154 Q214 104 262 94 L418 90 Q444 90 462 106 L510 156 L618 168 Q646 172 652 196 L656 236 Q657 252 646 254 L580 254 A48 48 0 0 0 484 254 L238 254 A48 48 0 0 0 142 254 L104 254 Q96 254 96 250 Z";
const GLASS = "M176 152 Q216 110 264 102 L414 99 Q434 99 448 113 L492 154 Z";
const DY = 10; // la carrocería va 10 px más baja que en el dibujo base (zócalo a ~20 cm del piso)
const SILL = 254 + DY;
const J = { x: 585, y: SILL }; // apoyo del crique (travesaño delantero)
const S = { x: 470, y: SILL }; // punto de levante del zócalo (caballete)
const G_PX = 9.81 * 130; // gravedad en px/s² (130 px ≈ 1 m)
const LIFT = rad(-4.5); // ángulo con la trompa levantada
const JACK_PIVOT = { x: 690, y: 272 };
const ARM = 126;

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

function rot(p: { x: number; y: number }, th: number) {
  const dx = p.x - PV.x, dy = p.y - PV.y;
  return { x: PV.x + dx * Math.cos(th) - dy * Math.sin(th), y: PV.y + dx * Math.sin(th) + dy * Math.cos(th) };
}
/** Ángulo de la carrocería para que el punto p quede a la altura y. */
function thetaFor(p: { x: number; y: number }, y: number) {
  const dx = p.x - PV.x, dy = p.y - PV.y;
  const R = Math.hypot(dx, dy), phi = Math.atan2(dy, dx);
  return Math.asin(clamp((y - PV.y) / R, -1, 1)) - phi;
}

export function CaballeteSeguro() {
  const clock = useAnimClock({ speed: 1 });
  const [modo, setModo] = useState<"crique" | "caballete">("crique");
  const [sinRueda, setSinRueda] = useState(true);
  const [calzas, setCalzas] = useState(true);
  const [t0, setT0] = useState<number | null>(null);
  const uid = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const k = useFontScale(svgRef);
  const t = Math.max(0, clock.t);
  useEffect(() => setT0(null), [modo, sinRueda]);

  const tau = t0 === null ? 0 : Math.max(0, t - t0);
  const jLift = rot(J, LIFT);
  // ángulo final si se cae: sobre la cubierta (0°) o sobre el disco de freno
  const thEnd = sinRueda ? thetaFor({ x: 532, y: 274 }, F) : 0;
  const yEnd = rot(J, thEnd).y;
  const fallY = jLift.y + 0.5 * G_PX * tau * tau; // caída libre del punto del crique
  const tImpact = Math.sqrt((2 * (yEnd - jLift.y)) / G_PX);
  let th = LIFT;
  const cayo = t0 !== null && modo === "crique";
  if (cayo) {
    if (tau < tImpact) th = thetaFor(J, fallY);
    else {
      const tb = tau - tImpact;
      th = thEnd - rad(sinRueda ? 0.5 : 1.4) * Math.exp(-7 * tb) * Math.abs(Math.sin(20 * tb));
    }
  }
  const caido = cayo && tau >= tImpact;

  // Crique: el asiento baja hasta su mínimo
  const jackMinY = 258;
  const jackY = t0 === null ? jLift.y : Math.min(jackMinY, jLift.y + 0.5 * G_PX * tau * tau * (modo === "crique" ? 1 : 0.35));
  const jackX = JACK_PIVOT.x - Math.sqrt(Math.max(0, ARM * ARM - (JACK_PIVOT.y - jackY) ** 2));
  const jackColor = modo === "crique" ? "var(--bad)" : "var(--c-metal-2)";

  // Caballete
  const sP = rot(S, LIFT);

  // Zona de trabajo debajo del auto
  const zoneX0 = 330, zoneX1 = 470;
  /** Altura del piso del auto (zócalo, y = 254 en el dibujo) en una x del mundo. */
  const bottomAt = (x: number) => PV.y + (x - PV.x) * Math.tan(th) + (SILL - PV.y) / Math.cos(th);
  const z0 = bottomAt(zoneX0), z1 = bottomAt(zoneX1);

  const droop = clamp(-th / -LIFT, 0, 1) * 8;
  const deg = (th * 180) / Math.PI;

  const estado = caido
    ? { v: "¡SE CAYÓ!", tone: "bad" as const }
    : modo === "crique"
      ? { v: "PELIGRO", tone: "bad" as const }
      : !calzas
        ? { v: "Falta calzar", tone: "warn" as const }
        : { v: "Seguro", tone: "ok" as const };

  return (
    <AnimFrame
      title="Crique solo vs caballetes: ¿qué pasa si el crique cede?"
      clock={clock}
      controls={
        <>
          <Seg value={modo} onChange={setModo} ariaLabel="Cómo está sostenido" options={[{ value: "crique", label: "🔴 Sólo crique" }, { value: "caballete", label: "🟢 Con caballetes" }]} />
          <Toggle label="Rueda sacada" checked={sinRueda} onChange={setSinRueda} />
          <Toggle label="Ruedas de atrás calzadas" checked={calzas} onChange={setCalzas} />
          <button className="btn accent sm" onClick={() => { clock.setPlaying(true); setT0(t); }} disabled={t0 !== null}>💥 ¿Y si cede el crique?</button>
          <button className="btn ghost sm" onClick={() => setT0(null)}>↺ Reiniciar</button>
        </>
      }
      readouts={
        <>
          <Readout label="Estado" value={estado.v} tone={estado.tone} />
          <Readout label="Lo sostiene" value={caido ? "nada" : modo === "crique" ? "crique" : "caballete"} tone={modo === "crique" ? "bad" : "ok"} />
          <Readout label="Peso de la trompa" value="≈ 700" unit="kg" />
          <Readout label="Si cae, tarda" value={tImpact.toLocaleString("es-AR", { maximumFractionDigits: 2 })} unit="s" tone="warn" />
        </>
      }
      legend={[
        { color: "var(--bad)", label: "Crique: sólo para levantar" },
        { color: "var(--ok)", label: "Caballete y puntos de levante" },
        { color: "var(--warn)", label: "Calzas" },
      ]}
      caption={
        <>
          <p>
            El <b>crique levanta, el caballete sostiene</b>. Un crique hidráulico puede perder presión por un retén gastado, una válvula
            que pierde o un golpe sin aviso; uno de tijera se puede doblar o patinar. Si cede, la trompa de un auto mediano (unos
            700 kg) baja en <b>un cuarto de segundo</b>: no hay reflejo que te saque de abajo a tiempo. Con la <b>rueda sacada</b> es
            peor, porque cae hasta el disco de freno.
          </p>
          <p>
            Con <b>caballetes</b> en los <b>puntos de levante</b> (los refuerzos del zócalo o del bastidor que marca el manual) el crique
            puede bajar sin que el auto se mueva. Dejalo apenas apoyado como respaldo y <b>calzá las ruedas</b> que quedan en el piso.
            Probá «Paso ›» con la animación en pausa para ver la caída cuadro por cuadro.
          </p>
        </>
      }
    >
      <svg ref={svgRef} viewBox="0 0 720 320" role="img" aria-label="Auto levantado con crique y caballetes">
        <defs>
          <pattern id={`${uid}-dz`} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="var(--bad)" strokeWidth="4" opacity="0.45" />
          </pattern>
        </defs>
        {/* piso */}
        <rect x={0} y={F} width={720} height={28} fill="var(--surface-2)" />
        <line x1={0} y1={F} x2={720} y2={F} stroke="var(--border-strong)" strokeWidth={2} />

        {/* zona de peligro (donde ponés el cuerpo) */}
        <path d={`M${zoneX0},${F} L${zoneX0},${z0 + 2} L${zoneX1},${z1 + 2} L${zoneX1},${F} Z`} fill={`url(#${uid}-dz)`} stroke="var(--bad)" strokeDasharray="4 3" strokeWidth={1.2} />
        {!caido && (
          <text x={(zoneX0 + zoneX1) / 2} y={F - 8} textAnchor="middle" style={{ fontSize: 12 * k, fontWeight: 700, fill: "var(--bad)", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>
            acá va tu cuerpo
          </text>
        )}

        {/* rueda sacada, apoyada en el piso */}
        {sinRueda && (
          <g>
            <ellipse cx={58} cy={F - 6} rx={40} ry={8} fill="var(--c-rubber)" stroke="var(--border-strong)" />
            <ellipse cx={58} cy={F - 9} rx={24} ry={5} fill="var(--c-metal-2)" />
          </g>
        )}

        {/* calzas */}
        {calzas && (
          <g fill="var(--warn)" stroke="var(--c-metal-dark)" strokeWidth={1}>
            <path d={`M${136},${F} L${160},${F} L${148},${F - 18} Z`} />
            <path d={`M${222},${F} L${246},${F} L${232},${F - 18} Z`} />
          </g>
        )}

        {/* auto (rígido, gira alrededor del apoyo trasero) */}
        <g transform={`rotate(${deg} ${PV.x} ${PV.y})`}>
          {/* rueda trasera */}
          <WheelS cx={190} cy={252} />
          {/* adelante: rueda colgando o disco solo */}
          {sinRueda ? (
            <g transform={`translate(532 ${252 + droop})`}>
              <circle r={22} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" strokeWidth={2} />
              <circle r={8} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
              {[0, 1, 2, 3].map((i) => <circle key={i} cx={Math.cos(i * 1.57) * 13} cy={Math.sin(i * 1.57) * 13} r={2} fill="var(--c-metal-dark)" />)}
              <rect x={-26} y={-20} width={12} height={22} rx={4} fill="var(--bad)" />
            </g>
          ) : (
            <WheelS cx={532} cy={252 + droop} />
          )}
          <line x1={532} y1={200} x2={532} y2={244 + droop} stroke="var(--c-metal-dark)" strokeWidth={4} />
          <g transform={`translate(0 ${DY})`}>
            <path d={BODY} fill="var(--surface)" stroke="var(--muted)" strokeWidth={2} />
            <path d={GLASS} fill="var(--c-mix)" opacity={0.2} />
            <rect x={338} y={99} width={9} height={57} fill="var(--surface)" stroke="var(--c-metal-2)" />
            <line x1={342} y1={156} x2={342} y2={250} stroke="var(--c-metal-2)" strokeWidth={1.2} />
          </g>
          {/* puntos de levante */}
          {[250, 470].map((x) => (
            <path key={x} d={`M${x - 7},${SILL} L${x + 7},${SILL} L${x},${SILL - 8} Z`} fill="var(--ok)" />
          ))}
          <rect x={J.x - 12} y={SILL - 6} width={24} height={6} rx={2} fill="var(--c-metal-dark)" />
        </g>

        {/* caballete */}
        {modo === "caballete" && (
          <g>
            <line x1={sP.x - 28} y1={F} x2={sP.x - 7} y2={F - 34} stroke="var(--ok)" strokeWidth={5} strokeLinecap="round" />
            <line x1={sP.x + 28} y1={F} x2={sP.x + 7} y2={F - 34} stroke="var(--ok)" strokeWidth={5} strokeLinecap="round" />
            <rect x={sP.x - 9} y={F - 40} width={18} height={14} rx={3} fill="var(--ok)" />
            <rect x={sP.x - 5} y={sP.y + 6} width={10} height={F - 40 - sP.y - 6} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" />
            {Array.from({ length: Math.max(0, Math.floor((F - 46 - sP.y) / 6)) }, (_, i) => (
              <line key={i} x1={sP.x - 5} y1={sP.y + 10 + i * 6} x2={sP.x + 5} y2={sP.y + 13 + i * 6} stroke="var(--c-metal-dark)" strokeWidth={1} />
            ))}
            <path d={`M${sP.x - 11},${sP.y - 1} L${sP.x - 6},${sP.y + 7} L${sP.x + 6},${sP.y + 7} L${sP.x + 11},${sP.y - 1}`} fill="var(--ok)" stroke="var(--ok)" strokeWidth={2} />
          </g>
        )}

        {/* crique carrito */}
        <g>
          <rect x={598} y={274} width={110} height={12} rx={4} fill={jackColor} />
          <circle cx={610} cy={288} r={5} fill="var(--c-rubber)" />
          <circle cx={696} cy={288} r={5} fill="var(--c-rubber)" />
          <line x1={650} y1={278} x2={(JACK_PIVOT.x + jackX) / 2 + 6} y2={(JACK_PIVOT.y + jackY) / 2} stroke="var(--c-metal-light)" strokeWidth={6} strokeLinecap="round" />
          <line x1={JACK_PIVOT.x} y1={JACK_PIVOT.y} x2={jackX} y2={jackY + 8} stroke={jackColor} strokeWidth={9} strokeLinecap="round" />
          <rect x={jackX - 12} y={jackY} width={24} height={8} rx={2} fill="var(--c-metal-dark)" />
          <line x1={700} y1={272} x2={716} y2={196} stroke="var(--c-metal-dark)" strokeWidth={4} strokeLinecap="round" />
        </g>

        {/* etiquetas */}
        <text x={250} y={312} textAnchor="middle" style={{ fontSize: 11 * k, fill: "var(--ok)", fontWeight: 700 }}>▲ puntos de levante ▲</text>
        <text x={650} y={312} textAnchor="middle" style={{ fontSize: 11 * k, fill: jackColor, fontWeight: 700 }}>crique</text>
        {modo === "caballete" && <text x={sP.x} y={312} textAnchor="middle" style={{ fontSize: 11 * k, fill: "var(--ok)", fontWeight: 700 }}>caballete</text>}

        {/* mensaje del resultado */}
        {t0 !== null && tau > 0.12 && (() => {
          const msg = modo === "crique"
            ? `Cayó en ${tImpact.toLocaleString("es-AR", { maximumFractionDigits: 2 })} s. Nadie sale a tiempo.`
            : "El crique bajó y el auto ni se movió. 👍";
          const fz = 16 * Math.min(k, 1.35);
          const w = Math.min(700, msg.length * fz * 0.56 + 40);
          return (
            <g>
              <rect x={360 - w / 2} y={14} width={w} height={fz + 26} rx={10} fill={caido ? "var(--bad)" : "var(--ok)"} opacity={0.94} />
              <text x={360} y={14 + 13 + fz * 0.8} textAnchor="middle" style={{ fontSize: fz, fontWeight: 800, fill: "#fff" }}>{msg}</text>
            </g>
          );
        })()}
        {caido && (
          <g>
            <circle cx={(zoneX0 + zoneX1) / 2} cy={F - 14} r={13} fill="var(--bad)" />
            <path d={`M${(zoneX0 + zoneX1) / 2 - 6},${F - 20} l12,12 m0,-12 l-12,12`} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
          </g>
        )}
      </svg>
    </AnimFrame>
  );
}

function WheelS({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={40} fill="var(--c-rubber)" stroke="var(--border-strong)" strokeWidth={2} />
      <circle r={26} fill="var(--c-metal-2)" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        return <line key={i} x1={Math.cos(a) * 7} y1={Math.sin(a) * 7} x2={Math.cos(a) * 24} y2={Math.sin(a) * 24} stroke="var(--c-metal-light)" strokeWidth={5} strokeLinecap="round" />;
      })}
      <circle r={6} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
    </g>
  );
}
