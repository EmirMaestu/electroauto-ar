/* Bobina de encendido: carga (dwell), corte y chispa. Primario y secundario en el osciloscopio.
   Modelo: rampa L/R con limitación de corriente; energía ½·L·I²; la tensión sube hasta que salta la chispa
   (tensión de ruptura), después queda la línea de quemado mientras dura la energía, y al final oscila. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Scope, useAnimClock, fmt, clamp } from "../ui/anim-kit";
import { useNarrowScreen } from "./RuedaFonica";

type Falla = "ok" | "abierta" | "corto" | "pobre";
const VB = 14, RP = 1, LP = 3, ILIM = 8, N = 60, CLAMP = 400; // V, Ω, mH, A, relación de vueltas, recorte del driver
const TC = 5.5; // ms: instante del corte (chispa) en pantalla

export function coilCurrent(tOn: number) { return Math.min(ILIM, (VB / RP) * (1 - Math.exp(-tOn / (LP / RP)))); }

function model(dwell: number, falla: Falla) {
  const ts = TC - dwell;
  const iCut = coilCurrent(dwell);
  const E = 0.5 * (LP / 1000) * iCut * iCut * 1000; // mJ
  const vAvail = 36 * Math.sqrt(E / 96); // kV disponibles
  const vFire = falla === "abierta" ? 20 : falla === "corto" ? 5 : falla === "pobre" ? 15 : 11;
  const spark = vAvail > vFire;
  const vBurn = falla === "abierta" ? 2.4 : falla === "corto" ? 0.8 : falla === "pobre" ? 2.3 : 1.5;
  const tBurn = spark ? clamp(1.6 * (E / 96) * Math.pow(1.5 / vBurn, 0.6) * (falla === "pobre" ? 0.85 : 1), 0.3, 2.6) : 0;
  const limitT = -(LP / RP) * Math.log(1 - ILIM / (VB / RP)); // ms hasta llegar al límite
  const sec = (t: number): number => {
    // kV, mostrado positivo
    if (t < ts) return 0.02 * Math.sin(t * 40);
    if (t < TC) {
      const d = t - ts;
      return -0.9 * Math.exp(-d / 0.08) * Math.cos(d * 50);
    }
    const d = t - TC;
    if (!spark) {
      // sin chispa: sube hasta lo disponible y oscila largo (la energía no se usa)
      if (d < 0.04) return vAvail * (d / 0.04);
      return vAvail * Math.exp(-(d - 0.04) / 0.5) * Math.cos((d - 0.04) * 28);
    }
    if (d < 0.025) return vFire * (d / 0.025);
    if (d < 0.07) return vFire + (vBurn - vFire) * ((d - 0.025) / 0.045);
    if (d < tBurn) {
      const f = (d - 0.07) / Math.max(0.01, tBurn - 0.07);
      const slope = falla === "pobre" ? 1.4 * f : -0.15 * f;
      return vBurn + slope + 0.08 * Math.sin(d * 140) * (falla === "pobre" ? 3 : 1);
    }
    const r = d - tBurn;
    return (vBurn + 0.6) * Math.exp(-r / 0.35) * Math.cos(r * 30 + 0.4);
  };
  const ip = (t: number): number => (t >= ts && t < TC ? coilCurrent(t - ts) : 0);
  const vp = (t: number): number => {
    if (t < ts) return VB;
    if (t < TC) return t - ts > limitT ? VB - ILIM * 0.6 : 0.9 + ip(t) * 0.12;
    const d = t - TC;
    const s = sec(t);
    // reflejo del secundario + pico de la inductancia de dispersión; el driver recorta ~400 V
    const v = VB + (s * 1000) / N + (d > 0.005 ? 110 * Math.exp(-d / 0.04) : 0);
    return Math.min(CLAMP, v);
  };
  return { sec, ip, vp, iCut, E, vAvail, vFire, spark, vBurn, tBurn, ts, limited: dwell > limitT };
}

export function Bobina() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const [dwell, setDwell] = useState(3);
  const [falla, setFalla] = useState<Falla>("ok");
  const [vista, setVista] = useState<"primario" | "secundario">("secundario");
  const m = model(dwell, falla);
  const cursor = (clock.t * 2.2) % 10;
  const iNow = m.ip(cursor);
  const charging = cursor >= m.ts && cursor < TC;
  const sparking = m.spark && cursor >= TC && cursor < TC + m.tBurn;
  const sNow = m.sec(cursor);

  // geometría
  const CX = 250; // eje del núcleo
  const fieldOp = clamp((iNow / ILIM) ** 2, 0, 1);
  const flicker = 0.75 + 0.25 * Math.sin(clock.t * 90);
  const gapW = falla === "abierta" ? 14 : 8;
  const PLX = narrow ? 410 : 520; // eje de la bujía

  return (
    <AnimFrame
      title="Bobina de encendido: carga, corte y chispa"
      clock={clock}
      controls={
        <>
          <Seg value={vista} onChange={setVista} ariaLabel="Qué medir" options={[{ value: "primario", label: "Ver primario" }, { value: "secundario", label: "Ver secundario" }]} />
          <Slider label="Tiempo de carga" value={dwell} min={0.8} max={5} step={0.1} onChange={setDwell} unit="ms" />
          <Seg value={falla} onChange={setFalla} ariaLabel="Falla" options={[
            { value: "ok", label: "Sano" }, { value: "abierta", label: "Bujía muy abierta" },
            { value: "corto", label: "Cable/bujía en corto" }, { value: "pobre", label: "Mezcla pobre" },
          ]} />
        </>
      }
      readouts={
        <>
          <Readout label="Corriente al corte" value={fmt(m.iCut, 1)} unit="A" tone={m.limited ? "ok" : m.iCut < 5 ? "warn" : undefined} />
          <Readout label="Energía ½·L·I²" value={fmt(m.E, 0)} unit="mJ" tone={m.E < 40 ? "warn" : undefined} />
          <Readout label="Disponible" value={fmt(m.vAvail, 0)} unit="kV" />
          <Readout label="Tensión de ruptura" value={m.spark ? fmt(m.vFire, 0) : "—"} unit="kV" tone={!m.spark ? "bad" : m.vFire > 15 ? "warn" : m.vFire < 7 ? "warn" : "ok"} />
          <Readout label="Línea de quemado" value={m.spark ? fmt(m.vBurn, 1) : "—"} unit="kV" />
          <Readout label="Duración de chispa" value={m.spark ? fmt(m.tBurn, 2) : "sin chispa"} unit={m.spark ? "ms" : undefined} tone={!m.spark ? "bad" : m.tBurn < 0.9 ? "warn" : "ok"} />
        </>
      }
      legend={[
        { color: "#4fb3ff", label: "Corriente de primario" },
        { color: "#ffd23f", label: "Tensión de primario" },
        { color: "#ff9a5a", label: "Secundario (kV)" },
        { color: "var(--c-elec)", label: "Campo magnético" },
      ]}
      caption={
        <>
          <p>
            Mientras la ECU <b>da masa</b> al primario (tiempo de carga o <i>dwell</i>), la corriente sube en rampa y el núcleo junta
            energía magnética (½·L·I²). Cuando <b>corta</b>, el campo se desarma de golpe: el primario salta a unos cientos de volts y el
            secundario, con unas 60 a 100 veces más vueltas, a miles. La tensión sube hasta que el aire entre los electrodos se rompe
            (<b>ruptura</b>, 8–15 kV sano) y después baja a la <b>línea de quemado</b> (1–2 kV durante 1–2 ms): esa es la chispa
            encendiendo la mezcla.
          </p>
          <p>
            Probá: con <b>poco tiempo de carga</b> no llega la energía (y con una bujía muy abierta, ni salta). <b>Bujía muy abierta</b>:
            pico alto y chispa corta. <b>Corto</b> o bujía sucia: pico bajo, quemado largo y bajo. <b>Mezcla pobre</b>: la línea de quemado
            sube inclinada porque la mezcla pobre cuesta más de mantener encendida. Si el tiempo de carga es largo, el driver limita a
            ~8 A: mirá la meseta en la corriente.
          </p>
        </>
      }
    >
      <svg viewBox={narrow ? "10 8 492 252" : "0 0 720 260"} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Esquema de bobina de encendido">
        {/* batería */}
        <text x={40} y={40} className="svg-label" style={{ fill: "var(--bad)" }}>+12 V</text>
        <path d={`M60,48 L60,70 L${CX - 40},70 L${CX - 40},82`} fill="none" stroke="var(--bad)" strokeWidth={2.5} />
        {/* núcleo */}
        <rect x={CX - 12} y={60} width={24} height={150} rx={3} fill="var(--c-metal-dark)" />
        <text x={CX - 20} y={226} textAnchor="end" className="svg-small">núcleo de hierro</text>
        {/* campo */}
        {fieldOp > 0.02 && [0, 1, 2].map((k) => (
          <ellipse key={k} cx={CX} cy={135} rx={40 + k * 16} ry={76 + k * 6} fill="none" stroke="var(--c-elec)" strokeWidth={1.5} strokeDasharray="5 4" opacity={fieldOp * (1 - k * 0.25)} />
        ))}
        {/* primario: pocas vueltas gruesas */}
        {Array.from({ length: 6 }, (_, k) => (
          <ellipse key={k} cx={CX - 20} cy={88 + k * 20} rx={10} ry={7} fill="none" stroke="var(--c-oil)" strokeWidth={4} />
        ))}
        <text x={CX - 36} y={92} textAnchor="end" className="svg-small">primario</text>
        <text x={CX - 36} y={104} textAnchor="end" className="svg-small">≈ 150 vueltas, 0,4–2 Ω</text>
        {/* secundario: muchas vueltas finas */}
        {Array.from({ length: 22 }, (_, k) => (
          <ellipse key={k} cx={CX + 20} cy={84 + k * 5.6} rx={9} ry={3} fill="none" stroke="var(--c-oil)" strokeWidth={1.2} />
        ))}
        <text x={CX + 36} y={146} className="svg-small">secundario</text>
        <text x={CX + 36} y={158} className="svg-small">≈ 10.000 vueltas</text>
        <text x={CX + 36} y={170} className="svg-small">5–15 kΩ</text>
        {/* primario → ECU */}
        <path d={`M${CX - 30},200 L${CX - 30},236 L130,236 L130,200`} fill="none" stroke={charging ? "var(--c-signal)" : "var(--c-metal-dark)"} strokeWidth={2.5} />
        {/* ECU con IGBT */}
        <rect x={20} y={110} width={150} height={90} rx={10} fill="var(--surface)" stroke="var(--c-elec)" strokeWidth={2} />
        <text x={32} y={130} className="svg-title" style={{ fill: "var(--c-elec)", fontSize: 13 }}>ECU / driver</text>
        <line x1={130} y1={200} x2={130} y2={176} stroke="var(--text-2)" strokeWidth={2} />
        <line x1={130} y1={176} x2={charging ? 130 : 146} y2={152} stroke="var(--text-2)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={130} cy={148} r={3} fill="var(--text-2)" />
        <line x1={130} y1={148} x2={130} y2={142} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <line x1={119} y1={142} x2={141} y2={142} stroke="var(--c-metal-dark)" strokeWidth={2.2} />
        <line x1={123} y1={137} x2={137} y2={137} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <line x1={127} y1={132} x2={133} y2={132} stroke="var(--c-metal-dark)" strokeWidth={1.8} />
        <text x={32} y={156} className="svg-small" style={{ fill: charging ? "var(--ok)" : "var(--muted)", fontWeight: 700 }}>{charging ? "carga: da masa" : cursor >= TC ? "cortó" : "espera"}</text>
        <text x={32} y={172} className="svg-mono" style={{ fontSize: 12, fill: "var(--primary)" }}>{fmt(iNow, 1)} A</text>
        {/* salida de alta → bujía */}
        <path d={`M${CX + 20},82 L${CX + 20},34 L${PLX},34 L${PLX},60`} fill="none" stroke="var(--c-spark)" strokeWidth={falla === "corto" ? 2 : 3} strokeDasharray={falla === "corto" ? "6 3" : undefined} />
        <text x={narrow ? 330 : 400} y={26} textAnchor="middle" className="svg-small">alta tensión → bujía</text>
        {falla === "corto" && (
          <>
            <path d={`M${PLX - 80},34 L${PLX - 74},44 L${PLX - 80},52 L${PLX - 74},60`} fill="none" stroke="var(--bad)" strokeWidth={2} />
            <line x1={PLX - 86} y1={62} x2={PLX - 68} y2={62} stroke="var(--bad)" strokeWidth={2} />
            <text x={narrow ? PLX - 80 : PLX - 120} y={80} textAnchor="middle" className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>fuga a masa</text>
            {!narrow && <text x={PLX - 120} y={93} textAnchor="middle" className="svg-small" style={{ fill: "var(--bad)" }}>(capuchón fisurado / bujía sucia)</text>}
          </>
        )}
        {/* el otro extremo del secundario va a masa */}
        <line x1={CX + 20} y1={208} x2={CX + 20} y2={232} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <line x1={CX + 9} y1={232} x2={CX + 31} y2={232} stroke="var(--c-metal-dark)" strokeWidth={2.2} />
        <line x1={CX + 13} y1={237} x2={CX + 27} y2={237} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <line x1={CX + 17} y1={242} x2={CX + 23} y2={242} stroke="var(--c-metal-dark)" strokeWidth={1.8} />
        {/* bujía (en celular se acerca a la bobina) */}
        <g transform={narrow ? `translate(${PLX - 520} 0)` : undefined}>
        <rect x={508} y={60} width={24} height={40} rx={4} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
        <rect x={500} y={100} width={40} height={30} rx={3} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <rect x={506} y={130} width={28} height={40} fill="var(--c-metal-2)" />
        {[136, 143, 150, 157, 164].map((y) => <line key={y} x1={506} y1={y} x2={534} y2={y} stroke="var(--c-metal-dark)" />)}
        <rect x={517} y={170} width={6} height={12} fill="var(--c-metal-dark)" />
        <path d={`M534,170 L540,170 L540,${182 + gapW + 6} L520,${182 + gapW + 6} L520,${182 + gapW}`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={4} />
        {sparking && (
          <g opacity={flicker}>
            <circle cx={520} cy={182 + gapW / 2} r={9} fill="var(--c-spark)" opacity={0.35} />
            <path d={`M520,182 L517,${182 + gapW * 0.35} L523,${182 + gapW * 0.6} L520,${182 + gapW}`} stroke="var(--c-spark)" strokeWidth={2.5} fill="none" />
          </g>
        )}
        <text x={552} y={190} className="svg-small">luz {falla === "abierta" ? "1,6" : "0,9"} mm</text>
        <text x={548} y={84} className="svg-small">bujía</text>
        </g>
        {/* estado */}
        {!narrow && (<>
        <rect x={580} y={60} width={128} height={120} rx={10} fill="var(--scope-bg)" />
        <text x={592} y={82} className="svg-small" style={{ fill: "#9fe3b8" }}>en el cursor</text>
        <text x={592} y={106} className="svg-mono" style={{ fontSize: 13, fill: "#4fb3ff" }}>{fmt(iNow, 1)} A</text>
        <text x={592} y={128} className="svg-mono" style={{ fontSize: 13, fill: "#ffd23f" }}>{fmt(m.vp(cursor), 0)} V</text>
        <text x={592} y={150} className="svg-mono" style={{ fontSize: 13, fill: "#ff9a5a" }}>{fmt(sNow, 1)} kV</text>
        <text x={592} y={170} className="svg-small" style={{ fill: sparking ? "#ffd23f" : "#9fe3b8", fontWeight: 700 }}>
          {sparking ? "¡CHISPA!" : charging ? "cargando" : !m.spark && cursor >= TC && cursor < TC + 1.5 ? "no saltó" : "—"}
        </text>
        </>)}
      </svg>
      <div style={{ marginTop: 8 }}>
        <Scope
          traces={vista === "primario"
            ? [
                { fn: m.ip, color: "#4fb3ff", vDiv: 2, zero: 1.1, label: "I primario A" },
                { fn: m.vp, color: "#ffd23f", vDiv: 200, zero: 5.3, label: "V primario" },
              ]
            : [{ fn: m.sec, color: "#ff9a5a", vDiv: 5, zero: 1.5, label: "Secundario kV" }]}
          msDiv={1}
          width={narrow ? 480 : 720}
          height={narrow ? 300 : 250}
          markers={[
            { ms: m.ts, label: "carga", color: "rgba(61,220,132,.7)" },
            { ms: TC, label: "corte", color: "rgba(255,120,120,.75)" },
            { ms: cursor, label: "", color: "rgba(140,200,255,.9)" },
          ]}
          label="Formas de onda de encendido"
        />
      </div>
    </AnimFrame>
  );
}
