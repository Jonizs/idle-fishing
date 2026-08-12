// Integration test for the scroll system. Runs the real game under the tdz
// DOM stub, then exercises equip rules, every effect hook and the drop rate.
const fs=require("fs"), path=require("path");
const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"idle-fishing.html"),"utf8");
const srcs=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const js=(() => { const h=fs.readFileSync(path.join(ROOT,"idle-fishing.html"),"utf8")
     .match(/<script>([\s\S]*)<\/script>/)[1];
   const probe='\n globalThis.__T={state,gainScroll,equipScroll,unequipScroll,scrollR,scrollBuff,'
     +'speedBuffs,baseTime,boltChance,dblChance,encChance,goldChance,beerMul,SCROLLS,SCROLL_SLOTS,'
     +'refreshScrollUI,rollDrop,FISH,refreshInventory,stacks,sellAllValue};\n';
   const i=h.lastIndexOf("})();"); return h.slice(0,i)+probe+h.slice(i); })();
const RECT={left:0,top:0,right:800,bottom:600,width:800,height:600};
function el(){
  const t=function(){};
  return new Proxy(t,{
    get(_,k){
      if(k===Symbol.toPrimitive)return ()=>"";
      if(k==="toString"||k==="valueOf")return ()=>"";
      if(k===Symbol.iterator)return function*(){};
      if(k==="length")return 0;
      if(k==="style")return new Proxy({},{get:()=>()=>{},set:()=>true});
      if(k==="classList")return {add(){},remove(){},toggle(){},contains:()=>false};
      if(k==="dataset")return {};
      if(k==="documentElement"||k==="body"||k==="head")return el();
      if(k==="hidden"||k==="disabled")return false;
      if(k==="value"||k==="textContent"||k==="innerHTML"||k==="className"||k==="id")return "";
      if(k==="getBoundingClientRect")return ()=>RECT;
      if(k==="querySelectorAll")return ()=>[el(),el(),el(),el()];
      if(k==="getImageData")return ()=>({data:new Uint8ClampedArray(4)});
      if(k==="measureText")return ()=>({width:10});
      return (...a)=>el();
    },
    apply:()=>el(), set:()=>true, has:()=>true,
  });
}
const doc=el();
global.document=doc; global.window=el();
global.requestAnimationFrame=()=>0; global.cancelAnimationFrame=()=>{};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};
global.performance={now:()=>0}; global.devicePixelRatio=1;
global.Image=function(){}; global.matchMedia=()=>({matches:false,addEventListener(){}});
global.navigator={userAgent:"node"};
global.getComputedStyle=()=>new Proxy({},{get:()=>()=>""});
global.CanvasRenderingContext2D=function(){};
global.ResizeObserver=function(){return{observe(){},disconnect(){}}};

const ext=srcs.map(f=>fs.readFileSync(path.join(ROOT,f),"utf8")).join("\n;\n");
new Function(ext)(); new Function(js)();
const T = globalThis.__T, ok=[], bad=[];
const chk=(n,c)=>(c?ok:bad).push(n);

chk("state keys", !!T.state.scrolls && T.state.scrollEq.length===9 && T.state.ravens===0);
chk("no scroll -> no buff", T.scrollR("buccan")===0 && T.scrollBuff("buccan")===0);

const sb0=T.speedBuffs(), bt0=T.baseTime(T.FISH[8]), db0=T.dblChance(),
      en0=T.encChance(), gd0=T.goldChance(T.FISH[8]), bm0=T.beerMul(), bc0=T.boltChance();

T.gainScroll("buccan",3); T.gainScroll("sword",6); T.gainScroll("wind",2);
chk("bag fills", T.state.scrolls["buccan:3"]===1 && T.state.scrolls["sword:6"]===1);
T.equipScroll("buccan:3");
chk("equip moves out of bag", !T.state.scrolls["buccan:3"] && T.state.scrollEq[0]==="buccan:3");
chk("buccan +5%/rarity", Math.abs(T.scrollBuff("buccan")-0.15)<1e-9);
chk("speed buffs rose", T.speedBuffs()>sb0);
T.gainScroll("buccan",5); T.equipScroll("buccan:5");
chk("one per type blocked", T.state.scrolls["buccan:5"]===1 && T.scrollR("buccan")===3);
T.equipScroll("sword:6");
chk("sword -2.5%/rarity on timer", Math.abs(T.baseTime(T.FISH[8])-bt0*0.85)<1e-6);
T.equipScroll("wind:2");
chk("wind +0.04x/rarity", Math.abs(T.beerMul()-(bm0+0.08))<1e-9);
T.gainScroll("caribbean",4); T.equipScroll("caribbean:4");
chk("caribbean +2%/rarity", Math.abs(T.dblChance()-(db0+0.08))<1e-9);
T.gainScroll("treasure",1); T.equipScroll("treasure:1");
chk("treasure +2%/rarity", Math.abs(T.encChance()-(en0+0.02))<1e-9);
T.gainScroll("sea",6); T.equipScroll("sea:6");
chk("sea +1%/rarity", Math.abs(T.goldChance(T.FISH[8])-(gd0+0.06))<1e-9);
T.gainScroll("storm",4); T.equipScroll("storm:4");
chk("storm +0.5%/rarity", Math.abs(T.boltChance()-(bc0+0.02))<1e-9);
T.unequipScroll(0);
chk("unequip returns to bag", T.state.scrolls["buccan:3"]===1 && T.scrollR("buccan")===0);

T.state.upgrades.pirateLoot=1;
const before=Object.values(T.state.scrolls).reduce((a,b)=>a+b,0);
for(let i=0;i<200000;i++) T.rollDrop(T.FISH[8]);
const got=Object.values(T.state.scrolls).reduce((a,b)=>a+b,0)-before;
const exp=200000*0.00005*9;
chk("pirate loot rate ("+got+" vs "+exp.toFixed(0)+" expected)", Math.abs(got-exp)<exp*0.3);
const commons=Object.keys(T.state.scrolls).filter(k=>k.endsWith(":1"));
const types=new Set(commons.map(k=>k.split(":")[0]));
chk("drops common only, all nine types ("+types.size+")", types.size===9);

// Sea ravens render in the fish inventory but must never be priced or sold.
const sellBefore=T.sellAllValue(), stackBefore=T.stacks().length;
T.state.ravens=5; T.refreshInventory(true);
chk("ravens do not enter stacks()", T.stacks().length===stackBefore);
chk("ravens are worth no silver", T.sellAllValue()===sellBefore);

console.log("PASS "+ok.length+"  FAIL "+bad.length);
bad.forEach(b=>console.log("  FAILED: "+b));
ok.forEach(o=>console.log("  ok   "+o));
if(bad.length) process.exit(1);
