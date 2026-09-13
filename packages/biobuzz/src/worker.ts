import { Simulation } from "./core/engine";
import type { Config, Input } from "./core/types";
let sim:Simulation|null=null,last=performance.now(),accumulator=0,paused=false,publishedTick=-1;
self.onmessage=(event:MessageEvent<{type:string;config?:Config;id?:number;input?:Input;paused?:boolean}>)=>{
  const m=event.data;
  try {
    if(m.type==="start"&&m.config){sim=new Simulation(m.config);paused=false;last=performance.now();accumulator=0;publishedTick=sim.tick;self.postMessage({type:"snapshot",state:sim.snapshot()});}
    if(m.type==="input"&&m.input&&m.id!==undefined)sim?.command(m.id,m.input);
    if(m.type==="pause"){paused=m.paused===true;last=performance.now();accumulator=0;}
  }catch(error){self.postMessage({type:"error",message:error instanceof Error?error.message:"Simulation failed."});}
};
setInterval(()=>{
  const now=performance.now(),elapsed=(now-last)/1000;last=now;
  if(!sim||paused)return;
  // A suspended local tab pauses its simulated clock instead of skipping physics.
  accumulator+=Math.min(elapsed,0.1);
  let steps=0;while(accumulator>=1/60&&steps<6){sim.step();accumulator-=1/60;steps++;}
  // Terminal ticks stop advancing and may fall between the regular snapshot slots.
  if(steps&&sim.tick!==publishedTick&&(sim.tick%3<steps||sim.phase==="finished"||sim.phase==="interrupted")){
    publishedTick=sim.tick;self.postMessage({type:"snapshot",state:sim.snapshot()});
  }
},8);
