/* Diagrama de Sankey animado: a dónde va la energía que cargás en el tanque (o en la batería).
   Valores aproximados de un auto mediano, en ciudad y en ruta. Toggle naftero / eléctrico. */
import { useEffect, useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Arrow, useAnimClock, clamp, lerp, smoothstep, fmt } from "../ui/anim-kit";

type Modo = "nafta" | "ev";
type Uso = "ciudad" | "ruta";

interface Perdida { name: string; short: string; color: string }
const PERD: Record<Modo, Perdida[]> = {
  nafta: [
    { name: "Escape: gases calientes que salen por el caño", short: "escape", color: "var(--c-exhaust)" },
    { name: "Refrigeración: calor que se tira por el radiador", short: "radiador", color: "var(--c-coolant)" },
    { name: "Rozamientos internos: aros, metales, distribución", short: "rozamiento", color: "var(--c-oil)" },
    { name: "Bombeo: lo que cuesta aspirar a través de la mariposa", short: "bombeo", color: "var(--c-air)" },
    { name: "Accesorios: alternador, bomba de agua, aire acondicionado", short: "accesorios", color: "var(--c-elec)" },
    { name: "Caja y diferencial: engranajes y aceite", short: "caja", color: "var(--primary)" },
  ],
  ev: [
    { name: "Inversor: electrónica de potencia que calienta", short: "inversor", color: "var(--c-elec)" },
    { name: "Motor eléctrico: calor en bobinados e imanes", short: "motor", color: "var(--accent)" },
    { name: "Reductor y diferencial: engranajes", short: "reductor", color: "var(--primary)" },
    { name: "Clima y red de 12 V", short: "clima y 12 V", color: "var(--c-air)" },
    { name: "", short: "", color: "var(--border)" },
    { name: "", short: "", color: "var(--border)" },
  ],
};
const SALIDAS = [
  { short: "aire", name: "Empujar el aire", color: "var(--c-mix)" },
  { short: "rodadura", name: "Deformar las cubiertas", color: "var(--c-metal-2)" },
  { short: "frenos", name: "Calor en los frenos", color: "var(--c-hot)" },
];

/* [6 pérdidas] + [aire, rodadura, frenos]. Lo que llega a la rueda = 100 − pérdidas. */
const DATA: Record<Modo, Record<Uso, number[]>> = {
  nafta: {
    ciudad: [33, 30, 9, 7, 4, 2, /* → 15 */ 3, 5, 7],
    ruta: [34, 28, 6, 3, 2, 2, /* → 25 */ 13, 9, 3],
  },
  ev: {
    ciudad: [3, 5, 2, 3, 0, 0, /* → 87 */ 17, 31, 39],
    ruta: [2, 5, 2, 2, 0, 0, /* → 89 */ 48, 33, 8],
  },
};

function useTween(target: number[], dur = 750) {
  const [val, setVal] = useState(target);
  const cur = useRef(target);
  cur.current = val;
  const key = target.join(",");
  useEffect(() => {
    const from = cur.current.slice();
    const to = target;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = smoothstep(0, 1, (now - t0) / dur);
      setVal(from.map((f, i) => lerp(f, to[i], p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dur]);
  return val;
}

function useFontScale(ref: React.RefObject<SVGSVGElement | null>, max = 1.45) {
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

const S = 1.7; // px por cada 1 %
const Y0 = 78;
const R0 = 12;
const Y_END = 292;
const SRC_X = 22, SRC_W = 22;

export function FlujoEnergia() {
  const clock = useAnimClock({ speed: 1 });
  const [modo, setModo] = useState<Modo>("nafta");
  const [uso, setUso] = useState<Uso>("ciudad");
  const svgRef = useRef<SVGSVGElement>(null);
  const k = useFontScale(svgRef);
  const v = useTween(DATA[modo][uso]);
  const t = Math.max(0, clock.t);
  const flow = -t * 30;

  const losses = v.slice(0, 6);
  const outs = v.slice(6);
  const wheels = 100 - losses.reduce((a, b) => a + b, 0);
  const perd = PERD[modo];
  const ev = modo === "ev";

  // Posición de cada pérdida a lo largo del tronco
  const slots: { x: number; w: number; yt: number; yb: number; pct: number; i: number }[] = [];
  let rem = 100;
  let x = 78;
  losses.forEach((p, i) => {
    const w = p * S;
    const yb = Y0 + rem * S;
    const yt = yb - w;
    slots.push({ x, w, yt, yb, pct: p, i });
    rem -= p;
    x += Math.max(p > 0.3 ? 64 : 0, R0 + w + 16);
  });
  const nodeX = Math.max(x - 10, 450);
  const wheelsH = wheels * S;

  // Salidas desde "ruedas" hacia la derecha, separadas
  const gap = 16;
  const outsH = outs.map((o) => o * S);
  const fanH = outsH.reduce((a, b) => a + b, 0) + gap * 2;
  const fanTop = clamp(Y0 + wheelsH / 2 - fanH / 2, 26, 300 - fanH);
  const OUT_X = 604;
  let accIn = Y0, accOut = fanTop;
  const fan = outsH.map((h, i) => {
    const a = { y0: accIn, y1: accIn + h, z0: accOut, z1: accOut + h, h, i };
    accIn += h;
    accOut += h + gap;
    return a;
  });

  const fs = 12.5 * k;
  const heat = ev ? losses[0] + losses[1] : losses[0] + losses[1];
  const per10 = wheels / 10;

  const band = (s: (typeof slots)[number]) => {
    const { x: bx, w, yt, yb } = s;
    const xo = bx + R0 + w, xi = bx + R0;
    return `M${bx},${yt} A${R0 + w},${R0 + w} 0 0 1 ${xo},${yb + R0} L${xo},${Y_END} L${xi},${Y_END} L${xi},${yb + R0} A${R0},${R0} 0 0 0 ${bx},${yb} Z`;
  };
  const bandCenter = (s: (typeof slots)[number]) => {
    const r = R0 + s.w / 2;
    const cx = s.x, cy = s.yb + R0;
    return `M${SRC_X + SRC_W},${s.yt + s.w / 2} L${s.x},${s.yt + s.w / 2} A${r},${r} 0 0 1 ${cx + r},${cy} L${cx + r},${Y_END}`;
  };

  // tronco: un solo polígono escalonado (sin costuras)
  const trunkPath = (() => {
    let d = `M${SRC_X + SRC_W},${Y0} L${nodeX},${Y0} L${nodeX},${Y0 + wheelsH}`;
    for (let i = slots.length - 1; i >= 0; i--) {
      const sl = slots[i];
      d += ` L${sl.x},${sl.yt} L${sl.x},${sl.yb}`;
    }
    d += ` L${SRC_X + SRC_W},${Y0 + 100 * S} Z`;
    return d;
  })();
  const trunkCenter = `M${SRC_X + SRC_W},${Y0 + wheelsH / 2} L${nodeX},${Y0 + wheelsH / 2}`;

  const visibleSlots = slots.filter((s) => s.pct > 0.4);

  return (
    <AnimFrame
      title="¿A dónde va la energía que cargás?"
      clock={clock}
      controls={
        <>
          <Seg value={modo} onChange={setModo} ariaLabel="Tipo de auto" options={[{ value: "nafta", label: "⛽ Naftero" }, { value: "ev", label: "🔋 Eléctrico" }]} />
          <Seg value={uso} onChange={setUso} ariaLabel="Uso" options={[{ value: "ciudad", label: "🚦 Ciudad" }, { value: "ruta", label: "🛣️ Ruta" }]} />
        </>
      }
      readouts={
        <>
          <Readout label="Llega a las ruedas" value={fmt(wheels, 0)} unit="%" tone="ok" />
          <Readout label={ev ? "Pérdidas en el camino" : "Calor: escape + radiador"} value={fmt(ev ? 100 - wheels : heat, 0)} unit="%" tone={ev ? undefined : "bad"} />
          <Readout label={ev ? "De cada 10 kWh mueven el auto" : "De cada 10 L mueven el auto"} value={fmt(per10, 1)} unit={ev ? "kWh" : "litros"} tone="accent" />
          <Readout label="Se va en frenar" value={fmt(outs[2], 0)} unit="%" tone={outs[2] > 20 ? "warn" : undefined} />
        </>
      }
      legend={[
        ...perd.filter((p) => p.name).map((p) => ({ color: p.color, label: p.name })),
        ...SALIDAS.map((o) => ({ color: o.color, label: o.name })),
      ]}
      caption={
        <>
          <p>
            El ancho de cada banda es la parte de la energía que se va por ahí. En un <b>naftero</b>, de todo lo que cargás en el tanque
            sólo llega a las ruedas más o menos un <b>15 % en ciudad</b> y un <b>25 % en ruta</b>: el resto se va en calor por el escape y por el
            radiador, en rozamientos y en «respirar». En ciudad es peor porque el motor trabaja casi siempre con poca carga, la mariposa
            casi cerrada y muchos ratos en ralentí.
          </p>
          <p>
            En un <b>eléctrico</b> llega a las ruedas cerca del <b>85–90 %</b> de lo que sale de la batería (sin contar lo que se pierde al cargarla,
            que suele andar en un 10 %). Y lo que se iría en <b>frenos</b> vuelve en buena parte a la batería: el motor frena funcionando como generador.
            Los números son aproximados para un auto mediano; cambian con el modelo, la velocidad y cómo lo manejás.
          </p>
        </>
      }
    >
      <svg ref={svgRef} viewBox="0 0 720 384" role="img" aria-label="Diagrama de flujo de energía">
        {/* fuente */}
        <rect x={SRC_X} y={Y0} width={SRC_W} height={100 * S} rx={4} fill={ev ? "var(--c-elec)" : "var(--c-fuel)"} />
        <text x={SRC_X + SRC_W + 8} y={Y0 - 10} style={{ fontSize: fs * 1.05, fontWeight: 750, fill: "var(--text)" }}>
          {ev ? "🔋 Batería" : "⛽ Nafta"} 100 %
        </text>

        {/* tronco */}
        <path d={trunkPath} fill={ev ? "var(--c-elec)" : "var(--c-fuel)"} opacity={0.6} />
        {/* pérdidas */}
        {slots.map((s) => (s.pct > 0.05 ? <path key={s.i} d={band(s)} fill={perd[s.i].color} opacity={0.82} /> : null))}

        {/* nodo ruedas y salidas */}
        <rect x={nodeX} y={Y0} width={12} height={wheelsH} rx={3} fill="var(--ok)" />
        {fan.map((f) => {
          const x0 = nodeX + 12, x1 = OUT_X;
          const mx = (x0 + x1) / 2;
          const d = `M${x0},${f.y0} C${mx},${f.y0} ${mx},${f.z0} ${x1},${f.z0} L${x1},${f.z1} C${mx},${f.z1} ${mx},${f.y1} ${x0},${f.y1} Z`;
          return <path key={f.i} d={d} fill={SALIDAS[f.i].color} opacity={0.8} />;
        })}

        {/* partículas de energía */}
        <g pointerEvents="none">
          <path d={trunkCenter} fill="none" stroke="var(--c-metal-light)" strokeWidth={4} strokeDasharray="1.5 16" strokeDashoffset={flow} strokeLinecap="round" opacity={0.85} />
          {visibleSlots.map((s) => (
            <path key={s.i} d={bandCenter(s)} fill="none" stroke="var(--c-metal-light)" strokeWidth={clamp(s.w * 0.35, 1.5, 4)} strokeDasharray="1.5 16" strokeDashoffset={flow} strokeLinecap="round" opacity={0.75} />
          ))}
          {fan.map((f) => {
            const x0 = nodeX + 12, x1 = OUT_X, mx = (x0 + x1) / 2;
            const yc0 = (f.y0 + f.y1) / 2, yc1 = (f.z0 + f.z1) / 2;
            return f.h > 2 ? (
              <path key={f.i} d={`M${x0},${yc0} C${mx},${yc0} ${mx},${yc1} ${x1},${yc1}`} fill="none" stroke="var(--c-metal-light)" strokeWidth={clamp(f.h * 0.3, 1.5, 4)} strokeDasharray="1.5 16" strokeDashoffset={flow} strokeLinecap="round" opacity={0.75} />
            ) : null;
          })}
        </g>

        {/* rótulos de las pérdidas: % y nombre, en dos filas alternadas */}
        {visibleSlots.map((s, j) => {
          const cx = s.x + R0 + s.w / 2;
          const low = j % 2 === 1;
          const y = Y_END + 18 + (low ? fs * 2.4 : 0);
          return (
            <g key={s.i}>
              {low && <line x1={cx} y1={Y_END + 2} x2={cx} y2={y - fs} stroke="var(--border-strong)" strokeDasharray="2 3" />}
              <text x={cx} y={y} textAnchor="middle" style={{ fontSize: fs * 1.1, fontWeight: 800, fill: "var(--text)", fontFamily: "var(--font-mono)" }}>{fmt(s.pct, 0)}%</text>
              <text x={cx} y={y + fs * 1.05} textAnchor="middle" style={{ fontSize: fs * 0.85, fill: "var(--muted)" }}>{perd[s.i].short}</text>
            </g>
          );
        })}

        {/* rótulo ruedas */}
        <text x={nodeX + 6} y={Y0 + wheelsH + fs * 1.5} textAnchor="middle" style={{ fontSize: fs * 1.25, fontWeight: 800, fill: "var(--ok)", fontFamily: "var(--font-mono)" }}>
          {fmt(wheels, 0)}%
        </text>
        <text x={nodeX + 6} y={Y0 + wheelsH + fs * 2.6} textAnchor="middle" style={{ fontSize: fs * 0.9, fontWeight: 700, fill: "var(--text-2)" }}>
          a las ruedas
        </text>
        {/* rótulos de salidas */}
        {fan.map((f) => (
          <text key={f.i} x={OUT_X + 6} y={(f.z0 + f.z1) / 2 + fs * 0.35} style={{ fontSize: fs, fill: "var(--text-2)", fontWeight: 650 }}>
            <tspan style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fill: "var(--text)" }}>{fmt(f.h / S, 0)}%</tspan> {SALIDAS[f.i].short}
          </text>
        ))}

        {/* regeneración en el eléctrico: vuelve por arriba hasta la batería */}
        {ev && (
          <g opacity={clamp(outs[2] / 30, 0, 1)}>
            <path
              d={`M${OUT_X - 14},${fan[2].z1 + 2} L${OUT_X - 14},${fan[2].z1 + 14} L712,${fan[2].z1 + 14} L712,24 L${SRC_X + SRC_W / 2},24 L${SRC_X + SRC_W / 2},${Y0 - 16}`}
              fill="none" stroke="var(--ok)" strokeWidth={2.5} strokeDasharray="7 5" strokeDashoffset={-flow * 0.8} strokeLinejoin="round"
            />
            <Arrow x1={SRC_X + SRC_W / 2} y1={Y0 - 18} x2={SRC_X + SRC_W / 2} y2={Y0 - 2} color="var(--ok)" width={2.5} head={10} />
            <text x={380} y={17} textAnchor="middle" style={{ fontSize: fs * 0.95, fontWeight: 700, fill: "var(--ok)", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4 }}>
              regeneración: al frenar, parte vuelve a la batería
            </text>
          </g>
        )}
      </svg>
    </AnimFrame>
  );
}
