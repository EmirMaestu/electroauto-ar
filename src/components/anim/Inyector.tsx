/* Inyector de nafta (solenoide de alta impedancia) comandado por masa desde la ECU.
   Corriente: rampa L/R; al cortar, la bobina genera un pico que el driver recorta (~65 V);
   la "jorobita" posterior es la aguja cerrando. Todo en tiempo real; el dibujo va en cámara lenta. */
import { useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Scope, useAnimClock, fmt, clamp, springPath } from "../ui/anim-kit";
import { useNarrowScreen } from "./RuedaFonica";

type Falla = "ok" | "tapado" | "corto" | "flojo";

/** Tiempo muerto del inyector (ms) según la tensión de batería */
export function deadTime(vbat: number) { return 0.9 * Math.pow(14 / vbat, 1.6); }

const T0 = 2; // ms donde arranca el pulso en la pantalla
const WIN = 20; // ms de ventana (2 ms/div)
const VZ = 65; // tensión de recorte del driver

function model(falla: Falla, vbat: number, pw: number, cycleOdd: boolean) {
  const R = falla === "corto" ? 4 : 14;
  const L = falla === "corto" ? 3 : 12; // mH
  const tau = L / R; // ms
  const T1 = T0 + pw;
  const iMax = vbat / (R + 0.3);
  const brk = falla === "flojo" && cycleOdd ? [T0 + pw * 0.35, T0 + pw * 0.55] : null;
  const iAt = (t: number): number => {
    if (t < T0) return 0;
    if (t < T1) {
      if (brk && t >= brk[0]) {
        if (t < brk[1]) {
          const i0 = iAt(brk[0] - 1e-6);
          return Math.max(0, i0 * (1 - (t - brk[0]) / 0.05));
        }
        return iMax * (1 - Math.exp(-(t - brk[1]) / tau));
      }
      let i = iMax * (1 - Math.exp(-(t - T0) / tau));
      if (falla !== "corto") {
        const tOpen = T0 + 0.75;
        const d = (t - tOpen) / 0.18;
        i -= 0.07 * iMax * Math.exp(-d * d); // la aguja se mueve: cambia la inductancia
      }
      return i;
    }
    const i1 = iAt(T1 - 1e-6);
    // con espiras en corto, la energía se va por las espiras cortocircuitadas: decae solo, sin pico
    if (falla === "corto") return i1 * Math.exp(-(t - T1) / 0.08);
    const tFall = (L * i1) / (VZ - vbat); // ms
    return t < T1 + tFall ? i1 * (1 - (t - T1) / tFall) : 0;
  };
  const vAt = (t: number): number => {
    if (t < T0) return vbat;
    if (t < T1) {
      if (brk && t >= brk[0] && t < brk[1]) return 0.2 + 0.4 * Math.abs(Math.sin(t * 90));
      return 0.3 + iAt(t) * 0.25;
    }
    const dt = t - T1;
    if (falla === "corto") return vbat + 4 * Math.exp(-dt / 0.12) * (dt < 0.02 ? dt / 0.02 : 1);
    const i1 = iAt(T1 - 1e-6);
    const vClamp = VZ;
    const tFall = (L * i1) / (vClamp - vbat);
    if (dt < 0.03) return vbat + (vClamp - vbat) * (dt / 0.03);
    if (dt < tFall) return vClamp - 2 * (dt / tFall);
    const dt2 = dt - tFall;
    let v = vbat + (vClamp - vbat) * 0.12 * Math.exp(-dt2 / 0.05) * Math.cos(dt2 * 60);
    const d = (dt - 0.65) / 0.12;
    v += 3.2 * Math.exp(-d * d); // jorobita: la aguja apoya en el asiento
    return v;
  };
  // carrera de la aguja (0..1)
  const liftAt = (t: number): number => {
    if (falla === "corto") {
      // con espiras en corto la fuerza magnética es débil: abre tarde y poco
      if (t < T0 + 1.2 || t > T1 + 0.2) return 0;
      return 0.55 * clamp((t - T0 - 1.2) / 0.3, 0, 1);
    }
    if (brk && t > brk[0] + 0.15 && t < brk[1] + 0.8) return 0;
    if (t < T0 + 0.65 || t > T1 + 0.7) return 0;
    const up = clamp((t - T0 - 0.65) / 0.2, 0, 1);
    const down = clamp((T1 + 0.7 - t) / 0.2, 0, 1);
    return Math.min(up, down);
  };
  return { iAt, vAt, liftAt, T1, iMax, R };
}

export function Inyector() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const [rpm, setRpm] = useState(800);
  const [carga, setCarga] = useState(20);
  const [vbat, setVbat] = useState(14);
  const [falla, setFalla] = useState<Falla>("ok");

  const td = deadTime(vbat);
  const tEff = (carga / 100) * 11.5; // ms de inyección "útil" (la nafta que pide la carga)
  const pw = tEff + td;
  const cicloMs = 120000 / rpm; // 2 vueltas = un ciclo de 4 tiempos
  const duty = (pw / cicloMs) * 100;
  const flow = falla === "tapado" ? 1.8 : 3.0; // mg por ms de apertura
  const cursor = (clock.t * 5) % WIN; // 5 ms de señal por segundo de animación
  const cycleOdd = Math.floor((clock.t * 5) / WIN) % 2 === 1;
  const m = model(falla, vbat, pw, cycleOdd);
  const lift = m.liftAt(cursor);
  const on = cursor >= T0 && cursor < m.T1 && !(falla === "flojo" && cycleOdd && cursor > T0 + pw * 0.35 && cursor < T0 + pw * 0.55);
  const iNow = m.iAt(cursor);
  const mg = falla === "corto" ? Math.max(0, pw - 1.4) * flow * 0.55 : falla === "flojo" ? tEff * flow * 0.8 : tEff * flow;
  const vPeak = falla === "corto" ? vbat + 4 : VZ;
  const iPeak = m.iAt(m.T1 - 1e-6);

  // dibujo
  const IX = 120; // eje del inyector
  const needleUp = lift * 7;
  const sprayK = lift * (falla === "tapado" ? 0.45 : 1);

  return (
    <AnimFrame
      title="Inyector: pulso de la ECU, corriente y pico inductivo"
      clock={clock}
      controls={
        <>
          <Slider label="RPM" value={rpm} min={700} max={6500} step={50} onChange={setRpm} />
          <Slider label="Carga" value={carga} min={10} max={100} step={1} onChange={setCarga} unit="%" />
          <Slider label="Batería" value={vbat} min={11} max={14.5} step={0.1} onChange={setVbat} unit="V" />
          <Seg value={falla} onChange={setFalla} ariaLabel="Falla" options={[
            { value: "ok", label: "Sano" }, { value: "tapado", label: "Tapado" },
            { value: "corto", label: "Bobina en corto" }, { value: "flojo", label: "Ficha floja" },
          ]} />
        </>
      }
      readouts={
        <>
          <Readout label="Ancho de pulso" value={fmt(pw, 2)} unit="ms" tone="accent" />
          <Readout label="Tiempo muerto" value={fmt(td, 2)} unit="ms" />
          <Readout label="Ciclo de trabajo" value={fmt(duty, 0)} unit="%" tone={duty > 85 ? "bad" : undefined} />
          <Readout label="Corriente máx." value={fmt(iPeak, 2)} unit="A" tone={falla === "corto" ? "bad" : undefined} />
          <Readout label="Pico al cerrar" value={fmt(vPeak, 0)} unit="V" tone={falla === "corto" ? "bad" : "ok"} />
          <Readout label="Nafta por pulso" value={fmt(mg, 1)} unit="mg" tone={falla === "ok" ? undefined : "warn"} />
        </>
      }
      legend={[
        { color: "#ffd23f", label: "Tensión en el pin de la ECU" },
        { color: "#4fb3ff", label: "Corriente por el inyector" },
        { color: "var(--c-fuel)", label: "Nafta" },
        { color: "var(--c-oil)", label: "Bobina" },
      ]}
      caption={
        <>
          <p>
            El inyector tiene <b>12 V permanentes</b> y la ECU lo abre <b>dándole masa</b> con un transistor (driver de lado bajo): por
            eso la tensión cae casi a 0 mientras inyecta. La corriente no sube de golpe: la bobina la frena (rampa L/R) y la aguja recién
            se despega cuando hay suficiente fuerza; ese retraso es el <b>tiempo muerto</b>, y crece con la batería baja. Al cortar, el
            campo se desarma y genera un <b>pico de ~65 V</b>; la jorobita de después es la aguja apoyando en el asiento.
          </p>
          <p>
            Fijate que el <b>ancho de pulso lo decide la carga</b> (aire por ciclo); las rpm cambian cuántas veces por segundo inyecta,
            o sea el <b>ciclo de trabajo</b>. Un inyector <b>tapado</b> da una señal perfecta y menos nafta: el osciloscopio no lo ve,
            hay que medir caudal. Con <b>espiras en corto</b>, la corriente se dispara y el pico desaparece. Con la <b>ficha floja</b>, mirá
            cómo cada tanto el pulso se corta a la mitad.
          </p>
        </>
      }
    >
      <svg viewBox={narrow ? "0 0 440 480" : "0 0 720 260"} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Corte de un inyector y su circuito">
        {/* entrada de nafta y filtro */}
        <rect x={IX - 13} y={8} width={26} height={44} rx={4} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <rect x={IX - 6} y={8} width={12} height={150} fill="var(--c-fuel)" opacity={0.75} />
        {[14, 20, 26].map((y) => <line key={y} x1={IX - 6} y1={y} x2={IX + 6} y2={y} stroke="var(--c-metal-dark)" strokeWidth={0.8} />)}
        <ellipse cx={IX} cy={44} rx={17} ry={4} fill="var(--c-rubber)" />
        <text x={IX + 22} y={22} className="svg-small">nafta a 3–4 bar</text>
        {/* cuerpo */}
        <rect x={IX - 34} y={52} width={68} height={112} rx={8} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
        {/* bobina (dos lados del corte) */}
        {[0, 1].map((side) => (
          <g key={side}>
            <rect x={side ? IX + 10 : IX - 28} y={62} width={18} height={56} fill="var(--c-oil)" opacity={0.95} />
            {[0, 1, 2, 3, 4, 5, 6].map((k) => (
              <line key={k} x1={side ? IX + 10 : IX - 28} y1={66 + k * 7.5} x2={side ? IX + 28 : IX - 10} y2={66 + k * 7.5} stroke="var(--c-metal-dark)" strokeWidth={0.8} opacity={0.6} />
            ))}
          </g>
        ))}
        {/* campo magnético cuando circula corriente */}
        {iNow > 0.05 && [0, 1].map((side) => (
          <ellipse key={side} cx={side ? IX + 19 : IX - 19} cy={92} rx={15} ry={36} fill="none" stroke="var(--c-elec)" strokeWidth={1.4}
            strokeDasharray="4 3" opacity={clamp(iNow / m.iMax, 0.15, 1)} />
        ))}
        {/* resorte + inducido + aguja */}
        <path d={springPath(IX, 56, 78 - needleUp, 5, 4)} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1.6} />
        <rect x={IX - 7} y={78 - needleUp} width={14} height={34} rx={2} fill="var(--c-metal-dark)" />
        <rect x={IX - 2.5} y={112 - needleUp} width={5} height={52} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={0.6} />
        <circle cx={IX} cy={166 - needleUp} r={4} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
        {/* asiento y tobera */}
        <path d={`M${IX - 20},164 L${IX - 5},172 L${IX + 5},172 L${IX + 20},164 L${IX + 20},178 L${IX - 20},178 Z`} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" />
        <rect x={IX - 3} y={170} width={6} height={10} fill={lift > 0.2 ? "var(--c-fuel)" : "var(--c-metal-dark)"} />
        {/* conector */}
        <rect x={IX + 34} y={70} width={30} height={36} rx={4} fill="var(--c-rubber)" />
        <text x={IX + 49} y={64} textAnchor="middle" className="svg-small">ficha</text>
        {/* spray */}
        {sprayK > 0.05 && (
          <g opacity={0.25 + 0.75 * sprayK}>
            <path d={`M${IX - 3},180 L${IX - 3 - 34 * sprayK},${180 + 64 * sprayK} Q${IX},${190 + 70 * sprayK} ${IX + 3 + 34 * sprayK},${180 + 64 * sprayK} L${IX + 3},180 Z`} fill="var(--c-fuel)" opacity={0.35} />
            {Array.from({ length: Math.round(16 * sprayK) + 2 }, (_, k) => {
              const a = ((k * 37) % 50) / 50 - 0.5;
              const r = 12 + ((k * 53 + clock.t * 90) % (60 * sprayK + 1));
              return <circle key={k} cx={IX + a * r * 1.05} cy={182 + r} r={1.6} fill="var(--c-fuel)" />;
            })}
          </g>
        )}
        {falla === "tapado" && <text x={IX + 40} y={214} className="svg-small" style={{ fill: "var(--warn)", fontWeight: 700 }}>tobera con barniz: chorro pobre</text>}
        <text x={IX + 52} y={248} className="svg-small">carrera real ≈ 0,1 mm (acá exagerada)</text>

        {/* circuito */}
        <text x={250} y={34} className="svg-label" style={{ fill: "var(--bad)" }}>+12 V (relé principal)</text>
        <path d={`M${IX + 64},80 L250,80 L250,42`} fill="none" stroke="var(--bad)" strokeWidth={2.5} />
        <path d={narrow ? `M${IX + 64},96 L214,96 L214,262 L110,262 L110,336 L130,336` : `M${IX + 64},96 L430,96`} fill="none" stroke={on ? "var(--c-signal)" : "var(--c-metal-dark)"} strokeWidth={2.5} />
        <text x={narrow ? 222 : 262} y={narrow ? 150 : 90} className="svg-small">comando: masa por pulsos</text>
        {/* ECU (en celular va abajo) */}
        <g transform={narrow ? "translate(-300 240)" : undefined}>
        <rect x={430} y={30} width={276} height={200} rx={12} fill="var(--surface)" stroke="var(--c-elec)" strokeWidth={2} />
        <text x={446} y={52} className="svg-title" style={{ fill: "var(--c-elec)" }}>ECU</text>
        <text x={500} y={52} className="svg-small">driver de lado bajo</text>
        {/* MOSFET como llave */}
        <line x1={430} y1={96} x2={520} y2={96} stroke={on ? "var(--c-signal)" : "var(--c-metal-dark)"} strokeWidth={2.5} />
        <line x1={520} y1={96} x2={520} y2={118} stroke="var(--text-2)" strokeWidth={2} />
        <line x1={520} y1={118} x2={on ? 520 : 536} y2={146} stroke="var(--text-2)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={520} cy={150} r={3} fill="var(--text-2)" />
        <line x1={520} y1={150} x2={520} y2={196} stroke="var(--c-metal-dark)" strokeWidth={2.5} />
        <line x1={506} y1={196} x2={534} y2={196} stroke="var(--c-metal-dark)" strokeWidth={2.5} />
        <line x1={511} y1={202} x2={529} y2={202} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <text x={546} y={138} className="svg-label" style={{ fill: on ? "var(--ok)" : "var(--muted)" }}>{on ? "CONDUCE: da masa" : "ABIERTO"}</text>
        <text x={546} y={154} className="svg-small">{on ? "→ el inyector abre" : "→ el inyector cierra"}</text>
        {/* zener de recorte */}
        <line x1={470} y1={96} x2={470} y2={170} stroke="var(--text-2)" strokeWidth={1.4} strokeDasharray="3 2" />
        <polygon points="462,140 478,140 470,152" fill="var(--violet)" />
        <line x1={460} y1={152} x2={480} y2={152} stroke="var(--violet)" strokeWidth={2} />
        <line x1={470} y1={170} x2={520} y2={170} stroke="var(--text-2)" strokeWidth={1.4} strokeDasharray="3 2" />
        <text x={444} y={190} className="svg-small">recorte</text>
        <text x={444} y={203} className="svg-small">~65 V</text>
        {/* mini readout del instante */}
        <rect x={570} y={172} width={124} height={46} rx={8} fill="var(--scope-bg)" />
        <text x={580} y={190} className="svg-mono" style={{ fontSize: 11, fill: "#ffd23f" }}>{fmt(m.vAt(cursor), 1)} V</text>
        <text x={580} y={208} className="svg-mono" style={{ fontSize: 11, fill: "#4fb3ff" }}>{fmt(iNow, 2)} A</text>
        <text x={640} y={190} className="svg-small" style={{ fill: "#9fe3b8" }}>en el</text>
        <text x={640} y={208} className="svg-small" style={{ fill: "#9fe3b8" }}>cursor</text>
        </g>
      </svg>
      <div style={{ marginTop: 8 }}>
        <Scope
          traces={[
            { fn: m.vAt, color: "#ffd23f", vDiv: 20, zero: 3.8, label: "Tensión V" },
            { fn: m.iAt, color: "#4fb3ff", vDiv: falla === "corto" ? 1 : 0.5, zero: 1.2, label: "Corriente A" },
          ]}
          msDiv={2}
          width={narrow ? 480 : 720}
          height={narrow ? 300 : 260}
          markers={[
            { ms: T0, label: "ECU da masa", color: "rgba(61,220,132,.7)" },
            { ms: Math.min(m.T1, 19.5), label: "corta", color: "rgba(255,120,120,.7)" },
            { ms: cursor, label: "", color: "rgba(140,200,255,.9)" },
          ]}
          label="Tensión y corriente del inyector"
        />
      </div>
    </AnimFrame>
  );
}
