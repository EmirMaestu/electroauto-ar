/* Prueba de compresión simulada: elegís una falla, medís cada cilindro con el compresómetro
   (la aguja sube por pulsos, como en la realidad), hacés la prueba húmeda y sacás la conclusión. */
import { useEffect, useState } from "react";
import { AnimFrame, Seg, Toggle, useAnimClock, clamp, fmt, smoothstep } from "../ui/anim-kit";
import { D2R, useWide } from "./motor1-kit";

type Falla = "ok" | "aros" | "valvula" | "junta" | "altura";
const FALLAS: { value: Falla; label: string }[] = [
  { value: "ok", label: "Sin falla" },
  { value: "aros", label: "Aros gastados cil. 2" },
  { value: "valvula", label: "Válvula quemada cil. 3" },
  { value: "junta", label: "Junta de tapa 2-3" },
  { value: "altura", label: "Motor a 1.900 m" },
];
const BASE = [12.6, 12.3, 12.5, 12.4];
const PULSES = 6, PULSE_S = 0.48;

/** valor final (en seco o húmedo) y "velocidad" de subida por pulso (a menor a, sube más rápido) */
function spec(f: Falla, cyl: number, wet: boolean) {
  let v = BASE[cyl], a = 0.45;
  if (f === "aros" && cyl === 1) { v = wet ? 11.6 : 8.6; a = wet ? 0.5 : 0.7; }
  if (f === "valvula" && cyl === 2) { v = wet ? 6.1 : 5.8; a = 0.25; }
  if (f === "junta" && (cyl === 1 || cyl === 2)) { v = (cyl === 1 ? 7.4 : 7.7) + (wet ? 0.4 : 0); a = 0.35; }
  if (f === "altura") v *= 0.8;
  if (wet && !(f === "aros" && cyl === 1) && !(f === "junta" && (cyl === 1 || cyl === 2))) v += f === "valvula" && cyl === 2 ? 0 : 0.4;
  return { v, a };
}
const pulseValue = (final: number, a: number, k: number) => (final * (1 - Math.pow(a, k))) / (1 - Math.pow(a, PULSES));

interface Res { dry?: number; wet?: number }

export function PruebaCompresion() {
  const clock = useAnimClock({ autoplay: false });
  const [falla, setFalla] = useState<Falla>("aros");
  const [cyl, setCyl] = useState(0);
  const [wet, setWet] = useState(false);
  const [res, setRes] = useState<Res[]>([{}, {}, {}, {}]);
  const [meas, setMeas] = useState<{ cyl: number; wet: boolean; t0: number } | null>(null);
  const [held, setHeld] = useState(0);
  const wide = useWide(clock.ref, 600);

  const changeFalla = (f: Falla) => { setFalla(f); setRes([{}, {}, {}, {}]); setMeas(null); setHeld(0); setWet(false); };
  const medir = (c = cyl) => {
    setCyl(c);
    setHeld(0);
    setMeas({ cyl: c, wet, t0: clock.t + (wet ? 0.9 : 0.25) });
    clock.setPlaying(true);
  };

  // valor de la aguja
  let needle = held, pulse = 0, oilDrop = 0;
  if (meas) {
    const { v, a } = spec(falla, meas.cyl, meas.wet);
    const dt = clock.t - meas.t0;
    if (dt < 0) oilDrop = meas.wet ? clamp(1 + dt / 0.65, 0, 1) : 0;
    const k = Math.floor(Math.max(0, dt) / PULSE_S);
    pulse = Math.min(PULSES, k + (dt >= 0 ? 1 : 0));
    const local = Math.max(0, dt) - k * PULSE_S;
    const prev = pulseValue(v, a, Math.min(k, PULSES));
    const next = pulseValue(v, a, Math.min(k + 1, PULSES));
    needle = dt < 0 ? 0 : k >= PULSES ? v : prev + (next - prev) * smoothstep(0, 0.14, local);
  }
  useEffect(() => {
    if (!meas) return;
    if (clock.t - meas.t0 > PULSES * PULSE_S + 0.25) {
      const { v } = spec(falla, meas.cyl, meas.wet);
      setRes((r) => r.map((x, i) => (i === meas.cyl ? (meas.wet ? { ...x, wet: v } : { ...x, dry: v }) : x)));
      setHeld(v);
      setMeas(null);
      clock.setPlaying(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.t, meas, falla]);

  // ---------- conclusión
  const dry = res.map((r) => r.dry);
  const allDry = dry.every((d) => d !== undefined);
  let concl: { tone: string; text: string } = { tone: "var(--muted)", text: "Medí los 4 cilindros en seco (tocá cada agujero de bujía o usá el botón «Dar arranque»). Después, si alguno da bajo, repetí ese con «prueba húmeda»." };
  if (allDry) {
    const vals = dry as number[];
    const max = Math.max(...vals), min = Math.min(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / 4;
    const low = vals.map((v, i) => ({ v, i })).filter((x) => x.v < max * 0.88);
    if (low.length === 0) {
      concl = avg < 10.8
        ? { tone: "var(--warn)", text: `Los 4 parejos (diferencia ${fmt(((max - min) / max) * 100, 0)} %) pero todos algo bajos, ~${fmt(avg, 1)} bar. Si estás en altura es lo esperable: a 1.900 m la atmósfera empuja ~20 % menos, entonces el cilindro arranca con menos aire y la lectura baja. El dato de fábrica es a nivel del mar. Lo que manda es que estén parejos: motor sano.` }
        : { tone: "var(--ok)", text: `Motor sano: los 4 entre ${fmt(min, 1)} y ${fmt(max, 1)} bar, diferencia ${fmt(((max - min) / max) * 100, 0)} % (menos de 10–15 %). Aros, válvulas y junta sellan bien.` };
    } else {
      const names = low.map((x) => `cil. ${x.i + 1}`).join(" y ");
      const adjacent = low.length === 2 && Math.abs(low[0].i - low[1].i) === 1 && Math.abs(low[0].v - low[1].v) < 1;
      const wetDone = low.every((x) => res[x.i].wet !== undefined);
      if (!wetDone) {
        concl = { tone: "var(--warn)", text: `${names} da${low.length > 1 ? "n" : ""} bajo (${low.map((x) => fmt(x.v, 1)).join(" y ")} bar contra ${fmt(max, 1)} del mejor).${adjacent ? " Que sean dos vecinos parejamente bajos ya es una pista fuerte." : ""} Ahora hacé la prueba húmeda en ${low.length > 1 ? "esos cilindros" : "ese cilindro"}: activá «Prueba húmeda» y volvé a medir.` };
      } else {
        const rise = low.map((x) => ((res[x.i].wet as number) - x.v) / x.v);
        if (adjacent) concl = { tone: "var(--bad)", text: `Dos cilindros vecinos (${names}) bajos y parejos, y con aceite casi no suben: el gas se pasa de un cilindro al otro. Diagnóstico probable: junta de tapa quemada entre ${names}. Se confirma con la prueba de pérdidas: al meter aire en uno, sale por la bujía del otro.` };
        else if (rise.every((r) => r > 0.2)) concl = { tone: "var(--bad)", text: `En ${names} la compresión sube mucho con aceite (de ${fmt(low[0].v, 1)} a ${fmt(res[low[0].i].wet as number, 1)} bar, +${fmt(rise[0] * 100, 0)} %). El aceite sella lo que los aros no sellan: aros gastados o pegados, o cilindro rayado/ovalado. Mirá también si hay humo azul y consumo de aceite.` };
        else concl = { tone: "var(--bad)", text: `En ${names} con aceite casi no cambia (${fmt(low[0].v, 1)} → ${fmt(res[low[0].i].wet as number, 1)} bar). El aceite no puede sellar una válvula, así que la fuga está arriba: válvula quemada, doblada o mal asentada (o sin luz de válvula). Confirmalo con la prueba de pérdidas: el aire va a salir por el escape o por la admisión.` };
      }
    }
  }

  // ---------- dibujo
  const HX = [75, 145, 215, 285], HY = 62;
  const GX = 180, GY = 205, GR = 72;
  const gAng = (v: number) => (135 + 270 * clamp(v / 20, 0, 1.02)) * D2R;
  const pt = (v: number, r: number) => ({ x: GX + r * Math.cos(gAng(v)), y: GY + r * Math.sin(gAng(v)) });
  const nTip = pt(needle, GR - 12);
  const cranking = meas !== null && clock.t - meas.t0 >= 0 && pulse <= PULSES && clock.t - meas.t0 < PULSES * PULSE_S;
  const sel = meas ? meas.cyl : cyl;
  const panelA = (
    <g>
      {/* tapa vista de arriba */}
      <rect x={24} y={22} width={312} height={82} rx={10} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" />
      <text x={30} y={14} className="svg-small" style={{ fontWeight: 700 }}>tapa de cilindros (vista de arriba) · bujías afuera</text>
      {HX.map((x, i) => (
        <g key={i} style={{ cursor: "pointer" }} onClick={() => medir(i)}>
          <circle cx={x} cy={HY} r={22} fill={i === sel ? "var(--accent-soft)" : "transparent"} stroke={i === sel ? "var(--accent)" : "transparent"} strokeWidth={2} />
          <circle cx={x} cy={HY} r={11} fill="var(--c-metal-dark)" />
          <circle cx={x} cy={HY} r={7} fill="var(--c-rubber)" />
          <text x={x} y={HY - 27} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>cil. {i + 1}</text>
        </g>
      ))}
      <g style={{ pointerEvents: "none" }}>
      {/* gota de aceite (prueba húmeda) */}
      {oilDrop > 0 && <circle cx={HX[sel]} cy={HY - 30 + oilDrop * 26} r={4} fill="var(--c-oil)" opacity={1 - oilDrop * 0.6} />}
      {/* manguera */}
      <path d={`M${HX[sel]},${HY} C${HX[sel]},${HY + 70} ${GX},${GY - GR - 60} ${GX},${GY - GR - 6}`} fill="none" stroke="var(--c-rubber)" strokeWidth={6} strokeLinecap="round" />
      <path d={`M${HX[sel]},${HY} C${HX[sel]},${HY + 70} ${GX},${GY - GR - 60} ${GX},${GY - GR - 6}`} fill="none" stroke="var(--c-metal-2)" strokeWidth={1.5} strokeDasharray="2 5" />
      <circle cx={HX[sel]} cy={HY} r={6} fill="var(--accent)" />
      </g>
      {/* reloj */}
      <circle cx={GX} cy={GY} r={GR + 8} fill="var(--c-metal-dark)" />
      <circle cx={GX} cy={GY} r={GR} fill="var(--surface)" stroke="var(--border-strong)" />
      {Array.from({ length: 41 }, (_, j) => {
        const v = j * 0.5;
        const a = pt(v, GR - 3), b = pt(v, GR - (j % 4 === 0 ? 13 : j % 2 === 0 ? 9 : 6));
        return <line key={j} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text)" strokeWidth={j % 4 === 0 ? 1.6 : 0.8} />;
      })}
      {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((v) => {
        const p = pt(v, GR - 22);
        return <text key={v} x={p.x} y={p.y + 4} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: "var(--text)" }}>{v}</text>;
      })}
      {[50, 100, 150, 200, 250].map((psi) => {
        const p = pt(psi / 14.5, GR - 36);
        return <text key={psi} x={p.x} y={p.y + 3} textAnchor="middle" style={{ fontSize: 8, fill: "var(--muted)", opacity: 0.8 }}>{psi}</text>;
      })}
      <text x={GX} y={GY + 26} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>bar</text>
      <text x={GX} y={GY + 38} textAnchor="middle" style={{ fontSize: 8.5, fill: "var(--muted)" }}>psi</text>
      <line x1={GX} y1={GY} x2={nTip.x} y2={nTip.y} stroke="var(--bad)" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={GX} cy={GY} r={6} fill="var(--c-metal-dark)" />
      <rect x={GX + GR + 16} y={GY - 14} width={78} height={26} rx={6} fill="var(--surface-2)" stroke="var(--border)" />
      <text x={GX + GR + 55} y={GY + 4} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 700, fill: "var(--text)" }}>{fmt(needle, 1)} bar</text>
      {/* estado */}
      <text x={10} y={GY - 40} className="svg-small" style={{ fontWeight: 700, fill: cranking ? "var(--accent)" : "var(--muted)" }}>
        {meas ? (clock.t < meas.t0 ? (meas.wet ? "echando aceite…" : "preparando…") : cranking ? "dando arranque…" : "listo") : held ? "valor retenido" : "listo para medir"}
      </text>
      {meas && clock.t >= meas.t0 && (
        <g>
          <text x={10} y={GY - 24} className="svg-small">compresión {Math.min(pulse, PULSES)} de {PULSES}</text>
          {Array.from({ length: PULSES }, (_, j) => (
            <circle key={j} cx={14 + j * 12} cy={GY - 10} r={4} fill={j < pulse ? "var(--accent)" : "var(--surface-3)"} />
          ))}
        </g>
      )}
      {meas?.wet && <text x={350} y={GY - 40} textAnchor="end" className="svg-small" style={{ fill: "var(--c-oil)", fontWeight: 700 }}>prueba húmeda</text>}
    </g>
  );

  const bx0 = 50, bx1 = 350, by0 = 34, by1 = 236;
  const vmax = 16;
  const my = (v: number) => by1 - (v / vmax) * (by1 - by0);
  const maxDry = Math.max(0, ...dry.map((d) => d ?? 0));
  const panelB = (
    <g>
      <text x={10} y={16} className="svg-label">Resultados</text>
      <rect x={bx0} y={by0} width={bx1 - bx0} height={by1 - by0} rx={6} fill="var(--surface)" stroke="var(--border)" />
      <rect x={bx0} y={my(14)} width={bx1 - bx0} height={my(10) - my(14)} fill="var(--ok)" opacity={0.1} />
      <text x={bx1} y={by0 - 6} textAnchor="end" className="svg-small" style={{ fill: "var(--ok)", fontWeight: 700 }}>franja verde: típico nafta 10–14 bar</text>
      {[0, 4, 8, 12, 16].map((v) => (
        <g key={v}>
          <line x1={bx0} y1={my(v)} x2={bx1} y2={my(v)} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={bx0 - 5} y={my(v) + 3.5} textAnchor="end" className="svg-small">{v}</text>
        </g>
      ))}
      <text x={bx0 - 5} y={by0 - 6} textAnchor="end" className="svg-small">bar</text>
      {res.map((r, i) => {
        const x = bx0 + 22 + i * 72;
        const bad = r.dry !== undefined && maxDry > 0 && r.dry < maxDry * 0.88;
        return (
          <g key={i}>
            {r.dry !== undefined && (
              <g>
                <rect x={x} y={my(r.dry)} width={30} height={by1 - my(r.dry)} rx={3} fill={bad ? "var(--bad)" : "var(--primary)"} opacity={0.85} />
                <text x={x + 15} y={my(r.dry) - 5} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>{fmt(r.dry, 1)}</text>
              </g>
            )}
            {r.wet !== undefined && (
              <g>
                <rect x={x + 33} y={my(r.wet)} width={14} height={by1 - my(r.wet)} rx={3} fill="var(--c-oil)" opacity={0.85} />
                <text x={x + 40} y={my(r.wet) - 5} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: "var(--c-oil)" }}>{fmt(r.wet, 1)}</text>
              </g>
            )}
            <text x={x + 22} y={by1 + 15} textAnchor="middle" style={{ fontSize: 11, fontWeight: 800, fill: "var(--text)" }}>cil. {i + 1}</text>
            {r.dry !== undefined && maxDry > 0 && (
              <text x={x + 22} y={by1 + 28} textAnchor="middle" className="svg-small" style={{ fill: bad ? "var(--bad)" : "var(--muted)" }}>
                {r.dry === maxDry ? "el mejor" : `−${fmt(((maxDry - r.dry) / maxDry) * 100, 0)} %`}
              </text>
            )}
          </g>
        );
      })}
      <rect x={bx0 + 4} y={by1 + 36} width={10} height={10} rx={2} fill="var(--primary)" />
      <text x={bx0 + 18} y={by1 + 45} className="svg-small">en seco</text>
      <rect x={bx0 + 74} y={by1 + 36} width={10} height={10} rx={2} fill="var(--c-oil)" />
      <text x={bx0 + 88} y={by1 + 45} className="svg-small">con aceite (húmeda)</text>
    </g>
  );

  const W = wide ? 720 : 360, HA = 290, HB = 290;
  return (
    <AnimFrame
      title="Prueba de compresión: medí, compará y diagnosticá"
      tag="Banco de prueba"
      controls={
        <>
          <Seg value={falla} onChange={changeFalla} options={FALLAS} ariaLabel="Falla simulada" />
          <span className="ctl"><span>Cilindro</span>
            <Seg value={cyl} onChange={(c) => { if (!meas) setCyl(c); }} options={[0, 1, 2, 3].map((i) => ({ value: i, label: String(i + 1) }))} ariaLabel="Cilindro" />
          </span>
          <Toggle label="Prueba húmeda (aceite)" checked={wet} onChange={setWet} />
          <button className="btn accent sm" disabled={meas !== null} onClick={() => medir()}>Dar arranque ▶</button>
          <button className="btn ghost sm" onClick={() => { setRes([{}, {}, {}, {}]); setHeld(0); setMeas(null); }}>Borrar</button>
        </>
      }
      caption={
        <>
          <p>
            Como en el taller: motor caliente, <b>todas</b> las bujías afuera, inyectores (o bomba de nafta) desconectados, acelerador{" "}
            <b>a fondo</b> y batería cargada. Cada cilindro recibe unas 6 compresiones. Fijate <b>cómo sube la aguja</b>: en un cilindro
            sano el primer pulso ya marca más de la mitad; con aros gastados arranca bajo y va subiendo de a poco; con una válvula que no
            cierra, arranca bajo y se queda ahí.
          </p>
          <p>
            Los números de fábrica son a nivel del mar. Probá «Motor a 1.900 m»: todo da más bajo pero parejo. Por eso lo más importante
            es la <b>diferencia entre cilindros</b> (máximo 10–15 %), no el número suelto.
          </p>
        </>
      }
    >
      <div ref={clock.ref}>
        <svg viewBox={`0 0 ${W} ${wide ? Math.max(HA, HB) : HA + HB}`} role="img" aria-label="Compresómetro y resultados">
          <g>{panelA}</g>
          <g transform={wide ? "translate(360,0)" : `translate(0,${HA})`}>{panelB}</g>
        </svg>
        <div style={{ margin: ".4rem .2rem .2rem", padding: ".65rem .8rem", borderRadius: 10, border: "1px solid var(--border)", borderLeft: `4px solid ${concl.tone}`, background: "var(--surface)", fontSize: ".9rem", color: "var(--text-2)" }}>
          <b style={{ color: concl.tone }}>Conclusión: </b>{concl.text}
        </div>
      </div>
    </AnimFrame>
  );
}
