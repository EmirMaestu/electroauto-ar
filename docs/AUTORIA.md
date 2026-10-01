# Cómo escribir contenido para Fierros

Guía para sumar lecciones, animaciones y preguntas. Si seguís esto, todo se ve y se maneja igual en todo el sitio.

## 1. Dónde va cada cosa

| Qué | Dónde | Notas |
|---|---|---|
| Mapa del curso (partes, lecciones, quiz de cada lección) | `src/content/registry.ts` | Una lección `kind: "mdx"` busca su archivo en `src/content/lessons/<parte>/<leccion>.mdx` |
| Texto de una lección | `src/content/lessons/<parte>/<id>.mdx` | MDX = Markdown + componentes |
| Animaciones | `src/components/anim/<Nombre>.tsx` | **Toda función exportada con mayúscula queda disponible en todas las lecciones**, sin importar nada |
| Preguntas | `src/content/quizzes/<tema>.quiz.ts` | `export default { "id-del-quiz": [ ...preguntas ] }`. El quiz se agrega solo al final de la lección (no pongas `<Quiz>` en el MDX) |
| Herramientas | `src/content/tools.ts` | Se enlazan desde las lecciones con `<Herramientas ids={[...]} />` |
| Glosario | `src/content/glossary.ts` | `<Term t="PMS" />` muestra la definición |

## 2. El tono

- **Rioplatense, con voseo**: “fijate”, “medí”, “si el auto no arranca, lo primero que hacés es…”.
- **Como lo explicaría alguien con paciencia en el taller**, no como un libro. Frases cortas. Una idea por párrafo.
- **Vocabulario de taller argentino**: nafta (no gasolina), gasoil, cubierta (no neumático), llanta = el aro de metal, tapa de cilindros (no culata), junta de tapa, árbol de levas, aros, metales (cojinetes), bulón, múltiple de admisión/escape, mariposa, sonda lambda, burro de arranque, masa, ficha/conector, tester, scanner, crique, caballete, caja de cambios (no transmisión manual), embrague (no clutch), freno de mano, varilla de aceite, correa de distribución, bujía, bobina.
- Cada término técnico se explica **la primera vez** que aparece (o con `<Term>`).
- Nada de relleno. Si una frase no enseña nada, afuera.
- **Contenido original.** El Bosch Automotive Handbook es la referencia del temario: no se copia ni se traduce literal su texto ni sus figuras. Se explica con palabras propias y se dibuja todo de cero.
- **Valores**: siempre como rangos típicos (“suele andar entre 3 y 4 bar”) y recordando que manda el dato del fabricante. Nada de inventar números exactos de un modelo puntual si no estás seguro.

## 3. Estructura de una lección

1. **Gancho (sin título)**: 1–3 párrafos. ¿Por qué te importa esto? Una situación real del taller o de la calle.
2. **Secciones `##`** que van de lo simple a lo complejo. Intercalá animaciones donde ayudan a entender (no todas al final).
3. **Lo técnico**: `<Formula>` con sus variables y un `<Ejemplo>` resuelto con números reales (un motor 1.6 de 4 cilindros, una Hilux 2.8, un Gol, un Logan…).
4. **En el taller** (`<EnElTaller>`): qué se revisa, qué se cambia, cada cuánto, qué errores comete la gente.
5. **Qué pasa electrónicamente** (`<Electronica>`): qué sensor lo ve, qué hace la ECU, qué aparece en el scanner, qué código de falla se puede guardar.
6. **Qué medir** (`<Mediciones>` con varias `<Medicion>`): punto, valor esperado, cómo medirlo, interpretación.
7. **Herramientas** (`<Herramientas ids={[...]} />`).
8. **Fallas típicas**: síntoma → causa probable → cómo confirmarlo. Una tabla Markdown o una lista.
9. **En Mendoza** (`<Mendoza>`) sólo cuando de verdad aplica: altura (≈750 m en el Gran Mendoza, 1.900 m en Uspallata, más de 3.000 m en el Paso Cristo Redentor), calor de verano, zonda y tierra, ripio, frío de Alta Montaña, mucho GNC.
10. **Seguridad** con `<Peligro>` u `<Ojo>` cuando corresponda.
11. **`<PuntosClave>`** con una lista numerada de 5 a 8 ideas.

Extensión orientativa: 1.800 a 3.500 palabras, 2 a 4 animaciones por lección.

## 4. Componentes disponibles en MDX

```mdx
<Dato title="opcional">Texto…</Dato>          // 💡 azul
<Tip>…</Tip>                                   // ✅ verde
<Ojo>…</Ojo>                                   // ⚠️ amarillo
<Peligro>…</Peligro>                           // ⛔ rojo
<EnElTaller>…</EnElTaller>                     // 🔧 naranja
<Electronica>…</Electronica>                   // 🧠 violeta
<Mendoza>…</Mendoza>                           // 🏔️ verde agua
<Analogia>…</Analogia>                         // 🗣️ gris

<Formula name="Cilindrada" vars={{ "Vh": "volumen de un cilindro [cm³]", "d": "diámetro [cm]" }}>
  V<sub>h</sub> = π/4 · d² · s
</Formula>

<Ejemplo title="Cilindrada de un 1.6">
Un motor con diámetro 79,5 mm y carrera 80,5 mm…

<Calc>Vh = 0,785 × 7,95² × 8,05 = 399,6 cm³</Calc>

Resultado: <Res>≈ 1.598 cm³</Res>
</Ejemplo>

<Mediciones title="opcional">
  <Medicion punto="Compresión por cilindro" esperado="10 a 14 bar" como="Compresómetro en el orificio de la bujía, motor caliente, mariposa a fondo" nota="Diferencia máxima entre cilindros: 10–15 %" />
</Mediciones>

<Pasos>
1. **Primer paso.** Detalle.
2. **Segundo paso.** Detalle.
</Pasos>

<Herramientas ids={["compresometro", "scanner"]} />

<Comparar>
  <Lado title="Correa">…</Lado>
  <Lado title="Cadena">…</Lado>
</Comparar>

<Term t="PMS">punto muerto superior</Term>
<Libro pag="pág. 672" />
<PuntosClave>
1. …
</PuntosClave>
```

### Trampas de MDX (importante)

- `<` y `{` en el texto se interpretan como código. Escribí `menor que`, `&lt;` o `&gt;`; para llaves usá `&#123;`. **“λ < 1” rompe la compilación**: poné `λ &lt; 1`.
- Dentro de un componente, si querés Markdown (listas, negritas), dejá **una línea en blanco** después de la etiqueta de apertura y antes de la de cierre.
- No indentes párrafos con 4 espacios: se vuelven bloque de código.
- Los comentarios son `{/* así */}`.
- Las props de texto con comillas: `title="Hola"`. Con JSX: `title={<>…</>}`.

## 5. Animaciones

Todas se arman con `src/components/ui/anim-kit.tsx`. Mirá `src/components/anim/Biela.tsx` como referencia de calidad.

```tsx
import { useState } from "react";
import { AnimFrame, Slider, Toggle, Seg, Readout, useAnimClock, Arrow, TAU, fmt } from "../ui/anim-kit";

export function MiAnimacion() {
  const clock = useAnimClock({ speed: 0.5 });     // t en segundos, se pausa sola fuera de pantalla
  const [rpm, setRpm] = useState(2000);
  const a = (clock.t * TAU * 0.5) % TAU;
  return (
    <AnimFrame
      title="Título que dice qué se ve"
      clock={clock}                                // agrega play/pausa/velocidad/paso
      controls={<Slider label="RPM" value={rpm} min={800} max={6000} step={100} onChange={setRpm} />}
      readouts={<Readout label="Presión" value={fmt(3.2, 1)} unit="bar" tone="ok" />}
      legend={[{ color: "var(--c-air)", label: "Aire" }]}
      caption={<p>Qué estás viendo y qué tenés que notar.</p>}
    >
      <svg viewBox="0 0 720 380">…</svg>
    </AnimFrame>
  );
}
```

Reglas:

- **SVG con `viewBox` de ~720 de ancho**, sin `width`/`height` fijos. Tiene que verse bien en celular.
- **Colores sólo con variables CSS** (`var(--c-metal)`, `var(--accent)`, `var(--text)`, …) para que funcione en modo claro y oscuro. Paleta: `--c-metal`, `--c-metal-2`, `--c-metal-dark`, `--c-metal-light`, `--c-block`, `--c-air`, `--c-mix`, `--c-fuel`, `--c-exhaust`, `--c-hot`, `--c-flame`, `--c-coolant`, `--c-oil`, `--c-spark`, `--c-elec`, `--c-signal`, `--c-belt`, `--c-rubber`, más `--primary`, `--accent`, `--ok`, `--warn`, `--bad`, `--teal`, `--violet`, `--muted`, `--border`, `--surface`, `--surface-2`.
- Textos con clases: `svg-label`, `svg-small`, `svg-mono`, `svg-title`.
- **Física correcta**: si algo gira, que la cinemática sea real; si hay valores, que sean los típicos. Las etiquetas tienen que coincidir con lo que pasa en ese instante.
- **Interactivas cuando suma**: sliders de RPM, carga, temperatura, altura; toggles de fallas (“inyector tapado”, “termostato trabado”) que cambian lo que se ve.
- **Siempre caption** explicando qué mirar.
- Flechas con `<Arrow>` (nunca `<marker>`, falla en algunos navegadores).
- Osciloscopio: `<Scope traces={[{ fn: (ms) => volts, color: "#3ddc84", vDiv: 1, label: "CKP" }]} msDiv={5} />`.
- Rendimiento: menos de ~400 elementos SVG, nada de librerías externas.
- Nombres de componentes únicos y descriptivos en español (`CuatroTiempos`, `RuedaFonica`, `Termostato`).

## 6. Preguntas

```ts
// src/content/quizzes/motor.quiz.ts
import type { Question } from "./index";
const q: Record<string, Question[]> = {
  "motor-4t": [
    { q: "¿En qué tiempo se abren las válvulas de admisión?", opts: ["Admisión", "Compresión", "Explosión", "Escape"], correct: 0, explain: "…", topic: "4 tiempos" },
  ],
};
export default q;
```

6 a 8 preguntas por lección. Que hagan pensar (casos del taller), no sólo memoria. La explicación enseña aunque hayas acertado.

## 7. Verificar

```bash
npm run build      # typecheck + build
npm run dev        # ver en el navegador
```
