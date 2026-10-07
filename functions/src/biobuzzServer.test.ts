import {afterEach,describe,expect,it,vi} from "vitest";
import {once} from "node:events";
import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import type {AddressInfo} from "node:net";
import {resolve} from "node:path";
import {WebSocket} from "ws";
import type {WaggleStore} from "./lib/__tests__/helpers/waggleStore";
const state=vi.hoisted(()=>({db:null as unknown as WaggleStore}));
vi.mock("google-auth-library",()=>({OAuth2Client:class {async verifyIdToken({idToken,audience}:{idToken:string;audience:string}){if(idToken==="bad"||audience!=="http://127.0.0.1:3028")throw new Error("Invalid signature or audience");return {getPayload:()=>({sub:idToken==="deployer"?"100713596623775501367":"other-service-account"})};}}}));
vi.mock("./lib/firebase-admin",async()=>{
  const {WaggleStore}=await import("./lib/__tests__/helpers/waggleStore");state.db=new WaggleStore();
  return {adminDb:state.db.firestore,adminAppCheck:{verifyToken:async(token:string)=>{if(token!=="valid")throw new Error("Invalid proof");return {appId:"1:205869391101:web:ca1bb24da790e4904ff294"};}}};
});
vi.mock("./lib/logger",()=>({logger:{info:vi.fn(),warn:vi.fn(),error:vi.fn()}}));
import {startBiobuzzServer} from "./biobuzzServer";
import {BIOBUZZ_ADMISSION_LIMITS} from "./apps/biobuzz";
import {NEUTRAL} from "./generated/games/biobuzz/types";
let running:ReturnType<typeof startBiobuzzServer>|undefined;
const clients:WebSocket[]=[];
afterEach(async()=>{for(const ws of clients.splice(0))ws.terminate();running?.stop();running=undefined;vi.unstubAllEnvs();vi.restoreAllMocks();state.db.data.clear();state.db.failRead="";});
async function start(){
  vi.stubEnv("PORT","0");vi.stubEnv("BIOBUZZ_PUBLIC_ORIGIN","http://127.0.0.1:3028");vi.stubEnv("ENFORCE_APP_CHECK","true");
  state.db.data.set("internal_biobuzz_control/service",{admissionOpen:true});
  running=startBiobuzzServer();await once(running.server,"listening");
  return "http://127.0.0.1:"+(running.server.address() as AddressInfo).port;
}
async function post(origin:string,path:string,body:unknown={},token="valid"){
  return fetch(origin+"/api/biobuzz/"+path,{method:"POST",headers:{"Content-Type":"application/json","X-Firebase-AppCheck":token},body:JSON.stringify(body)});
}
async function socket(origin:string,path="/play",allowed="http://127.0.0.1:3028"){
  const ws=new WebSocket(origin.replace("http:","ws:")+path,{origin:allowed});clients.push(ws);await once(ws,"open");return ws;
}
function next(ws:WebSocket,type?:string):Promise<Record<string,unknown>>{
  return new Promise(resolve=>{const receive=(data:Buffer)=>{const message=JSON.parse(data.toString());if(!type||message.type===type){ws.off("message",receive);resolve(message);}};ws.on("message",receive);});
}
describe("BIOBUZZ HTTP and WebSocket service",()=>{
  it("limits deployment admission control to the signed deployer identity without giving it database permissions",async()=>{
    const origin=await start();
    const control=(token:string,body:unknown,headers:Record<string,string>={})=>fetch(origin+"/internal/admission",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token,...headers},body:JSON.stringify(body)});
    expect((await control("",{admissionOpen:false})).status).toBe(401);
    expect((await control("deployer",{admissionOpen:false},{Origin:"https://aresfirst.org"})).status).toBe(401);
    expect((await control("bad",{admissionOpen:false})).status).toBe(403);
    expect((await control("other",{admissionOpen:false})).status).toBe(403);
    expect((await control("deployer",{unexpected:true})).status).toBe(400);
    expect((await control("deployer",{admissionOpen:false})).status).toBe(200);
    expect(running!.rooms.accepting).toBe(false);expect((await post(origin,"create")).status).toBe(503);
    expect((await control("deployer",{admissionOpen:true})).status).toBe(200);expect(running!.rooms.accepting).toBe(true);
  });
  it("requires App Check before allocating quotas, parses bounded bodies, and preserves room ownership",async()=>{
    const origin=await start();
    expect((await post(origin,"create",{},"invalid")).status).toBe(401);
    expect([...state.db.data.keys()].some(k=>k.startsWith("internal_api_quotas"))).toBe(false);
    expect((await post(origin,"join",{})).status).toBe(400);
    expect((await post(origin,"create",{unexpected:1})).status).toBe(400);
    expect((await post(origin,"create",{code:"x".repeat(5000)})).status).toBe(413);
    const response=await post(origin,"create");expect(response.headers.get("cache-control")).toBe("no-store");
    const session=await response.json();expect(session.token).toHaveLength(43);
    expect((await post(origin,"join",{code:session.code})).status).toBe(200);
    expect((await post(origin,"queue")).status).toBe(200);
    const records=[...state.db.data.entries()].filter(([k])=>k.startsWith("internal_api_quotas"));
    // Four admission budgets count every admitted request; two create-only budgets count the three create attempts.
    expect(records).toHaveLength(6);expect(records.map(([,v])=>v.count).sort()).toEqual([3,3,6,6,6,6]);
    for(const [key,value] of records)state.db.data.set(key,{...value,count:4000});
    expect((await post(origin,"create")).status).toBe(429);
    expect((await fetch(origin+"/unknown")).status).toBe(404);
    expect(await (await fetch(origin+"/health")).json()).toMatchObject({version:1,active:0,accepting:true});
  });
  it("caps private-room creation and each address's daily share without blocking other players",async()=>{
    vi.stubEnv("BIOBUZZ_MAX_ROOMS","25");
    const origin=await start();
    const from=(ip:string,path:string)=>fetch(origin+"/api/biobuzz/"+path,{method:"POST",headers:{"Content-Type":"application/json","X-Firebase-AppCheck":"valid","X-Forwarded-For":ip},body:"{}"});
    for(let i=0;i<BIOBUZZ_ADMISSION_LIMITS.perIpHourlyCreates;i++)expect((await from("203.0.113.7","create")).status).toBe(200);
    const blocked=await from("203.0.113.7","create");
    expect(blocked.status).toBe(429);expect(blocked.headers.get("retry-after")).toBeTruthy();
    for(const variant of ["create/","CREATE"])expect((await from("203.0.113.7",variant)).status).toBe(429);
    expect((await from("203.0.113.7","queue")).status).toBe(200);
    expect((await from("198.51.100.4","queue")).status).toBe(200);
    expect((await from("198.51.100.4","create")).status).toBe(200);
    const day=Math.floor(Date.now()/86400000)*86400000;
    const dailyShare=createHmac("sha256",process.env.ABUSE_HMAC_SECRET as string).update(`aresweb-api-quota:v2:biobuzz-admission-ip-day:ip:192.0.2.9:${day}`).digest("hex");
    state.db.data.set("internal_api_quotas/"+dailyShare,{count:BIOBUZZ_ADMISSION_LIMITS.perIpDailyRequests});
    expect((await from("192.0.2.9","queue")).status).toBe(429);
    expect((await from("198.51.100.4","queue")).status).toBe(200);
  });
  it("keeps admission limits identical to the reviewed Cloud Run contract",()=>{
    const contract=JSON.parse(readFileSync(resolve(process.cwd(),"../infra/gcp/biobuzz-service.json"),"utf8"));
    const {maxRooms,...limits}=contract.admission;
    expect(maxRooms).toBe(1);expect(limits).toEqual(BIOBUZZ_ADMISSION_LIMITS);
    expect(BIOBUZZ_ADMISSION_LIMITS.perIpDailyRequests).toBeLessThan(BIOBUZZ_ADMISSION_LIMITS.projectDailyRequests);
    expect(BIOBUZZ_ADMISSION_LIMITS.projectDailyRequests*10).toBeLessThanOrEqual(BIOBUZZ_ADMISSION_LIMITS.monthlyRequests);
  });
  it("rejects foreign origins, wrong paths, malformed handshakes and forged capabilities",async()=>{
    const origin=await start();
    await expect(socket(origin,"/play","https://evil.example")).rejects.toThrow("403");
    await expect(socket(origin,"/wrong")).rejects.toThrow("403");
    for(const value of ["not json",JSON.stringify({type:"hello",version:2}),JSON.stringify({type:"hello",version:1,roomId:"a".repeat(36),token:"a".repeat(43)})]){
      const ws=await socket(origin),message=next(ws);ws.send(value);expect((await message).type).toBe("error");await once(ws,"close");
    }
  });
  it("exchanges authoritative snapshots, enforces messages, and reclaims a disconnected seat",async()=>{
    const origin=await start(),session=await (await post(origin,"create")).json(),ws=await socket(origin);
    const joined=next(ws);ws.send(JSON.stringify({type:"hello",version:1,roomId:session.roomId,token:session.token}));expect(await joined).toMatchObject({type:"joined",seat:0});
    let message=next(ws);ws.send(JSON.stringify({type:"configure",seats:["human","empty","empty","empty"]}));expect(await message).toMatchObject({type:"lobby"});
    message=next(ws);ws.send(JSON.stringify({type:"ready",auto:null}));await message;
    message=next(ws);ws.send(JSON.stringify({type:"start"}));expect(await message).toMatchObject({type:"lobby",lobby:{status:"running"}});
    message=next(ws);expect((await message).type).toBe("snapshot");
    await once(ws,"ping");
    await once(ws,"ping"); // The first automatic pong must have reached the server.
    ws.send(JSON.stringify({type:"input",sequence:0,input:NEUTRAL}));
    message=next(ws,"error");ws.send(JSON.stringify({type:"input",sequence:1,input:{...NEUTRAL,x:999}}));expect(await message).toMatchObject({type:"error"});
    const closed=once(ws,"close");ws.close();await closed;
    const resumed=await socket(origin);message=next(resumed);resumed.send(JSON.stringify({type:"hello",version:1,roomId:session.roomId,token:session.token}));expect(await message).toMatchObject({type:"joined",seat:0});
    running!.rooms.interruptAll();expect(running!.rooms.active).toBe(0);
  });
  it("closes an unbound socket and rejects excessive payloads",async()=>{
    const origin=await start(),idle=await socket(origin);expect((await once(idle,"close"))[0]).toBe(1008);
    const big=await socket(origin),closed=once(big,"close");big.send("a".repeat(33000));expect((await closed)[0]).toBe(1009);
  },10000);
  it("persists one final result with Firestore-compatible ordered flower stacks",async()=>{
    const origin=await start(),session=await (await post(origin,"create")).json();
    const peer={send:vi.fn(),close:vi.fn()},player=running!.rooms.attach(session.roomId,session.token,peer);
    player.receive({type:"configure",seats:["human","empty","empty","empty"]});player.receive({type:"ready",auto:null});player.receive({type:"start"});
    for(let tick=0;tick<9600;tick++)running!.rooms.step();
    await vi.waitFor(()=>expect(state.db.data.has("biobuzz_results/"+session.roomId)).toBe(true));
    const result=state.db.data.get("biobuzz_results/"+session.roomId)!;
    expect(result).toMatchObject({ruleVersion:"BIOBUZZ-V1",tally:{flowers:[{elements:expect.any(Array)},{elements:expect.any(Array)},{elements:expect.any(Array)},{elements:expect.any(Array)}]}});
  });
  it("rejects unsafe configuration before listening",()=>{
    vi.stubEnv("BIOBUZZ_PUBLIC_ORIGIN","");expect(()=>startBiobuzzServer()).toThrow("required");
    vi.stubEnv("BIOBUZZ_PUBLIC_ORIGIN","http://example.com");expect(()=>startBiobuzzServer()).toThrow("HTTPS");
    vi.stubEnv("BIOBUZZ_PUBLIC_ORIGIN","https://example.com");vi.stubEnv("BIOBUZZ_MAX_ROOMS","100");expect(()=>startBiobuzzServer()).toThrow("admission");
  });
  it("refreshes drain control and fails admission closed when its store fails",async()=>{
    const origin=await start();expect(running!.rooms.accepting).toBe(true);
    state.db.failRead="internal_biobuzz_control/service";
    await vi.waitFor(()=>expect(running!.rooms.accepting).toBe(false),{timeout:17000,interval:200});
    expect((await post(origin,"create")).status).toBe(503);
  },20000);
});
