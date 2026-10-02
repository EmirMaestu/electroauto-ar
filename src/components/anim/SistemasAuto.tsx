/* El auto como sistema: vista lateral esquemática (dibujo original) con los grandes
   sistemas resaltables y el recorrido de la energía del tanque (o la batería) a las ruedas.
   Tracción delantera, trasera o 4x4, y versión naftera o eléctrica. */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AnimFrame, Seg, Toggle, useAnimClock, springPath, clamp, wrap, TAU } from "../ui/anim-kit";

type SysId = "motor" | "tren" | "chasis" | "carroceria" | "electrico" | "confort";
type Traccion = "fwd" | "rwd" | "awd";
type Prop = "nafta" | "ev";

interface SysInfo {
  label: string;
  color: string;
  que: ReactNode;
  para: ReactNode;
  piezas: string[];
  piezasEv?: string[];
  links: { to: string; label: string }[];
}

const SYS: Record<SysId, SysInfo> = {
  motor: {
    label: "Motor",
    color: "var(--accent)",
    que: <>La fuente de fuerza. En un auto a nafta, gasoil o GNC es un <b>motor de combustión</b>: quema combustible adentro de los cilindros y convierte esa presión en giro del cigüeñal. En un eléctrico, es un <b>motor eléctrico</b> alimentado por una batería de alta tensión.</>,
    para: <>Generar el torque que va a mover el auto. Con él vienen sus sistemas auxiliares: combustible, admisión, escape, refrigeración y lubricación.</>,
    piezas: ["Block, pistones, bielas y cigüeñal", "Tapa de cilindros y distribución", "Tanque, bomba e inyectores", "Admisión, escape y catalizador", "Radiador, bomba de agua y termostato"],
    piezasEv: ["Batería de alta tensión", "Inversor", "Motor eléctrico", "Toma de carga", "Refrigeración de batería y motor"],
    links: [
      { to: "/aprender/motor", label: "Motor de combustión" },
      { to: "/aprender/gestion-nafta", label: "Inyección y encendido" },
      { to: "/aprender/diesel", label: "Diesel" },
      { to: "/gnc", label: "GNC" },
      { to: "/aprender/electrificacion", label: "Híbridos y eléctricos" },
    ],
  },
  tren: {
    label: "Tren motriz",
    color: "var(--primary)",
    que: <>Todo lo que lleva el giro del motor hasta las ruedas: <b>embrague, caja de cambios, diferencial y semiejes</b>. Si la tracción es trasera o 4x4, se suman el <b>cardán</b> y la <b>caja de transferencia</b>.</>,
    para: <>Adaptar la fuerza y la velocidad del motor a lo que pide el auto: mucha fuerza para salir en subida, pocas vueltas para viajar en ruta. El diferencial deja que las ruedas de un mismo eje giren distinto en las curvas.</>,
    piezas: ["Embrague y volante motor", "Caja de cambios (manual o automática)", "Diferencial", "Semiejes y homocinéticas", "Cardán y transferencia (trasera / 4x4)"],
    piezasEv: ["Reductor (una sola marcha)", "Diferencial", "Semiejes y homocinéticas"],
    links: [{ to: "/aprender/transmision", label: "Tren motriz" }, { to: "/aprender/vehiculo", label: "Física del vehículo" }],
  },
  chasis: {
    label: "Chasis",
    color: "var(--teal)",
    que: <>Los sistemas que unen el auto al piso: <b>suspensión, dirección, frenos, ruedas y cubiertas</b>. (En la calle «chasis» también se usa para la estructura; acá hablamos de estos sistemas.)</>,
    para: <>Que el auto apoye bien, doble cuando girás el volante, frene derecho y no rebote. Es lo que más se siente al manejar y lo que más castigan el ripio y los pozos.</>,
    piezas: ["Resortes, amortiguadores, parrillas y bujes", "Caja de dirección, extremos y rótulas", "Discos, pastillas, campanas y cálipers", "Llantas y cubiertas"],
    links: [
      { to: "/aprender/chasis", label: "Suspensión, dirección, ruedas y frenos" },
      { to: "/aprender/control-chasis", label: "ABS y ESP" },
      { to: "/aprender/vehiculo", label: "Física del vehículo" },
    ],
  },
  carroceria: {
    label: "Carrocería",
    color: "var(--ok)",
    que: <>La «caja» del auto: estructura, puertas, capot, baúl, paragolpes y vidrios. Casi todos los autos de hoy son <b>monocasco</b>: la carrocería misma es la estructura que carga todo. Las pick-ups y los camiones usan <b>chasis de largueros</b> con la cabina atornillada arriba.</>,
    para: <>Llevar personas y carga, sostener al resto de los sistemas y protegerte en un choque: la trompa y la cola <b>se deforman a propósito</b> para absorber energía mientras el habitáculo se mantiene rígido.</>,
    piezas: ["Monocasco o chasis de largueros", "Zonas de deformación programada", "Barras de protección en las puertas", "Paragolpes, capot, puertas y vidrios"],
    links: [
      { to: "/aprender/carroceria", label: "Carrocería, luces, confort y seguridad" },
      { to: "/aprender/materiales", label: "Materiales" },
      { to: "/aprender/uniones", label: "Tornillos y uniones" },
    ],
  },
  electrico: {
    label: "Eléctrico y electrónico",
    color: "var(--violet)",
    que: <>La red de <b>12 V</b> (batería, alternador, burro de arranque, fusibles, relés y mazos de cables) y las <b>computadoras (ECU)</b> que controlan casi todo, conversando entre sí por redes como <b>CAN</b>.</>,
    para: <>Arrancar el motor, dar la chispa e inyectar en el momento justo, prender luces y accesorios, y que cada módulo sepa lo que hacen los demás. Hoy no queda sistema del auto sin un sensor o una ECU metida.</>,
    piezas: ["Batería y alternador", "Burro de arranque", "Fusibles, relés y mazos", "ECU de motor y otros módulos", "Redes CAN y LIN", "Luces"],
    piezasEv: ["Batería de 12 V y conversor DC-DC", "Fusibles, relés y mazos", "ECU y gestión de batería (BMS)", "Redes CAN", "Luces"],
    links: [
      { to: "/aprender/electricidad", label: "Electricidad y electrónica" },
      { to: "/aprender/electrica-vehiculo", label: "Sistema eléctrico del vehículo" },
      { to: "/aprender/electronica-auto", label: "ECUs, redes y sensores" },
    ],
  },
  confort: {
    label: "Confort y seguridad",
    color: "var(--warn)",
    que: <>Lo que hace cómodo al auto y lo que te cuida: <b>aire acondicionado</b>, calefacción, cierre centralizado y alarma por un lado; <b>airbags, cinturones con pretensor, ABS, ESP</b> y asistentes de manejo por el otro.</>,
    para: <><b>Seguridad activa</b>: evitar el choque (ABS, ESP, frenado automático). <b>Seguridad pasiva</b>: que el choque lastime lo menos posible (cinturón, airbag, carrocería). <b>Confort</b>: cruzar el centro de Mendoza en enero sin derretirte.</>,
    piezas: ["Aire acondicionado: compresor, condensador y evaporador", "Airbags y pretensores", "ABS, ESP y control de tracción", "Cierre, inmovilizador y alarma", "Cámaras, radar y sensores de estacionamiento"],
    links: [
      { to: "/aprender/carroceria", label: "Confort y seguridad" },
      { to: "/aprender/control-chasis", label: "ABS, ESP y control de tracción" },
      { to: "/aprender/adas", label: "Asistencia al conductor" },
    ],
  },
};
const ORDER: SysId[] = ["motor", "tren", "chasis", "carroceria", "electrico", "confort"];

/* ----------------------------------------------------------- geometría */
const G = 292; // piso
const R = 40; // radio de rueda
const RW = { x: 190, y: 252 };
const FW = { x: 532, y: 252 };
const BODY =
  "M96 250 L92 206 Q90 170 112 162 L168 154 Q214 104 262 94 L418 90 Q444 90 462 106 L510 156 L618 168 Q646 172 652 196 L656 236 Q657 252 646 254 L580 254 A48 48 0 0 0 484 254 L238 254 A48 48 0 0 0 142 254 L104 254 Q96 254 96 250 Z";
const GLASS = "M176 152 Q216 110 264 102 L414 99 Q434 99 448 113 L492 154 Z";

const STEP_S = 3.5; // segundos por paso del recorrido

/** Tamaño de letra legible: agranda el texto del SVG cuando el dibujo se achica (celular). */
function useFontScale(ref: React.RefObject<SVGSVGElement | null>, base = 720) {
  const [k, setK] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setK(clamp(base / Math.max(1, e.contentRect.width), 1, 1.6)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, base]);
  return k;
}

interface LabelSpec { x: number; y: number; tx: number; ty: number; text: string; anchor?: "start" | "middle" | "end" }
interface PlacedLabel { x: number; y: number; tx: number; ty: number; text: string; top: boolean }

/** Ubica las etiquetas en una o dos filas (arriba y abajo del auto) sin que se pisen. */
function layoutLabels(specs: LabelSpec[], fs: number): PlacedLabel[] {
  const out: PlacedLabel[] = [];
  const width = (t: string) => t.length * fs * 0.58 + 12;
  for (const top of [true, false]) {
    const items = specs.filter((l) => (l.ty < 200) === top).sort((a, b) => a.tx - b.tx);
    if (!items.length) continue;
    const total = items.reduce((acc, l) => acc + width(l.text), 0);
    const rows = total > 690 ? 2 : 1;
    for (let r = 0; r < rows; r++) {
      const row = items.filter((_, i) => i % rows === r);
      const w = row.map((l) => width(l.text));
      const xs = row.map((l) => l.tx);
      for (let i = 0; i < xs.length; i++) {
        xs[i] = Math.max(xs[i], 4 + w[i] / 2);
        if (i > 0) xs[i] = Math.max(xs[i], xs[i - 1] + (w[i - 1] + w[i]) / 2);
      }
      for (let i = xs.length - 1; i >= 0; i--) {
        xs[i] = Math.min(xs[i], 716 - w[i] / 2);
        if (i < xs.length - 1) xs[i] = Math.min(xs[i], xs[i + 1] - (w[i + 1] + w[i]) / 2);
      }
      const ty = top ? (rows === 2 && r === 0 ? 44 : rows === 2 ? 44 + fs + 6 : 50) : rows === 2 && r === 1 ? 318 + fs + 4 : 318;
      row.forEach((l, i) => out.push({ x: l.x, y: l.y, tx: xs[i], ty, text: l.text, top }));
    }
  }
  return out;
}

function Labels({ items, color, fs }: { items: PlacedLabel[]; color: string; fs: number }) {
  return (
    <g pointerEvents="none">
      {items.map((p, i) => (
        <g key={"l" + i}>
          <line x1={p.x} y1={p.y} x2={p.tx} y2={p.top ? p.ty + 5 : p.ty - fs} stroke={color} strokeWidth={1.3} strokeDasharray="3 3" />
          <circle cx={p.x} cy={p.y} r={3.2} fill={color} />
        </g>
      ))}
      {items.map((p, i) => (
        <text
          key={"t" + i} x={p.tx} y={p.ty} textAnchor="middle"
          style={{ fontSize: fs, fontWeight: 700, fill: "var(--text)", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 4, strokeLinejoin: "round" }}
        >{p.text}</text>
      ))}
    </g>
  );
}

function Wheel({ cx, cy, phi }: { cx: number; cy: number; phi: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={R} fill="var(--c-rubber)" stroke="var(--border-strong)" strokeWidth={2} />
      <circle r={R - 7} fill="none" stroke="var(--c-metal-dark)" strokeWidth={1.2} opacity={0.7} />
      <circle r={27} fill="var(--c-metal-2)" />
      <circle r={21} fill="var(--c-metal-dark)" />
      <rect x={-7} y={-27} width={14} height={15} rx={4} fill="var(--bad)" transform="rotate(-38)" />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = phi + (i * TAU) / 5;
        return <line key={i} x1={Math.cos(a) * 7} y1={Math.sin(a) * 7} x2={Math.cos(a) * 25} y2={Math.sin(a) * 25} stroke="var(--c-metal-light)" strokeWidth={5} strokeLinecap="round" />;
      })}
      <circle r={26} fill="none" stroke="var(--c-metal-light)" strokeWidth={2.5} />
      <circle r={6} fill="var(--c-metal-light)" stroke="var(--c-metal-dark)" strokeWidth={1.5} />
    </g>
  );
}

interface Step { t: string; d: ReactNode }

function stepsFor(prop: Prop, tr: Traccion): Step[] {
  if (prop === "ev")
    return [
      { t: "Batería", d: <>La <b>batería de alta tensión</b> (entre 300 y 800 V según el auto) guarda energía eléctrica. Va abajo del piso, entre los ejes.</> },
      { t: "Inversor", d: <>El <b>inversor</b> convierte la corriente continua de la batería en alterna trifásica y le dosifica el torque al motor.</> },
      { t: "Motor eléctrico", d: <>El <b>motor eléctrico</b> transforma casi toda esa electricidad en giro: pierde muy poco en calor.{tr === "awd" ? " Con dos motores, uno por eje, la tracción es total." : ""}</> },
      { t: "Reductor", d: <>Un <b>reductor</b> de una sola marcha y el diferencial: el motor eléctrico tiene fuerza desde cero vueltas, así que no hace falta caja de cambios.</> },
      { t: "Ruedas", d: <>Llega a las ruedas cerca del <b>85–90 %</b> de lo que salió de la batería. Y al frenar, el motor funciona como generador y <b>devuelve energía</b>.</> },
    ];
  return [
    { t: "Tanque", d: <>La nafta guarda <b>energía química</b>. La bomba del tanque la empuja por el caño hasta los inyectores del motor.</> },
    { t: "Motor", d: <>Se quema mezclada con aire: la presión empuja los pistones y el <b>cigüeñal gira</b>. Ojo: casi dos tercios se van en <b>calor</b> por el escape y el radiador.</> },
    { t: "Embrague y caja", d: <>El <b>embrague</b> conecta y desconecta el motor; la <b>caja</b> elige la relación: primera para salir con fuerza, quinta para la ruta con pocas vueltas.</> },
    {
      t: tr === "fwd" ? "Diferencial" : tr === "rwd" ? "Cardán y diferencial" : "Transferencia y diferenciales",
      d: tr === "fwd"
        ? <>En la tracción delantera la caja y el <b>diferencial</b> vienen en un solo bloque. El diferencial reparte el giro a los dos <b>semiejes</b> y deja que las ruedas giren distinto en una curva.</>
        : tr === "rwd"
          ? <>El <b>cardán</b> lleva el giro hasta el <b>diferencial trasero</b> (la «bocha»), que lo reparte entre las dos ruedas de atrás.</>
          : <>La <b>caja de transferencia</b> reparte entre el eje trasero y el delantero, cada uno con su cardán y su diferencial.</>,
    },
    { t: "Ruedas", d: <>Las cubiertas empujan contra el piso y el auto avanza. Lo que llega acá es apenas <b>entre un 15 y un 25 %</b> de la energía que había en la nafta.</> },
  ];
}

export function SistemasAuto() {
  const clock = useAnimClock({ speed: 1 });
  const [sel, setSel] = useState<SysId | null>(null);
  const [hover, setHover] = useState<SysId | null>(null);
  const [tr, setTr] = useState<Traccion>("fwd");
  const [prop, setProp] = useState<Prop>("nafta");
  const [energy, setEnergy] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const fsK = useFontScale(svgRef);
  const uid = useId().replace(/:/g, "");
  const fs = 13 * fsK;

  const ev = prop === "ev";
  const t = Math.max(0, clock.t);
  const steps = stepsFor(prop, tr);
  const k = clamp(Math.floor(wrap(t, STEP_S * steps.length) / STEP_S), 0, steps.length - 1);
  const v = energy ? 70 : 0; // px/s de avance (sólo visual)
  const phi = (t * v) / R;
  const flow = -t * 42;

  const front = tr === "fwd" || tr === "awd";
  const rear = tr === "rwd" || tr === "awd";

  const op = (id: SysId) => (sel === null || sel === id || hover === id ? 1 : id === "carroceria" ? 0.4 : 0.14);
  const hl = (id: SysId) => sel === id;
  const click = (id: SysId) => setSel((s) => (s === id ? null : id));
  const gp = (id: SysId) => ({
    opacity: op(id),
    style: { cursor: "pointer", transition: "opacity .25s" } as React.CSSProperties,
    onClick: () => click(id),
    onMouseEnter: () => setHover(id),
    onMouseLeave: () => setHover(null),
  });
  const C = (id: SysId) => SYS[id].color;
  const strokeOf = (id: SysId, base: string) => (hl(id) ? C(id) : base);
  const sw = (id: SysId, base = 1.5) => (hl(id) ? 3 : base);

  /* Recorrido de la energía: trayectos (path) por tramo. */
  const fuelPath = "M306 246 L470 249 Q536 250 548 222";
  const evCableF = "M486 246 Q536 246 560 214";
  const evCableR = "M256 246 Q236 244 236 232";
  const enginePos = { x: 590, y: 222 };
  const mech: string[] = [];
  if (!ev) {
    if (tr === "fwd") mech.push(`M${enginePos.x} ${enginePos.y} L530 228 L${FW.x} ${FW.y}`);
    else {
      mech.push(`M${enginePos.x} ${enginePos.y} L522 222 L500 230 L${RW.x + 14} ${RW.y - 4} L${RW.x} ${RW.y}`);
      if (tr === "awd") mech.push(`M462 234 L506 246 L${FW.x} ${FW.y}`);
    }
  } else {
    if (front) mech.push(`M582 206 L574 236 L${FW.x} ${FW.y}`);
    if (rear) mech.push(`M262 222 L236 236 L${RW.x} ${RW.y}`);
  }

  // Cajas para resaltar el paso actual del recorrido
  type Box = { x: number; y: number; w: number; h: number } | { cx: number; cy: number; r: number };
  const stepBoxes: Box[][] = ev
    ? [
        [{ x: 252, y: 234, w: 238, h: 28 }],
        [...(front ? [{ x: 550, y: 192, w: 66, h: 28 }] : []), ...(rear ? [{ x: 238, y: 208, w: 56, h: 24 }] : [])],
        [...(front ? [{ cx: 574, cy: 236, r: 24 }] : []), ...(rear ? [{ cx: 236, cy: 234, r: 22 }] : [])],
        [...(front ? [{ cx: FW.x, cy: FW.y, r: 15 }] : []), ...(rear ? [{ cx: RW.x, cy: RW.y, r: 15 }] : [])],
        [...(front ? [{ cx: FW.x, cy: FW.y, r: R + 6 }] : []), ...(rear ? [{ cx: RW.x, cy: RW.y, r: R + 6 }] : [])],
      ]
    : [
        [{ x: 230, y: 222, w: 82, h: 36 }],
        [{ x: 544, y: 186, w: 88, h: 66 }],
        [tr === "fwd" ? { x: 500, y: 206, w: 58, h: 44 } : { x: 492, y: 200, w: 62, h: 40 }],
        tr === "fwd"
          ? [{ cx: FW.x, cy: FW.y, r: 15 }]
          : tr === "rwd"
            ? [{ cx: RW.x, cy: RW.y, r: 18 }, { x: 214, y: 226, w: 270, h: 22 }]
            : [{ cx: RW.x, cy: RW.y, r: 18 }, { cx: FW.x, cy: FW.y, r: 15 }, { x: 440, y: 214, w: 34, h: 32 }],
        [...(front ? [{ cx: FW.x, cy: FW.y, r: R + 6 }] : []), ...(rear ? [{ cx: RW.x, cy: RW.y, r: R + 6 }] : [])],
      ];
  const pulse = 0.55 + 0.45 * Math.sin(t * 6);

  const info = sel ? SYS[sel] : null;
  const piezas = info ? (ev && info.piezasEv ? info.piezasEv : info.piezas) : [];

  // Etiquetas del sistema elegido
  const labels: LabelSpec[] = [];
  if (sel === "motor") {
    if (!ev) {
      labels.push({ x: 592, y: 214, tx: 600, ty: 40, text: "motor" });
      labels.push({ x: 270, y: 240, tx: 270, ty: 322, text: "tanque" });
      labels.push({ x: 504, y: 262, tx: 470, ty: 322, text: "catalizador" });
      labels.push({ x: 128, y: 262, tx: 120, ty: 322, text: "silenciador" });
    } else {
      labels.push({ x: 370, y: 248, tx: 370, ty: 322, text: "batería de alta tensión" });
      if (front) labels.push({ x: 582, y: 206, tx: 600, ty: 40, text: "inversor" });
      if (front) labels.push({ x: 574, y: 236, tx: 600, ty: 322, text: "motor eléctrico" });
      if (rear) labels.push({ x: 236, y: 234, tx: 200, ty: 40, text: tr === "awd" ? "motor trasero" : "motor eléctrico" });
      labels.push({ x: 124, y: 174, tx: 90, ty: 70, text: "toma de carga", anchor: "start" });
    }
    labels.push({ x: 638, y: 210, tx: 714, ty: 120, text: "radiador", anchor: "end" });
  } else if (sel === "tren") {
    if (ev) {
      if (front) labels.push({ x: FW.x, y: FW.y, tx: 560, ty: 322, text: "reductor + diferencial" });
      if (rear) labels.push({ x: RW.x, y: RW.y, tx: 190, ty: 322, text: "reductor + diferencial" });
    } else if (tr === "fwd") {
      labels.push({ x: 528, y: 222, tx: 470, ty: 40, text: "embrague y caja" });
      labels.push({ x: FW.x, y: FW.y, tx: 560, ty: 322, text: "diferencial" });
    } else {
      labels.push({ x: 522, y: 220, tx: 520, ty: 40, text: "embrague y caja" });
      labels.push({ x: 340, y: 238, tx: 340, ty: 322, text: "cardán" });
      labels.push({ x: RW.x, y: RW.y, tx: 150, ty: 322, text: "diferencial trasero" });
      if (tr === "awd") {
        labels.push({ x: 456, y: 230, tx: 380, ty: 40, text: "transferencia" });
        labels.push({ x: FW.x, y: FW.y, tx: 580, ty: 322, text: "diferencial delantero" });
      }
    }
  } else if (sel === "chasis") {
    labels.push({ x: 532, y: 196, tx: 560, ty: 40, text: "suspensión" });
    labels.push({ x: 448, y: 142, tx: 400, ty: 40, text: "dirección" });
    labels.push({ x: 175, y: 233, tx: 120, ty: 322, text: "disco y cáliper" });
    labels.push({ x: 548, y: 286, tx: 560, ty: 322, text: "cubierta" });
  } else if (sel === "carroceria") {
    labels.push({ x: 622, y: 210, tx: 640, ty: 40, text: "deformación" });
    labels.push({ x: 120, y: 200, tx: 110, ty: 40, text: "deformación" });
    labels.push({ x: 330, y: 130, tx: 340, ty: 40, text: "habitáculo rígido" });
    labels.push({ x: 360, y: 216, tx: 360, ty: 322, text: "barra lateral" });
  } else if (sel === "electrico") {
    labels.push({ x: 604, y: 178, tx: 640, ty: 40, text: "batería 12 V" });
    labels.push({ x: 472, y: 174, tx: 470, ty: 40, text: "ECU" });
    if (!ev) labels.push({ x: 614, y: 238, tx: 640, ty: 322, text: "alternador" });
    labels.push({ x: 300, y: 172, tx: 300, ty: 40, text: "mazo y red CAN" });
    labels.push({ x: 99, y: 182, tx: 100, ty: 100, text: "luces", anchor: "middle" });
  } else if (sel === "confort") {
    labels.push({ x: 440, y: 132, tx: 450, ty: 40, text: "airbag" });
    labels.push({ x: 400, y: 160, tx: 330, ty: 40, text: "cinturón" });
    labels.push({ x: 468, y: 194, tx: 420, ty: 322, text: "aire acondicionado" });
    labels.push({ x: 646, y: 214, tx: 714, ty: 120, text: "condensador", anchor: "end" });
  }

  return (
    <AnimFrame
      title="El auto por dentro: sistemas y recorrido de la energía"
      clock={clock}
      controls={
        <>
          <Seg value={prop} onChange={setProp} ariaLabel="Propulsión" options={[{ value: "nafta", label: "⛽ Nafta" }, { value: "ev", label: "🔋 Eléctrico" }]} />
          <Seg value={tr} onChange={setTr} ariaLabel="Tracción" options={[{ value: "fwd", label: "Delantera" }, { value: "rwd", label: "Trasera" }, { value: "awd", label: "4x4" }]} />
          <Toggle label="Recorrido de la energía" checked={energy} onChange={setEnergy} />
        </>
      }
      legend={ORDER.map((id) => ({ color: SYS[id].color, label: SYS[id].label }))}
      caption={
        <p>
          <b>Tocá una parte del dibujo</b> (o un botón de arriba) para ver qué sistema es, para qué sirve y dónde se estudia en el curso.
          Con <b>Recorrido de la energía</b> seguís el camino completo: {ev ? "batería → inversor → motor eléctrico → reductor → ruedas" : "tanque → motor → caja → diferencial → ruedas"}.
          Cambiá la <b>tracción</b> y fijate qué ruedas reciben la fuerza (las que tienen el anillo).
        </p>
      }
    >
      <div className="chip-row" style={{ margin: "0 0 .5rem" }}>
        <button className={`chip ${sel === null ? "on" : ""}`} onClick={() => setSel(null)}>Todo</button>
        {ORDER.map((id) => (
          <button key={id} className={`chip ${sel === id ? "on" : ""}`} onClick={() => click(id)}>
            <i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: SYS[id].color }} />
            {SYS[id].label}
          </button>
        ))}
      </div>

      {energy && (
        <div style={{ marginBottom: ".4rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem", alignItems: "center" }}>
            {steps.map((s, i) => (
              <button
                key={s.t}
                className={`chip ${i === k ? "on" : ""}`}
                style={{ padding: ".15rem .55rem", fontSize: ".78rem" }}
                onClick={() => { clock.setPlaying(false); clock.step(i * STEP_S + 0.01 - wrap(t, STEP_S * steps.length)); }}
                title="Ir a este paso"
              >
                {i + 1}. {s.t}
              </button>
            ))}
          </div>
          <p style={{ margin: ".4rem 0 0", fontSize: ".9rem", color: "var(--text-2)", minHeight: "2.6em" }}>{steps[k].d}</p>
        </div>
      )}

      <svg ref={svgRef} viewBox="0 22 720 324" role="img" aria-label="Vista lateral esquemática de un auto con sus sistemas">
        <defs>
          <pattern id={`${uid}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--ok)" strokeWidth="3" opacity="0.55" />
          </pattern>
        </defs>

        {/* Piso */}
        <line x1={20} y1={G} x2={700} y2={G} stroke="var(--border-strong)" strokeWidth={2} />
        {Array.from({ length: 13 }, (_, i) => {
          const x = ((((i * 60 - t * v) % 780) + 780) % 780) - 30;
          return <line key={i} x1={x} y1={G + 9} x2={x + 26} y2={G + 9} stroke="var(--border-strong)" strokeWidth={3} strokeLinecap="round" opacity={0.7} />;
        })}
        <ellipse cx={372} cy={G + 2} rx={290} ry={6} fill="var(--text)" opacity={0.07} />

        {/* ------------------------------------------------ CARROCERÍA */}
        <g {...gp("carroceria")}>
          <path d={BODY} fill="var(--surface)" stroke={strokeOf("carroceria", "var(--muted)")} strokeWidth={sw("carroceria", 2)} />
          <path d={GLASS} fill="var(--c-mix)" opacity={0.2} />
          <path d={GLASS} fill="none" stroke="var(--c-metal-2)" strokeWidth={1.2} />
          <rect x={338} y={99} width={9} height={57} fill="var(--surface)" stroke="var(--c-metal-2)" strokeWidth={1} />
          <line x1={342} y1={156} x2={342} y2={250} stroke="var(--c-metal-2)" strokeWidth={1.2} />
          <path d="M240 156 L240 214 Q240 226 232 232" fill="none" stroke="var(--c-metal-2)" strokeWidth={1.2} />
          <path d="M494 158 L494 204" fill="none" stroke="var(--c-metal-2)" strokeWidth={1.2} />
          <line x1={170} y1={157} x2={500} y2={160} stroke="var(--c-metal-2)" strokeWidth={1} opacity={0.7} />
          <rect x={300} y={170} width={18} height={4} rx={2} fill="var(--c-metal-2)" />
          <rect x={450} y={172} width={18} height={4} rx={2} fill="var(--c-metal-2)" />
          <path d="M640 232 L657 232 L657 250 Q656 254 646 254 L628 254 Z" fill="var(--c-metal-2)" opacity={0.8} />
          <path d="M93 230 L110 230 L110 254 L104 254 Q96 254 96 250 Z" fill="var(--c-metal-2)" opacity={0.8} />
          {hl("carroceria") && (
            <g pointerEvents="none">
              <path d="M598 166 L618 168 Q646 172 652 196 L656 236 Q657 252 646 254 L598 254 Z" fill={`url(#${uid}-hatch)`} />
              <path d="M96 250 L92 206 Q90 170 112 162 L150 157 L150 254 L104 254 Q96 254 96 250 Z" fill={`url(#${uid}-hatch)`} />
              <path d="M172 156 Q214 104 262 96 L418 92 Q444 92 460 108 L506 160 L500 250 L240 250 Z" fill="none" stroke="var(--ok)" strokeWidth={3} strokeDasharray="8 5" />
              <line x1={250} y1={216} x2={486} y2={216} stroke="var(--ok)" strokeWidth={5} strokeLinecap="round" opacity={0.8} />
            </g>
          )}
        </g>

        {/* ---------------------------------------- CONFORT (asientos, AA, airbags) */}
        <g {...gp("confort")}>
          {/* asientos */}
          <path d="M372 122 Q382 116 388 124 L396 196 L380 198 Z" fill="var(--c-metal-2)" opacity={0.55} />
          <rect x={360} y={194} width={70} height={11} rx={5} fill="var(--c-metal-2)" opacity={0.55} />
          <path d="M262 128 Q272 122 278 130 L284 198 L268 200 Z" fill="var(--c-metal-2)" opacity={0.55} />
          <rect x={252} y={196} width={68} height={11} rx={5} fill="var(--c-metal-2)" opacity={0.55} />
          {/* cinturón */}
          <line x1={384} y1={128} x2={418} y2={196} stroke={hl("confort") ? "var(--warn)" : "var(--c-metal-dark)"} strokeWidth={hl("confort") ? 3.5 : 2} opacity={0.85} />
          {/* aire acondicionado: evaporador, compresor, condensador y caño */}
          <rect x={456} y={186} width={26} height={14} rx={3} fill="var(--c-air)" opacity={0.75} />
          <rect x={643} y={186} width={6} height={56} rx={2} fill="var(--c-air)" opacity={0.75} />
          {!ev && <circle cx={566} cy={240} r={6} fill="var(--c-air)" stroke="var(--c-metal-dark)" />}
          <path d="M482 194 Q520 196 560 238 M570 244 Q610 252 643 238" fill="none" stroke="var(--c-air)" strokeWidth={1.6} strokeDasharray="4 3" opacity={0.8} />
          {/* airbags */}
          {hl("confort") ? (
            <g>
              <ellipse cx={428} cy={136} rx={16} ry={22} fill="var(--warn)" opacity={0.35} stroke="var(--warn)" strokeWidth={2} />
              <path d="M270 104 L432 102" stroke="var(--warn)" strokeWidth={5} strokeLinecap="round" opacity={0.6} />
            </g>
          ) : (
            <circle cx={446} cy={140} r={4} fill="var(--warn)" opacity={0.8} />
          )}
        </g>

        {/* ------------------------------------------------ CHASIS */}
        <g {...gp("chasis")}>
          {/* suspensión delantera (McPherson) y trasera */}
          <line x1={FW.x} y1={176} x2={FW.x} y2={FW.y - 8} stroke={strokeOf("chasis", "var(--c-metal-dark)")} strokeWidth={5} strokeLinecap="round" />
          <path d={springPath(FW.x, 182, 220, 4, 9)} fill="none" stroke={strokeOf("chasis", "var(--c-metal-2)")} strokeWidth={3} strokeLinejoin="round" />
          <path d={springPath(RW.x, 196, 234, 4, 9)} fill="none" stroke={strokeOf("chasis", "var(--c-metal-2)")} strokeWidth={3} strokeLinejoin="round" />
          <line x1={RW.x + 18} y1={194} x2={RW.x + 10} y2={RW.y - 6} stroke={strokeOf("chasis", "var(--c-metal-dark)")} strokeWidth={4} strokeLinecap="round" />
          {/* dirección: volante, columna y cremallera */}
          <line x1={438} y1={124} x2={452} y2={158} stroke={strokeOf("chasis", "var(--c-metal-dark)")} strokeWidth={7} strokeLinecap="round" />
          <path d="M447 144 L500 200 L516 234" fill="none" stroke={strokeOf("chasis", "var(--c-metal-2)")} strokeWidth={3} strokeLinecap="round" />
          <rect x={506} y={232} width={22} height={7} rx={3} fill={strokeOf("chasis", "var(--c-metal-dark)")} />
          {/* ruedas */}
          <g opacity={sel === "tren" ? 0.35 : 1}>
            <Wheel cx={RW.x} cy={RW.y} phi={phi} />
            <Wheel cx={FW.x} cy={FW.y} phi={phi} />
          </g>
          {hl("chasis") && (
            <g pointerEvents="none">
              <circle cx={RW.x} cy={RW.y} r={R + 3} fill="none" stroke="var(--teal)" strokeWidth={3} />
              <circle cx={FW.x} cy={FW.y} r={R + 3} fill="none" stroke="var(--teal)" strokeWidth={3} />
            </g>
          )}
        </g>

        {/* ------------------------------------------------ MOTOR */}
        <g {...gp("motor")}>
          {/* radiador */}
          <rect x={632} y={184} width={8} height={60} rx={2} fill="var(--c-coolant)" opacity={0.85} stroke={strokeOf("motor", "none")} strokeWidth={hl("motor") ? 2 : 0} />
          {!ev ? (
            <>
              {/* tanque y caño de nafta */}
              <rect x={234} y={226} width={74} height={28} rx={7} fill="var(--c-fuel)" opacity={0.75} stroke={strokeOf("motor", "var(--c-oil)")} strokeWidth={sw("motor")} />
              <path d="M244 228 Q200 196 128 176" fill="none" stroke="var(--c-fuel)" strokeWidth={4} opacity={0.6} />
              <circle cx={126} cy={176} r={4} fill="var(--c-fuel)" />
              <path d={fuelPath} fill="none" stroke="var(--c-fuel)" strokeWidth={2} opacity={0.6} />
              {/* escape */}
              <path d="M578 246 Q566 262 540 262 L160 262" fill="none" stroke="var(--c-exhaust)" strokeWidth={5} strokeLinecap="round" />
              <rect x={490} y={256} width={32} height={12} rx={5} fill="var(--c-exhaust)" stroke={strokeOf("motor", "var(--c-metal-dark)")} strokeWidth={sw("motor", 1)} />
              <rect x={108} y={254} width={50} height={16} rx={7} fill="var(--c-exhaust)" stroke={strokeOf("motor", "var(--c-metal-dark)")} strokeWidth={sw("motor", 1)} />
              <line x1={94} y1={264} x2={110} y2={264} stroke="var(--c-exhaust)" strokeWidth={4} strokeLinecap="round" />
              {/* motor: tapa, block y múltiple */}
              <rect x={552} y={202} width={72} height={46} rx={6} fill="var(--c-metal)" stroke={strokeOf("motor", "var(--c-metal-dark)")} strokeWidth={sw("motor")} />
              <rect x={548} y={190} width={80} height={14} rx={4} fill="var(--c-metal-dark)" stroke={strokeOf("motor", "none")} strokeWidth={hl("motor") ? 2 : 0} />
              {[566, 584, 602].map((x) => <rect key={x} x={x} y={194} width={10} height={6} rx={2} fill="var(--c-metal-light)" opacity={0.6} />)}
              <path d="M552 206 Q538 208 540 228" fill="none" stroke="var(--c-metal-2)" strokeWidth={6} strokeLinecap="round" />
              {energy && (
                <g pointerEvents="none" opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 9))}>
                  <circle cx={572} cy={226} r={6} fill="var(--c-flame)" />
                  <circle cx={598} cy={226} r={6} fill="var(--c-flame)" opacity={Math.abs(Math.cos(t * 9))} />
                </g>
              )}
            </>
          ) : (
            <>
              {/* batería de alta tensión, inversores, motores y cables naranjas */}
              <rect x={256} y={236} width={230} height={22} rx={5} fill="var(--c-metal-dark)" stroke={strokeOf("motor", "var(--accent)")} strokeWidth={sw("motor", 2)} />
              {Array.from({ length: 9 }, (_, i) => (
                <rect key={i} x={262 + i * 25} y={240} width={20} height={14} rx={2} fill="var(--c-elec)" opacity={0.55} />
              ))}
              <path d={evCableF} fill="none" stroke="var(--accent)" strokeWidth={4} opacity={front ? 1 : 0.15} />
              {rear && <path d={evCableR} fill="none" stroke="var(--accent)" strokeWidth={4} />}
              <path d="M262 236 Q200 200 130 176" fill="none" stroke="var(--accent)" strokeWidth={3} opacity={0.8} />
              <rect x={116} y={168} width={16} height={14} rx={3} fill="var(--c-metal-dark)" stroke="var(--accent)" strokeWidth={1.5} />
              {front && (
                <>
                  <rect x={554} y={196} width={58} height={20} rx={4} fill="var(--c-metal-2)" stroke={strokeOf("motor", "var(--c-metal-dark)")} strokeWidth={sw("motor")} />
                  <EMotor cx={574} cy={236} r={18} a={phi * 3} hl={hl("motor")} />
                </>
              )}
              {rear && (
                <>
                  <rect x={240} y={210} width={52} height={20} rx={4} fill="var(--c-metal-2)" stroke={strokeOf("motor", "var(--c-metal-dark)")} strokeWidth={sw("motor")} />
                  <EMotor cx={236} cy={234} r={16} a={phi * 3} hl={hl("motor")} />
                </>
              )}
            </>
          )}
        </g>

        {/* ------------------------------------------------ TREN MOTRIZ */}
        <g {...gp("tren")}>
          {!ev ? (
            tr === "fwd" ? (
              <>
                <rect x={504} y={210} width={50} height={36} rx={6} fill="var(--c-metal-2)" stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={sw("tren")} />
                <circle cx={530} cy={222} r={7} fill="var(--c-metal-dark)" />
                <circle cx={FW.x} cy={FW.y} r={11} fill="var(--c-metal-2)" stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={sw("tren")} />
              </>
            ) : (
              <>
                <path d="M550 206 L496 212 L496 236 L550 244 Z" fill="var(--c-metal-2)" stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={sw("tren")} />
                {tr === "awd" && (
                  <>
                    <rect x={444} y={218} width={30} height={26} rx={5} fill="var(--c-metal-2)" stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={sw("tren")} />
                    <line x1={474} y1={238} x2={FW.x - 10} y2={FW.y - 3} stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={5} strokeLinecap="round" />
                    <circle cx={FW.x} cy={FW.y} r={12} fill="var(--c-metal-2)" stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={sw("tren")} />
                  </>
                )}
                <line x1={tr === "awd" ? 444 : 496} y1={tr === "awd" ? 232 : 228} x2={RW.x + 14} y2={RW.y - 4} stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={6} strokeLinecap="round" />
                <circle cx={340} cy={240} r={4} fill="var(--c-metal-light)" />
                <circle cx={RW.x} cy={RW.y} r={14} fill="var(--c-metal-2)" stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={sw("tren")} />
              </>
            )
          ) : (
            <>
              {front && <circle cx={FW.x} cy={FW.y} r={10} fill="var(--c-metal-2)" stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={sw("tren")} />}
              {rear && <circle cx={RW.x} cy={RW.y} r={10} fill="var(--c-metal-2)" stroke={strokeOf("tren", "var(--c-metal-dark)")} strokeWidth={sw("tren")} />}
            </>
          )}
          {/* ruedas con tracción */}
          {(sel === "tren" || sel === null) && (
            <g pointerEvents="none" opacity={sel === "tren" ? 1 : 0.55}>
              {front && <circle cx={FW.x} cy={FW.y} r={R + 6} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeDasharray="6 5" />}
              {rear && <circle cx={RW.x} cy={RW.y} r={R + 6} fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeDasharray="6 5" />}
            </g>
          )}
        </g>

        {/* ------------------------------------------- ELÉCTRICO Y ELECTRÓNICO */}
        <g {...gp("electrico")}>
          <path d="M600 176 L520 168 L486 172 M486 176 Q300 168 104 182 M612 182 L650 188" fill="none" stroke="var(--violet)" strokeWidth={hl("electrico") ? 2.6 : 1.6} strokeDasharray="5 4" />
          <rect x={590} y={170} width={30} height={18} rx={3} fill="var(--c-metal-dark)" stroke={strokeOf("electrico", "var(--c-metal-dark)")} strokeWidth={sw("electrico", 1)} />
          <rect x={594} y={166} width={6} height={5} fill="var(--bad)" />
          <rect x={610} y={166} width={6} height={5} fill="var(--c-metal-light)" />
          <rect x={460} y={166} width={26} height={16} rx={2} fill="var(--c-elec)" stroke={strokeOf("electrico", "var(--c-elec)")} strokeWidth={sw("electrico", 1)} />
          {[464, 470, 476, 482].map((x) => <line key={x} x1={x} y1={182} x2={x} y2={186} stroke="var(--c-elec)" strokeWidth={1.5} />)}
          {!ev && <circle cx={614} cy={238} r={7} fill="var(--c-metal-light)" stroke={strokeOf("electrico", "var(--c-metal-dark)")} strokeWidth={sw("electrico", 1.5)} />}
          <path d="M634 178 Q652 180 655 196 L640 196 Z" fill="var(--c-spark)" opacity={0.9} stroke={strokeOf("electrico", "none")} strokeWidth={hl("electrico") ? 2 : 0} />
          <rect x={92} y={170} width={10} height={22} rx={3} fill="var(--bad)" opacity={0.9} stroke={strokeOf("electrico", "none")} strokeWidth={hl("electrico") ? 2 : 0} />
        </g>

        {/* --------------------------------------- recorrido de la energía */}
        {energy && (
          <g pointerEvents="none">
            {!ev && <path d={fuelPath} fill="none" stroke="var(--c-fuel)" strokeWidth={5} strokeDasharray="2 12" strokeDashoffset={flow} strokeLinecap="round" />}
            {ev && front && <path d={evCableF} fill="none" stroke="var(--c-spark)" strokeWidth={5} strokeDasharray="2 12" strokeDashoffset={flow} strokeLinecap="round" />}
            {ev && rear && <path d={evCableR} fill="none" stroke="var(--c-spark)" strokeWidth={5} strokeDasharray="2 12" strokeDashoffset={flow} strokeLinecap="round" />}
            {mech.map((d, i) => (
              <path key={i} d={d} fill="none" stroke="var(--accent)" strokeWidth={5} strokeDasharray="2 12" strokeDashoffset={flow} strokeLinecap="round" />
            ))}
            {!ev && (
              <>
                <path d="M540 262 L160 262" fill="none" stroke="var(--c-hot)" strokeWidth={3} strokeDasharray="2 14" strokeDashoffset={flow * 1.4} strokeLinecap="round" opacity={0.7} />
                {[0, 1, 2].map((i) => {
                  const ph = (t * 0.8 + i / 3) % 1;
                  return <circle key={i} cx={88 - ph * 40} cy={264 - ph * 10} r={3 + ph * 6} fill="var(--c-exhaust)" opacity={0.5 * (1 - ph)} />;
                })}
              </>
            )}
            {(stepBoxes[k] ?? []).map((b, i) =>
              "r" in b ? (
                <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill="none" stroke="var(--c-spark)" strokeWidth={3} opacity={pulse} />
              ) : (
                <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={8} fill="none" stroke="var(--c-spark)" strokeWidth={3} opacity={pulse} />
              ),
            )}
          </g>
        )}

        {/* etiquetas del sistema elegido */}
        {info && <Labels items={layoutLabels(labels, fs)} color={info.color} fs={fs} />}
      </svg>

      <div
        style={{
          marginTop: ".5rem", borderRadius: 10, border: "1px solid var(--border)",
          borderLeft: `4px solid ${info ? info.color : "var(--border-strong)"}`,
          background: "var(--surface)", padding: ".7rem .9rem", fontSize: ".9rem", color: "var(--text-2)",
        }}
      >
        {info ? (
          <>
            <div style={{ fontWeight: 750, color: "var(--text)", fontSize: "1rem", marginBottom: ".3rem" }}>{info.label}</div>
            <p style={{ margin: "0 0 .4rem" }}><b>Qué es.</b> {info.que}</p>
            <p style={{ margin: "0 0 .5rem" }}><b>Para qué sirve.</b> {info.para}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem", marginBottom: ".55rem" }}>
              {piezas.map((p) => (
                <span key={p} style={{ fontSize: ".78rem", padding: ".12rem .5rem", borderRadius: 6, background: "var(--surface-2)", border: "1px solid var(--border)" }}>{p}</span>
              ))}
            </div>
            <div style={{ fontSize: ".85rem" }}>
              <b>En el curso:</b>{" "}
              {info.links.map((l, i) => (
                <span key={l.to + l.label}>{i > 0 && " · "}<Link to={l.to}>{l.label} →</Link></span>
              ))}
            </div>
          </>
        ) : (
          <span>
            👆 <b>Tocá un sistema</b> en el dibujo o en los botones de arriba. Por ahora estás viendo el auto completo: seis sistemas que trabajan juntos y se pasan
            energía, fuerza e información todo el tiempo.
          </span>
        )}
      </div>
    </AnimFrame>
  );
}

/** Motor eléctrico visto de costado: estator fijo y rotor con imanes que gira. */
function EMotor({ cx, cy, r, a, hl }: { cx: number; cy: number; r: number; a: number; hl: boolean }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={r} fill="var(--c-metal-dark)" stroke={hl ? "var(--accent)" : "var(--c-metal-dark)"} strokeWidth={hl ? 3 : 1.5} />
      <circle r={r - 4} fill="var(--c-oil)" opacity={0.55} />
      <g transform={`rotate(${(a * 180) / Math.PI})`}>
        <circle r={r - 8} fill="var(--c-metal-2)" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={-3} y={-(r - 8)} width={6} height={5} fill={i % 2 ? "var(--bad)" : "var(--primary)"} transform={`rotate(${i * 90})`} />
        ))}
      </g>
      <circle r={3} fill="var(--c-metal-light)" />
    </g>
  );
}
