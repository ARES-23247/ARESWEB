import { authenticatedFetch } from "./api";
import type { OnlineClient, Session } from "@ares/biobuzz/protocol";
const origin=String(import.meta.env.VITE_BIOBUZZ_ORIGIN??"").replace(/\/$/,"");
export const biobuzzOnline:OnlineClient|undefined=origin?{
  async admit(action,body={}){
    const response=await authenticatedFetch(origin+"/api/biobuzz/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Online simulator unavailable.");
    const session=result as Session,expected=new URL(origin);expected.protocol=expected.protocol==="https:"?"wss:":"ws:";expected.pathname="/play";
    if(session.socketUrl!==expected.toString())throw new Error("Unexpected simulator connection address.");
    return session;
  },
}:undefined;
