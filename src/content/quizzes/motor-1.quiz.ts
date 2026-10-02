/* Preguntas de la Parte 8 · Motor: cómo funciona (4 tiempos, tren alternativo, distribución). */
import type { Question } from "./index";

const q: Record<string, Question[]> = {
  "motor-4t": [
    {
      q: "¿Cuántas vueltas da el cigüeñal para completar un ciclo de 4 tiempos, y cuántas el árbol de levas?",
      opts: ["Cigüeñal 1, levas 1", "Cigüeñal 2, levas 1", "Cigüeñal 4, levas 2", "Cigüeñal 2, levas 2"],
      correct: 1,
      explain: "Cada tiempo es media vuelta de cigüeñal: 4 tiempos = 2 vueltas (720°). Cada válvula abre una sola vez por ciclo, así que el árbol de levas da una vuelta: gira a la mitad (relación 2:1).",
      topic: "4 tiempos",
    },
    {
      q: "En el tiempo de compresión de un naftero andando a fondo, ¿qué pasa adentro del cilindro?",
      opts: [
        "La válvula de admisión está abierta y entra mezcla",
        "Las dos válvulas están cerradas, la mezcla se aprieta, sube a 15–20 bar y a 350–500 °C",
        "La mezcla se prende sola por la temperatura",
        "La válvula de escape abre para aliviar la presión",
      ],
      correct: 1,
      explain: "En compresión las dos válvulas están cerradas y el pistón sube. La mezcla se calienta al comprimirse, pero en un naftero no debe prenderse sola: eso sería detonación. La enciende la chispa, unos grados antes del PMS.",
      topic: "4 tiempos",
    },
    {
      q: "Un motor tiene 82 mm de diámetro y 75,6 mm de carrera, 4 cilindros. ¿Cuál es su cilindrada aproximada?",
      opts: ["1.400 cm³", "1.600 cm³", "2.000 cm³", "1.800 cm³"],
      correct: 1,
      explain: "Vh = 0,7854 × 8,2² × 7,56 = 0,7854 × 67,24 × 7,56 ≈ 399 cm³. Por 4 cilindros ≈ 1.597 cm³: un 1.6. Es un motor de carrera corta (diámetro mayor que la carrera).",
      topic: "cilindrada",
    },
    {
      q: "Un cilindro de 400 cm³ tiene una cámara de 40 cm³. ¿Qué relación de compresión tiene?",
      opts: ["10:1", "11:1", "9:1", "12:1"],
      correct: 1,
      explain: "ε = (Vh + Vc) / Vc = (400 + 40) / 40 = 11. Si rectificaran la tapa y la cámara bajara a 37 cm³, pasaría a (400 + 37) / 37 ≈ 11,8:1.",
      topic: "relación de compresión",
    },
    {
      q: "Prueba de compresión en un 1.6 naftero, en caliente: 12,4 · 12,2 · 7,6 · 12,5 bar. Con un poco de aceite el cilindro 3 sube a 7,9 bar. ¿Qué es lo más probable?",
      opts: [
        "Aros gastados en el cilindro 3",
        "Una válvula del cilindro 3 que no cierra (quemada o mal asentada)",
        "La batería estaba descargada",
        "Es normal por la altura",
      ],
      correct: 1,
      explain: "Un solo cilindro bajo (−39 %) que casi no sube con aceite: la fuga no está en los aros (el aceite los habría sellado) sino arriba. Si fuera junta de tapa lo esperable sería ver dos vecinos bajos. Se confirma con la prueba de pérdidas: el aire sale por el escape o por la admisión.",
      topic: "prueba de compresión",
    },
    {
      q: "Medís la compresión de un motor sano en Uspallata (1.900 m) y te dan los 4 cilindros entre 9,9 y 10,3 bar. El dato de fábrica es 12–14 bar. ¿Qué concluís?",
      opts: [
        "Los 4 cilindros tienen aros gastados",
        "La distribución está corrida",
        "Es esperable por la altura: entra ~20 % menos de aire. Están parejos, el motor está bien",
        "Hay que rectificar el motor",
      ],
      correct: 2,
      explain: "A 1.900 m la presión atmosférica es ~810 hPa contra 1.013 a nivel del mar: el cilindro se llena con un 20 % menos de aire y la lectura baja en proporción. El dato de fábrica es a nivel del mar. Lo importante es la diferencia entre cilindros, acá menor al 5 %.",
      topic: "Mendoza",
    },
    {
      q: "¿Cómo distingue la ECU si el cilindro 1 está en el PMS de compresión o en el PMS de escape (cruce)?",
      opts: [
        "Con el sensor de cigüeñal (CKP) solamente",
        "Combinando el CKP con el sensor de árbol de levas (CMP)",
        "Con el sensor MAP",
        "Con la sonda lambda",
      ],
      correct: 1,
      explain: "El cigüeñal pasa por la misma posición en los dos PMS, así que el CKP solo no alcanza. El CMP, que gira a la mitad, da una señal por ciclo y le dice a la ECU cuál de las dos vueltas es. Así puede inyectar y encender cilindro por cilindro.",
      topic: "electrónica",
    },
    {
      q: "En un 4 en línea con orden de encendido 1-3-4-2, ¿cada cuántos grados de cigüeñal explota un cilindro?",
      opts: ["90°", "120°", "180°", "360°"],
      correct: 2,
      explain: "El ciclo dura 720° y hay 4 cilindros: 720 / 4 = 180°. Por eso hay dos explosiones por vuelta y el giro es mucho más parejo que en un monocilíndrico, que explota una vez cada 720°.",
      topic: "orden de encendido",
    },
  ],

  "motor-tren": [
    {
      q: "¿Por qué los pistones vienen ovalados y algo cónicos cuando están fríos?",
      opts: [
        "Por un defecto de fabricación tolerado",
        "Porque el aluminio se dilata mucho y en forma desigual: en caliente quedan redondos y con la luz justa",
        "Para que entren más fácil al armar el motor",
        "Para que consuman un poco de aceite a propósito",
      ],
      correct: 1,
      explain: "El aluminio se dilata casi el doble que el hierro, y la cabeza (250–350 °C) se calienta mucho más que la falda. Donde hay más material (alojamientos del bulón) crece más. Por eso se fabrican ovalados y más finos arriba.",
      topic: "pistón",
    },
    {
      q: "¿Qué es lo que más ayuda a que el aro de compresión selle durante la explosión?",
      opts: [
        "La tensión del aro, nada más",
        "El aceite que hay entre el aro y la pared",
        "La propia presión del gas, que se mete detrás del aro y lo aprieta contra la pared y la ranura",
        "El segundo aro, que lo empuja hacia arriba",
      ],
      correct: 2,
      explain: "La tensión propia sólo lo apoya. El gas a presión entra por arriba y por detrás del aro y lo empuja contra la pared y contra el flanco inferior de la ranura. Por eso un aro pegado en su ranura por carbonilla no sella aunque sea nuevo.",
      topic: "aros",
    },
    {
      q: "Un auto echa humo azul sólo durante unos segundos al arrancar a la mañana, y después no. La compresión está bien. ¿Qué es lo más probable?",
      opts: ["Aros gastados", "Retenes de válvula endurecidos", "Junta de tapa quemada", "Turbo roto"],
      correct: 1,
      explain: "Con el motor parado, el aceite de la tapa baja por las guías de válvula si los retenes están duros; al arrancar se quema y sale humo azul que enseguida desaparece. Con aros gastados el humo azul sigue con el motor caliente y la compresión da baja.",
      topic: "aros",
    },
    {
      q: "Para medir la luz de aceite de un metal de biela con plastigage, ¿qué NO hay que hacer?",
      opts: [
        "Limpiar y secar el muñón y el metal",
        "Apretar el sombrerete al torque y ángulo del manual",
        "Girar el cigüeñal con el plastigage colocado",
        "Comparar el ancho del hilo aplastado con la escala del sobre",
      ],
      correct: 2,
      explain: "Si girás el cigüeñal, el hilo se arrastra y la medición no vale. Se coloca en seco, se aprieta al torque sin mover nada, se desarma y se compara el ancho. Luz típica: 0,02–0,06 mm, según fabricante.",
      topic: "medición",
    },
    {
      q: "Un motor da 200 N·m a 3.000 rpm. ¿Qué potencia entrega en ese punto?",
      opts: ["≈ 63 kW (≈ 85 CV)", "≈ 60 CV", "≈ 600 kW", "≈ 6,3 kW"],
      correct: 0,
      explain: "P = M · n / 9550 = 200 × 3.000 / 9550 ≈ 62,8 kW. Para pasar a CV se multiplica por 1,36: ≈ 85 CV.",
      topic: "torque y potencia",
    },
    {
      q: "Un motor golpea abajo con un ruido metálico seco que aumenta al acelerar y soltar de golpe, y es peor en caliente. El testigo de aceite parpadea en ralentí. ¿Qué hacés?",
      opts: [
        "Le pongo un aceite más espeso y sigo usándolo",
        "Lo apago y no lo uso más hasta revisarlo: es casi seguro un golpe de biela por falta de lubricación",
        "Es normal en motores con muchos kilómetros",
        "Cambio el sensor de presión de aceite",
      ],
      correct: 1,
      explain: "Golpe seco que cambia con la carga, peor en caliente, con presión de aceite baja: metal de biela gastado. Si se para a tiempo, se arregla con metales (y el cigüeñal puede salvarse). Si se sigue, la biela se funde o se rompe y el motor queda destruido.",
      topic: "fallas",
    },
    {
      q: "¿Por qué los tornillos de biela de tipo TTY (torque + ángulo) se cambian cada vez que se desarman?",
      opts: [
        "Porque se oxidan",
        "Porque al apretarlos se estiran a propósito y no recuperan su forma: reusados, pueden cortarse o aflojarse",
        "Porque cambia la rosca de la biela",
        "Por una costumbre sin fundamento",
      ],
      correct: 1,
      explain: "Los TTY trabajan estirados en la zona plástica para dar una fuerza de apriete muy precisa. Una vez estirados ya no son iguales: reapretarlos puede cortarlos o dejar el sombrerete sin la presión correcta. Se cambian siempre.",
      topic: "medición",
    },
    {
      q: "A 6.000 rpm el pistón de un motor sufre fuerzas de inercia de unos 10.000 N. ¿Cuánto serían aproximadamente a 7.200 rpm?",
      opts: ["12.000 N", "14.400 N", "10.000 N", "20.000 N"],
      correct: 1,
      explain: "La inercia crece con el cuadrado de las rpm: (7.200 / 6.000)² = 1,44. 10.000 × 1,44 = 14.400 N. Por eso pasarse de vueltas es tan peligroso para bielas y pistones, aunque el motor no esté cargado.",
      topic: "fuerzas",
    },
  ],

  "motor-distribucion": [
    {
      q: "El piñón de cigüeñal tiene 22 dientes. ¿Cuántos dientes tiene que tener el piñón del árbol de levas en un 4 tiempos?",
      opts: ["22", "33", "44", "11"],
      correct: 2,
      explain: "El árbol de levas gira a la mitad que el cigüeñal, así que su piñón tiene el doble de dientes: 44. Un diente saltado serían 360/44 ≈ 8° de leva, o sea ≈ 16° de cigüeñal.",
      topic: "relación 2:1",
    },
    {
      q: "Después de cambiar la correa, girás el motor una vuelta y la marca del cigüeñal coincide, pero las de los árboles de levas quedaron del lado opuesto. ¿Qué pasa?",
      opts: [
        "La correa quedó corrida medio piñón",
        "Nada: falta otra vuelta de cigüeñal, las de levas coinciden cada 2 vueltas",
        "El tensor está flojo",
        "Hay que poner la correa al revés",
      ],
      correct: 1,
      explain: "El cigüeñal pasa por su marca en cada vuelta, pero las levas, que giran a la mitad, sólo en una de cada dos. Girá otra vuelta completa y las tres tienen que coincidir (y las trabas entrar sin esfuerzo).",
      topic: "puesta a punto",
    },
    {
      q: "¿Por qué la válvula de escape abre antes de que el pistón llegue al PMI?",
      opts: [
        "Para que la chispa tenga más tiempo",
        "Porque el gas todavía tiene presión (3–5 bar) y sale solo; así el pistón no tiene que hacer fuerza para empujarlo después",
        "Para refrigerar la válvula",
        "Por un error de diseño que no se puede corregir",
      ],
      correct: 1,
      explain: "Al final de la expansión queda poco empuje útil, pero mucho gas a presión. Abriendo el escape unos 40–60° antes del PMI, ese gas sale solo (descarga espontánea) y el tiempo de escape cuesta menos trabajo.",
      topic: "diagrama de distribución",
    },
    {
      q: "Un motor con correa no arranca: se apagó andando y la burra gira más rápido de lo normal. ¿Qué conviene hacer?",
      opts: [
        "Seguir dando arranque hasta que prenda",
        "Empujarlo en segunda",
        "Dejar de dar arranque y verificar si gira el árbol de levas: si se cortó la correa en un motor interferente, cada vuelta puede doblar más válvulas",
        "Cambiar la bomba de nafta",
      ],
      correct: 2,
      explain: "Una burra que gira 'liviana' es típico de un motor sin compresión porque las válvulas no se mueven. Se confirma mirando el árbol de levas (o la correa) al dar arranque. En un interferente, seguir girando agrava el daño.",
      topic: "motor interferente",
    },
    {
      q: "¿Qué se cambia normalmente en un 'kit de distribución' de un motor con correa?",
      opts: [
        "Sólo la correa",
        "Correa, tensor y rodillos (y la bomba de agua si la mueve la correa)",
        "Correa y bujías",
        "La cadena y el aceite",
      ],
      correct: 1,
      explain: "El tensor y los rodillos tienen rulemanes que se gastan al mismo ritmo que la correa: si uno se traba, la correa nueva se corta. Si la bomba de agua es movida por la distribución, se cambia también (una pérdida de refrigerante arruina la correa).",
      topic: "mantenimiento",
    },
    {
      q: "El scanner muestra P0016 en un motor con cadena de 180.000 km que traquetea unos segundos al arrancar. ¿Qué es lo más probable?",
      opts: [
        "Sensor de oxígeno defectuoso",
        "Cadena de distribución estirada que corrió la fase de las levas respecto del cigüeñal",
        "Bujías gastadas",
        "Falta de nafta",
      ],
      correct: 1,
      explain: "P0016 es correlación entre cigüeñal (CKP) y levas (CMP). Con una cadena estirada las levas se atrasan respecto del cigüeñal y el tensor tarda en cargarse al arrancar (traqueteo). Se confirma con el valor de desfase en el scanner o comparando CKP y CMP en el osciloscopio.",
      topic: "electrónica",
    },
    {
      q: "Activás la OCV del VVT con el scanner con el motor en ralentí y el motor no cambia nada. ¿Qué indica?",
      opts: [
        "Todo normal: el VVT no actúa en ralentí",
        "Que el variador no se está moviendo: OCV trabada, filtrito tapado, aceite sucio o variador dañado",
        "Que la correa está floja",
        "Que la ECU está en modo de emergencia",
      ],
      correct: 1,
      explain: "Si el variador avanza la admisión en ralentí, aumenta el cruce y el motor tiene que temblar o casi apagarse. Que no cambie nada indica que el aceite no llega o que el variador no se mueve. Primero: aceite y filtro correctos, y revisar el filtrito de la OCV.",
      topic: "VVT",
    },
    {
      q: "En carga parcial (ruta a velocidad constante), ¿para qué avanza la ECU el árbol de admisión y aumenta el cruce?",
      opts: [
        "Para ganar potencia máxima",
        "Para que parte del gas de escape vuelva al cilindro (recirculación interna): baja el NOx y las pérdidas por bombeo, y el consumo",
        "Para enfriar las válvulas de escape",
        "Para que el ralentí sea más estable",
      ],
      correct: 1,
      explain: "Más cruce en carga parcial = recirculación interna de gases: la combustión es más fría (menos NOx) y, como el cilindro ya tiene gas inerte, la mariposa abre más para el mismo torque (menos bombeo). En ralentí, en cambio, se busca poco cruce.",
      topic: "VVT",
    },
  ],
};

export default q;
