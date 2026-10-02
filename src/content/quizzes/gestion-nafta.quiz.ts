// Preguntas de la parte 9: Inyección y encendido (nafta)
import type { Question } from "./index";

const q: Record<string, Question[]> = {
  /* ------------------------------------------------------------------ sensores */
  "gn-sensores": [
    {
      q: "Un auto gira con ganas pero no arranca: no hay chispa ni pulso de inyector. En el scanner, mientras dan arranque, las rpm marcan 0. ¿Qué revisás primero?",
      opts: ["La bomba de nafta", "El sensor de cigüeñal (CKP) y su cableado", "La sonda lambda", "El sensor de temperatura del motor"],
      correct: 1,
      explain: "Sin señal de CKP la ECU no ve girar el motor: no sabe cuándo inyectar ni cuándo dar chispa, así que no hace ninguna de las dos cosas. Las rpm en 0 dando arranque son la firma típica. Se confirma con el osciloscopio en el CKP (o, si es inductivo, midiendo su resistencia y la tensión alterna en arranque).",
      topic: "CKP",
    },
    {
      q: "En un taller de Godoy Cruz (≈ 750 m), con contacto puesto y el motor parado, el scanner muestra MAP = 100 kPa. ¿Qué concluís?",
      opts: ["Es correcto: con el motor parado el MAP siempre marca 100 kPa", "El MAP está corrido: debería marcar la presión del lugar, unos 92–93 kPa", "Hay una pérdida de vacío", "La mariposa quedó abierta"],
      correct: 1,
      explain: "El MAP mide presión absoluta. Con el motor parado, en el múltiple hay presión atmosférica, que a 750 m ronda 92–93 kPa. Marcar 100 kPa indica un sensor corrido (o una masa de sensores con caída de tensión). Muchas ECU usan esa lectura como presión barométrica, así que el error arruina también la corrección por altura.",
      topic: "MAP",
    },
    {
      q: "Motor caliente, el scanner muestra ECT = −40 °C. En el pin de señal del sensor medís 4,98 V. ¿Qué pasa?",
      opts: ["El sensor está en corto a masa", "El termostato quedó abierto", "Es normal en motores con dos resistencias de pull-up", "El circuito está abierto: cable cortado, ficha floja o sensor abierto (P0118)"],
      correct: 3,
      explain: "La ECU pone 5 V a través de una resistencia interna. Si el circuito se abre, no circula corriente y el pin queda casi en 5 V: la ECU lo interpreta como resistencia infinita, o sea la temperatura más fría posible (−40 °C). Es un código de circuito alto (P0118). Un corto a masa daría 0 V y 140 °C o más.",
      topic: "ECT / NTC",
    },
    {
      q: "Aparecen juntos P0107 (MAP bajo), P0122 (TPS bajo) y un código de presión del aire acondicionado bajo. ¿Qué es lo más probable?",
      opts: ["Se rompieron tres sensores a la vez", "La ECU está quemada", "La referencia de 5 V que comparten está en corto a masa (un sensor o un cable la tira abajo)", "La batería está descargada"],
      correct: 2,
      explain: "Varios sensores comparten la misma salida de 5 V de la ECU. Si uno de ellos o su cable hace corto a masa, la referencia cae y todos dan 'circuito bajo' a la vez. Se mide la referencia en las fichas y se desenchufan sensores de a uno hasta que vuelvan los 5 V.",
      topic: "Referencia de 5 V",
    },
    {
      q: "Con el motor caliente a 2.500 rpm, la sonda lambda (banda angosta) oscila entre 0,35 y 0,55 V, una vez cada 2 segundos. ¿Qué indica?",
      opts: ["Funcionamiento normal", "Mezcla muy rica", "Sonda lenta o contaminada: no llega a los extremos ni conmuta rápido (P0133)", "Sonda de banda ancha funcionando bien"],
      correct: 2,
      explain: "Una sonda angosta sana barre de ~0,1 a ~0,9 V y conmuta por lo menos una vez por segundo a 2.500 rpm, con transiciones rápidas. Poca amplitud y lentitud indican una sonda envejecida o contaminada (silicona, aceite, refrigerante). Para confirmar: acelerón (debe subir a 0,9 V enseguida) y una pérdida de vacío momentánea (debe caer a 0,1 V).",
      topic: "Sonda lambda",
    },
    {
      q: "Un motor de 85 kW, en tercera a fondo cerca del corte, muestra 45 g/s en el MAF. Tironea y tiene P0171. ¿Qué pensás?",
      opts: ["El MAF lee de menos (sucio) o entra aire después del MAF: a fondo debería rondar 75–85 g/s", "Es un valor normal para ese motor", "La sonda lambda está rota", "Le falta avance"],
      correct: 0,
      explain: "Regla de taller: a plena carga un MAF sano marca cerca de 1 g/s por cada kW (algo menos en altura). 45 g/s es muy poco. Si el MAF lee de menos, la ECU inyecta de menos y la mezcla queda pobre (P0171). Revisá la película del MAF y las mangueras entre el MAF y la mariposa.",
      topic: "MAF",
    },
    {
      q: "¿Cuál es la diferencia práctica más importante entre un CKP inductivo y uno Hall a la hora de probarlo?",
      opts: [
        "Ninguna, se prueban igual",
        "El inductivo genera una alterna que crece con las rpm (2 cables, se mide su resistencia); el Hall necesita alimentación y da una cuadrada igual a cualquier velocidad (3 cables)",
        "El Hall genera su propia tensión y el inductivo necesita 5 V",
        "El inductivo da una cuadrada de 0–5 V",
      ],
      correct: 1,
      explain: "El inductivo es un imán con bobina: genera tensión por el cambio de flujo, así que en arranque da poco (0,5–1 V) y en vueltas mucho. Se le puede medir la resistencia (200–1.500 Ω). El Hall es un chip: necesita alimentación y masa, y da una cuadrada de amplitud fija incluso girando a mano. Medirle 'resistencia' no sirve.",
      topic: "CKP inductivo vs Hall",
    },
    {
      q: "Un auto durmió afuera toda la noche de invierno. Antes de arrancar, el scanner muestra ECT = 17 °C e IAT = 3 °C. ¿Qué te dice?",
      opts: ["Todo normal: el agua tarda en enfriarse", "Uno de los dos sensores miente; con el motor frío de toda la noche tienen que coincidir dentro de 2–3 °C", "El termostato está trabado", "La batería está baja"],
      correct: 1,
      explain: "Después de muchas horas parado, refrigerante y aire de admisión quedan a la temperatura ambiente. Una diferencia de 14 °C indica que un sensor está corrido (o tiene una ficha con resistencia). Un ECT que lee caliente hace que la ECU enriquezca poco en frío: arranques difíciles.",
      topic: "ECT / IAT",
    },
  ],

  /* ----------------------------------------------------------------- inyección */
  "gn-inyeccion": [
    {
      q: "Scanner con el motor caliente: LTFT +18 % en ralentí que baja a +3 % a 2.500 rpm. ¿Qué buscás primero?",
      opts: ["Presión de nafta baja", "Una pérdida de vacío (aire falso)", "Inyectores que gotean", "Un MAF que lee de más"],
      correct: 1,
      explain: "Una fuga deja pasar más o menos la misma cantidad de aire siempre. En ralentí entra muy poco aire medido, así que esa fuga pesa mucho (18 %); a 2.500 rpm, con mucho más aire, casi no se nota (3–4 %). Un problema de presión o de MAF daría un trim alto parejo en todo el rango.",
      topic: "Trims",
    },
    {
      q: "P0171, LTFT +20 % en todo el rango de rpm. El manómetro en el riel marca 2,4 bar en ralentí (el dato es 3,5 bar). ¿Qué sospechás?",
      opts: ["Pérdida de vacío en el servofreno", "Sonda lambda vieja", "Falta de presión: bomba débil, filtro tapado o regulador", "Sensor de temperatura corrido"],
      correct: 2,
      explain: "Con poca presión, cada inyector entrega menos nafta en cualquier condición: el trim sube parejo. Se sigue con caudal de la bomba, corriente de la bomba con pinza, presión con carga y estado del filtro.",
      topic: "Presión de nafta",
    },
    {
      q: "La ECU calcula 120 mg de aire por cilindro, busca λ = 1, el inyector entrega 3 mg/ms y el tiempo muerto es 1 ms. ¿Qué ancho de pulso manda?",
      opts: ["≈ 2,7 ms", "≈ 3,7 ms", "≈ 8,2 ms", "≈ 40 ms"],
      correct: 1,
      explain: "Nafta = 120 / 14,7 = 8,2 mg. Tiempo útil = 8,2 / 3 = 2,7 ms. Sumando el tiempo muerto: 2,7 + 1 = 3,7 ms. Es un valor típico de ralentí en un multipunto.",
      topic: "Ancho de pulso",
    },
    {
      q: "Con la misma carga y las mismas rpm, el ancho de pulso sube de 3,5 a 3,8 ms cuando la batería baja de 14 a 11,5 V. ¿Por qué?",
      opts: ["La ECU enriquece porque detecta falla", "Con menos tensión la aguja tarda más en abrir: la ECU suma tiempo muerto para entregar la misma nafta", "El inyector entrega más caudal con menos tensión", "Es una falla del sensor de batería"],
      correct: 1,
      explain: "Durante los primeros ~0,7–1,2 ms de pulso la corriente todavía no alcanza para despegar la aguja. Con menos tensión la corriente sube más lento y ese 'tiempo muerto' se alarga. La ECU tiene una tabla de tiempo muerto vs tensión de batería y lo compensa.",
      topic: "Tiempo muerto",
    },
    {
      q: "Sistema con retorno: al sacar la manguera de vacío del regulador de presión, sale nafta por la manguera. ¿Qué significa?",
      opts: ["El diafragma del regulador está roto: entra nafta al múltiple, la mezcla queda rica (trims negativos, humo negro)", "Es normal", "La bomba tiene demasiada presión", "El filtro de nafta está tapado"],
      correct: 0,
      explain: "La manguera de vacío del regulador sólo debería tener aire. Si hay nafta, el diafragma está perforado y el múltiple chupa nafta sin control. Además, el regulador deja de regular bien. Se cambia el regulador.",
      topic: "Regulador",
    },
    {
      q: "En el osciloscopio, el inyector del cilindro 2 muestra una forma perfecta: cae a 0 V, rampa de corriente normal, pico de 65 V y la jorobita de cierre. Sin embargo, ese cilindro tiene fallas y en la prueba de balance hace caer poco la presión. ¿Qué tiene?",
      opts: ["Bobina del inyector en corto", "Inyector tapado o con el chorro deformado: eléctricamente sano, hidráulicamente no", "Falla del driver de la ECU", "Ficha floja"],
      correct: 1,
      explain: "El osciloscopio ve la parte eléctrica y el movimiento de la aguja, no cuánta nafta pasa. Un inyector barnizado abre y cierra perfecto pero entrega menos. Se confirma en banco de caudal (después de limpieza por ultrasonido) comparando volúmenes y forma del chorro.",
      topic: "Inyectores",
    },
    {
      q: "Un motor reprogramado pide 19 ms de pulso a 5.500 rpm (un ciclo completo dura 21,8 ms). ¿Qué problema hay?",
      opts: ["Ninguno", "El ciclo de trabajo es ~87 %: los inyectores están al límite y no tienen margen; hacen falta inyectores más grandes o más presión", "La ECU está inyectando dos veces por ciclo", "Falta tiempo muerto"],
      correct: 1,
      explain: "Ciclo de trabajo = 19 / 21,8 ≈ 87 %. Pasado el ~80–85 % el inyector casi no llega a cerrar y abrir de nuevo: deja de ser lineal y cualquier pedido extra no se cumple. La mezcla puede quedar pobre a fondo, que es justo donde más daño hace.",
      topic: "Ciclo de trabajo",
    },
    {
      q: "Un motor con inyección directa tiene falta de potencia y P0087. ¿Cómo empezás?",
      opts: [
        "Con un manómetro de nafta común en el riel de alta",
        "Mirando en el scanner la presión de riel real contra la pedida, y la presión de la bomba de baja",
        "Cambiando los inyectores",
        "Midiendo la resistencia de las bujías",
      ],
      correct: 1,
      explain: "P0087 es presión de riel baja. En una directa el riel trabaja a 50–350 bar: se lee con el sensor del riel por scanner, nunca con un manómetro común (y no se abre ese circuito sin el procedimiento). Si la de baja (4–6 bar) está bien, se sigue con la bomba de alta y su electroválvula.",
      topic: "Inyección directa",
    },
  ],

  /* ----------------------------------------------------------------- encendido */
  "gn-encendido": [
    {
      q: "Un auto anda perfecto en ralentí pero se sacude subiendo una cuesta a fondo, con P0302. Afuera del motor la bobina del cilindro 2 da buena chispa. ¿Por qué puede fallar igual?",
      opts: [
        "Porque a fondo la mezcla comprimida es mucho más densa y hace falta 2 o 3 veces más tensión: una bobina o capuchón fisurado llega en ralentí pero no con carga",
        "Porque a fondo la ECU corta la chispa",
        "Porque la chispa en el aire necesita más tensión que en el cilindro",
        "Porque el sensor de detonación apaga ese cilindro",
      ],
      correct: 0,
      explain: "La tensión de ruptura crece con la densidad del gas: ~8 kV en ralentí, más de 20 kV a fondo. En el aire, a presión atmosférica, salta con muy poco. Por eso se prueba con un probador de chispa regulable exigente y se mira la falla con carga.",
      topic: "Tensión de ruptura",
    },
    {
      q: "En el secundario, en ralentí, todos los cilindros rompen a ~10 kV menos el 3, que rompe a 22 kV con una línea de quemado corta. ¿Qué sospechás?",
      opts: ["Bujía empastada de carbón", "Mezcla rica en el cilindro 3", "Compresión baja en el cilindro 3", "Bujía muy gastada (luz grande) o cable/capuchón con resistencia alta en el cilindro 3"],
      correct: 3,
      explain: "Una ruptura alta significa que costó más saltar: luz grande, resistencia de más en el camino o mezcla pobre. El quemado corto acompaña: se gastó más energía en romper. Una bujía empastada o compresión baja darían, al contrario, una ruptura baja.",
      topic: "Formas de onda",
    },
    {
      q: "Bobina con L = 4 mH. Si la ECU corta cuando el primario lleva 7 A, ¿cuánta energía tiene para la chispa?",
      opts: ["≈ 14 mJ", "≈ 28 mJ", "≈ 98 mJ", "≈ 196 mJ"],
      correct: 2,
      explain: "E = ½ · L · I² = 0,5 × 0,004 × 49 = 0,098 J = 98 mJ. Está dentro de lo típico de un encendido moderno (30–100 mJ). Si el tiempo de carga fuera corto y la corriente llegara sólo a 4 A, la energía caería a 32 mJ.",
      topic: "Energía de la bobina",
    },
    {
      q: "¿Por qué la ECU alarga el tiempo de carga de la bobina cuando baja la tensión de batería?",
      opts: ["Para que la chispa dure menos", "Porque con menos tensión la corriente sube más lento, y necesita más tiempo para llegar a la misma corriente (y energía) al corte", "Para proteger el driver", "Para retrasar el encendido"],
      correct: 1,
      explain: "La corriente del primario sube en rampa: i = (V/R)·(1 − e^(−t·R/L)). Con menos V, para llegar a los mismos 7–8 A hace falta más tiempo. Por eso hay una tabla de tiempo de carga según la tensión de batería.",
      topic: "Dwell",
    },
    {
      q: "Sacás una bujía con el aislador blanco, con ampollitas y puntos metálicos, y el electrodo comido. ¿Qué indica?",
      opts: ["Funcionamiento normal", "Mezcla rica", "Sobretemperatura: mezcla pobre, avance de más, grado térmico muy caliente o detonación", "Entrada de aceite"],
      correct: 2,
      explain: "El blanco con ampollas es la firma de una punta que trabajó por encima de ~850–900 °C. Hay que buscar la causa (inyector tapado en ese cilindro, avance, bujía equivocada, refrigeración) antes de poner una nueva, porque ese calor lleva al preencendido.",
      topic: "Lectura de bujías",
    },
    {
      q: "En el scanner, el retardo por detonación del cilindro 3 está siempre en 6°, y los otros en 0°. ¿Qué te dice?",
      opts: ["El sensor de detonación está roto", "Algo local en el cilindro 3 favorece la detonación (carbonilla, inyector que entrega poco, punto caliente)", "La nafta es de menor octanaje", "Es normal: la ECU alterna entre cilindros"],
      correct: 1,
      explain: "La ECU retrasa cilindro por cilindro. Si fuera la nafta o el sensor, afectaría a todos. Un solo cilindro retrasando siempre apunta a algo propio: carbonilla que sube la compresión, mezcla pobre por un inyector tapado, mala refrigeración local.",
      topic: "Detonación",
    },
    {
      q: "La luz de check empieza a parpadear mientras manejás. ¿Qué significa y qué hacés?",
      opts: [
        "Es un aviso de service, podés seguir normal",
        "Hay fallas de encendido que pueden dañar el catalizador: bajá la exigencia y llevalo a revisar cuanto antes",
        "Se cortó la sonda lambda",
        "Falla el inmovilizador",
      ],
      correct: 1,
      explain: "La luz parpadeante en OBD-II indica fallas de encendido tan frecuentes que la nafta sin quemar puede recalentar y derretir el catalizador. Algunas ECU además cortan el inyector de ese cilindro. Seguir exigiendo el motor es pagar un catalizador.",
      topic: "Fallas de encendido",
    },
    {
      q: "Tenés una bobina COP de 3 cables (12 V, masa y señal). ¿Cómo comprobás que la ECU la está comandando?",
      opts: [
        "Poniendo 12 V en el pin de señal a ver si chispea",
        "Midiendo 12 V y masa con contacto, y con el osciloscopio viendo pulsos de 0–5 V en la señal dando arranque",
        "Midiendo la resistencia del secundario",
        "Con una lámpara de prueba en el pin de señal",
      ],
      correct: 1,
      explain: "En las bobinas de 3–4 cables el driver de potencia está adentro de la bobina y la ECU sólo manda una señal lógica de 5 V cuya duración es el tiempo de carga. Poner 12 V en ese pin o cargar la señal con una lámpara puede romper el driver de la bobina o la salida de la ECU.",
      topic: "Sistemas de encendido",
    },
  ],

  /* ------------------------------------------------------------------- la ECU */
  "gn-ecu": [
    {
      q: "Limpiaste la mariposa motorizada de un auto con 90.000 km. Al arrancar, el ralentí queda en 1.300 rpm y oscila. ¿Qué falta?",
      opts: ["Cambiar el sensor de temperatura", "Hacer el aprendizaje de mariposa/ralentí: la ECU sigue abriendo como si la mariposa estuviera sucia", "Cambiar la mariposa", "Borrar los códigos y listo"],
      correct: 1,
      explain: "Con los kilómetros la ECU aprendió a abrir un poco más para compensar la suciedad. Limpia, esa misma apertura deja pasar de más. El aprendizaje (por scanner o procedimiento de llave) le hace encontrar de nuevo el tope y la apertura de ralentí.",
      topic: "Adaptaciones",
    },
    {
      q: "Un auto entra con el testigo prendido, ralentí acelerado y el pedal sin respuesta. Código P2138. Las dos pistas están dentro de rango pero no guardan la relación. ¿Qué hacés antes de cambiar el pedal?",
      opts: [
        "Cambiar la ECU",
        "Medir 5 V y masa de cada pista en la ficha, buscar sulfatación o caída de tensión, y ver las dos señales con el osciloscopio moviendo el pedal",
        "Borrar el código y entregarlo",
        "Cambiar la mariposa",
      ],
      correct: 1,
      explain: "P2138 es correlación: las dos pistas no cuentan la misma historia, así que la ECU no puede saber cuál miente e ignora el pedal. Una masa floja o una ficha sulfatada desplazan las señales y producen exactamente eso. Primero alimentación y masa, después las señales.",
      topic: "Plausibilidad",
    },
    {
      q: "¿Para qué sirve el cuadro congelado (freeze frame) que guarda la ECU junto con un código?",
      opts: [
        "Para borrar el código automáticamente",
        "Es una foto de los datos (rpm, carga, temperatura, velocidad, trims, estado del lazo) en el momento de la falla: te dice en qué condición reproducirla",
        "Guarda el mapa original de la ECU",
        "Sirve para programar llaves",
      ],
      correct: 1,
      explain: "Saber que el P0171 se guardó con el motor frío, en ralentí y con LTFT +22 % orienta muchísimo más que el código solo. Anotalo siempre antes de borrar.",
      topic: "Diagnóstico OBD",
    },
    {
      q: "El cliente dice que le borraron los códigos ayer. Con el scanner ves los monitores de catalizador y de sonda en 'no listo'. ¿Qué indica?",
      opts: ["Que la ECU todavía no completó esas autopruebas desde el borrado; hace falta un ciclo de manejo", "Que el catalizador está roto", "Que la ECU está dañada", "Que el auto no tiene esas funciones"],
      correct: 0,
      explain: "Borrar códigos (o desconectar la batería) pone los monitores en 'no listo'. Los no continuos, como catalizador y sondas, corren recién cuando se dan sus condiciones de manejo. Por eso borrar antes de una inspección no esconde la falla: se nota que se borró.",
      topic: "Monitores",
    },
    {
      q: "En un mapa de inyección, la celda de 2.500 rpm dice 5,0 ms y la de 3.000 rpm dice 6,0 ms (misma carga). ¿Qué valor usa la ECU a 2.750 rpm?",
      opts: ["5,0 ms (la celda más cercana hacia abajo)", "5,5 ms (interpola)", "6,0 ms", "11 ms (las suma)"],
      correct: 1,
      explain: "La ECU interpola linealmente: 5,0 + (6,0 − 5,0) × (2.750 − 2.500)/(3.000 − 2.500) = 5,5 ms. En un mapa de dos ejes lo hace en los dos (interpolación bilineal), así no hay escalones entre celdas.",
      topic: "Mapas",
    },
    {
      q: "A fondo, en el scanner ves STFT = 0 %, estado 'lazo abierto' y la sonda marcando 0,9 V. ¿Está bien?",
      opts: ["No: la sonda está rota", "Sí: a plena carga la ECU deja el lazo cerrado y enriquece a propósito (λ ≈ 0,85–0,9) por potencia y protección", "No: falta presión de nafta", "No: la ECU perdió las adaptaciones"],
      correct: 1,
      explain: "A plena carga la ECU trabaja en lazo abierto con su mapa de lambda objetivo, más rico que 1, para sacar potencia y enfriar escape, catalizador y turbo. La sonda angosta marca rica (0,9 V), que es justo lo que se busca, y el STFT no corrige.",
      topic: "Lazo abierto y cerrado",
    },
    {
      q: "Un taller cambió la ECU de un auto por una usada y el motor arranca un segundo y se apaga; el testigo de la llave parpadea. ¿Qué pasa?",
      opts: ["La ECU usada está rota", "Falta cargar nafta", "El inmovilizador no autoriza a la ECU: hay que adaptarla al auto (y a sus llaves)", "El CKP no es compatible"],
      correct: 2,
      explain: "El módulo inmovilizador sólo autoriza a la ECU que tiene emparejada. Una ECU de otro auto no recibe la autorización: no inyecta o se apaga a los segundos. Hay que hacer la adaptación (con scanner y, normalmente, el código PIN).",
      topic: "Inmovilizador",
    },
    {
      q: "Una ECU vino 'quemada' (el driver del inyector 2 no funciona). Le ponen otra y a la semana pasa lo mismo. ¿Qué faltó?",
      opts: ["Usar una ECU original", "Buscar el actuador o el cable en corto que destruyó el driver (medir el inyector 2 y su cableado) antes de instalar la nueva", "Reprogramar la ECU", "Cambiar la batería"],
      correct: 1,
      explain: "Las ECU rara vez se rompen solas. Un inyector con espiras en corto o un cable que toca masa hace circular corriente de más por el driver hasta destruirlo. Si no se corrige, la ECU nueva corre la misma suerte. Regla: antes de enchufar una ECU, medí los actuadores de esa salida.",
      topic: "Estrategia de diagnóstico",
    },
  ],
};

export default q;
