/* Plausibilidad: cómo descubre la ECU que un sensor miente. Ejemplo: pedal de acelerador electrónico con dos pistas
   (la 2 da la mitad que la 1). Chequeos: cada pista dentro de rango y las dos coherentes entre sí. */
import { useEffect, useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, useAnimClock, fmt, clamp } from "../ui/anim-kit";
import { useNarrowScreen } from "./RuedaFonica";

type Falla = "ok" | "pista2" | "desgaste" | "masa";
const LO = 0.25, HI = 4.75, TOL = 0.25;

function tracks(p: number, falla: Falla) {
  let a1 = 0.75 + 3.1 * p;
  let a2 = a1 / 2;
  if (falla === "pista2") a2 = 0.02; // cable de la pista 2 cortado: la resistencia interna la lleva a masa
  if (falla === "desgaste" && p > 0.26 && p < 0.4) a1 = 0.75 + 3.1 * 0.12 + 0.08 * Math.sin(p * 400); // carbón gastado
  if (falla === "masa") { a1 += 0.35; a2 += 0.35; } // masa de sensores con resistencia: todo sube
  return { a1, a2 };
}

export function EcuPlausibilidad() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const [pedal, setPedal] = useState(20);
  const [falla, setFalla] = useState<Falla>("ok");
  const [latch, setLatch] = useState<null | "rango" | "correlacion">(null);
  const thr = useRef({ t: 0, ang: 3 });

  const p = pedal / 100;
  const { a1, a2 } = tracks(p, falla);
  const in1 = a1 >= LO && a1 <= HI, in2 = a2 >= LO && a2 <= HI;
  const corr = Math.abs(a1 - 2 * a2) <= TOL;
  // diagnóstico de este instante
  let now: null | "rango" | "correlacion" = null;
  if (!in1 || !in2) now = "rango";
  else if (!corr) now = "correlacion";
  const estado = latch === "correlacion" || now === "correlacion" ? "correlacion" : latch === "rango" || now === "rango" ? "rango" : null;
  // la falla queda memorizada hasta el próximo ciclo de llave
  useEffect(() => {
    if (now && latch !== "correlacion" && now !== latch) setLatch(now);
  }, [now, latch]);
  // pedido de apertura de mariposa
  const pUsado = estado === "rango" ? (in1 ? (a1 - 0.75) / 3.1 : (2 * a2 - 0.75) / 3.1) : p;
  let target = 3 + clamp(pUsado, 0, 1) * 85;
  if (estado === "rango") target = 3 + Math.min(clamp(pUsado, 0, 1), 0.35) * 85;
  if (estado === "correlacion") target = 7;
  // mariposa con un poco de retardo (motor eléctrico + resorte); en emergencia, más lenta
  const T = thr.current;
  const dt = clamp(clock.t - T.t, 0, 0.1);
  T.t = clock.t;
  T.ang += (target - T.ang) * Math.min(1, dt / (estado === "rango" ? 0.8 : 0.12));
  const ang = T.ang;
  const codigo = estado === "correlacion" ? "P2138 · correlación pedal D/E"
    : estado === "rango" ? (!in2 ? (a2 < LO ? "P2127 · pista E baja" : "P2128 · pista E alta") : !in1 ? (a1 < LO ? "P2122 · pista D baja" : "P2123 · pista D alta") : "memorizado")
    : "—";
  const decision = estado === "correlacion" ? ["No sabe cuál miente: ignora el", "pedal y deja el ralentí acelerado"]
    : estado === "rango" ? ["Usa la pista sana, con apertura", "limitada y lenta"]
    : ["Pedal válido: abre la mariposa", "lo que pide el pie"];

  // geometría
  const PX = 70, PY = 70; // bisagra del pedal
  const pedAng = 18 + p * 22; // grados desde la vertical
  const padX = PX + 150 * Math.sin((pedAng * Math.PI) / 180), padY = PY + 150 * Math.cos((pedAng * Math.PI) / 180);
  const GX0 = 200, GX1 = 430, GY0 = 40, GY1 = 250;
  const mx = (pp: number) => GX0 + pp * (GX1 - GX0);
  const my = (v: number) => GY1 - (clamp(v, 0, 5) / 5) * (GY1 - GY0);
  const ok = (b: boolean) => (b ? "var(--ok)" : "var(--bad)");
  const check = (b: boolean) => (b ? "✓" : "✗");

  return (
    <AnimFrame
      title="Plausibilidad: cómo se da cuenta la ECU de que un sensor miente"
      clock={clock}
      controls={
        <>
          <Slider label="Pedal" value={pedal} min={0} max={100} step={1} onChange={setPedal} unit="%" />
          <Seg value={falla} onChange={(f) => { setFalla(f); }} ariaLabel="Falla" options={[
            { value: "ok", label: "Sano" }, { value: "pista2", label: "Pista 2 cortada" },
            { value: "desgaste", label: "Pista 1 gastada" }, { value: "masa", label: "Masa floja" },
          ]} />
          <button className="btn ghost sm" onClick={() => setLatch(null)}>Apagar y prender (ciclo de llave)</button>
        </>
      }
      readouts={
        <>
          <Readout label="Pista 1 (D)" value={fmt(a1, 2)} unit="V" tone={in1 ? undefined : "bad"} />
          <Readout label="Pista 2 (E)" value={fmt(a2, 2)} unit="V" tone={in2 ? undefined : "bad"} />
          <Readout label="P1 − 2 × P2" value={fmt(a1 - 2 * a2, 2)} unit="V" tone={corr ? "ok" : "bad"} />
          <Readout label="Mariposa" value={fmt(ang, 0)} unit="%" />
          <Readout label="Código" value={<span style={{ fontSize: ".78rem" }}>{codigo}</span>} tone={estado ? "bad" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Pista 1 (0,75 → 3,85 V)" },
        { color: "var(--primary)", label: "Pista 2 (la mitad)" },
        { color: "var(--bad)", label: "Fuera de rango" },
      ]}
      caption={
        <>
          <p>
            El pedal electrónico tiene <b>dos sensores en uno</b>, cada uno con su 5 V, su masa y su señal. La pista 2 da siempre la
            mitad que la 1. La ECU hace dos preguntas todo el tiempo: <b>¿cada señal está dentro de lo posible?</b> (entre ~0,25 y 4,75 V;
            afuera sólo puede ser un cable cortado o en corto) y <b>¿las dos cuentan la misma historia?</b> Si una se va de rango, usa la
            otra con la potencia limitada. Si las dos están en rango pero no coinciden, no puede saber cuál miente: ignora el pedal.
          </p>
          <p>
            Probá <b>Pista 1 gastada</b> y pasá el pedal por 30 %: la falla aparece y queda <b>memorizada</b> aunque sigas acelerando bien;
            vuelve a la normalidad recién con el <b>ciclo de llave</b>. La <b>masa floja</b> es traicionera: sube las dos señales lo
            mismo y rompe la proporción. Moraleja: antes de cambiar el pedal, medí 5 V y masa en la ficha.
          </p>
        </>
      }
    >
      <svg viewBox={narrow ? "0 10 450 590" : "0 0 720 290"} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Pedal con dos pistas y chequeos de la ECU">
        {/* pedal */}
        <rect x={PX - 26} y={PY - 30} width={52} height={36} rx={8} fill="var(--c-rubber)" />
        <text x={PX + 32} y={PY - 2} className="svg-small">sensor doble</text>
        <line x1={PX} y1={PY} x2={padX} y2={padY} stroke="var(--c-metal-dark)" strokeWidth={8} strokeLinecap="round" />
        <rect x={padX - 26} y={padY - 8} width={52} height={22} rx={6} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)"
          transform={`rotate(${-pedAng + 90} ${padX} ${padY})`} />
        <circle cx={PX} cy={PY} r={8} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
        <text x={PX + 4} y={258} textAnchor="middle" className="svg-small">pedal {fmt(pedal, 0)} %</text>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <line key={k} x1={PX - 15 + k * 6} y1={PY - 30} x2={PX - 15 + k * 6} y2={12}
            stroke={k % 3 === 0 ? "var(--bad)" : k % 3 === 1 ? "var(--c-signal)" : "var(--c-metal-dark)"} strokeWidth={1.4}
            strokeDasharray={falla === "pista2" && k === 4 ? "3 4" : undefined} />
        ))}
        <text x={PX + 26} y={18} className="svg-small">6 cables: 2 × (5 V,</text>
        <text x={PX + 26} y={31} className="svg-small">señal y masa)</text>

        {/* gráfico de las dos pistas */}
        <rect x={GX0} y={GY0} width={GX1 - GX0} height={GY1 - GY0} fill="var(--surface)" stroke="var(--border)" rx={6} />
        <rect x={GX0} y={GY0} width={GX1 - GX0} height={my(HI) - GY0} fill="var(--bad)" opacity={0.1} />
        <rect x={GX0} y={my(LO)} width={GX1 - GX0} height={GY1 - my(LO)} fill="var(--bad)" opacity={0.1} />
        {[0, 1, 2, 3, 4, 5].map((v) => (
          <text key={v} x={GX0 - 5} y={my(v) + 4} textAnchor="end" className="svg-small">{v} V</text>
        ))}
        <line x1={mx(0)} y1={my(0.75)} x2={mx(1)} y2={my(3.85)} stroke="var(--accent)" strokeWidth={2} opacity={0.45} />
        <line x1={mx(0)} y1={my(0.375)} x2={mx(1)} y2={my(1.925)} stroke="var(--primary)" strokeWidth={2} opacity={0.45} />
        <line x1={mx(p)} y1={GY0} x2={mx(p)} y2={GY1} stroke="var(--text)" opacity={0.3} />
        {!corr && in1 && in2 && (
          <>
            <circle cx={mx(p)} cy={my(2 * a2)} r={6} fill="none" stroke="var(--primary)" strokeDasharray="2 2" strokeWidth={1.5} />
            <line x1={mx(p)} y1={my(2 * a2)} x2={mx(p)} y2={my(a1)} stroke="var(--bad)" strokeWidth={2} />
          </>
        )}
        <circle cx={mx(p)} cy={my(a1)} r={6} fill={in1 ? "var(--accent)" : "var(--bad)"} stroke="var(--surface)" strokeWidth={2} />
        <circle cx={mx(p)} cy={my(a2)} r={6} fill={in2 ? "var(--primary)" : "var(--bad)"} stroke="var(--surface)" strokeWidth={2} />
        <text x={GX0} y={GY1 + 16} className="svg-small">suelto</text>
        <text x={GX1} y={GY1 + 16} textAnchor="end" className="svg-small">a fondo</text>
        <text x={GX1} y={GY0 - 8} textAnchor="end" className="svg-small">tensión de cada pista</text>

        {/* ECU */}
        <g transform={narrow ? "translate(-440 300)" : undefined}>
          <rect x={460} y={20} width={250} height={262} rx={12} fill="var(--surface)" stroke="var(--c-elec)" strokeWidth={2} />
          <text x={476} y={44} className="svg-title" style={{ fill: "var(--c-elec)" }}>ECU: chequeos</text>
          {[
            { t: "Pista 1 entre 0,25 y 4,75 V", b: in1 },
            { t: "Pista 2 entre 0,25 y 4,75 V", b: in2 },
            { t: "Pista 1 ≈ 2 × pista 2 (±0,25 V)", b: corr },
          ].map((c, i) => (
            <g key={i}>
              <text x={478} y={72 + i * 22} className="svg-label" style={{ fill: ok(c.b) }}>{check(c.b)}</text>
              <text x={496} y={72 + i * 22} className="svg-small" style={{ fill: "var(--text-2)" }}>{c.t}</text>
            </g>
          ))}
          <line x1={474} y1={128} x2={696} y2={128} stroke="var(--border)" />
          <text x={476} y={148} className="svg-label" style={{ fill: estado ? "var(--bad)" : "var(--ok)" }}>
            {estado === "correlacion" ? "Modo de emergencia" : estado === "rango" ? "Modo degradado" : "Todo coherente"}
          </text>
          <text x={476} y={166} className="svg-small" style={{ fill: "var(--text-2)" }}>{decision[0]}</text>
          <text x={476} y={179} className="svg-small" style={{ fill: "var(--text-2)" }}>{decision[1]}</text>
          {latch && !now && <text x={476} y={198} className="svg-small" style={{ fill: "var(--warn)" }}>falla memorizada hasta el ciclo de llave</text>}
          {/* mariposa */}
          <rect x={540} y={212} width={84} height={44} fill="var(--c-air)" opacity={0.12} />
          <line x1={540} y1={212} x2={624} y2={212} stroke="var(--c-metal-dark)" strokeWidth={4} />
          <line x1={540} y1={256} x2={624} y2={256} stroke="var(--c-metal-dark)" strokeWidth={4} />
          <line x1={582 - 21 * Math.sin((ang * 0.9 * Math.PI) / 180)} y1={234 + 21 * Math.cos((ang * 0.9 * Math.PI) / 180)} x2={582 + 21 * Math.sin((ang * 0.9 * Math.PI) / 180)} y2={234 - 21 * Math.cos((ang * 0.9 * Math.PI) / 180)}
            stroke="var(--c-metal)" strokeWidth={5} strokeLinecap="round" />
          <circle cx={582} cy={234} r={3} fill="var(--c-metal-dark)" />
          <text x={630} y={226} className="svg-small">mariposa</text>
          <text x={630} y={240} className="svg-mono" style={{ fontSize: 12 }}>{fmt(ang, 0)} %</text>
          {estado && (
            <g>
              <circle cx={500} cy={234} r={14} fill="var(--warn)" opacity={0.25 + 0.75 * (Math.sin(clock.t * 6) > 0 ? 1 : 0.4)} />
              <text x={500} y={239} textAnchor="middle" className="svg-label" style={{ fill: "var(--text)" }}>!</text>
              <text x={500} y={264} textAnchor="middle" className="svg-small">testigo</text>
            </g>
          )}
        </g>
      </svg>
    </AnimFrame>
  );
}
