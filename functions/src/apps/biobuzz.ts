import express from "express";
import { z } from "zod";
import { createApiApp } from "../apiApp";
import type { BiobuzzRooms } from "../lib/biobuzzRooms";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { distributedQuotas, type DistributedQuotaOptions } from "../middleware/distributedQuota";
const HOUR_MS=3600000,DAY_MS=86400000;
/**
 * Admission limits mirrored by `infra/gcp/biobuzz-service.json`. Capacity is
 * one room, so per-address create caps and daily shares stop one client from
 * holding the room or exhausting the monthly budget for everyone else.
 */
export const BIOBUZZ_ADMISSION_LIMITS={
  monthlyRequests:4000,
  projectDailyRequests:400,
  perIpHourlyRequests:60,
  perIpDailyRequests:120,
  perIpHourlyCreates:6,
  perIpDailyCreates:20,
} as const;
const quota=(scope:string,limit:number,identity:"ip"|"global",window:number|"month"):DistributedQuotaOptions=>({
  scope,limit,identity,secretEnvironmentVariable:"ABUSE_HMAC_SECRET",
  ...(window==="month"?{calendarWindow:"month" as const}:{windowMs:window}),
});
// Per-address budgets come first so an address-specific denial never caches a project-wide block.
const admissionBudgets=[
  quota("biobuzz-admission-ip",BIOBUZZ_ADMISSION_LIMITS.perIpHourlyRequests,"ip",HOUR_MS),
  quota("biobuzz-admission-ip-day",BIOBUZZ_ADMISSION_LIMITS.perIpDailyRequests,"ip",DAY_MS),
  quota("biobuzz-admission-project-day",BIOBUZZ_ADMISSION_LIMITS.projectDailyRequests,"global",DAY_MS),
  quota("biobuzz-admission-project",BIOBUZZ_ADMISSION_LIMITS.monthlyRequests,"global","month"),
];
const createBudgets=[
  quota("biobuzz-create-ip",BIOBUZZ_ADMISSION_LIMITS.perIpHourlyCreates,"ip",HOUR_MS),
  quota("biobuzz-create-ip-day",BIOBUZZ_ADMISSION_LIMITS.perIpDailyCreates,"ip",DAY_MS),
];
export function createBiobuzzApp(rooms:BiobuzzRooms) {
  const router=express.Router();
  const admissionQuota=distributedQuotas(admissionBudgets);
  const createQuota=distributedQuotas([...admissionBudgets.slice(0,2),...createBudgets,...admissionBudgets.slice(2)]);
  // Express mount matching covers every path variant the create route accepts.
  router.use("/create",(req,res,next)=>{res.locals.biobuzzCreateQuota=true;void createQuota(req,res,next);});
  router.use((req,res,next)=>{if(res.locals.biobuzzCreateQuota===true)next();else void admissionQuota(req,res,next);});
  router.use(express.json({limit:"4kb"}));
  const parseError:express.ErrorRequestHandler=(error,_req,_res,next)=>{
    if(error?.type==="entity.too.large")next(new ApiError(413,"Simulator request exceeds 4 KiB."));
    else if(error?.type==="entity.parse.failed")next(new ApiError(400,"Malformed simulator JSON."));
    else next(error);
  };
  router.use(parseError);
  const schema=z.object({code:z.string().regex(/^[A-F0-9]{8}$/).optional()}).strict();
  for(const action of ["create","join","queue"] as const)router.post("/"+action,asyncHandler(async(req,res)=>{
    const parsed=schema.safeParse(req.body??{});
    if(!parsed.success||action==="join"&&!parsed.data.code)throw new ApiError(400,"Enter a valid room code.");
    res.set("Cache-Control","no-store").json(rooms.admit(action,parsed.data.code));
  }));
  return createApiApp({routes:[],preBodyRoutes:[{path:"/api/biobuzz",router}],globalRequestLimit:{max:3000,windowMs:15*60*1000}});
}
