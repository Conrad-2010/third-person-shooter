(() => {
const canvas=document.getElementById('map'),ctx=canvas.getContext('2d');
const W=1500,H=1000;
let view={x:0,y:0,scale:1},drag=null,selected=null,day=1,supplies=640,fuel=280,influence=72,coverage=64,confidence=81,routeMode=false,routeStart=null;
const towns=[
{id:'northgate',name:'Northgate',x:260,y:190,type:'Regional capital',owner:'blue',pop:'18,400',services:3,desc:'Administrative centre with a major depot and road connections.'},
{id:'pinewatch',name:'Pinewatch',x:570,y:250,type:'Forest settlement',owner:'gold',pop:'6,200',services:2,desc:'A timber and conservation community beside the northern woodland.'},
{id:'riverbend',name:'Riverbend',x:850,y:430,type:'River town',owner:'blue',pop:'9,750',services:2,desc:'A riverside town connecting the eastern and western districts.'},
{id:'westfield',name:'Westfield',x:350,y:580,type:'Agricultural hub',owner:'blue',pop:'12,100',services:2,desc:'Farms and grain stores supply nearby communities.'},
{id:'stonebridge',name:'Stonebridge',x:1080,y:650,type:'Transport hub',owner:'gold',pop:'8,300',services:2,desc:'A busy crossing where regional roads meet the river.'},
{id:'highplain',name:'Highplain',x:1250,y:230,type:'Highland village',owner:'blue',pop:'4,800',services:1,desc:'A small highland settlement with room for future development.'},
{id:'southport',name:'Southport',x:700,y:820,type:'Market town',owner:'blue',pop:'10,600',services:3,desc:'A market town with workshops and a large distribution yard.'},
{id:'oakridge',name:'Oakridge',x:1050,y:120,type:'Rural community',owner:'gold',pop:'5,100',services:1,desc:'A rural partner community surrounded by mixed woodland.'}
];
const units=[{name:'Northern Supply Group',x:430,y:330,status:'SUPPLY RUN',detail:'Delivering provisions to Northgate district'},{name:'River Logistics Team',x:930,y:560,status:'ON STANDBY',detail:'Ready to support riverside communities'},{name:'Southern Transport Group',x:590,y:740,status:'ROUTE PLANNING',detail:'Maintaining the southern road network'}];
const roads=[[0,1],[0,3],[1,2],[1,7],[2,4],[2,5],[2,6],[3,6],[3,2],[4,6],[5,4],[7,5]];
const forest=[[150,110,230,150],[680,120,190,110],[930,160,170,130],[1200,360,190,140],[520,480,180,120],[850,700,210,110],[170,760,210,130],[1280,790,170,110]];
const hills=[[80,380,170,100],[440,80,100,65],[770,330,150,80],[1180,500,150,90],[460,850,170,90],[1350,80,100,65]];
const $=id=>document.getElementById(id);
function rnd(a,b){return a+Math.random()*(b-a)}
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);draw()}
function path(points){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]))}
function terrain(){
ctx.fillStyle='#929477';ctx.fillRect(0,0,W,H);
for(let i=0;i<1000;i++){let x=rnd(0,W),y=rnd(0,H),r=rnd(1,4);ctx.fillStyle=Math.random()>.5?'rgba(53,75,48,.10)':'rgba(222,215,173,.12)';ctx.fillRect(x,y,r,r)}
// elevation contours
for(let i=0;i<30;i++){ctx.beginPath();let x=(i*173)%W,y=(i*97)%H;ctx.ellipse(x,y,45+(i%5)*12,22+(i%4)*8,rnd(-.5,.5),0,Math.PI*2);ctx.strokeStyle='rgba(73,83,61,.18)';ctx.lineWidth=1;ctx.stroke()}
// hills
hills.forEach(([x,y,w,h])=>{for(let k=0;k<8;k++){ctx.beginPath();ctx.ellipse(x+k*5,y-k*3,w-k*8,h-k*4,-.25,0,Math.PI*2);ctx.fillStyle=k%2?'rgba(113,119,83,.20)':'rgba(207,194,147,.25)';ctx.fill();ctx.strokeStyle='rgba(79,88,61,.25)';ctx.stroke()}});
// forest patches
forest.forEach(([x,y,w,h],idx)=>{ctx.fillStyle='rgba(54,79,52,.25)';ctx.beginPath();ctx.ellipse(x,y,w,h,-.2,0,Math.PI*2);ctx.fill();for(let j=0;j<75;j++){let a=rnd(0,Math.PI*2),rr=Math.sqrt(Math.random()),tx=x+Math.cos(a)*rr*w*.88,ty=y+Math.sin(a)*rr*h*.85;tree(tx,ty,rnd(.65,1.15))}});
// river
ctx.lineCap='round';ctx.lineJoin='round';let river=[[650,-30],[610,100],[680,220],[630,340],[720,470],[680,600],[790,740],[760,1030]];
path(river);ctx.strokeStyle='#687e78';ctx.lineWidth=64;ctx.stroke();ctx.strokeStyle='#8eaaa0';ctx.lineWidth=52;ctx.stroke();ctx.strokeStyle='rgba(207,225,211,.35)';ctx.lineWidth=2;ctx.setLineDash([8,12]);ctx.stroke();ctx.setLineDash([]);
// borders
path([[30,60],[430,30],[820,70],[1120,35],[1470,130],[1430,470],[1480,870],[1100,960],[760,920],[400,970],[40,820],[30,60]]);ctx.strokeStyle='rgba(58,70,48,.85)';ctx.lineWidth=4;ctx.setLineDash([13,8]);ctx.stroke();ctx.setLineDash([]);
}
function tree(x,y,s=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#4d6044';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#71815a';ctx.beginPath();ctx.arc(-2,-3,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(28,43,31,.35)';ctx.beginPath();ctx.arc(2,3,5,0,Math.PI*2);ctx.fill();ctx.restore()}
function drawRoads(){roads.forEach(([a,b])=>{let p=towns[a],q=towns[b];ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.quadraticCurveTo((p.x+q.x)/2+rnd(-20,20),(p.y+q.y)/2+rnd(-20,20),q.x,q.y);ctx.strokeStyle='rgba(65,62,48,.55)';ctx.lineWidth=12;ctx.stroke();ctx.strokeStyle='#d9d0ae';ctx.lineWidth=7;ctx.stroke();ctx.strokeStyle='#f0e7c9';ctx.lineWidth=1.5;ctx.setLineDash([12,8]);ctx.stroke();ctx.setLineDash([])})}
function drawTown(t){let color=t.owner==='blue'?'#6aa9c5':'#c3a35d';ctx.save();ctx.translate(t.x,t.y);ctx.fillStyle='rgba(30,35,27,.35)';ctx.beginPath();ctx.ellipse(0,10,35,19,0,0,Math.PI*2);ctx.fill();for(let i=0;i<9;i++){let x=rnd(-25,25),y=rnd(-14,12);ctx.fillStyle=['#c8bda0','#9e9d85','#b7ad8f'][i%3];ctx.fillRect(x,y,8,7);ctx.fillStyle='#655f4b';ctx.fillRect(x+2,y-3,4,3)}ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,33,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#1a241e';ctx.fillRect(-31,-49,62,17);ctx.strokeStyle=color;ctx.lineWidth=1;ctx.strokeRect(-31,-49,62,17);ctx.fillStyle='#f0eee0';ctx.font='bold 11px Inter';ctx.textAlign='center';ctx.fillText(t.name,0,-37);ctx.fillStyle=color;ctx.beginPath();ctx.arc(0,0,5,0,Math.PI*2);ctx.fill();if(selected===t){ctx.strokeStyle='#f7e7a7';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,42,0,Math.PI*2);ctx.stroke()}ctx.restore()}
function drawUnits(){units.forEach((u,i)=>{ctx.save();ctx.translate(u.x,u.y);ctx.fillStyle='rgba(14,29,35,.8)';ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#9bc7d6';ctx.lineWidth=2;ctx.stroke();ctx.fillStyle='#9bc7d6';ctx.font='bold 13px Inter';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✚',0,1);ctx.fillStyle='#17231d';ctx.fillRect(14,-21,92,15);ctx.fillStyle='#e8e9d8';ctx.font='8px Inter';ctx.textAlign='left';ctx.fillText(u.status,18,-10);ctx.restore()})}
function draw(){if(!ctx)return;let cw=canvas.width,ch=canvas.height;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cw,ch);let scale=Math.min(cw/W,ch/H)*view.scale;ctx.setTransform(scale,0,0,scale,(cw-W*scale)/2+view.x*scale,(ch-H*scale)/2+view.y*scale);terrain();drawRoads();towns.forEach(drawTown);drawUnits();ctx.fillStyle='rgba(29,43,31,.75)';ctx.font='italic 22px Georgia';ctx.fillText('NORTH RIDGE',900,310);ctx.fillText('GREEN VALLEY',220,700);ctx.fillText('THE EASTERN WOOD',1120,850);ctx.fillStyle='#e3e0ca';ctx.font='bold 13px Inter';ctx.fillText('N',1400,75);ctx.beginPath();ctx.moveTo(1400,85);ctx.lineTo(1392,105);ctx.lineTo(1408,105);ctx.closePath();ctx.fill()}
function screenToMap(e){let r=canvas.getBoundingClientRect(),scale=Math.min(canvas.width/W,canvas.height/H)*view.scale;return{x:(e.clientX-r.left)*devicePixelRatio/scale-(canvas.width/scale-W)/2-view.x,y:(e.clientY-r.top)*devicePixelRatio/scale-(canvas.height/scale-H)/2-view.y}}
function choose(p){let t=towns.find(t=>Math.hypot(t.x-p.x,t.y-p.y)<42);if(t){selected=t;showTown(t);draw();return}let u=units.find(u=>Math.hypot(u.x-p.x,u.y-p.y)<25);if(u){selected=u;showUnit(u);draw();return}}
function showTown(t){$('itemType').textContent=t.type.toUpperCase();$('itemName').textContent=t.name;$('itemDesc').textContent=t.desc;$('itemStats').innerHTML='<div><small>POPULATION</small><b>'+t.pop+'</b></div><div><small>LOCAL SERVICES</small><b>'+t.services+'/4</b></div>'}
function showUnit(u){$('itemType').textContent='LOGISTICS UNIT';$('itemName').textContent=u.name;$('itemDesc').textContent=u.detail;$('itemStats').innerHTML='<div><small>STATUS</small><b>'+u.status+'</b></div><div><small>READINESS</small><b>READY</b></div>'}
function log(msg){let p=document.createElement('p'),time=document.createElement('time');time.textContent=String(8+Math.floor(Math.random()*9)).padStart(2,'0')+':'+String(Math.floor(Math.random()*60)).padStart(2,'0');p.append(time,document.createTextNode(msg));$('log').prepend(p);while($('log').children.length>5)$('log').lastChild.remove()}
function toast(msg){let el=$('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
function update(){ $('day').textContent=String(day).padStart(2,'0');$('supplies').textContent=supplies;$('fuel').textContent=fuel;$('influence').textContent=influence;$('coverageText').textContent=coverage+'%';$('coverageBar').style.width=coverage+'%';$('confidence').textContent=confidence+'%';$('confidenceBar').style.width=confidence+'%'}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag={x:e.clientX,y:e.clientY,moved:false,lastX:e.clientX,lastY:e.clientY}})
canvas.addEventListener('pointermove',e=>{if(!drag)return;let dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;if(Math.abs(e.clientX-drag.x)+Math.abs(e.clientY-drag.y)>5)drag.moved=true;view.x+=dx/(canvas.clientWidth/ W)/view.scale;view.y+=dy/(canvas.clientHeight/H)/view.scale;drag.lastX=e.clientX;drag.lastY=e.clientY;draw()})
canvas.addEventListener('pointerup',e=>{if(drag&&!drag.moved)choose(screenToMap(e));drag=null})
canvas.addEventListener('wheel',e=>{e.preventDefault();view.scale=Math.max(.8,Math.min(2.1,view.scale*(e.deltaY<0?1.1:.9)));draw()},{passive:false});
$('zoomIn').onclick=()=>{view.scale=Math.min(2.1,view.scale*1.15);draw()};$('zoomOut').onclick=()=>{view.scale=Math.max(.8,view.scale/1.15);draw()};$('resetView').onclick=()=>{view={x:0,y:0,scale:1};draw()};
$('endTurn').onclick=()=>{day++;supplies+=45;fuel=Math.max(0,fuel-8);confidence=Math.min(99,confidence+1);update();log('Day '+day+' report: 45 supplies received.');toast('Day '+day+' begins · regional services updated')};
$('developBtn').onclick=()=>{if(!selected||!towns.includes(selected)){toast('Select a settlement first');return}if(supplies<80){toast('Not enough supplies');return}if(selected.services>=4){toast('This settlement is fully developed');return}supplies-=80;selected.services++;coverage=Math.min(99,coverage+4);confidence=Math.min(99,confidence+2);update();showTown(selected);log(selected.name+' services upgraded.');toast(selected.name+' development completed')};
$('supplyBtn').onclick=()=>{if(!selected||!towns.includes(selected)){toast('Select a settlement first');return}if(supplies<35){toast('Not enough supplies');return}supplies-=35;coverage=Math.min(99,coverage+2);update();log('Supply convoy dispatched to '+selected.name+'.');toast('Supplies dispatched to '+selected.name)};
$('routeBtn').onclick=()=>{routeMode=!routeMode;routeStart=null;toast(routeMode?'Route planner active: choose two settlements':'Route planner closed')};
canvas.addEventListener('click',e=>{if(!routeMode)return;let p=screenToMap(e),t=towns.find(t=>Math.hypot(t.x-p.x,t.y-p.y)<42);if(!t)return;if(!routeStart){routeStart=t;toast('Start set: '+t.name+'. Choose destination')}else{log('Regional route planned: '+routeStart.name+' ↔ '+t.name+'.');toast('Route planned: '+routeStart.name+' to '+t.name);routeStart=null;routeMode=false}});
window.addEventListener('resize',resize);update();resize();
})();