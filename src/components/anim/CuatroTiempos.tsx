/* El motor de 4 tiempos en corte, con cinemática real.
   - Pistón, biela y cigüeñal con el mecanismo exacto (biela 133 mm, carrera 80 mm).
   - Levas con perfil real para botador de taza, girando a la MITAD que el cigüeñal.
   - Presión y temperatura del gas de un modelo de ciclo (compresión politrópica + combustión de Wiebe).
   - Diagrama p-V o presión vs ángulo, y la barra de 720° con alzada de válvulas, chispa e inyección. */
import { useId, useMemo, useRef, useState } from "react";
import { AnimFrame, Readout, Seg, Slider, Toggle, useAnimClock, clamp, fmt, springPath, wrap, smoothstep } from "../ui/anim-kit";
import {
  D2R, GEO, STROKES, VC, VS, VT, camPath, cycleOptsFor, cycleState, liftAdm, liftEsc, pistonX, safeId, strokeIndex, useWide, volAt,
} from "./motor1-kit";

const DEG_PER_S = 90; // a 1× un ciclo completo (720°) dura 8 s
const S = 1.1; // px por mm
const CX = 180;
const YD = 190; // plano de junta (block / tapa)
const B = GEO.bore * S;
const R = GEO.r * S;
const LROD = GEO.rod * S;
const PTC = GEO.pinToCrown * S;
const PH = 52 * S;
const CROWN0 = YD + 0.5;
const CY = CROWN0 + PTC + LROD + R;
const TILT = 20;
const ROOF = (B / 2) * Math.tan(TILT * D2R);
const DI = 34, DE = 29; // diámetro de cabeza de válvula [px]
const R0 = 20; // radio base de la leva [px]
const CAM_Y = -140; // centro de la leva en coordenadas de la válvula

/** Transformación de coordenadas locales de una válvula (eje hacia arriba = -y) a mundo */
function frame(sx: number, sy: number, tiltDeg: number) {
  const t = tiltDeg * D2R, c = Math.cos(t), s = Math.sin(t);
  return (x: number, y: number) => ({ x: sx + x * c - y * s, y: sy + x * s + y * c });
}
const SI = { x: CX - 22, y: YD - ROOF + 22 * Math.tan(TILT * D2R) };
const SE = { x: CX + 22, y: SI.y };
const fI = frame(SI.x, SI.y, -TILT);
const fE = frame(SE.x, SE.y, TILT);
const P = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

// Conducto de admisión (izquierda) y de escape (derecha, espejado)
const portI = (() => {
  const re = fI(DI / 2, 0), le = fI(-DI / 2, 0);
  const t1 = fI(DI / 2 - 2, -20), t2 = fI(-DI / 2 - 2, -16);
  return `M26,114 C88,110 ${P({ x: t1.x - 22, y: t1.y - 18 })} ${P(t1)} L${P(re)} L${P(le)} C${P(t2)} ${P({ x: t2.x - 50, y: t2.y - 10 })} 26,150 Z`;
})();
const portE = (() => {
  const re = fE(-DE / 2, 0), le = fE(DE / 2, 0);
  const t1 = fE(-DE / 2 + 2, -20), t2 = fE(DE / 2 + 2, -16);
  return `M334,118 C272,114 ${P({ x: t1.x + 22, y: t1.y - 18 })} ${P(t1)} L${P(re)} L${P(le)} C${P(t2)} ${P({ x: t2.x + 50, y: t2.y - 10 })} 334,150 Z`;
})();
// trayectorias de las partículas (conducto → asiento → cilindro)
const pathI = [{ x: 0, y: 132 }, { x: 70, y: 131 }, { x: 125, y: 146 }, fI(0, -6), fI(0, 18), { x: CX - 30, y: YD + 40 }, { x: CX - 5, y: YD + 70 }];
const pathE = [{ x: CX + 10, y: YD + 60 }, { x: CX + 26, y: YD + 30 }, fE(0, 18), fE(0, -6), { x: 235, y: 146 }, { x: 290, y: 134 }, { x: 360, y: 134 }];
function along(pts: { x: number; y: number }[], u: number) {
  const seg: number[] = [];
  let tot = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); tot += d; }
  let s = u * tot;
  for (let i = 0; i < seg.length; i++) {
    if (s <= seg[i]) { const k = s / seg[i]; return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }; }
    s -= seg[i];
  }
  return pts[pts.length - 1];
}
// inyector: punta y dirección del chorro
const INJ_TIP = { x: 101, y: 118 };
const INJ_TGT = fI(0, -8);
const INJ_ANG = Math.atan2(INJ_TGT.y - INJ_TIP.y, INJ_TGT.x - INJ_TIP.x) / D2R;

const PARTS = [
  "Leva de admisión", "Leva de escape", "Bobina", "Bujía", "Inyector", "Válvula de admisión", "Válvula de escape",
  "Resorte de válvula", "Botador (taza)", "Pistón y aros", "Biela", "Cigüeñal", "Contrapeso", "Agua (refrigerante)",
];

export function CuatroTiempos() {
  const clock = useAnimClock({ speed: 1 });
  const [rpm, setRpm] = useState(2500);
  const [fondo, setFondo] = useState(true);
  const [showPV, setShowPV] = useState(true);
  const [names, setNames] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const wide = useWide(boxRef, 600);
  const uid = safeId(useId());

  const raw = clock.t * DEG_PER_S;
  const phi = wrap(raw, 720);
  const th = wrap(phi, 360);
  const opts = useMemo(() => cycleOptsFor(rpm, fondo), [rpm, fondo]);
  const st = cycleState(phi, opts);
  const si = strokeIndex(phi);
  const stroke = STROKES[si];
  const lI = liftAdm(phi), lE = liftEsc(phi);
  const Tc = st.T - 273;
  const ign = st.ign;
  const injDeg = clamp(((fondo ? 9 : 2.6) * rpm * 6) / 1000, 6, 260); // ancho de pulso → grados de cigüeñal
  const INJ0 = 20;
  const injOn = phi >= INJ0 && phi <= INJ0 + injDeg;
  const sparkOn = phi >= ign - 0.5 && phi <= ign + 7;
  const sparkGlow = phi >= ign - 0.5 && phi <= ign + 16 ? 1 - (phi - ign) / 16 : 0;

  // ---- cinemática
  const xmm = pistonX(th);
  const crown = CROWN0 + xmm * S;
  const pinY = crown + PTC;
  const cp = { x: CX + R * Math.sin(th * D2R), y: CY - R * Math.cos(th * D2R) };
  const rodRot = Math.atan2(-(cp.x - CX), cp.y - pinY) / D2R;

  // ---- colores del gas en el cilindro
  const Vic = volAt(VT.ic);
  const dens = phi >= VT.ic && phi < 540 ? Vic / st.V : 1;
  let fresh = 0;
  if (phi < VT.ic) fresh = smoothstep(0, 170, phi);
  else if (phi < 540) fresh = 1 - st.xb;
  const mixO = fresh * clamp(0.24 + 0.045 * dens, 0, 0.7) * (fondo ? 1 : 0.7);
  const hotO = clamp((Tc - 450) / 1500, 0, 0.85);
  let burnt = 0;
  if (phi >= ign) burnt = phi < 540 ? st.xb : 1;
  else if (phi < 140) burnt = 1 - smoothstep(0, 140, phi);
  const exO = burnt * 0.5;
  const gasPoly = `M${CX - B / 2},${crown} L${CX - B / 2},${YD} L${CX},${YD - ROOF} L${CX + B / 2},${YD} L${CX + B / 2},${crown} Z`;

  // ---- curvas para los gráficos (se recalculan sólo si cambian rpm o carga)
  const cyc = useMemo(() => {
    const pts: { f: number; p: number; V: number }[] = [];
    for (let f = 0; f <= 720; f += 2) { const s = cycleState(f, opts); pts.push({ f, p: s.p, V: s.V }); }
    return pts;
  }, [opts]);
  const pmax = Math.max(...cyc.map((c) => c.p));
  const pmaxAt = cyc.find((c) => c.p === pmax)?.f ?? 360;

  // ======================================================== PANEL MOTOR
  const valve = (side: "I" | "E") => {
    const isI = side === "I";
    const s0 = isI ? SI : SE;
    const tilt = isI ? -TILT : TILT;
    const d = isI ? DI : DE;
    const liftMm = isI ? lI : lE;
    const l = liftMm * S;
    const fn = isI ? (f: number) => liftAdm(f) : (f: number) => liftEsc(f);
    const head = `M${-d / 2},0 L${d / 2},0 L${d / 2 - 1.5},-3 Q5,-6 3,-17 L3,-100 L-3,-100 L-3,-17 Q-5,-6 ${-d / 2 + 1.5},-3 Z`;
    return (
      <g transform={`translate(${s0.x},${s0.y}) rotate(${tilt})`}>
        {/* alojamiento del resorte y el botador */}
        <rect x={-17} y={-123} width={34} height={88} fill="var(--surface-2)" />
        <rect x={-4.5} y={-62} width={9} height={30} fill="var(--c-metal-dark)" opacity={0.55} />
        {/* válvula */}
        <g transform={`translate(0,${l})`}>
          <path d={head} fill={isI ? "var(--c-metal-light)" : "var(--c-metal)"} stroke="var(--c-metal-dark)" strokeWidth={1} />
          {!isI && liftMm > 0.2 && Tc > 500 && <path d={head} fill="var(--c-hot)" opacity={0.25} />}
        </g>
        {/* resorte */}
        <path d={springPath(0, -88 + l, -36, 7, 10)} fill="none" stroke="var(--muted)" strokeWidth={2.2} strokeLinejoin="round" />
        <rect x={-12} y={-93 + l} width={24} height={5} rx={1.5} fill="var(--c-metal-dark)" />
        {/* botador de taza */}
        <rect x={-15} y={-120 + l} width={30} height={20} rx={2.5} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.2} />
        {/* leva (gira a la mitad del cigüeñal) */}
        <g transform={`translate(0,${CAM_Y})`}>
          <path d={camPath(phi, fn, R0, S)} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.4} />
          <circle r={8} fill="var(--c-metal-dark)" />
          <circle cx={5 * Math.cos(phi / 2 * D2R)} cy={5 * Math.sin(phi / 2 * D2R)} r={1.8} fill="var(--c-metal-light)" />
        </g>
      </g>
    );
  };

  const particles = (pts: { x: number; y: number }[], n: number, on: number, colorFn: (u: number, i: number) => string, rev = false) => {
    if (on < 0.03) return null;
    return Array.from({ length: n }, (_, i) => {
      let u = wrap(i / n + phi / 75, 1);
      if (rev) u = 1 - u;
      const p = along(pts, u);
      return <circle key={i} cx={p.x} cy={p.y} r={2.4} fill={colorFn(u, i)} opacity={0.35 + 0.65 * on} />;
    });
  };

  const marker = (n: number, x: number, y: number) =>
    names ? (
      <g key={n}>
        <circle cx={x} cy={y} r={8} fill="var(--text)" stroke="var(--surface)" strokeWidth={1.5} />
        <text x={x} y={y + 3.5} textAnchor="middle" style={{ fontSize: 9.5, fontWeight: 700, fill: "var(--bg)" }}>{n}</text>
      </g>
    ) : null;

  const camI = fI(0, CAM_Y), camE = fE(0, CAM_Y);
  const springE = fE(20, -66);
  const buckE = fE(26, -112);
  const flameR = 6 + 115 * Math.sqrt(st.xb);
  const showFlame = st.xb > 0.001 && st.xb < 0.995 && phi < 540;

  const enginePanel = (
    <g>
      <defs>
        <clipPath id={`${uid}-gas`}><path d={gasPoly} /></clipPath>
        <clipPath id={`${uid}-flow`}>
          <path d={gasPoly} />
          <path d={portI} />
          <path d={portE} />
          <rect x={0} y={128} width={30} height={12} />
          <rect x={330} y={128} width={30} height={12} />
        </clipPath>
      </defs>
      {/* cárter */}
      <path d={`M${CX - B / 2 - 22},${YD + 150} L${CX - 96},${CY - 30} Q${CX - 104},${CY + 76} ${CX},${CY + 74} Q${CX + 104},${CY + 76} ${CX + 96},${CY - 30} L${CX + B / 2 + 22},${YD + 150}`}
        fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth={1.5} />
      {/* block: paredes del cilindro con camisa de agua */}
      {[-1, 1].map((sd) => {
        const x = sd < 0 ? CX - B / 2 - 22 : CX + B / 2;
        return (
          <g key={sd}>
            <rect x={x} y={YD} width={22} height={152} fill="var(--c-block)" stroke="var(--c-metal-2)" strokeWidth={0.8} />
            <rect x={x + 6} y={YD + 6} width={10} height={92} rx={4} fill="var(--c-coolant)" opacity={0.5} />
          </g>
        );
      })}
      <rect x={CX - B / 2} y={YD} width={B} height={152} fill="var(--surface)" />
      {/* tapa de válvulas */}
      <path d="M40,74 L40,26 Q40,8 58,8 L302,8 Q320,8 320,26 L320,74 Z" fill="var(--surface-2)" stroke="var(--border-strong)" strokeWidth={1.4} />
      {/* tapa de cilindros */}
      <path d={`M26,94 Q26,74 46,74 L314,74 Q334,74 334,94 L334,${YD} L${CX + B / 2},${YD} L${CX},${YD - ROOF} L${CX - B / 2},${YD} L26,${YD} Z`}
        fill="var(--c-metal-light)" stroke="var(--c-metal-2)" strokeWidth={1} />
      {/* camisas de agua en la tapa */}
      <path d={`M40,164 Q70,160 104,166 L110,182 L40,182 Z`} fill="var(--c-coolant)" opacity={0.45} />
      <path d={`M320,164 Q290,160 256,166 L250,182 L320,182 Z`} fill="var(--c-coolant)" opacity={0.45} />
      <rect x={CX - 26} y={86} width={10} height={44} rx={4} fill="var(--c-coolant)" opacity={0.45} />
      <rect x={CX + 16} y={86} width={10} height={44} rx={4} fill="var(--c-coolant)" opacity={0.45} />
      {/* junta de tapa */}
      <line x1={26} y1={YD} x2={CX - B / 2} y2={YD} stroke="var(--c-metal-dark)" strokeWidth={2.5} />
      <line x1={CX + B / 2} y1={YD} x2={334} y2={YD} stroke="var(--c-metal-dark)" strokeWidth={2.5} />
      {/* conductos */}
      <path d={portI} fill="var(--surface)" stroke="var(--c-metal-2)" strokeWidth={1} />
      <path d={portE} fill="var(--surface)" stroke="var(--c-metal-2)" strokeWidth={1} />
      <path d={portI} fill="var(--c-air)" opacity={0.16} />
      <path d={portE} fill="var(--c-exhaust)" opacity={0.28} />
      <path d={portE} fill="var(--c-hot)" opacity={lE > 0.2 ? 0.12 + 0.18 * (lE / VT.liftE) : 0.06} />
      {/* múltiples (tramos) */}
      <rect x={0} y={112} width={28} height={40} fill="var(--surface)" stroke="var(--c-metal-2)" strokeWidth={1} />
      <rect x={0} y={112} width={28} height={40} fill="var(--c-air)" opacity={0.16} />
      <rect x={332} y={116} width={28} height={36} fill="var(--surface)" stroke="var(--c-metal-2)" strokeWidth={1} />
      <rect x={332} y={116} width={28} height={36} fill="var(--c-exhaust)" opacity={0.3} />
      <text x={4} y={106} className="svg-small" style={{ fill: "var(--c-air)", fontWeight: 700 }}>aire →</text>
      <text x={356} y={106} textAnchor="end" className="svg-small" style={{ fontWeight: 700 }}>→ escape</text>

      {/* gases en el cilindro */}
      <g clipPath={`url(#${uid}-gas)`}>
        <path d={gasPoly} fill="var(--c-exhaust)" opacity={exO} />
        <path d={gasPoly} fill="var(--c-mix)" opacity={mixO} />
        <path d={gasPoly} fill="var(--c-hot)" opacity={hotO} />
        {showFlame && (
          <circle cx={CX} cy={YD - ROOF + 8} r={flameR} fill="var(--c-flame)" opacity={0.6 * (1 - Math.pow(st.xb, 3))} stroke="var(--c-hot)" strokeWidth={2.5} />
        )}
      </g>
      {/* flujo de gases */}
      <g clipPath={`url(#${uid}-flow)`}>
        {particles(pathI, 16, lI / VT.liftI, (u) => (u > 0.4 ? "var(--c-mix)" : "var(--c-air)"))}
        {particles(pathE, 14, lE / VT.liftE, () => "var(--c-exhaust)")}
      </g>

      {/* válvulas, resortes, botadores y levas */}
      {valve("I")}
      {valve("E")}

      {/* bujía + bobina */}
      <rect x={CX - 9} y={74} width={18} height={84} fill="var(--surface-2)" />
      <rect x={CX - 5} y={74} width={10} height={50} rx={2} fill="var(--surface)" stroke="var(--c-metal-2)" />
      <rect x={CX - 8} y={124} width={16} height={12} rx={1.5} fill="var(--c-metal)" stroke="var(--c-metal-dark)" />
      <rect x={CX - 6} y={136} width={12} height={YD - ROOF - 136} fill="var(--c-metal-2)" />
      {[140, 145, 150, 155, 160, 165].map((y) => <line key={y} x1={CX - 6} y1={y} x2={CX + 6} y2={y + 2} stroke="var(--c-metal-dark)" strokeWidth={0.8} />)}
      <line x1={CX} y1={YD - ROOF} x2={CX} y2={YD - ROOF + 4} stroke="var(--c-metal-dark)" strokeWidth={2.2} />
      <path d={`M${CX + 5},${YD - ROOF} L${CX + 5},${YD - ROOF + 8} L${CX - 2},${YD - ROOF + 8}`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={2.2} />
      <rect x={CX - 11} y={2} width={22} height={74} rx={4} fill="var(--c-metal-dark)" stroke={sparkGlow > 0 ? "var(--c-spark)" : "var(--border-strong)"} strokeWidth={sparkGlow > 0 ? 2.5 : 1} />
      <rect x={CX - 7} y={-2} width={14} height={8} rx={2} fill="var(--c-elec)" />
      {sparkGlow > 0 && <circle cx={CX} cy={YD - ROOF + 6} r={6 + 10 * sparkGlow} fill="var(--c-spark)" opacity={0.55 * sparkGlow} />}
      {sparkOn && (
        <path d={`M${CX},${YD - ROOF + 4} l3,1.5 l-4,1.5 l3,1.5`} fill="none" stroke="var(--c-spark)" strokeWidth={2} strokeLinecap="round" />
      )}

      {/* inyector */}
      <g transform={`translate(${INJ_TIP.x},${INJ_TIP.y}) rotate(${INJ_ANG})`}>
        <rect x={-58} y={-9} width={60} height={18} fill="var(--surface-2)" />
        <rect x={-54} y={-7} width={44} height={14} rx={3} fill="var(--c-metal-dark)" stroke={injOn ? "var(--c-fuel)" : "none"} strokeWidth={2} />
        <rect x={-10} y={-3.5} width={10} height={7} fill="var(--c-metal)" />
        <rect x={-64} y={-6} width={11} height={12} rx={2} fill="var(--c-elec)" />
        {injOn && (
          <g>
            <path d="M1,0 L40,-9 Q46,0 40,9 Z" fill="var(--c-fuel)" opacity={0.45} />
            {Array.from({ length: 7 }, (_, i) => {
              const u = wrap(i / 7 + phi / 12, 1);
              return <circle key={i} cx={4 + u * 40} cy={(i % 3 - 1) * u * 7} r={1.6} fill="var(--c-fuel)" />;
            })}
          </g>
        )}
      </g>

      {/* pistón */}
      <g>
        <rect x={CX - B / 2 + 1.5} y={crown} width={B - 3} height={PH} rx={3} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1} />
        <rect x={CX - B / 2 + 1.5} y={crown + 24} width={B - 3} height={PH - 24} rx={2} fill="var(--c-metal-2)" opacity={0.35} />
        {[5, 10.5].map((o) => <line key={o} x1={CX - B / 2 + 1.5} y1={crown + o} x2={CX + B / 2 - 1.5} y2={crown + o} stroke="var(--c-metal-dark)" strokeWidth={2.4} />)}
        <line x1={CX - B / 2 + 1.5} y1={crown + 17} x2={CX + B / 2 - 1.5} y2={crown + 17} stroke="var(--c-metal-dark)" strokeWidth={3.6} />
        <line x1={CX - B / 2 + 1.5} y1={crown + 17} x2={CX + B / 2 - 1.5} y2={crown + 17} stroke="var(--c-metal-light)" strokeWidth={1} strokeDasharray="3 3" />
        <circle cx={CX} cy={pinY} r={9} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.4} />
      </g>
      {/* biela */}
      <g transform={`translate(${CX},${pinY}) rotate(${rodRot})`}>
        <path d={`M-6,9 L6,9 L9.5,${LROD - 15} L-9.5,${LROD - 15} Z`} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" strokeWidth={1} />
        <line x1={0} y1={14} x2={0} y2={LROD - 20} stroke="var(--c-metal-dark)" strokeWidth={2} opacity={0.5} />
        <circle r={12} fill="none" stroke="var(--c-metal-2)" strokeWidth={4} />
        <circle cy={LROD} r={17} fill="var(--c-metal-2)" stroke="var(--c-metal-dark)" strokeWidth={1} />
        <line x1={-19} y1={LROD} x2={19} y2={LROD} stroke="var(--c-metal-dark)" strokeWidth={1.2} />
        <circle cx={-13} cy={LROD + 4} r={2.4} fill="var(--c-metal-dark)" />
        <circle cx={13} cy={LROD + 4} r={2.4} fill="var(--c-metal-dark)" />
      </g>
      {/* cigüeñal */}
      {(() => {
        const a = th * D2R;
        const cw = 64, w = 1.05;
        const p1 = { x: CX - cw * Math.sin(a - w), y: CY + cw * Math.cos(a - w) };
        const p2 = { x: CX - cw * Math.sin(a + w), y: CY + cw * Math.cos(a + w) };
        return (
          <g>
            <path d={`M${CX},${CY} L${p1.x},${p1.y} A${cw},${cw} 0 0 1 ${p2.x},${p2.y} Z`} fill="var(--c-metal-dark)" />
            <line x1={CX} y1={CY} x2={cp.x} y2={cp.y} stroke="var(--c-metal-dark)" strokeWidth={30} strokeLinecap="round" />
            <circle cx={CX} cy={CY} r={14} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" strokeWidth={2} />
            <circle cx={cp.x} cy={cp.y} r={11} fill="var(--c-metal-light)" stroke="var(--c-metal-2)" strokeWidth={1.5} />
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--border-strong)" strokeDasharray="3 5" />
          </g>
        );
      })()}
      {/* sentido de giro */}
      <path d={`M${CX + 74},${CY - 30} A80,80 0 0 1 ${CX + 74},${CY + 30}`} fill="none" stroke="var(--muted)" strokeWidth={1.5} />
      <path d={`M${CX + 74},${CY + 30} l-7,-1 l5,-6 Z`} fill="var(--muted)" />

      {/* PMS / PMI */}
      <g>
        <line x1={CX + B / 2 + 24} y1={CROWN0} x2={CX + B / 2 + 36} y2={CROWN0} stroke="var(--muted)" />
        <text x={CX + B / 2 + 40} y={CROWN0 + 4} className="svg-small">PMS</text>
        <line x1={CX + B / 2 + 24} y1={CROWN0 + GEO.stroke * S} x2={CX + B / 2 + 36} y2={CROWN0 + GEO.stroke * S} stroke="var(--muted)" />
        <text x={CX + B / 2 + 40} y={CROWN0 + GEO.stroke * S + 4} className="svg-small">PMI</text>
        <line x1={CX + B / 2 + 30} y1={CROWN0} x2={CX + B / 2 + 30} y2={CROWN0 + GEO.stroke * S} stroke="var(--muted)" strokeDasharray="2 3" />
        <line x1={CX + B / 2 + 26} y1={crown} x2={CX + B / 2 + 34} y2={crown} stroke="var(--accent)" strokeWidth={2.5} />
      </g>

      {/* números de piezas */}
      {marker(1, camI.x - 34, camI.y - 16)}
      {marker(2, camE.x + 34, camE.y - 16)}
      {marker(3, CX + 22, 20)}
      {marker(4, CX + 18, 128)}
      {marker(5, 56, 88)}
      {marker(6, SI.x - 30, SI.y + 12)}
      {marker(7, SE.x + 30, SE.y + 12)}
      {marker(8, springE.x + 4, springE.y)}
      {marker(9, buckE.x + 4, buckE.y)}
      {marker(10, CX - B / 2 - 32, crown + 12)}
      {marker(11, CX - 22, pinY + LROD * 0.45)}
      {marker(12, CX - 30, CY + 10)}
      {marker(13, CX + 52, CY + 52)}
      {marker(14, CX - B / 2 - 11, YD + 112)}
    </g>
  );

  // ======================================================== ENCABEZADO
  const oI = lI > 0.05, oE = lE > 0.05;
  const valveText = oI && oE ? "Cruce: las dos válvulas abiertas a la vez" : oI ? "Admisión abierta · escape cerrada" : oE ? "Escape abierta · admisión cerrada" : "Las dos válvulas cerradas";
  const header = (
    <g>
      <circle cx={34} cy={42} r={25} fill={stroke.color} />
      <text x={34} y={50} textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: "#fff" }}>{stroke.n}</text>
      <text x={70} y={44} style={{ fontSize: 27, fontWeight: 800, fill: "var(--text)", letterSpacing: ".02em" }}>{stroke.name.toUpperCase()}</text>
      <text x={70} y={63} style={{ fontSize: 12.5, fill: "var(--text-2)" }}>{stroke.what}</text>
      <text x={70} y={80} className="svg-small" style={{ fontWeight: 600 }}>{valveText}</text>
      <text x={354} y={14} textAnchor="end" className="svg-small" style={{ fontWeight: 700 }}>
        {phi < 360 ? "1ª" : "2ª"} vuelta del cigüeñal
      </text>
    </g>
  );

  // ======================================================== GRÁFICO p-V / p-φ
  const gx0 = 48, gx1 = 346, gy0 = 30, gy1 = 192;
  const PV_VMAX = 480;
  const lp0 = Math.log10(0.2), lp1 = Math.log10(100);
  const mxV = (V: number) => gx0 + (V / PV_VMAX) * (gx1 - gx0);
  const myLog = (p: number) => gy1 - ((Math.log10(clamp(p, 0.2, 100)) - lp0) / (lp1 - lp0)) * (gy1 - gy0);
  const pLinMax = Math.ceil(pmax / 10) * 10;
  const mxF = (f: number) => gx0 + (f / 720) * (gx1 - gx0);
  const myLin = (p: number) => gy1 - (p / pLinMax) * (gy1 - gy0);
  const segPath = (k: number) => {
    const pts = cyc.filter((c) => c.f >= k * 180 && c.f <= k * 180 + 180);
    return pts.map((c, i) => `${i ? "L" : "M"}${(showPV ? mxV(c.V) : mxF(c.f)).toFixed(1)},${(showPV ? myLog(c.p) : myLin(c.p)).toFixed(1)}`).join("");
  };
  const loopPath = (a: number, b: number) => {
    const pts = cyc.filter((c) => c.f >= a && c.f <= b);
    return pts.map((c, i) => `${i ? "L" : "M"}${mxV(c.V).toFixed(1)},${myLog(c.p).toFixed(1)}`).join("") + "Z";
  };
  const pumpPath = (() => {
    const pts = [...cyc.filter((c) => c.f >= 540), ...cyc.filter((c) => c.f <= 180)];
    return pts.map((c, i) => `${i ? "L" : "M"}${mxV(c.V).toFixed(1)},${myLog(c.p).toFixed(1)}`).join("") + "Z";
  })();
  const dot = showPV ? { x: mxV(st.V), y: myLog(st.p) } : { x: mxF(phi), y: myLin(st.p) };

  const chart = (
    <g>
      <text x={14} y={16} className="svg-label">
        {showPV ? "Diagrama p-V: presión contra volumen" : "Presión en el cilindro durante el ciclo"}
      </text>
      <rect x={gx0} y={gy0} width={gx1 - gx0} height={gy1 - gy0} rx={6} fill="var(--surface)" stroke="var(--border)" />
      {showPV ? (
        <g>
          {[0.5, 1, 2, 5, 10, 20, 50].map((p) => (
            <g key={p}>
              <line x1={gx0} y1={myLog(p)} x2={gx1} y2={myLog(p)} stroke="var(--border)" strokeDasharray={p === 1 ? "5 3" : "2 4"} />
              <text x={gx0 - 5} y={myLog(p) + 3.5} textAnchor="end" className="svg-small" style={p === 1 ? { fontWeight: 700 } : undefined}>{p === 1 ? "1 atm" : fmt(p, p < 1 ? 1 : 0)}</text>
            </g>
          ))}
          <line x1={mxV(VC)} y1={gy0} x2={mxV(VC)} y2={gy1} stroke="var(--muted)" strokeDasharray="3 3" />
          <line x1={mxV(VC + VS)} y1={gy0} x2={mxV(VC + VS)} y2={gy1} stroke="var(--muted)" strokeDasharray="3 3" />
          <text x={mxV(VC) + 3} y={gy1 + 13} className="svg-small">PMS</text>
          <text x={mxV(VC + VS)} y={gy1 + 13} textAnchor="middle" className="svg-small">PMI</text>
          <text x={gx1} y={gy1 + 26} textAnchor="end" className="svg-small">volumen sobre el pistón [cm³] →</text>
          <text x={gx0 - 40} y={gy0 - 3} className="svg-small">bar (abs.)</text>
          <path d={loopPath(180, 540)} fill="var(--c-hot)" opacity={0.12} />
          <path d={pumpPath} fill="var(--bad)" opacity={fondo ? 0.06 : 0.16} />
          <text x={mxV(170)} y={myLog(Math.sqrt(pmax * 2)) + 4} textAnchor="middle" className="svg-small" style={{ fill: "var(--c-hot)", fontWeight: 700 }}>trabajo útil</text>
          {!fondo && <text x={mxV(250)} y={myLog(0.62)} textAnchor="middle" className="svg-small" style={{ fill: "var(--bad)", fontWeight: 700 }}>pérdida por bombeo</text>}
        </g>
      ) : (
        <g>
          {Array.from({ length: pLinMax / 10 + 1 }, (_, i) => i * 10).map((p) => (
            <g key={p}>
              <line x1={gx0} y1={myLin(p)} x2={gx1} y2={myLin(p)} stroke="var(--border)" strokeDasharray="2 4" />
              <text x={gx0 - 5} y={myLin(p) + 3.5} textAnchor="end" className="svg-small">{p}</text>
            </g>
          ))}
          {[0, 180, 360, 540, 720].map((f) => (
            <g key={f}>
              <line x1={mxF(f)} y1={gy0} x2={mxF(f)} y2={gy1} stroke="var(--border)" />
              <text x={mxF(f)} y={gy1 + 13} textAnchor="middle" className="svg-small">{f}°</text>
            </g>
          ))}
          <text x={gx0 - 36} y={gy0 - 3} className="svg-small">bar</text>
          <text x={gx1} y={gy1 + 26} textAnchor="end" className="svg-small">ángulo de cigüeñal →</text>
          <text x={mxF(pmaxAt) + 6} y={myLin(pmax) + 4} className="svg-small" style={{ fill: "var(--c-hot)", fontWeight: 700 }}>
            máx. {fmt(pmax, 0)} bar a {fmt(pmaxAt - 360, 0)}° después del PMS
          </text>
          <line x1={mxF(ign)} y1={gy0} x2={mxF(ign)} y2={gy1} stroke="var(--c-spark)" strokeWidth={1.5} strokeDasharray="3 2" />
        </g>
      )}
      {[0, 1, 2, 3].map((k) => <path key={k} d={segPath(k)} fill="none" stroke={STROKES[k].color} strokeWidth={2.6} strokeLinejoin="round" />)}
      <circle cx={dot.x} cy={dot.y} r={9} fill={stroke.color} opacity={0.25} />
      <circle cx={dot.x} cy={dot.y} r={5} fill={stroke.color} stroke="var(--surface)" strokeWidth={1.5} />
    </g>
  );

  // ======================================================== BARRA DE 720°
  const tx0 = 22, tx1 = 350;
  const mx = (f: number) => tx0 + (f / 720) * (tx1 - tx0);
  const LY = 92, LH = 46 / VT.liftI;
  const liftPath = (fn: (f: number) => number, a: number, b: number) => {
    let d = `M${mx(a)},${LY}`;
    for (let f = a; f <= b; f += 3) d += `L${mx(f).toFixed(1)},${(LY - fn(f) * LH).toFixed(1)}`;
    return d + `L${mx(b)},${LY}Z`;
  };
  const scrub = (e: React.PointerEvent<SVGRectElement>) => {
    const el = e.currentTarget;
    const m = el.getScreenCTM();
    if (!m) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const f = clamp((pt.x - tx0) / (tx1 - tx0), 0, 0.9999) * 720;
    const target = (Math.floor(raw / 720) * 720 + f) / DEG_PER_S;
    clock.setPlaying(false);
    clock.step(target - clock.t);
  };
  const timeline = (
    <g>
      {STROKES.map((s, k) => (
        <g key={s.n}>
          <rect x={mx(k * 180) + 0.5} y={8} width={mx(180) - mx(0) - 1} height={24} rx={4} fill={s.color} opacity={si === k ? 1 : 0.55} />
          <text x={mx(k * 180 + 90)} y={24} textAnchor="middle" style={{ fontSize: 10, fontWeight: 800, fill: "#fff", letterSpacing: ".03em" }}>{s.name.toUpperCase()}</text>
        </g>
      ))}
      <line x1={tx0} y1={LY} x2={tx1} y2={LY} stroke="var(--border-strong)" />
      <path d={liftPath(liftEsc, 0, 12)} fill="var(--c-exhaust)" opacity={0.45} stroke="var(--c-exhaust)" />
      <path d={liftPath(liftEsc, VT.eo, 720)} fill="var(--c-exhaust)" opacity={0.45} stroke="var(--c-exhaust)" />
      <path d={liftPath(liftAdm, 0, VT.ic)} fill="var(--c-air)" opacity={0.35} stroke="var(--c-air)" />
      <path d={liftPath(liftAdm, 720 + VT.io, 720)} fill="var(--c-air)" opacity={0.35} stroke="var(--c-air)" />
      <text x={mx(108)} y={LY - 18} textAnchor="middle" className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>válv. admisión</text>
      <text x={mx(612)} y={LY - 18} textAnchor="middle" className="svg-small" style={{ fill: "var(--text)", fontWeight: 700 }}>válv. escape</text>
      <rect x={mx(0)} y={LY - 46} width={mx(12) - mx(0)} height={46} fill="var(--warn)" opacity={0.18} />
      <rect x={mx(708)} y={LY - 46} width={mx(720) - mx(708)} height={46} fill="var(--warn)" opacity={0.18} />
      <text x={mx(14)} y={LY - 36} className="svg-small" style={{ fill: "var(--warn)", fontWeight: 700 }}>cruce</text>
      <text x={mx(706)} y={LY - 36} textAnchor="end" className="svg-small" style={{ fill: "var(--warn)", fontWeight: 700 }}>cruce</text>
      {/* chispa e inyección */}
      <rect x={mx(INJ0)} y={99} width={Math.max(2, mx(INJ0 + injDeg) - mx(INJ0))} height={7} rx={2} fill="var(--c-fuel)" />
      <text x={mx(INJ0)} y={118} className="svg-small" style={{ fill: "var(--warn)", fontWeight: 700 }}>inyección</text>
      <path d={`M${mx(ign)},96 l-4,6 l4,0 l-3,7 l7,-9 l-4,0 l3,-4 Z`} fill="var(--c-spark)" stroke="var(--warn)" strokeWidth={0.8} />
      <text x={mx(ign) + 7} y={106} className="svg-small" style={{ fontWeight: 700 }}>chispa</text>
      {/* escala */}
      {[0, 180, 360, 540, 720].map((f, i) => (
        <g key={f}>
          <line x1={mx(f)} y1={112} x2={mx(f)} y2={117} stroke="var(--muted)" />
          <text x={mx(f)} y={128} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} className="svg-small">{f}°</text>
          <text x={mx(f)} y={139} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"} className="svg-small" style={{ fontWeight: 700 }}>{i % 2 ? "PMI" : "PMS"}</text>
        </g>
      ))}
      <path d={`M${mx(2)},146 L${mx(2)},150 L${mx(358)},150 L${mx(358)},146`} fill="none" stroke="var(--muted)" />
      <path d={`M${mx(362)},146 L${mx(362)},150 L${mx(718)},150 L${mx(718)},146`} fill="none" stroke="var(--muted)" />
      <text x={mx(180)} y={162} textAnchor="middle" className="svg-small">1ª vuelta del cigüeñal</text>
      <text x={mx(540)} y={162} textAnchor="middle" className="svg-small">2ª vuelta</text>
      <text x={(tx0 + tx1) / 2} y={175} textAnchor="middle" className="svg-small" style={{ fontWeight: 700 }}>
        en todo el ciclo el árbol de levas da una sola vuelta
      </text>
      {/* cursor */}
      <line x1={mx(phi)} y1={4} x2={mx(phi)} y2={112} stroke="var(--text)" strokeWidth={1.6} />
      <path d={`M${mx(phi) - 5},0 L${mx(phi) + 5},0 L${mx(phi)},7 Z`} fill="var(--text)" />
      <rect x={tx0 - 4} y={0} width={tx1 - tx0 + 8} height={142} fill="transparent" style={{ cursor: "ew-resize", touchAction: "none" }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e); }}
        onPointerMove={(e) => { if (e.buttons) scrub(e); }} />
    </g>
  );

  // ======================================================== MONTAJE
  const HH = 88, EH = 490, CH = 230, TH = 180;
  const W = wide ? 720 : 360;
  const H = wide ? EH : HH + EH + TH + CH;
  const pos = wide
    ? { h: "translate(360,0)", e: "translate(0,0)", c: `translate(360,${HH})`, t: `translate(360,${HH + CH - 6})` }
    : { h: "translate(0,0)", e: `translate(0,${HH})`, t: `translate(0,${HH + EH})`, c: `translate(0,${HH + EH + TH})` };

  const msPerStroke = 30000 / rpm;
  return (
    <AnimFrame
      title="El motor de 4 tiempos, en corte y en vivo"
      clock={clock}
      controls={
        <>
          <button className="btn ghost sm" onClick={() => { clock.setPlaying(false); clock.step(-5 / DEG_PER_S); }} title="Retroceder 5°">‹ 5°</button>
          <button className="btn ghost sm" onClick={() => { clock.setPlaying(false); clock.step(5 / DEG_PER_S); }} title="Avanzar 5°">5° ›</button>
          <Slider label="RPM" value={rpm} min={800} max={6500} step={100} onChange={setRpm} />
          <Seg value={fondo ? "f" : "r"} onChange={(v) => setFondo(v === "f")} options={[{ value: "r", label: "Ralentí" }, { value: "f", label: "A fondo" }]} ariaLabel="Carga" />
          <Toggle label="Diagrama p-V" checked={showPV} onChange={setShowPV} />
          <Toggle label="Nombres" checked={names} onChange={setNames} />
        </>
      }
      readouts={
        <>
          <Readout label="Cigüeñal" value={fmt(phi, 0)} unit="° de 720" />
          <Readout label="Árbol de levas" value={fmt(phi / 2, 0)} unit="° de 360" />
          <Readout label="Presión" value={fmt(st.p, st.p < 10 ? 1 : 0)} unit="bar abs." tone={st.p > 20 ? "accent" : undefined} />
          <Readout label="Temp. del gas" value={fmt(Math.round(Tc / 10) * 10, 0)} unit="°C" tone={Tc > 1200 ? "bad" : Tc > 500 ? "warn" : undefined} />
          <Readout label="Válv. admisión" value={lI > 0.05 ? fmt(lI, 1) : "cerrada"} unit={lI > 0.05 ? "mm" : undefined} tone={lI > 0.05 ? "ok" : undefined} />
          <Readout label="Válv. escape" value={lE > 0.05 ? fmt(lE, 1) : "cerrada"} unit={lE > 0.05 ? "mm" : undefined} tone={lE > 0.05 ? "ok" : undefined} />
          <Readout label={`Avance a ${fmt(rpm, 0)} rpm`} value={fmt(opts.adv, 0)} unit="° APMS" />
          <Readout label="Cada tiempo dura" value={fmt(msPerStroke, msPerStroke < 10 ? 1 : 0)} unit="ms" />
        </>
      }
      legend={[
        { color: "var(--c-air)", label: "Aire" },
        { color: "var(--c-mix)", label: "Mezcla aire-nafta" },
        { color: "var(--c-fuel)", label: "Nafta inyectada" },
        { color: "var(--c-hot)", label: "Combustión (gas caliente)" },
        { color: "var(--c-exhaust)", label: "Gases de escape" },
        { color: "var(--c-coolant)", label: "Refrigerante" },
      ]}
      caption={
        <>
          <p>
            Seguí el cursor en la barra de abajo (o arrastralo con el dedo). <b>Admisión</b>: baja el pistón, la leva abre la válvula de
            admisión y el inyector tira nafta en el conducto. <b>Compresión</b>: con las dos válvulas cerradas, el pistón sube y la mezcla
            pasa de ~{fmt(opts.pin, 1)} bar a más de {fmt(cycleState(360 - opts.adv, opts).p, 0)} bar y se calienta a unos{" "}
            {fmt(Math.round((cycleState(355, opts).T - 273) / 10) * 10, 0)} °C. <b>Explosión</b>: salta la chispa {fmt(opts.adv, 0)}° antes del
            PMS, el frente de llama recorre la cámara y la presión llega a ~{fmt(pmax, 0)} bar unos grados después del PMS, donde ya hay
            palanca para empujar. <b>Escape</b>: la válvula de escape abre antes del PMI para aprovechar que el gas sale solo, y el pistón
            empuja el resto.
          </p>
          <p>
            Mirá las levas: dan <b>media vuelta</b> mientras el cigüeñal da una. Por eso hacen falta <b>dos vueltas de cigüeñal</b> para
            completar los 4 tiempos. Cerca del PMS de la 1ª vuelta las dos válvulas están un poquito abiertas a la vez: es el{" "}
            <b>cruce de válvulas</b>. Pasá a <b>Ralentí</b>: con la mariposa casi cerrada el cilindro chupa contra vacío (~0,35 bar) y en
            el diagrama p-V aparece la <b>pérdida por bombeo</b> (el lazo de abajo, en rojo). El eje de presión del p-V es logarítmico
            para que se vea tanto lo de 0,3 bar como lo de 50.
          </p>
          <p className="faint" style={{ fontSize: ".82rem" }}>
            A {fmt(rpm, 0)} rpm, todo este ciclo pasa {fmt(rpm / 120, 1)} veces por segundo en cada cilindro: cada tiempo dura
            {" "}{fmt(msPerStroke, 1)} ms. La animación va unas {fmt((rpm * 6) / DEG_PER_S / clock.speed, 0)} veces más lenta.
          </p>
        </>
      }
    >
      <div ref={boxRef}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Motor de 4 tiempos en corte con diagrama de presión">
          <g transform={pos.e}>{enginePanel}</g>
          <g transform={pos.h}>{header}</g>
          <g transform={pos.c}>{chart}</g>
          <g transform={pos.t}>{timeline}</g>
        </svg>
        {names && (
          <ol style={{ listStyle: "none", margin: ".5rem 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: ".1rem 1rem", fontSize: ".8rem", color: "var(--text-2)" }}>
            {PARTS.map((p, i) => (
              <li key={p} style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                <b style={{ display: "inline-grid", placeItems: "center", width: 18, height: 18, borderRadius: 9, background: "var(--text)", color: "var(--bg)", fontSize: ".68rem", flex: "none" }}>{i + 1}</b>
                {p}
              </li>
            ))}
          </ol>
        )}
      </div>
    </AnimFrame>
  );
}
