// @ts-nocheck
/* Visuales interactivos heredados de ElectroAuto v1 (JS puro).
   Se montan sobre <div class="vmount" data-visual="NOMBRE"> dentro de las lecciones migradas. */
export const VISUALS = {

  /* ---- Triángulo de la Ley de Ohm ---- */
  ohmTriangle(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 300 220" role="img" aria-label="Triángulo de la ley de Ohm">
        <polygon points="150,20 30,200 270,200" fill="none" stroke="currentColor" stroke-width="3"/>
        <line x1="60" y1="120" x2="240" y2="120" stroke="currentColor" stroke-width="3"/>
        <line x1="150" y1="120" x2="150" y2="200" stroke="currentColor" stroke-width="3"/>
        <text x="150" y="95" text-anchor="middle" font-size="40" font-weight="bold" fill="var(--primary)">V</text>
        <text x="100" y="180" text-anchor="middle" font-size="34" font-weight="bold" fill="var(--accent)">I</text>
        <text x="200" y="180" text-anchor="middle" font-size="34" font-weight="bold" fill="var(--ok)">R</text>
      </svg>
      <figcaption>Tapá la magnitud que buscás: V = I×R · I = V/R · R = V/I</figcaption>
    </figure>`;
  },

  /* ---- Calculadora interactiva de Ohm ---- */
  ohmCalc(el){
    el.innerHTML = `<div class="card">
      <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center">
        <label style="flex:1;min-width:180px">Tensión (V): <b id="ocV">12</b> V<br>
          <input id="ocVs" type="range" min="1" max="16" step="0.5" value="12" style="width:100%"></label>
        <label style="flex:1;min-width:180px">Resistencia (R): <b id="ocR">3</b> Ω<br>
          <input id="ocRs" type="range" min="0.5" max="50" step="0.5" value="3" style="width:100%"></label>
      </div>
      <div class="grid grid-2" style="margin-top:.8rem">
        <div class="stat"><span class="n" id="ocI">—</span><span class="l">Corriente (I = V/R)</span></div>
        <div class="stat"><span class="n" id="ocP">—</span><span class="l">Potencia (P = V×I)</span></div>
      </div>
      <div class="bar" style="margin-top:.6rem"><span id="ocBar"></span></div>
      <p class="muted" id="ocNote" style="margin:.5rem 0 0;font-size:.85rem"></p>
    </div>`;
    const V=el.querySelector("#ocVs"), R=el.querySelector("#ocRs");
    function upd(){
      const v=+V.value, r=+R.value, i=v/r, p=v*i;
      el.querySelector("#ocV").textContent=v;
      el.querySelector("#ocR").textContent=r;
      el.querySelector("#ocI").textContent=i.toFixed(2)+" A";
      el.querySelector("#ocP").textContent=p.toFixed(1)+" W";
      el.querySelector("#ocBar").style.width=Math.min(100,i/20*100)+"%";
      const note = el.querySelector("#ocNote");
      if(i>15) note.textContent="⚠ Corriente muy alta: así se comporta un cortocircuito. Volaría el fusible.";
      else if(r>=40) note.textContent="Resistencia alta (poca corriente): así se ve un circuito casi abierto o un consumo chico.";
      else note.textContent="Bajá la resistencia y mirá cómo se dispara la corriente.";
    }
    V.oninput=upd; R.oninput=upd; upd();
  },

  /* ---- Flujo de corriente animado + interruptor ---- */
  circuitFlow(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 460 240" id="cfsvg">
        <path id="cfpath" d="M70,180 L70,80 L200,80 L200,80 M70,80 L200,80 L200,60 M200,80 L390,80 L390,180 L70,180"
              fill="none" stroke="var(--muted)" stroke-width="6"/>
        <rect x="40" y="80" width="30" height="100" rx="4" fill="#3a4b66"/>
        <text x="55" y="135" text-anchor="middle" fill="#fff" font-size="11" transform="rotate(-90 55,135)">BAT</text>
        <circle cx="390" cy="80" r="22" fill="#666" id="cflamp"/>
        <text x="390" y="48" text-anchor="middle" fill="currentColor" font-size="11">Lámpara</text>
        <rect x="180" y="55" width="50" height="14" rx="4" fill="var(--accent)" id="cfsw" style="cursor:pointer"/>
        <text x="205" y="40" text-anchor="middle" fill="currentColor" font-size="11">Llave</text>
        <circle r="5" fill="var(--accent)" id="cfdot">
          <animateMotion id="cfanim" dur="2.5s" repeatCount="indefinite"
            path="M70,180 L70,80 L200,80 L390,80 L390,180 L70,180"/>
        </circle>
      </svg>
      <figcaption id="cfcap">Circuito CERRADO: la corriente circula y la lámpara prende. Tocá la llave para abrir.</figcaption>
    </figure>`;
    let closed=true;
    const lamp=el.querySelector("#cflamp"), dot=el.querySelector("#cfdot"),
          cap=el.querySelector("#cfcap"), sw=el.querySelector("#cfsw");
    function render(){
      if(closed){ lamp.setAttribute("fill","#f4c542"); dot.style.display=""; sw.setAttribute("y","68");
        cap.textContent="Circuito CERRADO: la corriente circula y la lámpara prende. Tocá la llave para abrir."; }
      else { lamp.setAttribute("fill","#666"); dot.style.display="none"; sw.setAttribute("y","48");
        cap.textContent="Circuito ABIERTO: la llave cortó el camino, no circula corriente, la lámpara está apagada."; }
    }
    sw.onclick=()=>{ closed=!closed; render(); };
    el.querySelector("#cfsvg").onclick=(e)=>{ if(e.target.id==="cfsvg"){} };
    render();
  },

  /* ---- Fusible ---- */
  fuse(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 300 160">
        <rect x="80" y="40" width="140" height="80" rx="10" fill="rgba(229,57,53,.25)" stroke="var(--bad)" stroke-width="2"/>
        <rect x="95" y="120" width="14" height="30" fill="#9aa"/>
        <rect x="191" y="120" width="14" height="30" fill="#9aa"/>
        <path id="fwire" d="M102,80 Q150,55 198,80" fill="none" stroke="var(--accent)" stroke-width="4"/>
        <text x="150" y="30" text-anchor="middle" fill="currentColor" font-size="12">Fusible de uña</text>
      </svg>
      <figcaption id="fcap">El alambre interno conduce la corriente. Probá una sobrecarga.</figcaption>
    </figure>
    <div style="text-align:center"><button class="btn sm accent" id="fbtn">⚡ Simular sobrecarga / corto</button>
    <button class="btn sm ghost" id="frep">Reemplazar</button></div>`;
    const w=el.querySelector("#fwire"), cap=el.querySelector("#fcap");
    el.querySelector("#fbtn").onclick=()=>{ w.setAttribute("d","M102,80 Q140,60 145,80 M155,80 Q160,60 198,80");
      w.setAttribute("stroke","var(--bad)"); cap.textContent="¡Voló! La sobrecorriente cortó el alambre y protegió el cableado. Nunca lo reemplaces por uno de más amperaje."; };
    el.querySelector("#frep").onclick=()=>{ w.setAttribute("d","M102,80 Q150,55 198,80");
      w.setAttribute("stroke","var(--accent)"); cap.textContent="Fusible nuevo del mismo amperaje. Si vuelve a saltar, hay una falla: buscá el corto."; };
  },

  /* ---- Relé ---- */
  relay(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 360 220">
        <rect x="60" y="40" width="240" height="140" rx="10" fill="var(--surface-2)" stroke="var(--border)"/>
        <!-- bobina -->
        <rect x="90" y="70" width="24" height="80" rx="4" fill="none" stroke="var(--primary)" stroke-width="3"/>
        <text x="102" y="65" text-anchor="middle" font-size="11" fill="currentColor">Bobina</text>
        <text x="102" y="170" text-anchor="middle" font-size="11" fill="currentColor">85 / 86</text>
        <!-- contacto -->
        <circle cx="210" cy="80" r="5" fill="var(--text)"/><text x="210" y="68" text-anchor="middle" font-size="11" fill="currentColor">30</text>
        <circle cx="270" cy="120" r="5" fill="var(--text)"/><text x="285" y="124" font-size="11" fill="currentColor">87</text>
        <line id="rcontact" x1="210" y1="80" x2="250" y2="55" stroke="var(--accent)" stroke-width="4"/>
        <path d="M150,110 L185,110" stroke="var(--muted)" stroke-dasharray="4" />
      </svg>
      <figcaption id="rcap">Relé en reposo: 30 y 87 separados. Energizá la bobina.</figcaption>
    </figure>
    <div style="text-align:center"><button class="btn sm" id="rbtn">🔌 Energizar bobina (85–86)</button></div>`;
    const c=el.querySelector("#rcontact"), cap=el.querySelector("#rcap"); let on=false;
    el.querySelector("#rbtn").onclick=(e)=>{ on=!on;
      if(on){ c.setAttribute("x2","270"); c.setAttribute("y2","120"); cap.textContent="¡Clic! La bobina atrae el contacto: 30 se une con 87 y pasa la corriente al consumo."; e.target.textContent="🔌 Desenergizar bobina"; }
      else { c.setAttribute("x2","250"); c.setAttribute("y2","55"); cap.textContent="Relé en reposo: el resorte separó 30 de 87. No pasa corriente al consumo."; e.target.textContent="🔌 Energizar bobina (85–86)"; } };
  },

  /* ---- Serie ---- */
  seriesCircuit(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 460 180">
        <rect x="30" y="60" width="26" height="70" rx="4" fill="#3a4b66"/>
        <rect x="20" y="35" width="420" height="0" />
        <path d="M43,60 L43,30 L200,30 M260,30 L417,30 L417,130 L43,130 L43,130" fill="none" stroke="var(--muted)" stroke-width="5"/>
        <circle cx="155" cy="30" r="18" fill="#f4c542" id="s1"/>
        <circle cx="305" cy="30" r="18" fill="#f4c542" id="s2"/>
        <line x1="200" y1="30" x2="222" y2="30" stroke="var(--muted)" stroke-width="5"/>
        <line x1="240" y1="30" x2="260" y2="30" stroke="var(--muted)" stroke-width="5"/>
        <text x="155" y="70" text-anchor="middle" font-size="11" fill="currentColor">L1</text>
        <text x="305" y="70" text-anchor="middle" font-size="11" fill="currentColor">L2</text>
      </svg>
      <figcaption id="scap">En serie: una sola ruta. Cortá una lámpara y mirá qué pasa.</figcaption>
    </figure>
    <div style="text-align:center"><button class="btn sm ghost" id="scut">Cortar L1</button></div>`;
    let cut=false; const s1=el.querySelector("#s1"),s2=el.querySelector("#s2"),cap=el.querySelector("#scap");
    el.querySelector("#scut").onclick=(e)=>{ cut=!cut;
      if(cut){ s1.setAttribute("fill","#666"); s2.setAttribute("fill","#666"); cap.textContent="Al cortar L1 se apagan LAS DOS: en serie, si se interrumpe uno, no circula corriente por ninguno."; e.target.textContent="Reparar L1"; }
      else { s1.setAttribute("fill","#f4c542"); s2.setAttribute("fill","#f4c542"); cap.textContent="En serie: una sola ruta. Cortá una lámpara y mirá qué pasa."; e.target.textContent="Cortar L1"; } };
  },

  /* ---- Paralelo ---- */
  parallelCircuit(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 460 200">
        <rect x="30" y="70" width="26" height="70" rx="4" fill="#3a4b66"/>
        <path d="M43,70 L43,40 L420,40 L420,150 L43,150 L43,140" fill="none" stroke="var(--muted)" stroke-width="5"/>
        <line x1="180" y1="40" x2="180" y2="150" stroke="var(--muted)" stroke-width="5"/>
        <line x1="300" y1="40" x2="300" y2="150" stroke="var(--muted)" stroke-width="5"/>
        <circle cx="180" cy="95" r="18" fill="#f4c542" id="p1"/>
        <circle cx="300" cy="95" r="18" fill="#f4c542" id="p2"/>
        <text x="210" y="100" font-size="11" fill="currentColor">L1</text>
        <text x="330" y="100" font-size="11" fill="currentColor">L2</text>
      </svg>
      <figcaption id="pcap">En paralelo: cada lámpara tiene su camino. Cortá una y mirá.</figcaption>
    </figure>
    <div style="text-align:center"><button class="btn sm ghost" id="pcut">Cortar L1</button></div>`;
    let cut=false; const p1=el.querySelector("#p1"),cap=el.querySelector("#pcap");
    el.querySelector("#pcut").onclick=(e)=>{ cut=!cut;
      if(cut){ p1.setAttribute("fill","#666"); cap.textContent="L1 cortada pero L2 SIGUE prendida: en paralelo cada rama es independiente. Así está cableado casi todo el auto."; e.target.textContent="Reparar L1"; }
      else { p1.setAttribute("fill","#f4c542"); cap.textContent="En paralelo: cada lámpara tiene su camino. Cortá una y mirá."; e.target.textContent="Cortar L1"; } };
  },

  /* ---- Símbolos de esquema ---- */
  symbols(el){
    const items=[
      ["Batería","M10,20 L10,10 M5,15 L15,15 M22,20 L22,8 M19,14 L25,14"],
      ["Lámpara","circle"],
      ["Resistencia","M2,15 L8,15 L11,8 L16,22 L21,8 L24,15 L30,15"],
      ["Fusible","M3,15 L9,15 Q15,5 21,15 Q15,25 9,15"],
      ["Masa","M15,6 L15,16 M8,16 L22,16 M10,20 L20,20 M13,24 L17,24"],
      ["Interruptor","M3,18 L12,18 L22,8 M22,18 L30,18"],
      ["Diodo","M5,15 L14,15 M14,8 L14,22 L24,15 L14,8 M24,8 L24,22"],
      ["Motor","circleM"]
    ];
    el.innerHTML = `<div class="card"><h3 style="margin-top:0">Símbolos más comunes</h3>
      <div class="grid grid-3">${items.map(([n,p])=>`
        <div style="text-align:center">
          <svg viewBox="0 0 32 30" width="80" height="60" style="background:var(--surface-2);border-radius:8px">
            ${p==="circle"?'<circle cx="16" cy="15" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10,9 L22,21 M22,9 L10,21" stroke="currentColor" stroke-width="1.2"/>':
              p==="circleM"?'<circle cx="16" cy="15" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/><text x="16" y="19" text-anchor="middle" font-size="9" fill="currentColor">M</text>':
              `<path d="${p}" fill="none" stroke="currentColor" stroke-width="1.5"/>`}
          </svg>
          <div style="font-size:.8rem">${n}</div>
        </div>`).join("")}</div>
      <p class="muted" style="font-size:.82rem;margin-bottom:0">Cada fabricante varía. Siempre confiá en la referencia del manual del modelo.</p>
    </div>`;
  },

  /* ---- Alternador ---- */
  alternator(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 420 240">
        <circle cx="150" cy="120" r="80" fill="var(--surface-2)" stroke="var(--border)" stroke-width="2"/>
        <circle cx="150" cy="120" r="40" fill="none" stroke="var(--primary)" stroke-width="6"/>
        <text x="150" y="124" text-anchor="middle" font-size="11" fill="currentColor">Rotor</text>
        <text x="150" y="55" text-anchor="middle" font-size="11" fill="currentColor">Estator</text>
        <rect x="280" y="60" width="100" height="40" rx="6" fill="#2b6cc9"/><text x="330" y="85" text-anchor="middle" fill="#fff" font-size="10">Rectificador</text>
        <rect x="280" y="140" width="100" height="40" rx="6" fill="#c97a2b"/><text x="330" y="165" text-anchor="middle" fill="#fff" font-size="10">Regulador</text>
        <line x1="230" y1="120" x2="280" y2="80" stroke="var(--muted)" stroke-width="3"/>
        <line x1="230" y1="120" x2="280" y2="160" stroke="var(--muted)" stroke-width="3"/>
      </svg>
      <figcaption>Rotor (campo) gira dentro del estator (genera CA trifásica) → rectificador (diodos, pasa a CC) → regulador (mantiene ~14 V).</figcaption>
    </figure>`;
  },

  /* ---- Motor de arranque ---- */
  starter(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 420 220">
        <rect x="40" y="80" width="160" height="80" rx="14" fill="#7a8aa0"/>
        <text x="120" y="125" text-anchor="middle" fill="#fff" font-size="12">Motor (burro)</text>
        <rect x="60" y="40" width="120" height="34" rx="10" fill="#566"/>
        <text x="120" y="62" text-anchor="middle" fill="#fff" font-size="11">Solenoide</text>
        <rect x="200" y="105" width="40" height="30" fill="#999"/>
        <text x="220" y="100" text-anchor="middle" font-size="10" fill="currentColor">Piñón</text>
        <circle cx="300" cy="120" r="55" fill="none" stroke="var(--muted)" stroke-width="10" stroke-dasharray="6 6"/>
        <text x="300" y="124" text-anchor="middle" font-size="10" fill="currentColor">Corona</text>
      </svg>
      <figcaption>El solenoide empuja el piñón contra la corona del volante y cierra el contacto de potencia que alimenta al motor del burro.</figcaption>
    </figure>`;
  },

  /* ---- Inyección: flujo sensores → ECU → actuadores ---- */
  injection(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 460 240">
        <rect x="180" y="90" width="100" height="60" rx="10" fill="var(--primary)"/>
        <text x="230" y="125" text-anchor="middle" fill="#fff" font-size="14">ECU</text>
        ${["CKP","MAP","ECT","TPS","O2"].map((s,i)=>`
          <rect x="20" y="${20+i*40}" width="70" height="28" rx="6" fill="var(--surface-2)" stroke="var(--border)"/>
          <text x="55" y="${38+i*40}" text-anchor="middle" font-size="11" fill="currentColor">${s}</text>
          <line x1="90" y1="${34+i*40}" x2="180" y2="120" stroke="var(--ok)" stroke-width="1.5"/>`).join("")}
        ${["Inyectores","Bobinas","Ralentí"].map((a,i)=>`
          <rect x="370" y="${40+i*55}" width="80" height="30" rx="6" fill="var(--surface-2)" stroke="var(--border)"/>
          <text x="410" y="${59+i*55}" text-anchor="middle" font-size="10" fill="currentColor">${a}</text>
          <line x1="280" y1="120" x2="370" y2="${55+i*55}" stroke="var(--accent)" stroke-width="1.5"/>`).join("")}
        <text x="55" y="14" text-anchor="middle" font-size="10" fill="var(--muted)">SENSORES</text>
        <text x="410" y="30" text-anchor="middle" font-size="10" fill="var(--muted)">ACTUADORES</text>
      </svg>
      <figcaption>La ECU lee los sensores (verde), calcula y comanda los actuadores (naranja). Si un sensor miente, todo el cálculo sale mal.</figcaption>
    </figure>`;
  },

  /* ---- Iluminación: faro con relé ---- */
  lighting(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 460 200">
        <rect x="20" y="80" width="26" height="60" rx="4" fill="#3a4b66"/><text x="33" y="160" text-anchor="middle" font-size="10" fill="currentColor">BAT</text>
        <rect x="90" y="60" width="40" height="24" rx="4" fill="#c97a2b"/><text x="110" y="52" text-anchor="middle" font-size="10" fill="currentColor">Fusible</text>
        <rect x="170" y="50" width="60" height="44" rx="6" fill="#2b6cc9"/><text x="200" y="76" text-anchor="middle" fill="#fff" font-size="10">Relé</text>
        <rect x="180" y="120" width="50" height="20" rx="4" fill="var(--surface-2)" stroke="var(--border)"/><text x="205" y="134" text-anchor="middle" font-size="9" fill="currentColor">Llave luces</text>
        <circle cx="360" cy="80" r="24" fill="#f4c542"/><text x="360" y="40" text-anchor="middle" font-size="10" fill="currentColor">Faro</text>
        <line x1="46" y1="95" x2="90" y2="72" stroke="var(--muted)" stroke-width="3"/>
        <line x1="130" y1="72" x2="170" y2="72" stroke="var(--muted)" stroke-width="3"/>
        <line x1="230" y1="72" x2="336" y2="80" stroke="var(--muted)" stroke-width="3"/>
        <line x1="360" y1="104" x2="360" y2="160" stroke="var(--muted)" stroke-width="3"/>
        <path d="M150,140 L360,160" stroke="#555" stroke-width="4"/>
        <text x="300" y="180" text-anchor="middle" font-size="10" fill="currentColor">Masa</text>
      </svg>
      <figcaption>La llave comanda la bobina del relé (corriente chica); el relé pasa toda la corriente del faro (corriente grande). Por eso una falla puede estar en el relé, no en la lámpara.</figcaption>
    </figure>`;
  },

  /* ---- CAN bus con onda animada ---- */
  canbus(el){
    el.innerHTML = `<figure class="figure">
      <svg viewBox="0 0 460 240">
        ${[0,1,2].map(i=>`<rect x="${40+i*150}" y="20" width="90" height="40" rx="6" fill="var(--primary)"/>
          <text x="${85+i*150}" y="45" text-anchor="middle" fill="#fff" font-size="11">ECU ${i+1}</text>
          <line x1="${85+i*150}" y1="60" x2="${85+i*150}" y2="85" stroke="var(--muted)" stroke-width="2"/>`).join("")}
        <line x1="40" y1="90" x2="420" y2="90" stroke="var(--ok)" stroke-width="3"/>
        <line x1="40" y1="105" x2="420" y2="105" stroke="var(--bad)" stroke-width="3"/>
        <text x="430" y="93" font-size="10" fill="var(--ok)">H</text>
        <text x="430" y="108" font-size="10" fill="var(--bad)">L</text>
        <rect x="20" y="85" width="14" height="25" fill="none" stroke="currentColor"/><text x="27" y="130" text-anchor="middle" font-size="9" fill="currentColor">120Ω</text>
        <rect x="426" y="85" width="14" height="25" fill="none" stroke="currentColor"/>
        <polyline id="cwh" points="" fill="none" stroke="var(--ok)" stroke-width="2"/>
        <polyline id="cwl" points="" fill="none" stroke="var(--bad)" stroke-width="2"/>
        <text x="230" y="230" text-anchor="middle" font-size="10" fill="var(--muted)">CAN-H sube y CAN-L baja al transmitir (espejadas)</text>
      </svg>
      <figcaption>Dos cables (CAN-H verde, CAN-L rojo) y dos terminadoras de 120 Ω → ~60 Ω medidos. Las ondas son espejo una de la otra.</figcaption>
    </figure>`;
    const wh=el.querySelector("#cwh"), wl=el.querySelector("#cwl");
    let t=0;
    const bits=[0,1,1,0,1,0,0,1,1,0,1,1,0,0,1,0];
    function draw(){
      let ph="",pl=""; const y0=150;
      for(let x=0;x<=380;x+=4){
        const b=bits[Math.floor((x/24+t)%bits.length)];
        const hy=y0-(b?16:0), ly=y0+(b?16:0);
        ph+=`${40+x},${hy} `; pl+=`${40+x},${ly} `;
      }
      wh.setAttribute("points",ph); wl.setAttribute("points",pl);
      t+=0.4;
    }
    if(el._timer) clearInterval(el._timer);
    el._timer=setInterval(draw,90); draw();
  },

  /* ---- Osciloscopio interactivo ---- */
  scope(el){
    el.innerHTML = `<div class="card">
      <div class="chip-row" id="scChips"></div>
      <canvas id="scCanvas" width="640" height="240" style="width:100%;background:#04130a;border-radius:10px"></canvas>
      <p class="muted" id="scDesc" style="font-size:.85rem;margin:.5rem 0 0"></p>
    </div>`;
    const signals={
      CKP:{label:"CKP inductivo", desc:"Onda senoidal que crece con las RPM. El 'diente faltante' marca la referencia de PMS.", fn:(x)=>{ const gap=(x%200>150&&x%200<170); return gap?0:Math.sin(x*0.25)*Math.min(1,x/100);}},
      Inyector:{label:"Inyector", desc:"Pulso de masa con el pico de inducción (la 'joroba') al cerrar. El ancho = tiempo de inyección.", fn:(x)=>{ const p=x%180; if(p<10) return -0.9; if(p<70) return -0.9; if(p>=70&&p<82) return 1.6; return 0;}},
      Lambda:{label:"Sonda lambda", desc:"Oscila entre 0,1 y 0,9 V cruzando rápido los 0,45 V. Lenta = sonda vaga.", fn:(x)=>Math.sin(x*0.06)>0?0.85:-0.85},
      CAN:{label:"CAN-H / CAN-L", desc:"Dos señales espejadas. Si una falta o hay ruido, hay problema de bus.", fn:(x)=>((Math.floor(x/18)%2)?0.8:-0.2)}
    };
    const chips=el.querySelector("#scChips");
    Object.keys(signals).forEach((k,i)=>{ const c=document.createElement("span"); c.className="chip"+(i===0?" on":""); c.textContent=signals[k].label; c.dataset.k=k; chips.appendChild(c); });
    const cv=el.querySelector("#scCanvas"), ctx=cv.getContext("2d"); let cur="CKP", off=0;
    el.querySelector("#scDesc").textContent=signals.CKP.desc;
    chips.onclick=(e)=>{ if(!e.target.dataset.k)return; cur=e.target.dataset.k;
      [...chips.children].forEach(c=>c.classList.toggle("on",c.dataset.k===cur));
      el.querySelector("#scDesc").textContent=signals[cur].desc; };
    function frame(){
      ctx.clearRect(0,0,cv.width,cv.height);
      ctx.strokeStyle="rgba(95,217,154,.18)"; ctx.lineWidth=1;
      for(let gx=0;gx<cv.width;gx+=40){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,cv.height);ctx.stroke();}
      for(let gy=0;gy<cv.height;gy+=40){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(cv.width,gy);ctx.stroke();}
      ctx.strokeStyle="#9fffce"; ctx.lineWidth=2; ctx.beginPath();
      const mid=cv.height/2, amp=70, f=signals[cur].fn;
      for(let x=0;x<cv.width;x++){ const y=mid-f(x+off)*amp; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }
      ctx.stroke(); off+=2;
      el._raf=requestAnimationFrame(frame);
    }
    if(el._raf) cancelAnimationFrame(el._raf); frame();
  }
};



/* ===========================================================================
   STORE — Progreso y estadísticas (persistencia en localStorage)
   =========================================================================== */


export function mountVisuals(scope: HTMLElement){
  scope.querySelectorAll("[data-visual]").forEach((m)=>{ const fn = VISUALS[m.dataset.visual]; if(fn) try{ fn(m); }catch(e){ console.warn("visual", m.dataset.visual, e); } });
}
