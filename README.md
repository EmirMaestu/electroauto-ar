# Fierros — mecánica automotriz de cero a eléctricos

Web para aprender mecánica y electrónica automotriz desde lo más básico hasta autos eléctricos,
siguiendo el temario del *Bosch Automotive Handbook* (11ª ed.) y explicada como en el taller.
Hecha en Mendoza, Argentina.

- Lecciones con animaciones interactivas, fórmulas con ejemplos resueltos, práctica de taller y quiz.
- Banco de pruebas: tester virtual, osciloscopio y motor con scanner donde se inyectan fallas.
- Herramientas, casos de falla, biblioteca técnica, glosario y progreso con XP.

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + build a dist/
```

Stack: React 19 + Vite + TypeScript + MDX + React Router. Deploy en Vercel (SPA, ver `vercel.json`).

Para sumar contenido, leé [`docs/AUTORIA.md`](docs/AUTORIA.md).

La versión anterior (ElectroAuto v1, un solo HTML) quedó en `legacy/electroauto-v1.html` y todo su contenido está migrado.
