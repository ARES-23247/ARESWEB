import { getAppCheckHeader } from "./firebaseAppCheck";
import type { OnlineClient, Session } from "@ares/biobuzz/protocol";
const origin=String(import.meta.env.VITE_BIOBUZZ_ORIGIN??"").replace(/\/$/,"");
/**
 * Admission is anonymous and App-Checked. The separate simulator origin never
 * receives the Firebase ID token, which is valid for every ARES API.
 */
export const biobuzzOnline:OnlineClient|undefined=origin?{
  async admit(action,body={}){
    const response=await fetch(origin+"/api/biobuzz/"+action,{method:"POST",headers:{"Content-Type":"application/json",...await getAppCheckHeader()},body:JSON.stringify(body)});
    const result=await response.json().catch(()=>null);
    if(!response.ok||!result)throw new Error(typeof result?.error==="string"&&result.error?result.error:"Online simulator unavailable.");
    const session=result as Session,expected=new URL(origin);expected.protocol=expected.protocol==="https:"?"wss:":"ws:";expected.pathname="/play";
    if(session.socketUrl!==expected.toString())throw new Error("Unexpected simulator connection address.");
    return session;
  },
}:undefined;
