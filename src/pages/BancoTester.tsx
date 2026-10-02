import { useEffect, useRef } from "react";
import { Link } from "react-router";
import Simulator from "../legacy/simulator";

export default function BancoTester() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    Simulator.render(host);
    host.querySelector(".crumb")?.remove();
    host.querySelector("h1")?.remove();
  }, []);
  return (
    <div className="page">
      <div className="lesson-head" style={{ marginBottom: "1rem" }}>
        <div className="crumbs"><Link to="/banco">Banco de pruebas</Link> <span>›</span> <span>Tester</span></div>
        <h1>🔢 Tester virtual sobre circuitos reales</h1>
        <p className="summary">Elegí un banco y una falla. Girá la perilla, apoyá las puntas en los puntos del circuito y leé. Cuando creas saber qué pasa, resolvelo.</p>
      </div>
      <div ref={ref} className="legacy" />
    </div>
  );
}
