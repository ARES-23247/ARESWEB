import { describe,it,expect,vi } from "vitest";
import { BiobuzzRooms } from "./biobuzzRooms";
import { NEUTRAL } from "../generated/games/biobuzz/types";
import type { ServerMessage } from "../generated/games/biobuzz/protocol";
function harness(maxRooms=5,persist?:ConstructorParameters<typeof BiobuzzRooms>[0]["persist"]){
 let now=1000;const rooms=new BiobuzzRooms({maxRooms,socketUrl:"ws://localhost/play",now:()=>now,persist});
 function client(action:"create"|"join"|"queue"="create",code?:string){
  const session=rooms.admit(action,code);let last:ServerMessage|null=null;
  const close=vi.fn();const peer={send:(m:ServerMessage)=>{last=m;},close};
  const connection=rooms.attach(session.roomId,session.token,peer);
  return {session,connection,peer,close,get last(){return last;}};
 }
 const advance=(ticks:number)=>{for(let i=0;i<ticks;i++){now+=1000/60;rooms.step();}};
 return {rooms,client,advance,elapse:(ms:number)=>{now+=ms;rooms.step();}};
}
describe("BIOBUZZ room authority",()=>{
 it("validates and locks each player's own mechanism configuration",()=>{
  const h=harness(),a=h.client(),b=h.client("join",a.session.code),setup={shooter:"back",deposit:"front",intake:"both",turret:true,driveSpeed:.8,turnSpeed:Math.PI/2} as const;
  a.connection.receive({type:"configure",seats:["human","empty","human","empty"]});
  expect(()=>b.connection.receive({type:"robot",setup:{...setup,intake:"left"}})).toThrow("Invalid robot");
  for(const bad of [{turret:"yes"},{driveSpeed:30},{turnSpeed:0}])expect(()=>b.connection.receive({type:"robot",setup:{...setup,...bad}})).toThrow("Invalid robot");
  b.connection.receive({type:"robot",setup});
  expect(a.last).toMatchObject({type:"lobby",lobby:{robotSetups:[{shooter:"front",deposit:"front",intake:"front"},{shooter:"front",deposit:"front",intake:"front"},setup,{shooter:"front",deposit:"front",intake:"front"}]}});
  for(const p of [a,b])p.connection.receive({type:"ready",auto:null});
  expect(()=>b.connection.receive({type:"robot",setup})).toThrow("locked");a.connection.receive({type:"start"});h.advance(6);
  expect(a.last).toMatchObject({type:"snapshot",state:{robots:expect.arrayContaining([expect.objectContaining({id:2,setup})])}});
  expect(()=>b.connection.receive({type:"robot",setup})).toThrow("locked");
  expect(()=>b.connection.receive({type:"input",sequence:0,input:{...NEUTRAL,deposit:"yes"}})).toThrow("Invalid");
  expect(()=>b.connection.receive({type:"input",sequence:0,input:{...NEUTRAL,aimFlower:"yes"}})).toThrow("Invalid");
  for(const bad of [{aim:"yes"},{turretTurn:Infinity},{turretTurn:2}])expect(()=>b.connection.receive({type:"input",sequence:0,input:{...NEUTRAL,...bad}})).toThrow("Invalid");
  b.connection.detach();h.elapse(3001);h.rooms.attach(b.session.roomId,b.session.token,b.peer);h.advance(6);
  expect(a.last).toMatchObject({type:"snapshot",state:{robots:expect.arrayContaining([expect.objectContaining({id:2,controller:"human",setup})])}});h.rooms.close();
 });
 it("allocates four unique seats and rejects forged player tokens",()=>{
  const h=harness(),a=h.client(),b=h.client("join",a.session.code),c=h.client("join",a.session.code),d=h.client("join",a.session.code);
  expect(new Set([a,b,c,d].map(p=>p.session.seat)).size).toBe(4);
  expect(()=>h.client("join",a.session.code)).toThrow("no open");
  expect(()=>h.rooms.attach(a.session.roomId,"x".repeat(43),a.peer)).toThrow("expired");
  h.rooms.close();expect(a.close).toHaveBeenCalled();
 });
 it("checks host ownership, ready state, and bounded inputs",()=>{
  const h=harness(),a=h.client(),b=h.client("join",a.session.code);
  expect(()=>b.connection.receive({type:"configure",seats:["human","empty","human","empty"]})).toThrow("creator");
  a.connection.receive({type:"configure",seats:["human","empty","human","empty"]});
  expect(()=>a.connection.receive({type:"start"})).toThrow("ready");
  for(const p of [a,b])p.connection.receive({type:"ready",auto:null});
  expect(()=>a.connection.receive({type:"ready",auto:null})).toThrow("locked");
  a.connection.receive({type:"start"});h.advance(2280);
  a.connection.receive({type:"input",sequence:0,input:{...NEUTRAL,y:-1}});h.advance(12);
  expect(()=>a.connection.receive({type:"input",sequence:0,input:NEUTRAL})).toThrow("order");
  expect(()=>a.connection.receive({type:"input",sequence:1,input:{...NEUTRAL,x:Infinity}})).toThrow("Invalid");
  expect(()=>a.connection.receive({type:"input",sequence:1,input:{...NEUTRAL,aimHive:"yes"}})).toThrow("Invalid");
  a.connection.receive({type:"input",sequence:1,input:{...NEUTRAL,aimHive:true,shoot:true}});h.advance(6);
  expect(a.last).toMatchObject({type:"snapshot",state:{robots:expect.arrayContaining([expect.objectContaining({id:0,shotStatus:"aiming"})])}});
  expect(()=>a.connection.receive({type:"configure",seats:["human","empty","human","empty"]})).toThrow("locked");
  h.rooms.close();
 });
 it("fills public matches with bots and offers local play to a lone player",()=>{
  const h=harness(),a=h.client("queue");h.elapse(30001);expect(a.last).toMatchObject({type:"lobby",lobby:{status:"local-offer"}});
  const b=h.client("queue"),c=h.client("queue");expect(b.session.roomId).toBe(c.session.roomId);
  h.elapse(30001);expect(c.last).toMatchObject({type:"lobby",lobby:{status:"running",seats:["human","standard","human","standard"]}});
  h.rooms.close();
 });
 it("reconnects only during the lease and replaces disconnected control",()=>{
  const h=harness(),a=h.client(),b=h.client("join",a.session.code);
  a.connection.receive({type:"configure",seats:["human","empty","human","empty"]});a.connection.receive({type:"ready",auto:null});b.connection.receive({type:"ready",auto:null});a.connection.receive({type:"start"});
  a.connection.detach();h.elapse(3001);h.advance(6);
  expect(b.last).toMatchObject({type:"snapshot",state:{robots:expect.arrayContaining([expect.objectContaining({id:0,controller:"standard"})])}});
  const resumed=h.rooms.attach(a.session.roomId,a.session.token,a.peer);resumed.detach();h.elapse(30001);
  expect(()=>h.rooms.attach(a.session.roomId,a.session.token,a.peer)).toThrow("expired");h.rooms.close();
 });
 it("ends one authoritative match and persists only the final result",async()=>{
  const persist=vi.fn().mockResolvedValue(undefined),h=harness(5,persist),a=h.client();
  a.connection.receive({type:"configure",seats:["human","empty","empty","empty"]});a.connection.receive({type:"ready",auto:null});a.connection.receive({type:"start"});
  h.advance(158*60+35);expect(persist).toHaveBeenCalledTimes(1);expect(persist.mock.calls[0][1].phase).toBe("finished");
  h.rooms.close();
 });
 it("bounds failed-result retries while preserving the final score",async()=>{
  const persist=vi.fn().mockRejectedValue(new Error("storage unavailable")),h=harness(5,persist),a=h.client();
  a.connection.receive({type:"configure",seats:["human","empty","empty","empty"]});a.connection.receive({type:"ready",auto:null});a.connection.receive({type:"start"});
  h.advance(9515);await Promise.resolve();h.advance(1);await Promise.resolve();h.advance(1);await Promise.resolve();h.advance(10);
  expect(persist).toHaveBeenCalledTimes(3);expect(a.last).toMatchObject({type:"error",message:expect.stringContaining("on-screen score")});h.rooms.close();
 });
 it("drains admission, expires rooms, and fails closed on lost worlds",()=>{
  const h=harness(1),a=h.client();expect(()=>h.client()).toThrow("capacity");
  h.rooms.drain();expect(()=>h.client()).toThrow("restarting");h.rooms.interruptAll();expect(a.last).toMatchObject({type:"lobby",lobby:{status:"interrupted"}});
  h.elapse(31000);expect(h.rooms.size).toBe(0);expect(()=>h.rooms.attach(a.session.roomId,a.session.token,a.peer)).toThrow("interrupted");
 });
 it("rejects unknown rooms and hostile messages",()=>{
  const h=harness(),a=h.client();expect(()=>h.client("join","00000000")).toThrow("unavailable");
  expect(()=>a.connection.receive({type:"configure",seats:["empty","empty","empty","empty"]})).toThrow("Invalid");
  for(let i=0;i<59;i++)a.connection.receive({type:"input",sequence:i,input:NEUTRAL});
  expect(()=>a.connection.receive({type:"input",sequence:60,input:NEUTRAL})).toThrow("Too many");
  h.rooms.close();
 });
});
