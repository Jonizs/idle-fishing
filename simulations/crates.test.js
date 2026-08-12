// Integration test for bulk crate opening.
// Integration test for the scroll system. Runs the real game under the tdz
// DOM stub, then exercises equip rules, every effect hook and the drop rate.
const fs=require("fs"), path=require("path");
const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"idle-fishing.html"),"utf8");
const srcs=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const js=(() => { const h=fs.readFileSync(path.join(ROOT,"idle-fishing.html"),"utf8")
     .match(/<script>([\s\S]*)<\/script>/)[1];
   const probe='\n globalThis.__T={state,gainScroll,equipScroll,unequipScroll,scrollR,scrollBuff,openCrate,BAGS,WEAR,'
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
const C=globalThis.__T, ok=[], bad=[];
const chk=(n,c)=>(c?ok:bad).push(n);
const gear=()=>C.WEAR.reduce((a,k)=>a+Object.values(C.BAGS[k]()).reduce((x,y)=>x+y,0),0);
C.state.crates["lucky:3"]=25;
const g0=gear(); C.openCrate("lucky:3",10);
chk("opens exactly 10",C.state.crates["lucky:3"]===15);
chk("10 items granted",gear()-g0===10);
C.openCrate("lucky:3",999);
chk("clamps to stack",C.state.crates["lucky:3"]===0);
C.state.crates["thunder:5"]=4; C.openCrate("thunder:5",4);
chk("thunder bulk",C.state.crates["thunder:5"]===0);
const h0=Object.values(C.state.hats).reduce((x,y)=>x+y,0);
C.state.crates["std:2"]=6; C.openCrate("std:2",6);
chk("hat crates bulk",Object.values(C.state.hats).reduce((x,y)=>x+y,0)-h0===6);
C.openCrate("std:2",5);
chk("no-op on empty stack",true);
C.state.crates["lucky:2"]=3; C.openCrate("lucky:2");
chk("defaults to one",C.state.crates["lucky:2"]===2);
console.log("PASS "+ok.length+"  FAIL "+bad.length);
bad.forEach(x=>console.log("  FAILED "+x)); ok.forEach(x=>console.log("  ok  "+x));
if(bad.length) process.exit(1);
