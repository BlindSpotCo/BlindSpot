'use client';
// components/sunscout/Map3DShadow.js
// Ported from SunScout's components/Map3DShadow.tsx (TS types stripped).
// This is a self-contained srcDoc iframe -- same-origin to BlindSpot's own
// page, not cross-origin -- so it needs no special permissions handling.

import { useEffect, useMemo, useRef } from 'react';

export default function Map3DShadow({ lat, lon, pathData, simTime, simPos, sunTimes, animating, onLocationSelect, onScreenshot, onReady }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (onReady) {
      onReady((label, time, date) => {
        iframeRef.current?.contentWindow?.postMessage({ type: 'captureScreenshot', label, time, date }, '*');
      });
    }
  }, [onReady]);

  const html = useMemo(() => {
    const allPtsJs = JSON.stringify(pathData.map(p => ({
      lon: p.lon, lat: p.lat, shlat: p.shlat, shlon: p.shlon,
      el: Math.round(p.el * 100) / 100, az: Math.round(p.az * 100) / 100,
      time: p.time, iso: p.iso,
    })));
    const mel = Math.round(simPos.elevation * 100) / 100;
    const maz = Math.round(simPos.azimuth * 10) / 10;
    const simIso = pathData[0]?.iso?.slice(0,10) ? `${pathData[0].iso.slice(0,10)}T${simTime}:00` : new Date().toISOString();
    const nowMins = new Date().getHours()*60+new Date().getMinutes();
    let startIdx=0, bd=99999;
    for(let i=0;i<pathData.length;i++){const[h,m]=pathData[i].time.split(':').map(Number);const d=Math.abs(h*60+m-nowMins);if(d<bd){bd=d;startIdx=i;}}

    const steps=20, rd=0.000035, ring=[];
    for(let i=0;i<=steps;i++){const a=2*Math.PI*i/steps;ring.push([lon+rd*Math.cos(a)/Math.cos(lat*Math.PI/180),lat+rd*Math.sin(a)]);}
    const obsGj = JSON.stringify({type:'FeatureCollection',features:[{type:'Feature',properties:{color:'#D1901F',height:0.6,minHeight:0},geometry:{type:'Polygon',coordinates:[ring]}}]});

    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link href="https://cdn.osmbuildings.org/4.1.1/OSMBuildings.css" rel="stylesheet"/>
<script src="https://cdn.osmbuildings.org/4.1.1/OSMBuildings.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
/* This iframe is a separate document (srcDoc), so it can't inherit the
   parent page's CSS custom properties via cascade -- these mirror the
   real brand tokens in app/globals.css so the map's chrome (badges,
   buttons, panel, sun, compass) reads as the same product instead of a
   bolted-on dark/neon-orange tool. Keep these in sync if globals.css
   changes. */
:root{
  --bg-2:#F1E9DA; --paper:#FFFDF8; --ink:#1C1812;
  --line:rgba(28,24,18,0.14); --text-mute:#5A5140; --text-dim:#5B5443;
  --ss:#AF5F30; --ss-fill:#D1901F; --ss-sun:#E9A94A;
  --radius:4px; --radius-md:8px;
}
*{margin:0;padding:0;box-sizing:border-box;font-family:'Inter',sans-serif;}
html,body{background:var(--bg-2);overflow:hidden;}
#map{width:100%;height:100vh;}
.tbadge{position:absolute;top:14px;left:14px;z-index:25;background:rgba(255,253,248,0.94);border:1px solid var(--line);border-radius:var(--radius-md);padding:7px 14px;color:var(--ss);font-size:13px;font-weight:600;font-family:'IBM Plex Mono',monospace;letter-spacing:.04em;pointer-events:none;}
.hint{position:absolute;bottom:12px;left:14px;z-index:25;color:var(--text-mute);font-size:11px;pointer-events:none;font-family:'IBM Plex Mono',monospace;background:rgba(255,253,248,.92);border:1px solid var(--line);padding:5px 14px;border-radius:20px;white-space:nowrap;}
.tile-row{position:absolute;top:14px;left:14px;z-index:25;display:flex;gap:6px;}
.tile-btn{background:rgba(255,253,248,.94);border:1px solid var(--line);color:var(--text-mute);font-size:13px;font-weight:600;font-family:'IBM Plex Mono',monospace;padding:7px 16px;border-radius:var(--radius-md);cursor:pointer;}
.tile-btn.on{border-color:var(--ss);color:var(--ss);background:rgba(175,95,48,.08);}
.cb{background:var(--paper);border:1.5px solid var(--line);color:var(--text-mute);font-size:13px;font-weight:700;padding:7px 11px;border-radius:var(--radius-md);cursor:pointer;line-height:1;}
.cb:hover{border-color:var(--ss);color:var(--ss);background:rgba(175,95,48,.08);}
.cb.N{border-color:var(--ss);color:var(--ss);font-size:10px;font-weight:800;font-family:'IBM Plex Mono',monospace;}
.leaflet-control-attribution,.osmb-attribution{display:none!important;}
.sdk-error{position:absolute;inset:0;z-index:40;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:var(--bg-2);color:var(--ink);font-family:'Inter',sans-serif;text-align:center;padding:24px;}
.sdk-error.show{display:flex;}
.sdk-error button{background:var(--ss);color:#fff;border:none;border-radius:var(--radius-md);padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;}
@media(max-width:768px){.view-controls{display:none!important;}}</style></head><body>
<div id="sdk-error" class="sdk-error">
  <div style="font-size:32px;">🌐</div>
  <div style="font-size:14px;max-width:320px;line-height:1.6;">The 3D map library didn't load — this is usually a slow or blocked connection to the map CDN, not a bug in your data.</div>
  <button onclick="window.location.reload()">↻ Retry</button>
</div>
<div style="position:relative;width:100%;height:100vh;">
  <div id="map"></div>
  <div class="tile-row">
    <button class="tile-btn on" id="bs" onclick="setT('s')">Street</button>
    <button class="tile-btn" id="bsat" onclick="setT('sat')">Satellite</button>
  </div>
  <div class="hint">Click map to move pin · Drag · Scroll zoom · Use buttons to tilt/rotate</div>
  <div class="view-controls" style="position:absolute;top:14px;right:14px;z-index:25;display:flex;flex-direction:column;gap:5px;align-items:center;background:rgba(255,253,248,0.97);border:1px solid var(--line);border-radius:var(--radius-md);padding:10px 9px;box-shadow:0 2px 12px rgba(28,24,18,0.08);">
    <div style="font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px;white-space:nowrap;line-height:1.4;text-align:center;">Set view angle<br/><span style="font-size:10.5px;font-weight:500;color:var(--text-mute);text-transform:none;letter-spacing:0;opacity:0.85;">e.g. balcony view</span></div>
    <button class="cb" id="btn-up">▲</button>
    <div style="display:flex;gap:4px;">
      <button class="cb" id="btn-left">◀</button>
      <button class="cb N" id="btn-n">N</button>
      <button class="cb" id="btn-right">▶</button>
    </div>
    <button class="cb" id="btn-down">▼</button>
  </div>
  <div style="position:absolute;top:192px;right:20px;z-index:25;width:38px;height:38px;pointer-events:none;background:rgba(255,253,248,.94);border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center;">
    <svg id="cmp" width="30" height="30" viewBox="-20 -20 40 40" style="transition:transform .2s;">
      <polygon points="0,-12 3,0 0,3 -3,0" fill="#AF5F30"/>
      <polygon points="0,12 3,0 0,-3 -3,0" fill="#5A5140"/>
      <text x="0" y="-14" text-anchor="middle" fill="#AF5F30" font-size="5.5" font-weight="bold" font-family="'IBM Plex Mono',monospace">N</text>
      <text x="0" y="19" text-anchor="middle" fill="#5A5140" font-size="5.5" font-family="'IBM Plex Mono',monospace">S</text>
      <text x="15" y="3" text-anchor="middle" fill="#5A5140" font-size="5.5" font-family="'IBM Plex Mono',monospace">E</text>
      <text x="-15" y="3" text-anchor="middle" fill="#5A5140" font-size="5.5" font-family="'IBM Plex Mono',monospace">W</text>
    </svg>
  </div>
  <svg id="arc-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:18;overflow:visible;"></svg>
  <div id="sun" style="pointer-events:none;position:absolute;left:0;top:0;display:none;">
    <svg width="44" height="44" viewBox="-26 -26 52 52" style="position:absolute;left:0;top:0;transform:translate(-50%,-50%);filter:drop-shadow(0 0 14px rgba(255,209,60,.9));">
      <circle cx="0" cy="0" r="14" fill="none" stroke="#FFFDF8" stroke-width="2.5" opacity="0.95"/>
      <circle cx="0" cy="0" r="12" fill="#FFD23C"/>
      <g stroke="#FFD23C" stroke-width="2.5" stroke-linecap="round" opacity="0.9">
        <line x1="0" y1="-16" x2="0" y2="-22"/><line x1="0" y1="16" x2="0" y2="22"/>
        <line x1="-16" y1="0" x2="-22" y2="0"/><line x1="16" y1="0" x2="22" y2="0"/>
        <line x1="-11.3" y1="-11.3" x2="-15.6" y2="-15.6"/><line x1="11.3" y1="11.3" x2="15.6" y2="15.6"/>
        <line x1="-11.3" y1="11.3" x2="-15.6" y2="15.6"/><line x1="11.3" y1="-11.3" x2="15.6" y2="-15.6"/>
      </g>
    </svg>
    <div id="sun-time" style="position:absolute;left:0;top:26px;transform:translate(-50%,0);font-size:12.5px;font-weight:600;font-family:'IBM Plex Mono',monospace;background:rgba(255,253,248,.96);color:#1C1812;border:1px solid rgba(28,24,18,0.14);border-radius:7px;padding:3px 10px;white-space:nowrap;">--:--</div>
  </div>
  <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;z-index:22;">
    <div style="width:14px;height:14px;border-radius:50%;background:#AF5F30;border:3px solid #FFFDF8;box-shadow:0 0 0 3px rgba(175,95,48,0.35);"></div>
  </div>
</div>
<script>
// Watchdog: if the OSMBuildings CDN script failed to load/execute (blocked
// network, slow CDN, WebGL unavailable, etc.) everything below throws or
// simply never runs, and the page was previously left as a silent black
// screen with no explanation — indistinguishable from "still loading". Catch
// that here and show a retry affordance instead.
window.onerror = function(){
  try{ var el=document.getElementById('sdk-error'); if(el) el.classList.add('show'); }catch(e){}
  return false;
};
setTimeout(function(){
  try{
    var hasCanvas = document.querySelector('#map canvas');
    if(!hasCanvas){ var el=document.getElementById('sdk-error'); if(el) el.classList.add('show'); }
  }catch(e){}
}, 9000);

const D2R=Math.PI/180;
// NOTE: tile-a/b/c.openstreetmap.fr all resolve to the same single backend
// service (confirmed on OSM France's own forum) — round-robining across them
// gives no real parallelism, so we stick to the one documented-working host.
// The real reliability gap is that this is a small community server with
// occasional 502s; app/api/tile-proxy/route.ts now retries and falls back to
// a second provider instead, which is where that gets fixed.
const TILES={
  s:'/api/sunscout/tile-proxy?url=https://tile-a.openstreetmap.fr/hot/{z}/{x}/{y}.png',
  sat:'/api/sunscout/tile-proxy?url=https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
};

var _cam=(function(){try{var s=window.parent.localStorage.getItem('ss_cam');return s?JSON.parse(s):{rot:0,tilt:0,zoom:17,set:false};}catch(e){return{rot:0,tilt:0,zoom:17,set:false};}})();
var curRot=_cam.set?(_cam.rot||0):0, curTilt=_cam.set?(_cam.tilt||0):0, initZoom=_cam.zoom||17;
var curT='s', tL=null;

// OSMBuildings 4.1.1 doesn't forward a preserveDrawingBuffer option to its WebGL
// context, so without this patch the drawing buffer is cleared between frames and
// screenshot capture below reads back a blank canvas even though the map is visibly
// rendered on screen.
var _origGetContext=HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext=function(type,attrs){
  if(type==='webgl'||type==='experimental-webgl'){attrs=Object.assign({},attrs,{preserveDrawingBuffer:true});}
  return _origGetContext.call(this,type,attrs);
};

const map=new OSMBuildings({container:'map',position:{latitude:${lat},longitude:${lon}},zoom:initZoom,minZoom:13,maxZoom:20,tilt:curTilt,rotation:curRot,effects:['shadows'],attribution:''});
HTMLCanvasElement.prototype.getContext=_origGetContext;
map.setDate(new Date('${simIso}'));
tL=map.addMapTiles(TILES.s);
map.addGeoJSONTiles('https://{s}.data.osmbuildings.org/0.2/59fcc2e8/tile/{z}/{x}/{y}.json');
map.addGeoJSON(${obsGj});

// Always read the map's OWN current tilt/rotation right before saving,
// rather than trusting curTilt/curRot — those only got updated by the +/-
// buttons before, so tilting or rotating by dragging directly on the map
// (a normal gesture in this library) was invisible to save/restore and
// silently reverted on the next reinit. Reading live from the map here
// fixes that regardless of how the angle was actually changed.
function saveCamera(){
  try{
    if(typeof map.getTilt==='function'){var t=map.getTilt(); if(t!=null) curTilt=t;}
    if(typeof map.getRotation==='function'){curRot=((map.getRotation()%360)+360)%360;}
    var z=map.zoom||initZoom;
    window.parent.localStorage.setItem('ss_cam',JSON.stringify({rot:curRot,tilt:curTilt,zoom:z,set:true}));
  }catch(e){}
}
function setT(m){if(m===curT)return;curT=m;if(tL)map.remove(tL);tL=map.addMapTiles(TILES[m]);document.getElementById('bs').className='tile-btn'+(m==='s'?' on':'');document.getElementById('bsat').className='tile-btn'+(m==='sat'?' on':'');}

const allPts=${allPtsJs};
const sunEl=document.getElementById('sun');
const arcSvg=document.getElementById('arc-svg');
let curEl=${mel}, curAz=${maz};

function projectToScreen(az,el){
  const mapEl=document.getElementById('map');
  const W=mapEl.clientWidth||800,H=mapEl.clientHeight||window.innerHeight||600;
  // Two earlier attempts here both had real problems:
  //  1) Math.min() between width/height edge-distances: which one binds
  //     switches abruptly as the sun sweeps -> jagged zigzag.
  //  2) Rigidly rotating a fixed-shape ellipse's POINT: mathematically
  //     preserves each point's distance from center regardless of curRot,
  //     but the ellipse is very anisotropic on a landscape screen (much
  //     wider than tall), so at some rotations that preserved distance
  //     badly overflows the container's height -- the arc stopped
  //     adapting its length to the rotation at all ("same length" as it
  //     turns, extending well past the visible map).
  // Fix: use the closed-form polar equation of the ellipse INSCRIBED IN
  // THE CONTAINER, r(theta)=1/sqrt((sin/halfW)^2+(cos/halfH)^2), evaluated
  // at the sun's screen-relative bearing theta=(az-curRot). This rotates
  // smoothly with the camera (no branching, verified zigzag-free
  // numerically) while always staying within the container -- so it
  // genuinely shrinks/grows with rotation instead of holding constant
  // length, without either the corner-jump bug or the overflow bug.
  const halfW=W/2*0.90, halfH=H/2*0.72;
  const th=(az-curRot)*D2R, s=Math.sin(th), c=Math.cos(th);
  const rEdge=1/Math.sqrt((s/halfW)**2+(c/halfH)**2);
  const f=Math.max(0,el)/90, r=rEdge*(1-f);
  return[W/2+r*s,H/2-r*c];
}

function drawArc(){
  const W=document.getElementById('map').clientWidth||800,H=window.innerHeight||600;
  arcSvg.setAttribute('viewBox','0 0 '+W+' '+H);
  while(arcSvg.firstChild)arcSvg.removeChild(arcSvg.firstChild);
  const ab=allPts.filter(function(p){return p.el>=0;});
  if(ab.length<2)return;
  const sc=ab.map(function(p){return projectToScreen(p.az,p.el);});
  [['rgba(175,95,48,0.12)',14],['rgba(209,144,31,0.22)',6]].forEach(function(c){
    const g=document.createElementNS('http://www.w3.org/2000/svg','polyline');
    g.setAttribute('points',sc.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' '));
    g.setAttribute('fill','none');g.setAttribute('stroke',c[0]);g.setAttribute('stroke-width',c[1]);g.setAttribute('stroke-linecap','round');
    arcSvg.appendChild(g);
  });
  const arc=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  arc.setAttribute('points',sc.map(function(p){return p[0].toFixed(1)+','+p[1].toFixed(1);}).join(' '));
  arc.setAttribute('fill','none');arc.setAttribute('stroke','#AF5F30');arc.setAttribute('stroke-width','2.5');arc.setAttribute('stroke-dasharray','6 9');arc.setAttribute('opacity','0.85');
  arcSvg.appendChild(arc);
  ab.forEach(function(p,i){if(i%3!==0)return;const s=projectToScreen(p.az,p.el);const d=document.createElementNS('http://www.w3.org/2000/svg','circle');d.setAttribute('cx',s[0].toFixed(1));d.setAttribute('cy',s[1].toFixed(1));d.setAttribute('r','2.5');d.setAttribute('fill','#FFD23C');d.setAttribute('opacity','0.85');arcSvg.appendChild(d);});
  var riseLabel='Rise ' + '${sunTimes.rise}', setLabel='Set ' + '${sunTimes.set}';
  [{pt:sc[0],txt:riseLabel,anchor:'end'},{pt:sc[sc.length-1],txt:setLabel,anchor:'start'}].forEach(function(lbl){
    const ci=document.createElementNS('http://www.w3.org/2000/svg','circle');ci.setAttribute('cx',lbl.pt[0].toFixed(1));ci.setAttribute('cy',lbl.pt[1].toFixed(1));ci.setAttribute('r','4.5');ci.setAttribute('fill','#AF5F30');arcSvg.appendChild(ci);
    const t=document.createElementNS('http://www.w3.org/2000/svg','text');t.setAttribute('x',(lbl.pt[0]+(lbl.anchor==='end'?-10:10)).toFixed(1));t.setAttribute('y',(lbl.pt[1]-8).toFixed(1));t.setAttribute('fill','#1C1812');t.setAttribute('font-size','13');t.setAttribute('font-family',"'IBM Plex Mono',monospace");t.setAttribute('font-weight','600');t.setAttribute('text-anchor',lbl.anchor);t.setAttribute('opacity','0.9');t.textContent=lbl.txt;arcSvg.appendChild(t);
  });
}

function placeSunXY(x,y,visible){
  if(!visible){sunEl.style.display='none';return;}
  sunEl.style.display='block';sunEl.style.left=x+'px';sunEl.style.top=y+'px';
}
function moveSun(az,el){
  if(el<-5){placeSunXY(0,0,false);return;}
  const s=projectToScreen(az,el);
  placeSunXY(s[0],s[1],true);
}

function updateView(p){
  if(p.iso)map.setDate(new Date(p.iso));
  curEl=p.el;curAz=p.az;
  moveSun(p.az,p.el);
  var stm=document.getElementById('stm');if(stm)stm.textContent=p.time;
  var st2=document.getElementById('sun-time');if(st2)st2.textContent=p.time;
}

updateView({el:${mel},az:${maz},time:'${simTime}',iso:'${simIso}'});
drawArc();

var _mmoved=false, _mdx=0, _mdy=0, _tsx=0, _tsy=0;
var mapEl=document.getElementById('map');

mapEl.addEventListener('mousedown',function(e){_mmoved=false;_mdx=e.clientX;_mdy=e.clientY;});
mapEl.addEventListener('mousemove',function(e){if(Math.abs(e.clientX-_mdx)>5||Math.abs(e.clientY-_mdy)>5)_mmoved=true;});
mapEl.addEventListener('click',function(e){
  if(_mmoved)return;
  try{var rect=mapEl.getBoundingClientRect();var pos=map.unproject(e.clientX-rect.left,e.clientY-rect.top);if(pos&&pos.latitude!=null)window.parent.postMessage({type:'map3d_click',lat:pos.latitude,lon:pos.longitude},'*');}catch(err){}
});

mapEl.addEventListener('touchstart',function(e){_mmoved=false;_tsx=e.touches[0].clientX;_tsy=e.touches[0].clientY;},{passive:true});
mapEl.addEventListener('touchmove',function(e){if(Math.abs(e.touches[0].clientX-_tsx)>8||Math.abs(e.touches[0].clientY-_tsy)>8)_mmoved=true;},{passive:true});
mapEl.addEventListener('touchend',function(e){
  if(_mmoved)return;
  var touch=e.changedTouches[0];
  try{var rect=mapEl.getBoundingClientRect();var pos=map.unproject(touch.clientX-rect.left,touch.clientY-rect.top);if(pos&&pos.latitude!=null)window.parent.postMessage({type:'map3d_click',lat:pos.latitude,lon:pos.longitude},'*');}catch(err){}
});

map.on('change',function(){try{var z=map.position?map.position.zoom:initZoom;if(z)initZoom=z;}catch(e){}saveCamera();});
document.getElementById('map').addEventListener('wheel', function(){
  setTimeout(function(){
    try{
      var z = map.zoom || initZoom;
      if(z && z !== initZoom){
        initZoom = z;
        saveCamera();
      }
    }catch(e){}
  }, 300);
}, {passive:true});

map.on('rotate',function(){try{curRot=((map.getRotation()%360)+360)%360;document.getElementById('cmp').style.transform='rotate('+curRot+'deg)';drawArc();}catch(e){}});
map.on('tilt',function(){try{var t=map.getTilt();if(t!=null)curTilt=t;drawArc();}catch(e){}});

// The map's own 'resize' event (fired when its container's dimensions
// change — rotating the phone triggers this) is the officially documented
// signal for this. OSMBuildings recalculates its camera projection from
// scratch on resize and can reset tilt/rotation to 0/0 in the process; the
// 'rotate'/'tilt' listeners above would otherwise pick up and persist that
// reset as if the user had actually reset the view. Re-assert our real
// tracked curRot/curTilt right after resize settles so the library's
// internal reset never wins. Window-level listeners kept as a fallback in
// case this particular library build doesn't fire its own 'resize' event
// reliably inside a sandboxed iframe.
var _resizeT=null;
function _reassertCamera(){
  clearTimeout(_resizeT);
  _resizeT=setTimeout(function(){
    try{
      map.setRotation(curRot);
      map.setTilt(curTilt);
      document.getElementById('cmp').style.transform='rotate('+curRot+'deg)';
      drawArc();
      saveCamera();
    }catch(e){}
  },250);
}
map.on('resize',_reassertCamera);
window.addEventListener('resize',_reassertCamera);
window.addEventListener('orientationchange',_reassertCamera);

function aR(d){curRot=(curRot+d+360)%360;map.setRotation(curRot);document.getElementById('cmp').style.transform='rotate('+curRot+'deg)';drawArc();saveCamera();}
function aT(d){curTilt=Math.max(0,Math.min(70,curTilt+d));map.setTilt(curTilt);drawArc();saveCamera();}
function rst(){curRot=0;curTilt=0;map.setRotation(0);map.setTilt(0);document.getElementById('cmp').style.transform='rotate(0deg)';drawArc();saveCamera();}
document.getElementById('btn-up').onclick=function(){aT(-10);};
document.getElementById('btn-down').onclick=function(){aT(10);};
document.getElementById('btn-left').onclick=function(){aR(-15);};
document.getElementById('btn-right').onclick=function(){aR(15);};
document.getElementById('btn-n').onclick=function(){rst();};

var ai=${startIdx},isAnimating=${animating?'true':'false'};
// Smooth animation: the old version snapped straight from one path point to
// the next every 150ms, so both the sun icon and the shadows visibly jumped
// (choppy, "antediluvian" per feedback) instead of gliding. This drives a
// requestAnimationFrame loop that linearly interpolates elevation/azimuth/date
// between consecutive path points, so the sun and shadows move continuously
// at display refresh rate while still advancing through the real data once
// per POINT_MS -- same overall speed, far smoother motion.
var animFrame=null, animStartT=null, POINT_MS=150;
function lerp(a,b,t){return a+(b-a)*t;}
function lerpAngle(a,b,t){var d=((b-a+540)%360)-180;return a+d*t;}
function interpDate(isoA,isoB,t){var ta=new Date(isoA).getTime(),tb=new Date(isoB).getTime();return new Date(ta+(tb-ta)*t);}
function animTick(ts){
  if(!isAnimating){animFrame=null;return;}
  if(animStartT===null)animStartT=ts;
  var t=Math.min(1,(ts-animStartT)/POINT_MS);
  var p0=allPts[ai],p1=allPts[(ai+1)%allPts.length];
  var el=lerp(p0.el,p1.el,t),az=lerpAngle(p0.az,p1.az,t);
  curEl=el;curAz=az;
  // Interpolating az/el then re-projecting doesn't trace the same path as
  // the drawn arc: projectToScreen is non-linear (sin/cos), so a straight
  // line in az/el space is a curved line on screen -- the icon would drift
  // off the polyline drawArc() actually draws between these two points.
  // Interpolating the two points' own screen positions instead guarantees
  // the icon always sits exactly on that same straight segment.
  if(p0.el<-5&&p1.el<-5){
    placeSunXY(0,0,false);
  }else{
    // drawArc() only plots points with el>=0. If one side of this pair
    // falls below that (just past sunrise/before sunset), interpolating
    // toward its projection slides the icon toward a point that was never
    // actually drawn. Clamp each side's elevation to >=0 for this
    // projection so the icon never targets anywhere off the visible line.
    var s0=projectToScreen(p0.az,Math.max(0,p0.el)), s1=projectToScreen(p1.az,Math.max(0,p1.el));
    placeSunXY(lerp(s0[0],s1[0],t), lerp(s0[1],s1[1],t), true);
  }
  try{map.setDate(interpDate(p0.iso,p1.iso,t));}catch(e){}
  var stm=document.getElementById('stm');if(stm)stm.textContent=p0.time;
  var st2=document.getElementById('sun-time');if(st2)st2.textContent=p0.time;
  drawArc();
  if(t>=1){ai=(ai+1)%allPts.length;animStartT=ts;}
  animFrame=requestAnimationFrame(animTick);
}
function startAnim(){if(animFrame)return;animStartT=null;animFrame=requestAnimationFrame(animTick);}
function stopAnim(){if(animFrame){cancelAnimationFrame(animFrame);animFrame=null;}}
if(isAnimating)startAnim();

window.addEventListener('message',function(e){
  if(!e.data)return;
  if(e.data.type==='setAnimating'){isAnimating=e.data.value;if(isAnimating)startAnim();else stopAnim();}
  if(e.data.type==='seekTime'&&!isAnimating){
    var parts=e.data.time.split(':'),mins=parseInt(parts[0])*60+parseInt(parts[1]),best=0,bd=99999;
    for(var j=0;j<allPts.length;j++){var t=allPts[j].time.split(':'),d=Math.abs(parseInt(t[0])*60+parseInt(t[1])-mins);if(d<bd){bd=d;best=j;}}
    ai=best;updateView(allPts[best]);drawArc();
  }
  if(e.data.type==='captureScreenshot'){
    console.log('[Map3DShadow iframe] captureScreenshot message received for:', e.data.label);
    var lbl=e.data.label;
    var capTime=e.data.time;
    var capDate=e.data.date;
    isAnimating=false;
    stopAnim();
    if(capDate){
      try{ map.setDate(new Date(capDate+'T'+capTime+':00')); }catch(err){}
    }
    var parts2=capTime.split(':'),mins2=parseInt(parts2[0])*60+parseInt(parts2[1]),best2=0,bd2=99999;
    for(var k=0;k<allPts.length;k++){var t2=allPts[k].time.split(':'),d2=Math.abs(parseInt(t2[0])*60+parseInt(t2[1])-mins2);if(d2<bd2){bd2=d2;best2=k;}}
    ai=best2;updateView(allPts[best2]);drawArc();
    if(!allPts||allPts.length===0){console.warn('[Map3DShadow iframe] allPts empty, sending null screenshot');window.parent.postMessage({type:'screenshotReady',label:lbl,data:null},'*');return;}

    // Wait for tiles/shadows to render, then composite into a FIXED output size
    // so every screenshot in the report is identical dimensions regardless of
    // the live iframe's viewport at capture time.
    setTimeout(function(){
      try{
        var liveW=window.innerWidth, liveH=window.innerHeight;
        var CAP_W=960, CAP_H=640;

        var raw=document.createElement('canvas');
        raw.width=liveW; raw.height=liveH;
        var rctx=raw.getContext('2d');
        rctx.fillStyle='#F1E9DA';
        rctx.fillRect(0,0,liveW,liveH);
        try{
          var glCanvas=document.querySelector('#map canvas');
          if(glCanvas){
            console.log('[Map3DShadow iframe] compositing: found #map canvas, size '+glCanvas.width+'x'+glCanvas.height+', drawing onto '+liveW+'x'+liveH+' capture canvas');
            rctx.drawImage(glCanvas,0,0,liveW,liveH);
          } else {
            var mapEl0=document.getElementById('map');
            console.warn('[Map3DShadow iframe] compositing: no canvas found inside #map -- screenshot will be blank/black. #map innerHTML starts with:', mapEl0 ? mapEl0.innerHTML.slice(0,200) : 'no #map element at all');
          }
        }catch(err){
          console.error('[Map3DShadow iframe] compositing: drawImage(glCanvas) threw:', err);
        }

        var svgEl=document.getElementById('arc-svg');
        var svgData=new XMLSerializer().serializeToString(svgEl);
        var svgBlob=new Blob([svgData],{type:'image/svg+xml'});
        var svgUrl=URL.createObjectURL(svgBlob);
        var svgImg=new Image();

        function finish(){
          var out=document.createElement('canvas');
          out.width=CAP_W; out.height=CAP_H;
          var octx=out.getContext('2d');
          octx.drawImage(raw,0,0,liveW,liveH,0,0,CAP_W,CAP_H);
          try{
            var dataUrl=out.toDataURL('image/jpeg',0.85);
            console.log('[Map3DShadow iframe] sending screenshotReady for "'+lbl+'", '+Math.round(dataUrl.length/1024)+'KB');
            window.parent.postMessage({type:'screenshotReady',label:lbl,data:dataUrl},'*');
          }catch(err){
            console.error('[Map3DShadow iframe] toDataURL failed (tainted canvas) for "'+lbl+'":', err);
            window.parent.postMessage({type:'screenshotReady',label:lbl,data:null,error:'tainted_canvas'},'*');
          }
        }

        svgImg.onload=function(){
          rctx.drawImage(svgImg,0,0,liveW,liveH);
          URL.revokeObjectURL(svgUrl);
          var sunDiv=document.getElementById('sun');
          if(sunDiv&&sunDiv.style.display!=='none'){
            // Matches the on-screen #sun SVG (circle + rays, brand gold) instead
            // of the old emoji glyph, so exported report images look like what
            // the user actually saw in the live view.
            var sx=parseFloat(sunDiv.style.left||'0'), sy=parseFloat(sunDiv.style.top||'0');
            rctx.save();
            rctx.translate(sx,sy);
            rctx.strokeStyle='#FFD23C';rctx.lineWidth=2.5;rctx.lineCap='round';rctx.globalAlpha=0.9;
            [[0,-16,0,-22],[0,16,0,22],[-16,0,-22,0],[16,0,22,0],[-11.3,-11.3,-15.6,-15.6],[11.3,11.3,15.6,15.6],[-11.3,11.3,-15.6,15.6],[11.3,-11.3,15.6,-15.6]].forEach(function(r){
              rctx.beginPath();rctx.moveTo(r[0],r[1]);rctx.lineTo(r[2],r[3]);rctx.stroke();
            });
            rctx.globalAlpha=0.95;rctx.strokeStyle='#FFFDF8';rctx.lineWidth=2.5;
            rctx.beginPath();rctx.arc(0,0,14,0,Math.PI*2);rctx.stroke();
            rctx.globalAlpha=1;rctx.fillStyle='#FFD23C';
            rctx.beginPath();rctx.arc(0,0,12,0,Math.PI*2);rctx.fill();
            rctx.restore();
          }
          rctx.fillStyle='rgba(175,95,48,0.9)';
          rctx.font='bold 16px monospace';
          rctx.fillText(lbl,20,40);
          finish();
        };
        svgImg.onerror=function(){
          console.warn('[Map3DShadow iframe] svgImg.onerror fired for "'+lbl+'"');
          rctx.fillStyle='rgba(175,95,48,0.9)';
          rctx.font='bold 20px monospace';
          rctx.fillText(lbl+' — map render unavailable',40,liveH/2);
          finish();
        };
        svgImg.src=svgUrl;
      }catch(err){
        console.error('[Map3DShadow iframe] captureScreenshot outer catch for "'+lbl+'":', err);
        window.parent.postMessage({type:'screenshotReady',label:lbl,data:null},'*');
      }
    },4200);
  }
});
</script></body></html>`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, pathData.length > 0 ? pathData[0].iso.slice(0,10) : '']);

  useEffect(() => {
    const handler = (e) => {
      if(e.data?.type==='map3d_click' && onLocationSelect) onLocationSelect(e.data.lat, e.data.lon);
      if(e.data?.type==='screenshotReady' && onScreenshot) onScreenshot(e.data.label, e.data.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onLocationSelect, onScreenshot]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({type:'setAnimating',value:animating},'*');
  }, [animating]);

  useEffect(() => {
    if(!animating) iframeRef.current?.contentWindow?.postMessage({type:'seekTime',time:simTime},'*');
  }, [simTime, animating]);

  return <iframe ref={iframeRef} srcDoc={html} style={{width:'100%',height:'100%',border:'none',display:'block'}} sandbox="allow-scripts allow-same-origin"/>;
}