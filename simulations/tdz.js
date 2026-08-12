const fs=require("fs"), path=require("path");
const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"idle-fishing.html"),"utf8");
const srcs=[...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m=>m[1]);
const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
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
try{ new Function(ext)();   // one scope, like the browser's shared global lexical scope
     new Function(js)(); console.log("SCRIPT EXECUTED — no load-time error ("+srcs.length+" ext + inline)"); }
catch(e){ console.log("LOAD ERROR:", e.constructor.name+":", e.message);
  const m=(e.stack||"").match(/<anonymous>:(\d+):/); if(m) console.log("  near script line", m[1]);
  process.exit(1); }
