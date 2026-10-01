/* Preguntas de la Parte 8 (sistemas auxiliares): refrigeración y lubricación; admisión, turbo y escape. */
import type { Question } from "./index";

const q: Record<string, Question[]> = {
  "motor-refri": [
    {
      q: "Un auto se recalienta parado en el tráfico con el aire acondicionado prendido, pero en ruta la temperatura queda perfecta. ¿Qué revisás primero?",
      opts: ["La junta de tapa", "El electroventilador (fusible, relé, motor, ficha) y que el panal no esté tapado por fuera", "El termostato trabado abierto", "La bomba de aceite"],
      correct: 1,
      explain: "En ruta el aire de marcha alcanza para enfriar; parado, todo depende del electroventilador. Con A/C, además, el condensador le calienta el aire al radiador. Con el scanner fijate si el ventilador arranca cerca de los 98 °C y probalo con la prueba de actuadores.",
      topic: "Refrigeración",
    },
    {
      q: "Con el scanner ves que el ECT sube despacio y en ruta, con 10 °C afuera, no pasa de 65 °C. La calefacción sale tibia y hay un P0128. ¿Qué es lo más probable?",
      opts: ["Termostato trabado abierto", "Termostato trabado cerrado", "Tapa del radiador vencida", "Electroventilador que no arranca"],
      correct: 0,
      explain: "Si el termostato queda abierto, el agua pasa siempre por el radiador y en ruta con frío el motor no llega a temperatura. P0128 significa justamente que el refrigerante no llega a la temperatura de regulación del termostato en el tiempo esperado.",
      topic: "Termostato",
    },
    {
      q: "Con una tapa de 1,2 bar en buen estado, el refrigerante (agua sola) hierve cerca de 120 °C a nivel del mar. ¿Qué pasa si el resorte de la tapa está vencido y subís a Las Cuevas (≈ 3.150 m)?",
      opts: ["Nada: el punto de ebullición no depende de la presión", "Hierve a unos 90 °C, justo en la temperatura de trabajo del motor", "Hierve a más de 130 °C porque hace frío", "Hierve a 100 °C como siempre"],
      correct: 1,
      explain: "Sin la presión de la tapa queda sólo la atmosférica, que en Las Cuevas es de unos 0,69 bar: el agua hierve cerca de 89–90 °C (el glicol le suma unos 7 °C). Una tapa vencida que en el llano no se nota te deja tirado subiendo la cordillera.",
      topic: "Punto de ebullición",
    },
    {
      q: "Hacés la prueba de presión en frío: llevás el sistema a 1,2 bar y en 10 minutos baja a 0,6 bar. No hay goteos visibles ni manchas, y la bujía del cilindro 3 sale limpia como recién lavada. ¿Qué sospechás?",
      opts: ["Tapa del radiador mala", "El refrigerante pasa al cilindro 3: junta de tapa o fisura", "Bomba de agua con paletas rotas", "Termostato trabado"],
      correct: 1,
      explain: "Si la presión cae y el líquido no sale afuera, se está yendo hacia adentro. Una bujía 'lavada' (el vapor de agua la limpia) en un cilindro apunta a junta de tapa o fisura en ese cilindro. Confirmalo con la prueba de CO₂ y una prueba de pérdidas en ese cilindro.",
      topic: "Diagnóstico",
    },
    {
      q: "¿Por qué no hay que completar el depósito de expansión hasta el tope con el motor caliente?",
      opts: ["Porque el refrigerante caliente es más pesado", "Porque al enfriarse se contrae y el nivel queda bajo; el nivel correcto se mira en frío entre MIN y MAX", "Porque se arruina el termostato", "No hay problema, es lo recomendado"],
      correct: 1,
      explain: "La mezcla se dilata alrededor de 0,06 % por grado: en un sistema de 6 litros son casi 300 cm³ entre frío y caliente. Además, abrir la tapa en caliente es peligroso: el líquido a presión hierve de golpe y quema.",
      topic: "Refrigerante",
    },
    {
      q: "Un motor con 200.000 km prende el testigo de aceite en ralentí cuando está bien caliente, y se apaga al acelerar. Con el manómetro: 0,3 bar en ralentí caliente y 1,6 bar a 3.000 rpm. ¿Qué indica?",
      opts: ["El presostato está mal, la presión es perfecta", "Luces grandes en los metales (desgaste) o aceite diluido: el aceite se escapa fácil en caliente y la presión cae", "Filtro de aceite tapado con el by-pass abierto", "Exceso de aceite en el cárter"],
      correct: 1,
      explain: "La bomba da caudal; la presión aparece porque ese caudal tiene que escaparse por las luces. Con metales gastados (más luz) y aceite caliente (más fino) la presión cae, sobre todo en ralentí. Valores típicos sanos: 0,5–1 bar o más en ralentí caliente y 2–4 bar a 2.000–3.000 rpm.",
      topic: "Presión de aceite",
    },
    {
      q: "Encontrás una mayonesa marrón clara sólo debajo de la tapa de aceite. El auto se usa en invierno para viajes de 10 minutos, el nivel de refrigerante no baja y la varilla está limpia. ¿Qué es lo más probable?",
      opts: ["Junta de tapa quemada seguro", "Condensación del vapor de agua de la combustión por viajes cortos en frío", "Enfriador de aceite roto", "Aceite de mala calidad"],
      correct: 1,
      explain: "En viajes cortos con frío el motor no llega a secar la humedad y se condensa en la parte más fría (la tapa de válvulas). Si no baja el refrigerante, no hay mayonesa en la varilla y la prueba de CO₂ da negativa, no es la junta. Una ruta larga la seca.",
      topic: "Diagnóstico",
    },
    {
      q: "En el cigüeñal, ¿qué separa el muñón del metal cuando el motor gira?",
      opts: ["Nada: el muñón apoya sobre el metal blando", "Una película de aceite de pocos micrones que se genera por la cuña hidrodinámica", "Rodillos de acero", "La presión del manómetro, unos 3 bar"],
      correct: 1,
      explain: "El muñón arrastra aceite hacia la zona donde la luz se achica y ahí la presión de la película sube a decenas o cientos de MPa: el eje flota. El espesor mínimo es h = c·(1 − ε), de pocos micrones. Por eso la carga alta a pocas vueltas, el aceite diluido y los arranques en frío son los que desgastan.",
      topic: "Lubricación",
    },
  ],

  "motor-turbo": [
    {
      q: "Una turbodiesel pierde fuerza en las subidas. En el scanner, a plena carga, el soplado pedido es 1,2 bar y el real llega a 0,5 bar; se escucha un silbido y hay P0299. ¿Qué revisás primero?",
      opts: ["El catalizador", "Mangueras y abrazaderas entre el turbo, el intercooler y el múltiple", "La sonda lambda de atrás", "Los inyectores"],
      correct: 1,
      explain: "P0299 es subalimentación: el turbo no llega a la presión pedida. Lo más común es una pérdida en el lado de presión (manguera floja o rota, intercooler perforado por piedras). Se confirma presurizando la admisión o con máquina de humo. Después: wastegate o paletas trabadas abiertas y su control.",
      topic: "Turbo",
    },
    {
      q: "La ECU pide 2,1 bar absolutos en el múltiple. ¿Cuánto marca un manómetro de soplado (presión relativa) en el Gran Mendoza (≈ 0,925 bar) y en Las Cuevas (≈ 0,69 bar)?",
      opts: ["2,1 bar en los dos lugares", "≈ 1,18 bar en Mendoza y ≈ 1,41 bar en Las Cuevas", "≈ 1,41 bar en Mendoza y ≈ 1,18 bar en Las Cuevas", "1 bar en los dos lugares"],
      correct: 1,
      explain: "Soplado = presión absoluta − atmosférica. Arriba hay menos presión atmosférica, así que para lograr la misma presión absoluta el turbo tiene que soplar más (comprimir 3 veces en vez de 2,3) y girar más rápido, hasta su límite de vueltas.",
      topic: "Presión",
    },
    {
      q: "¿Para qué sirve el intercooler?",
      opts: ["Para enfriar el aceite del turbo", "Para enfriar el aire que calentó el compresor, así entra más denso (más aire en el mismo volumen) y se aleja la detonación", "Para calentar el aire en invierno", "Para filtrar el aire"],
      correct: 1,
      explain: "Comprimir calienta: con relación 2,2 el aire sale del compresor a unos 130–140 °C. El intercooler lo baja a unos 50–60 °C; a la misma presión, eso es un 20–25 % más de densidad. En nafta además aleja la detonación y en diesel baja los NOx.",
      topic: "Intercooler",
    },
    {
      q: "Un turbo 'tira aceite': hay aceite en la manguera del intercooler y humo azul. Antes de cambiarlo, ¿qué conviene revisar?",
      opts: ["Nada, es el turbo seguro", "El retorno de aceite del turbo (tapado o doblado), la presión del cárter (respiradero) y el filtro de aire tapado", "La bomba de nafta", "La sonda lambda"],
      correct: 1,
      explain: "El eje del turbo no sella con retenes de goma sino con aros que necesitan presión equilibrada. Un retorno tapado, presión en el cárter o un filtro de aire tapado (depresión en la entrada del compresor) hacen pasar aceite aunque el turbo esté sano. Si cambiás el turbo sin corregir eso, el nuevo también tira aceite.",
      topic: "Turbo",
    },
    {
      q: "Revisando el turbo con el motor frío, el eje tiene un poco de juego radial pero casi nada de juego axial, gira libre y la rueda no toca la carcasa. ¿Qué concluís?",
      opts: ["Está para cambiar: no debe tener ningún juego", "Es normal: los cojinetes son flotantes y con aceite se centran; lo grave sería juego axial notable o roce con la carcasa", "Hay que ajustar la tuerca del eje", "Tiene la wastegate trabada"],
      correct: 1,
      explain: "Un poco de juego radial es normal en cojinetes flotantes. El juego axial tiene que ser casi nulo (centésimas de mm, según fabricante) y la rueda nunca debe rozar la carcasa ni tener álabes comidos o doblados.",
      topic: "Turbo",
    },
    {
      q: "Un naftero pierde fuerza en ruta y se calienta. En ralentí el vacuómetro marca normal, pero a 2.500 rpm sostenidas la aguja cae lentamente. ¿Qué sospechás?",
      opts: ["Válvula de escape quemada", "Escape restringido: catalizador tapado o derretido", "Mariposa sucia", "Aros gastados"],
      correct: 1,
      explain: "Si los gases no pueden salir, se acumulan y el vacío cae a vueltas sostenidas. Confirmalo midiendo la contrapresión en el agujero de la sonda de adelante (referencia: menos de 0,1 bar a 2.500 rpm) y comparando temperaturas de entrada y salida del catalizador.",
      topic: "Escape",
    },
    {
      q: "En un auto con P0420, mirás las dos sondas lambda con el motor caliente en lazo cerrado. ¿Qué esperás ver si el catalizador está realmente agotado?",
      opts: ["La de atrás fija en 0 V", "La de atrás copiando las oscilaciones de la de adelante (0,1 ↔ 0,9 V)", "Las dos fijas en 0,45 V", "La de adelante fija y la de atrás oscilando"],
      correct: 1,
      explain: "Un catalizador sano guarda y suelta oxígeno, así que amortigua las oscilaciones de la mezcla y la sonda de atrás queda estable cerca de 0,6–0,7 V. Agotado, ya no amortigua y la de atrás copia a la de adelante. Antes de cambiarlo, descartá pérdidas en el escape y una sonda de atrás vieja.",
      topic: "Catalizador",
    },
    {
      q: "¿Por qué una camioneta turbodiesel pierde mucho menos potencia que una atmosférica al subir a la cordillera?",
      opts: ["Porque el gasoil tiene más energía arriba", "Porque la ECU del turbo busca una presión absoluta en el múltiple: el turbo gira más rápido para compensar el aire más liviano, hasta su límite de vueltas", "Porque el diesel no necesita aire", "Porque el intercooler calienta el aire"],
      correct: 1,
      explain: "El atmosférico pierde alrededor de 1 % cada 100 m (en Las Cuevas, un tercio). El turbo compensa casi todo hasta llegar a su velocidad máxima; recién ahí la ECU baja el pedido y la potencia empieza a caer, y aun así pierde mucho menos.",
      topic: "Mendoza",
    },
  ],
};

export default q;
