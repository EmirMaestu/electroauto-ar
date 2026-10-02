import { memo, useReducer, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { Seg, Slider, Toggle, clamp, fmt, useLoop } from "../components/ui/anim-kit";
import {
  ALTITUDES, FAULT_IDS, PIDS, clearCodes, createEngine, preDrive, readPids, settle, startBalance, startEngine, stepEngine, stopEngine,
  type AltitudeId, type EngineInputs, type EngineState, type FaultId, type PidId, type Situation,
} from "../components/bench/engineModel";
import { FAULTS } from "../components/bench/engineFaults";
import { TREND_COLORS, TrendBuffer, TrendChart, type TrendSeries } from "../components/bench/TrendChart";
import { EngineSchematic } from "../components/bench/EngineSchematic";
import { BalancePanel, DashLamps, DtcPanel, PidList } from "../components/bench/ScannerParts";
import { useNarrow, usePageVisible } from "../components/bench/hooks";
import { Store, useProgress } from "../lib/progress";

type Mode = "explorar" | "diag";

interface Ctl {
  pedal: number; situation: Situation; dynoRpm: number; alt: AltitudeId; ambient: number;
  hold: number | null; snapT: number;
}

const baroOf = (a: AltitudeId) => ALTITUDES.find((x) => x.id === a)?.kPa ?? 92.5;

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

function Card(props: { title: ReactNode; right?: ReactNode; children: ReactNode; pad?: boolean; style?: React.CSSProperties }) {
  return (
    <section className="card" style={{ padding: 0, overflow: "hidden", ...props.style }}>
      <div className="row" style={{ justifyContent: "space-between", padding: ".65rem .9rem", borderBottom: "1px solid var(--border)", gap: ".5rem" }}>
        <h3 style={{ margin: 0, fontSize: "1rem" }}>{props.title}</h3>
        {props.right}
      </div>
      <div style={{ padding: props.pad === false ? 0 : ".8rem .9rem" }}>{props.children}</div>
    </section>
  );
}

export default function BancoMotor() {
  const narrow = useNarrow(900);
  const visible = usePageVisible();
  const progress = useProgress();
  const [, force] = useReducer((x: number) => x + 1, 0);

  const [mode, setMode] = useState<Mode>("explorar");
  const [fault, setFault] = useState<FaultId>("none");
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [graph, setGraph] = useState<PidId[]>(["rpm", "o2", "stft", "ltft"]);
  const [windowS, setWindowS] = useState(30);
  const [tones, setTones] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  // modo diagnóstico
  const [caseFault, setCaseFault] = useState<FaultId>("vacio");
  const [caseNo, setCaseNo] = useState(0);
  const [options, setOptions] = useState<FaultId[]>([]);
  const [picked, setPicked] = useState<FaultId[]>([]);
  const [solved, setSolved] = useState(false);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const [newXp, setNewXp] = useState(false);

  const ctl = useRef<Ctl>({ pedal: 0, situation: "neutral", dynoRpm: 2500, alt: "mza", ambient: 22, hold: null, snapT: -1 });
  const activeFault: FaultId = mode === "explorar" ? fault : caseFault;
  const faultRef = useRef(activeFault);
  faultRef.current = activeFault;
  const inputs = (): EngineInputs => {
    const c = ctl.current;
    return { pedal: c.pedal, situation: c.situation, dynoRpm: c.dynoRpm, baro: baroOf(c.alt), ambient: c.ambient, fault: faultRef.current };
  };
  const sim = useRef<EngineState | null>(null);
  if (!sim.current) {
    const e = createEngine(inputs());
    settle(e, inputs(), 8);
    sim.current = e;
  }
  const buf = useRef(new TrendBuffer(1300, PIDS.map((p) => p.id)));
  const lastSample = useRef(-1);
  const lastRender = useRef(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  useLoop((dt) => {
    const s = sim.current;
    if (!s) return;
    const c = ctl.current;
    const sdt = dt * speedRef.current;
    // "pie virtual": sostiene unas rpm moviendo el pedal
    if (c.hold !== null && c.situation === "neutral" && s.phase === "run") {
      c.pedal = clamp(c.pedal + (c.hold - s.rpmF) * 0.006 * sdt, 0, 60);
    }
    // acelerón: pedal a fondo un instante y soltar
    if (c.snapT >= 0) {
      c.snapT += sdt;
      c.pedal = c.snapT < 0.3 ? 100 : 0;
      if (c.snapT >= 0.3) c.snapT = -1;
    }
    const inp = inputs();
    stepEngine(s, inp, sdt);
    if (s.t - lastSample.current >= 0.05 || s.t < lastSample.current) {
      lastSample.current = s.t;
      buf.current.push(s.t, readPids(s, inp));
    }
    const now = performance.now();
    if (now - lastRender.current > 40) { lastRender.current = now; force(); }
  }, !paused && visible);

  const s = sim.current;
  const c = ctl.current;
  const inp = inputs();
  const p = readPids(s, inp);
  const blinkOn = Math.floor(performance.now() / 350) % 2 === 0;

  /* ---------------- acciones */
  const resetEngine = (f: FaultId) => {
    const e = createEngine({ ...inputs(), fault: f });
    settle(e, { ...inputs(), fault: f, pedal: 0, situation: "neutral" }, 8);
    sim.current = e;
    buf.current.clear();
    lastSample.current = -1;
  };
  const setCtl = (patch: Partial<Ctl>) => { Object.assign(ctl.current, patch); force(); };
  const newCase = (prev: FaultId) => {
    const pool = FAULT_IDS.filter((f) => f !== prev);
    const f = pool[Math.floor(Math.random() * pool.length)];
    Object.assign(ctl.current, { pedal: 0, situation: "neutral", hold: null, snapT: -1 });
    const base: EngineInputs = { ...inputs(), pedal: 0, situation: "neutral", fault: f };
    const e = createEngine(base, (Math.random() * 1e9) | 0);
    preDrive(e, base);
    sim.current = e;
    buf.current.clear();
    lastSample.current = -1;
    faultRef.current = f;
    setCaseFault(f);
    const conf = shuffle(FAULTS[f].confusables).slice(0, 3);
    const extra = shuffle(FAULT_IDS.filter((x) => x !== f && !conf.includes(x)));
    while (conf.length < 3) conf.push(extra.pop() as FaultId);
    setOptions(shuffle([f, ...conf]));
    setPicked([]);
    setSolved(false);
    setCaseNo((n) => n + 1);
    setMsg(null);
  };
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    if (m === "diag") newCase(caseFault);
    else {
      setFault("none");
      faultRef.current = "none";
      Object.assign(ctl.current, { pedal: 0, situation: "neutral", hold: null, snapT: -1 });
      resetEngine("none");
    }
  };
  const pick = (f: FaultId) => {
    if (solved || picked.includes(f)) return;
    const first = picked.length === 0;
    setPicked((x) => [...x, f]);
    if (first) setScore((sc) => ({ ok: sc.ok + (f === caseFault ? 1 : 0), total: sc.total + 1 }));
    if (f === caseFault) {
      setNewXp(!Store.isBenchDone("motor-" + f));
      setSolved(true);
      Store.markBench("motor-" + f);
    }
  };
  const toggleGraph = (id: PidId) => {
    setGraph((g) => (g.includes(id) ? g.filter((x) => x !== id) : [...g, id].slice(-4)));
  };

  const series: TrendSeries[] = graph.map((id, i) => {
    const d = PIDS.find((x) => x.id === id)!;
    return { key: id, label: d.label, unit: d.unit, color: TREND_COLORS[i], dec: d.dec, min: d.min, max: d.max, span: d.span };
  });
  const benchDone = Object.keys(progress.bench ?? {}).filter((k) => k.startsWith("motor-")).length;
  const info = FAULTS[mode === "explorar" ? fault : caseFault];
  const showFault = mode === "explorar" || solved;

  /* ---------------- controles */
  const controls = (
    <Card
      title="Motor 1.6 multipunto"
      right={
        <div className="row" style={{ gap: ".4rem" }}>
          <button className="ctl-play" onClick={() => setPaused((x) => !x)} aria-label={paused ? "Reanudar" : "Pausar"} title={paused ? "Reanudar" : "Pausar"}>{paused ? "▶" : "❚❚"}</button>
          <Seg value={speed} onChange={setSpeed} options={[{ value: 1, label: "1×" }, { value: 3, label: "3×" }]} ariaLabel="Velocidad" />
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: ".8rem", fontSize: ".88rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: ".8rem 1.6rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
            <Seg
              value={c.situation}
              onChange={(v) => setCtl({ situation: v, hold: null })}
              options={[{ value: "neutral" as Situation, label: "Punto muerto (taller)" }, { value: "dyno" as Situation, label: "Con carga (banco de rodillos)" }]}
              ariaLabel="Situación"
            />
            <div className="row" style={{ gap: ".5rem 1.2rem" }}>
              <Slider label="Acelerador" value={Math.round(c.pedal)} min={0} max={100} step={1} unit="%" onChange={(v) => setCtl({ pedal: v, hold: null, snapT: -1 })} width={narrow ? 120 : 140} />
              {c.situation === "dyno" && (
                <Slider label="Rodillo" value={c.dynoRpm} min={1200} max={5600} step={100} unit="rpm" onChange={(v) => setCtl({ dynoRpm: v })} width={narrow ? 110 : 120} />
              )}
            </div>
            {c.situation === "neutral" ? (
              <div className="row" style={{ gap: ".4rem" }}>
                <button className={`btn sm ${c.hold === null && c.pedal === 0 ? "" : "ghost"}`} onClick={() => setCtl({ pedal: 0, hold: null, snapT: -1 })}>Ralentí</button>
                <button className={`btn sm ${c.hold === 2500 ? "" : "ghost"}`} onClick={() => setCtl({ hold: 2500, snapT: -1, pedal: Math.max(c.pedal, 12) })}>Sostener 2.500 rpm</button>
                <button className="btn ghost sm" onClick={() => setCtl({ hold: null, snapT: 0 })} title="Pisar a fondo un instante y soltar">Acelerón</button>
                <button className="btn ghost sm" onClick={() => setCtl({ hold: null, snapT: -1, pedal: 100 })}>A fondo</button>
              </div>
            ) : (
              <p className="faint" style={{ margin: 0, fontSize: ".8rem" }}>El rodillo sostiene las vueltas; el acelerador decide cuánta fuerza hace el motor (como subir una cuesta a velocidad constante, en 3ra).</p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
            <Seg
              value={c.alt}
              onChange={(v) => setCtl({ alt: v })}
              options={ALTITUDES.map((a) => ({ value: a.id as AltitudeId, label: <span style={{ lineHeight: 1.15, display: "inline-block" }}>{a.label}<br /><small style={{ opacity: 0.75 }}>{a.short}</small></span> }))}
              ariaLabel="Altura"
            />
            <Slider label="Temp. ambiente" value={c.ambient} min={-5} max={40} step={1} unit="°C" onChange={(v) => setCtl({ ambient: v })} width={narrow ? 100 : 120} />
            <div className="row" style={{ gap: ".4rem" }}>
              <button className="btn ghost sm" onClick={() => { startEngine(s, inp, true); setCtl({ pedal: 0, hold: null }); }}>❄️ Arrancar en frío</button>
              {s.phase === "off"
                ? <button className="btn ghost sm" onClick={() => { startEngine(s, inp, false); force(); }}>🔑 Arrancar</button>
                : <button className="btn ghost sm" onClick={() => { stopEngine(s); setCtl({ pedal: 0, hold: null }); }}>⏹ Apagar</button>}
              {mode === "explorar" && <button className="btn ghost sm" onClick={() => { resetEngine(fault); force(); }} title="Motor caliente, sin códigos ni correcciones aprendidas">↺ Reiniciar</button>}
            </div>
          </div>
        </div>
        {mode === "explorar" && (
          <div>
            <div className="muted" style={{ marginBottom: ".35rem" }}>Falla</div>
            <div className="chip-row" style={{ margin: 0 }}>
              {(["none", ...FAULT_IDS] as FaultId[]).map((f) => (
                <button key={f} className={`chip ${fault === f ? "on" : ""}`} onClick={() => { setFault(f); faultRef.current = f; }}>
                  {FAULTS[f].icon} {FAULTS[f].name}
                </button>
              ))}
            </div>
            <p style={{ margin: ".6rem 0 0", color: "var(--text-2)" }}>
              <b>{FAULTS[fault].name}:</b> {FAULTS[fault].short} {fault !== "none" && <a href="#que-pasa">Qué hace la ECU ↓</a>}
            </p>
          </div>
        )}
        <p className="faint" style={{ margin: 0, fontSize: ".78rem" }}>
          Tiempo acelerado: el calentamiento corre ≈ 9 veces más rápido y la descarga de la batería ≈ 60 veces, para no esperar media hora.
        </p>
      </div>
    </Card>
  );

  /* ---------------- caso (diagnóstico) */
  const caseCard = mode === "diag" && (
    <Card
      title={`Caso ${caseNo}: entra un auto al taller`}
      right={<span className="pill ok">Aciertos {score.ok}/{score.total}</span>}
      style={{ borderColor: "var(--accent)" }}
    >
      <p style={{ marginTop: 0, fontSize: "1.02rem" }}>
        🗣️ <i>“{FAULTS[caseFault].cliente}”</i>
      </p>
      <p className="muted" style={{ fontSize: ".9rem", marginBottom: 0 }}>
        El auto viene andando hasta el taller y ya está caliente. Leé los códigos, mirá los datos en ralentí, sostené 2.500 rpm, ponelo en
        el banco de rodillos con carga, hacé la prueba de balance o arrancalo en frío. Cuando tengas una idea, elegí el diagnóstico abajo.
        Resueltos para siempre: <b>{benchDone}/10</b>.
      </p>
    </Card>
  );

  const answerCard = mode === "diag" && (
    <Card title="Tu diagnóstico" right={<button className="btn ghost sm" onClick={() => newCase(caseFault)}>Nuevo caso →</button>}>
      <div className="grid cols-2" style={{ gap: ".5rem" }}>
        {options.map((o) => {
          const isPicked = picked.includes(o);
          const ok = o === caseFault;
          return (
            <button
              key={o}
              className={`quiz-opt ${isPicked ? (ok ? "correct" : "wrong") : solved && ok ? "correct" : ""}`}
              style={{ margin: 0 }}
              onClick={() => pick(o)}
              disabled={solved || isPicked}
            >
              <span className="letter">{FAULTS[o].icon}</span>
              <span><b>{FAULTS[o].name}</b><br /><span className="muted" style={{ fontSize: ".86rem" }}>{FAULTS[o].short}</span></span>
            </button>
          );
        })}
      </div>
      {!solved && picked.length > 0 && (
        <div className="quiz-explain">❌ No es eso. Pista: {FAULTS[caseFault].pista}</div>
      )}
      {solved && (
        <div className="quiz-explain" style={{ borderLeft: "4px solid var(--ok)" }}>
          ✅ <b>¡Bien! Era {FAULTS[caseFault].name.toLowerCase()}.</b> {newXp ? "+15 XP." : ""} Abajo tenés qué pasaba electrónicamente
          y cómo confirmarlo en el taller. En el esquema ahora se marca la pieza.
        </div>
      )}
    </Card>
  );

  /* ---------------- qué pasa electrónicamente */
  const ecuCard = (mode === "explorar" || solved) && (
    <section id="que-pasa" className="callout electronica" style={{ margin: 0 }}>
      <div className="callout-head"><span className="ic">🧠</span><span className="lbl">Qué está pasando electrónicamente</span><span style={{ marginLeft: ".4rem" }}>· {info.icon} {info.name}</span></div>
      <div className="grid" style={{ gridTemplateColumns: narrow ? "1fr" : "1.25fr 1fr", gap: "1.2rem", marginTop: ".5rem" }}>
        <div style={{ fontSize: ".95rem" }}>{info.ecu}</div>
        <div style={{ fontSize: ".9rem" }}>
          <div className="eyebrow" style={{ fontSize: ".72rem" }}>Qué mirar en el scanner</div>
          <ul style={{ margin: ".3rem 0 .8rem", paddingLeft: "1.1em" }}>{info.ver.map((x) => <li key={x}>{x}</li>)}</ul>
          <div className="eyebrow" style={{ fontSize: ".72rem" }}>Códigos</div>
          <p style={{ margin: ".2rem 0 .8rem", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{info.codigos}</p>
          {info.confirmar.length > 0 && (
            <>
              <div className="eyebrow" style={{ fontSize: ".72rem" }}>Cómo confirmarlo en el taller</div>
              <ul style={{ margin: ".3rem 0 0", paddingLeft: "1.1em" }}>{info.confirmar.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          )}
        </div>
      </div>
    </section>
  );

  /* ---------------- vistas */
  const scanner = (
    <Card
      title="🖥️ Scanner: datos en vivo"
      right={<DashLamps s={s} p={p} blinkOn={blinkOn} />}
      pad={false}
    >
      <div style={{ padding: ".5rem .4rem .6rem" }}>
        <div className="row" style={{ justifyContent: "space-between", padding: "0 .5rem .3rem", fontSize: ".8rem" }}>
          <span className="faint">Tocá un dato para graficarlo (hasta 4).</span>
          <Toggle label={<span style={{ fontSize: ".8rem" }}>Marcar valores raros</span>} checked={tones} onChange={setTones} />
        </div>
        <PidList p={p} s={s} inp={inp} graph={graph} onToggle={toggleGraph} tones={tones} />
      </div>
    </Card>
  );
  const chart = (
    <Card
      title="📈 Gráfico"
      right={<Seg value={windowS} onChange={setWindowS} options={[{ value: 15, label: "15 s" }, { value: 30, label: "30 s" }, { value: 60, label: "60 s" }]} ariaLabel="Ventana de tiempo" />}
    >
      {series.length ? <TrendChart buf={buf.current} series={series} windowS={windowS} version={s.t} /> : <p className="muted">Elegí datos en la lista para graficar.</p>}
    </Card>
  );
  const schematic = (
    <Card title="🔧 Esquema: sensores (violeta) y actuadores (naranja)" pad={false}>
      <div className="anim-stage" style={{ overflowX: narrow ? "auto" : undefined }}>
        <div style={{ minWidth: narrow ? 620 : undefined }}>
          <EngineSchematic s={s} p={p} fault={activeFault} showFault={showFault} />
        </div>
      </div>
      {narrow && <p className="faint" style={{ fontSize: ".78rem", margin: ".4rem .8rem" }}>Deslizá el esquema hacia los costados →</p>}
    </Card>
  );
  const dtcs = (
    <Card title="⚠️ Códigos de falla">
      <DtcPanel s={s} onClear={() => { clearCodes(s); force(); }} />
    </Card>
  );
  const balance = (
    <Card title="⚖️ Prueba de balance de cilindros">
      <BalancePanel s={s} msg={msg} onStart={() => { const m = startBalance(s, inp); setMsg(m); if (!m) setCtl({ hold: null, pedal: 0 }); }} />
    </Card>
  );

  return (
    <div className="page">
      <div className="lesson-head" style={{ marginBottom: "1rem" }}>
        <div className="crumbs"><Link to="/banco">Banco de pruebas</Link> <span>›</span> <span>Motor + scanner</span></div>
        <h1>🖥️ Motor con ECU y scanner en vivo</h1>
        <p className="summary">
          Un 1.6 naftero multipunto andando. Mirá los datos como en un scanner, metele una falla y fijate cómo reacciona la ECU. Después pasá a
          “Diagnosticar”: la falla queda oculta y la encontrás vos.
        </p>
      </div>

      <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <Seg value={mode} onChange={switchMode} options={[{ value: "explorar" as Mode, label: "🔍 Explorar" }, { value: "diag" as Mode, label: "🩺 Diagnosticar" }]} />
        <span className="pill tecnico">Diagnósticos resueltos {benchDone}/10</span>
      </div>

      <div className="stack">
        {controls}
        {caseCard}
        {narrow ? (
          <>
            {chart}
            {scanner}
            {dtcs}
            {schematic}
            {balance}
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(0, 1fr)", gap: "1rem", alignItems: "start" }}>
            <div className="stack">{chart}{schematic}{balance}</div>
            <div className="stack">{scanner}{dtcs}</div>
          </div>
        )}
        {answerCard}
        {ecuCard}
      </div>

      <Explicacion />
    </div>
  );
}

/* ---------------------------------------------------------------- texto al pie */
const NORMALES: [string, string, string, string][] = [
  ["RPM", "750–850 (en frío 1.000–1.200)", "—", "Ralentí inestable = aire falso, fallos, mariposa sucia"],
  ["Temp. refrigerante", "85–100 °C", "85–100 °C", "Ventilador entre 92 y 105 °C (según fabricante)"],
  ["MAP", "28–40 kPa", "20–30 kPa sin carga", "Con contacto y motor parado, o a fondo ≈ barométrica"],
  ["Vacío", "17–21 inHg al nivel del mar", "más que en ralentí", "En Mendoza ≈ 2–3 inHg menos; en Uspallata ≈ 5 menos"],
  ["MAF (1.6)", "2–4 g/s", "5–8 g/s", "A fondo con carga ≈ 0,8 g/s por CV"],
  ["Carga calculada", "18–35 %", "15–25 %", "A fondo ≈ 85–100 % (menos en altura)"],
  ["Mariposa motorizada", "3–8 %", "—", "TPS: ≈ 0,5 V cerrada a ≈ 4,5 V abierta"],
  ["Sonda lambda", "0,1–0,9 V conmutando", "≥ 1 cambio por segundo", "Fija arriba = rica; fija abajo = pobre o corte"],
  ["STFT / LTFT", "±10 %", "±10 %", "Más de +20 % = pobre (P0171); menos de −20 % = rica"],
  ["Tiempo de inyección", "2–4 ms", "2,5–4 ms", "A fondo 10–15 ms"],
  ["Avance", "5–15° APMS", "25–40° APMS", "Con carga alta baja (detonación)"],
  ["Tensión de módulo", "13,8–14,7 V", "13,8–14,7 V", "Motor parado 12,6–12,7 V"],
  ["Presión de nafta", "3–4 bar", "igual", "Sólo con manómetro en multipunto; no tiene que caer a fondo"],
  ["Fallos de encendido", "0", "0", "Uno que sube en un solo cilindro = bujía, bobina, inyector o compresión de ese cilindro"],
];

const Explicacion = memo(function Explicacion() {
  return (
    <div className="prose" style={{ maxWidth: "none", marginTop: "2.5rem" }}>
      <h2>Cómo leer datos en vivo</h2>
      <p>
        El scanner no “te dice la falla”: te muestra lo que la ECU <b>ve</b> (sensores) y lo que <b>hace</b> (actuadores y correcciones). El
        diagnóstico sale de comparar esos números con lo que tendría que pasar en esa situación. Por eso siempre mirás los datos en
        condiciones conocidas: <b>ralentí caliente</b>, <b>2.500 rpm sin carga</b> y, si podés, <b>con carga</b> (en ruta o en el banco).
      </p>
      <ul>
        <li><b>Primero las correcciones de mezcla.</b> STFT + LTFT te dicen cuánta nafta está sumando o restando la ECU. Positivas = la ECU ve pobre; negativas = ve rico. Fijate si cambian con las vueltas y la carga: si son grandes en ralentí y se achican al acelerar, es aire falso; si crecen con la carga, falta nafta (presión, inyectores) o el MAF mide de menos.</li>
        <li><b>La sonda lambda tiene que moverse.</b> Una sonda que conmuta 0,1–0,9 V es una sonda viva y una ECU en lazo cerrado. Clavada arriba = rico; clavada abajo = pobre (o corte de inyección).</li>
        <li><b>Plausibilidad.</b> ¿El dato es posible? −40 °C con el motor caliente, 5 V en un sensor de temperatura, MAP igual a la barométrica en ralentí: eso es un circuito, no el motor.</li>
        <li><b>Graficá.</b> Un número suelto engaña; la forma en el tiempo no. Graficá RPM con la sonda, o MAP con TPS, y hacé una prueba (acelerón, 2.500 sostenidas) mientras mirás.</li>
        <li><b>Los contadores de fallos</b> te dicen qué cilindro. Después decidís si es chispa, nafta o mecánica intercambiando piezas y midiendo.</li>
        <li><b>Lo que el scanner no ve</b>: presión de nafta, vacío real, contrapresión de escape, compresión. Para eso están el manómetro, el vacuómetro y el compresómetro.</li>
      </ul>

      <h2>Valores normales (1.6 naftero multipunto, caliente)</h2>
      <p>Rangos típicos: manda siempre el dato del fabricante. Las presiones absolutas cambian con la altura.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Dato</th><th>Ralentí</th><th>2.500 rpm</th><th>Nota</th></tr></thead>
          <tbody>{NORMALES.map((r) => <tr key={r[0]}><td><b>{r[0]}</b></td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>)}</tbody>
        </table>
      </div>

      <h2>Estrategia de diagnóstico</h2>
      <ol>
        <li><b>Escuchá al cliente y reproducí la falla.</b> ¿En frío o en caliente? ¿En ralentí, en subida, a fondo? Eso ya te dice dónde mirar.</li>
        <li><b>Leé los códigos y el cuadro congelado antes de borrar nada.</b> El cuadro congelado te dice en qué condición se guardó (rpm, temperatura, carga, correcciones).</li>
        <li><b>Mirá los datos en vivo</b> en ralentí, a 2.500 rpm y con carga. Correcciones, sonda, MAF/MAP, temperatura, fallos por cilindro.</li>
        <li><b>Armá una hipótesis y hacé una prueba que la confirme o la descarte</b>: balance de cilindros, humo, manómetro, intercambiar bobinas o inyectores, osciloscopio.</li>
        <li><b>Medí el componente y su circuito</b> (alimentación, masa, señal) antes de cambiar la pieza. Un código de sensor muchas veces es la ficha o el cable.</li>
        <li><b>Reparás, borrás los códigos y probás en las mismas condiciones.</b> Fijate que las correcciones vuelvan a la normalidad y que el código no vuelva.</li>
      </ol>
      <p>
        Para seguir: <Link to="/aprender/electricidad/p1l3">cómo usar el scanner</Link>, <Link to="/aprender/electricidad/p2l2">estrategia de diagnóstico</Link>,
        {" "}<Link to="/banco/osciloscopio">osciloscopio</Link> y <Link to="/banco/calculadoras">calculadoras de taller</Link>.
      </p>
    </div>
  );
});
