/* Avance de encendido: presión en el cilindro vs ángulo de cigüeñal.
   Modelo de una zona (primera ley + gas ideal) con liberación de calor tipo Wiebe, para un 1.6 a plena carga.
   La detonación se aproxima por un límite de presión pico que depende del octanaje y de las rpm. */
import { useId, useMemo, useRef, useState } from "react";
import { AnimFrame, Readout, Slider, Toggle, useAnimClock, fmt, clamp } from "../ui/anim-kit";
import { useNarrowScreen, narrowFonts } from "./RuedaFonica";

const BORE = 0.0795, STROKE = 0.0805, ROD = 0.129, CR = 10.5;
const AP = (Math.PI / 4) * BORE * BORE, VD = AP * STROKE, VC = VD / (CR - 1), RC = STROKE / 2;
const vol = (d: number) => {
  const t = (d * Math.PI) / 180, s = Math.sin(t), c = Math.cos(t);
  return VC + AP * (RC * (1 - c) + ROD - Math.sqrt(ROD * ROD - RC * RC * s * s));
};
const H = 0.5;

/** Simula compresión + combustión + expansión. Devuelve presión [bar] cada 0,5° de −180 a +180. */
export function burnCycle(adv: number, rpm: number, fire = true) {
  const delay = 6 + rpm / 1000, dur = 38 + (3 * rpm) / 1000, th0 = -adv + delay;
  const wb = (th: number) => (!fire || th <= th0 ? 0 : 1 - Math.exp(-5 * Math.pow((th - th0) / dur, 3)));
  const Q = 900, g = 1.3;
  let p = 1e5, W = 0, pmax = 0, thmax = 0;
  const ps: number[] = [], xs: number[] = [];
  for (let th = -180; th < 180; th += H) {
    const V1 = vol(th), V2 = vol(th + H), dV = V2 - V1, dQ = Q * (wb(th + H) - wb(th));
    const pn = p + (-g * p * dV + (g - 1) * dQ) / ((V1 + V2) / 2);
    W += ((p + pn) / 2) * dV;
    p = pn;
    ps.push(p / 1e5); xs.push(wb(th + H));
    if (p > pmax) { pmax = p; thmax = th + H; }
  }
  const iEvo = Math.round((130 + 180) / H);
  const tEvo = (ps[iEvo] * 1e5 * vol(130)) / (4.53e-4 * 287) - 273;
  return { ps, xs, W, pmax: pmax / 1e5, thmax, tEvo, th0 };
}
const idx = (th: number) => clamp(Math.round((th + 180) / H) - 1, 0, 719);

export function AvanceEncendido() {
  const clock = useAnimClock({ speed: 1 });
  const narrow = useNarrowScreen();
  const [adv, setAdv] = useState(20);
  const [rpm, setRpm] = useState(2500);
  const [bajoOct, setBajoOct] = useState(false);
  const [knockCtl, setKnockCtl] = useState(true);
  const ctl = useRef({ cycle: -1, retard: 0, lastKnock: -10 });

  const pKnock = (bajoOct ? 45 : 62) + 2.5 * (rpm / 1000);
  const mbt = useMemo(() => {
    let best = { a: 0, W: 0 };
    for (let a = 0; a <= 55; a++) { const c = burnCycle(a, rpm); if (c.W > best.W) best = { a, W: c.W }; }
    return best;
  }, [rpm]);
  const motoring = useMemo(() => burnCycle(0, rpm, false), [rpm]);
  const tEvoMbt = useMemo(() => burnCycle(mbt.a, rpm).tEvo, [mbt.a, rpm]);
  const clipId = "clip-av-" + useId().replace(/[^a-zA-Z0-9_-]/g, "");

  // control de detonación: un evento de combustión cada 0,6 s de animación
  const CYC = 0.6;
  const cycleN = Math.floor(clock.t / CYC);
  const C = ctl.current;
  if (cycleN < C.cycle) { C.cycle = -1; C.retard = 0; }
  while (C.cycle < cycleN) {
    C.cycle++;
    const eff = Math.max(0, adv - (knockCtl ? C.retard : 0));
    const r = burnCycle(eff, rpm);
    if (r.pmax > pKnock) { C.lastKnock = C.cycle; if (knockCtl) C.retard += 3; }
    else if (knockCtl) C.retard = Math.max(0, C.retard - 0.75);
    if (cycleN - C.cycle > 200) C.cycle = cycleN - 1;
  }
  if (!knockCtl) C.retard = 0;
  const effAdv = Math.max(0, adv - C.retard);
  const cyc = useMemo(() => burnCycle(effAdv, rpm), [effAdv, rpm]);
  const knock = cyc.pmax > pKnock;
  const kInt = knock ? cyc.pmax - pKnock : 0;
  const torque = (cyc.W / mbt.W) * 100;
  const phase = (clock.t % CYC) / CYC; // dentro del evento actual
  const thNow = -70 + phase * 170;

  // gráfico
  const GX0 = 56, GX1 = 560, GY0 = 30, GY1 = narrow ? 250 : 220;
  const TH0 = -60, TH1 = 90, PMAX = 90;
  const mx = (th: number) => GX0 + ((th - TH0) / (TH1 - TH0)) * (GX1 - GX0);
  const my = (p: number) => GY1 - (clamp(p, 0, PMAX) / PMAX) * (GY1 - GY0);
  const kPer = (6 * rpm) / 6500; // grados por período de la vibración de detonación (~6,5 kHz)
  const pressAt = (th: number) => {
    let p = cyc.ps[idx(th)];
    if (knock && th > cyc.thmax - 1) {
      const d = th - cyc.thmax + 1;
      p += (2 + kInt * 0.9) * Math.exp(-d / 14) * Math.sin((d / kPer) * Math.PI * 2);
    }
    return p;
  };
  let dP = "", dM = "", dK = "";
  const KB = narrow ? 300 : 290; // línea base del sensor de detonación
  for (let th = TH0; th <= TH1; th += 0.5) {
    dP += `${th === TH0 ? "M" : "L"}${mx(th).toFixed(1)},${my(pressAt(th)).toFixed(1)}`;
    dM += `${th === TH0 ? "M" : "L"}${mx(th).toFixed(1)},${my(motoring.ps[idx(th)]).toFixed(1)}`;
    // sensor de detonación: vibración de fondo + ráfaga si detona
    let k = 0.6 * Math.sin(th * 7.3) * Math.sin(th * 2.1 + 1);
    if (knock && th > cyc.thmax - 1) k += (2 + kInt * 0.5) * Math.exp(-(th - cyc.thmax) / 12) * Math.sin(((th - cyc.thmax) / kPer) * Math.PI * 2);
    dK += `${th === TH0 ? "M" : "L"}${mx(th).toFixed(1)},${(KB + clamp(k, -6, 6) * 2.8).toFixed(1)}`;
  }
  const recentKnock = cycleN - C.lastKnock <= 1;

  // cilindro chico
  const CYX = 640, CYTOP = 40;
  const pistonY = (th: number) => {
    const t = (th * Math.PI) / 180, s = Math.sin(t), c = Math.cos(t);
    return (RC * (1 - c) + ROD - Math.sqrt(ROD * ROD - RC * RC * s * s)) * 1000 * 1.1;
  };
  const pyNow = CYTOP + 14 + pistonY(thNow);
  const xbNow = cyc.xs[idx(thNow)];
  const sparkOn = thNow >= -effAdv && thNow < -effAdv + 6;

  return (
    <AnimFrame
      title="Avance de encendido: cuándo saltar la chispa"
      clock={clock}
      controls={
        <>
          <Slider label="Avance" value={adv} min={0} max={50} step={1} onChange={setAdv} unit="° APMS" />
          <Slider label="RPM" value={rpm} min={1500} max={6000} step={100} onChange={setRpm} />
          <Toggle label="Nafta de menor octanaje" checked={bajoOct} onChange={setBajoOct} />
          <Toggle label="Control de detonación (ECU)" checked={knockCtl} onChange={setKnockCtl} />
        </>
      }
      readouts={
        <>
          <Readout label="Avance efectivo" value={fmt(effAdv, 0)} unit="° APMS" tone={C.retard > 0 ? "warn" : undefined} />
          <Readout label="Retardo por detonación" value={fmt(C.retard, 1)} unit="°" tone={C.retard > 0 ? "warn" : "ok"} />
          <Readout label="Presión pico" value={fmt(cyc.pmax, 0)} unit="bar" tone={knock ? "bad" : undefined} />
          <Readout label="Pico a" value={`${fmt(Math.abs(cyc.thmax), 0)}° ${cyc.thmax >= 0 ? "DPMS" : "APMS"}`} tone={cyc.thmax >= 8 && cyc.thmax <= 18 ? "ok" : "warn"} />
          <Readout label="Torque" value={fmt(torque, 1)} unit="% del máx." tone={torque > 98.5 ? "ok" : torque < 92 ? "bad" : "warn"} />
          <Readout label="Gases al abrir escape" value={fmt(cyc.tEvo, 0)} unit="°C" tone={cyc.tEvo > tEvoMbt + 60 ? "bad" : cyc.tEvo > tEvoMbt + 20 ? "warn" : undefined} />
          <Readout label="Avance ideal (MBT)" value={fmt(mbt.a, 0)} unit="°" />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Presión con combustión" },
        { color: "var(--muted)", label: "Sin combustión (sólo compresión)" },
        { color: "var(--c-spark)", label: "Chispa" },
        { color: "var(--ok)", label: "Zona ideal del pico (10–15° DPMS)" },
        { color: "var(--violet)", label: "Sensor de detonación" },
      ]}
      caption={
        <>
          <p>
            La mezcla tarda en quemarse (unos 2 a 3 milisegundos); por eso la chispa salta <b>antes</b> del PMS. El objetivo es que la
            presión máxima llegue <b>unos 10–15° después del PMS</b>, cuando la biela ya tiene palanca. Con <b>poco avance</b> la
            combustión llega tarde: el pico es bajo, se pierde torque y el calor se va por el escape. Con <b>demasiado</b>, la presión
            sube mientras el pistón todavía está subiendo: se pelea contra el motor y, si la presión pasa el límite que aguanta la nafta,
            aparece la <b>detonación</b> (las oscilaciones).
          </p>
          <p>
            El <b>sensor de detonación</b> escucha esa vibración y la ECU <b>retrasa</b> la chispa 3° por vez; cuando deja de detonar,
            la vuelve a adelantar de a poco. Probá subir el avance a 40°, después activá la <b>nafta de menor octanaje</b>, y mirá cuánto
            torque perdés. A más rpm, la combustión ocupa más grados y hace falta más avance.
          </p>
        </>
      }
    >
      <svg id={clipId + "-svg"} viewBox={narrow ? "0 8 572 320" : "0 0 720 316"} style={narrow ? { overflow: "hidden" } : undefined} role="img" aria-label="Presión en el cilindro según el avance de encendido">
        {narrow && <style>{narrowFonts(clipId + "-svg", 17, 18, 16)}</style>}
        <rect x={GX0} y={GY0} width={GX1 - GX0} height={GY1 - GY0} fill="var(--surface)" stroke="var(--border)" rx={6} />
        <rect x={mx(10)} y={GY0} width={mx(15) - mx(10)} height={GY1 - GY0} fill="var(--ok)" opacity={0.13} />
        {[0, 20, 40, 60, 80].map((p) => (
          <g key={p}>
            <line x1={GX0} y1={my(p)} x2={GX1} y2={my(p)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={GX0 - 6} y={my(p) + 4} textAnchor="end" className="svg-small">{p}</text>
          </g>
        ))}
        <text x={GX0 - 6} y={GY0 - 10} textAnchor="end" className="svg-small">bar</text>
        {[-60, -40, -20, 0, 20, 40, 60, 80].map((th) => (
          <text key={th} x={mx(th)} y={GY1 + 14} textAnchor="middle" className="svg-small">{th === 0 ? "PMS" : `${Math.abs(th)}°`}</text>
        ))}
        {!narrow && <text x={mx(-30)} y={GY1 + 28} textAnchor="middle" className="svg-small">← antes del PMS (compresión)</text>}
        {!narrow && <text x={mx(50)} y={GY1 + 28} textAnchor="middle" className="svg-small">después del PMS (explosión) →</text>}
        <line x1={mx(0)} y1={GY0} x2={mx(0)} y2={GY1} stroke="var(--text)" opacity={0.5} />
        {/* límite de detonación */}
        <line x1={GX0} y1={my(pKnock)} x2={GX1} y2={my(pKnock)} stroke="var(--bad)" strokeDasharray="6 4" opacity={0.7} />
        <text x={GX1 - 6} y={my(pKnock) - 5} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>
          límite de detonación ({bajoOct ? "menor octanaje" : "nafta correcta"})
        </text>
        <path d={dM} fill="none" stroke="var(--muted)" strokeWidth={1.6} strokeDasharray="5 4" />
        <path d={dP} fill="none" stroke={knock ? "var(--bad)" : "var(--accent)"} strokeWidth={2.6} />
        {/* chispa */}
        <line x1={mx(-effAdv)} y1={GY0} x2={mx(-effAdv)} y2={GY1} stroke="var(--c-spark)" strokeWidth={2} strokeDasharray="4 3" />
        <text x={mx(-effAdv) + 4} y={GY0 + 14} className="svg-label" style={{ fill: "var(--warn)" }}>⚡ {fmt(effAdv, 0)}°</text>
        {/* pico */}
        <circle cx={mx(cyc.thmax)} cy={my(cyc.pmax)} r={5} fill={knock ? "var(--bad)" : "var(--accent)"} stroke="var(--surface)" strokeWidth={2} />
        <text x={mx(cyc.thmax) + 8} y={my(cyc.pmax) - 6} className="svg-small" style={{ fill: "var(--text)" }}>
          pico {fmt(cyc.pmax, 0)} bar
        </text>
        {/* cursor del evento actual */}
        {thNow >= TH0 && thNow <= TH1 && (
          <circle cx={mx(thNow)} cy={my(pressAt(thNow))} r={4} fill="var(--text)" opacity={0.8} />
        )}
        {/* sensor de detonación */}
        <text x={GX0} y={KB - 22} className="svg-small" style={{ fill: "var(--violet)" }}>sensor de detonación</text>
        <line x1={GX0} y1={KB} x2={GX1} y2={KB} stroke="var(--border)" />
        <path d={dK} fill="none" stroke="var(--violet)" strokeWidth={1.4} />
        {recentKnock && (
          <text x={GX1} y={KB - 22} textAnchor="end" className="svg-label" style={{ fill: "var(--bad)" }}>
            {knockCtl ? "¡detonación! → la ECU retrasa 3°" : "¡detonación! (sin control)"}
          </text>
        )}

        {/* cilindro (en celular no entra) */}
        {!narrow && (<>
        <defs>
          <clipPath id={clipId}><rect x={CYX - 37} y={CYTOP + 2} width={74} height={Math.max(1, pyNow - CYTOP - 2)} /></clipPath>
        </defs>
        <rect x={CYX - 40} y={CYTOP} width={80} height={130} fill="none" stroke="var(--c-metal-dark)" strokeWidth={6} />
        <rect x={CYX - 46} y={CYTOP - 10} width={92} height={12} rx={3} fill="var(--c-metal-dark)" />
        <rect x={CYX - 37} y={CYTOP + 2} width={74} height={Math.max(0, pyNow - CYTOP - 2)} fill={knock && xbNow > 0.7 ? "var(--bad)" : "var(--c-hot)"} opacity={0.08 + 0.55 * xbNow} />
        {xbNow > 0.01 && xbNow < 0.99 && (
          <circle cx={CYX} cy={CYTOP + 4} r={8 + 40 * xbNow} fill="var(--c-flame)" fillOpacity={0.25} stroke="var(--c-flame)" strokeWidth={2.5} clipPath={`url(#${clipId})`} />
        )}
        {sparkOn && <circle cx={CYX} cy={CYTOP + 6} r={7} fill="var(--c-spark)" />}
        <rect x={CYX - 37} y={pyNow} width={74} height={34} rx={4} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
        <text x={CYX} y={CYTOP + 196} textAnchor="middle" className="svg-small">cilindro (cámara lenta)</text>
        <text x={CYX} y={CYTOP + 210} textAnchor="middle" className="svg-mono" style={{ fontSize: 11 }}>
          {thNow < 0 ? `${fmt(-thNow, 0)}° APMS` : `${fmt(thNow, 0)}° DPMS`}
        </text>
        </>)}
      </svg>
    </AnimFrame>
  );
}
