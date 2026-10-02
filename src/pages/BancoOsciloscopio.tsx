import { memo, useReducer, useRef, useState } from "react";
import { Link } from "react-router";
import { Readout, Seg, Slider, fmt, useLoop } from "../components/ui/anim-kit";
import { BenchScope, fmtDiv, fmtTime, measure } from "../components/bench/BenchScope";
import { SIGNALS, SIGNAL_GROUPS, type Params, type ScopeSignal } from "../components/bench/scopeSignals";
import { useNarrow, usePageVisible } from "../components/bench/hooks";

interface Cfg { msDiv: number; vDivs: number[]; params: Params; fault: string }
const defaultCfg = (s: ScopeSignal): Cfg => ({
  msDiv: s.msDiv,
  vDivs: s.channels.map((c) => c.vDiv),
  params: Object.fromEntries(s.params.map((p) => [p.id, p.def])),
  fault: s.faults[0].id,
});

function fmtFreq(hz: number) {
  if (!Number.isFinite(hz)) return "—";
  if (hz >= 1000) return `${fmt(hz / 1000, hz >= 10000 ? 0 : 1)} k`;
  return fmt(hz, hz < 10 ? 2 : hz < 100 ? 1 : 0);
}

export default function BancoOsciloscopio() {
  const narrow = useNarrow(900);
  const visible = usePageVisible();
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [sigId, setSigId] = useState(SIGNALS[0].id);
  const [cfgs, setCfgs] = useState<Record<string, Cfg>>({});
  const [hold, setHold] = useState(false);
  const tNow = useRef(10000);
  const lastRender = useRef(0);

  const sig = SIGNALS.find((s) => s.id === sigId) ?? SIGNALS[0];
  const cfg = cfgs[sig.id] ?? defaultCfg(sig);
  const setCfg = (patch: Partial<Cfg>) => setCfgs((all) => ({ ...all, [sig.id]: { ...(all[sig.id] ?? defaultCfg(sig)), ...patch } }));

  useLoop((dt) => {
    // el tiempo de la señal corre a velocidad real (las señales rápidas se ven quietas por el disparo)
    tNow.current += dt * 1000;
    const now = performance.now();
    if (now - lastRender.current > 33) { lastRender.current = now; force(); }
  }, !hold && visible);

  const win = cfg.msDiv * 10;
  const pre = cfg.msDiv; // el disparo queda a 1 división del borde
  let t0: number, trigMs: number | undefined;
  if (sig.mode === "trig" && sig.period && sig.trigAt) {
    const per = sig.period(cfg.params, cfg.fault);
    const at = sig.trigAt(cfg.params, cfg.fault);
    const k = Math.floor((tNow.current - at) / per);
    const tTrig = k * per + at;
    t0 = tTrig - pre;
    trigMs = pre;
  } else {
    t0 = tNow.current - win;
  }
  const sample = (t: number, out: number[]) => sig.sample(t, cfg.params, cfg.fault, out);
  const channels = sig.channels.map((c, i) => ({ label: c.label, unit: c.unit, color: c.color, vDiv: cfg.vDivs[i] ?? c.vDiv, zero: c.zero }));
  const markers = sig.markers && trigMs !== undefined ? sig.markers(cfg.params, cfg.fault).map((m) => ({ ...m, ms: m.ms + trigMs! })) : undefined;
  const meas = measure(sample, sig.channels.length, t0, win, 500);
  const fault = sig.faults.find((f) => f.id === cfg.fault) ?? sig.faults[0];

  const list = (
    <nav aria-label="Señales">
      {narrow ? (
        <div className="chip-row" style={{ flexWrap: "nowrap", overflowX: "auto", paddingBottom: ".4rem", margin: "0 0 .8rem" }}>
          {SIGNALS.map((s) => (
            <button key={s.id} className={`chip ${s.id === sig.id ? "on" : ""}`} style={{ whiteSpace: "nowrap" }} onClick={() => setSigId(s.id)}>{s.icon} {s.name}</button>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: ".6rem", position: "sticky", top: "calc(var(--topbar-h) + 16px)" }}>
          {SIGNAL_GROUPS.map((g) => (
            <div key={g} style={{ marginBottom: ".5rem" }}>
              <div style={{ fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".09em", fontWeight: 700, color: "var(--faint)", padding: ".3rem .5rem" }}>{g}</div>
              {SIGNALS.filter((s) => s.group === g).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSigId(s.id)}
                  className={`side-link ${s.id === sig.id ? "active" : ""}`}
                  style={{ width: "100%", border: 0, background: s.id === sig.id ? undefined : "transparent", cursor: "pointer", textAlign: "left" }}
                >
                  <span className="ic">{s.icon}</span>{s.name}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </nav>
  );

  const main = (
    <div className="stack" style={{ minWidth: 0 }}>
      <section className="anim" style={{ margin: 0 }}>
        <div className="anim-head">
          <span className="tag">Osciloscopio</span>
          <span className="title">{sig.icon} {sig.name}</span>
          {!narrow && <span className="muted" style={{ fontSize: ".85rem", marginLeft: "auto" }}>{sig.mode === "roll" ? "barrido continuo" : "disparo normal"}</span>}
        </div>
        <div style={{ padding: ".6rem", background: "#05090a" }}>
          <BenchScope channels={channels} msDiv={cfg.msDiv} t0={t0} sample={sample} trigMs={trigMs} markers={markers} hold={hold} coupling={sig.coupling} />
        </div>
        <div className="anim-controls" style={{ flexDirection: "column", alignItems: "stretch", gap: ".7rem" }}>
          <div className="row" style={{ gap: ".5rem .8rem" }}>
            <button className={`btn sm ${hold ? "accent" : ""}`} onClick={() => setHold((h) => !h)} title="Congelar la pantalla">{hold ? "▶ Seguir" : "❄ Congelar (hold)"}</button>
            <span className="muted">Tiempo</span>
            <Seg value={cfg.msDiv} onChange={(v) => setCfg({ msDiv: v })} options={sig.msDivs.map((m) => ({ value: m, label: `${fmtTime(m)}` }))} ariaLabel="Base de tiempo por división" />
          </div>
          {sig.channels.map((c, i) => (
            <div key={c.label} className="row" style={{ gap: ".5rem .8rem" }}>
              <span style={{ color: c.color === "#3ddc84" ? "var(--ok)" : c.color === "#5cc8ff" ? "var(--primary)" : "var(--warn)", fontWeight: 700, minWidth: "6.5em" }}>CH{i + 1} {c.label}</span>
              <Seg
                value={cfg.vDivs[i] ?? c.vDiv}
                onChange={(v) => { const vd = [...cfg.vDivs]; vd[i] = v; setCfg({ vDivs: vd }); }}
                options={c.vDivs.map((v) => ({ value: v, label: `${fmtDiv(v)} ${c.unit}` }))}
                ariaLabel={`Escala del canal ${i + 1}`}
              />
              <span className="faint" style={{ fontSize: ".8rem" }}>por división</span>
            </div>
          ))}
          {sig.params.length > 0 && (
            <div className="row" style={{ gap: ".5rem 1.4rem" }}>
              {sig.params.map((p) => (
                <Slider key={p.id} label={p.label} value={cfg.params[p.id]} min={p.min} max={p.max} step={p.step} unit={p.unit}
                  onChange={(v) => setCfg({ params: { ...cfg.params, [p.id]: v } })} width={narrow ? 120 : 150}
                  format={(v) => fmt(v, p.step < 1 ? 1 : 0)} />
              ))}
            </div>
          )}
          <div>
            <div className="muted" style={{ marginBottom: ".3rem" }}>Estado / falla</div>
            <div className="chip-row" style={{ margin: 0 }}>
              {sig.faults.map((f) => (
                <button key={f.id} className={`chip ${f.id === cfg.fault ? "on" : ""}`} onClick={() => setCfg({ fault: f.id })}>{f.id === "normal" ? "✅ " : "⚠️ "}{f.name}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="readouts">
          {meas.map((m, i) => (
            <div key={i} style={{ display: "contents" }}>
              <Readout label={`CH${i + 1} máx`} value={fmt(m.max, Math.abs(m.max) < 10 ? 2 : 0)} unit={sig.channels[i].unit} />
              <Readout label={`CH${i + 1} mín`} value={fmt(m.min, Math.abs(m.min) < 10 ? 2 : 0)} unit={sig.channels[i].unit} />
              {i === 0 && <Readout label="CH1 pico a pico" value={fmt(m.pp, m.pp < 10 ? 2 : 0)} unit={sig.channels[i].unit} tone="accent" />}
              {i === 0 && <Readout label="CH1 frecuencia" value={fmtFreq(m.freq)} unit="Hz" />}
            </div>
          ))}
        </div>
      </section>

      <div className="grid" style={{ gridTemplateColumns: narrow ? "1fr" : "1fr 1fr", gap: "1rem" }}>
        <div className="callout taller" style={{ margin: 0 }}>
          <div className="callout-head"><span className="ic">🔌</span><span className="lbl">Cómo conectar las puntas</span></div>
          <div className="callout-body" style={{ fontSize: ".93rem" }}>{sig.conectar}</div>
        </div>
        <div className="callout tip" style={{ margin: 0 }}>
          <div className="callout-head"><span className="ic">✅</span><span className="lbl">Qué es normal</span></div>
          <div className="callout-body" style={{ fontSize: ".93rem" }}>{sig.normal}</div>
        </div>
      </div>
      <div className={`callout ${fault.id === "normal" ? "dato" : "warn"}`} style={{ margin: 0 }}>
        <div className="callout-head"><span className="ic">🔎</span><span className="lbl">Qué te dice esta forma</span><span style={{ marginLeft: ".3rem" }}>· {fault.name}</span></div>
        <div className="callout-body" style={{ fontSize: ".95rem" }}>{fault.forma}</div>
      </div>
    </div>
  );

  return (
    <div className="page">
      <div className="lesson-head" style={{ marginBottom: "1rem" }}>
        <div className="crumbs"><Link to="/banco">Banco de pruebas</Link> <span>›</span> <span>Osciloscopio</span></div>
        <h1>📈 Osciloscopio: las señales del auto</h1>
        <p className="summary">
          Elegí una señal, ajustá la escala como en un osciloscopio de verdad y probá las fallas. Abajo de cada una: dónde poner las puntas,
          qué es normal y qué te está diciendo la forma.
        </p>
      </div>
      {narrow ? (
        <>{list}{main}</>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "230px minmax(0, 1fr)", gap: "1.2rem", alignItems: "start" }}>
          {list}{main}
        </div>
      )}
      <Guia />
    </div>
  );
}

const Guia = memo(function Guia() {
  return (
    <div className="prose" style={{ maxWidth: "none", marginTop: "2.5rem" }}>
      <h2>Cómo leer la pantalla</h2>
      <ul>
        <li><b>Horizontal = tiempo.</b> La pantalla tiene 10 divisiones; si la base es 1 ms/div, ves 10 ms. Para un pulso de inyector usás 1–2 ms/div; para la sonda lambda, 0,5–1 s/div; para CAN, microsegundos.</li>
        <li><b>Vertical = tensión</b> (o corriente con pinza). 8 divisiones; con 2 V/div ves 16 V de alto. La flechita de la izquierda marca dónde está el 0 de cada canal.</li>
        <li><b>Disparo (trigger).</b> Hace que la imagen arranque siempre en el mismo evento (el hueco del CKP, el comienzo del pulso) y quede quieta. La marca “T” arriba muestra dónde disparó.</li>
        <li><b>Acople DC o AC.</b> En DC ves la tensión completa; en AC el equipo saca la parte continua y podés agrandar la ondulación (ripple del alternador).</li>
        <li><b>Congelar (hold).</b> Detiene la imagen para mirar un detalle o contar dientes.</li>
      </ul>
      <h2>Cuidados</h2>
      <ul>
        <li>Masa del osciloscopio siempre a una buena masa (negativo de batería o masa motor). Una masa mala agrega ruido y corre los niveles.</li>
        <li>Picos de bobina (300–400 V en el primario) y de inyectores: usá <b>atenuador x10</b> o una punta preparada. El secundario (kV) <b>sólo con pinza capacitiva</b>.</li>
        <li>Pinchá los cables por atrás de la ficha con agujas finas: no peles cables (entra agua y aparece verdín).</li>
      </ul>
      <p>
        Seguí con la lección de <Link to="/aprender/electricidad/p2l1">osciloscopio</Link>, los <Link to="/aprender/electricidad/a1l1">sensores</Link>,
        los <Link to="/aprender/electricidad/a1l2">actuadores</Link> y la <Link to="/aprender/electricidad/p1l2">red CAN</Link>. O probá el <Link to="/banco/motor">motor con scanner</Link>.
      </p>
    </div>
  );
});
