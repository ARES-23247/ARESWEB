import {test,expect,type Page} from "@playwright/test";
import net from "node:net";
import {once} from "node:events";
import {mkdir,writeFile} from "node:fs/promises";

test("four independent browsers finish the same authoritative match and persist its score",async({browser})=>{
 const contexts=await Promise.all(Array.from({length:4},()=>browser.newContext({baseURL:"http://127.0.0.1:3032",serviceWorkers:"block"})));
 const links:{browser:net.Socket;server:net.Socket}[]=[],connections:net.Socket[]=[];let offline=false;
 const proxy=net.createServer(socket=>{
  const upstream=net.connect(8087,"127.0.0.1");connections.push(socket,upstream);
  socket.once("data",chunk=>{if(chunk.toString().startsWith("GET /play ")){if(offline){socket.destroy();upstream.destroy();}else links.push({browser:socket,server:upstream});}});
  socket.on("error",()=>upstream.destroy());upstream.on("error",()=>socket.destroy());socket.on("close",()=>upstream.destroy());upstream.on("close",()=>socket.destroy());
  socket.pipe(upstream);upstream.pipe(socket);
 });proxy.listen(8088,"127.0.0.1");await once(proxy,"listening");
 const pages:Page[]=[],snapshots:Record<string,unknown>[]=[],sessions:Record<string,string>[]=[];
 try{
  for(let i=0;i<4;i++){
   const context=contexts[i];await context.addInitScript(()=>{window.ARES_E2E_BYPASS=true;});
   const page=await context.newPage();pages.push(page);
   page.on("websocket",socket=>socket.on("framereceived",event=>{try{const m=JSON.parse(String(event.payload));if(m.type==="snapshot")snapshots[i]=m.state;}catch{/* unrelated socket */}}));
   await page.goto("/biobuzz/simulator");
   const cookie=page.getByRole("button",{name:"Keep cookie-free",exact:true});if(await cookie.isVisible())await cookie.click();
   await expect(page.getByTestId("inventory")).toContainText("4/4");
  }
  const host=pages[0];
  await host.getByRole("button",{name:"Build an auto",exact:true}).click();
  const editor=host.getByRole("region",{name:"Auto editor",exact:true});
  await editor.getByRole("button",{name:"Add waypoint",exact:true}).click();
  await editor.getByLabel("X (m)",{exact:true}).nth(1).fill("-1.42");await editor.getByLabel("Y (m)",{exact:true}).nth(1).fill("1.42");await editor.getByLabel("Heading (rad)",{exact:true}).nth(1).fill("-0.8188");
  await editor.getByRole("button",{name:"Add wait",exact:true}).click();await editor.getByRole("button",{name:"Add shot",exact:true}).click();await editor.getByLabel("Balls",{exact:true}).fill("4");await editor.getByLabel("Launch speed (m/s)",{exact:true}).fill("5.54");
  await host.getByRole("button",{name:"Close auto editor",exact:true}).click();
  await host.getByRole("button",{name:"Pause",exact:true}).click();
  let response=host.waitForResponse(r=>r.url().endsWith("/api/biobuzz/create"));await host.getByRole("button",{name:"Create private room",exact:true}).click();sessions.push(await (await response).json());
  const code=sessions[0].code;await expect(host.getByText(code,{exact:true})).toBeVisible();
  await expect(host.getByRole("button",{name:"Pause",exact:true})).toBeDisabled();
  for(let i=1;i<4;i++){
   const p=pages[i];await p.getByRole("button",{name:"Pause",exact:true}).click();await p.getByLabel("Room code",{exact:true}).fill(code);
   response=p.waitForResponse(r=>r.url().endsWith("/api/biobuzz/join"));await p.getByRole("button",{name:"Join room",exact:true}).click();sessions.push(await (await response).json());await expect(p.getByText(code,{exact:true})).toBeVisible();
   await expect(p.getByRole("button",{name:"Pause",exact:true})).toBeDisabled();
  }
  await host.getByRole("button",{name:"Ready with this auto",exact:true}).click();
  for(const p of pages.slice(1))await p.getByRole("button",{name:"Ready without auto",exact:true}).click();
  await host.getByRole("button",{name:"Start match",exact:true}).click();
  for(const p of pages)await expect(p.getByTestId("match-clock")).toContainText("AUTO");
  await expect(host.getByText(/^red hive: 1 tips/)).toBeVisible({timeout:20000});
  await expect(host.getByTestId("match-clock")).toContainText("TELEOP",{timeout:45000});
  for(const p of pages.slice(1)){
   const before=await p.getByTestId("robot-position").innerText();await p.getByRole("button",{name:"Drive forward",exact:true}).click();await expect(p.getByTestId("robot-position")).not.toHaveText(before);
   await p.getByRole("button",{name:"Flower power",exact:true}).click();
   await p.getByRole("button",{name:"Shoot",exact:true}).click();await expect(p.getByTestId("inventory")).toContainText("3/4");
  }
  const ticks=snapshots.map(s=>Number(s.tick));expect(Math.max(...ticks)-Math.min(...ticks)).toBeLessThanOrEqual(12);
  // Actual transport loss, bot takeover, and seat reclamation use the existing browser session.
  offline=true;links[3].browser.destroy();links[3].server.destroy();
  await expect.poll(()=>JSON.stringify(snapshots[0]),{timeout:8000}).toContain('"controller":"standard"');
  offline=false;
  await expect(pages[3].getByText(/Room .*Connected/)).toBeVisible({timeout:15000});
  await expect.poll(()=>JSON.stringify(snapshots[0]),{timeout:10000}).not.toContain('"controller":"standard"');
  await expect(host.getByTestId("match-clock")).toContainText("FINISHED",{timeout:140000});
  for(const p of pages){await expect(p.getByTestId("match-clock")).toContainText("FINISHED");await expect(p.getByRole("alert")).toHaveCount(0);}
  const scores=await Promise.all(pages.map(async p=>({red:await p.getByTestId("red-score").innerText(),blue:await p.getByTestId("blue-score").innerText()})));
  expect(scores.every(score=>JSON.stringify(score)===JSON.stringify(scores[0]))).toBe(true);
  const url="http://127.0.0.1:8095/v1/projects/aresweb-ci/databases/(default)/documents/biobuzz_results/"+sessions[0].roomId;
  await expect.poll(async()=>{const r=await fetch(url,{headers:{Authorization:"Bearer owner"}});return r.status;}).toBe(200);
  const saved=await (await fetch(url,{headers:{Authorization:"Bearer owner"}})).json();expect(saved.fields.ruleVersion.stringValue).toBe("BIOBUZZ-V1");
  await mkdir("scratch/biobuzz",{recursive:true});
  await writeFile("scratch/biobuzz/four-client-result.json",JSON.stringify({roomId:sessions[0].roomId,scores,snapshots,saved},null,2));
  await Promise.all(pages.map((p,i)=>p.screenshot({path:"scratch/biobuzz/four-client-"+i+".png",fullPage:true})));
 }finally{await Promise.all(contexts.map(c=>c.close()));for(const socket of connections)socket.destroy();await new Promise<void>(resolve=>proxy.close(()=>resolve()));}
});
