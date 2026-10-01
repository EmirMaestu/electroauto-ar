/* Presión relativa vs absoluta con una cubierta: el manómetro marca la DIFERENCIA entre el aire
   de adentro y la atmósfera de afuera. Por eso cambia al subir la cordillera y al calentarse. */
import { useEffect, useRef, useState } from "react";
import { AnimFrame, Readout, Slider, useAnimClock, clamp, lerp, fmt, TAU } from "../ui/anim-kit";

const P0 = 1013.25;
const patm = (h: number) => P0 * Math.pow(1 - 2.25577e-5 * h, 5.25588); // hPa
const PSI = 68.947573; // hPa por psi
const H_REF = 750; // inflada en Mendoza
const T_REF = 20; // en frío

const MOL = Array.from({ length: 70 }, (_, i) => {
  const a = Math.sin(i * 12.9898 + 1) * 43758.5453;
  const b = Math.sin(i * 78.233 + 2) * 12345.678;
  return { u: a - Math.floor(a), v: b - Math.floor(b) };
});

function useFontScale(ref: React.RefObject<SVGSVGElement | null>, max = 1.6) {
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

export function ArranquePresionCubierta({ altura = 750, temp = 20 }: { altura?: number; temp?: number }) {
  const clock = useAnimClock({ speed: 1 });
  const [psi0, setPsi0] = useState(32);
  const [h, setH] = useState(altura);
  const [T, setT] = useState(temp);
  const svgRef = useRef<SVGSVGElement>(null);
  const k = useFontScale(svgRef);
  const fs = 12 * k;
  const t = Math.max(0, clock.t);

  const pAtm0 = patm(H_REF);
  const absIn = (psi0 * PSI + pAtm0) * ((T + 273.15) / (T_REF + 273.15)); // hPa, volumen ≈ constante
  const pA = patm(h);
  const gauge = absIn - pA; // hPa
  const gPsi = gauge / PSI;
  const dPsi = gPsi - psi0;

  // Dibujo: cubierta
  const CX = 150, CY = 160, RO = 112, RI = 64;
  const nIn = Math.round(clamp((absIn / 4000) * 70, 0, 70));
  const nOut = Math.round(clamp((pA / 1100) * 26, 0, 26));
  // Barra apilada (absoluta) — escala 0 a 4 bar
  const BX = 336, BW = 64, BY0 = 290, BH = 240;
  const yBar = (hPa: number) => BY0 - (hPa / 4000) * BH;
  // Manómetro
  const MX = 586, MY = 160, MR = 104;
  const A0 = (-225 * Math.PI) / 180, A1 = (45 * Math.PI) / 180; // 0 a 50 psi
  const angOf = (p: number) => lerp(A0, A1, clamp(p / 50, 0, 1));
  const needle = angOf(gPsi);

  return (
    <AnimFrame
      title="Presión relativa y absoluta: la cubierta que «se infla sola» en la montaña"
      clock={clock}
      controls={
        <>
          <Slider label="Inflada en Mendoza, en frío" value={psi0} min={24} max={40} step={1} onChange={setPsi0} unit="psi" width={120} />
          <Slider label="Altura" value={h} min={0} max={4000} step={50} onChange={setH} unit="m" format={(v) => fmt(v, 0)} width={130} />
          <Slider label="Temperatura de la cubierta" value={T} min={-10} max={70} step={1} onChange={setT} unit="°C" width={120} />
        </>
      }
      readouts={
        <>
          <Readout label="Marca el manómetro" value={fmt(gPsi, 1)} unit="psi" tone="accent" />
          <Readout label="Lo mismo en bar" value={fmt(gauge / 1000, 2)} unit="bar" />
          <Readout label="Absoluta adentro" value={fmt(absIn / 1000, 2)} unit="bar" />
          <Readout label="Atmósfera afuera" value={fmt(pA / 1000, 3)} unit="bar" />
          <Readout label="Diferencia vs. inflado" value={`${dPsi >= 0 ? "+" : ""}${fmt(dPsi, 1)}`} unit="psi" tone={Math.abs(dPsi) > 3 ? "warn" : "ok"} />
        </>
      }
      legend={[
        { color: "var(--c-metal-2)", label: "Presión de la atmósfera" },
        { color: "var(--accent)", label: "Lo que marca el manómetro (relativa)" },
        { color: "var(--c-air)", label: "Aire" },
      ]}
      caption={
        <>
          <p>
            El manómetro no mide «cuánto aire hay»: mide <b>cuánto más empuja el aire de adentro que el de afuera</b>. Eso es la
            presión <b>relativa</b> (o manométrica). La <b>absoluta</b> es la de adentro contada desde el vacío total: relativa + atmosférica.
          </p>
          <p>
            Si inflás en Mendoza y subís a Las Cuevas, adentro hay el mismo aire pero afuera empuja menos: el manómetro marca
            <b> unos 3 psi más</b>. Y una cubierta caliente después de andar marca 3 a 5 psi más que en frío. Por eso se calibra
            <b> en frío</b> y nunca se desinfla una cubierta caliente para «llevarla al valor de la tabla».
          </p>
        </>
      }
    >
      <svg ref={svgRef} viewBox="0 0 720 320" role="img" aria-label="Cubierta, barra de presión y manómetro">
        {/* aire de afuera */}
        {MOL.slice(0, nOut).map((m, i) => {
          const x = 14 + m.u * 270, y = 22 + m.v * 280;
          const inside = Math.hypot(x - CX, y - CY) < RO + 6;
          if (inside) return null;
          return <circle key={"o" + i} cx={x + Math.sin(t * 2 + i) * 2} cy={y + Math.cos(t * 1.7 + i) * 2} r={3} fill="var(--c-air)" opacity={0.45} />;
        })}
        {/* cubierta */}
        <circle cx={CX} cy={CY} r={RO} fill="var(--c-rubber)" stroke="var(--border-strong)" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={RO - 14} fill="var(--surface-2)" opacity={0.22} />
        {Array.from({ length: 36 }, (_, i) => {
          const a = (i / 36) * TAU;
          return <line key={i} x1={CX + Math.cos(a) * (RO - 2)} y1={CY + Math.sin(a) * (RO - 2)} x2={CX + Math.cos(a) * (RO - 10)} y2={CY + Math.sin(a) * (RO - 10)} stroke="var(--c-metal-dark)" strokeWidth={3} />;
        })}
        {/* aire de adentro (en el anillo) */}
        {MOL.slice(0, nIn).map((m, i) => {
          const r = RI + 6 + m.u * (RO - 22 - RI - 6);
          const a = m.v * TAU + t * 0.15;
          return <circle key={"i" + i} cx={CX + Math.cos(a) * r + Math.sin(t * 3 + i) * 1.5} cy={CY + Math.sin(a) * r + Math.cos(t * 2.4 + i) * 1.5} r={3} fill="var(--c-air)" />;
        })}
        {/* llanta */}
        <circle cx={CX} cy={CY} r={RI} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" strokeWidth={2} />
        <circle cx={CX} cy={CY} r={RI - 12} fill="var(--c-metal-light)" opacity={0.6} />
        {[0, 1, 2, 3, 4].map((i) => <circle key={i} cx={CX + Math.cos(i * TAU / 5) * 26} cy={CY + Math.sin(i * TAU / 5) * 26} r={4.5} fill="var(--c-metal-dark)" />)}
        <circle cx={CX} cy={CY} r={10} fill="var(--c-metal-dark)" />
        {/* válvula y manguera al manómetro */}
        <rect x={CX + RI - 4} y={CY - 6} width={22} height={12} rx={3} fill="var(--c-metal-dark)" />
        <path d={`M${CX + RI + 18},${CY} C${CX + 140},${CY + 90} ${CX + 120},312 ${CX + 200},312 L${MX - 40},312 C${MX - 10},312 ${MX},${MY + MR + 20} ${MX},${MY + MR + 2}`} fill="none" stroke="var(--border-strong)" strokeWidth={8} strokeLinecap="round" />
        <path d={`M${CX + RI + 18},${CY} C${CX + 140},${CY + 90} ${CX + 120},312 ${CX + 200},312 L${MX - 40},312 C${MX - 10},312 ${MX},${MY + MR + 20} ${MX},${MY + MR + 2}`} fill="none" stroke="var(--c-rubber)" strokeWidth={5} strokeLinecap="round" />

        {/* barra de presión absoluta */}
        <text x={BX + BW / 2} y={yBar(4000) - 10} textAnchor="middle" style={{ fontSize: fs, fontWeight: 750, fill: "var(--text)" }}>absoluta</text>
        <rect x={BX} y={yBar(4000)} width={BW} height={BH} rx={6} fill="var(--surface)" stroke="var(--border-strong)" />
        <rect x={BX} y={yBar(pA)} width={BW} height={BY0 - yBar(pA)} fill="var(--c-metal-2)" opacity={0.75} />
        <rect x={BX} y={yBar(absIn)} width={BW} height={Math.max(0, yBar(pA) - yBar(absIn))} fill="var(--accent)" opacity={0.85} />
        {[0, 1000, 2000, 3000, 4000].map((v) => (
          <g key={v}>
            <line x1={BX - 6} y1={yBar(v)} x2={BX} y2={yBar(v)} stroke="var(--muted)" />
            <text x={BX - 9} y={yBar(v) + 4} textAnchor="end" style={{ fontSize: fs * 0.85, fill: "var(--muted)", fontFamily: "var(--font-mono)" }}>{v / 1000}</text>
          </g>
        ))}
        <text x={BX - 9} y={BY0 + 16} textAnchor="end" style={{ fontSize: fs * 0.8, fill: "var(--muted)" }}>bar</text>
        <text x={BX + BW + 8} y={(yBar(pA) + BY0) / 2 + 4} style={{ fontSize: fs * 0.9, fill: "var(--text-2)", fontWeight: 650 }}>atmósfera</text>
        <text x={BX + BW + 8} y={(yBar(pA) + yBar(absIn)) / 2 + 4} style={{ fontSize: fs * 0.9, fill: "var(--accent)", fontWeight: 800 }}>relativa</text>
        <line x1={BX + BW} y1={yBar(absIn)} x2={BX + BW + 6} y2={yBar(absIn)} stroke="var(--accent)" strokeWidth={2} />

        {/* manómetro */}
        <circle cx={MX} cy={MY} r={MR} fill="var(--surface)" stroke="var(--c-metal-2)" strokeWidth={8} />
        {Array.from({ length: 11 }, (_, i) => {
          const p = i * 5, a = angOf(p);
          return (
            <g key={i}>
              <line x1={MX + Math.cos(a) * (MR - 12)} y1={MY + Math.sin(a) * (MR - 12)} x2={MX + Math.cos(a) * (MR - 26)} y2={MY + Math.sin(a) * (MR - 26)} stroke="var(--text)" strokeWidth={2} />
              <text x={MX + Math.cos(a) * (MR - 40)} y={MY + Math.sin(a) * (MR - 40) + 4} textAnchor="middle" style={{ fontSize: fs * 0.9, fill: "var(--text)", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{p}</text>
            </g>
          );
        })}
        {Array.from({ length: 41 }, (_, i) => {
          const a = angOf(i * 1.25);
          return i % 4 ? <line key={i} x1={MX + Math.cos(a) * (MR - 12)} y1={MY + Math.sin(a) * (MR - 12)} x2={MX + Math.cos(a) * (MR - 19)} y2={MY + Math.sin(a) * (MR - 19)} stroke="var(--muted)" strokeWidth={1} /> : null;
        })}
        {/* escala interna en bar */}
        {[0, 1, 2, 3].map((b) => {
          const a = angOf((b * 1000) / PSI);
          return <text key={b} x={MX + Math.cos(a) * (MR - 62)} y={MY + Math.sin(a) * (MR - 62) + 4} textAnchor="middle" style={{ fontSize: fs * 0.75, fill: "var(--primary)", fontWeight: 700 }}>{b}</text>;
        })}
        <text x={MX} y={MY + 38} textAnchor="middle" style={{ fontSize: fs * 0.85, fill: "var(--muted)" }}>psi · <tspan style={{ fill: "var(--primary)" }}>bar</tspan></text>
        <line x1={MX} y1={MY} x2={MX + Math.cos(needle) * (MR - 18)} y2={MY + Math.sin(needle) * (MR - 18)} stroke="var(--accent)" strokeWidth={4} strokeLinecap="round" />
        <circle cx={MX} cy={MY} r={8} fill="var(--accent)" />
        <text x={MX} y={MY + 64} textAnchor="middle" style={{ fontSize: fs * 1.25, fontWeight: 800, fill: "var(--accent)", fontFamily: "var(--font-mono)" }}>{fmt(gPsi, 1)} psi</text>
      </svg>
    </AnimFrame>
  );
}
