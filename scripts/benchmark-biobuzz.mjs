import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { deflateRawSync } from "node:zlib";
import { mkdirSync,writeFileSync } from "node:fs";
const require=createRequire(import.meta.url);
const {Simulation}=require("../functions/lib/generated/games/biobuzz/engine.js");
const records=[];
for(const count of [1,5,10,25]){
  const worlds=Array.from({length:count},()=>new Simulation({timed:true,seats:["standard","standard","standard","standard"]}));
  const start=performance.now(),cpu=process.cpuUsage(),batches=[];
  let rawBytes=0,compressedBytes=0,missedBatches=0,consecutiveMisses=0,maxConsecutiveMisses=0;
  for(let tick=0;tick<9600;tick++){
    const before=performance.now();
    for(const world of worlds){
      world.step();
      if(tick%6===0){
        const payload=JSON.stringify({type:"snapshot",state:world.snapshot()});
        rawBytes+=Buffer.byteLength(payload)*4;
        // All four WebSocket connections compress independently, with no context takeover.
        for(let client=0;client<4;client++)compressedBytes+=deflateRawSync(payload,{level:1}).length;
      }
    }
    const duration=performance.now()-before;
    batches.push(duration);
    if(duration>1000/60){missedBatches++;consecutiveMisses++;maxConsecutiveMisses=Math.max(maxConsecutiveMisses,consecutiveMisses);}else consecutiveMisses=0;
  }
  const usage=process.cpuUsage(cpu),cpuPercent=(usage.user+usage.system)/1e6/160*100;
  batches.sort((a,b)=>a-b);
  const row={matches:count,elapsedSeconds:(performance.now()-start)/1000,cpuPercentOfOneCore:cpuPercent,p99BatchMs:batches[Math.floor(batches.length*0.99)],maxBatchMs:batches.at(-1),missedBatches,maxConsecutiveMisses,rawMiB:rawBytes/1048576,compressedMiB:compressedBytes/1048576,compressedMiBPerMatch:compressedBytes/count/1048576,rssMiB:process.memoryUsage().rss/1048576,results:worlds.map(w=>({phase:w.phase,tips:w.hives.map(h=>h.tips)}))};
  records.push(row);console.log(JSON.stringify(row));
}
mkdirSync("build/biobuzz",{recursive:true});
const report={kind:"biobuzz-capacity",machine:process.platform,node:process.version,date:new Date().toISOString(),cloudRunJob:process.env.CLOUD_RUN_JOB??null,cloudRunExecution:process.env.CLOUD_RUN_EXECUTION??null,note:"Engine and four independent compressed streams at 60 Hz; excludes actual socket/TLS overhead. Cloud Run resource limits must be verified against the recorded execution.",records};
writeFileSync("build/biobuzz/benchmark.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
