// @ts-nocheck
/* Simulador de tester heredado de ElectroAuto v1. Se monta con Simulator.render(host). */
import BENCHES from "../content/legacy/benches.json";
import { Store } from "../lib/progress";

const Simulator = (() => {
  const FAULTS = {
    todo_ok:"No hay falla (funciona OK)",
    lamp_open:"Lámpara quemada (filamento abierto)",
    fuse_open:"Fusible quemado",
    bad_ground:"Mala masa (caída de tensión)",
    short_ground:"Cortocircuito a masa",
    battery_low:"Batería descargada/floja",
    bad_terminal:"Borne/cable con resistencia",
    no_command:"Falta el positivo de mando",
    no_charge:"Alternador no carga",
    diode:"Diodo del rectificador dañado",
    coil_open:"Bobina de electroválvula cortada",
    ev_ref:"Sin 5 V de referencia (sensor MAP-T)"
  };
  const MODES=[
    {k:"V",   label:"V⎓",  deg:-130, name:"Tensión (continua)"},
    {k:"OHM", label:"Ω",   deg:-78,  name:"Resistencia"},
    {k:"CONT",label:"•))", deg:-26,  name:"Continuidad"},
    {k:"AMP", label:"A⎓",  deg:26,   name:"Pinza amperométrica"},
    {k:"VCA", label:"V~",  deg:78,   name:"Alterna / ripple"},
    {k:"OFF", label:"OFF", deg:130,  name:"Apagado"}
  ];
  let state = { benchIdx:0, scIdx:0, mode:"V", red:null, black:null, active:"red", hold:false };

  const bench = () => BENCHES[state.benchIdx];
  const scenario = () => bench().scenarios[state.scIdx];
  const modeDeg = (k)=> (MODES.find(m=>m.k===k)||{}).deg||0;

  function buildAdj(sc){ const adj={}; (sc.edges||[]).forEach(([a,b,r])=>{ (adj[a]=adj[a]||[]).push([b,r]); (adj[b]=adj[b]||[]).push([a,r]); }); return adj; }
  function resistance(a,b){
    if(a===b) return 0;
    const adj=buildAdj(scenario()); const dist={}, seen={};
    Object.keys(adj).forEach(n=>dist[n]=Infinity);
    if(!(a in adj)||!(b in adj)) return Infinity;
    dist[a]=0;
    while(true){ let u=null,best=Infinity;
      for(const n in dist){ if(!seen[n]&&dist[n]<best){best=dist[n];u=n;} }
      if(u===null) break; seen[u]=true;
      (adj[u]||[]).forEach(([v,r])=>{ if(dist[u]+r<dist[v]) dist[v]=dist[u]+r; }); }
    return dist[b];
  }

  function reading(){
    const sc=scenario(), m=state.mode, r=state.red, b=state.black;
    if(m==="OFF") return {val:"", unit:"", note:"Perilla en OFF — elegí una función.", cls:""};
    const needTwo=(m==="V"||m==="CONT"||m==="OHM");
    if(needTwo && (!r||!b)) return {val:"– – –", unit:"", note:"Apoyá las dos puntas (roja y negra) en dos puntos del circuito.", cls:""};
    switch(m){
      case "V":{
        const v=(sc.pot[r]??0)-(sc.pot[b]??0), av=Math.abs(v);
        let note,cls;
        if(av<0.3){ note="Sin diferencia: mismo potencial o sin tensión en este tramo."; cls="warn"; }
        else if(av>=11){ note="Tensión de línea/batería presente (~12 V)."; cls="ok"; }
        else { note="Tensión parcial: posible caída de tensión o divisor. Revisá dónde se pierde."; cls="warn"; }
        if(av<1) return {val:(v*1000).toFixed(0), unit:"mV ⎓", note, cls};
        return {val:v.toFixed(2), unit:"V ⎓", note, cls};
      }
      case "CONT":{
        const res=resistance(r,b);
        if(res<5) return {val:res.toFixed(1), unit:"Ω", note:"🔊 ¡BEEP! Hay continuidad (camino cerrado).", cls:"ok", beep:true};
        return {val:"OL", unit:"", note:"Sin continuidad: circuito abierto entre esos puntos.", cls:"bad"};
      }
      case "OHM":{
        const res=resistance(r,b);
        if(!isFinite(res)) return {val:"OL", unit:"Ω", note:"Resistencia infinita = circuito abierto (cortado).", cls:"bad"};
        let cls = res<1 ? "bad" : "ok";
        let note = res<1 ? "Casi 0 Ω: posible cortocircuito o conexión directa." : "Valor de resistencia del componente/tramo.";
        if(res>=1000) return {val:(res/1000).toFixed(2), unit:"kΩ", note, cls};
        return {val:res.toFixed(2), unit:"Ω", note, cls};
      }
      case "AMP":{
        const i=sc.current??0;
        return {val:i.toFixed(i>=10?0:2), unit:"A", note: i>0?"Corriente de la malla (pinza en la alimentación).":"No circula corriente (circuito abierto o sin consumo).", cls:i>0?"ok":"bad"};
      }
      case "VCA":{
        const rp=(sc.ripple??0);
        const cls = rp>0.1?"bad":"ok";
        const note = rp>0.1?"Ripple ALTO ⚠ — diodos del rectificador sospechosos.":"Ripple bajo (normal, <50 mV).";
        return {val:(rp*1000).toFixed(0), unit:"mV ~", note, cls};
      }
    }
  }

  function labelEl(n){
    const w = Math.max(38, n.label.length*6.3+14), h=20;
    let x=n.x, y=n.y, anchor="middle";
    if(n.lp==="top"){ y=n.y-26; }
    else if(n.lp==="bottom"){ y=n.y+26; }
    else if(n.lp==="left"){ x=n.x-16; anchor="end"; }
    else if(n.lp==="right"){ x=n.x+16; anchor="start"; }
    let rx;
    if(anchor==="middle") rx=x-w/2;
    else if(anchor==="end") rx=x-w+4; else rx=x-4;
    const ty=y+0;
    return '<g class="term-label">'+
      '<rect x="'+rx+'" y="'+(ty-12)+'" width="'+w+'" height="'+h+'" rx="6" class="lbl-bg"/>'+
      '<text x="'+x+'" y="'+(ty+3)+'" text-anchor="'+anchor+'" class="lbl-tx">'+n.label+'</text></g>';
  }

  function lead(x1,y1,x2,y2,color){
    const mx=(x1+x2)/2+30;
    return '<path d="M'+x1+','+y1+' C'+mx+','+y1+' '+mx+','+y2+' '+x2+','+y2+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-linecap="round" opacity="0.85"/>'+
           '<circle cx="'+x1+'" cy="'+y1+'" r="4" fill="'+color+'"/>';
  }

  function drawBoard(host){
    const wrap=host.querySelector("#simSvgWrap"); const b=bench(), sc=scenario();
    const W=parseFloat(b.viewBox.split(" ")[2]);
    let wires="";
    (b.wires||[]).forEach(poly=>{ const pts=poly.map(p=>p.join(",")).join(" "); wires+='<polyline points="'+pts+'" class="wire"/>'; });
    let flow="";
    if((sc.current||0)>0 && b.flowPath){
      const dur = sc.current>=100 ? 1.6 : 2.6;
      for(let i=0;i<4;i++){
        flow+='<circle r="4.5" class="flow-dot"><animateMotion dur="'+dur+'s" begin="'+(i*(dur/4))+'s" repeatCount="indefinite" path="'+b.flowPath+'"/></circle>';
      }
    }
    let leads="";
    if(state.red){ const n=b.nodes.find(x=>x.id===state.red); leads+=lead(n.x,n.y,W-2,90,"#e53935"); }
    if(state.black){ const n=b.nodes.find(x=>x.id===state.black); leads+=lead(n.x,n.y,W-2,250,"#111827"); }
    let dots="";
    b.nodes.forEach(n=>{
      const sel = state.red===n.id?"sel-red":state.black===n.id?"sel-black":"";
      dots+='<g class="term '+sel+'" data-node="'+n.id+'">'+
        '<circle cx="'+n.x+'" cy="'+n.y+'" r="11" class="term-hit"/>'+
        '<circle cx="'+n.x+'" cy="'+n.y+'" r="7" class="term-dot"/>'+
        (sel?'<circle cx="'+n.x+'" cy="'+n.y+'" r="13" class="term-ring"/>':"")+
      '</g>';
    });
    let labels=""; b.nodes.forEach(n=>labels+=labelEl(n));
    wrap.innerHTML = '<svg id="simSvg" preserveAspectRatio="xMidYMid meet" viewBox="'+b.viewBox+'">'+
      '<g class="layer-wires">'+wires+'</g>'+flow+b.comps+leads+
      '<g class="layer-terms">'+dots+'</g><g class="layer-labels">'+labels+'</g></svg>';
    const svg=wrap.querySelector("#simSvg");
    svg.querySelectorAll(".term").forEach(g=>{
      g.style.cursor="pointer";
      g.onclick=()=>{ const id=g.dataset.node;
        if(state.active==="red"){ state.red=(state.red===id?null:id); if(state.red) state.active="black"; }
        else { state.black=(state.black===id?null:id); if(state.black) state.active="red"; }
        drawBoard(host); updateMeter(host); markActiveBtn(host);
      };
    });
  }

  function meterSVG(){
    const cx=110, cy=120, r=72;
    let fns="";
    MODES.forEach(m=>{
      const a=(m.deg-90)*Math.PI/180, lx=cx+(r+20)*Math.cos(a), ly=cy+(r+20)*Math.sin(a);
      const on=state.mode===m.k;
      fns+='<g class="dial-fn '+(on?'on':'')+'" data-mode="'+m.k+'" style="cursor:pointer">'+
        '<circle cx="'+(cx+(r-4)*Math.cos(a))+'" cy="'+(cy+(r-4)*Math.sin(a))+'" r="3" class="dial-tick"/>'+
        '<text x="'+lx+'" y="'+(ly+4)+'" text-anchor="middle" class="dial-label">'+m.label+'</text></g>';
    });
    return '<svg viewBox="0 0 220 250" class="dial-svg">'+
      '<rect x="6" y="6" width="208" height="238" rx="16" class="dial-body"/>'+
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" class="dial-face"/>'+
      fns+
      '<g transform="rotate('+modeDeg(state.mode)+' '+cx+' '+cy+')">'+
        '<polygon points="'+(cx-7)+','+cy+' '+(cx+7)+','+cy+' '+cx+','+(cy-r+8)+'" class="dial-knob-ptr"/></g>'+
      '<circle cx="'+cx+'" cy="'+cy+'" r="22" class="dial-knob"/>'+
      '<text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" class="dial-knob-tx">SELECT</text></svg>';
  }

  function render(host){
    host.innerHTML =
      '<div class="crumb"><span class="back" data-go="#/inicio">Inicio</span> › Simulador de taller</div>'+
      '<h1>🔧 Simulador de taller</h1>'+
      '<p class="muted">Elegí un banco y una falla. Girá la perilla del tester, apoyá las puntas (clic en los puntos del circuito) y leé. Cuando creas saber qué pasa, resolvé la falla.</p>'+
      '<details class="sim-help"><summary>📖 ¿Cómo leer el esquema y usar el simulador? (tocá para abrir)</summary>'+
      '<div class="sim-help-body">'+
        '<h4>1) Cómo leer el esquema</h4>'+
        '<ul>'+
          '<li>El <b>positivo (+)</b> sale de la batería y recorre el circuito; la corriente atraviesa el consumo y vuelve por la <b>masa (−)</b>, que es el chasis del auto.</li>'+
          '<li>Las <b>líneas grises</b> son los cables. Los <b>círculos con etiqueta</b> son los puntos de medición donde podés apoyar las puntas del tester.</li>'+
          '<li>Los <b>puntos naranjas en movimiento</b> muestran la corriente circulando. Si no se mueven, no hay corriente (circuito abierto o sin alimentación).</li>'+
          '<li><b>Símbolos:</b> batería (rectángulo con + y −), fusible (onda), relé (caja), faro/lámpara (círculo con una X), motor / burro / alternador (círculo con letra), y la masa (las rayitas horizontales que se achican).</li>'+
        '</ul>'+
        '<h4>2) Cómo usar el tester (multímetro)</h4>'+
        '<ul>'+
          '<li><b>Girá la perilla</b> para elegir qué medís:'+
            '<ul>'+
              '<li><b>V⎓ Tensión (continua):</b> diferencia de potencial entre los dos puntos. Para esto el circuito tiene que estar <b>con tensión</b>.</li>'+
              '<li><b>Ω Resistencia:</b> cuánto se opone un componente o tramo. Se mide <b>SIN tensión</b>.</li>'+
              '<li><b>•)) Continuidad:</b> pita (BEEP) si hay camino cerrado (resistencia muy baja). Ideal para fusibles, cables y masas.</li>'+
              '<li><b>A⎓ Pinza amperométrica:</b> la corriente que circula por la malla.</li>'+
              '<li><b>V~ Ripple (alterna):</b> ondulación de alterna en los bornes; sirve para detectar diodos del alternador.</li>'+
            '</ul></li>'+
          '<li>Elegí la <b>punta roja</b> (positivo) o la <b>punta negra</b> (negativo / masa) y hacé <b>clic en un punto</b> del circuito: se dibuja el cable hasta ahí.</li>'+
          '<li>La <b>pantalla</b> muestra el valor con su unidad y, abajo, una <b>interpretación</b> de la lectura. El botón <b>HOLD</b> congela el número.</li>'+
        '</ul>'+
        '<h4>3) Paso a paso</h4>'+
        '<ol>'+
          '<li>Elegí un <b>banco</b> (luces, arranque o carga).</li>'+
          '<li>Elegí una <b>falla</b> (o «Funcionando OK» para ver cómo se mide lo normal).</li>'+
          '<li>Girá la perilla al <b>modo</b> que quieras usar.</li>'+
          '<li>Seleccioná <b>punta roja</b> y <b>punta negra</b> y tocá <b>dos puntos</b> del circuito.</li>'+
          '<li><b>Leé</b> el valor y compará con lo que dice el Objetivo.</li>'+
          '<li>Cuando sepas qué pasa, tocá <b>«¿Cuál es la falla?»</b> y confirmá.</li>'+
        '</ol>'+
        '<p class="sim-help-rule">🔑 <b>Regla de oro:</b> la <b>tensión</b> y la <b>caída de tensión</b> se miden CON el circuito funcionando; la <b>resistencia</b> y la <b>continuidad</b>, SIEMPRE con el circuito SIN tensión.</p>'+
      '</div></details>'+
      '<div class="chip-row" id="benchSel"></div>'+
      '<div class="chip-row" id="scSel"></div>'+
      '<div class="sim-grid">'+
        '<div class="sim-board">'+
          '<div class="sim-board-head"><span class="tag" id="boardName"></span><span class="ignition" id="ignState"></span></div>'+
          '<div id="simSvgWrap"></div>'+
          '<div class="sim-legend"><span><i class="dot-r"></i> Punta roja</span><span><i class="dot-b"></i> Punta negra</span><span><i class="dot-f"></i> Corriente</span></div>'+
        '</div>'+
        '<div class="sim-side">'+
          '<div class="dmm">'+
            meterSVG()+
            '<div class="dmm-screen">'+
              '<div class="dmm-row"><span class="dmm-fn" id="dmmFn"></span><span class="dmm-hold" id="dmmHold">HOLD</span></div>'+
              '<div class="dmm-val"><span id="dmmVal">– – –</span> <span class="dmm-unit" id="dmmUnit"></span></div>'+
            '</div>'+
            '<div class="probe-pick"><button class="probe-btn red" id="probeRed">● Punta roja</button><button class="probe-btn black" id="probeBlack">● Punta negra</button></div>'+
            '<div class="probe-status" id="probeStatus"></div>'+
            '<div class="dmm-note" id="dmmNote"></div>'+
          '</div>'+
          '<div class="card sim-obj"><b>🎯 Objetivo</b><p id="simHint"></p>'+
            '<button class="btn sm accent" id="solveBtn" style="width:100%">¿Cuál es la falla?</button><div id="solveBox"></div></div>'+
        '</div>'+
      '</div>';

    const bs=host.querySelector("#benchSel");
    BENCHES.forEach((b,i)=>{ const c=document.createElement("span"); c.className="chip"+(i===state.benchIdx?" on":""); c.textContent=b.name; c.onclick=()=>{state.benchIdx=i;state.scIdx=0;resetProbes();render(host);}; bs.appendChild(c); });
    const ss=host.querySelector("#scSel");
    bench().scenarios.forEach((s,i)=>{ const c=document.createElement("span"); c.className="chip"+(i===state.scIdx?" on":""); c.textContent=s.name; c.onclick=()=>{state.scIdx=i;resetProbes();render(host);}; ss.appendChild(c); });

    host.querySelector("#boardName").textContent=bench().name;
    host.querySelector("#simHint").textContent=scenario().hint;
    setIgnition(host);
    drawBoard(host);
    wireMeter(host);
    host.querySelector("#solveBtn").onclick=()=>showSolve(host);
    host.querySelectorAll("[data-go]").forEach(a=>a.onclick=()=>location.hash=a.dataset.go);
    updateMeter(host); markActiveBtn(host);
  }

  function setIgnition(host){
    const sc=scenario(), on=(sc.current||0)>0 || Object.values(sc.pot||{}).some(v=>Math.abs(v)>1);
    const e=host.querySelector("#ignState");
    e.innerHTML = on ? '🔌 Contacto/encendido: <b>ON</b>' : '⏻ Sistema: <b>en reposo</b>';
  }

  function resetProbes(){ state.red=null; state.black=null; state.active="red"; }

  function wireMeter(host){
    host.querySelectorAll(".dial-fn").forEach(g=>{ g.onclick=()=>{ state.mode=g.dataset.mode; refreshDial(host); updateMeter(host); }; });
    host.querySelector("#probeRed").onclick=()=>{state.active="red";markActiveBtn(host);};
    host.querySelector("#probeBlack").onclick=()=>{state.active="black";markActiveBtn(host);};
    host.querySelector("#dmmHold").onclick=()=>{ state.hold=!state.hold; host.querySelector("#dmmHold").classList.toggle("on",state.hold); if(!state.hold) updateMeter(host); };
  }
  function refreshDial(host){
    const wrap=host.querySelector(".dmm");
    const tmp=document.createElement("div"); tmp.innerHTML=meterSVG();
    wrap.replaceChild(tmp.firstElementChild, wrap.querySelector(".dial-svg"));
    host.querySelectorAll(".dial-fn").forEach(g=>{ g.onclick=()=>{ state.mode=g.dataset.mode; refreshDial(host); updateMeter(host); }; });
  }
  function markActiveBtn(host){
    const r=host.querySelector("#probeRed"), bl=host.querySelector("#probeBlack");
    if(!r) return;
    r.classList.toggle("active", state.active==="red");
    bl.classList.toggle("active", state.active==="black");
  }

  function updateMeter(host){
    if(state.hold) return;
    const rd=reading(), b=bench();
    const md=MODES.find(m=>m.k===state.mode);
    host.querySelector("#dmmFn").textContent = md?md.name:"";
    host.querySelector("#dmmVal").textContent = rd.val;
    host.querySelector("#dmmUnit").textContent = rd.unit||"";
    const note=host.querySelector("#dmmNote");
    note.textContent = rd.note||"";
    note.className = "dmm-note "+(rd.cls||"");
    const valEl=host.querySelector("#dmmVal");
    valEl.className = rd.cls||"";
    if(rd.beep){ const s=host.querySelector(".dmm-screen"); s.classList.add("beep"); setTimeout(()=>s&&s.classList.remove("beep"),250); }
    const nr=state.red?b.nodes.find(n=>n.id===state.red).label:"—";
    const nb=state.black?b.nodes.find(n=>n.id===state.black).label:"—";
    host.querySelector("#probeStatus").innerHTML='<span class="ps red">Roja: <b>'+nr+'</b></span><span class="ps black">Negra: <b>'+nb+'</b></span>';
  }

  function showSolve(host){
    const sc=scenario(), correct=sc.answer||"todo_ok";
    const pool=Object.keys(FAULTS).filter(k=>k!==correct);
    const opts=[correct];
    while(opts.length<4 && pool.length){ const i=Math.floor(Math.random()*pool.length); opts.push(pool.splice(i,1)[0]); }
    opts.sort(()=>Math.random()-0.5);
    const box=host.querySelector("#solveBox");
    box.innerHTML='<p style="font-size:.88rem;margin:.6rem 0 .3rem"><b>¿Qué falla tiene este banco?</b></p>'+
      opts.map(k=>'<button class="quiz-opt" data-k="'+k+'">'+FAULTS[k]+'</button>').join("");
    box.querySelectorAll(".quiz-opt").forEach(btn=>{
      btn.onclick=()=>{
        box.querySelectorAll(".quiz-opt").forEach(o=>o.classList.add("disabled"));
        const ok=btn.dataset.k===correct;
        btn.classList.add(ok?"correct":"wrong");
        if(!ok) box.querySelector('[data-k="'+correct+'"]').classList.add("correct");
        const key=bench().id+"_"+sc.id;
        Store.recordAnswer("simulador", ok);
        if(ok) Store.markSim(key);
        box.insertAdjacentHTML("beforeend",
          '<div class="explain">'+(ok?"✅ ¡Correcto! ":"❌ La respuesta correcta está marcada. ")+'<br><b>Diagnóstico:</b> '+sc.diag+'</div>');
        
      };
    });
  }

  return { render };
})();



/* ===========================================================================
   APP — Router, render de páginas, quizzes, exámenes, práctica y progreso.
   =========================================================================== */

export default Simulator;
