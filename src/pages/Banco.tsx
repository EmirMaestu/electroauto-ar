import { Link } from "react-router";
import benches from "../content/legacy/benches.json";

const ITEMS = [
  { to: "/banco/motor", icon: "🖥️", title: "Motor + scanner", tag: "Nuevo", desc: "Un motor en marcha con datos en vivo como en un scanner: RPM, MAP, temperatura, lambda, correcciones de mezcla, avance e inyección. Le metés una falla (pérdida de vacío, inyector tapado, sensor desconectado, termostato abierto…) y ves cómo reacciona la ECU. Después diagnosticás vos." },
  { to: "/banco/osciloscopio", icon: "📈", title: "Osciloscopio", tag: "Nuevo", desc: "Las señales reales de sensores y actuadores: CKP inductivo y Hall, CMP, inyector, bobina, sonda lambda, TPS, MAP. Con fallas para aprender a reconocerlas en la pantalla." },
  { to: "/banco/tester", icon: "🔢", title: "Tester sobre circuitos", tag: `${(benches as unknown[]).length} bancos`, desc: "Multímetro virtual con perilla y puntas sobre circuitos del auto: luces con relé, arranque, carga y GNC. Medís tensión, continuidad, resistencia, corriente y caída de tensión." },
  { to: "/banco/calculadoras", icon: "🧮", title: "Calculadoras de taller", tag: "Útil", desc: "Cilindrada y compresión, torque y potencia, corrección por altura, unidades, Ley de Ohm, caída de tensión en cables, velocidad por marcha, medida de cubierta y consumo." },
];

export default function Banco() {
  return (
    <div className="page">
      <div className="eyebrow">Banco de pruebas</div>
      <h1>Medí sin miedo a romper nada</h1>
      <p className="muted" style={{ maxWidth: "66ch" }}>
        Acá se practica. Cada banco simula lo que ves en el taller real: con valores típicos, fallas que se pueden
        inyectar y la explicación de qué está pasando adentro (mecánica y electrónicamente).
      </p>
      <div className="grid cols-2 mt-3">
        {ITEMS.map((it) => (
          <Link key={it.to} to={it.to} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontSize: "2rem" }}>{it.icon}</span>
              <span className="pill tecnico">{it.tag}</span>
            </div>
            <h3 className="mt-1">{it.title}</h3>
            <p className="muted mb-0">{it.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
