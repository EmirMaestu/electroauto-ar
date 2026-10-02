import { useState } from "react";
import { Link } from "react-router";
import { Readout, Seg, Toggle, fmt } from "../components/ui/anim-kit";
import { CalcCard, Fields, NumField, Results, out } from "../components/bench/CalcUi";
import {
  KW_PER_CV, KW_PER_HP, SECCIONES, TEMPS, UNIDADES, baroHpa, cilindro, compresionAltura, convTemp, diamCubierta, hierve,
  potenciaAltura, potenciaKw, relCompresion, resCable, rpmA, rpmDe, seccionPara, torqueDe, velocidad, volRebaje, type Magnitud,
} from "../components/bench/calc";

const ok = (...v: number[]) => v.every((x) => Number.isFinite(x) && x > 0);

/* ------------------------------------------------------------ 1 */
function Cilindrada() {
  const [d, setD] = useState(79.5);
  const [s, setS] = useState(80.5);
  const [z, setZ] = useState(4);
  const [vc, setVc] = useState(42);
  const [cut, setCut] = useState(0);
  const vh = ok(d, s) ? cilindro(d, s) : NaN;
  const VH = vh * Math.round(z);
  const eps = ok(vh, vc) ? relCompresion(vh, vc) : NaN;
  const dv = Number.isFinite(cut) && cut > 0 ? volRebaje(d, cut) : 0;
  const eps2 = ok(vh, vc - dv) ? relCompresion(vh, vc - dv) : NaN;
  return (
    <CalcCard
      id="cilindrada" icon="🧮" title="Cilindrada y relación de compresión"
      intro="Con diámetro, carrera y volumen de la cámara (lo que queda arriba del pistón en el PMS: cámara de la tapa + junta + escalón del pistón)."
      formula={<>V<sub>h</sub> = π/4 · d² · s<br />V<sub>H</sub> = V<sub>h</sub> · z<br />ε = (V<sub>h</sub> + V<sub>c</sub>) / V<sub>c</sub></>}
      vars={[["d, s", "diámetro y carrera [cm]"], ["z", "cantidad de cilindros"], ["Vc", "volumen de la cámara [cm³]"], ["ε", "relación de compresión (… : 1)"]]}
      ejemplo={<>1.6 de 79,5 × 80,5 mm: V<sub>h</sub> ≈ 400 cm³, V<sub>H</sub> ≈ 1.598 cm³. Con V<sub>c</sub> = 42 cm³, ε ≈ 10,5:1. Rebajar 0,3 mm la tapa saca ≈ 1,5 cm³ y sube ε a ≈ 10,9:1 (cuidado con la detonación y con la distribución).</>}
      onEjemplo={() => { setD(79.5); setS(80.5); setZ(4); setVc(42); setCut(0.3); }}
    >
      <Fields>
        <NumField label="Diámetro (d)" unit="mm" value={d} onChange={setD} />
        <NumField label="Carrera (s)" unit="mm" value={s} onChange={setS} />
        <NumField label="Cilindros (z)" value={z} onChange={setZ} />
        <NumField label="Cámara (Vc)" unit="cm³" value={vc} onChange={setVc} />
        <NumField label="Rebaje de tapa" unit="mm" value={cut} onChange={setCut} hint="0 si no se rectificó" />
      </Fields>
      <Results>
        <Readout label="Por cilindro" value={out(vh, 1)} unit="cm³" />
        <Readout label="Cilindrada total" value={out(VH, 0)} unit="cm³" tone="accent" />
        <Readout label="En litros" value={out(VH / 1000, 2)} unit="L" />
        <Readout label="Compresión" value={out(eps, 1)} unit=": 1" tone="accent" />
        {dv > 0 && <Readout label="Con el rebaje" value={out(eps2, 1)} unit=": 1" tone="warn" />}
      </Results>
    </CalcCard>
  );
}

/* ------------------------------------------------------------ 2 */
function TorquePotencia() {
  const [modo, setModo] = useState<"P" | "T" | "N">("P");
  const [T, setT] = useState(150);
  const [n, setN] = useState(4000);
  const [P, setP] = useState(85);
  const [pu, setPu] = useState<"CV" | "kW">("CV");
  const pKwIn = pu === "CV" ? P * KW_PER_CV : P;
  const kw = modo === "P" ? (ok(T, n) ? potenciaKw(T, n) : NaN) : pKwIn;
  const tq = modo === "T" ? (ok(pKwIn, n) ? torqueDe(pKwIn, n) : NaN) : T;
  const rpm = modo === "N" ? (ok(pKwIn, T) ? rpmDe(pKwIn, T) : NaN) : n;
  return (
    <CalcCard
      id="potencia" icon="⚙️" title="Torque ↔ potencia ↔ rpm"
      intro="La potencia es torque por velocidad de giro. Con dos de los tres datos sale el tercero."
      formula={<>P [kW] = T [Nm] · n [rpm] / 9.549<br />1 CV = 0,7355 kW<br />1 HP = 0,7457 kW</>}
      vars={[["P", "potencia"], ["T", "torque (par motor)"], ["n", "vueltas por minuto"], ["9.549", "= 60.000 / 2π"]]}
      ejemplo={<>150 Nm a 4.000 rpm → 62,8 kW ≈ 85 CV. El mismo torque a 2.000 rpm da la mitad de potencia: por eso los motores “estiran” para dar potencia.</>}
      onEjemplo={() => { setModo("P"); setT(150); setN(4000); }}
    >
      <div className="row" style={{ marginBottom: ".6rem", gap: ".5rem" }}>
        <span className="muted" style={{ fontSize: ".85rem" }}>Calcular</span>
        <Seg value={modo} onChange={setModo} options={[{ value: "P" as const, label: "Potencia" }, { value: "T" as const, label: "Torque" }, { value: "N" as const, label: "RPM" }]} />
      </div>
      <Fields>
        {modo !== "T" && <NumField label="Torque" unit="Nm" value={T} onChange={setT} />}
        {modo !== "N" && <NumField label="Vueltas" unit="rpm" value={n} onChange={setN} />}
        {modo !== "P" && (
          <div style={{ display: "flex", flexDirection: "column", gap: ".3rem" }}>
            <NumField label="Potencia" unit={pu} value={P} onChange={setP} />
            <Seg value={pu} onChange={setPu} options={[{ value: "CV" as const, label: "CV" }, { value: "kW" as const, label: "kW" }]} />
          </div>
        )}
      </Fields>
      <Results>
        <Readout label="Potencia" value={out(kw, 1)} unit="kW" tone={modo === "P" ? "accent" : undefined} />
        <Readout label="Potencia" value={out(kw / KW_PER_CV, 1)} unit="CV" tone={modo === "P" ? "accent" : undefined} />
        <Readout label="Potencia" value={out(kw / KW_PER_HP, 1)} unit="HP" />
        <Readout label="Torque" value={out(tq, 1)} unit="Nm" tone={modo === "T" ? "accent" : undefined} />
        <Readout label="Torque" value={out(tq / 9.80665, 2)} unit="kgf·m" />
        <Readout label="Vueltas" value={out(rpm, 0)} unit="rpm" tone={modo === "N" ? "accent" : undefined} />
      </Results>
    </CalcCard>
  );
}

/* ------------------------------------------------------------ 3 */
const LUGARES = [
  { label: "Nivel del mar", h: 0 }, { label: "Mendoza", h: 750 }, { label: "Potrerillos", h: 1350 },
  { label: "Uspallata", h: 1900 }, { label: "Las Cuevas", h: 3150 },
];
function Altura() {
  const [h, setH] = useState(750);
  const [t, setT] = useState(25);
  const [p0, setP0] = useState(110);
  const [tapa, setTapa] = useState(1.2);
  const [comp, setComp] = useState(12);
  const p = Number.isFinite(h) ? baroHpa(h) : NaN;
  const pot = potenciaAltura(p0, p, t);
  const regla = p0 * (1 - 0.01 * (h / 100));
  const hv = hierve(p);
  const hvTapa = hierve(p + tapa * 1000);
  return (
    <CalcCard
      id="altura" icon="🏔️" title="Corrección por altura"
      intro="Con la altura baja la presión del aire: entra menos oxígeno al motor, el agua hierve antes y los instrumentos de presión marcan distinto."
      formula={<>p = 1.013,25 · (1 − 2,2558·10⁻⁵ · h)<sup>5,256</sup><br />P = P₀ · (p / 1.013) · √(293 / T)</>}
      vars={[["h", "altura [m]"], ["p", "presión barométrica [hPa]"], ["P₀", "potencia a nivel del mar"], ["T", "temperatura del aire [K]"]]}
      ejemplo={<>En Mendoza (750 m) a 25 °C hay ≈ 926 hPa: un atmosférico de 110 CV entrega ≈ 100 CV y el agua hierve a ≈ 97,5 °C. Con tapa de radiador de 1,2 bar el sistema aguanta hasta ≈ 122 °C. En Las Cuevas la pérdida pasa del 30 %. Un turbo compensa buena parte.</>}
      onEjemplo={() => { setH(750); setT(25); setP0(110); setTapa(1.2); setComp(12); }}
    >
      <div className="chip-row" style={{ margin: "0 0 .6rem" }}>
        {LUGARES.map((l) => (
          <button key={l.h} className={`chip ${h === l.h ? "on" : ""}`} onClick={() => setH(l.h)}>{l.label}</button>
        ))}
      </div>
      <Fields>
        <NumField label="Altura" unit="m" value={h} onChange={setH} />
        <NumField label="Temp. del aire" unit="°C" value={t} onChange={setT} />
        <NumField label="Potencia a nivel del mar" unit="CV" value={p0} onChange={setP0} />
        <NumField label="Tapa de radiador" unit="bar" value={tapa} onChange={setTapa} />
        <NumField label="Compresión de fábrica" unit="bar" value={comp} onChange={setComp} />
      </Fields>
      <Results>
        <Readout label="Presión del aire" value={out(p, 0)} unit="hPa" />
        <Readout label="Potencia (cálculo)" value={out(pot, 0)} unit="CV" tone="accent" />
        <Readout label="Pérdida" value={out((1 - pot / p0) * 100, 1)} unit="%" tone="warn" />
        <Readout label="Regla 1 % c/100 m" value={out(regla, 0)} unit="CV" />
        <Readout label="Agua hierve (abierto)" value={out(hv, 1)} unit="°C" />
        <Readout label="Con la tapa" value={out(hvTapa, 0)} unit="°C" tone="ok" />
        <Readout label="Compresión esperable" value={out(compresionAltura(comp, p), 1)} unit="bar" />
      </Results>
      <p className="faint" style={{ fontSize: ".78rem", margin: ".3rem 0 0" }}>
        Ebullición de agua pura; con refrigerante (glicol) es unos grados más. La compresión medida en altura da más baja que el dato de fábrica sin que el motor esté mal.
      </p>
    </CalcCard>
  );
}

/* ------------------------------------------------------------ 4 */
const MAG_LABEL: Record<Magnitud, string> = { torque: "Torque", presion: "Presión", potencia: "Potencia", temperatura: "Temperatura" };
const MAG_FORM: Record<Magnitud, string> = {
  torque: "1 kgf·m = 9,807 Nm · 1 lbf·ft = 1,356 Nm · 1 lbf·in = 0,113 Nm",
  presion: "1 bar = 100 kPa = 14,50 psi = 1,02 kgf/cm² · 1 inHg = 3,386 kPa",
  potencia: "1 CV = 0,7355 kW · 1 HP = 0,7457 kW · 1 CV = 0,986 HP",
  temperatura: "°F = °C · 1,8 + 32 · K = °C + 273,15",
};
function Conversor() {
  const [mag, setMag] = useState<Magnitud>("presion");
  const [v, setV] = useState(1);
  const [from, setFrom] = useState<Record<Magnitud, string>>({ torque: "Nm", presion: "bar", potencia: "CV", temperatura: "C" });
  const unit = from[mag];
  let rows: { label: string; value: number; id: string }[];
  if (mag === "temperatura") {
    const r = convTemp(v, unit);
    rows = TEMPS.map((u) => ({ id: u.id, label: u.label, value: r[u.id] }));
  } else {
    const list = UNIDADES[mag];
    const base = v * (list.find((u) => u.id === unit)?.f ?? 1);
    rows = list.map((u) => ({ id: u.id, label: u.label, value: base / u.f }));
  }
  const opts = mag === "temperatura" ? TEMPS : UNIDADES[mag];
  return (
    <CalcCard
      id="unidades" icon="🔁" title="Conversor de unidades"
      intro="Manuales en inglés, torquímetros en lbf·ft, manómetros en psi: pasá de una unidad a otra."
      formula={<>{MAG_FORM[mag]}</>}
      ejemplo={<>Presión de cubiertas: 32 psi = 2,2 bar. Un bulón de tapa a 7 kgf·m = 69 Nm. Vacío de 18 inHg = 61 kPa.</>}
      onEjemplo={() => { setMag("presion"); setFrom({ ...from, presion: "psi" }); setV(32); }}
    >
      <div className="row" style={{ marginBottom: ".6rem", gap: ".5rem" }}>
        <Seg value={mag} onChange={setMag} options={(Object.keys(MAG_LABEL) as Magnitud[]).map((m) => ({ value: m, label: MAG_LABEL[m] }))} />
      </div>
      <Fields min={140}>
        <NumField label="Valor" value={v} onChange={setV} />
        <label style={{ display: "flex", flexDirection: "column", gap: ".2rem" }}>
          <span style={{ fontSize: ".78rem", color: "var(--muted)", fontWeight: 600 }}>Unidad</span>
          <select value={unit} onChange={(e) => setFrom({ ...from, [mag]: e.target.value })}>
            {opts.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </label>
      </Fields>
      <Results>
        {rows.map((r) => (
          <Readout key={r.id} label={r.label} value={out(r.value, Math.abs(r.value) >= 100 ? 1 : Math.abs(r.value) >= 1 ? 3 : 4)} tone={r.id === unit ? "accent" : undefined} />
        ))}
      </Results>
    </CalcCard>
  );
}

/* ------------------------------------------------------------ 5 */
function Ohm() {
  const [modo, setModo] = useState<"V" | "I" | "R">("I");
  const [V, setV] = useState(12);
  const [I, setI] = useState(4.6);
  const [R, setR] = useState(2.6);
  const v = modo === "V" ? I * R : V;
  const i = modo === "I" ? (ok(R) ? V / R : NaN) : I;
  const r = modo === "R" ? (ok(I) ? V / I : NaN) : R;
  const p = v * i;
  return (
    <CalcCard
      id="ohm" icon="💡" title="Ley de Ohm y potencia eléctrica"
      intro="Tensión, corriente y resistencia: con dos sacás la tercera, y la potencia que se disipa."
      formula={<>V = I · R<br />P = V · I = I² · R = V² / R</>}
      vars={[["V", "tensión [V]"], ["I", "corriente [A]"], ["R", "resistencia [Ω]"], ["P", "potencia [W]"]]}
      ejemplo={<>Una lámpara de 55 W a 12 V consume 55 / 12 ≈ 4,6 A y en caliente tiene ≈ 2,6 Ω. En frío el filamento mide mucho menos (≈ 0,3 Ω): por eso el pico de corriente al encenderla.</>}
      onEjemplo={() => { setModo("I"); setV(12); setR(2.6); }}
    >
      <div className="row" style={{ marginBottom: ".6rem", gap: ".5rem" }}>
        <span className="muted" style={{ fontSize: ".85rem" }}>Calcular</span>
        <Seg value={modo} onChange={setModo} options={[{ value: "V" as const, label: "Tensión" }, { value: "I" as const, label: "Corriente" }, { value: "R" as const, label: "Resistencia" }]} />
      </div>
      <Fields>
        {modo !== "V" && <NumField label="Tensión (V)" unit="V" value={V} onChange={setV} />}
        {modo !== "I" && <NumField label="Corriente (I)" unit="A" value={I} onChange={setI} />}
        {modo !== "R" && <NumField label="Resistencia (R)" unit="Ω" value={R} onChange={setR} />}
      </Fields>
      <Results>
        <Readout label="Tensión" value={out(v, 2)} unit="V" tone={modo === "V" ? "accent" : undefined} />
        <Readout label="Corriente" value={out(i, 2)} unit="A" tone={modo === "I" ? "accent" : undefined} />
        <Readout label="Resistencia" value={out(r, 2)} unit="Ω" tone={modo === "R" ? "accent" : undefined} />
        <Readout label="Potencia" value={out(p, 1)} unit="W" />
      </Results>
    </CalcCard>
  );
}

/* ------------------------------------------------------------ 6 */
function Cable() {
  const [L, setL] = useState(4);
  const [S, setS] = useState(1);
  const [I, setI] = useState(9.2);
  const [sys, setSys] = useState(12);
  const [ret, setRet] = useState(true);
  const [maxPct, setMaxPct] = useState(3);
  const largo = ret ? L * 2 : L;
  const R = ok(largo, S) ? resCable(largo, S) : NaN;
  const dv = I * R;
  const pct = (dv / sys) * 100;
  const rec = ok(largo, I, maxPct) ? seccionPara(largo, I, (sys * maxPct) / 100) : NaN;
  return (
    <CalcCard
      id="cable" icon="🔌" title="Caída de tensión en un cable"
      intro="Un cable fino o largo “se come” volts: la lámpara alumbra menos y el motor de arranque gira lento. Medilo antes de agregar consumos."
      formula={<>R = ρ · L / S<br />ΔV = I · R<br />S<sub>mín</sub> = ρ · L · I / ΔV<sub>máx</sub></>}
      vars={[["ρ", "cobre ≈ 0,0175 Ω·mm²/m (20 °C)"], ["L", "largo total del recorrido [m]"], ["S", "sección [mm²]"], ["I", "corriente [A]"]]}
      ejemplo={<>Faros auxiliares 2 × 55 W (≈ 9,2 A), 4 m hasta los faros y vuelta por cable, con 1 mm²: ΔV ≈ 1,3 V (≈ 11 %): alumbran bastante menos. Con 2,5 mm² caen ≈ 0,5 V.</>}
      onEjemplo={() => { setL(4); setS(1); setI(9.2); setSys(12); setRet(true); setMaxPct(3); }}
    >
      <Fields>
        <NumField label="Largo del cable (ida)" unit="m" value={L} onChange={setL} />
        <label style={{ display: "flex", flexDirection: "column", gap: ".2rem" }}>
          <span style={{ fontSize: ".78rem", color: "var(--muted)", fontWeight: 600 }}>Sección</span>
          <select value={S} onChange={(e) => setS(parseFloat(e.target.value))}>
            {SECCIONES.map((x) => <option key={x} value={x}>{fmt(x, x < 1 ? 2 : x % 1 ? 1 : 0)} mm²</option>)}
          </select>
        </label>
        <NumField label="Corriente" unit="A" value={I} onChange={setI} />
        <NumField label="Caída máxima" unit="%" value={maxPct} onChange={setMaxPct} hint="3 % es un criterio común" />
      </Fields>
      <div className="row" style={{ gap: ".8rem", marginTop: ".6rem" }}>
        <Seg value={sys} onChange={setSys} options={[{ value: 12, label: "12 V" }, { value: 24, label: "24 V" }]} />
        <Toggle label={<span style={{ fontSize: ".85rem" }}>Retorno por cable (no por chasis)</span>} checked={ret} onChange={setRet} />
      </div>
      <Results>
        <Readout label="Resistencia" value={out(R * 1000, 0)} unit="mΩ" />
        <Readout label="Caída" value={out(dv, 2)} unit="V" tone={pct > maxPct ? "bad" : "ok"} />
        <Readout label="Del sistema" value={out(pct, 1)} unit="%" tone={pct > maxPct ? "bad" : "ok"} />
        <Readout label="Se pierde en calor" value={out(I * I * R, 1)} unit="W" />
        <Readout label="Sección recomendada" value={Number.isFinite(rec) ? fmt(rec, rec < 1 ? 2 : rec % 1 ? 1 : 0) : "> 50"} unit="mm²" tone="accent" />
      </Results>
      <p className="faint" style={{ fontSize: ".78rem", margin: ".3rem 0 0" }}>
        Además de la caída, el cable tiene que aguantar la corriente sin calentar (tabla del fabricante del cable) y el fusible se elige para proteger al cable.
      </p>
    </CalcCard>
  );
}

/* ------------------------------------------------------------ 7 */
function Velocidad() {
  const [rpm, setRpm] = useState(3000);
  const [cajas, setCajas] = useState([3.455, 1.944, 1.286, 0.969, 0.8]);
  const [dif, setDif] = useState(4.067);
  const [w, setW] = useState(185);
  const [ar, setAr] = useState(65);
  const [rim, setRim] = useState(15);
  const D = ok(w, ar, rim) ? diamCubierta(w, ar, rim) : NaN;
  return (
    <CalcCard
      id="velocidad" icon="🏁" title="Velocidad según rpm, marcha y cubierta"
      intro="A cuántos km/h vas en cada marcha a ciertas vueltas, y a cuántas vueltas vas a 100 km/h. Las relaciones de abajo son típicas de una caja de 5: poné las de tu auto."
      formula={<>v [km/h] = n · π · D · 60 / (i<sub>caja</sub> · i<sub>dif</sub> · 1.000)</>}
      vars={[["n", "rpm del motor"], ["D", "diámetro de la rueda [m]"], ["i caja, i dif", "relaciones de la marcha y del diferencial"]]}
      ejemplo={<>A 3.000 rpm en 5ta (0,80 × 4,067), con 185/65 R15 (D ≈ 0,62 m): ≈ 108 km/h.</>}
      onEjemplo={() => { setRpm(3000); setCajas([3.455, 1.944, 1.286, 0.969, 0.8]); setDif(4.067); setW(185); setAr(65); setRim(15); }}
    >
      <Fields>
        <NumField label="RPM" value={rpm} onChange={setRpm} />
        <NumField label="Diferencial" value={dif} onChange={setDif} />
        <NumField label="Ancho cubierta" unit="mm" value={w} onChange={setW} />
        <NumField label="Perfil" unit="%" value={ar} onChange={setAr} />
        <NumField label="Rodado" unit="″" value={rim} onChange={setRim} />
      </Fields>
      <div style={{ marginTop: ".6rem" }}>
        <Fields min={64}>
          {cajas.map((c, k) => (
            <NumField key={k} label={`${k + 1}ª`} value={c} onChange={(v) => setCajas(cajas.map((x, j) => (j === k ? v : x)))} />
          ))}
        </Fields>
      </div>
      <div className="table-wrap" style={{ margin: ".8rem 0 0" }}>
        <table className="tbl" style={{ margin: 0, fontSize: ".86rem" }}>
          <thead><tr><th>Marcha</th><th>Relación total</th><th>km/h a {fmt(rpm || 0, 0)} rpm</th><th>rpm a 100 km/h</th></tr></thead>
          <tbody>
            {cajas.map((c, k) => (
              <tr key={k}>
                <td><b>{k + 1}ª</b></td>
                <td>{out(c * dif, 2)}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{ok(c, dif, D, rpm) ? fmt(velocidad(rpm, c, dif, D), 0) : "—"}</td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{ok(c, dif, D) ? fmt(rpmA(100, c, dif, D), 0) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CalcCard>
  );
}

/* ------------------------------------------------------------ 8 */
function Cubiertas() {
  const [a, setA] = useState({ w: 185, ar: 65, rim: 15 });
  const [b, setB] = useState({ w: 195, ar: 55, rim: 16 });
  const [vInd, setVInd] = useState(100);
  const Da = ok(a.w, a.ar, a.rim) ? diamCubierta(a.w, a.ar, a.rim) : NaN;
  const Db = ok(b.w, b.ar, b.rim) ? diamCubierta(b.w, b.ar, b.rim) : NaN;
  const diff = (Db / Da - 1) * 100;
  const vReal = vInd * (Db / Da);
  const fila = (lbl: string, x: { w: number; ar: number; rim: number }, set: (v: { w: number; ar: number; rim: number }) => void) => (
    <div>
      <div style={{ fontSize: ".8rem", fontWeight: 700, color: "var(--text-2)", marginBottom: ".3rem" }}>{lbl}</div>
      <Fields min={80}>
        <NumField label="Ancho" unit="mm" value={x.w} onChange={(v) => set({ ...x, w: v })} />
        <NumField label="Perfil" unit="%" value={x.ar} onChange={(v) => set({ ...x, ar: v })} />
        <NumField label="Rodado" unit="″" value={x.rim} onChange={(v) => set({ ...x, rim: v })} />
      </Fields>
    </div>
  );
  return (
    <CalcCard
      id="cubiertas" icon="🛞" title="Medida de cubierta y error del velocímetro"
      intro="“185/65 R15” = 185 mm de ancho, flanco de 65 % del ancho, llanta de 15 pulgadas. Si cambiás de medida, cambia el diámetro y el velocímetro deja de marcar bien."
      formula={<>D = rodado · 25,4 + 2 · ancho · perfil / 100<br />C = π · D<br />v<sub>real</sub> = v<sub>marcada</sub> · D<sub>nueva</sub> / D<sub>original</sub></>}
      vars={[["D", "diámetro exterior [mm]"], ["C", "circunferencia (lo que avanza por vuelta)"]]}
      ejemplo={<>185/65 R15 → 195/55 R16: 621,5 mm contra 620,9 mm (−0,1 %): medida equivalente. Como criterio práctico, no te alejes más de ≈ ±3 % del diámetro original.</>}
      onEjemplo={() => { setA({ w: 185, ar: 65, rim: 15 }); setB({ w: 195, ar: 55, rim: 16 }); setVInd(100); }}
    >
      <div className="stack" style={{ gap: ".7rem" }}>
        {fila("Original", a, setA)}
        {fila("Nueva", b, setB)}
        <Fields><NumField label="El velocímetro marca" unit="km/h" value={vInd} onChange={setVInd} /></Fields>
      </div>
      <Results>
        <Readout label="Diámetro original" value={out(Da, 1)} unit="mm" />
        <Readout label="Diámetro nueva" value={out(Db, 1)} unit="mm" />
        <Readout label="Diferencia" value={out(diff, 1)} unit="%" tone={Math.abs(diff) > 3 ? "bad" : "ok"} />
        <Readout label="Vas realmente a" value={out(vReal, 1)} unit="km/h" tone="accent" />
        <Readout label="Vueltas por km (nueva)" value={out(1e6 / (Math.PI * Db), 0)} />
        <Readout label="Flanco (nueva)" value={out((b.w * b.ar) / 100, 0)} unit="mm" />
      </Results>
    </CalcCard>
  );
}

/* ------------------------------------------------------------ 9 */
function Consumo() {
  const [tipo, setTipo] = useState<"L" | "m3">("L");
  const [km, setKm] = useState(450);
  const [vol, setVol] = useState(38);
  const [precio, setPrecio] = useState(NaN);
  const u = tipo === "L" ? "L" : "m³";
  const per100 = ok(km, vol) ? (vol * 100) / km : NaN;
  const kmPor = ok(km, vol) ? km / vol : NaN;
  const costoKm = ok(precio) ? (precio * vol) / km : NaN;
  return (
    <CalcCard
      id="consumo" icon="⛽" title="Consumo y costo por kilómetro"
      intro="Método de tanque lleno a tanque lleno: cargás hasta el corte, ponés el parcial en 0, andás y la próxima vez cargás de nuevo hasta el corte. El precio lo ponés vos."
      formula={<>{u}/100 km = {u === "L" ? "litros" : "m³"} · 100 / km<br />km/{u} = km / {u === "L" ? "litros" : "m³"}<br />$/km = precio · {u === "L" ? "litros" : "m³"} / km</>}
      ejemplo={<>Cargaste 38 L y habías hecho 450 km: 8,4 L/100 km = 11,8 km/L. Con GNC se mide en m³: muchos autos andan 12–16 km/m³ (según motor y equipo).</>}
      onEjemplo={() => { setTipo("L"); setKm(450); setVol(38); }}
    >
      <div className="row" style={{ marginBottom: ".6rem" }}>
        <Seg value={tipo} onChange={setTipo} options={[{ value: "L" as const, label: "Nafta / gasoil (L)" }, { value: "m3" as const, label: "GNC (m³)" }]} />
      </div>
      <Fields>
        <NumField label="Kilómetros hechos" unit="km" value={km} onChange={setKm} />
        <NumField label={tipo === "L" ? "Litros cargados" : "m³ cargados"} unit={u} value={vol} onChange={setVol} />
        <NumField label={`Precio por ${u}`} unit="$" value={precio} onChange={setPrecio} hint="opcional" />
      </Fields>
      <Results>
        <Readout label={`${u} cada 100 km`} value={out(per100, 1)} tone="accent" />
        <Readout label={`km por ${u}`} value={out(kmPor, 1)} tone="accent" />
        <Readout label="Costo por km" value={Number.isFinite(costoKm) ? `$ ${fmt(costoKm, 2)}` : "—"} />
        <Readout label="Costo cada 100 km" value={Number.isFinite(costoKm) ? `$ ${fmt(costoKm * 100, 0)}` : "—"} />
      </Results>
    </CalcCard>
  );
}

const INDICE = [
  ["cilindrada", "🧮 Cilindrada"], ["potencia", "⚙️ Torque y potencia"], ["altura", "🏔️ Altura"], ["unidades", "🔁 Unidades"],
  ["ohm", "💡 Ohm"], ["cable", "🔌 Caída en cables"], ["velocidad", "🏁 Velocidad"], ["cubiertas", "🛞 Cubiertas"], ["consumo", "⛽ Consumo"],
];

export default function Calculadoras() {
  return (
    <div className="page">
      <div className="lesson-head" style={{ marginBottom: "1rem" }}>
        <div className="crumbs"><Link to="/banco">Banco de pruebas</Link> <span>›</span> <span>Calculadoras</span></div>
        <h1>🧮 Calculadoras de taller</h1>
        <p className="summary">
          Las cuentas que aparecen todos los días: cilindrada, potencia, altura, unidades, electricidad, cubiertas y consumo. Escribí los
          números (con coma o con punto) y el resultado sale al instante, con la fórmula y un ejemplo.
        </p>
      </div>
      <div className="chip-row" style={{ marginBottom: "1.2rem" }}>
        {INDICE.map(([id, l]) => <a key={id} href={`#${id}`} className="chip" style={{ textDecoration: "none" }}>{l}</a>)}
      </div>
      <div className="grid cols-2" style={{ alignItems: "start", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 420px), 1fr))" }}>
        <Cilindrada />
        <TorquePotencia />
        <Altura />
        <Conversor />
        <Ohm />
        <Cable />
        <Velocidad />
        <Cubiertas />
        <Consumo />
      </div>
      <p className="muted mt-4" style={{ fontSize: ".9rem" }}>
        Los resultados son cálculos teóricos: sirven para entender y comparar. Para ajustar o reparar, manda el dato del fabricante.
        ¿Querés practicar con el motor andando? Probá el <Link to="/banco/motor">motor con scanner</Link> o el <Link to="/banco/osciloscopio">osciloscopio</Link>.
      </p>
    </div>
  );
}
