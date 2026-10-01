import { Link } from "react-router";
export function NotFound() {
  return (
    <div className="page narrow empty">
      <div style={{ fontSize: "3rem" }}>🔩</div>
      <h1>Esta página se aflojó</h1>
      <p>No encontramos lo que buscabas. Capaz cambió de lugar con la versión nueva.</p>
      <Link className="btn accent" to="/">Volver al inicio</Link>
    </div>
  );
}
