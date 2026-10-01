/* Preguntas de Física para el taller: vibraciones, acústica, óptica y termodinámica. */
import type { Question } from "./index";

const q: Record<string, Question[]> = {
  /* -------------------------------------------------- vibraciones */
  "fis-vibraciones": [
    {
      q: "Un motor de 4 cilindros y 4 tiempos gira a 3.000 rpm. ¿A qué frecuencia se producen las explosiones?",
      opts: [
        "50 Hz",
        "200 Hz",
        "100 Hz",
        "25 Hz",
      ],
      correct: 2,
      explain: "3.000 rpm / 60 = 50 vueltas por segundo. Un 4 cilindros tiene dos explosiones por vuelta (cuatro cada dos vueltas): 2 × 50 = 100 Hz.",
      topic: "Frecuencia",
    },
    {
      q: "Cargás el auto con cuatro personas y valijas. ¿Qué le pasa a la frecuencia natural de la carrocería sobre los resortes?",
      opts: [
        "Baja, porque aumenta la masa",
        "Sube, porque los resortes están más comprimidos",
        "No cambia: depende sólo del resorte",
        "Se duplica",
      ],
      correct: 0,
      explain: "f₀ = 1/2π·√(c/m). Con el mismo resorte y más masa, f₀ baja: el auto cargado oscila más lento y \"flota\" más.",
      topic: "Masa-resorte",
    },
    {
      q: "Empujás hacia abajo la esquina de un auto y al soltarla sube y baja tres veces antes de quedarse quieta. ¿Qué indica?",
      opts: [
        "Resorte cortado",
        "Amortiguador demasiado duro (D mayor que 1)",
        "Es lo normal en cualquier auto",
        "Amortiguador con poco amortiguamiento (D bajo): gastado",
      ],
      correct: 3,
      explain: "Un amortiguador sano deja un rebote y se detiene (D ≈ 0,2–0,4). Varios rebotes significan que casi no disipa energía: D bajó, típico de un amortiguador gastado o sin aceite.",
      topic: "Amortiguamiento",
    },
    {
      q: "¿Por qué los autos usan amortiguamiento D ≈ 0,3 y no D = 1, si D = 1 vuelve al reposo sin rebotar?",
      opts: [
        "Porque D = 1 es imposible de fabricar",
        "Porque un amortiguador muy duro transmite cada golpe del camino a la carrocería: se elige un compromiso entre confort y control",
        "Porque con D = 1 el auto rebota más",
        "Porque D = 1 sólo se usa en camiones",
      ],
      correct: 1,
      explain: "Con D = 1 la carrocería no se pasa, pero la fuerza del amortiguador transmite mucho más los impactos. D ≈ 0,2–0,4 deja un pequeño rebote y filtra mejor el camino; los deportivos van un poco más duros.",
      topic: "Amortiguamiento",
    },
    {
      q: "El volante tiembla entre 95 y 120 km/h, y a 130 km/h se calma. Al pasar a punto muerto a 110 km/h, el temblor sigue igual. ¿Qué es lo más probable?",
      opts: [
        "Soporte de motor roto",
        "Bujía que falla",
        "Rueda delantera desbalanceada entrando en resonancia",
        "Embrague que patina",
      ],
      correct: 2,
      explain: "Depende de la velocidad y no de las rpm (sigue en punto muerto), aparece en una franja y después se calma: es la firma de la resonancia de la rueda sobre su suspensión. Primero, balancear.",
      topic: "Diagnóstico",
    },
    {
      q: "Para que un soporte de motor aísle la vibración, ¿cómo tiene que ser su frecuencia natural respecto de la frecuencia de las explosiones?",
      opts: [
        "Bastante más baja (la excitación tiene que superar unas 1,4 veces la f₀ del soporte)",
        "Igual, para absorberla",
        "Bastante más alta",
        "No importa, sólo importa que sea de goma",
      ],
      correct: 0,
      explain: "Un apoyo elástico sólo aísla cuando la frecuencia de excitación supera √2 ≈ 1,4 veces su frecuencia natural. Por debajo de eso amplifica. Los soportes tienen f₀ de unos 8–12 Hz, bien por debajo de los ≈ 27 Hz de las explosiones en ralentí.",
      topic: "Aislamiento",
    },
    {
      q: "Notás que la marca de puesta a punto de la polea del cigüeñal (dámper) quedó corrida respecto del cubo. ¿Qué pasó?",
      opts: [
        "Saltó un diente la correa de distribución",
        "La goma del dámper se despegó y el anillo exterior patinó: hay que cambiarlo",
        "Es normal: el dámper gira un poco con el uso",
        "El cigüeñal está torcido",
      ],
      correct: 1,
      explain: "El dámper es un anillo pesado pegado con goma al cubo: un absorbedor de vibraciones torsionales. Si la goma se degrada, el anillo se corre (y la marca deja de coincidir). Ya no absorbe y puede llegar a soltarse: se reemplaza.",
      topic: "Dámper",
    },
  ],

  /* -------------------------------------------------- acústica */
  "fis-acustica": [
    {
      q: "Una amoladora hace 100 dB. ¿Cuánto hacen dos amoladoras iguales trabajando juntas a la misma distancia?",
      opts: [
        "200 dB",
        "110 dB",
        "106 dB",
        "103 dB",
      ],
      correct: 3,
      explain: "Dos fuentes iguales tienen el doble de potencia, y el doble de potencia es +3 dB (10·log₁₀ 2 ≈ 3). Los decibeles no se suman directamente.",
      topic: "Decibeles",
    },
    {
      q: "Estás a 1 m de una llave de impacto que hace 105 dB(A). Te alejás a 4 m. ¿Cuánto te llega, aproximadamente (al aire libre)?",
      opts: [
        "101 dB(A)",
        "93 dB(A)",
        "26 dB(A)",
        "99 dB(A)",
      ],
      correct: 1,
      explain: "Cada vez que duplicás la distancia bajan 6 dB. De 1 a 4 m son dos duplicaciones: 105 − 6 − 6 = 93 dB(A). Sigue estando por encima de 85: también necesitás protección.",
      topic: "Decibeles",
    },
    {
      q: "Según la regla de exposición (85 dB(A) durante 8 h, la mitad del tiempo cada 3 dB más), ¿cuánto tiempo por día se puede estar expuesto a 94 dB(A) sin protección?",
      opts: [
        "1 hora",
        "8 horas",
        "4 horas",
        "15 minutos",
      ],
      correct: 0,
      explain: "94 − 85 = 9 dB = tres veces 3 dB. El tiempo se divide por 2 tres veces: 8 h → 4 h → 2 h → 1 h.",
      topic: "Protección auditiva",
    },
    {
      q: "Un zumbido que crece con la velocidad del auto aumenta cuando doblás a la izquierda y disminuye cuando doblás a la derecha. ¿Qué sospechás primero?",
      opts: [
        "Rulemán de rueda del lado izquierdo",
        "Bomba de agua",
        "Rulemán de rueda del lado derecho",
        "Botador hidráulico",
      ],
      correct: 2,
      explain: "Al doblar a la izquierda, el peso se carga sobre las ruedas de la derecha. Si el ruido aumenta al cargar ese lado, el rulemán sospechoso es el derecho. Antes de cambiarlo, revisá que no sea una cubierta con desgaste irregular.",
      topic: "Diagnóstico",
    },
    {
      q: "Una correa chilla al arrancar en frío. Le rociás un poco de agua y el chillido EMPEORA. ¿Qué indica?",
      opts: [
        "Polea desalineada",
        "Falta tensión: la correa patina",
        "Rulemán del alternador",
        "Es normal en frío",
      ],
      correct: 1,
      explain: "Si con agua el ruido empeora, la correa patina por falta de tensión (tensor vencido o correa estirada). Si el ruido desaparece un momento, apunta a desalineación de poleas.",
      topic: "Diagnóstico",
    },
    {
      q: "¿Qué parte de un silenciador combate mejor los ruidos AGUDOS?",
      opts: [
        "La cámara de expansión (reflexión)",
        "El largo total del caño",
        "La salida cromada",
        "El tubo perforado rodeado de fibra (absorción)",
      ],
      correct: 3,
      explain: "La fibra (lana mineral) convierte la vibración de las ondas cortas en calor: es muy eficaz con los agudos. Las cámaras de reflexión y los resonadores trabajan mejor con los graves, que tienen ondas de metros.",
      topic: "Silenciador",
    },
    {
      q: "¿Por qué un estetoscopio de mecánico apoyado en el block te deja escuchar un botador que con el oído no ubicás?",
      opts: [
        "Porque el sonido viaja mucho mejor por el metal que por el aire y llega directo, sin mezclarse con el resto del ruido",
        "Porque amplifica electrónicamente",
        "Porque filtra los graves",
        "Porque el metal hace más agudo el sonido",
      ],
      correct: 0,
      explain: "En el acero el sonido viaja a más de 5.000 m/s y se pierde poco. La punta recoge la vibración de ese punto y te la trae directo al oído: comparando puntos, el que suena distinto es el sospechoso.",
      topic: "Estetoscopio",
    },
  ],

  /* -------------------------------------------------- óptica */
  "fis-optica": [
    {
      q: "¿En qué principio físico se basa el sensor de lluvia?",
      opts: [
        "En la reflexión total interna: con el vidrio seco la luz infrarroja rebota entera; una gota la deja escapar y baja la señal",
        "En que el agua conduce la electricidad",
        "En que el agua enfría el vidrio",
        "En una cámara que reconoce gotas",
      ],
      correct: 0,
      explain: "El LED manda luz a ~45°. Vidrio-aire tiene ángulo crítico 41,8°: rebota todo. Vidrio-agua tiene 62,5°: a 45° la luz sale dentro de la gota y llega menos al fotodiodo.",
      topic: "Reflexión total",
    },
    {
      q: "Después de cambiar el parabrisas, el limpia barre solo con el vidrio seco. ¿Qué revisás primero?",
      opts: [
        "El motor del limpia",
        "El relé de luces",
        "El acople del sensor de lluvia: gel o almohadilla óptica con burbujas o mal pegada",
        "La batería",
      ],
      correct: 2,
      explain: "El sensor necesita estar acoplado ópticamente al vidrio. Una burbuja o un soporte mal pegado hace que la luz se pierda antes de llegar al vidrio: la señal queda baja e inestable y el módulo cree que llueve.",
      topic: "Sensor de lluvia",
    },
    {
      q: "Una luz alta da 4 lux sobre un peatón a 100 m. ¿Cuánto le da a 200 m?",
      opts: [
        "2 lux",
        "0,5 lux",
        "4 lux",
        "1 lux",
      ],
      correct: 3,
      explain: "Ley inversa del cuadrado: E = I/d². Al doble de distancia, un cuarto de luz: 4 / 4 = 1 lux.",
      topic: "Fotometría",
    },
    {
      q: "¿Qué diferencia hay entre lumen y lux?",
      opts: [
        "Son lo mismo con distinto nombre",
        "Lumen es la luz total que sale de la lámpara; lux es cuánta luz cae por metro cuadrado sobre una superficie",
        "Lux es la luz total y lumen la luz por metro cuadrado",
        "Lumen mide el color de la luz",
      ],
      correct: 1,
      explain: "Lumen = flujo total (el caudal de la regadera). Candela = intensidad en una dirección (la fuerza del chorro). Lux = lúmenes por m² sobre una superficie (cuánto moja cada baldosa).",
      topic: "Fotometría",
    },
    {
      q: "Antes de cambiar una lámpara de xenón, ¿qué es lo más importante?",
      opts: [
        "Usar guantes para no tocar el vidrio",
        "Calentar la lámpara antes de sacarla",
        "Luces apagadas, llave afuera y ficha desconectada: el balastro genera más de 20.000 V para encender el arco",
        "Nada especial: es igual que una halógena",
      ],
      correct: 2,
      explain: "El encendido del xenón usa pulsos de alta tensión (más de 20 kV). Se trabaja con el circuito desconectado y nunca se prueba una lámpara fuera del faro.",
      topic: "Seguridad",
    },
    {
      q: "Restauraste un faro amarillento lijando y puliendo, pero a los pocos meses volvió a amarillear. ¿Qué faltó?",
      opts: [
        "Aplicar una protección con filtro UV (barniz para ópticas)",
        "Lijar con lija más gruesa",
        "Cambiar la lámpara por una LED",
        "Lavarlo con nafta",
      ],
      correct: 0,
      explain: "El policarbonato se degrada con el ultravioleta. De fábrica tiene una laca con filtro UV; al lijar se saca. Sin volver a proteger, el plástico expuesto se amarillea rápido, y más con el sol de Mendoza.",
      topic: "Faros",
    },
    {
      q: "Un faro tiene el centro a 65 cm del piso y la inclinación indicada es −1 %. Contra una pared a 10 m, ¿a qué altura tiene que quedar el corte de la luz baja?",
      opts: [
        "65 cm",
        "64 cm",
        "45 cm",
        "55 cm",
      ],
      correct: 3,
      explain: "−1 % significa que baja 1 cm por cada metro: a 10 m baja 10 cm. 65 − 10 = 55 cm. Con el baúl cargado la trompa sube, y para eso está la ruedita de regulación.",
      topic: "Regulación",
    },
  ],

  /* -------------------------------------------------- termodinámica */
  "fis-termo": [
    {
      q: "¿Por qué la presión de las cubiertas se mide en frío?",
      opts: [
        "Porque en caliente el manómetro se descalibra",
        "Porque en frío la goma es más dura",
        "Porque al andar el aire de adentro se calienta y, con el volumen casi fijo, la presión sube (p·V = m·R·T)",
        "No importa cuándo se mida",
      ],
      correct: 2,
      explain: "De 20 °C a 50 °C, una cubierta inflada a 2,2 bar sube a unos 2,5 bar. Si la desinflás en caliente para dejarla en 2,2, en frío va a quedar baja.",
      topic: "Gas ideal",
    },
    {
      q: "¿Por qué un motor diesel no necesita bujías?",
      opts: [
        "Porque el gasoil explota con el oxígeno solo",
        "Porque usa una chispa en el inyector",
        "Porque las bujías de precalentamiento hacen la chispa",
        "Porque al comprimir el aire con ε ≈ 15–20:1 se calienta a más de 500 °C y el gasoil inyectado se enciende solo",
      ],
      correct: 3,
      explain: "La compresión rápida (casi adiabática) calienta el aire: T₂ = T₁·ε^(κ−1). Con ε = 18 llega a unos 500–650 °C, muy por encima de los ≈ 250 °C a los que se enciende el gasoil. Las bujías de precalentamiento sólo ayudan en el arranque en frío.",
      topic: "Compresión",
    },
    {
      q: "Con el ciclo Otto ideal (κ = 1,4), ¿cuál es el rendimiento teórico con ε = 10?",
      opts: [
        "≈ 60 %",
        "≈ 40 %",
        "≈ 50 %",
        "≈ 90 %",
      ],
      correct: 0,
      explain: "η = 1 − 1/10^0,4 = 1 − 1/2,51 = 0,60. Un motor real rinde alrededor de la mitad (30–38 %) por la combustión no instantánea, las pérdidas de calor, el rozamiento y el bombeo.",
      topic: "Ciclo Otto",
    },
    {
      q: "Si subir la relación de compresión mejora el rendimiento, ¿por qué los motores nafteros no usan ε = 18?",
      opts: [
        "Porque el block no aguanta",
        "Porque la mezcla comprimida se calentaría tanto que se encendería sola antes de la chispa (detonación)",
        "Porque haría falta un burro de arranque más grande",
        "Porque la nafta no se evapora",
      ],
      correct: 1,
      explain: "El naftero comprime mezcla aire-nafta. Con demasiada compresión la mezcla detona (pistoneo) y rompe pistones. El diesel comprime sólo aire, por eso puede ir mucho más alto.",
      topic: "Ciclo Otto",
    },
    {
      q: "¿Para qué sirve el intercooler en un motor turbo?",
      opts: [
        "Para enfriar el aceite del turbo",
        "Para calentar el aire en invierno",
        "Para filtrar el aire",
        "Para enfriar el aire que el turbo comprimió y calentó: más denso (más aire por cilindro) y con menos riesgo de detonación",
      ],
      correct: 3,
      explain: "Comprimir calienta: el aire puede salir del turbo a más de 100 °C. Bajándolo a 40–60 °C, a la misma presión entra un 20 % más de aire o más.",
      topic: "Turbo",
    },
    {
      q: "La luz de válvulas se deja mayor en escape que en admisión. ¿Por qué?",
      opts: [
        "Porque la válvula de escape trabaja más caliente y se dilata más: con poca luz no cerraría y se quemaría",
        "Porque la válvula de escape es más chica",
        "Para que el motor suene menos",
        "Por costumbre, no tiene explicación",
      ],
      correct: 0,
      explain: "Los gases de escape calientan mucho más la válvula de escape. Al dilatarse, el vástago se alarga: si la luz en frío fuera chica, en caliente la válvula quedaría apenas abierta, se escaparían gases y se quemaría su asiento.",
      topic: "Dilatación",
    },
    {
      q: "Subiendo a Las Cuevas (≈ 3.200 m), el motor empieza a perder refrigerante por el depósito y la aguja sube. La tapa del depósito está vencida y no sella. ¿Qué está pasando?",
      opts: [
        "El anticongelante se congela",
        "La bomba de agua gira más lento en altura",
        "Sin presión en el circuito, el refrigerante hierve a la presión atmosférica de la altura: cerca o por debajo de la temperatura de trabajo del motor",
        "El termostato se cierra con el frío",
      ],
      correct: 2,
      explain: "A 3.200 m la presión es ≈ 690 hPa: el agua sola hierve a ≈ 90 °C y una mezcla al 50 % a ≈ 97 °C. La tapa suma 1,0–1,5 bar y lleva la ebullición arriba de 115 °C. Sin tapa que selle, el motor hierve trabajando a su temperatura normal.",
      topic: "Ebullición",
    },
  ],
};

export default q;
