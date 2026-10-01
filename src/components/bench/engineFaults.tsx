/* Textos del banco "Motor + scanner": qué es cada falla, qué hace la ECU, qué mirar y cómo confirmarla. */
import type { ReactNode } from "react";
import type { FaultId } from "./engineModel";

export interface FaultInfo {
  id: FaultId;
  name: string;
  icon: string;
  short: string;
  /** lo que cuenta el cliente (modo diagnóstico) */
  cliente: string;
  /** qué está pasando electrónicamente */
  ecu: ReactNode;
  ver: string[];
  codigos: string;
  confirmar: string[];
  pista: string;
  confusables: FaultId[];
}

export const FAULTS: Record<FaultId, FaultInfo> = {
  none: {
    id: "none", name: "Motor sano", icon: "✅",
    short: "Sin fallas: así se ve un 1.6 multipunto en buen estado.",
    cliente: "",
    ecu: (
      <>
        <p>
          Con el motor caliente la ECU trabaja en <b>lazo cerrado</b>: calcula la nafta con el aire que mide el caudalímetro (MAF), mira la
          sonda lambda y va corrigiendo un poquito para un lado y para el otro. Por eso la sonda <b>conmuta</b> entre ≈ 0,1 V (pobre) y
          ≈ 0,8 V (rica) y la corrección de corto plazo (STFT) oscila alrededor de 0.
        </p>
        <p>
          En ralentí la ECU sostiene las vueltas moviendo la mariposa motorizada (lento) y el avance (rápido). Al soltar el acelerador desde
          arriba corta la inyección (<b>corte en desaceleración</b>: 0 ms, sonda abajo). A fondo deja de mirar la sonda y enriquece (lazo
          abierto) para cuidar el motor y sacar potencia.
        </p>
      </>
    ),
    ver: [
      "STFT y LTFT dentro de ±10 %",
      "Sonda lambda conmutando 0,1–0,9 V (≥ 1 vez por segundo a 2.500 rpm)",
      "Ralentí estable ≈ 800 rpm caliente (≈ 1.100–1.200 en frío)",
      "Fallos de encendido en 0",
    ],
    codigos: "ninguno",
    confirmar: [],
    pista: "",
    confusables: [],
  },
  vacio: {
    id: "vacio", name: "Pérdida de vacío", icon: "💨",
    short: "Una manguera fisurada deja entrar aire que el caudalímetro no midió.",
    cliente: "El ralentí está medio inestable y en frío le cuesta un poco. En la ruta anda bien. Se prendió el check.",
    ecu: (
      <>
        <p>
          El caudalímetro (MAF) mide el aire que pasa por él. El aire que entra por la fisura <b>no pasa por el MAF</b>: la ECU calcula nafta
          para menos aire del que de verdad entra y la mezcla queda <b>pobre</b>.
        </p>
        <p>
          La sonda lo ve (pasa más tiempo abajo) y la ECU suma nafta con la corrección de corto plazo (STFT). Como el error no se va, lo
          “aprende” en la de largo plazo (LTFT). En ralentí el aire falso es una parte grande del total (≈ 25–30 %): las correcciones se van a
          +25/+35 %. Al acelerar, el aire medido crece mucho y la fisura pasa más o menos lo mismo, así que el error en % se achica y las
          correcciones vuelven cerca de 0. <b>Esa es la firma de una toma de aire.</b>
        </p>
        <p>
          El control de ralentí cierra la mariposa para no pasarse de vueltas (TPS más bajo que en un motor sano) y el MAF marca menos g/s.
          Cuando la suma STFT + LTFT pasa ≈ +23 % un rato, la ECU guarda <b>P0171</b>.
        </p>
      </>
    ),
    ver: [
      "STFT + LTFT muy positivos en ralentí (+25 % o más)",
      "Correcciones que bajan casi a 0 a 2.500 rpm o con carga",
      "MAF en ralentí más bajo que lo normal (≈ 1,8 g/s en vez de 2,4)",
      "Mariposa (TPS) en ralentí más cerrada",
    ],
    codigos: "P0171 (si la fisura es grande, al principio puede fallar el cilindro más cercano: P0300/P0301 pendiente)",
    confirmar: [
      "Escuchá: muchas veces silba.",
      "Máquina de humo en la admisión: el humo sale por la fisura (la prueba más segura).",
      "Con el motor en ralentí, rociá con cuidado limpiador alrededor de mangueras y juntas: si suben las rpm o la STFT baja de golpe, la encontraste. Es inflamable: lejos del escape caliente.",
      "Vacuómetro: en ralentí marca menos y oscila.",
    ],
    pista: "Compará las correcciones (STFT + LTFT) en ralentí y a 2.500 rpm.",
    confusables: ["maf", "nafta", "inyector3", "sonda"],
  },
  inyector3: {
    id: "inyector3", name: "Inyector 3 tapado", icon: "🧪",
    short: "El inyector del cilindro 3 tira menos nafta de la que manda la ECU (sucio, filtrito de entrada tapado).",
    cliente: "Le falta fuerza, tironea en las subidas y en ralentí vibra un poco. Se prendió el check.",
    ecu: (
      <>
        <p>
          La ECU manda el mismo pulso a los cuatro inyectores, pero el 3 entrega ≈ 70 % de lo que debería: ese cilindro trabaja <b>pobre</b>
          (λ ≈ 1,3). Una mezcla pobre se enciende peor y <b>con carga</b> (más presión dentro del cilindro) falla más seguido.
        </p>
        <p>
          Cada fallo se nota como una frenada del cigüeñal justo en el turno del cilindro 3. La ECU lo ve con el sensor de rpm (CKP), lo
          cuenta en ese cilindro y guarda <b>P0303</b>.
        </p>
        <p>
          La sonda ve el escape de los cuatro mezclado: un poco pobre. La ECU agrega nafta a <b>todos</b> (LTFT ≈ +7 a +12 %): los otros tres
          quedan algo ricos y el 3 sigue pobre. Corregir el promedio no arregla un cilindro. Si la corrección pasa ≈ +23 % también puede
          aparecer P0171.
        </p>
      </>
    ),
    ver: [
      "Contador de fallos del cilindro 3 que sube, más rápido con carga",
      "LTFT positiva moderada (+7 a +12 %)",
      "RPM de ralentí que bailan",
      "Balance: el cilindro 3 cae menos que los demás (está flojo, no muerto)",
    ],
    codigos: "P0303 (a veces también P0171)",
    confirmar: [
      "Intercambiá el inyector 3 con el de otro cilindro: si el fallo se muda, es el inyector.",
      "Medí la resistencia (12–16 Ω) y mirá el pulso con el osciloscopio: si la parte eléctrica está bien y falla igual, está tapado.",
      "Banco de limpieza de inyectores con probetas: comparás caudal y forma del chorro.",
    ],
    pista: "¿En qué cilindro hay fallos y cuándo aumentan? ¿La corrección de mezcla es grande o moderada?",
    confusables: ["bobina2", "vacio", "nafta"],
  },
  bobina2: {
    id: "bobina2", name: "Bobina / bujía cil. 2", icon: "⚡",
    short: "La chispa del cilindro 2 no salta bien (bobina con fuga, bujía gastada o fisurada).",
    cliente: "Vibra mucho en ralentí, como si anduviera en tres. Cuando acelero fuerte la luz del motor titila.",
    ecu: (
      <>
        <p>
          Sin chispa no hay combustión: el cilindro 2 aspira aire y nafta y los tira <b>sin quemar</b> al escape. La ECU ve la frenada del
          cigüeñal en el turno del cilindro 2 y guarda <b>P0302</b>. Si los fallos son tantos que pueden <b>dañar el catalizador</b>, la luz
          de check <b>titila</b>: es el aviso de “no lo exijas”.
        </p>
        <p>
          El oxígeno que no se quemó llega a la sonda: marca pobre aunque la mezcla no lo sea. La ECU agrega nafta (LTFT +10 a +15 %) y es
          peor: los otros cilindros quedan ricos y la nafta cruda del 2 se quema dentro del catalizador, que <b>se recalienta</b>.
        </p>
        <p>Con carga hace falta más tensión para que salte la chispa: una bobina débil falla todavía más.</p>
      </>
    ),
    ver: [
      "Contador del cilindro 2 subiendo rápido",
      "Ralentí muy desparejo",
      "Temperatura del catalizador alta",
      "LTFT positiva aunque no falte nafta",
      "Balance: el cilindro 2 casi no cae",
    ],
    codigos: "P0302 (check titilando si es grave)",
    confirmar: [
      "Intercambiá la bobina del 2 con la del 3: si el código pasa a P0303 es la bobina; si no, mirá la bujía.",
      "Sacá la bujía: luz, electrodo, porcelana fisurada o con marcas de chispa.",
      "Osciloscopio en el primario o en el secundario de la bobina.",
      "Probador de chispa regulable (nunca acercar el cable a masa con la mano).",
    ],
    pista: "Hay un cilindro que casi no aporta. Mirá también la temperatura del catalizador.",
    confusables: ["inyector3", "vacio", "nafta"],
  },
  termostato: {
    id: "termostato", name: "Termostato trabado abierto", icon: "🌡️",
    short: "El termostato no cierra: el agua va siempre al radiador y el motor no llega a temperatura.",
    cliente: "La calefacción tira aire tibio, la aguja de temperatura queda baja y gasta más que antes.",
    ecu: (
      <>
        <p>
          El termostato no es eléctrico: la ECU se entera a través del sensor de temperatura (ECT). Con el termostato abierto, la ECT queda
          en ≈ 60–75 °C en ralentí y baja todavía más andando, con el viento.
        </p>
        <p>
          La ECU cree que el motor está tibio: mantiene el ralentí más alto, enriquece en aceleraciones y en lazo abierto, y el
          electroventilador no arranca nunca. Resultado: más consumo y más desgaste.
        </p>
        <p>
          El monitor del termostato espera que, después de cierto tiempo andando, la ECT pase un valor (≈ 70–75 °C). Si no llega, guarda
          <b> P0128</b>.
        </p>
      </>
    ),
    ver: [
      "ECT que se estanca en 60–75 °C (y baja en el banco de rodillos)",
      "Ralentí algo alto (≈ 850–950 rpm)",
      "Electroventilador siempre apagado",
    ],
    codigos: "P0128",
    confirmar: [
      "Arrancá en frío y tocá con cuidado la manguera de arriba del radiador: si se calienta enseguida, el termostato está abierto.",
      "Termómetro infrarrojo en la carcasa del termostato y en las mangueras.",
      "Comprobá que la ECT diga la verdad (termómetro): si el sensor está bien y el motor está frío de verdad, es el termostato.",
      "Sacalo y probalo en agua caliente con termómetro: tiene que empezar a abrir a la temperatura grabada (82–95 °C).",
    ],
    pista: "¿Hasta qué temperatura llega el motor? Probá arrancar en frío y graficá la ECT.",
    confusables: ["ect", "sonda", "alternador"],
  },
  ect: {
    id: "ect", name: "Sensor ECT desconectado", icon: "🔌",
    short: "La ficha del sensor de temperatura del refrigerante está suelta o el cable está cortado.",
    cliente: "El electroventilador queda prendido siempre, el ralentí está alto, hay olor a nafta y gasta mucho. Check prendido.",
    ecu: (
      <>
        <p>
          El ECT es un termistor NTC: la ECU le manda 5 V a través de una resistencia y lee la tensión que queda. Frío = mucha resistencia =
          tensión alta; caliente = poca resistencia = tensión baja.
        </p>
        <p>
          Con el circuito abierto la ECU lee <b>5 V</b>: lo mismo que un motor a <b>−40 °C</b>. Imposible para un motor que viene andando:
          guarda <b>P0118</b> (señal alta). Si el cable estuviera en corto a masa leería ≈ 0 V, unos +140 °C, y guardaría P0117.
        </p>
        <p>
          Estrategia de emergencia: prende el <b>electroventilador a full</b> (por si el motor se recalienta), usa un valor de reemplazo “de
          motor frío” y <b>no entra en lazo cerrado</b>. Resultado: mezcla rica (sonda clavada arriba), STFT en 0 y ralentí alto.
        </p>
      </>
    ),
    ver: [
      "ECT = −40 °C y señal ECT ≈ 5 V",
      "Lazo abierto aunque el motor esté caliente",
      "Sonda lambda fija arriba (≈ 0,9 V: rica)",
      "Electroventilador encendido siempre",
      "Ralentí ≈ 1.100 rpm",
    ],
    codigos: "P0118 (circuito abierto) — P0117 si está en corto",
    confirmar: [
      "Revisá la ficha y los pines (verdín, traba rota).",
      "Con contacto, medí en la ficha del lado del mazo: ≈ 5 V entre señal y masa del sensor (la ECU está bien).",
      "Medí el sensor: ≈ 2–3 kΩ a 20 °C y ≈ 200–300 Ω a 90 °C.",
      "Puente de prueba entre los dos cables de la ficha: la lectura tiene que irse a ≈ +140 °C.",
    ],
    pista: "Mirá la temperatura que lee la ECU. ¿Es posible con el motor andando hace rato?",
    confusables: ["termostato", "sonda", "maf"],
  },
  maf: {
    id: "maf", name: "Caudalímetro (MAF) sucio", icon: "🌫️",
    short: "El elemento caliente del MAF tiene polvo o aceite: mide menos aire del que pasa.",
    cliente: "Le falta fuerza arriba, en las subidas no tira y a veces da tirones. Se prendió el check.",
    ecu: (
      <>
        <p>
          El MAF de película caliente mide el aire por cuánto se enfría un elemento calefaccionado. Sucio, se enfría menos y <b>marca menos
          aire</b> del real, sobre todo cuando pasa mucho aire.
        </p>
        <p>
          La ECU calcula la nafta con ese dato: menos nafta, mezcla pobre — poco en ralentí y mucho con carga. Las correcciones suben <b>con
          la carga</b> (al revés que una pérdida de vacío) y la carga calculada queda baja para esa apertura de mariposa.
        </p>
        <p>
          La ECU compara el MAF con lo que “debería” entrar según MAP, rpm y temperatura: si no cierra, guarda <b>P0101</b>; si la corrección se
          pasa, <b>P0171</b>. A fondo trabaja en lazo abierto: no corrige con la sonda, queda pobre y pierde potencia.
        </p>
      </>
    ),
    ver: [
      "MAF bajo con carga (a fondo no llega a los g/s esperados)",
      "Carga calculada baja a plena carga (≈ 65 % en vez de ≈ 90 %)",
      "Correcciones que suben con la carga",
      "MAP normal: el aire entra, pero el MAF no lo cuenta",
    ],
    codigos: "P0101 y P0171",
    confirmar: [
      "Regla práctica: un 1.6 en ralentí ≈ 2–4 g/s; a fondo con carga ≈ 0,8 g/s por cada CV del motor.",
      "Mirá el elemento: polvo, aceite (filtro aceitado), filtro mal colocado.",
      "Limpialo sólo con limpiador específico para MAF, sin tocar el elemento, y volvé a medir.",
      "Desconectalo: si el motor anda mejor (la ECU pasa a un valor calculado), el MAF miente.",
    ],
    pista: "¿Las correcciones suben o bajan con la carga? Compará la carga calculada a fondo con la de un motor sano.",
    confusables: ["vacio", "nafta", "catalizador"],
  },
  sonda: {
    id: "sonda", name: "Sonda lambda vieja", icon: "🐢",
    short: "La sonda de antes del catalizador está gastada o contaminada: responde lento y con poca amplitud.",
    cliente: "Gasta un poco más y en la RTO salió mal la medición de gases. El check se prende y se apaga.",
    ecu: (
      <>
        <p>
          La sonda de banda angosta funciona casi como un interruptor: ≈ 0,1 V con mezcla pobre y ≈ 0,9 V con mezcla rica. La ECU la usa
          para ir corrigiendo para un lado y para el otro alrededor de λ = 1.
        </p>
        <p>
          Una sonda vieja (plomo, silicona, aceite, años) <b>tarda en cambiar</b> y no llega a los extremos: en vez de 0,1–0,9 V oscila entre
          ≈ 0,3 y 0,6 V y mucho más despacio. La ECU corrige con retraso, la mezcla oscila de más y el catalizador trabaja peor.
        </p>
        <p>El monitor de la sonda mide cuánto tarda en pasar de pobre a rica y cuántas veces cambia: si es lenta, guarda <b>P0133</b>.</p>
      </>
    ),
    ver: [
      "Sonda entre ≈ 0,3 y 0,6 V, cambios lentos",
      "Menos de 1 cambio por segundo a 2.500 rpm",
      "Correcciones normales (la mezcla promedio está bien)",
    ],
    codigos: "P0133",
    confirmar: [
      "Osciloscopio a 2.500 rpm: tiene que ir de menos de 0,2 V a más de 0,8 V, al menos 1 vez por segundo, con flancos rápidos.",
      "Acelerón: tiene que saltar a más de 0,8 V enseguida. Corte en desaceleración: tiene que caer a menos de 0,2 V.",
      "Medí el calentador (≈ 2–20 Ω) y que le lleguen 12 V: una sonda fría también es lenta.",
      "Buscá por qué se contaminó (consumo de aceite, refrigerante, siliconas).",
    ],
    pista: "Graficá la sonda lambda: mirá cuánto sube y baja y qué tan rápido.",
    confusables: ["maf", "vacio", "catalizador"],
  },
  nafta: {
    id: "nafta", name: "Presión de nafta baja", icon: "⛽",
    short: "La bomba está débil o el filtro tapado: la presión cae cuando el motor pide más nafta.",
    cliente: "A fondo se queda, en la subida a Uspallata tironea. En la ciudad anda casi bien.",
    ecu: (
      <>
        <p>
          En un multipunto común la ECU <b>no mide</b> la presión de nafta: supone que hay 3–4 bar. El tiempo de inyección es el correcto,
          pero con menos presión cada inyector tira menos nafta.
        </p>
        <p>
          En ralentí la bomba alcanza; cuanto más caudal se pide, más cae la presión y más se empobrece la mezcla. En carga parcial la
          sonda lo ve y las correcciones suben mucho (<b>P0171</b>). A fondo la ECU trabaja en lazo abierto: no corrige, la mezcla queda muy
          pobre y aparecen fallos en varios cilindros (<b>P0300</b>) y falta de potencia.
        </p>
      </>
    ),
    ver: [
      "Correcciones que suben con la carga (parecido al MAF sucio)…",
      "…pero el MAF y la carga calculada son normales",
      "A fondo: sonda pobre (≈ 0,1 V) en lazo abierto y fallos repartidos",
      "Presión de nafta baja (sólo con manómetro)",
    ],
    codigos: "P0171 (y P0300 a fondo)",
    confirmar: [
      "Manómetro en la rampa: ≈ 3–4 bar (según fabricante) en ralentí y tiene que mantenerse a fondo.",
      "Prueba de caudal: cuánta nafta entrega la bomba en 15–30 s en una probeta.",
      "Medí la tensión en la bomba funcionando (caída en cables, relé o masa).",
      "Cambiá el filtro de nafta si no se sabe cuándo se cambió.",
    ],
    pista: "Si las correcciones suben con carga, fijate si el MAF lee bien. Y acordate de lo que el scanner no ve.",
    confusables: ["maf", "vacio", "inyector3", "catalizador"],
  },
  catalizador: {
    id: "catalizador", name: "Catalizador tapado", icon: "🧱",
    short: "El monolito del catalizador está derretido o tapado: el escape no puede salir.",
    cliente: "No levanta, no pasa de 3.000–4.000 vueltas y en la cordillera no tiene fuerza. A veces huele a huevo podrido. No tiene check.",
    ecu: (
      <>
        <p>
          Es una falla <b>mecánica</b> y muchas veces <b>no deja código</b>: la ECU no tiene un sensor de presión de escape.
        </p>
        <p>
          Los gases no salen, queda gas quemado en el cilindro y entra menos mezcla nueva. Para la misma apertura de mariposa la presión del
          múltiple (MAP) queda alta (el vacío baja) y la potencia cae. En ralentí casi no se nota (pasa poco caudal); al subir de vueltas la
          contrapresión crece con el cuadrado del caudal: el motor no pasa de ≈ 4.000 rpm y en el banco no hace fuerza.
        </p>
        <p>Las correcciones de mezcla están normales: la mezcla está bien, lo que le falta al motor es <b>respirar</b>.</p>
      </>
    ),
    ver: [
      "Sin códigos",
      "MAP alto (vacío bajo) a 2.500 rpm sin carga",
      "RPM máximas limitadas en punto muerto",
      "Torque y potencia muy bajos en el banco de rodillos",
      "Correcciones normales",
    ],
    codigos: "generalmente ninguno",
    confirmar: [
      "Vacuómetro: en ralentí casi normal; a 2.500 rpm sostenidas el vacío baja en vez de mantenerse.",
      "Manómetro de contrapresión en el agujero de la sonda de adelante: a 2.500 rpm, más de ≈ 0,2 bar (3 psi) es sospechoso.",
      "Infrarrojo antes y después del catalizador y golpecitos para escuchar si el monolito está suelto.",
      "Buscá la causa: fallos de encendido o consumo de aceite derriten el catalizador.",
    ],
    pista: "¿Hay códigos? Subí las vueltas en punto muerto y compará el MAP y las rpm máximas con un motor sano.",
    confusables: ["maf", "nafta", "sonda"],
  },
  alternador: {
    id: "alternador", name: "Alternador que no carga", icon: "🔋",
    short: "Regulador, diodos o escobillas del alternador fallados (o correa que patina).",
    cliente: "Se prendió la luz de la batería y después el check. Al otro día casi no arranca.",
    ecu: (
      <>
        <p>
          Sin alternador, todo el auto vive de la batería: la tensión cae de ≈ 12,6 V hacia 12 V y menos a medida que se descarga.
        </p>
        <p>
          La ECU mide su propia alimentación (“tensión de módulo”): si queda debajo de ≈ 12 V con el motor andando, guarda <b>P0562</b>. La luz
          de batería del tablero no la prende la ECU: la prende el circuito del alternador.
        </p>
        <p>
          La ECU compensa lo que puede: alarga el tiempo de inyección (con menos tensión el inyector tarda más en abrir), alarga la carga de
          la bobina y sube un poco el ralentí. Con menos de ≈ 10,5–11 V empiezan los fallos de encendido y al final el motor se para.
        </p>
      </>
    ),
    ver: [
      "Tensión de módulo 12,4 V y bajando (tiene que estar en 13,8–14,7 V)",
      "Ralentí un poco más alto",
      "Tiempo de inyección apenas más largo",
    ],
    codigos: "P0562",
    confirmar: [
      "Tester en la batería: motor parado ≈ 12,6 V; en marcha 13,8–14,7 V. Si en marcha da lo mismo que parado, no carga.",
      "Caída de tensión en el cable B+ y en la masa del alternador (≤ 0,2–0,3 V).",
      "Revisá la correa y el tensor.",
      "Osciloscopio: el ripple del alternador muestra enseguida un diodo quemado.",
    ],
    pista: "Mirá la tensión de módulo con el motor en marcha.",
    confusables: ["sonda", "termostato", "ect"],
  },
};
