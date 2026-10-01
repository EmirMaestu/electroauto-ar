/* Turbo con wastegate e intercooler.
   Modelo simple pero coherente:
   - la energía de escape disponible crece con carga y rpm → velocidad "posible" del turbo;
   - relación de compresión del compresor ≈ 1 + k·(N/Nref)²;
   - la ECU busca una presión ABSOLUTA objetivo en el múltiple: a más altura, el turbo tiene que girar más
     para lograrla, hasta su límite de vueltas (después cae la presión);
   - temperatura después del compresor por compresión adiabática con rendimiento 72 %; intercooler 75 % efectivo;
   - el torque disponible es proporcional a la masa de aire (p/T) frente a la del mismo motor a nivel del mar. */
import { useRef, useState } from "react";
import { AnimFrame, Readout, Slider, useAnimClock, Arrow, clamp, lerp, smoothstep, fmt, TAU } from "../ui/anim-kit";

type Pt = [number, number];
function poly(pts: Pt[]) {
  const acc: number[] = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = acc[acc.length - 1];
  const at = (s: number) => {
    const u = ((s % L) + L) % L;
    let i = 1;
    while (i < acc.length - 1 && acc[i] < u) i++;
    const f = (u - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    return { x: lerp(pts[i - 1][0], pts[i][0], f), y: lerp(pts[i - 1][1], pts[i][1], f), u: u / L };
  };
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  return { L, at, d };
}

type Fault = "ninguna" | "manguera" | "wg_cerrada" | "wg_abierta";
const N_REF = 240_000;
const N_LIM = 235_000; // la ECU no deja pasar de acá (protección del turbo)
const patm = (h: number) => 1.01325 * Math.pow(1 - 2.25577e-5 * h, 5.25588); // bar
const tAmbAt = (h: number) => 30 - 6.5 * ((h - 750) / 1000); // día de verano: 30 °C en el Gran Mendoza
const prOf = (N: number) => 1 + 1.75 * (N / N_REF) ** 2;
const nForPr = (pr: number) => N_REF * Math.sqrt(Math.max(0, (pr - 1) / 1.75));
const T2of = (t1K: number, pr: number) => t1K * (1 + (Math.pow(pr, 0.286) - 1) / 0.72);
// referencia: a fondo, nivel del mar, sano
const REF = (() => {
  const t1 = tAmbAt(0) + 273.15, pr = 2.1 / patm(0);
  const t2 = T2of(t1, pr), t3 = t2 - 0.75 * (t2 - t1);
  return 2.1 / t3;
})();

/* -------------------------------------------------------------- geometría */
const AX = 130; // eje del turbo
const P_AIR_IN = poly([[14, 130], [232, 130], [282, 130]]);
const P_AIR_HOT = poly([[305, 214], [305, 228], [100, 228]]);
const P_AIR_IC = poly([[70, 232], [70, 340]]);
const P_AIR_COOL = poly([[100, 344], [200, 344], [200, 384], [470, 384]]);
const P_EXH_IN = poly([[300, 266], [414, 250], [414, 214]]);
const P_EXH_OUT = poly([[444, 130], [530, 130], [530, 416]]);
const P_WG = poly([[420, 238], [530, 238]]);
const CYL = [285, 335, 385, 435];

export function Turbo() {
  const clock = useAnimClock({ speed: 1 });
  const [thr, setThr] = useState(100);
  const [rpm, setRpm] = useState(2500);
  const [alt, setAlt] = useState(750);
  const [fault, setFault] = useState<Fault>("ninguna");
  const st = useRef({ last: clock.t, N: 60_000, under: 0, over: 0, dtc: "", fault: "ninguna" as Fault, ph: {} as Record<string, number>, rot: 0, crank: 0 });
  const s = st.current;
  let dt = clock.t - s.last;
  if (dt < 0) dt = 0;
  s.last = clock.t;
  dt = Math.min(dt, 0.1);
  if (s.fault !== fault) { s.fault = fault; s.dtc = ""; s.under = 0; s.over = 0; }

  const th = thr / 100;
  const pA = patm(alt);
  const tA = tAmbAt(alt);
  const X = Math.pow(th, 1.2) * Math.pow(rpm / 1000, 1.5);
  let nAvail = 280_000 * (1 - Math.exp(-X / 2.2));
  if (fault === "wg_abierta") nAvail *= 0.42; // los gases se van por la wastegate abierta
  // bar absolutos que pide la ECU; en altura lo recorta para no pasar de vueltas el turbo
  const mapTarget = Math.min(pA + th * (2.1 - pA), pA * prOf(N_LIM));
  const leak = fault === "manguera" ? 0.45 : 1;
  // en falla de manguera la ECU ve poca presión y cierra la wastegate del todo
  const prNeeded = Math.max(1, (mapTarget - pA) / leak / pA + 1);
  const nNeeded = nForPr(prNeeded);
  let nTarget: number;
  if (fault === "wg_cerrada") nTarget = Math.min(nAvail, 262_000);
  else if (fault === "manguera") nTarget = Math.min(nAvail, N_LIM);
  else nTarget = Math.min(nAvail, nNeeded, N_LIM);
  // apertura de régimen; mientras el turbo está tomando vueltas la ECU la deja cerrada
  const wgSteady = nAvail > 1 ? clamp(((nAvail - nTarget) / nAvail) * 2.2, 0, 1) : 0;
  const wgNow = wgSteady * smoothstep(0.88, 0.985, s.N / Math.max(nTarget, 1));
  const wg = fault === "wg_cerrada" ? 0 : fault === "wg_abierta" ? 1 : wgNow;
  // inercia del turbo (retraso)
  const tau = nTarget > s.N ? 1.1 : 0.6;
  s.N += (nTarget - s.N) * (1 - Math.exp(-dt / tau));
  const N = s.N;
  const pr = prOf(N);
  const map = pA * (1 + (pr - 1) * leak);
  const boost = map - pA;
  const t1K = tA + 273.15;
  const t2K = T2of(t1K, pr);
  const t3K = t2K - 0.75 * (t2K - t1K);
  const airRatio = (map / t3K) / REF;
  const torqueTurbo = Math.min(th, airRatio) * 100;
  const torqueNA = Math.min(th, pA / patm(0)) * 100;

  // diagnóstico
  const canReach = nAvail >= nNeeded * 0.92 || fault === "wg_abierta" || fault === "manguera";
  // como la ECU real: sólo juzga en régimen estable (no mientras el turbo está tomando vueltas)
  const steady = Math.abs(nTarget - s.N) < 0.06 * Math.max(nTarget, 1);
  if (steady && th > 0.6 && rpm >= 1800 && map < mapTarget - 0.2 && canReach) s.under += dt; else s.under = Math.max(0, s.under - dt);
  if (map > mapTarget + 0.25) s.over += dt; else s.over = Math.max(0, s.over - dt);
  if (s.under > 1.5) s.dtc = "P0299 subalimentación";
  if (s.over > 1) s.dtc = "P0234 sobrealimentación";

  // fases de partículas
  const adv = (k: string, v: number) => { s.ph[k] = (s.ph[k] ?? 0) + v * dt; return s.ph[k]; };
  const airFlow = (map / pA) * (rpm / 2500) * 0.5 + 0.2;
  const vAir = 30 + 80 * clamp(airFlow, 0, 1.8);
  const vExh = 30 + 90 * clamp(th * (rpm / 3000) + 0.15, 0, 1.6);
  s.rot += (N / 22_000) * dt;
  s.crank += (rpm / 900) * dt;

  const c2 = t2K - 273.15, c3 = t3K - 273.15;
  const hotAir = `color-mix(in srgb, var(--c-hot) ${Math.round(clamp((c2 - 30) / 120, 0, 1) * 85)}%, var(--c-air))`;
  const coolAir = `color-mix(in srgb, var(--c-hot) ${Math.round(clamp((c3 - 30) / 120, 0, 1) * 85)}%, var(--c-air))`;

  const dots = (p: ReturnType<typeof poly>, n: number, ph: number, col: (u: number) => string, r = 3.2, op = 1) =>
    Array.from({ length: n }, (_, i) => {
      const q = p.at(ph + (i * p.L) / n);
      return <circle key={i} cx={q.x} cy={q.y} r={r} style={{ fill: col(q.u) }} opacity={op} stroke="var(--surface)" strokeWidth={0.6} />;
    });
  const duct = (d: string, w: number, col: string, op = 0.3) => (
    <g>
      <path d={d} fill="none" stroke="var(--c-metal-2)" strokeWidth={w + 3} strokeLinejoin="round" />
      <path d={d} fill="none" stroke="var(--surface)" strokeWidth={w} strokeLinejoin="round" />
      <path d={d} fill="none" style={{ stroke: col }} strokeOpacity={op} strokeWidth={w} strokeLinejoin="round" />
    </g>
  );

  // rueda vista de perfil: álabes que suben y bajan al girar
  const wheel = (xa: number, xb: number, ra: number, rb: number, rot: number, n: number, col: string) => {
    const env = (sign: number) => {
      let d = "";
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        const r = lerp(ra, rb, Math.pow(u, 1.4));
        d += `${k ? "L" : "M"}${lerp(xa, xb, u)},${AX + sign * r}`;
      }
      return d;
    };
    const top = env(-1), bot = env(1);
    const blades = Array.from({ length: n }, (_, k) => {
      const ph = rot + (k * TAU) / n;
      const c = Math.cos(ph);
      if (c < -0.1) return null;
      let d = "";
      for (let j = 0; j <= 8; j++) {
        const u = j / 8;
        const r = lerp(ra, rb, Math.pow(u, 1.4));
        d += `${j ? "L" : "M"}${lerp(xa, xb, u)},${AX + r * Math.sin(ph)}`;
      }
      return <path key={k} d={d} fill="none" stroke={col} strokeWidth={1.6} opacity={0.35 + 0.65 * Math.max(0, c)} />;
    });
    return (
      <g>
        <path d={`${top} ${bot.replace("M", "L").split(" ").reverse().join(" ")}`} fill="var(--c-metal-light)" opacity={0.35} />
        {blades}
        <path d={top} fill="none" stroke={col} strokeWidth={1.2} opacity={0.6} />
        <path d={bot} fill="none" stroke={col} strokeWidth={1.2} opacity={0.6} />
      </g>
    );
  };

  const firing = Math.floor(((s.crank / Math.PI) % 4 + 4) % 4); // 1-3-4-2
  const order = [0, 2, 3, 1];
  const wgAng = wg * 0.9;

  return (
    <AnimFrame
      title="Turbo: los gases de escape soplan aire en la admisión"
      clock={clock}
      controls={
        <>
          <Slider label="Acelerador" value={thr} min={0} max={100} step={5} unit="%" onChange={setThr} />
          <Slider label="RPM motor" value={rpm} min={1000} max={4500} step={100} onChange={setRpm} />
          <Slider label="Altura" value={alt} min={0} max={3500} step={50} unit="m" onChange={setAlt} format={(v) => fmt(v, 0)} />
          <label className="ctl">
            <span>Falla</span>
            <select value={fault} onChange={(e) => setFault(e.target.value as Fault)}>
              <option value="ninguna">Ninguna</option>
              <option value="manguera">Manguera del intercooler floja</option>
              <option value="wg_abierta">Wastegate trabada abierta</option>
              <option value="wg_cerrada">Wastegate trabada cerrada</option>
            </select>
          </label>
        </>
      }
      readouts={
        <>
          <Readout label="Turbo" value={fmt(Math.round(N / 1000) * 1000, 0)} unit="rpm" tone={N > N_LIM + 5000 ? "bad" : "accent"} />
          <Readout label="Soplado" value={fmt(boost, 2)} unit="bar" tone={s.dtc ? "bad" : undefined} />
          <Readout label="MAP absoluta" value={fmt(map * 100, 0)} unit="kPa" />
          <Readout label="Aire post compresor" value={fmt(c2, 0)} unit="°C" tone={c2 > 150 ? "warn" : undefined} />
          <Readout label="Post intercooler" value={fmt(c3, 0)} unit="°C" />
          <Readout label="Wastegate" value={fmt(wg * 100, 0)} unit="% abierta" />
          <Readout label="Torque turbo" value={fmt(torqueTurbo, 0)} unit="%" tone="ok" />
          <Readout label="Atmosf. acá" value={fmt(torqueNA, 0)} unit="%" />
        </>
      }
      legend={[
        { color: "var(--c-air)", label: "Aire frío" },
        { color: "var(--c-flame)", label: "Aire comprimido caliente" },
        { color: "var(--c-hot)", label: "Gases de escape" },
        { color: "var(--c-oil)", label: "Aceite del turbo" },
      ]}
      caption={
        <>
          <p>
            Los gases de escape, que igual iban a salir, pasan por la <b>turbina</b> y la hacen girar a cientos de miles de vueltas. En el
            mismo eje está el <b>compresor</b>, que mete aire a presión en la admisión. Al comprimirlo el aire se calienta (fijate la
            lectura “post compresor”); el <b>intercooler</b> lo enfría para que entre más denso. Cuando se llega a la presión que pide la
            ECU, la <b>wastegate</b> abre y desvía parte de los gases por afuera de la turbina para que no siga acelerando. Mové el
            acelerador de golpe y mirá el <b>retraso</b>: el turbo tarda en tomar vueltas.
          </p>
          <p>
            Subí la altura: la ECU pide la misma presión <i>absoluta</i>, así que el turbo gira más rápido para compensar el aire más
            liviano, hasta su límite de vueltas. Por eso un turbo pierde poco hasta Uspallata y algo en Las Cuevas, mientras que un
            atmosférico pierde casi 1 % cada 100 m. (Los torques son a fondo, comparados con el mismo motor al nivel del mar).
          </p>
        </>
      }
    >
      <svg viewBox="0 0 720 430" role="img" aria-label="Esquema de un turbo con wastegate e intercooler">
        {/* ---------- conductos */}
        {duct(P_AIR_IN.d, 26, "var(--c-air)", 0.18)}
        {duct(P_AIR_HOT.d, 14, hotAir, 0.35)}
        {duct(P_AIR_COOL.d, 14, coolAir, 0.3)}
        {duct("M414,214 L414,250 L300,266", 14, "var(--c-hot)", 0.3)}
        {duct(P_EXH_OUT.d, 18, "var(--c-exhaust)", 0.3)}
        {duct(P_WG.d, 9, "var(--c-hot)", wg > 0.05 ? 0.4 : 0.1)}

        {/* ---------- filtro de aire */}
        <rect x={30} y={102} width={140} height={56} rx={10} fill="var(--surface-2)" stroke="var(--c-metal-2)" strokeWidth={2} />
        {Array.from({ length: 13 }, (_, i) => (
          <path key={i} d={`M${48 + i * 8},108 l4,8 l-4,8 l4,8 l-4,8 l4,8 l-4,8`} fill="none" stroke="var(--c-fuel)" strokeWidth={1.2} opacity={0.75} />
        ))}
        <text x={100} y={96} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>filtro de aire</text>

        {/* ---------- intercooler */}
        <rect x={40} y={218} width={60} height={14} rx={3} fill="var(--c-metal-dark)" />
        <rect x={40} y={336} width={60} height={14} rx={3} fill="var(--c-metal-dark)" />
        <rect x={44} y={232} width={52} height={104} fill="var(--c-metal-light)" opacity={0.6} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1={44} x2={96} y1={236 + i * 8.5} y2={236 + i * 8.5} stroke="var(--c-metal-2)" strokeWidth={1} />
        ))}
        {[250, 284, 318].map((y, i) => {
          const k = (clock.t * 0.9 + i * 0.3) % 1;
          return <Arrow key={y} x1={8 + k * 6} y1={y} x2={34 + k * 6} y2={y} color="var(--c-air)" width={2} head={7} opacity={0.6} />;
        })}
        <text x={70} y={370} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>intercooler</text>
        <text x={204} y={220} textAnchor="middle" className="svg-mono" style={{ fill: c2 > 120 ? "var(--c-hot)" : "var(--text-2)", fontSize: 11 }}>{fmt(c2, 0)} °C</text>
        <text x={150} y={336} textAnchor="middle" className="svg-mono" style={{ fill: "var(--text-2)", fontSize: 11 }}>{fmt(c3, 0)} °C</text>
        <text x={204} y={146} textAnchor="middle" className="svg-mono" style={{ fill: "var(--text-2)", fontSize: 11 }}>{fmt(tA, 0)} °C</text>

        {/* ---------- motor (visto de arriba) */}
        <rect x={250} y={290} width={220} height={74} rx={10} fill="var(--c-block)" stroke="var(--c-metal-2)" />
        {CYL.map((x, i) => {
          const on = order[firing] === i;
          return (
            <g key={x}>
              <line x1={x} x2={x} y1={364} y2={384} stroke="var(--c-metal-2)" strokeWidth={10} />
              <line x1={x} x2={x} y1={276} y2={290} stroke="var(--c-metal-2)" strokeWidth={10} />
              <circle cx={x} cy={327} r={21} fill="var(--c-metal-dark)" />
              <circle cx={x} cy={327} r={17} fill="var(--c-hot)" opacity={on ? 0.25 + 0.6 * th : 0.08} />
            </g>
          );
        })}
        <text x={360} y={412} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>múltiple de admisión → cilindros</text>
        <path d="M290,276 L430,276" stroke="var(--c-metal-2)" strokeWidth={10} strokeLinecap="round" />

        {/* ---------- partículas */}
        {dots(P_AIR_IN, 10, adv("ain", vAir), () => "var(--c-air)")}
        {dots(P_AIR_HOT, 8, adv("ahot", vAir), () => hotAir)}
        {dots(P_AIR_IC, 5, adv("aic", vAir * 0.6), (u) => `color-mix(in srgb, ${coolAir} ${Math.round(u * 100)}%, ${hotAir})`)}
        {dots(P_AIR_COOL, 14, adv("acool", vAir), () => coolAir)}
        {dots(P_EXH_IN, 6, adv("ein", vExh), () => "var(--c-hot)", 3.4)}
        {dots(P_EXH_OUT, 13, adv("eout", vExh), (u) => `color-mix(in srgb, var(--c-exhaust) ${Math.round(40 + u * 60)}%, var(--c-hot))`, 3.4)}
        {wg > 0.05 && dots(P_WG, 5, adv("wg", vExh * (0.5 + wg)), () => "var(--c-hot)", 3)}
        {fault === "manguera" && [0, 1, 2, 3].map((i) => {
          const k = (clock.t * 1.4 + i / 4) % 1;
          return <circle key={i} cx={180 + Math.sin(i * 2.1) * 6 + k * 8} cy={222 - k * 34} r={2.5 + k * 4} style={{ fill: hotAir }} opacity={0.8 * (1 - k)} />;
        })}
        {fault === "manguera" && <text x={170} y={186} textAnchor="middle" className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>¡pérdida!</text>}

        {/* ---------- turbo en corte */}
        {/* carcasa del compresor */}
        <path d={`M282,98 L282,82 Q300,56 330,58 L330,202 Q300,204 282,178 L282,162`} fill="var(--c-metal)" opacity={0.55} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={305} cy={68} r={20} fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={305} cy={68} r={18} style={{ fill: hotAir }} opacity={0.35} />
        <circle cx={305} cy={192} r={20} fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={305} cy={192} r={18} style={{ fill: hotAir }} opacity={0.35} />
        {/* carcasa de la turbina */}
        <path d={`M444,98 L444,80 Q420,54 392,56 L392,204 Q420,206 444,180 L444,162`} fill="var(--c-metal-dark)" opacity={0.55} stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={414} cy={66} r={20} fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={414} cy={66} r={18} fill="var(--c-hot)" opacity={0.3 + 0.3 * th} />
        <circle cx={414} cy={194} r={20} fill="var(--surface)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={414} cy={194} r={18} fill="var(--c-hot)" opacity={0.3 + 0.3 * th} />
        {/* carcasa central con aceite */}
        <rect x={330} y={104} width={62} height={52} rx={4} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <rect x={338} y={120} width={46} height={20} rx={3} fill="var(--c-oil)" opacity={0.55} />
        <line x1={361} x2={361} y1={52} y2={104} stroke="var(--c-oil)" strokeWidth={5} />
        <line x1={361} x2={361} y1={156} y2={180} stroke="var(--c-oil)" strokeWidth={6} />
        <text x={361} y={44} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-oil)", fontWeight: 700 }}>aceite</text>
        {/* eje y ruedas */}
        <line x1={286} x2={440} y1={AX} y2={AX} stroke="var(--c-metal-dark)" strokeWidth={6} />
        {wheel(284, 328, 18, 40, s.rot, 10, "var(--c-air)")}
        {wheel(440, 394, 24, 42, -s.rot, 11, "var(--c-hot)")}
        <text x={305} y={36} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-air)", fontWeight: 700 }}>compresor</text>
        <text x={414} y={36} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-hot)", fontWeight: 700 }}>turbina</text>

        {/* ---------- wastegate */}
        <circle cx={430} cy={238} r={3.5} fill="var(--c-metal-dark)" />
        <line x1={430} y1={238} x2={430 + 18 * Math.cos(-Math.PI / 2 + wgAng)} y2={238 + 18 * Math.sin(-Math.PI / 2 + wgAng) + 18} stroke={fault === "wg_cerrada" || fault === "wg_abierta" ? "var(--bad)" : "var(--accent)"} strokeWidth={4} strokeLinecap="round" />
        <circle cx={492} cy={270} r={14} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <line x1={481} y1={262} x2={438} y2={250 + wg * 6} stroke="var(--c-metal-dark)" strokeWidth={2.5} />
        <text x={494} y={298} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>wastegate</text>
        <path d="M506,268 L560,268 L560,150" fill="none" stroke="var(--c-elec)" strokeWidth={1.3} strokeDasharray="4 3" />

        {/* ---------- escape */}
        <rect x={512} y={296} width={36} height={56} rx={8} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" />
        {Array.from({ length: 5 }, (_, i) => <line key={i} x1={516} x2={544} y1={304 + i * 10} y2={304 + i * 10} stroke="var(--c-metal-light)" strokeWidth={1} />)}
        <text x={556} y={328} className="svg-small" style={{ fill: "var(--text-2)" }}>catalizador</text>
        <text x={540} y={424} className="svg-small">escape</text>
        <text x={355} y={246} textAnchor="middle" className="svg-small" style={{ fill: "var(--text-2)" }}>múltiple de escape</text>

        {/* ---------- scanner */}
        <rect x={566} y={14} width={146} height={136} rx={10} fill="var(--surface-2)" stroke="var(--c-elec)" strokeWidth={1.5} />
        <text x={578} y={33} className="svg-small" style={{ fill: "var(--c-elec)", fontWeight: 700, letterSpacing: ".08em" }}>SCANNER</text>
        <text x={578} y={54} className="svg-small">soplado pedido</text>
        <text x={702} y={54} textAnchor="end" className="svg-mono">{fmt(mapTarget - pA, 2)}</text>
        <text x={578} y={74} className="svg-small">soplado real</text>
        <text x={702} y={74} textAnchor="end" className="svg-mono" style={{ fill: s.dtc ? "var(--bad)" : "var(--text)" }}>{fmt(boost, 2)}</text>
        <text x={578} y={94} className="svg-small">control WG (PWM)</text>
        <text x={702} y={94} textAnchor="end" className="svg-mono">{fmt((1 - wg) * 85 + 5, 0)} %</text>
        <text x={578} y={114} className="svg-small">presión atmosf.</text>
        <text x={702} y={114} textAnchor="end" className="svg-mono">{fmt(pA * 1000, 0)}</text>
        {s.dtc ? (
          <>
            <text x={639} y={133} textAnchor="middle" className="svg-mono" style={{ fill: "var(--bad)" }}>{s.dtc.split(" ")[0]}</text>
            <text x={639} y={145} textAnchor="middle" className="svg-small" style={{ fill: "var(--bad)" }}>{s.dtc.split(" ").slice(1).join(" ")}</text>
          </>
        ) : (
          <text x={639} y={138} textAnchor="middle" className="svg-mono" style={{ fill: "var(--ok)" }}>sin códigos</text>
        )}
      </svg>
    </AnimFrame>
  );
}
