/* ==========================================================================
   MAPA DEL CURSO
   Sigue el orden del Bosch Automotive Handbook (11ª ed.), agrupado para aprender
   de lo básico a lo groso. Cada lección es:
     - "mdx":    archivo src/content/lessons/<parte>/<leccion>.mdx
     - "legacy": lección migrada de ElectroAuto v1 (HTML en legacy/curriculum.json)
     - "page":   una sección especial (por ej. GNC)
     - "soon":   está en el mapa, todavía no escrita
   ========================================================================== */

export type Level = "base" | "taller" | "tecnico" | "experto";

export const LEVELS: Record<Level, { label: string; desc: string }> = {
  base: { label: "Base", desc: "Arrancás de cero" },
  taller: { label: "Taller", desc: "Lo que se usa todos los días" },
  tecnico: { label: "Técnico", desc: "Fórmulas y por qué funciona" },
  experto: { label: "Experto", desc: "Diagnóstico fino y sistemas modernos" },
};

export type LessonSource =
  | { kind: "mdx" }
  | { kind: "legacy"; id: string }
  | { kind: "page"; page: "gnc" }
  | { kind: "soon" };

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  level: Level;
  book?: string;
  tags?: string[];
  quiz?: string;
  source: LessonSource;
}
export interface Chapter { title?: string; lessons: Lesson[] }
export interface Part {
  id: string;
  n: number;
  title: string;
  icon: string;
  desc: string;
  book: string;
  chapters: Chapter[];
}

const mdx = { kind: "mdx" } as const;
const soon = { kind: "soon" } as const;
const S = (id: string, title: string, summary: string, level: Level = "taller", book?: string): Lesson =>
  ({ id, title, summary, minutes: 0, level, book, source: soon });
const legacy = (id: string, title: string, summary: string, minutes: number, level: Level, tags: string[] = []): Lesson =>
  ({ id, title, summary, minutes, level, quiz: `q_${id}`, tags, source: { kind: "legacy", id } });

export const PARTS: Part[] = [
  {
    id: "arranque", n: 0, icon: "🧭", title: "Antes de arrancar",
    desc: "Qué hay adentro de un auto, cómo trabajar seguro, las unidades que vas a usar siempre y qué cambia por vivir en Mendoza.",
    book: "pág. 24–41",
    chapters: [{ lessons: [
      { id: "el-auto-como-sistema", title: "El auto como sistema", summary: "Motor, tren motriz, chasis, carrocería y electrónica: el mapa completo antes de meter mano.", minutes: 12, level: "base", book: "pág. 24–27", quiz: "arranque-sistema", tags: ["sistemas", "partes", "clasificación"], source: mdx },
      { id: "seguridad-taller", title: "Seguridad en el taller", summary: "Crique, caballetes, batería, nafta, alta tensión de encendido y de autos eléctricos. Lo que no se negocia.", minutes: 10, level: "base", quiz: "arranque-seguridad", tags: ["seguridad", "caballetes", "batería"], source: mdx },
      { id: "unidades", title: "Unidades y conversiones", summary: "Newton, Nm, kW vs CV, bar vs psi, cc vs litros. Cómo no mezclar peras con manzanas.", minutes: 12, level: "base", book: "pág. 28–41", quiz: "arranque-unidades", tags: ["unidades", "conversión", "torque", "potencia", "presión"], source: mdx },
      { id: "mendoza", title: "Mecánica en Mendoza", summary: "Altura, calor, zonda, ripio, alta montaña y GNC: cómo afecta todo eso al auto y qué revisar.", minutes: 14, level: "taller", quiz: "arranque-mendoza", tags: ["mendoza", "altura", "montaña", "clima"], source: mdx },
    ]}],
  },
  {
    id: "fisica", n: 1, icon: "⚙️", title: "Física para el taller",
    desc: "Fuerzas, palancas, fluidos, vibraciones, sonido, luz y calor. La base que explica por qué funciona cada pieza del auto.",
    book: "pág. 42–199",
    chapters: [
      { title: "Mecánica", lessons: [
        { id: "fuerzas-palanca", title: "Fuerzas, palancas y la biela", summary: "Por qué una llave larga afloja más fácil y cómo la biela convierte empuje en giro.", minutes: 15, level: "base", book: "pág. 42–46", quiz: "fis-palanca", tags: ["fuerza", "torque", "palanca", "cuña"], source: mdx },
        { id: "resistencia-materiales", title: "Resistencia de materiales", summary: "Tracción, compresión, flexión y torsión. Por qué un tornillo se estira y por qué se rompe.", minutes: 12, level: "tecnico", book: "pág. 47–49", quiz: "fis-resistencia", tags: ["hooke", "tensión", "fluencia"], source: mdx },
        { id: "rozamiento", title: "Rozamiento", summary: "La fuerza que hace frenar al auto y la que desgasta todo. Estático, dinámico y de rodadura.", minutes: 12, level: "base", book: "pág. 49–51", quiz: "fis-rozamiento", tags: ["fricción", "frenos", "cubiertas"], source: mdx },
      ]},
      { title: "Fluidos y vibraciones", lessons: [
        { id: "hidrostatica", title: "Presión y Pascal", summary: "Por qué tu pie puede frenar 1.200 kg: el principio de los frenos hidráulicos.", minutes: 12, level: "base", book: "pág. 52–53", quiz: "fis-hidrostatica", tags: ["presión", "pascal", "frenos"], source: mdx },
        { id: "flujo", title: "Flujo, Bernoulli y Venturi", summary: "Viscosidad, caudal y por qué el aire se acelera en un estrechamiento. Carburador y mariposa.", minutes: 13, level: "tecnico", book: "pág. 53–55", quiz: "fis-flujo", tags: ["bernoulli", "venturi", "viscosidad", "reynolds"], source: mdx },
        { id: "vibraciones", title: "Vibraciones y resonancia", summary: "Resortes, amortiguadores y por qué una pieza puede romperse sola cuando entra en resonancia.", minutes: 13, level: "tecnico", book: "pág. 56–61", quiz: "fis-vibraciones", tags: ["resonancia", "amortiguador", "frecuencia"], source: mdx },
      ]},
      { title: "Sonido, luz y calor", lessons: [
        { id: "acustica", title: "Acústica: escuchar al auto", summary: "Frecuencia, decibeles y cómo diagnosticar por el ruido. Cómo funciona el silenciador.", minutes: 13, level: "taller", book: "pág. 62–69", quiz: "fis-acustica", tags: ["ruido", "decibeles", "silenciador"], source: mdx },
        { id: "optica", title: "Óptica: luces y sensores", summary: "Reflexión, refracción, faros LED y láser, sensor de lluvia y LiDAR.", minutes: 14, level: "taller", book: "pág. 70–81", quiz: "fis-optica", tags: ["luz", "faros", "snell", "lidar"], source: mdx },
        { id: "termodinamica", title: "Termodinámica: calor y presión", summary: "Temperatura, gases, compresión y ciclos. La física que hace andar al motor y lo hace calentar.", minutes: 18, level: "tecnico", book: "pág. 82–97", quiz: "fis-termo", tags: ["calor", "gas ideal", "otto", "rendimiento"], source: mdx },
      ]},
      { title: "Lo que viene", lessons: [
        S("electronica-basica", "Semiconductores: diodo y transistor", "La base de toda ECU y de cada sensor moderno.", "tecnico", "pág. 134–153"),
        S("maquinas-electricas", "Motores y generadores eléctricos", "De la burra de arranque al motor de un eléctrico.", "tecnico", "pág. 154–177"),
        S("quimica", "Química del auto", "Combustión, corrosión y baterías.", "tecnico", "pág. 178–199"),
      ]},
    ],
  },
  {
    id: "electricidad", n: 2, icon: "⚡", title: "Electricidad y electrónica del auto",
    desc: "El curso completo de ElectroAuto: desde la Ley de Ohm hasta redes CAN, scanner y osciloscopio.",
    book: "pág. 98–153 · 1446–1555",
    chapters: [
      { title: "Fundamentos eléctricos", lessons: [
        legacy("i1l1", "Corriente, tensión, resistencia y potencia", "Las cuatro magnitudes que explican el 80% del diagnóstico eléctrico.", 12, "base", ["volt", "ampere", "ohm", "watt"]),
        legacy("i1l2", "Ley de Ohm: la fórmula que más vas a usar", "V = I × R con calculadora interactiva.", 10, "base", ["ohm"]),
        legacy("i1l3", "El circuito eléctrico y la masa", "Positivo, carga y masa. Por qué una masa floja te vuelve loco.", 11, "base", ["masa", "circuito"]),
      ]},
      { title: "Componentes básicos", lessons: [
        legacy("i2l1", "Fusibles", "Qué son, cómo se eligen y cómo se prueban.", 13, "base", ["fusible"]),
        legacy("i2l2", "Relés", "El interruptor que maneja la ECU. Pines 30, 85, 86, 87.", 12, "base", ["relé", "relay"]),
        legacy("i2l3", "La batería", "El corazón del sistema eléctrico: tensiones, carga y pruebas.", 12, "base", ["batería"]),
      ]},
      { title: "Circuitos y mediciones", lessons: [
        legacy("m1l1", "Circuitos en serie y en paralelo", "Cómo se reparte la tensión y la corriente.", 14, "taller", ["serie", "paralelo"]),
        legacy("m1l2", "Diagramas eléctricos", "Cómo leer un plano eléctrico de fábrica.", 15, "taller", ["diagrama"]),
      ]},
      { title: "Carga y arranque", lessons: [
        legacy("m2l1", "Alternador y sistema de carga", "Cómo se recarga la batería y cómo se prueba.", 14, "taller", ["alternador", "carga"]),
        legacy("m2l2", "Motor de arranque (burro)", "Cómo funciona y por qué a veces sólo hace clic.", 12, "taller", ["arranque", "burro"]),
      ]},
      { title: "Electrónica del motor", lessons: [
        legacy("a1l1", "Sensores: los sentidos del motor", "Qué mide cada sensor y cómo verificarlo.", 16, "tecnico", ["sensores"]),
        legacy("a1l2", "Actuadores", "Inyectores, bobinas y motores paso a paso.", 14, "tecnico", ["actuadores"]),
        legacy("a1l3", "Sistema de inyección electrónica", "Visión general del sistema.", 15, "tecnico", ["inyección"]),
      ]},
      { title: "Encendido e iluminación", lessons: [
        legacy("a2l1", "Sistema de encendido", "Bobinas, bujías y señales.", 13, "tecnico", ["encendido"]),
        legacy("a2l2", "Sistema de iluminación", "Circuitos de luces y fallas típicas.", 12, "taller", ["luces"]),
      ]},
      { title: "Redes y diagnóstico", lessons: [
        legacy("p1l1", "ECU: la computadora del auto", "Qué hay adentro y cómo trabaja.", 13, "experto", ["ecu"]),
        legacy("p1l2", "Redes CAN", "Cómo se hablan los módulos entre sí.", 16, "experto", ["can", "red"]),
        legacy("p1l3", "Diagnóstico con scanner", "Códigos, datos en vivo y pruebas de actuadores.", 14, "experto", ["scanner", "obd"]),
      ]},
      { title: "Osciloscopio y estrategia", lessons: [
        legacy("p2l1", "Osciloscopio automotriz", "Ver la señal en vez de adivinarla.", 15, "experto", ["osciloscopio"]),
        legacy("p2l2", "Estrategia de diagnóstico profesional", "Un método para no cambiar piezas a ciegas.", 14, "experto", ["diagnóstico"]),
      ]},
    ],
  },
  {
    id: "materiales", n: 3, icon: "🔩", title: "Materiales y piezas de máquinas",
    desc: "Aceros, fundición, aluminio, plásticos, tratamientos térmicos, rodamientos, cojinetes y retenes.",
    book: "pág. 254–421",
    chapters: [{ lessons: [
      S("materiales", "Aceros, fundición, aluminio y plásticos", "Qué material va en cada pieza y por qué.", "tecnico", "pág. 254–323"),
      S("tratamientos", "Tratamientos térmicos", "Templado, revenido, nitrurado: cómo se endurece una pieza.", "tecnico", "pág. 324–343"),
      S("rodamientos", "Rodamientos y cojinetes", "Rulemanes y metales de bancada: cómo trabajan y por qué fallan.", "taller", "pág. 366–379"),
      S("retenes", "Juntas y retenes", "Por qué pierde aceite un motor.", "taller", "pág. 380–421"),
    ]}],
  },
  {
    id: "uniones", n: 4, icon: "🔧", title: "Tornillos, torque y uniones",
    desc: "Roscas, torque de apriete, tornillos de estiramiento, soldaduras y pegado.",
    book: "pág. 422–457",
    chapters: [{ lessons: [
      S("roscas-torque", "Roscas y torque de apriete", "Por qué cada tornillo tiene su torque y su orden.", "taller", "pág. 422–445"),
      S("tornillos-estiramiento", "Tornillos de estiramiento (TTY)", "Los que no se reutilizan: tapa de cilindros y bielas.", "taller"),
      S("uniones-permanentes", "Soldadura, remaches y pegado", "Cómo se une una carrocería moderna.", "tecnico", "pág. 446–457"),
    ]}],
  },
  {
    id: "vehiculo", n: 5, icon: "🏎️", title: "Física del vehículo",
    desc: "Resistencia al avance, tracción, frenado, curvas, aerodinámica y ruido del vehículo.",
    book: "pág. 458–533",
    chapters: [{ lessons: [
      S("resistencias-avance", "Resistencias al avance", "Rodadura, aire y pendiente: contra qué pelea el motor.", "tecnico", "pág. 460–465"),
      S("dinamica", "Dinámica: frenar, acelerar y doblar", "Transferencia de peso, adherencia y subviraje.", "tecnico", "pág. 466–501"),
      S("consumo", "Energía y consumo", "Por qué gasta lo que gasta.", "tecnico", "pág. 502–511"),
      S("aerodinamica", "Aerodinámica", "Cx, área frontal y velocidad.", "tecnico", "pág. 512–525"),
    ]}],
  },
  {
    id: "fluidos-operacion", n: 6, icon: "🛢️", title: "Aceites, combustibles y fluidos",
    desc: "Aceite de motor, refrigerante, líquido de frenos, nafta, gasoil, AdBlue y gas de aire acondicionado.",
    book: "pág. 534–589",
    chapters: [{ lessons: [
      S("aceites", "Aceites y lubricantes", "SAE, API, ACEA: cómo elegir y cuándo cambiar.", "taller", "pág. 534–548"),
      S("refrigerantes", "Refrigerante", "Por qué no se le pone agua de la canilla.", "taller", "pág. 549–551"),
      S("liquido-frenos", "Líquido de frenos", "DOT 3, 4, 5.1 y por qué absorbe humedad.", "taller", "pág. 552–555"),
      S("combustibles", "Nafta y gasoil", "Octanaje, cetano y calidad de combustible.", "taller", "pág. 556–585"),
    ]}],
  },
  {
    id: "transmision", n: 7, icon: "🔄", title: "Tren motriz",
    desc: "Embrague, volante bimasa, caja manual y automática, diferencial y semiejes.",
    book: "pág. 590–637",
    chapters: [{ lessons: [
      S("embrague", "Embrague y volante bimasa", "Cómo se conecta el motor a la caja.", "taller", "pág. 596–603"),
      S("caja-cambios", "Caja de cambios", "Relaciones, sincronizados y cajas automáticas.", "taller", "pág. 604–621"),
      S("diferencial", "Diferencial", "Por qué las ruedas pueden girar distinto en una curva.", "taller", "pág. 622–625"),
      S("caja-electronica", "Control electrónico de la caja", "Solenoides, presiones y adaptaciones.", "experto", "pág. 626–637"),
    ]}],
  },
  {
    id: "motor", n: 8, icon: "🔥", title: "Motor de combustión interna",
    desc: "El corazón del auto: 4 tiempos, pistón-biela-cigüeñal, distribución, refrigeración, lubricación, admisión, turbo y escape.",
    book: "pág. 638–795",
    chapters: [
      { title: "Cómo funciona", lessons: [
        { id: "cuatro-tiempos", title: "El motor de 4 tiempos", summary: "Admisión, compresión, explosión y escape, con el diagrama p-V en vivo. Cilindrada y relación de compresión.", minutes: 22, level: "base", book: "pág. 638–671", quiz: "motor-4t", tags: ["otto", "4 tiempos", "compresión", "cilindrada"], source: mdx },
        { id: "tren-alternativo", title: "Pistón, biela y cigüeñal", summary: "Las piezas que transforman la explosión en giro: aros, bulón, metales, contrapesos. Torque y potencia.", minutes: 22, level: "taller", book: "pág. 672–711", quiz: "motor-tren", tags: ["pistón", "biela", "cigüeñal", "aros", "metales", "torque"], source: mdx },
        { id: "distribucion", title: "Distribución: levas, correa y válvulas", summary: "Puesta a punto, cruce de válvulas, correa vs cadena y distribución variable.", minutes: 22, level: "taller", book: "pág. 690–711 · 716–731", quiz: "motor-distribucion", tags: ["distribución", "correa", "árbol de levas", "válvulas", "vvt"], source: mdx },
      ]},
      { title: "Sistemas auxiliares", lessons: [
        { id: "refrigeracion-lubricacion", title: "Refrigeración y lubricación", summary: "Termostato, radiador, bomba, presión de aceite. Por qué se funde un motor y cómo evitarlo.", minutes: 22, level: "taller", book: "pág. 732–749", quiz: "motor-refri", tags: ["refrigeración", "termostato", "aceite", "radiador"], source: mdx },
        { id: "admision-turbo-escape", title: "Admisión, turbo y escape", summary: "Cómo respira el motor. El turbo, la válvula de alivio, el intercooler y el catalizador.", minutes: 22, level: "tecnico", book: "pág. 750–795", quiz: "motor-turbo", tags: ["turbo", "admisión", "escape", "catalizador", "wastegate"], source: mdx },
      ]},
    ],
  },
  {
    id: "gestion-nafta", n: 9, icon: "🧠", title: "Inyección y encendido (nafta)",
    desc: "La ECU, sus sensores y actuadores: cómo decide cuánta nafta inyectar y cuándo saltar la chispa.",
    book: "pág. 796–881",
    chapters: [{ lessons: [
      { id: "sensores-motor", title: "Sensores del motor", summary: "CKP, CMP, MAP, MAF, TPS, ECT, IAT, lambda y detonación: qué miden, cómo es la señal y cómo se prueban.", minutes: 25, level: "tecnico", book: "pág. 796–815 · 1712–1775", quiz: "gn-sensores", tags: ["ckp", "map", "maf", "tps", "lambda", "sensores"], source: mdx },
      { id: "inyeccion", title: "Inyección de nafta", summary: "Bomba, presión, inyectores, ancho de pulso y correcciones de mezcla. Multipunto e inyección directa.", minutes: 24, level: "tecnico", book: "pág. 816–849", quiz: "gn-inyeccion", tags: ["inyector", "mezcla", "lambda", "trims", "presión"], source: mdx },
      { id: "encendido", title: "Encendido", summary: "Bobina, tiempo de carga, chispa, avance y detonación. Bujías y cómo leerlas.", minutes: 22, level: "tecnico", book: "pág. 850–869", quiz: "gn-encendido", tags: ["bobina", "bujía", "avance", "detonación"], source: mdx },
      { id: "ecu-estrategia", title: "Cómo piensa la ECU", summary: "Lazo abierto y cerrado, mapas, correcciones, modo de emergencia y qué pasa cuando un sensor miente.", minutes: 20, level: "experto", book: "pág. 796–807 · 870–877", quiz: "gn-ecu", tags: ["ecu", "mapas", "lazo cerrado", "trims", "emergencia"], source: mdx },
    ]}],
  },
  {
    id: "gnc", n: 10, icon: "⛽", title: "GNC y combustibles alternativos",
    desc: "GNC de 5ª generación (caso real: Logan 2008), GLP y alcohol.",
    book: "pág. 882–901",
    chapters: [{ lessons: [
      { id: "gnc-5ta", title: "GNC 5ª generación — Logan 2008", summary: "Componentes, cableado, cómo leerlo, fallas típicas y seguridad.", minutes: 25, level: "taller", tags: ["gnc", "reductor", "logan"], source: { kind: "page", page: "gnc" } },
      S("glp", "GLP y alcohol", "Otros combustibles alternativos.", "tecnico", "pág. 882–901"),
    ]}],
  },
  {
    id: "diesel", n: 11, icon: "🛻", title: "Motor diesel y common rail",
    desc: "Common rail, bomba de alta, inyectores, bujías de precalentamiento, DPF y AdBlue.",
    book: "pág. 902–965",
    chapters: [{ lessons: [
      S("diesel-principio", "Cómo funciona el diesel", "Encendido por compresión: sin bujías.", "taller", "pág. 902–911"),
      S("common-rail", "Common rail", "1.600–2.500 bar: bomba, riel e inyectores.", "tecnico", "pág. 920–939"),
      S("precalentamiento", "Precalentamiento", "Bujías de precalentamiento y arranque en frío.", "taller", "pág. 950–957"),
      S("dpf-scr", "DPF, EGR y AdBlue", "El postratamiento de gases del diesel.", "experto", "pág. 958–965"),
    ]}],
  },
  {
    id: "electrificacion", n: 12, icon: "🔋", title: "Híbridos y eléctricos",
    desc: "Motores eléctricos, inversores, baterías de alta tensión, carga y seguridad en alta tensión.",
    book: "pág. 966–1037 · 1556–1615",
    chapters: [{ lessons: [
      S("electrificacion", "Tipos de electrificación", "Mild hybrid, full hybrid, enchufable y 100% eléctrico.", "taller", "pág. 966–979"),
      S("motor-electrico", "El motor eléctrico de tracción", "Síncrono de imanes, asincrónico y cómo se controlan.", "tecnico", "pág. 1562–1577"),
      S("inversor", "Inversor y DC-DC", "Cómo la corriente continua de la batería mueve un motor trifásico.", "experto", "pág. 1578–1595"),
      S("bateria-at", "Batería de alta tensión", "Celdas, BMS, degradación y temperatura.", "experto", "pág. 1602–1615"),
      S("seguridad-at", "Trabajar seguro en alta tensión", "Cables naranjas, desconexión y EPP.", "taller"),
    ]}],
  },
  {
    id: "emisiones", n: 13, icon: "🌫️", title: "Emisiones y diagnóstico OBD",
    desc: "Normas de emisiones, medición de gases y diagnóstico de a bordo.",
    book: "pág. 1038–1103",
    chapters: [{ lessons: [
      S("gases", "Qué sale por el escape", "CO, HC, NOx, CO₂ y O₂: qué indica cada uno.", "tecnico", "pág. 1038–1085"),
      S("obd", "OBD-II y códigos de falla", "Cómo se genera un código y qué significa.", "taller", "pág. 1086–1103"),
    ]}],
  },
  {
    id: "chasis", n: 14, icon: "🛞", title: "Suspensión, dirección, ruedas y frenos",
    desc: "Resortes, amortiguadores, geometría, cubiertas, dirección asistida y frenos.",
    book: "pág. 1104–1255",
    chapters: [{ lessons: [
      S("suspension", "Suspensión y amortiguadores", "Cómo se mantiene la rueda pegada al piso.", "taller", "pág. 1120–1149"),
      S("alineacion", "Alineación: convergencia, camber y caster", "Por qué se comen las cubiertas.", "taller"),
      S("cubiertas", "Ruedas y cubiertas", "Cómo leer 185/65 R15 88H y cuándo cambiarlas.", "base", "pág. 1150–1187"),
      S("direccion", "Dirección", "Hidráulica, electrohidráulica y eléctrica.", "taller", "pág. 1188–1201"),
      S("frenos", "Frenos", "Del pedal a la pastilla: bomba, servo, discos y tambores.", "taller", "pág. 1202–1255"),
    ]}],
  },
  {
    id: "control-chasis", n: 15, icon: "🛡️", title: "ABS, ESP y control de tracción",
    desc: "Los sistemas que evitan que se bloqueen las ruedas o que el auto se cruce.",
    book: "pág. 1256–1305",
    chapters: [{ lessons: [
      S("abs", "ABS", "Cómo frena sin bloquear.", "tecnico", "pág. 1256–1267"),
      S("esp", "ESP y control de tracción", "Cómo corrige un derrape antes de que te des cuenta.", "experto", "pág. 1268–1291"),
    ]}],
  },
  {
    id: "carroceria", n: 16, icon: "🚙", title: "Carrocería, luces, confort y seguridad",
    desc: "Estructura, iluminación, aire acondicionado, airbags, cierre centralizado y alarmas.",
    book: "pág. 1306–1445",
    chapters: [{ lessons: [
      S("carroceria", "Carrocería y deformación programada", "Por qué un auto moderno se arruga a propósito.", "taller", "pág. 1306–1329"),
      S("iluminacion", "Iluminación del vehículo", "Faros, regulación y luces adaptativas.", "taller", "pág. 1330–1369"),
      S("aire-acondicionado", "Aire acondicionado y climatización", "Compresor, gas y por qué deja de enfriar.", "taller", "pág. 1388–1399"),
      S("airbags", "Airbags y pretensores", "Cómo y cuándo se disparan.", "experto", "pág. 1412–1425"),
      S("cierre-alarma", "Cierre centralizado e inmovilizador", "Por qué el auto no arranca con otra llave.", "tecnico", "pág. 1426–1445"),
    ]}],
  },
  {
    id: "electrica-vehiculo", n: 17, icon: "🔌", title: "Sistema eléctrico del vehículo",
    desc: "Red de 12 V, batería, alternador, arranque, mazos de cables y compatibilidad electromagnética.",
    book: "pág. 1446–1555",
    chapters: [{ lessons: [
      S("red-12v", "La red de 12 V", "Cómo se distribuye la energía en el auto.", "taller", "pág. 1446–1461"),
      S("bateria-avanzado", "Baterías de arranque: AGM, EFB y gestión", "Por qué un auto con start-stop pide batería especial.", "tecnico", "pág. 1472–1485"),
      S("mazos", "Mazos y conectores", "Cómo reparar un cable sin crear un problema nuevo.", "taller", "pág. 1514–1519"),
      S("esquemas", "Símbolos y esquemas", "El idioma de los planos eléctricos.", "taller", "pág. 1534–1555"),
    ]}],
  },
  {
    id: "electronica-auto", n: 18, icon: "📡", title: "ECUs, redes y sensores",
    desc: "Hardware y software de las ECUs, arquitectura electrónica, CAN, LIN, FlexRay, Ethernet y sensores.",
    book: "pág. 1616–1775",
    chapters: [{ lessons: [
      S("ecu-hardware", "Adentro de una ECU", "Microcontrolador, memorias, drivers y alimentación.", "experto", "pág. 1616–1635"),
      S("software", "Software automotriz", "Cómo se programa y se calibra un auto.", "experto", "pág. 1642–1661"),
      S("buses", "CAN, LIN, FlexRay y Ethernet", "Las redes del auto en detalle.", "experto", "pág. 1678–1711"),
      S("sensores-avanzado", "Sensores en profundidad", "Principios físicos de cada sensor.", "experto", "pág. 1712–1775"),
    ]}],
  },
  {
    id: "adas", n: 19, icon: "🤖", title: "Asistencia al conductor y autónomos",
    desc: "Ultrasonido, radar, LiDAR, cámaras, frenado de emergencia, crucero adaptativo y el futuro autónomo.",
    book: "pág. 1776–1935",
    chapters: [{ lessons: [
      S("sensores-adas", "Ultrasonido, radar, LiDAR y cámara", "Cómo ve el auto.", "tecnico", "pág. 1800–1867"),
      S("acc-aeb", "Crucero adaptativo y frenado de emergencia", "Los sistemas que frenan por vos.", "tecnico", "pág. 1886–1919"),
      S("carril", "Asistente de carril", "Cámara + dirección eléctrica.", "tecnico", "pág. 1902–1911"),
      S("autonomo", "Conducción autónoma", "Los niveles 0 a 5 y lo que falta.", "experto", "pág. 1930–1935"),
    ]}],
  },
];

/* ------------------------------------------------------------- helpers */
export interface FlatLesson extends Lesson { part: Part; chapter?: string; path: string; index: number }

export const ALL_LESSONS: FlatLesson[] = (() => {
  const out: FlatLesson[] = [];
  for (const part of PARTS)
    for (const ch of part.chapters)
      for (const l of ch.lessons)
        out.push({ ...l, part, chapter: ch.title, path: `/aprender/${part.id}/${l.id}`, index: out.length });
  return out;
})();

export const READY_LESSONS = ALL_LESSONS.filter((l) => l.source.kind !== "soon");

export function findPart(id?: string) { return PARTS.find((p) => p.id === id); }
export function findLesson(partId?: string, lessonId?: string) {
  return ALL_LESSONS.find((l) => l.part.id === partId && l.id === lessonId);
}
export function partLessons(part: Part) { return ALL_LESSONS.filter((l) => l.part.id === part.id); }
export function isReady(l: Lesson) { return l.source.kind !== "soon"; }
export function neighbors(l: FlatLesson) {
  const i = READY_LESSONS.findIndex((x) => x.path === l.path);
  return { prev: i > 0 ? READY_LESSONS[i - 1] : undefined, next: i >= 0 && i < READY_LESSONS.length - 1 ? READY_LESSONS[i + 1] : undefined };
}
export function partStatus(part: Part, done: Record<string, boolean>) {
  const all = partLessons(part);
  const ready = all.filter(isReady);
  const completed = ready.filter((l) => done[l.source.kind === "legacy" ? l.source.id : `${part.id}/${l.id}`]).length;
  return { total: all.length, ready: ready.length, completed };
}
/** Clave con la que se guarda una lección completada (las legacy conservan su id original). */
export function lessonKey(l: FlatLesson | (Lesson & { part: Part })) {
  return l.source.kind === "legacy" ? l.source.id : `${l.part.id}/${l.id}`;
}
