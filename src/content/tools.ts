/* ==========================================================================
   CATÁLOGO DE HERRAMIENTAS
   Las lecciones las enlazan con <Herramientas ids={["tester", "compresometro"]} />.
   Prioridad: "1" = comprala primero · "2" = cuando ya trabajás seguido · "3" = nivel pro
   ========================================================================== */
import legacyLib from "./legacy/library.json";

export type ToolCat = "electrica" | "diagnostico" | "motor" | "precision" | "fluidos" | "elevacion" | "mano";

export const TOOL_CATS: Record<ToolCat, { label: string; icon: string }> = {
  electrica: { label: "Medición eléctrica", icon: "⚡" },
  diagnostico: { label: "Diagnóstico electrónico", icon: "🧠" },
  motor: { label: "Pruebas de motor", icon: "🔥" },
  precision: { label: "Medición de precisión", icon: "📏" },
  fluidos: { label: "Fluidos y presión", icon: "💧" },
  elevacion: { label: "Elevación y seguridad", icon: "🛡️" },
  mano: { label: "Herramienta de mano", icon: "🔧" },
};

export interface Tool {
  id: string;
  nombre: string;
  icon: string;
  cat: ToolCat;
  prioridad: 1 | 2 | 3;
  uso: string;
  tips: string[];
  /** qué mirar al comprarla */
  comprar?: string;
  cuidado?: string;
}

const legacyTips = (name: string) =>
  (legacyLib.herramientas as { nombre: string; tips: string[] }[]).find((h) => h.nombre.startsWith(name))?.tips ?? [];

export const TOOLS: Tool[] = [
  /* ------------------------------------------------ medición eléctrica */
  {
    id: "tester", nombre: "Multímetro (tester)", icon: "🔢", cat: "electrica", prioridad: 1,
    uso: "La herramienta número uno. Mide tensión, resistencia, continuidad y, según el modelo, corriente, frecuencia, ciclo de trabajo y temperatura.",
    tips: legacyTips("Multímetro"),
    comprar: "Que sea autorrango, con impedancia de entrada de 10 MΩ (para no cargar las señales de la ECU), categoría CAT III y buenas puntas. Si mide frecuencia y % de ciclo de trabajo, mejor.",
  },
  {
    id: "pinza-amperometrica", nombre: "Pinza amperométrica", icon: "🪝", cat: "electrica", prioridad: 2,
    uso: "Mide corriente sin cortar el cable: abraza el conductor. Ideal para consumo de arranque, carga del alternador y consumos parásitos con el auto apagado.",
    tips: legacyTips("Pinza"),
    comprar: "Para autos tiene que medir corriente CONTINUA (DC). Muchas pinzas baratas sólo miden alterna y no sirven. Ideal: que tenga rango de mA para fugas.",
  },
  {
    id: "lampara-prueba", nombre: "Lámpara de prueba", icon: "💡", cat: "electrica", prioridad: 1,
    uso: "Una lámpara con punta y cocodrilo. Muestra si hay tensión y, sobre todo, si el circuito AGUANTA carga (el tester puede marcar 12 V en un cable sulfatado; la lámpara no prende).",
    tips: legacyTips("Lámpara"),
    cuidado: "No la uses en cables de señal de sensores o de la ECU: consume corriente y puede dañar una salida electrónica. Para eso está el LED de prueba o el tester.",
  },
  {
    id: "noid", nombre: "Noid light (luz de inyector)", icon: "🔦", cat: "electrica", prioridad: 2,
    uso: "Lamparita que se enchufa en el conector del inyector. Si parpadea mientras das arranque, la ECU está mandando el pulso de inyección.",
    tips: ["Viene en juegos con distintos conectores; fijate que tenga los de los autos que más atendés.", "Confirma que hay pulso, no cuánto dura. Para el ancho de pulso, osciloscopio o scanner."],
  },
  {
    id: "fuente", nombre: "Fuente de alimentación regulada", icon: "🔋", cat: "electrica", prioridad: 3,
    uso: "Entrega tensión estable y regulable. Para probar componentes en banco y sostener la batería mientras programás una ECU.",
    tips: legacyTips("Fuente"),
  },
  {
    id: "probador-bateria", nombre: "Analizador de baterías", icon: "🔋", cat: "electrica", prioridad: 2,
    uso: "Mide la capacidad real de arranque (CCA) y el estado de salud de la batería. El tester sólo te dice la tensión; esto te dice si aguanta.",
    tips: ["Cargá la batería antes de testear: con poca carga cualquier batería da mal.", "Ingresá bien el CCA de la etiqueta y el tipo (convencional, EFB, AGM)."],
  },
  /* --------------------------------------------- diagnóstico electrónico */
  {
    id: "scanner", nombre: "Scanner OBD2", icon: "💻", cat: "diagnostico", prioridad: 1,
    uso: "Lee y borra códigos de falla (DTC), muestra datos en vivo, cuadro congelado y permite activar actuadores. Es la ventana a lo que la ECU está 'pensando'.",
    tips: legacyTips("Scanner"),
    comprar: "Un adaptador ELM327 + app sirve para empezar (códigos y datos en vivo genéricos). Un scanner profesional suma marcas, pruebas de actuadores, adaptaciones y codificaciones. Elegí uno que tenga buena cobertura de las marcas que se ven en la zona: VW, Renault, Fiat, Chevrolet, Peugeot/Citroën, Toyota, Ford.",
  },
  {
    id: "osciloscopio", nombre: "Osciloscopio automotriz", icon: "📈", cat: "diagnostico", prioridad: 2,
    uso: "Muestra la señal en el tiempo. Imprescindible para CKP/CMP, inyectores, encendido, sonda lambda y redes CAN. El tester te da un promedio; el osciloscopio te muestra la forma.",
    tips: legacyTips("Osciloscopio"),
    comprar: "Para empezar alcanza uno de 2 a 4 canales conectado a la PC. Que traiga puntas atenuadoras (x10/x20) y pinza de corriente. Para secundario de encendido necesitás pinza capacitiva.",
  },
  {
    id: "pinza-capacitiva", nombre: "Pinza capacitiva de encendido", icon: "⚡", cat: "diagnostico", prioridad: 3,
    uso: "Se coloca sobre el cable de bujía o cerca de la bobina para ver el secundario (los miles de volts de la chispa) en el osciloscopio sin contacto.",
    tips: ["Nunca conectes el osciloscopio directo al secundario: son 20.000 a 40.000 V.", "En bobinas COP (una por bujía) se usan sondas de proximidad tipo 'paleta'."],
  },
  /* ----------------------------------------------------- pruebas de motor */
  {
    id: "compresometro", nombre: "Compresómetro", icon: "🎚️", cat: "motor", prioridad: 1,
    uso: "Mide la presión máxima que levanta cada cilindro dando arranque. Te dice si los aros, las válvulas y la junta de tapa sellan bien.",
    tips: [
      "Motor caliente, todas las bujías afuera, mariposa abierta a fondo y batería bien cargada.",
      "Dejá que dé 4 a 6 compresiones por cilindro y anotá el valor máximo.",
      "Más importante que el número absoluto es la diferencia entre cilindros: más de 10–15 % ya es para preocuparse.",
      "Prueba húmeda: si un cilindro da bajo, echale una cucharadita de aceite y volvé a medir. Si sube mucho, son los aros; si no cambia, son válvulas o junta.",
    ],
    comprar: "Que traiga adaptadores de rosca para bujía M14 y M12 (y de precalentamiento si vas a medir diesel: ahí se necesita uno de alta presión, hasta 40–70 bar).",
  },
  {
    id: "fugometro", nombre: "Probador de pérdidas (leak-down)", icon: "🫧", cat: "motor", prioridad: 2,
    uso: "Mete aire a presión en el cilindro con el pistón en PMS de compresión y mide qué porcentaje se escapa. Además, escuchando dónde sale el aire sabés qué falla.",
    tips: [
      "Aire por el escape → válvula de escape. Por la admisión/cuerpo de mariposa → válvula de admisión. Por la varilla o tapa de aceite → aros. Burbujas en el radiador → junta de tapa o fisura.",
      "Trabá el cigüeñal: con presión, el pistón empuja y el motor puede girar de golpe.",
    ],
  },
  {
    id: "vacuometro", nombre: "Vacuómetro", icon: "🌀", cat: "motor", prioridad: 2,
    uso: "Mide el vacío en el múltiple de admisión. Con la aguja (o un MAP en el scanner) se diagnostican válvulas, aros, escape tapado y pérdidas de vacío.",
    tips: ["En ralentí un motor sano a nivel del mar marca unos 17–21 inHg (≈ 0,57–0,71 bar de vacío). En Mendoza, por la altura, leé un poco menos.", "Aguja que oscila regular: válvula quemada o con mal asiento. Vacío que cae al acelerar sostenido: escape tapado (catalizador)."],
  },
  {
    id: "probador-chispa", nombre: "Probador de chispa regulable", icon: "✨", cat: "motor", prioridad: 1,
    uso: "Se conecta en lugar de la bujía y te deja ver si la bobina tiene fuerza para saltar una distancia determinada. Más confiable que 'apoyar la bujía en el block'.",
    tips: ["Regulalo a 15–20 kV aprox. (separación grande): una bobina débil salta con la bujía en la mano pero no con compresión.", "Desconectá el inyector de ese cilindro para no lavar el cilindro con nafta."],
  },
  {
    id: "estetoscopio", nombre: "Estetoscopio mecánico", icon: "🩺", cat: "motor", prioridad: 1,
    uso: "Escuchar ruidos internos: botadores, rulemanes, inyectores, bomba de agua, tensores. Barato y te ahorra horas.",
    tips: ["Comparás el mismo punto en distintos cilindros o componentes: el que suena distinto es el sospechoso.", "Cuidado con correas y ventilador: siempre la manguera lejos de lo que gira."],
  },
  {
    id: "kit-distribucion", nombre: "Kit de puesta a punto (trabas)", icon: "📌", cat: "motor", prioridad: 2,
    uso: "Trabas específicas por motor para fijar cigüeñal y árboles de levas en posición al cambiar correa o cadena de distribución.",
    tips: ["Cada motor tiene su kit: no improvises con un destornillador.", "Después de tensar, girá el motor dos vueltas completas A MANO y verificá que las trabas vuelvan a entrar."],
  },
  {
    id: "probador-co2", nombre: "Probador de CO₂ en refrigerante (block test)", icon: "🧪", cat: "motor", prioridad: 2,
    uso: "Un líquido que cambia de color si hay gases de combustión en el refrigerante. Confirma una junta de tapa quemada o una fisura.",
    tips: ["Azul → verde/amarillo = hay gases de combustión. Hacelo con el motor caliente y acelerando un poco."],
  },
  /* -------------------------------------------------- medición de precisión */
  {
    id: "calibre", nombre: "Calibre (pie de rey)", icon: "📏", cat: "precision", prioridad: 1,
    uso: "Mide diámetros externos, internos y profundidades con resolución de 0,05 a 0,02 mm. Pistones, discos, bulones, resortes.",
    tips: ["Limpiá las mandíbulas y verificá el cero antes de medir.", "Para mediciones de motor finas (muñones, cilindros) se usa micrómetro y alesómetro."],
  },
  {
    id: "micrometro", nombre: "Micrómetro", icon: "🔬", cat: "precision", prioridad: 3,
    uso: "Mide con 0,01 mm (o 0,001 mm) de resolución. Muñones de cigüeñal, pistones, árboles de levas.",
    tips: ["Usá la matraca del micrómetro para apretar siempre con la misma fuerza.", "Medí en dos ejes a 90° para detectar ovalización y en dos alturas para conicidad."],
  },
  {
    id: "alesometro", nombre: "Alesómetro (comparador de interiores)", icon: "🎯", cat: "precision", prioridad: 3,
    uso: "Mide el diámetro interno de los cilindros y su desgaste: ovalización y conicidad.",
    tips: ["Se calibra con el micrómetro al diámetro nominal y se lee la diferencia.", "Medí arriba (donde frena el aro de fuego), al medio y abajo, en dos direcciones."],
  },
  {
    id: "galgas", nombre: "Galgas de espesores (sondas)", icon: "📐", cat: "precision", prioridad: 1,
    uso: "Láminas calibradas para medir luces: válvulas, luz entre puntas de aros, planitud de tapa con regla.",
    tips: ["La galga tiene que pasar 'con roce suave'. Si entra floja, probá con la siguiente."],
  },
  {
    id: "plastigage", nombre: "Plastigage", icon: "🧵", cat: "precision", prioridad: 2,
    uso: "Hilo plástico calibrado que se aplasta entre el metal y el muñón. Al desarmar, el ancho del hilo aplastado te da la luz de aceite del cojinete.",
    tips: ["Sin aceite, torque final de fábrica y SIN girar el cigüeñal con el hilo puesto."],
  },
  {
    id: "torquimetro", nombre: "Llave torquimétrica", icon: "🔧", cat: "mano", prioridad: 1,
    uso: "Aprieta con el torque exacto. Obligatoria en ruedas, tapa de cilindros, bielas, bancada, bujías y cualquier tornillo de aluminio.",
    tips: ["Guardala siempre en la posición mínima para no cansar el resorte.", "Muchos tornillos se aprietan por torque + ángulo: para eso hay un goniómetro (transportador)."],
    comprar: "Para empezar, una de 1/2\" de 40–210 Nm cubre ruedas y casi todo el motor. Para bujías y tornillos chicos, una de 3/8\" o 1/4\" de rango bajo.",
  },
  /* ---------------------------------------------------- fluidos y presión */
  {
    id: "manometro-nafta", nombre: "Manómetro de presión de combustible", icon: "⛽", cat: "fluidos", prioridad: 2,
    uso: "Se conecta a la válvula del riel de inyectores o en línea. Mide la presión de nafta en contacto, en ralentí y al acelerar, y si la retiene al apagar.",
    tips: ["Típico multipunto: 3 a 4 bar. Inyección directa: la baja anda en 4–6 bar y la alta (100–350 bar) se lee por scanner, NO con manómetro.", "Envolvé la conexión con un trapo: la nafta a presión salpica."],
  },
  {
    id: "bomba-presion-refri", nombre: "Probador de presión del sistema de refrigeración", icon: "🌡️", cat: "fluidos", prioridad: 2,
    uso: "Una bombita con adaptadores para la tapa del radiador o del depósito. Presuriza el sistema en frío para encontrar pérdidas y prueba la tapa.",
    tips: ["Nunca abras la tapa con el motor caliente.", "Llevalo a la presión que dice la tapa (suele ser 1,0–1,5 bar) y que aguante unos 10–15 minutos sin bajar."],
  },
  {
    id: "refractometro", nombre: "Refractómetro / densímetro", icon: "🔭", cat: "fluidos", prioridad: 3,
    uso: "Mide la concentración de anticongelante (punto de congelamiento) y, según el modelo, el AdBlue y el electrolito de baterías.",
    tips: ["En Alta Montaña en invierno, el refrigerante tiene que proteger bien bajo cero: no lo diluyas con agua."],
  },
  {
    id: "probador-liquido-frenos", nombre: "Probador de líquido de frenos", icon: "🛑", cat: "fluidos", prioridad: 2,
    uso: "Mide el porcentaje de agua absorbida por el líquido de frenos. Con más de 2–3 % de agua, conviene cambiarlo.",
    tips: ["El líquido viejo hierve antes: bajando la cordillera con frenos calientes, eso es pedal largo o sin freno."],
  },
  /* ------------------------------------------------- elevación y seguridad */
  {
    id: "caballetes", nombre: "Criquet carrito y caballetes", icon: "🛡️", cat: "elevacion", prioridad: 1,
    uso: "El crique levanta; los caballetes SOSTIENEN. Nunca te metas abajo de un auto que sólo está en el crique.",
    tips: ["Apoyá siempre en los puntos de levante de fábrica.", "Calzá las ruedas que quedan en el piso y poné freno de mano/cambio."],
  },
  {
    id: "epp", nombre: "Elementos de protección personal", icon: "🥽", cat: "elevacion", prioridad: 1,
    uso: "Anteojos, guantes de nitrilo, guantes anticorte, protección auditiva. Para autos eléctricos e híbridos: guantes dieléctricos clase 0 y herramienta aislada 1000 V.",
    tips: ["El líquido de frenos y el ácido de batería en los ojos no perdonan.", "En alta tensión (híbridos/eléctricos) no se trabaja sin capacitación específica."],
  },
  {
    id: "juego-llaves", nombre: "Juego de tubos, llaves y destornilladores", icon: "🧰", cat: "mano", prioridad: 1,
    uso: "Lo básico: tubos de 1/4\", 3/8\" y 1/2\" con criques, llaves combinadas, Torx, Allen y destornilladores.",
    tips: ["Tubos de 6 caras (no de 12) para tornillos duros: no redondean.", "Sumá Torx y Torx E: los autos europeos están llenos."],
  },
  {
    id: "extractor-bujias", nombre: "Tubo de bujías", icon: "🕯️", cat: "mano", prioridad: 1,
    uso: "Tubo largo con goma interna que sostiene la bujía. Medidas típicas: 16 mm y 21 mm (5/8\" y 13/16\").",
    tips: ["Sacá bujías con el motor frío, sobre todo en tapas de aluminio.", "Antes de sacarla, soplá el pozo de la bujía: la tierra (y en Mendoza hay mucha) se cae al cilindro."],
  },
  {
    id: "manometro-aceite", nombre: "Manómetro de presión de aceite", icon: "🛢️", cat: "fluidos", prioridad: 2,
    uso: "Se rosca en lugar del presostato (bulbo) de aceite para medir la presión real. El testigo del tablero sólo te avisa cuando ya es tarde.",
    tips: ["Medí con el aceite caliente (más de 80 °C): en frío cualquier motor da buena presión.", "Anotá ralentí y 2.000–3.000 rpm y comparalo con el dato de fábrica."],
  },
  {
    id: "termometro-ir", nombre: "Termómetro infrarrojo", icon: "🌡️", cat: "motor", prioridad: 1,
    uso: "Mide temperatura sin tocar: mangueras de radiador, termostato, entrada y salida del catalizador, discos de freno, cilindros del escape (el que está frío no está quemando).",
    tips: ["Apuntá a superficies opacas: el metal brillante o cromado engaña la lectura.", "Compará siempre dos puntos (entrada y salida, un lado y el otro) más que el valor absoluto."],
  },
  {
    id: "maquina-humo", nombre: "Máquina de humo", icon: "💨", cat: "motor", prioridad: 3,
    uso: "Llena de humo inofensivo la admisión, el turbo, el escape o el sistema de evaporación para encontrar pérdidas que a simple vista no se ven.",
    tips: ["En sistemas de turbo, no pases de 1 bar de presión.", "Con buena luz (o linterna) buscá por dónde sale el humo: juntas, mangueras, abrazaderas."],
  },
  {
    id: "bomba-vacio", nombre: "Bomba de vacío manual", icon: "🫙", cat: "motor", prioridad: 2,
    uso: "Bombín con vacuómetro para probar actuadores de vacío (wastegate, válvulas EGR viejas, servofreno), regular sensores MAP en banco y chequear que una membrana no pierda.",
    tips: ["Aplicá vacío y fijate que la aguja se mantenga: si baja sola, hay pérdida.", "Con un MAP en banco: a más vacío, menos tensión de salida."],
  },
  {
    id: "regloscopio", nombre: "Regloscopio (alineador de faros)", icon: "🔦", cat: "motor", prioridad: 3,
    uso: "Mide la altura e inclinación del haz de los faros para que iluminen bien sin encandilar. Es lo que usan en la RTO.",
    tips: ["Cubiertas infladas, tanque a medio llenar y conductor a bordo (o peso equivalente) antes de regular."],
  },
  {
    id: "reloj-comparador", nombre: "Reloj comparador", icon: "⏱️", cat: "precision", prioridad: 3,
    uso: "Mide desplazamientos chicos con base magnética: alabeo de discos de freno, juego axial del cigüeñal o del turbo, excentricidad de ejes.",
    tips: ["Fijá bien la base magnética y precargá el palpador antes de poner a cero."],
  },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);
