import * as THREE from "three";

// ═══════════════════════════════════════════════
//  CONFIG
// ═══════════════════════════════════════════════
const WEAPONS = [
  { name:"Pistol",        dmg:18, rate:0.22, ammo:Infinity, spread:0.015, speed:80, color:0xffdd44, pellets:1 },
  { name:"Rifle",         dmg:22, rate:0.10, ammo:150,     spread:0.012, speed:90, color:0xff8844, pellets:1 },
  { name:"Shotgun",       dmg:12, rate:0.65, ammo:40,      spread:0.065, speed:60, color:0xff4422, pellets:6 },
  { name:"Energy Cannon", dmg:55, rate:1.0,  ammo:20,      spread:0.004, speed:50, color:0x44aaff, pellets:1 },
];

const EDEF = {
  grunt:   { hp:40,  dmg:10, speed:7,   score:100,  color:0xcc3333, s:1,   range:2.8 },
  shooter: { hp:55,  dmg:14, speed:4,   score:200,  color:0x9933cc, s:1,   range:22  },
  heavy:   { hp:150, dmg:22, speed:3,   score:500,  color:0x884422, s:1.4, range:18  },
  sniper:  { hp:45,  dmg:32, speed:2,   score:350,  color:0x3366cc, s:1,   range:45  },
  boss:    { hp:900, dmg:28, speed:2.5, score:5000, color:0xff2222, s:3,   range:28  },
};

const LEVELS = [
  { name:"City Assault", theme:"city",   count:12, types:["grunt","shooter"],                 bg:0x0a1628, fog:0x0a1628 },
  { name:"Jungle Hunt",  theme:"jungle", count:18, types:["grunt","shooter","heavy"],         bg:0x081c08, fog:0x081c08 },
  { name:"Ice Cavern",   theme:"ice",    count:22, types:["grunt","shooter","heavy","sniper"],bg:0x122840, fog:0x1a2e48 },
  { name:"Final Battle", theme:"space",  count:28, types:["grunt","shooter","heavy","sniper"],bg:0x080018, fog:0x080018 },
];

// ═══════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════
let state = "title";
let level = 0, score = 0, kills = 0, lives = 3;
let hp = 100, yaw = 0, pitch = -0.15;
let vel = new THREE.Vector3(), onGround = true, locked = false;
let lastShot = 0, wIdx = 0;
let ammo = WEAPONS.map(w => w.ammo);
let bossActive = false, bossRef = null;
const enemies = [], bullets = [], eBullets = [], particles = [], pickups = [];
const keys = {};

// ═══════════════════════════════════════════════
//  THREE SETUP
// ═══════════════════════════════════════════════
const canvas = document.getElementById("gameCanvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 300);
const clock = new THREE.Clock();

const amb = new THREE.AmbientLight(0x4466aa, 0.5);
scene.add(amb);
const sun = new THREE.DirectionalLight(0xfff0dd, 1.3);
sun.position.set(15, 25, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.near=0.5; sc.far=80; sc.left=-40; sc.right=40; sc.top=40; sc.bottom=-40;
scene.add(sun);

// ═══════════════════════════════════════════════
//  PLAYER MODEL
// ═══════════════════════════════════════════════
const player = new THREE.Group();
scene.add(player);

function buildPlayer(){
  const M=(c,m=0.1,r=0.6)=>new THREE.MeshStandardMaterial({color:c,metalness:m,roughness:r});
  const add=(g,m,x,y,z)=>{
    const mesh=new THREE.Mesh(g,m);
    mesh.position.set(x,y,z); mesh.castShadow=true; player.add(mesh); return mesh;
  };
  add(new THREE.BoxGeometry(0.55,0.75,0.32),M(0x2d5016),0,1.05,0);
  add(new THREE.SphereGeometry(0.24,8,8),M(0xf4c47c),0,1.68,0);
  add(new THREE.BoxGeometry(0.42,0.12,0.28),M(0xcc2222),0,1.86,0);
  add(new THREE.BoxGeometry(0.16,0.55,0.16),M(0x2d5016),-0.42,1.18,0);
  add(new THREE.BoxGeometry(0.16,0.55,0.16),M(0x2d5016),0.42,1.18,0.12);
  add(new THREE.BoxGeometry(0.18,0.65,0.2),M(0x3a3a2a),-0.16,0.32,0);
  add(new THREE.BoxGeometry(0.18,0.65,0.2),M(0x3a3a2a),0.16,0.32,0);
  add(new THREE.BoxGeometry(0.1,0.1,0.65),M(0x333333,0.8),0.42,1.35,0.42);
}
buildPlayer();

// ═══════════════════════════════════════════════
//  ENVIRONMENTS
// ═══════════════════════════════════════════════
let envGroup = new THREE.Group();
scene.add(envGroup);

function clearEnv(){
  while(envGroup.children.length){
    const c=envGroup.children[0];
    c.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
    envGroup.remove(c);
  }
}

function makeGround(size,color){
  const g=new THREE.Mesh(new THREE.PlaneGeometry(size,size),
    new THREE.MeshStandardMaterial({color,roughness:0.85}));
  g.rotation.x=-Math.PI/2; g.receiveShadow=true; envGroup.add(g);
}

function buildCity(){
  makeGround(180,0x282838);
  for(let i=0;i<35;i++){
    const w=3+Math.random()*5,h=5+Math.random()*22,d=3+Math.random()*5;
    const cols=[0x1a1a2e,0x16213e,0x0f3460,0x2a2a4a];
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
      new THREE.MeshStandardMaterial({color:cols[~~(Math.random()*4)],roughness:0.7}));
    const a=Math.random()*Math.PI*2,r=18+Math.random()*55;
    b.position.set(Math.cos(a)*r,h/2,Math.sin(a)*r);
    b.castShadow=b.receiveShadow=true; envGroup.add(b);
    // glowing windows
    for(let j=0;j<~~(h/2);j++){
      if(Math.random()>0.55){
        const w2=new THREE.Mesh(new THREE.BoxGeometry(0.35,0.35,0.06),
          new THREE.MeshBasicMaterial({color:0xffee88}));
        w2.position.set(b.position.x+(Math.random()-0.5)*w*0.7,1+j*2.2,b.position.z+d/2+0.04);
        envGroup.add(w2);
      }
    }
  }
  for(let i=0;i<6;i++){
    const p=new THREE.PointLight(0xffee88,0.5,14);
    const a=(i/6)*Math.PI*2;
    p.position.set(Math.cos(a)*14,5,Math.sin(a)*14); envGroup.add(p);
  }
}

function buildJungle(){
  makeGround(180,0x1a3a1a);
  for(let i=0;i<45;i++){
    const th=4+Math.random()*3;
    const t=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.45,th,6),
      new THREE.MeshStandardMaterial({color:0x4a3520}));
    const a=Math.random()*Math.PI*2,r=12+Math.random()*55;
    t.position.set(Math.cos(a)*r,th/2,Math.sin(a)*r);
    t.castShadow=true; envGroup.add(t);
    const l=new THREE.Mesh(new THREE.SphereGeometry(1.5+Math.random()*1.5,6,6),
      new THREE.MeshStandardMaterial({color:0x2a6a2a+~~(Math.random()*0x0a200a)}));
    l.position.set(t.position.x,th+1,t.position.z);
    l.castShadow=true; envGroup.add(l);
  }
  for(let i=0;i<18;i++){
    const r=new THREE.Mesh(new THREE.DodecahedronGeometry(0.5+Math.random()*1.2),
      new THREE.MeshStandardMaterial({color:0x4a4a4a}));
    const a=Math.random()*Math.PI*2,d=8+Math.random()*35;
    r.position.set(Math.cos(a)*d,0.3,Math.sin(a)*d);
    r.castShadow=r.receiveShadow=true; envGroup.add(r);
  }
}

function buildIce(){
  makeGround(180,0x88aacc);
  for(let i=0;i<40;i++){
    const h=2+Math.random()*7;
    const c=new THREE.Mesh(new THREE.ConeGeometry(0.4+Math.random(),h,5),
      new THREE.MeshStandardMaterial({color:0x88ccff,transparent:true,opacity:0.7,
        emissive:0x2244aa,emissiveIntensity:0.15,metalness:0.3,roughness:0.1}));
    const a=Math.random()*Math.PI*2,d=10+Math.random()*55;
    c.position.set(Math.cos(a)*d,h/2,Math.sin(a)*d);
    c.rotation.y=Math.random()*Math.PI; c.castShadow=true; envGroup.add(c);
  }
  for(let i=0;i<14;i++){
    const wall=new THREE.Mesh(new THREE.BoxGeometry(1,3+Math.random()*5,6+Math.random()*10),
      new THREE.MeshStandardMaterial({color:0x6699cc,transparent:true,opacity:0.55,roughness:0.2}));
    const a=(i/14)*Math.PI*2;
    wall.position.set(Math.cos(a)*35,wall.geometry.parameters.height/2,Math.sin(a)*35);
    wall.rotation.y=a; wall.castShadow=true; envGroup.add(wall);
  }
}

function buildSpace(){
  makeGround(120,0x222244);
  for(let i=0;i<8;i++){
    const p=new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,14,6),
      new THREE.MeshStandardMaterial({color:0x6622cc,emissive:0x4411aa,emissiveIntensity:0.5}));
    const a=(i/8)*Math.PI*2;
    p.position.set(Math.cos(a)*20,7,Math.sin(a)*20); p.castShadow=true; envGroup.add(p);
  }
  for(let i=0;i<120;i++){
    const s=new THREE.Mesh(new THREE.SphereGeometry(0.08+Math.random()*0.18,4,4),
      new THREE.MeshBasicMaterial({color:new THREE.Color().setHSL(Math.random(),0.4,0.85)}));
    s.position.set((Math.random()-0.5)*180,10+Math.random()*70,(Math.random()-0.5)*180);
    envGroup.add(s);
  }
}

function buildLevel(idx){
  clearEnv();
  const lv=LEVELS[idx];
  scene.background=new THREE.Color(lv.bg);
  scene.fog=new THREE.Fog(lv.fog,25,130);
  ({city:buildCity,jungle:buildJungle,ice:buildIce,space:buildSpace}[lv.theme])();
}

// ═══════════════════════════════════════════════
//  ENEMIES
// ═══════════════════════════════════════════════
function spawnEnemy(type,pos){
  const d=EDEF[type],s=d.s;
  const g=new THREE.Group();
  const M=c=>new THREE.MeshStandardMaterial({color:c,roughness:0.5});
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};

  add(new THREE.BoxGeometry(0.65*s,0.9*s,0.35*s),M(d.color),0,1*s,0);
  add(new THREE.SphereGeometry(0.28*s,8,8),M(d.color+0x222222),0,1.7*s,0);
  add(new THREE.BoxGeometry(0.16*s,0.6*s,0.16*s),M(d.color),-0.45*s,1.1*s,0);
  add(new THREE.BoxGeometry(0.16*s,0.6*s,0.16*s),M(d.color),0.45*s,1.1*s,0.12);
  add(new THREE.BoxGeometry(0.2*s,0.62*s,0.22*s),M(d.color-0x222222),-0.18*s,0.32*s,0);
  add(new THREE.BoxGeometry(0.2*s,0.62*s,0.22*s),M(d.color-0x222222),0.18*s,0.32*s,0);
  // glowing eyes
  const em=new THREE.MeshBasicMaterial({color:0xff2222});
  add(new THREE.SphereGeometry(0.07*s,4,4),em,-0.11*s,1.76*s,0.25*s);
  add(new THREE.SphereGeometry(0.07*s,4,4),em,0.11*s,1.76*s,0.25*s);

  if(type==="boss"){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.8,0.28,8,16),
      new THREE.MeshStandardMaterial({color:0xff4444,emissive:0xff2222,emissiveIntensity:0.5,metalness:0.5}));
    ring.position.y=2.2; ring.rotation.x=Math.PI/4; g.add(ring);
    for(const side of[-1,1]){
      const c=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,1.4,8),
        new THREE.MeshStandardMaterial({color:0x666666,metalness:0.8}));
      c.rotation.z=side*Math.PI/2; c.position.set(side*1.4,1.5,1); g.add(c);
    }
  }

  g.position.copy(pos);
  scene.add(g);
  const e={group:g,type,hp:d.hp,maxHp:d.hp,dmg:d.dmg,speed:d.speed,score:d.score,
    range:d.range,atkCd:0,isBoss:type==="boss",phase:1};
  enemies.push(e);
  return e;
}

function spawnWave(){
  const lv=LEVELS[level];
  for(let i=0;i<lv.count;i++){
    const type=lv.types[~~(Math.random()*lv.types.length)];
    const a=Math.random()*Math.PI*2,r=28+Math.random()*30;
    spawnEnemy(type,new THREE.Vector3(
      player.position.x+Math.cos(a)*r,0,
      player.position.z+Math.sin(a)*r
    ));
  }
  showMessage(`LEVEL ${level+1}: ${lv.name.toUpperCase()}`,2800);
}

function spawnBoss(){
  const a=Math.random()*Math.PI*2;
  const b=spawnEnemy("boss",new THREE.Vector3(
    player.position.x+Math.cos(a)*38,0,
    player.position.z+Math.sin(a)*38
  ));
  bossRef=b; bossActive=true;
  showMessage("⚠  BOSS APPEARS!  ⚠",3500);
}

// ═══════════════════════════════════════════════
//  PROJECTILES
// ═══════════════════════════════════════════════
function spawnBullet(from,dir,dmg,color,speed=80){
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.12,6,6),
    new THREE.MeshBasicMaterial({color}));
  m.position.copy(from); scene.add(m);
  bullets.push({mesh:m,dir:dir.clone().normalize().multiplyScalar(speed),dmg,life:2});
}

function spawnEBullet(from,dir,dmg){
  const m=new THREE.Mesh(new THREE.SphereGeometry(0.15,6,6),
    new THREE.MeshBasicMaterial({color:0xff4422}));
  m.position.copy(from); scene.add(m);
  eBullets.push({mesh:m,dir:dir.clone().normalize().multiplyScalar(22),dmg,life:3});
}

// ═══════════════════════════════════════════════
//  PARTICLES & EFFECTS
// ═══════════════════════════════════════════════
function burst(pos,color,count=10,speed=6){
  for(let i=0;i<count;i++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(0.1+Math.random()*0.15,4,4),
      new THREE.MeshBasicMaterial({color,transparent:true,opacity:1}));
    m.position.copy(pos); scene.add(m);
    particles.push({
      mesh:m,
      vel:new THREE.Vector3((Math.random()-0.5)*speed,Math.random()*speed*0.7,(Math.random()-0.5)*speed),
      life:0.5+Math.random()*0.5
    });
  }
}

function muzzleFlash(pos){
  const l=new THREE.PointLight(0xffaa22,2,8);
  l.position.copy(pos); scene.add(l);
  setTimeout(()=>scene.remove(l),60);
}

function flashDamage(){
  const el=document.getElementById("damageFlash");
  el.classList.add("flash");
  setTimeout(()=>el.classList.remove("flash"),120);
}

function dropPickup(pos){
  if(Math.random()>0.3) return;
  const isHP=Math.random()>0.5;
  const color=isHP?0x44ff44:0xffaa44;
  const m=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,0.5),
    new THREE.MeshBasicMaterial({color}));
  m.position.copy(pos); m.position.y=0.6;
  scene.add(m);
  pickups.push({mesh:m,isHP});
}

// ═══════════════════════════════════════════════
//  HUD
// ═══════════════════════════════════════════════
function updateHUD(){
  const $=id=>document.getElementById(id);
  $("hpFill").style.width=Math.max(0,hp)+"%";
  $("hpText").textContent=`${Math.ceil(hp)}/100`;
  $("livesText").textContent="♥".repeat(Math.max(0,lives));
  $("scoreText").textContent=score.toLocaleString();
  $("killsText").textContent=kills;
  $("levelText").textContent=`${level+1}: ${LEVELS[level].name}`;
  $("weaponName").textContent=WEAPONS[wIdx].name.toUpperCase();
  $("ammoText").textContent=ammo[wIdx]===Infinity?"∞":ammo[wIdx];

  if(bossActive&&bossRef){
    $("bossBar").classList.remove("hidden");
    $("bossHpFill").style.width=(bossRef.hp/bossRef.maxHp*100)+"%";
    $("bossName").textContent=`${LEVELS[level].name.toUpperCase()} BOSS — ${Math.ceil(bossRef.hp)}/${bossRef.maxHp}`;
  } else {
    $("bossBar").classList.add("hidden");
  }

  // weapon slots
  $("ammoSlots").innerHTML=WEAPONS.map((w,i)=>
    `<div class="slot ${i===wIdx?'active':''}">${i+1} ${w.name}<br>${ammo[i]===Infinity?'∞':ammo[i]}</div>`
  ).join("");
}

function showMessage(text,dur=2000){
  const el=document.getElementById("message");
  el.textContent=text;
  el.classList.remove("hidden");
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.add("hidden"),dur);
}

// ═══════════════════════════════════════════════
//  INPUT
// ═══════════════════════════════════════════════
addEventListener("keydown",e=>{
  keys[e.code]=true;
  if(e.code==="Digit1") wIdx=0;
  if(e.code==="Digit2") wIdx=1;
  if(e.code==="Digit3") wIdx=2;
  if(e.code==="Digit4") wIdx=3;
  if(e.code==="KeyR") ammo[wIdx]=WEAPONS[wIdx].ammo;
});

canvas.addEventListener("click",()=>{
  if(state==="title"||state==="gameover"||state==="victory"){ startGame(); return; }
  canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange",()=>{
  locked=document.pointerLockElement===canvas;
});

document.addEventListener("mousemove",e=>{
  if(!locked) return;
  yaw-=e.movementX*0.002;
  pitch-=e.movementY*0.002;
  pitch=Math.max(-0.6,Math.min(0.5,pitch));
});

canvas.addEventListener("mousedown",e=>{
  if(!locked||state!=="playing") return;
  if(e.button===0) shoot();
});

function shoot(){
  const w=WEAPONS[wIdx];
  const now=performance.now()/1000;
  if(now-lastShot<w.rate) return;
  if(ammo[wIdx]<=0){ showMessage("Out of ammo! Press R to reload",1500); return; }
  lastShot=now;
  if(ammo[wIdx]!==Infinity) ammo[wIdx]--;

  const from=player.position.clone().add(
    new THREE.Vector3(0,1.35,0.8).applyAxisAngle(new THREE.Vector3(0,1,0),yaw)
  );
  muzzleFlash(from);

  for(let i=0;i<(w.pellets||1);i++){
    const dir=new THREE.Vector3(
      Math.sin(yaw)*Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw)*Math.cos(pitch)
    );
    dir.x+=(Math.random()-0.5)*w.spread;
    dir.y+=(Math.random()-0.5)*w.spread;
    dir.z+=(Math.random()-0.5)*w.spread;
    spawnBullet(from,dir,w.dmg,w.color,w.speed);
  }
}

// ═══════════════════════════════════════════════
//  CAMERA
// ═══════════════════════════════════════════════
const camPos=new THREE.Vector3(0,10,20);

function updateCamera(dt){
  const dist=7, height=3.5;
  const offset=new THREE.Vector3(
    -Math.sin(yaw)*dist,
    height+pitch*5,
    -Math.cos(yaw)*dist
  );
  const target=player.position.clone().add(offset);
  camPos.lerp(target,1-Math.pow(0.001,dt));
  camera.position.copy(camPos);
  camera.lookAt(player.position.x,player.position.y+1.5,player.position.z);
}

// ═══════════════════════════════════════════════
//  GAME LOGIC
// ═══════════════════════════════════════════════
function updatePlayer(dt){
  const speed=keys["ShiftLeft"]?13:8;
  const fwd=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
  const right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const move=new THREE.Vector3();
  if(keys["KeyW"]||keys["ArrowUp"]) move.add(fwd);
  if(keys["KeyS"]||keys["ArrowDown"]) move.sub(fwd);
  if(keys["KeyD"]||keys["ArrowRight"]) move.add(right);
  if(keys["KeyA"]||keys["ArrowLeft"]) move.sub(right);
  if(move.length()>0) move.normalize().multiplyScalar(speed*dt);
  player.position.add(move);
  player.rotation.y=yaw;

  vel.y-=20*dt;
  if(keys["Space"]&&onGround){ vel.y=8.5; onGround=false; }
  player.position.y+=vel.y*dt;
  if(player.position.y<=0){ player.position.y=0; vel.y=0; onGround=true; }
}

function updateEnemies(dt){
  for(let i=enemies.length-1;i>=0;i--){
    const e=enemies[i];
    const toP=player.position.clone().sub(e.group.position);
    toP.y=0;
    const dist=toP.length();
    e.group.lookAt(player.position.x,e.group.position.y,player.position.z);

    if(e.isBoss){
      const pct=e.hp/e.maxHp;
      e.phase=pct>0.66?1:pct>0.33?2:3;
      e.speed=EDEF.boss.speed*(1+(e.phase-1)*0.35);
    }

    if(dist>e.range){
      e.group.position.add(toP.normalize().multiplyScalar(e.speed*dt));
    }

    e.atkCd-=dt;
    if(e.atkCd<=0&&dist<=e.range+2){
      const dir=player.position.clone().sub(e.group.position).normalize();
      const from=e.group.position.clone().add(
        new THREE.Vector3(0,e.isBoss?2:1.3,0)
      ).add(dir.clone().multiplyScalar(1.5));

      if(e.isBoss){
        const n=2+e.phase;
        for(let j=0;j<n;j++){
          const d=dir.clone();
          d.x+=(Math.random()-0.5)*0.15*e.phase;
          d.y+=(Math.random()-0.5)*0.1;
          d.z+=(Math.random()-0.5)*0.15*e.phase;
          spawnEBullet(from,d,e.dmg);
        }
        e.atkCd=1.2-e.phase*0.2;
      } else if(e.type==="grunt"){
        if(dist<3.5){
          hp-=e.dmg*dt*2.5;
          flashDamage();
          burst(player.position.clone().add(new THREE.Vector3(0,1,0)),0xff4444,3,3);
        }
        e.atkCd=0.5;
      } else {
        spawnEBullet(from,dir,e.dmg);
        e.atkCd=1.5+Math.random();
      }
    }
  }
}

function updateBullets(dt){
  // player bullets
  for(let i=bullets.length-1;i>=0;i--){
    const b=bullets[i];
    b.mesh.position.add(b.dir.clone().multiplyScalar(dt));
    b.life-=dt;
    let hit=false;

    for(let j=enemies.length-1;j>=0;j--){
      const e=enemies[j];
      const hitY=e.group.position.clone().add(new THREE.Vector3(0,e.isBoss?2:1.2,0));
      const d=b.mesh.position.distanceTo(hitY);
      const hitR=e.isBoss?3:1.2;
      if(d<hitR){
        e.hp-=b.dmg;
        burst(b.mesh.position,WEAPONS[wIdx].color,5,4);
        hit=true;
        if(e.hp<=0){
          const c=e.group.children[0]?.material?.color?.getHex?.()||0xff4444;
          burst(e.group.position.clone().add(new THREE.Vector3(0,1.5,0)),c,20,8);
          score+=e.score;
          kills++;
          dropPickup(e.group.position);
          scene.remove(e.group);
          enemies.splice(j,1);
          if(e.isBoss){
            bossActive=false; bossRef=null;
            onLevelComplete();
          }
        }
        break;
      }
    }

    if(hit||b.life<=0||b.mesh.position.y<-1){
      scene.remove(b.mesh); bullets.splice(i,1);
    }
  }

  // enemy bullets
  for(let i=eBullets.length-1;i>=0;i--){
    const b=eBullets[i];
    b.mesh.position.add(b.dir.clone().multiplyScalar(dt));
    b.life-=dt;
    const d=b.mesh.position.distanceTo(player.position.clone().add(new THREE.Vector3(0,1,0)));
    if(d<1.3){
      hp-=b.dmg;
      flashDamage();
      burst(player.position.clone().add(new THREE.Vector3(0,1,0)),0xff4444,5,3);
      scene.remove(b.mesh); eBullets.splice(i,1);
      if(hp<=0) onPlayerDeath();
      continue;
    }
    if(b.life<=0||b.mesh.position.y<-1){
      scene.remove(b.mesh); eBullets.splice(i,1);
    }
  }
}

function updateParticles(dt){
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.mesh.position.add(p.vel.clone().multiplyScalar(dt));
    p.vel.y-=10*dt;
    p.life-=dt;
    p.mesh.material.opacity=Math.max(0,p.life);
    if(p.life<=0){ scene.remove(p.mesh); particles.splice(i,1); }
  }
}

function updatePickups(dt){
  for(let i=pickups.length-1;i>=0;i--){
    const p=pickups[i];
    p.mesh.rotation.y+=dt*3;
    p.mesh.position.y=0.6+Math.sin(Date.now()/300)*0.2;
    if(player.position.distanceTo(p.mesh.position)<2){
      if(p.isHP){ hp=Math.min(100,hp+30); showMessage("+30 HP",1500); }
      else{
        WEAPONS.forEach((w,idx)=>{ if(ammo[idx]!==Infinity) ammo[idx]=Math.min(w.ammo,ammo[idx]+30); });
        showMessage("+30 Ammo",1500);
      }
      burst(p.mesh.position,p.isHP?0x44ff44:0xffaa44,8,5);
      scene.remove(p.mesh); pickups.splice(i,1);
    }
  }
}

function onPlayerDeath(){
  lives--;
  hp=100;
  flashDamage();
  burst(player.position.clone().add(new THREE.Vector3(0,1.5,0)),0xff4444,25,10);
  if(lives<=0){
    state="gameover";
    document.exitPointerLock?.();
    document.getElementById("finalScore").textContent=score.toLocaleString();
    document.getElementById("finalKills").textContent=kills;
    document.getElementById("gameOverScreen").classList.remove("hidden");
    return;
  }
  showMessage(`LIFE LOST! ${lives} remaining`,2500);
  player.position.set(0,0,0);
}

function onLevelComplete(){
  score+=1000;
  if(level>=LEVELS.length-1){
    state="victory";
    document.exitPointerLock?.();
    document.getElementById("victoryScore").textContent=score.toLocaleString();
    document.getElementById("victoryKills").textContent=kills;
    document.getElementById("victoryScreen").classList.remove("hidden");
    return;
  }
  showMessage(`LEVEL ${level+1} COMPLETE!  +1000 BONUS`,3500);
  setTimeout(()=>{
    level++;
    buildLevel(level);
    spawnWave();
    player.position.set(0,0,0);
  },3000);
}

function checkProgress(){
  if(!bossActive&&enemies.length===0&&state==="playing"){
    spawnBoss();
  }
}

// ═══════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),0.05);

  if(state==="playing"){
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateParticles(dt);
    updatePickups(dt);
    checkProgress();
  }

  updateCamera(dt);
  updateHUD();
  renderer.render(scene,camera);
}

// ═══════════════════════════════════════════════
//  RESIZE
// ═══════════════════════════════════════════════
function resize(){
  const w=innerWidth,h=innerHeight;
  camera.aspect=w/h;
  camera.updateProjectionMatrix();
  renderer.setSize(w,h,false);
}
addEventListener("resize",resize);
resize();

// ═══════════════════════════════════════════════
//  START
// ═══════════════════════════════════════════════
function startGame(){
  ["titleScreen","gameOverScreen","victoryScreen"].forEach(id=>
    document.getElementById(id).classList.add("hidden")
  );
  level=0; score=0; kills=0; lives=3; hp=100; wIdx=0;
  ammo=WEAPONS.map(w=>w.ammo);
  player.position.set(0,0,0);
  enemies.forEach(e=>scene.remove(e.group)); enemies.length=0;
  bullets.forEach(b=>scene.remove(b.mesh)); bullets.length=0;
  eBullets.forEach(b=>scene.remove(b.mesh)); eBullets.length=0;
  particles.forEach(p=>scene.remove(p.mesh)); particles.length=0;
  pickups.forEach(p=>scene.remove(p.mesh)); pickups.length=0;
  bossActive=false; bossRef=null;
  buildLevel(level);
  spawnWave();
  state="playing";
  canvas.requestPointerLock();
}

// initial environment
buildLevel(0);
animate();
