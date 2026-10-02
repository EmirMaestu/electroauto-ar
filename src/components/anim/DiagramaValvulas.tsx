/* Diagrama de distribución: espiral de 720° (el clásico circular) + alzada de válvulas vs ángulo,
   con el cruce sombreado y un variador VVT en la admisión. */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, useAnimClock, fmt, wrap } from "../ui/anim-kit";
import { D2R, VT, lift, liftEsc, useWide } from "./motor1-kit";

const DEG_PER_S = 80;
/** Admisión "estacionada" (variador en reposo, totalmente retrasado): abre en el PMS y cierra 60° después del PMI. */
const IO0 = 0, DUR = 240;
const ADV = 360 - 22; // avance de encendido típico a media carga, sólo para marcar la chispa

type Sit = "ralenti" | "crucero" | "torque" | "potencia";
const SITS: Record<Sit, { label: string; adv: number; text: string }> = {
  ralenti: {
    label: "Ralentí", adv: 0,
    text: "Ralentí: el variador queda en reposo (todo retrasado). Casi no hay cruce, así no vuelven gases de escape a la admisión y el motor regula parejo. Si el VVT quedara avanzado en ralentí, el motor tiembla o se apaga.",
  },
  crucero: {
    label: "Crucero", adv: 35,
    text: "Carga parcial (ruta a velocidad constante): la ECU avanza mucho la admisión. Con más cruce, parte del escape vuelve al cilindro (recirculación interna): baja la temperatura de combustión (menos NOx) y la mariposa puede abrir más (menos pérdida por bombeo). Resultado: menos consumo.",
  },
  torque: {
    label: "A fondo, pocas vueltas", adv: 25,
    text: "A fondo y bajas vueltas: la admisión cierra antes (más cerca del PMI). Así el pistón, cuando empieza a subir, no devuelve mezcla al múltiple: queda más aire atrapado y hay más torque abajo.",
  },
  potencia: {
    label: "A fondo, muchas vueltas", adv: 5,
    text: "A fondo y altas vueltas: la admisión vuelve a cerrar tarde. A esa velocidad el aire entra con tanta inercia que sigue llenando el cilindro aunque el pistón ya esté subiendo. Cerrar tarde aprovecha ese “golpe de ariete” y da más potencia arriba.",
  },
};

export function DiagramaValvulas() {
  const clock = useAnimClock({ speed: 1 });
  const [sit, setSit] = useState<Sit>("ralenti");
  const [adv, setAdv] = useState(0);
  const [stuck, setStuck] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const wide = useWide(boxRef, 600);
  const phi = wrap(clock.t * DEG_PER_S, 720);
  const real = stuck ? 0 : adv;
  const io = IO0 - real, ic = IO0 - real + DUR;
  const lI = (f: number) => lift(f, io, ic, VT.liftI);
  const overlap = Math.max(0, VT.ec - 720 - io); // grados con las dos abiertas
  const err = adv - real;

  const pick = (s: Sit) => { setSit(s); setAdv(SITS[s].adv); };

  // ======================================================== PANEL A: espiral
  const C = { x: 180, y: 194 };
  const rOf = (f: number) => 58 + (f / 720) * 64;
  const P = (f: number, dr = 0) => {
    const r = rOf(f) + dr, a = f * D2R;
    return { x: C.x + r * Math.sin(a), y: C.y - r * Math.cos(a) };
  };
  const arc = (a: number, b: number, dr: number) => {
    let d = "";
    for (let f = a; f <= b + 0.01; f += 3) { const p = P(Math.min(f, b), dr); d += `${d ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`; }
    return d;
  };
  const ioW = wrap(io, 720), icW = wrap(ic, 720);
  const intakeArcs = ioW > icW ? [[ioW, 720], [0, icW]] : [[ioW, icW]];
  const cur = P(phi);
  const spiral = (
    <g>
      <text x={8} y={14} className="svg-label">Diagrama de distribución (las 2 vueltas)</text>
      <circle cx={C.x} cy={C.y} r={rOf(720) + 22} fill="var(--surface)" stroke="var(--border)" />
      <line x1={C.x} y1={C.y - rOf(720) - 26} x2={C.x} y2={C.y + rOf(720) + 26} stroke="var(--border-strong)" strokeDasharray="3 4" />
      <text x={C.x} y={C.y - rOf(720) - 30} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>PMS</text>
      <text x={C.x} y={C.y + rOf(720) + 38} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>PMI</text>
      {/* base */}
      <path d={arc(0, 720, 0)} fill="none" stroke="var(--border-strong)" strokeWidth={2} />
      {/* compresión y explosión */}
      <path d={arc(icW, ADV, 0)} fill="none" stroke="var(--violet)" strokeWidth={6} strokeLinecap="round" opacity={0.85} />
      <path d={arc(ADV, VT.eo, 0)} fill="none" stroke="var(--c-hot)" strokeWidth={6} strokeLinecap="round" opacity={0.85} />
      {/* válvulas */}
      {intakeArcs.map(([a, b], i) => <path key={i} d={arc(a, b, -6)} fill="none" stroke="var(--c-air)" strokeWidth={6} strokeLinecap="round" />)}
      <path d={arc(VT.eo, 720, 6)} fill="none" stroke="var(--c-exhaust)" strokeWidth={6} strokeLinecap="round" />
      <path d={arc(0, VT.ec - 720, 6)} fill="none" stroke="var(--c-exhaust)" strokeWidth={6} strokeLinecap="round" />
      {/* cruce */}
      {overlap > 0 && (() => {
        const q = (f: number, r: number) => `${(C.x + r * Math.sin(f * D2R)).toFixed(1)},${(C.y - r * Math.cos(f * D2R)).toFixed(1)}`;
        const r1 = rOf(0) - 16, r2 = rOf(720) + 16, a = io, b = VT.ec - 720;
        return <path d={`M${q(a, r1)} L${q(a, r2)} A${r2},${r2} 0 0 1 ${q(b, r2)} L${q(b, r1)} A${r1},${r1} 0 0 0 ${q(a, r1)} Z`} fill="var(--warn)" opacity={0.2} />;
      })()}
      {/* chispa */}
      {(() => { const p = P(ADV); return <circle cx={p.x} cy={p.y} r={6} fill="var(--c-spark)" stroke="var(--warn)" strokeWidth={1.5} />; })()}
      {(() => { const p = P(ADV, 4); return (
        <g>
          <line x1={64} y1={58} x2={p.x - 4} y2={p.y - 4} stroke="var(--warn)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={22} y={56} style={{ fontSize: 10.5, fontWeight: 800, fill: "var(--warn)" }}>chispa</text>
        </g>
      ); })()}
      {/* marcas de los eventos */}
      {[[ioW, -6, "var(--c-air)"], [icW, -6, "var(--c-air)"], [VT.eo, 6, "var(--c-exhaust)"], [VT.ec - 720, 6, "var(--c-exhaust)"]].map(([f, dr, c], i) => {
        const a = P(f as number, (dr as number) - 8), b = P(f as number, (dr as number) + 8);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={c as string} strokeWidth={2.5} />;
      })}
      <text x={C.x} y={C.y - 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>{phi < 360 ? "1ª vuelta" : "2ª vuelta"}</text>
      <text x={C.x} y={C.y + 10} textAnchor="middle" className="svg-small">(empieza adentro)</text>
      {/* cursor */}
      <line x1={C.x} y1={C.y} x2={cur.x} y2={cur.y} stroke="var(--text)" strokeWidth={1.4} opacity={0.6} />
      <circle cx={cur.x} cy={cur.y} r={6} fill="var(--text)" stroke="var(--surface)" strokeWidth={2} />
      <text x={8} y={370} style={{ fontSize: 11, fontWeight: 800 }}>
        <tspan style={{ fill: "var(--c-air)" }}>AAA {io < 0 ? `${fmt(-io, 0)}°` : "0°"} · RCA {fmt(ic - 180, 0)}°</tspan>
        <tspan dx={14} style={{ fill: "var(--muted)" }}>AAE {fmt(540 - VT.eo, 0)}° · RCE {fmt(VT.ec - 720, 0)}°</tspan>
      </text>
      <text x={8} y={385} className="svg-small">AAA/RCA: avance a la apertura / retraso al cierre de admisión</text>
      <text x={8} y={398} className="svg-small">AAE/RCE: lo mismo para el escape (grados de cigüeñal)</text>
    </g>
  );

  // ======================================================== PANEL B: alzada vs ángulo
  // eje de 360° (PMS de encendido) a 1080° (PMS de encendido siguiente), con el PMS de cruce al medio
  const x0 = 34, x1 = 350, y0 = 60, y1 = 250;
  const mx = (f: number) => x0 + ((f - 360) / 720) * (x1 - x0);
  const my = (l: number) => y1 - (l / 10) * (y1 - y0);
  const pathL = (fn: (f: number) => number) => {
    let d = "";
    for (let f = 360; f <= 1080; f += 3) d += `${d ? "L" : "M"}${mx(f).toFixed(1)},${my(fn(f)).toFixed(1)}`;
    return d + `L${mx(1080)},${my(0)}L${mx(360)},${my(0)}Z`;
  };
  const curF = phi < 360 ? phi + 720 : phi;
  const chart = (
    <g>
      <text x={8} y={14} className="svg-label">Alzada de válvulas contra ángulo de cigüeñal</text>
      {[["EXPLOSIÓN", 360, "var(--c-hot)"], ["ESCAPE", 540, "var(--c-exhaust)"], ["ADMISIÓN", 720, "var(--c-air)"], ["COMPRESIÓN", 900, "var(--violet)"]].map(([t, f, c]) => (
        <g key={t as string}>
          <rect x={mx(f as number) + 0.5} y={26} width={mx(180 + 360) - mx(360) - 1} height={18} rx={3} fill={c as string} opacity={0.85} />
          <text x={mx((f as number) + 90)} y={39} textAnchor="middle" style={{ fontSize: 9, fontWeight: 800, fill: "#fff" }}>{t as string}</text>
        </g>
      ))}
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} rx={5} fill="var(--surface)" stroke="var(--border)" />
      {overlap > 0 && <rect x={mx(720 + io)} y={y0} width={mx(VT.ec) - mx(720 + io)} height={y1 - y0} fill="var(--warn)" opacity={0.18} />}
      <path d={pathL((f) => liftEsc(f))} fill="var(--c-exhaust)" opacity={0.4} stroke="var(--c-exhaust)" strokeWidth={2} />
      {stuck && adv > 0 && <path d={pathL((f) => lift(f, IO0 - adv, IO0 - adv + DUR, VT.liftI))} fill="none" stroke="var(--c-air)" strokeWidth={1.5} strokeDasharray="4 3" />}
      <path d={pathL(lI)} fill="var(--c-air)" opacity={0.35} stroke="var(--c-air)" strokeWidth={2} />
      {[0, 3, 6, 9].map((l) => (
        <g key={l}>
          <line x1={x0} y1={my(l)} x2={x1} y2={my(l)} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={x0 - 4} y={my(l) + 3.5} textAnchor="end" className="svg-small">{l}</text>
        </g>
      ))}
      <text x={x0 - 4} y={y0 - 4} textAnchor="end" className="svg-small">mm</text>
      {[360, 540, 720, 900, 1080].map((f, i) => (
        <g key={f}>
          <line x1={mx(f)} y1={y1} x2={mx(f)} y2={y1 + 5} stroke="var(--muted)" />
          <text x={mx(f)} y={y1 + 17} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} className="svg-small" style={{ fontWeight: 700 }}>{i % 2 ? "PMI" : i === 2 ? "PMS cruce" : "PMS"}</text>
        </g>
      ))}
      <text x={mx(615)} y={y0 + 16} textAnchor="middle" className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>escape</text>
      <text x={mx(720 + io + DUR / 2)} y={y0 + 16} textAnchor="middle" className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>admisión</text>
      {overlap > 0 && <text x={mx(720)} y={y1 - 6} textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: "var(--warn)" }}>cruce {fmt(overlap, 0)}°</text>}
      <line x1={mx(720 + ic)} y1={y1} x2={mx(720 + ic)} y2={y1 - 30} stroke="var(--c-air)" strokeWidth={1.5} />
      <text x={mx(720 + ic) + 4} y={y1 - 22} className="svg-small" style={{ fill: "var(--c-air)", fontWeight: 700 }}>cierra</text>
      <line x1={mx(curF)} y1={22} x2={mx(curF)} y2={y1} stroke="var(--text)" strokeWidth={1.4} opacity={0.7} />
      {/* variador */}
      <g transform="translate(0,282)">
        <text x={8} y={0} className="svg-label">Variador de la admisión</text>
        <rect x={8} y={10} width={344} height={14} rx={7} fill="var(--surface-2)" stroke="var(--border)" />
        <rect x={8} y={10} width={(344 * real) / 40} height={14} rx={7} fill="var(--c-air)" opacity={0.7} />
        {stuck && adv > 0 && <rect x={8 + (344 * adv) / 40 - 2} y={6} width={4} height={22} fill="var(--bad)" />}
        <text x={8} y={40} className="svg-small">retrasado (reposo)</text>
        <text x={352} y={40} textAnchor="end" className="svg-small">40° avanzado</text>
        <text x={180} y={56} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: err > 5 ? "var(--bad)" : "var(--text)" }}>
          {err > 5 ? `La ECU pide ${fmt(adv, 0)}°, el variador no se mueve → P0011` : `Objetivo ${fmt(adv, 0)}° · real ${fmt(real, 0)}°`}
        </text>
      </g>
    </g>
  );

  const W = wide ? 720 : 360, HA = 404, HB = 345;
  return (
    <AnimFrame
      title="Diagrama de distribución, cruce de válvulas y VVT"
      clock={clock}
      controls={
        <>
          <Seg value={sit} onChange={pick} ariaLabel="Situación" options={(Object.keys(SITS) as Sit[]).map((k) => ({ value: k, label: SITS[k].label }))} />
          <Slider label="Variador" value={adv} min={0} max={40} step={1} unit="°" onChange={setAdv} />
          <Toggle label="VVT trabado (aceite sucio)" checked={stuck} onChange={setStuck} />
        </>
      }
      readouts={
        <>
          <Readout label="Abre admisión" value={io === 0 ? "en el PMS" : fmt(Math.abs(io), 0)} unit={io < 0 ? "° APMS" : io > 0 ? "° DPMS" : undefined} />
          <Readout label="Cierra admisión" value={fmt(ic - 180, 0)} unit="° DPMI" />
          <Readout label="Cruce de válvulas" value={fmt(overlap, 0)} unit="°" tone={overlap > 35 ? "warn" : undefined} />
          <Readout label="Escape" value="48 / 12" unit="° AAE/RCE" />
          <Readout label="Scanner" value={err > 5 ? "P0011" : "OK"} tone={err > 5 ? "bad" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--c-air)", label: "Válvula de admisión abierta" },
        { color: "var(--c-exhaust)", label: "Válvula de escape abierta" },
        { color: "var(--violet)", label: "Compresión" },
        { color: "var(--c-hot)", label: "Explosión" },
        { color: "var(--warn)", label: "Cruce" },
      ]}
      caption={
        <>
          <p>
            Las válvulas no abren y cierran justo en los puntos muertos: el escape abre <b>antes</b> del PMI (el gas todavía tiene presión
            y sale solo) y la admisión cierra <b>después</b> del PMI (el aire que viene lanzado sigue entrando). Alrededor del PMS de cruce
            las dos están abiertas un rato: es el <b>cruce de válvulas</b>, sombreado en amarillo.
          </p>
          <p style={{ padding: ".5rem .7rem", borderLeft: "3px solid var(--c-air)", background: "var(--surface)", borderRadius: 6 }}>
            {SITS[sit].text}
          </p>
          <p>
            El variador es un rotor con paletas en el piñón de levas: la ECU comanda una electroválvula (OCV) con una señal PWM y manda
            aceite a presión a un lado o al otro de las paletas. Activá <b>VVT trabado</b>: con aceite sucio o con barro, el variador no
            sigue al objetivo y la ECU guarda un código (P0010 si es el circuito eléctrico de la OCV, P0011 si no llega a la posición).
          </p>
        </>
      }
    >
      <div ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${wide ? Math.max(HA, HB) : HA + HB}`} role="img" aria-label="Diagrama de distribución y alzada de válvulas">
          <g>{spiral}</g>
          <g transform={wide ? "translate(360,6)" : `translate(0,${HA})`}>{chart}</g>
        </svg>
      </div>
    </AnimFrame>
  );
}
