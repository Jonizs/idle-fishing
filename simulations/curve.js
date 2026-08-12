const path = require("path");
const DATA = path.join(__dirname, "..", "js", "data");
for (const f of ["fish", "progression", "upgrades", "mutations", "pond"])
  require(path.join(DATA, f + ".js"));
const G = globalThis.GAME_DATA;
const FISH = G.FISH;                       // idx already assigned
const UP   = G.UPGRADES.slice().sort((a, b) => a.lvl - b.lvl);  // already split
const POND = G.POND_UPG, MUT = G.MUTATE, tierLvl = G.tierLvl;
const xpToNext = G.xpToNext;
const GEAR={rod:3,line:3,lure:3,bait:3,hat:4};
const PAY=139, GAP=12;
const STORM_ROLL=300, STORM_BASE=300, STORM_DRY=3000, STRUCK=8, RUSH_ON=3.5;

function sim(clickGolden){
  const L={}, mutd={};
  const lv=id=>L[id]||0;
  const paneLvl={food:32,fly:35,storm:44};
  const all=[...UP.map(u=>({u,kind:"up"})),...POND.map(u=>({u,kind:"pond"})),
             ...MUT.map(m=>({u:{id:"mut:"+m.id,max:1,costs:[m.cost],lvl:m.lvl},kind:"mut",m}))];
  let lvl=1,xp=0,bank=0,t=0;
  const at={1:0};
  let stT=0, stRoll=STORM_ROLL, stDry=0, rush=0, stormSecs=0;
  const speed=()=>1+(0.0175*(lv("fishingSpeed")+lv("betterLure"))+0.02*lv("coffee")+0.05*GEAR.lure)*Math.pow(1.01,lv("fert"));
  const game=()=>1+0.05*lv("beer")+0.04*lv("hardLiquor")+0.01*GEAR.rod;
  const dbl=()=>0.005*lv("doubleDrop")+0.025*GEAR.bait+0.01*lv("worms");
  const enc=()=>(lv("enchanted")?0.05:0)+0.01*lv("tooShiny")+0.025*GEAR.hat+0.01*lv("plankton");
  const rods=()=>lv("trifecta")?3:lv("twoRods")?2:1;
  const focus=()=>lv("focus")?1.125:1;
  const stormLen=()=>STORM_BASE+Math.max(0,lv("theStorm")-1)*60;
  const boltChance=()=>0.005*lv("deafening");
  function stepEvents(dt){
    if(stT>0){ stT-=dt; if(stT<0)stT=0; stormSecs+=dt; }
    else if(lv("theStorm")){
      stDry+=dt; stRoll-=dt;
      if(stRoll<=0){ stRoll=STORM_ROLL;
        if(Math.random()<(stDry>=STORM_DRY?1/3:1/10)){ stT=stormLen(); stDry=0; } }
    }
    if(rush>0) rush=Math.max(0,rush-dt);
  }
  function rates(){
    const avail=FISH.filter(f=>f.lvl<=lvl);
    const picks=avail.slice(-rods());
    let xps=0,sps=0,att=0;
    for(const f of picks){
      const m=mutd[f.id]?MUT.find(x=>x.id===f.id):null;
      const fxp=m?m.xp:f.xp, fpr=m?m.price:f.price;
      const tt=(f.time*(1-0.025*lv("machine"))
                /(speed()*focus()*(stT>0?1.5:1)*(rush>0?3:1)))/game();
      // struck fish: the storm's own 5%, plus Deafening Strikes on every catch
      const pStruck=(stT>0?0.05:0)+boltChance();
      const mult=1+pStruck*(STRUCK-1);
      xps+=(fxp*(1+dbl())*mult)/tt;
      sps+=(Math.round(fpr*(1+0.025*lv("bread")))*(1+dbl())*(1+3*enc())*mult)/tt;
      // Redbull: per fish tier, 0.05% a catch triples speed for 3.5s
      if(lv("redbull")&&Math.random()<0.0005*f.idx*(1/tt)) rush=RUSH_ON;
      att+=(f.idx/(100-lv("infest")))/tt;
    }
    if(clickGolden){
      const R=lv("clones")?att:1/(GAP+1/Math.max(att,1e-9));
      sps*=1+R*0.5*PAY*(1+0.05*lv("dblTrouble"));
    }
    return {xps,sps};
  }
  while(t<4000*3600&&lvl<53){
    stepEvents(1); const r=rates(); xp+=r.xps; bank+=r.sps; t++;
    while(xp>=xpToNext(lvl)){xp-=xpToNext(lvl);lvl++;if(at[lvl]===undefined)at[lvl]=t;}
    for(;;){
      const opts=all.filter(o=>{
        const c=o.kind==="mut"?(mutd[o.m.id]?1:0):lv(o.u.id);
        if(c>=o.u.max) return false;
        const need=o.kind==="pond"?paneLvl[o.u.pane]:o.u.lvl!==undefined&&o.kind==="mut"?o.u.lvl:tierLvl(o.u,c);
        return lvl>=need && o.u.costs[c]<=bank;
      }).sort((a,b)=>a.u.costs[a.kind==="mut"?0:lv(a.u.id)]-b.u.costs[b.kind==="mut"?0:lv(b.u.id)]);
      if(!opts.length) break;
      const o=opts[0];
      if(o.kind==="mut"){bank-=o.u.costs[0];mutd[o.m.id]=true;}
      else {bank-=o.u.costs[lv(o.u.id)];L[o.u.id]=lv(o.u.id)+1;}
    }
  }
  return {at, stormPct:100*stormSecs/t};
}
const RA=sim(true), RB=sim(false);
const A=RA.at, B=RB.at;
const rows=[];
for(let l=1;l<=52;l++) if(A[l]!==undefined) rows.push({l,a:A[l]/3600,b:B[l]!==undefined?B[l]/3600:null});
console.log(JSON.stringify(rows.map(r=>[r.l,+r.a.toFixed(3),r.b===null?null:+r.b.toFixed(3)])));
console.log("storm uptime:", RA.stormPct.toFixed(1)+"%");
console.log("with golden  -> Lv52 at", A[52]?(A[52]/3600).toFixed(1)+"h":"not reached");
console.log("no golden    -> Lv52 at", B[52]?(B[52]/3600).toFixed(1)+"h":"not reached");
for(const l of [10,20,30,40,45,50,52]) if(A[l]) console.log("  Lv"+l, (A[l]/3600).toFixed(2)+"h", B[l]?"/ "+(B[l]/3600).toFixed(2)+"h":"");
