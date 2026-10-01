/* Por qué se desconecta primero el negativo: vista desde arriba de la batería en el vano motor.
   Si aflojás el positivo con el negativo conectado y la llave toca la chapa, cerrás un cortocircuito. */
import { useEffect, useRef, useState } from "react";
import { AnimFrame, Readout, Seg, useAnimClock, clamp, lerp, smoothstep, rad, wrap } from "../ui/anim-kit";

const NEG = { x: 220, y: 150 };
const POS = { x: 380, y: 150 };
const TX = 486; // borde de la torreta
const BOLT = { x: 52, y: 40 }; // bulón de masa en la carrocería
const WL = 100; // largo de la llave
const CYCLE = 10;

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

type Escena = "mal" | "bien";

export function ArranqueBateria() {
  const clock = useAnimClock({ speed: 1 });
  const [esc, setEsc] = useState<Escena>("mal");
  const tc = wrap(Math.max(0, clock.t), CYCLE);
  const svgRef = useRef<SVGSVGElement>(null);
  const k = useFontScale(svgRef);

  // Estado de la escena en el instante tc
  let on = POS, ang = -60, negConectado = true, toca: "nada" | "chapa" | "torreta" = "nada";
  let paso = "";
  const stroke = (t: number, a0: number, a1: number) => lerp(a0, a1, 0.5 - 0.5 * Math.cos(t * Math.PI * 2 * 0.8));
  if (esc === "mal") {
    on = POS;
    if (tc < 3) { ang = stroke(tc, -50, -25); paso = "Aflojás la tuerca del positivo con el negativo todavía conectado…"; }
    else if (tc < 3.6) { ang = lerp(-25, 0, smoothstep(3, 3.6, tc)); paso = "…se te escapa la llave y el mango gira…"; }
    else { ang = 0; toca = "torreta"; paso = "…y toca la chapa: cortocircuito directo de la batería a través de la llave."; }
  } else {
    if (tc < 2.6) {
      on = NEG;
      ang = stroke(tc, -120, -88);
      paso = "Primero el negativo. Si la llave toca la chapa no pasa nada: el negativo ya ES la carrocería.";
    } else if (tc < 4) {
      on = NEG; ang = -88; negConectado = smoothstep(2.6, 3.6, tc) < 0.5;
      paso = "Sacás el terminal negativo y lo dejás apartado, lejos del borne.";
    } else if (tc < 4.6) {
      negConectado = false; on = POS; ang = -50; paso = "Recién ahora vas al positivo…";
    } else if (tc < 7) {
      negConectado = false; on = POS; ang = stroke(tc - 4.6, -50, -25); paso = "Aflojás el positivo…";
    } else {
      negConectado = false; on = POS; ang = lerp(-25, 0, smoothstep(7, 7.5, tc));
      toca = ang > -3 ? "torreta" : "nada";
      paso = "Aunque la llave toque la chapa, no hay camino de vuelta a la batería: no pasa nada.";
    }
  }
  if (esc === "mal") negConectado = true;
  const negOut = esc === "bien" && tc >= 2.6;
  const negLift = esc === "bien" ? smoothstep(2.6, 3.6, tc) : 0;
  const corto = esc === "mal" && toca === "torreta";

  const a = rad(ang);
  const end = { x: on.x + Math.cos(a) * (WL + 12), y: on.y + Math.sin(a) * (WL + 12) };
  if (on === NEG && end.y < 58) toca = "chapa";
  const contactPt = toca === "torreta" ? { x: TX, y: on.y } : toca === "chapa" ? { x: on.x + (58 - on.y) / Math.tan(a), y: 58 } : null;
  const flick = 0.6 + 0.4 * Math.abs(Math.sin(clock.t * 37));
  const flow = -clock.t * 60;

  // terminal negativo: cuando se saca, se mueve hacia arriba a la izquierda
  const negEnd = { x: lerp(NEG.x, 168, negLift), y: lerp(NEG.y, 96, negLift) };

  const corriente = corto ? 600 : 0;

  return (
    <AnimFrame
      title="Por qué se desconecta primero el negativo"
      clock={clock}
      controls={
        <Seg value={esc} onChange={(v) => { setEsc(v); clock.reset(); }} ariaLabel="Orden"
          options={[{ value: "mal", label: "❌ Primero el positivo" }, { value: "bien", label: "✅ Primero el negativo" }]} />
      }
      readouts={
        <>
          <Readout label="Corriente por la llave" value={corto ? "≈ 600" : "0"} unit="A" tone={corto ? "bad" : "ok"} />
          <Readout label="Negativo" value={negConectado && !negOut ? "conectado" : "afuera"} tone={negConectado && !negOut ? "warn" : "ok"} />
          <Readout label="Riesgo" value={corto ? "chispa y quemadura" : "ninguno"} tone={corto ? "bad" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--c-metal-2)", label: "Carrocería = masa = negativo" },
        { color: "var(--bad)", label: "Positivo" },
        { color: "var(--c-spark)", label: "Corriente de cortocircuito" },
      ]}
      caption={
        <>
          <p style={{ margin: "0 0 .5rem", minHeight: "2.6em" }}><b>{paso}</b></p>
          <p>
            En el auto, <b>toda la carrocería está conectada al negativo</b>. Mientras el negativo esté puesto, cualquier herramienta que
            toque el positivo y la chapa al mismo tiempo hace un cortocircuito: pasan cientos de amperes ({corriente > 0 ? "como ahora" : "como en el otro caso"}),
            la llave se pone al rojo, salta metal fundido y la batería puede explotar por los gases. Sacando primero el negativo, el circuito queda
            abierto y la chapa deja de ser peligrosa. Para conectar es al revés: <b>primero el positivo, al final el negativo</b>.
          </p>
        </>
      }
    >
      <svg ref={svgRef} viewBox="0 0 720 300" role="img" aria-label="Batería vista desde arriba con una llave aflojando los bornes">
        {/* chapa de la carrocería: guardabarros interno y torreta */}
        <path d="M20,20 L700,20 L700,58 L566,58 L566,250 L486,250 L486,58 L20,58 Z" fill="var(--c-metal-2)" opacity={0.55} stroke="var(--c-metal-dark)" />
        <text x={70} y={44} style={{ fontSize: 13 * Math.min(k, 1.45), fontWeight: 700, fill: "var(--text)" }}>chapa de la carrocería (masa)</text>
        <text x={526} y={154} textAnchor="middle" transform="rotate(-90 526 154)" style={{ fontSize: 13 * Math.min(k, 1.45), fontWeight: 700, fill: "var(--text)" }}>{k > 1.3 ? "torreta (masa)" : "torreta (también es masa)"}</text>
        <circle cx={BOLT.x} cy={BOLT.y} r={7} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={2} />

        {/* batería */}
        <rect x={170} y={110} width={260} height={150} rx={10} fill="var(--c-belt)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={198 + i * 36} y={206} width={24} height={14} rx={4} fill="var(--c-metal-dark)" />)}
        <text x={300} y={248} textAnchor="middle" style={{ fontSize: 13, fontWeight: 800, fill: "var(--c-metal-light)" }}>12 V</text>
        {/* bornes */}
        <circle cx={NEG.x} cy={NEG.y} r={16} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <text x={NEG.x} y={NEG.y + 44} textAnchor="middle" style={{ fontSize: 26, fontWeight: 900, fill: "var(--c-metal-light)" }}>−</text>
        <circle cx={POS.x} cy={POS.y} r={17} fill="var(--bad)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <text x={POS.x} y={POS.y + 44} textAnchor="middle" style={{ fontSize: 26, fontWeight: 900, fill: "var(--bad)" }}>+</text>

        {/* cable positivo hacia la caja de fusibles / burro */}
        <path d={`M${POS.x},${POS.y} C${POS.x + 70},${200} ${POS.x + 40},${284} ${POS.x - 60},${284}`} fill="none" stroke="var(--bad)" strokeWidth={9} strokeLinecap="round" />
        <rect x={POS.x - 116} y={274} width={56} height={22} rx={4} fill="var(--c-metal-dark)" />
        <text x={POS.x - 124} y={290} textAnchor="end" style={{ fontSize: 12 * Math.min(k, 1.45), fill: "var(--text-2)", fontWeight: 650 }}>al burro y la fusiblera</text>

        {/* cable negativo a la carrocería */}
        <path d={`M${BOLT.x},${BOLT.y} C${BOLT.x + 10},${110} ${negEnd.x - 80},${negEnd.y - 10} ${negEnd.x},${negEnd.y}`} fill="none" stroke="var(--c-metal-2)" strokeWidth={12} strokeLinecap="round" />
        <path d={`M${BOLT.x},${BOLT.y} C${BOLT.x + 10},${110} ${negEnd.x - 80},${negEnd.y - 10} ${negEnd.x},${negEnd.y}`} fill="none" stroke="var(--c-rubber)" strokeWidth={9} strokeLinecap="round" />
        <circle cx={negEnd.x} cy={negEnd.y} r={negLift > 0.05 ? 13 : 0} fill="var(--c-metal-2)" stroke="var(--c-rubber)" strokeWidth={3} />

        {/* camino de la corriente de cortocircuito */}
        {corto && (
          <g>
            <path
              d={`M${POS.x},${POS.y} L${TX},${POS.y} L${TX},56 L${BOLT.x},56 L${BOLT.x},${BOLT.y} C${BOLT.x + 10},110 ${NEG.x - 80},${NEG.y - 10} ${NEG.x},${NEG.y} L${POS.x},${POS.y}`}
              fill="none" stroke="var(--c-spark)" strokeWidth={5} strokeDasharray="10 9" strokeDashoffset={flow} strokeLinejoin="round" opacity={0.95}
            />
          </g>
        )}

        {/* llave combinada */}
        <g transform={`translate(${on.x} ${on.y}) rotate(${ang})`}>
          <rect x={-6} y={-8} width={WL + 6} height={16} rx={8} fill={corto ? "var(--c-hot)" : "var(--c-metal)"} stroke="var(--c-metal-dark)" strokeWidth={1.5} />
          <circle r={19} fill="none" stroke={corto ? "var(--c-hot)" : "var(--c-metal)"} strokeWidth={8} />
          <path d={`M${WL - 4},-11 L${WL + 12},-11 L${WL + 12},11 L${WL - 4},11 Z`} fill={corto ? "var(--c-hot)" : "var(--c-metal-2)"} />
        </g>

        {/* contacto */}
        {contactPt && (
          corto ? (
            <g transform={`translate(${contactPt.x} ${contactPt.y}) scale(${flick})`}>
              <path d="M0,-30 L7,-8 L28,-12 L10,3 L22,24 L0,10 L-20,26 L-10,4 L-28,-6 L-7,-8 Z" fill="var(--c-spark)" stroke="var(--c-flame)" strokeWidth={2} />
              <circle r={7} fill="#fff" />
            </g>
          ) : (
            <g>
              <circle cx={contactPt.x} cy={contactPt.y} r={9} fill="none" stroke="var(--ok)" strokeWidth={3} />
              <text x={toca === "torreta" ? 714 : contactPt.x + 16} y={contactPt.y + (toca === "torreta" ? -4 : 26)} textAnchor={toca === "torreta" ? "end" : "start"}
                style={{ fontSize: 13 * Math.min(k, 1.45), fontWeight: 800, fill: "var(--ok)", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>
                {toca === "torreta" ? (
                  <><tspan x={714} dy={0}>toca la chapa:</tspan><tspan x={714} dy={17 * Math.min(k, 1.45)}>no pasa nada</tspan></>
                ) : "toca la chapa: no pasa nada"}
              </text>
            </g>
          )
        )}
        {corto && (
          <text x={600} y={150} textAnchor="middle" style={{ fontSize: 16 * Math.min(k, 1.45), fontWeight: 900, fill: "var(--bad)", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 5 }}>
            <tspan x={630} dy={0}>¡CORTO</tspan>
            <tspan x={630} dy={20 * Math.min(k, 1.45)}>CIRCUITO!</tspan>
          </text>
        )}
        {negOut && (
          <text x={negEnd.x + 22} y={negEnd.y - 14} textAnchor="start" style={{ fontSize: 12 * Math.min(k, 1.45), fontWeight: 700, fill: "var(--text-2)", opacity: clamp(negLift * 2 - 0.4, 0, 1) }}>
            negativo afuera
          </text>
        )}
      </svg>
    </AnimFrame>
  );
}
