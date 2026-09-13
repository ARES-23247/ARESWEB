import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
export function validateBiobuzzContract(c){
  if(c?.schemaVersion!==1||c.project!=="aresfirst-portal"||c.region!=="us-central1"||c.serviceId!=="aresweb-biobuzz-sim")throw new Error("Invalid BIOBUZZ deployment identity.");
  const r=c.runtime;
  if(r?.cpu!=="1"||r.memoryMiB!==1024||r.minInstances!==0||r.maxInstances!==1||r.concurrency!==128||r.timeoutSeconds!==600||r.executionEnvironment!=="gen2"||r.requestBasedBilling!==false||r.startupCpuBoost!==false)throw new Error("BIOBUZZ resources exceed the reviewed contract.");
  if(c.runtimeServiceAccount!=="aresweb-biobuzz-runtime@aresfirst-portal.iam.gserviceaccount.com"||JSON.stringify([...c.runtimeProjectRoles].sort())!==JSON.stringify(["roles/datastore.user","roles/firebaseappcheck.tokenVerifier"]))throw new Error("Invalid BIOBUZZ runtime permissions.");
  if(JSON.stringify(c.secrets)!=='["ABUSE_HMAC_SECRET"]'||c.admission?.maxRooms!==5||c.admission.monthlyRequests!==4000||c.admission.perIpHourlyRequests!==60)throw new Error("Invalid BIOBUZZ admission limits.");
  if(c.publicOrigin!=="https://aresweb-biobuzz-sim-205869391101.us-central1.run.app"||c.totalWebsiteMonthlyTargetUsd!==100||c.sharedCloudRunSpendingGuardrailUsd!==35)throw new Error("Invalid BIOBUZZ origin or budget.");
  if(c.productionEnabled&&(!c.launchVerification?.cloudRunGuardrail||!c.launchVerification.totalProjectAlerts||!c.launchVerification.targetCapacity))throw new Error("Verify the shared spending guardrail, project billing alerts, and target-runtime capacity before launch.");
  return c;
}
export function deploymentArguments(c,image){
  validateBiobuzzContract(c);
  if(!/^us-central1-docker\.pkg\.dev\/aresfirst-portal\/aresweb-services\/biobuzz-sim:[a-f0-9]{40}$/.test(image))throw new Error("Use an immutable commit image tag.");
  return ["run","deploy",c.serviceId,"--project",c.project,"--region",c.region,"--platform","managed","--image",image,"--service-account",c.runtimeServiceAccount,"--set-secrets","ABUSE_HMAC_SECRET=ABUSE_HMAC_SECRET:latest","--set-env-vars",`NODE_ENV=production,ENFORCE_APP_CHECK=true,BIOBUZZ_MAX_ROOMS=${c.admission.maxRooms},BIOBUZZ_PUBLIC_ORIGIN=${c.publicOrigin}`,"--cpu","1","--memory","1Gi","--concurrency","128","--min-instances","0","--max-instances","1","--timeout","600s","--execution-environment","gen2","--no-cpu-throttling","--no-cpu-boost","--ingress","all","--allow-unauthenticated","--quiet"];
}
function run(command,args){const r=spawnSync(command,args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]});if(r.status!==0)throw new Error(`${command} failed: ${r.stderr}`);return r.stdout.trim();}
async function admission(origin,open){
  const token=process.env.BIOBUZZ_DEPLOYMENT_ID_TOKEN;
  if(!token)throw new Error("A fresh WIF admission ID token is required.");
  const response=await fetch(origin+"/internal/admission",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({admissionOpen:open}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error("BIOBUZZ deployment admission control failed.");
}
export function verifyRevision(c,service,image){
  const t=service.spec?.template,a=t?.metadata?.annotations??{},container=t?.spec?.containers?.[0],env=Object.fromEntries((container?.env??[]).map(e=>[e.name,e.value??e.valueFrom]));
  if(t?.spec?.serviceAccountName!==c.runtimeServiceAccount||String(container?.resources?.limits?.cpu)!=="1"||!['1Gi','1024Mi'].includes(container?.resources?.limits?.memory)
    ||a["autoscaling.knative.dev/maxScale"]!=="1"||!['0',undefined].includes(a["autoscaling.knative.dev/minScale"])||a["run.googleapis.com/cpu-throttling"]!=="false"
    ||a["run.googleapis.com/startup-cpu-boost"]!=="false"||a["run.googleapis.com/execution-environment"]!=="gen2"||t.spec.containerConcurrency!==128||t.spec.timeoutSeconds!==600
    ||container.image!==image||env.NODE_ENV!=="production"||env.ENFORCE_APP_CHECK!=="true"||env.BIOBUZZ_MAX_ROOMS!=="5"||env.BIOBUZZ_PUBLIC_ORIGIN!==c.publicOrigin
    ||env.ABUSE_HMAC_SECRET?.secretKeyRef?.name!=="ABUSE_HMAC_SECRET"||env.ABUSE_HMAC_SECRET.secretKeyRef.key!=="latest"
    ||Object.keys(env).length!==5||service.status?.latestReadyRevisionName!==service.status?.latestCreatedRevisionName
    ||service.status?.traffic?.length!==1||service.status.traffic[0].percent!==100||service.status.traffic[0].revisionName!==service.status.latestReadyRevisionName)throw new Error("Deployed BIOBUZZ revision differs from its resource, secret, or traffic contract.");
}
async function health(origin){const response=await fetch(origin+"/health",{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error("BIOBUZZ health check failed.");return response.json();}
export async function main(args=process.argv.slice(2)){
  const c=validateBiobuzzContract(JSON.parse(readFileSync("infra/gcp/biobuzz-service.json","utf8")));
  if(args[0]==="--origin"){console.log(c.productionEnabled?c.publicOrigin:"");return;}
  if(!["--deploy","--resume"].includes(args[0])){console.log("BIOBUZZ service contract valid; production "+(c.productionEnabled?"enabled":"disabled"));return;}
  if(!c.productionEnabled){console.log("BIOBUZZ production rollout is disabled.");return;}
  if(process.env.GITHUB_ACTIONS!=="true"||process.env.GITHUB_REF!=="refs/heads/master"||!process.env.GOOGLE_GHA_CREDS_PATH)throw new Error("Deploy only through the protected production workflow and its WIF identity.");
  const image=`us-central1-docker.pkg.dev/${c.project}/aresweb-services/biobuzz-sim:${args[1]}`;
  const deploy=deploymentArguments(c,image);
  if(!process.env.BIOBUZZ_DEPLOYMENT_ID_TOKEN)throw new Error("A fresh WIF admission ID token is required before changing production.");
  if(args[0]==="--deploy"){
  const services=JSON.parse(run("gcloud",["run","services","list","--project",c.project,"--region",c.region,"--format=json"]));
  // A durable admission switch coordinates the old and new revisions, without copying rooms.
  if(services.some(service=>service.metadata?.name===c.serviceId)){
    await admission(c.publicOrigin,false);
    const deadline=Date.now()+240000;
    while(true){const status=await health(c.publicOrigin);if(!status.accepting&&status.active===0)break;if(Date.now()>deadline)throw new Error("BIOBUZZ did not drain; leave admission closed and investigate.");await new Promise(resolve=>setTimeout(resolve,5000));}
  }
  run("gcloud",["auth","configure-docker","us-central1-docker.pkg.dev","--quiet"]);
  run("docker",["build","--file","functions/Dockerfile.biobuzz","--tag",image,"."]);run("docker",["push",image]);run("gcloud",deploy);
  }
  const service=JSON.parse(run("gcloud",["run","services","describe",c.serviceId,"--project",c.project,"--region",c.region,"--format=json"]));
  verifyRevision(c,service,image);
  const policy=JSON.parse(run("gcloud",["run","services","get-iam-policy",c.serviceId,"--project",c.project,"--region",c.region,"--format=json"]));
  const invokers=policy.bindings?.filter(b=>b.role==="roles/run.invoker");
  if(invokers?.length!==1||JSON.stringify(invokers[0].members)!=='["allUsers"]'||invokers[0].condition)throw new Error("Unexpected BIOBUZZ invoker policy.");
  const status=await health(c.publicOrigin);if(status.version!==1||status.active!==0||status.accepting)throw new Error("Unexpected BIOBUZZ revision health.");
  // Result retention is declared in firestore.indexes.json and deployed before services.
  if(args[0]==="--resume"){
    await admission(c.publicOrigin,true);
    console.log("BIOBUZZ revision verified; admission reopened with a fresh WIF token.");
  }else console.log("BIOBUZZ deployed and verified with admission closed. Resume with a fresh WIF token.");
}
export function reportFailure(error){console.error(error.message);process.exitCode=1;}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)main().catch(reportFailure);
