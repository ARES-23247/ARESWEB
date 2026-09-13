import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { BiobuzzRooms } from "./lib/biobuzzRooms";
import { createBiobuzzApp } from "./apps/biobuzz";
import { allowedOrigins } from "./functionConfig";
import { adminDb } from "./lib/firebase-admin";
import { logger } from "./lib/logger";
import { ApiError } from "./middleware/errorHandler";
import { globalErrorHandler } from "./middleware/errorHandler";
import express from "express";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { asyncHandler } from "./lib/utils";
import type { ClientMessage } from "./generated/games/biobuzz/protocol";
export function attachBiobuzzSockets(server:Server,rooms:BiobuzzRooms,origins:readonly string[]) {
  const wss=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:{threshold:1024,serverNoContextTakeover:true,clientNoContextTakeover:true,concurrencyLimit:4,zlibDeflateOptions:{level:1}}});
  server.on("upgrade",(req,socket,head)=>{
    if(req.url!=="/play"||!req.headers.origin||!origins.includes(req.headers.origin)||wss.clients.size>=128){socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");socket.destroy();return;}
    wss.handleUpgrade(req,socket,head,ws=>wss.emit("connection",ws));
  });
  wss.on("connection",ws=>{
    let binding:ReturnType<BiobuzzRooms["attach"]>|null=null;
    let lastPong=Date.now();
    ws.on("pong",()=>{lastPong=Date.now();});
    const heartbeat=setInterval(()=>{if(!binding)return;if(Date.now()-lastPong>3000)ws.terminate();else ws.ping();},1000);
    const timeout=setTimeout(()=>ws.close(1008,"Handshake required"),5000);
    ws.on("error",()=>ws.close());
    ws.on("message",raw=>{
      try{
        const m=JSON.parse(raw.toString()) as ClientMessage;
        if(!binding){
          if(m?.type!=="hello"||m.version!==1||typeof m.roomId!=="string"||!/^[a-f0-9]{36}$/.test(m.roomId)||typeof m.token!=="string"||!/^[A-Za-z0-9_-]{43}$/.test(m.token))throw new ApiError(401,"Invalid player handshake.");
          binding=rooms.attach(m.roomId,m.token,{send:message=>{
            if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>256*1024){ws.close(1013,"Connection too slow");return;}ws.send(JSON.stringify(message));}
          },close:()=>ws.close()});
          clearTimeout(timeout);
        }else binding.receive(m);
      }catch(e){ws.send(JSON.stringify({type:"error",message:e instanceof ApiError?e.message:"Invalid simulator message."}));if (!binding || (e instanceof ApiError && e.status === 429)) ws.close(1008);}
    });
    ws.on("close",()=>{clearInterval(heartbeat);clearTimeout(timeout);binding?.detach();});
  });
  return wss;
}
export function startBiobuzzServer() {
  const origin=process.env.BIOBUZZ_PUBLIC_ORIGIN;
  if(!origin)throw new Error("BIOBUZZ_PUBLIC_ORIGIN is required.");
  const url=new URL(origin);
  if(url.protocol!=="https:"&&!(process.env.NODE_ENV==="test"&&url.hostname==="127.0.0.1"))throw new Error("Simulator origin must use HTTPS.");
  const limit=Number(process.env.BIOBUZZ_MAX_ROOMS??"5");
  if(!Number.isInteger(limit)||limit<1||limit>25)throw new Error("Invalid room admission limit.");
  const rooms=new BiobuzzRooms({maxRooms:limit,socketUrl:origin.replace(/^http/,"ws")+"/play",persist:async(id,state)=>{
    const ref=adminDb.collection("biobuzz_results").doc(id);
    // Firestore cannot store arrays directly inside arrays; preserve ordered stacks as records.
    const tally={...state.tally,flowers:state.tally.flowers.map(elements=>({elements}))};
    await adminDb.runTransaction(async tx=>{if(!(await tx.get(ref)).exists)tx.set(ref,{version:1,ruleVersion:"BIOBUZZ-V1",score:state.score,tally,finishedAt:new Date(),expiresAt:new Date(Date.now()+7*86400000)});});
  }});
  rooms.drain();
  const app=express(),identity=new OAuth2Client();
  app.disable("x-powered-by");app.set("trust proxy",1);
  app.post("/internal/admission",rateLimit({windowMs:3600000,max:30}),asyncHandler(async(req,_res,next)=>{
    const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
    if(!token||req.headers.origin)throw new ApiError(401,"Deployment identity required.");
    let verified=false;
    try{const ticket=await identity.verifyIdToken({idToken:token,audience:origin}),claims=ticket.getPayload();verified=claims?.sub==="100713596623775501367";}catch{verified=false;}
    if(!verified)throw new ApiError(403,"Deployment identity rejected.");
    next();
  }),express.json({limit:"1kb"}),asyncHandler(async(req,res)=>{
    if(!req.body||typeof req.body.admissionOpen!=="boolean"||Object.keys(req.body).length!==1)throw new ApiError(400,"Specify admissionOpen only.");
    await adminDb.collection("internal_biobuzz_control").doc("service").set({admissionOpen:req.body.admissionOpen,updatedAt:new Date()});
    rooms.setAdmission(req.body.admissionOpen);res.set("Cache-Control","no-store").json({accepting:rooms.accepting,active:rooms.active});
  }));
  app.use(createBiobuzzApp(rooms));app.use(globalErrorHandler);
  const server=createServer((req,res)=>{
    if(req.method==="GET"&&req.url==="/health"){res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});res.end(JSON.stringify({version:1,accepting:rooms.accepting,active:rooms.active,rooms:rooms.size}));return;}
    app(req,res);
  });
  let controlPending=false;
  const readControl=async()=>{
    if(controlPending)return;
    controlPending=true;
    try{const doc=await adminDb.collection("internal_biobuzz_control").doc("service").get();rooms.setAdmission(doc.data()?.admissionOpen===true);}
    catch{rooms.drain();logger.warn("biobuzz","Admission control unavailable; local practice remains available.");}
    finally{controlPending=false;}
  };
  void readControl();
  const controlTimer=setInterval(()=>{void readControl();},15000);
  const origins:string[]=[...allowedOrigins];
  if(process.env.NODE_ENV==="test")origins.push(url.origin);
  const wss=attachBiobuzzSockets(server,rooms,origins);
  let previous=performance.now(),accumulator=0,lastLog=previous;
  const timer=setInterval(()=>{
    const now=performance.now(),delta=(now-previous)/1000;previous=now;accumulator+=delta;
    if(accumulator>0.5){rooms.interruptAll();accumulator=0;}
    while(accumulator>=1/60){rooms.step();accumulator-=1/60;}
    if(now-lastLog>=60000){logger.info("biobuzz","Simulator capacity",{rooms:rooms.size,rssMiB:Math.round(process.memoryUsage().rss/1048576)});lastLog=now;}
  },8);
  server.listen(Number(process.env.PORT??8080));
  const stop=()=>{process.off("SIGTERM",stop);process.off("SIGINT",stop);rooms.drain();clearInterval(timer);clearInterval(controlTimer);rooms.interruptAll();rooms.close();wss.close();server.close();};
  process.once("SIGTERM",stop);process.once("SIGINT",stop);
  return {server,rooms,stop};
}
if(require.main===module)startBiobuzzServer();
