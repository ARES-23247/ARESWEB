import express from "express";
import { z } from "zod";
import { createApiApp } from "../apiApp";
import type { BiobuzzRooms } from "../lib/biobuzzRooms";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { distributedQuotas } from "../middleware/distributedQuota";
export function createBiobuzzApp(rooms:BiobuzzRooms) {
  const router=express.Router();
  router.use(distributedQuotas([
    {scope:"biobuzz-admission-ip",limit:60,windowMs:3600000,identity:"ip",secretEnvironmentVariable:"ABUSE_HMAC_SECRET"},
    {scope:"biobuzz-admission-project",limit:4000,calendarWindow:"month",identity:"global",secretEnvironmentVariable:"ABUSE_HMAC_SECRET"},
  ]));
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
