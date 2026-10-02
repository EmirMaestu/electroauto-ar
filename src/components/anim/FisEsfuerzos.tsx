/* Los cinco esfuerzos básicos (tracción, compresión, flexión, corte, torsión) con la deformación exagerada
   y una pieza del auto que trabaja así. La carga sube y baja sola. */
import { useState, type ReactNode } from "react";
import { AnimFrame, Readout, Seg, useAnimClock, Arrow, TAU, fmt } from "../ui/anim-kit";

type Mode = "traccion" | "compresion" | "flexion" | "corte" | "torsion";

const INFO: Record<Mode, { formula: string; ej: string; valor: string; caption: ReactNode }> = {
  traccion: {
    formula: "σ = F / A",
    ej: "Bulón de rueda M12",
    valor: "≈ 510 MPa",
    caption: (
      <p>
        <b>Tracción:</b> te tiran de las puntas y la pieza se alarga (y se afina un poquito). La tensión es la fuerza repartida en la
        sección: σ = F / A. Un bulón de rueda M12×1,5 apretado con ≈ 45 kN reparte esa fuerza en 88 mm² de sección resistente:{" "}
        <b>≈ 510 MPa</b>. También trabajan así los tornillos de tapa, los de bancada y el cable del freno de mano.
      </p>
    ),
  },
  compresion: {
    formula: "σ = F / A",
    ej: "Biela en la explosión",
    valor: "≈ 120 MPa",
    caption: (
      <p>
        <b>Compresión:</b> te empujan de las puntas y la pieza se acorta (y se ensancha un poquito). Una biela de un 1.6 recibe en la
        explosión unos 35 kN (70 bar sobre un pistón de 80 mm) y su caña tiene ≈ 300 mm²: <b>≈ 120 MPa</b>. Si la pieza es larga y
        flaca, antes de aplastarse <b>se pandea</b> (se dobla de costado): por eso una biela "hidrolockeada" (con agua en el cilindro)
        aparece torcida.
      </p>
    ),
  },
  flexion: {
    formula: "σ = M / W",
    ej: "Mango de llave",
    valor: "≈ 190 MPa",
    caption: (
      <p>
        <b>Flexión:</b> la pieza se dobla (la línea punteada es cómo estaba sin carga). Las fibras de arriba se estiran (tracción,
        rojo), las de abajo se aplastan (compresión, azul) y en el medio hay una línea que no cambia de largo: la <b>fibra neutra</b>.
        La tensión máxima está en la superficie: σ = M / W, donde M es el momento (fuerza × distancia) y W depende de la forma de la
        sección. El mango de una llave de 25 cm (sección 20 × 6 mm) con 300 N en la punta: M = 75 N·m, W = 400 mm³ →{" "}
        <b>≈ 190 MPa</b>. Por eso una viga en "I" o un tubo aguantan tanto con poco material. Trabajan así los elásticos de ballesta,
        las parrillas, el cigüeñal entre bancadas y los dientes de los engranajes.
      </p>
    ),
  },
  corte: {
    formula: "τ = F / A",
    ej: "Bulón de pistón (doble corte)",
    valor: "≈ 56 MPa",
    caption: (
      <p>
        <b>Corte (cizallamiento):</b> dos piezas quieren deslizarse una sobre otra y el perno que las une trabaja como una tijera. La
        tensión de corte es τ = F / A en el plano de corte. El bulón del pistón trabaja en <b>doble corte</b> (dos planos): con 35 kN y
        Ø 20 mm, A = 2 × 314 mm² → <b>≈ 56 MPa</b>. También: la chaveta de una polea, el perno de la horquilla del embrague y los
        remaches de las cintas de freno.
      </p>
    ),
  },
  torsion: {
    formula: "τ = T / Wt",
    ej: "Semieje Ø 24 mm en 1ª",
    valor: "≈ 360 MPa",
    caption: (
      <p>
        <b>Torsión:</b> la pieza se retuerce. Las líneas rectas de la superficie se vuelven hélices. La tensión es máxima en la
        superficie y nula en el centro: τ = T / Wt, con Wt = π·d³/16 para un eje macizo. Un semieje de Ø 24 mm que recibe ≈ 980 N·m
        arrancando en primera trabaja a <b>≈ 360 MPa</b>. También: barra estabilizadora, barra de torsión, cigüeñal, columna de dirección.
        Fijate que el diámetro va <b>al cubo</b>: un eje un 26 % más grueso aguanta el doble.
      </p>
    ),
  },
};

export function FisEsfuerzos() {
  const clock = useAnimClock({ speed: 0.6 });
  const [mode, setMode] = useState<Mode>("flexion");
  const k = 0.5 - 0.5 * Math.cos(clock.t * TAU * 0.4); // carga 0..1
  const info = INFO[mode];
  return (
    <AnimFrame
      title="Los cinco esfuerzos: cómo trabaja cada pieza"
      clock={clock}
      controls={
        <div style={{ maxWidth: "100%", overflowX: "auto" }}><Seg
          value={mode}
          onChange={setMode}
          ariaLabel="Tipo de esfuerzo"
          options={[
            { value: "traccion", label: "Tracción" },
            { value: "compresion", label: "Compresión" },
            { value: "flexion", label: "Flexión" },
            { value: "corte", label: "Corte" },
            { value: "torsion", label: "Torsión" },
          ]}
        /></div>
      }
      readouts={
        <>
          <Readout label="Carga" value={fmt(k * 100, 0)} unit="%" />
          <Readout label="Fórmula" value={info.formula} />
          <Readout label="Ejemplo" value={info.ej} />
          <Readout label="Tensión del ejemplo" value={info.valor} tone="accent" />
        </>
      }
      legend={[
        { color: "var(--accent)", label: "Fuerza o momento aplicado" },
        { color: "var(--bad)", label: "Zona estirada (tracción)" },
        { color: "var(--primary)", label: "Zona aplastada (compresión)" },
      ]}
      caption={<>{info.caption}<p className="faint" style={{ fontSize: ".82rem" }}>Deformaciones dibujadas cientos de veces más grandes que en la realidad.</p></>}
    >
      <svg viewBox="0 0 720 300" role="img" aria-label={`Pieza sometida a ${mode}`}>
        {mode === "traccion" && <Axial k={k} sign={1} />}
        {mode === "compresion" && <Axial k={k} sign={-1} />}
        {mode === "flexion" && <Flexion k={k} />}
        {mode === "corte" && <Corte k={k} />}
        {mode === "torsion" && <Torsion k={k} />}
      </svg>
    </AnimFrame>
  );
}

function Wall({ x = 110 }: { x?: number }) {
  return (
    <g>
      <rect x={x - 22} y={60} width={22} height={180} fill="var(--c-metal-dark)" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={x - 22} y1={70 + i * 20} x2={x - 34} y2={82 + i * 20} stroke="var(--c-metal-dark)" strokeWidth={2} />
      ))}
    </g>
  );
}

function Axial({ k, sign }: { k: number; sign: 1 | -1 }) {
  const X0 = 110, L = 400, H = 70, CY = 150;
  const dL = sign * 46 * k;
  const h = H * (1 - sign * 0.1 * k);
  const len = L + dL;
  const tint = sign > 0 ? "var(--bad)" : "var(--primary)";
  const xs = Array.from({ length: 9 }, (_, i) => X0 + (len * (i + 1)) / 10);
  const ax = X0 + len;
  return (
    <g>
      <Wall />
      <rect x={X0} y={CY - h / 2} width={len} height={h} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      <rect x={X0} y={CY - h / 2} width={len} height={h} fill={tint} opacity={0.08 + 0.3 * k} />
      {xs.map((x, i) => <line key={i} x1={x} y1={CY - h / 2} x2={x} y2={CY + h / 2} stroke="var(--c-metal-dark)" strokeWidth={1} opacity={0.6} />)}
      <line x1={X0} y1={CY} x2={ax} y2={CY} stroke="var(--c-metal-dark)" strokeDasharray="4 4" opacity={0.5} />
      {/* largo original */}
      <line x1={X0 + L} y1={CY - H / 2 - 22} x2={X0 + L} y2={CY + H / 2 + 22} stroke="var(--muted)" strokeDasharray="3 3" />
      <text x={X0 + L} y={CY + H / 2 + 36} textAnchor="middle" className="svg-small">largo original</text>
      {sign > 0 ? (
        <Arrow x1={ax + 6} y1={CY} x2={ax + 40 + 50 * k} y2={CY} color="var(--accent)" width={5} head={14} />
      ) : (
        <Arrow x1={ax + 50 + 50 * k} y1={CY} x2={ax + 6} y2={CY} color="var(--accent)" width={5} head={14} />
      )}
      <text x={ax + 30} y={CY - 22} className="svg-label" style={{ fill: "var(--accent)" }}>F</text>
      <text x={X0 - 20} y={40} className="svg-label">
        {sign > 0 ? "Se alarga y se afina (un bulón de rueda apretado se estira ≈ 0,1 mm)" : "Se acorta y se ensancha (una biela se acorta < 0,1 mm en la explosión)"}
      </text>
    </g>
  );
}

function Flexion({ k }: { k: number }) {
  const X0 = 110, L = 470, CY = 120, T = 40;
  const delta = 90 * k;
  const yAt = (x: number) => { const s = (x - X0) / L; return CY + (delta * s * s * (3 - s)) / 2; };
  const slope = (x: number) => { const s = (x - X0) / L; return (delta * (6 * s - 3 * s * s)) / 2 / L; };
  const N = 40;
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const x = X0 + (L * i) / N;
    const y = yAt(x);
    const a = Math.atan(slope(x));
    return { x, y, nx: -Math.sin(a), ny: Math.cos(a) };
  });
  const edge = (off: number) => pts.map((p, i) => `${i ? "L" : "M"}${(p.x + p.nx * off).toFixed(1)},${(p.y + p.ny * off).toFixed(1)}`).join(" ");
  const top = edge(-T / 2), mid = edge(0);
  const bottomRev = pts.slice().reverse().map((p) => `L${(p.x + p.nx * (T / 2)).toFixed(1)},${(p.y + p.ny * (T / 2)).toFixed(1)}`).join(" ");
  const upperHalf = `${top} ${pts.slice().reverse().map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")} Z`;
  const lowerHalf = `${mid} ${bottomRev} Z`;
  const end = pts[N];
  return (
    <g>
      <Wall />
      <path d={`${top} ${bottomRev} Z`} fill="var(--c-metal-light)" stroke="none" />
      <path d={upperHalf} fill="var(--bad)" opacity={0.08 + 0.35 * k} />
      <path d={lowerHalf} fill="var(--primary)" opacity={0.08 + 0.35 * k} />
      <path d={`${top} ${bottomRev} Z`} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      {pts.filter((_, i) => i % 5 === 0 && i > 0 && i < N).map((p, i) => (
        <line key={i} x1={p.x - p.nx * (T / 2)} y1={p.y - p.ny * (T / 2)} x2={p.x + p.nx * (T / 2)} y2={p.y + p.ny * (T / 2)} stroke="var(--c-metal-dark)" opacity={0.6} />
      ))}
      <path d={mid} fill="none" stroke="var(--text)" strokeDasharray="5 4" opacity={0.6} />
      <rect x={X0} y={CY - T / 2} width={L} height={T} fill="none" stroke="var(--muted)" strokeDasharray="3 4" opacity={0.6} />
      <Arrow x1={end.x} y1={end.y - 80} x2={end.x} y2={end.y - T / 2 - 4} color="var(--accent)" width={5} head={14} />
      <text x={end.x + 10} y={end.y - 60} className="svg-label" style={{ fill: "var(--accent)" }}>F</text>
      <text x={X0 + 30} y={CY - T / 2 - 12} className="svg-small" style={{ fill: "var(--bad)" }}>arriba: se estira (tracción)</text>
      <text x={X0 + 30} y={pts[18].y + T / 2 + 18} className="svg-small" style={{ fill: "var(--primary)" }}>abajo: se aplasta (compresión)</text>
      <text x={X0 + L * 0.4} y={yAt(X0 + L * 0.4) - 4} className="svg-small" style={{ fontSize: 9.5 }}>fibra neutra</text>
      <text x={X0} y={270} className="svg-small">Momento máximo en el empotramiento: M = F · L. Ahí es donde se rompe una pieza doblada.</text>
    </g>
  );
}

function Corte({ k }: { k: number }) {
  const CX = 360, YP = 150, PW = 300, PH = 46, R = 22;
  const d = 26 * k; // desplazamiento relativo de cada placa
  const g = 10 * k; // deformación del perno en el plano de corte
  return (
    <g>
      {/* placa de arriba se va a la derecha, la de abajo a la izquierda */}
      <rect x={CX - PW / 2 + d} y={YP - PH} width={PW} height={PH} rx={4} fill="var(--c-block)" stroke="var(--c-metal-dark)" />
      <rect x={CX - PW / 2 - d - 40} y={YP} width={PW} height={PH} rx={4} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" />
      {/* perno: mitad de arriba con la placa de arriba, mitad de abajo con la de abajo, deformado en el plano */}
      <path
        d={`M${CX - R + d * 0.25},${YP - PH - 12} L${CX + R + d * 0.25},${YP - PH - 12} L${CX + R + d * 0.25},${YP - 8} L${CX + R - d * 0.25 + g},${YP + 8} L${CX + R - d * 0.25},${YP + PH + 12} L${CX - R - d * 0.25},${YP + PH + 12} L${CX - R - d * 0.25},${YP + 8} L${CX - R + d * 0.25 - g},${YP - 8} Z`}
        fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5}
      />
      <rect x={CX - R - 8 + d * 0.25} y={YP - PH - 22} width={2 * R + 16} height={12} rx={3} fill="var(--c-metal-2)" />
      <rect x={CX - R - 8 - d * 0.25} y={YP + PH + 10} width={2 * R + 16} height={12} rx={3} fill="var(--c-metal-2)" />
      <rect x={CX - R - 4} y={YP - 7} width={2 * R + 8} height={14} fill="var(--bad)" opacity={0.15 + 0.5 * k} />
      <line x1={CX - PW / 2 - 70} y1={YP} x2={CX + PW / 2 + 60} y2={YP} stroke="var(--bad)" strokeDasharray="6 4" />
      <text x={CX + PW / 2 + 40} y={YP - 8} textAnchor="end" className="svg-small" style={{ fill: "var(--bad)" }}>plano de corte</text>
      <Arrow x1={CX + PW / 2 + d + 4} y1={YP - PH / 2} x2={CX + PW / 2 + d + 50 + 30 * k} y2={YP - PH / 2} color="var(--accent)" width={5} head={14} />
      <Arrow x1={CX - PW / 2 - d - 44} y1={YP + PH / 2} x2={CX - PW / 2 - d - 90 - 30 * k} y2={YP + PH / 2} color="var(--accent)" width={5} head={14} />
      <text x={CX + PW / 2 + d + 30} y={YP - PH / 2 - 10} className="svg-label" style={{ fill: "var(--accent)" }}>F</text>
      <text x={CX - PW / 2 - d - 70} y={YP + PH / 2 + 24} className="svg-label" style={{ fill: "var(--accent)" }}>F</text>
      <text x={CX} y={268} textAnchor="middle" className="svg-small">El perno trabaja como una tijera: toda la fuerza pasa por la sección del plano de corte.</text>
    </g>
  );
}

function Torsion({ k }: { k: number }) {
  const X0 = 110, L = 440, CY = 150, R = 46;
  const twist = 1.3 * k; // rad en la punta (exagerado)
  const lines = Array.from({ length: 10 }, (_, i) => (i / 10) * TAU);
  const N = 40;
  return (
    <g>
      <Wall />
      <rect x={X0} y={CY - R} width={L} height={2 * R} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      <rect x={X0} y={CY - R} width={L} height={2 * R} fill="var(--bad)" opacity={0.05 + 0.25 * k} />
      {lines.map((p0, j) => {
        let d = "";
        let pen = false;
        for (let i = 0; i <= N; i++) {
          const x = X0 + (L * i) / N;
          const a = p0 + (twist * i) / N;
          if (Math.cos(a) > 0) {
            d += `${pen ? "L" : "M"}${x.toFixed(1)},${(CY - R * Math.sin(a)).toFixed(1)}`;
            pen = true;
          } else pen = false;
        }
        return <path key={j} d={d} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1.3} opacity={0.75} />;
      })}
      {/* cara del extremo */}
      <ellipse cx={X0 + L} cy={CY} rx={14} ry={R} fill="var(--c-metal)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
      <line x1={X0 + L} y1={CY} x2={X0 + L + 14 * Math.sin(twist) * 0.9} y2={CY - R * Math.cos(twist) * 0.9} stroke="var(--accent)" strokeWidth={3} />
      <line x1={X0 + L} y1={CY} x2={X0 + L} y2={CY - R * 0.9} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />
      {/* momento torsor */}
      <path d={`M${X0 + L + 40},${CY + R + 6} A28,${R + 14} 0 0 0 ${X0 + L + 40},${CY - R - 6}`} fill="none" stroke="var(--accent)" strokeWidth={4} />
      <Arrow x1={X0 + L + 34} y1={CY - R - 4} x2={X0 + L + 22} y2={CY - R - 9} color="var(--accent)" width={4} head={13} />
      <text x={X0 + L + 76} y={CY + 4} className="svg-label" style={{ fill: "var(--accent)" }}>T</text>
      <text x={X0 - 20} y={40} className="svg-label">Las rectas de la superficie se vuelven hélices (un semieje se retuerce varios grados al arrancar fuerte)</text>
      <text x={X0} y={270} className="svg-small">La tensión es cero en el centro y máxima en la superficie: por eso un tubo resiste casi como un eje macizo.</text>
    </g>
  );
}
