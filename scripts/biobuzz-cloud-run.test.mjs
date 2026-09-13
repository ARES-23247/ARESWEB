import {describe,it,expect,vi,beforeEach,afterEach} from "vitest";
const state=vi.hoisted(()=>({enabled:false,existing:true,commandFailure:false,healthFailure:false,controlFailure:false,iamFailure:false,healthCalls:0,wait:false,revision:null}));
vi.mock("node:fs",async importOriginal=>{const original=await importOriginal();const readFileSync=(path,...args)=>{const text=original.readFileSync(path,...args);if(path!=="infra/gcp/biobuzz-service.json")return text;const c=JSON.parse(text);return JSON.stringify({...c,productionEnabled:state.enabled,launchVerification:state.enabled?{cloudRunGuardrail:true,totalProjectAlerts:true,targetCapacity:true}:c.launchVerification});};return {...original,readFileSync,default:{...original.default,readFileSync}};});
vi.mock("node:child_process",async importOriginal=>{const original=await importOriginal();const spawnSync=vi.fn((_command,args)=>{
 if(state.commandFailure)return {status:1,stderr:"test command failed"};
 const joined=args.join(" ");let data="";
 if(joined.startsWith("run services list"))data=JSON.stringify(state.existing?[{metadata:{name:"aresweb-biobuzz-sim"}}]:[]);
 else if(joined.startsWith("run services describe"))data=JSON.stringify(state.revision);
 else if(joined.startsWith("run services get-iam-policy"))data=JSON.stringify({bindings:[{role:"roles/run.invoker",members:state.iamFailure?["allAuthenticatedUsers"]:["allUsers"]}]});
 return {status:0,stdout:data};
});return {...original,spawnSync,default:{...original.default,spawnSync}};});
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {validateBiobuzzContract,deploymentArguments,verifyRevision,main,reportFailure} from "./biobuzz-cloud-run.mjs";
const contract=JSON.parse(readFileSync("infra/gcp/biobuzz-service.json","utf8"));
const sha="a".repeat(40),image="us-central1-docker.pkg.dev/aresfirst-portal/aresweb-services/biobuzz-sim:"+sha;
function revision(){return {spec:{template:{metadata:{annotations:{"autoscaling.knative.dev/maxScale":"1","run.googleapis.com/cpu-throttling":"false","run.googleapis.com/startup-cpu-boost":"false","run.googleapis.com/execution-environment":"gen2"}},spec:{serviceAccountName:contract.runtimeServiceAccount,containerConcurrency:128,timeoutSeconds:600,containers:[{image,resources:{limits:{cpu:"1",memory:"1Gi"}},env:[{name:"NODE_ENV",value:"production"},{name:"ENFORCE_APP_CHECK",value:"true"},{name:"BIOBUZZ_MAX_ROOMS",value:"1"},{name:"BIOBUZZ_PUBLIC_ORIGIN",value:contract.publicOrigin},{name:"ABUSE_HMAC_SECRET",valueFrom:{secretKeyRef:{name:"ABUSE_HMAC_SECRET",key:"latest"}}}]}]}}},status:{latestReadyRevisionName:"rev1",latestCreatedRevisionName:"rev1",traffic:[{revisionName:"rev1",percent:100}]}};}
beforeEach(()=>{
 Object.assign(state,{enabled:false,existing:true,commandFailure:false,healthFailure:false,controlFailure:false,iamFailure:false,healthCalls:0,wait:false,revision:revision()});
 vi.stubEnv("GITHUB_ACTIONS","true");vi.stubEnv("GITHUB_REF","refs/heads/master");vi.stubEnv("GOOGLE_GHA_CREDS_PATH","temporary-wif.json");
 vi.stubEnv("BIOBUZZ_DEPLOYMENT_ID_TOKEN","signed-test-token");
 vi.stubGlobal("fetch",vi.fn(async(url)=>{
  const control=url.endsWith("/internal/admission");
  if(!control)state.healthCalls++;
  return {ok:control?!state.controlFailure:!state.healthFailure,json:async()=>({version:1,accepting:false,active:state.wait&&state.healthCalls===1?1:0})};
 }));vi.mocked(spawnSync).mockClear();
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("BIOBUZZ deployment bounds",()=>{
 it("preserves scale-to-zero and keeps the smaller game service independent",async()=>{
  expect(validateBiobuzzContract(contract)).toBe(contract);
  const args=deploymentArguments(contract,image);expect(args).toContain("--no-cpu-throttling");expect(args).toContain("600s");expect(args).not.toContain("aresweb-game-api");
  await main(["--validate"]);await main(["--origin"]);await main(["--deploy"]);expect(spawnSync).not.toHaveBeenCalled();
 });
 it("requires launch evidence and rejects identity, quota, budget, and resource drift",()=>{
  for(const change of [{schemaVersion:2},{admission:{...contract.admission,maxRooms:5}},{runtime:{...contract.runtime,maxInstances:2}},{runtimeServiceAccount:"default"},{secrets:[]},{publicOrigin:"https://evil.example"},{productionEnabled:true,launchVerification:{...contract.launchVerification,targetCapacity:false}}])expect(()=>validateBiobuzzContract({...contract,...change})).toThrow();
  expect(()=>deploymentArguments(contract,"latest")).toThrow("immutable");
  verifyRevision(contract,state.revision,image);state.revision.spec.template.spec.timeoutSeconds=900;expect(()=>verifyRevision(contract,state.revision,image)).toThrow("contract");
 });
 it("keeps admission closed across deployment and requires a separately verified resume",async()=>{
  state.enabled=true;state.wait=true;await main(["--origin"]);await main(["--validate"]);await main(["--deploy",sha]);
  expect(fetch.mock.calls.filter(([url])=>url.endsWith("/internal/admission"))).toHaveLength(1);
  vi.stubEnv("BIOBUZZ_DEPLOYMENT_ID_TOKEN","fresh-resume-token");
  await main(["--resume",sha]);
  const requests=vi.mocked(fetch).mock.calls.filter(([url])=>url.endsWith("/internal/admission"));
  expect(requests.map(([,init])=>JSON.parse(init.body))).toEqual([{admissionOpen:false},{admissionOpen:true}]);
  expect(requests.map(([,init])=>init.headers.Authorization)).toEqual(["Bearer signed-test-token","Bearer fresh-resume-token"]);
  expect(spawnSync.mock.calls.some(([command,args])=>command==="docker"&&args[0]==="push")).toBe(true);
 },10000);
 it("supports the first deployment with admission closed until verification",async()=>{
  state.enabled=true;state.existing=false;await main(["--deploy",sha]);
  expect(fetch.mock.calls.filter(([url])=>url.endsWith("/internal/admission"))).toHaveLength(0);
  await main(["--resume",sha]);
  expect(fetch.mock.calls.filter(([url])=>url.endsWith("/internal/admission"))).toHaveLength(1);
 });
 it("never deploys or resumes without a fresh WIF token, and never resumes a different image",async()=>{
  state.enabled=true;vi.stubEnv("BIOBUZZ_DEPLOYMENT_ID_TOKEN","");
  for(const action of ["--deploy","--resume"])await expect(main([action,sha])).rejects.toThrow("fresh WIF");
  expect(spawnSync).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
  vi.stubEnv("BIOBUZZ_DEPLOYMENT_ID_TOKEN","fresh-resume-token");
  state.revision.spec.template.spec.containers[0].image="unexpected-image";
  await expect(main(["--resume",sha])).rejects.toThrow("contract");
  expect(fetch).not.toHaveBeenCalled();
 });
 it("fails closed on workflow identity, command, control, health, and invoker drift",async()=>{
  state.enabled=true;vi.stubEnv("GITHUB_REF","refs/heads/unreviewed");await expect(main(["--deploy",sha])).rejects.toThrow("protected");vi.stubEnv("GITHUB_REF","refs/heads/master");
  state.commandFailure=true;await expect(main(["--deploy",sha])).rejects.toThrow("test command failed");state.commandFailure=false;
  state.controlFailure=true;await expect(main(["--deploy",sha])).rejects.toThrow("admission control");state.controlFailure=false;
  state.healthFailure=true;await expect(main(["--deploy",sha])).rejects.toThrow("health check");state.healthFailure=false;
  state.iamFailure=true;await expect(main(["--deploy",sha])).rejects.toThrow("invoker policy");
 });
 it("reports CLI failure as an unsuccessful exit",()=>{const code=process.exitCode;vi.spyOn(console,"error").mockImplementation(()=>{});reportFailure(new Error("failed"));expect(process.exitCode).toBe(1);process.exitCode=code;});
});
