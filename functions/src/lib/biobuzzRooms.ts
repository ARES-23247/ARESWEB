import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Simulation } from "../generated/games/biobuzz/engine";
import { validateAuto } from "../generated/games/biobuzz/auto";
import { validateRobotSetup } from "../generated/games/biobuzz/robot";
import type { AutoProgram, Input, SeatKind, Snapshot, RobotSetup } from "../generated/games/biobuzz/types";
import type { ClientMessage, Lobby, ServerMessage, Session } from "../generated/games/biobuzz/protocol";
import { ApiError } from "../middleware/errorHandler";
interface Peer { send(message:ServerMessage):void; close():void }
interface Player { hash:Buffer; ready:boolean; auto:AutoProgram|null; setup:RobotSetup; peer:Peer|null; disconnected:number; sequence:number; inputAt:number; tokens:number; lastInput:Input|null }
interface Room { id:string;code:string;public:boolean;seats:SeatKind[];players:(Player|null)[];host:number;created:number;lastHuman:number;status:Lobby["status"];sim:Simulation|null;ended:number;saved:boolean;saveAttempts:number;lastLobbySecond?:number }
interface Options { maxRooms:number; socketUrl:string; now?:()=>number; persist?:(roomId:string,state:Snapshot)=>Promise<void> }
const hash=(token:string)=>createHash("sha256").update(token).digest();
export class BiobuzzRooms {
  private rooms=new Map<string,Room>();
  private draining=false;
  private readonly now:()=>number;
  constructor(private readonly options:Options){this.now=options.now??Date.now;}
  get size(){return this.rooms.size;}
  get accepting(){return !this.draining;}
  get active(){return [...this.rooms.values()].filter(r=>r.status==="running").length;}
  drain(){this.draining=true;}
  setAdmission(open:boolean){this.draining=!open;}
  admit(action:"create"|"join"|"queue",code?:string):Session {
    if(this.draining)throw new ApiError(503,"Online simulator is restarting. Local practice remains available.");
    let room:Room|undefined;
    if(action==="join"){
      room=[...this.rooms.values()].find(r=>r.code===code&&r.status==="waiting"&&!r.public);
      if(!room)throw new ApiError(404,"Room is unavailable or has already started.");
    }
    if(action==="queue")room=[...this.rooms.values()].find(r=>r.public&&r.status==="waiting"&&r.players.some(p=>!p)&&this.now()-r.created<30000);
    if(!room){
      if(this.rooms.size>=this.options.maxRooms)throw new ApiError(503,"Online simulator is at capacity. Try local practice.");
      const id=randomBytes(18).toString("hex"),invite=randomBytes(6).toString("hex").slice(0,8).toUpperCase();
      room={id,code:invite,public:action==="queue",seats:["human","human","human","human"],players:[null,null,null,null],host:0,created:this.now(),lastHuman:this.now(),status:"waiting",sim:null,ended:0,saved:false,saveAttempts:0};
      this.rooms.set(id,room);
    }
    const seat=[0,2,1,3].find(i=>room!.seats[i]==="human"&&!room!.players[i]);
    if(seat===undefined)throw new ApiError(409,"Room has no open human seats.");
    const token=randomBytes(32).toString("base64url");
    room.players[seat]={hash:hash(token),ready:false,auto:null,setup:validateRobotSetup(undefined),peer:null,disconnected:this.now(),sequence:-1,inputAt:this.now(),tokens:60,lastInput:null};
    this.broadcastLobby(room);
    return {roomId:room.id,token,seat,code:room.code,socketUrl:this.options.socketUrl};
  }
  attach(roomId:string,token:string,peer:Peer) {
    const room=this.rooms.get(roomId);
    if(!room)throw new ApiError(410,"Room was interrupted or expired. Start a new match.");
    const tokenHash=hash(token),seat=room.players.findIndex(p=>p&&timingSafeEqual(p.hash,tokenHash));
    const player=room.players[seat];
    if(!player||this.now()-player.disconnected>30000&&!player.peer)throw new ApiError(401,"Player session expired.");
    player.peer?.close();player.peer=peer;player.sequence=-1;player.inputAt=this.now();player.tokens=60;
    room.lastHuman=this.now();room.sim?.setController(seat,"human");
    peer.send({type:"joined",seat});this.broadcastLobby(room);if(room.sim)peer.send({type:"snapshot",state:room.sim.snapshot()});
    return {
      receive:(message:ClientMessage)=>{if(player.peer===peer)this.receive(room,seat,message);},
      detach:()=>{if(player.peer===peer){player.peer=null;player.disconnected=this.now();player.lastInput=null;room.sim?.command(seat,{x:0,y:0,turn:0,intake:false,shoot:false,release:false,speed:5.8});}},
    };
  }
  private receive(room:Room,seat:number,m:ClientMessage) {
    const p=room.players[seat]!,now=this.now();
    p.tokens=Math.min(60,p.tokens+(now-p.inputAt)*0.06);p.inputAt=now;
    if(p.tokens<1)throw new ApiError(429,"Too many simulator messages.");p.tokens--;
    if(m.type==="input"){
      if(!Number.isSafeInteger(m.sequence)||m.sequence<=p.sequence)throw new ApiError(400,"Out-of-order input.");
      const i=m.input;
      if(!i||![i.x,i.y,i.turn,i.speed].every(Number.isFinite)||Math.abs(i.x)>2||Math.abs(i.y)>2||Math.abs(i.turn)>2||i.speed<2||i.speed>5.8
        ||[i.intake,i.shoot,i.release].some(v=>typeof v!=="boolean")||[i.aimHive,i.aimFlower,i.deposit,i.aim].some(v=>v!==undefined&&typeof v!=="boolean")
        ||(i.turretTurn!==undefined&&(!Number.isFinite(i.turretTurn)||Math.abs(i.turretTurn)>1)))throw new ApiError(400,"Invalid robot input.");
      p.sequence=m.sequence;p.lastInput=i;room.sim?.command(seat,i);return;
    }
    if(m.type==="leave"){
      room.players[seat]=null;room.seats[seat]=room.status==="waiting"?"human":"standard";
      room.sim?.setController(seat,"standard");
      if(room.host===seat)room.host=Math.max(0,room.players.findIndex(Boolean));
      p.peer?.close();this.broadcastLobby(room);return;
    }
    if(room.status!=="waiting")throw new ApiError(409,"The match setup is locked.");
    if(m.type==="robot"){
      if(p.ready)throw new ApiError(409,"Robot configuration is already locked.");
      try{p.setup=validateRobotSetup(m.setup);}catch{throw new ApiError(400,"Invalid robot configuration.");}
      this.broadcastLobby(room);return;
    }
    if(m.type==="ready"){
      if(p.ready)throw new ApiError(409,"Auto is already locked.");
      const auto=m.auto?validateAuto(m.auto):null;
      if(auto&&auto.alliance!==(seat<2?"red":"blue"))throw new ApiError(400,"Auto alliance does not match your seat.");
      p.setup=validateRobotSetup(auto?.robotSetup??p.setup);p.auto=auto;p.ready=true;this.broadcastLobby(room);return;
    }
    if(m.type==="configure"){
      if(seat!==room.host||room.public)throw new ApiError(403,"Only the private-room creator can configure seats.");
      if(!Array.isArray(m.seats)||m.seats.length!==4||m.seats.some((s,i)=>!["human","easy","standard","empty"].includes(s)||room.players[i]&&s!=="human"))throw new ApiError(400,"Invalid seat configuration.");
      room.seats=[...m.seats];this.broadcastLobby(room);return;
    }
    if(m.type==="start"){
      if(seat!==room.host||room.public)throw new ApiError(403,"Only the private-room creator can start.");
      if(room.players.some(p=>p&&!p.ready)||room.seats.some((s,i)=>s==="human"&&!room.players[i]))throw new ApiError(409,"Every human seat must be filled and ready.");
      this.start(room);return;
    }
    throw new ApiError(400,"Unknown simulator message.");
  }
  private start(room:Room) {
    try{room.sim=new Simulation({timed:true,seats:room.seats,autos:room.players.map(p=>p?.auto??null),robotSetups:room.players.map(p=>p?.setup??null)});}
    catch{throw new ApiError(400,"Starting poses are invalid or overlap. Create a new room with corrected autos.");}
    room.status="running";this.broadcastLobby(room);
  }
  private lobby(room:Room):Lobby {return {roomId:room.id,code:room.code,public:room.public,seats:[...room.seats],occupied:room.players.map(Boolean),ready:room.players.map(p=>p?.ready??false),host:room.host,status:room.status,waitSeconds:Math.max(0,Math.ceil((30000-(this.now()-room.created))/1000)),robotSetups:room.players.map(p=>validateRobotSetup(p?.setup))};}
  private broadcast(room:Room,message:ServerMessage){for(const p of room.players)p?.peer?.send(message);}
  private broadcastLobby(room:Room){this.broadcast(room,{type:"lobby",lobby:this.lobby(room)});}
  /** One call per fixed simulation step; wall-clock time only controls leases and lobby lifetimes. */
  step() {
    const now=this.now();
    for(const room of this.rooms.values()){
      if(room.players.some(p=>p?.peer))room.lastHuman=now;
      if(now-room.lastHuman>30000||room.status==="waiting"&&now-room.created>180000||room.ended&&now-room.ended>30000){this.remove(room);continue;}
      for(let seat=0;seat<4;seat++){
        const p=room.players[seat];if(!p)continue;
        if(!p.peer&&now-p.disconnected>=3000)room.sim?.setController(seat,"standard");
        if(!p.peer&&now-p.disconnected>30000){room.players[seat]=null;room.seats[seat]=room.status==="waiting"?"human":"standard";if(room.host===seat)room.host=Math.max(0,room.players.findIndex(Boolean));this.broadcastLobby(room);}
      }
      if(room.public&&room.status==="waiting"&&(room.players.every(p=>p?.peer&&p.ready)||now-room.created>=30000)){
        const count=room.players.filter(p=>p?.peer).length;
        if(count<=1){room.status="local-offer";room.ended=now;this.broadcastLobby(room);}
        else {
          room.seats=room.players.map(p=>p?.peer?"human":"standard");
          try{this.start(room);}catch{room.status="interrupted";room.ended=now;this.broadcast(room,{type:"error",message:"Starting poses overlap. Create a new match with corrected autos."});this.broadcastLobby(room);}
        }
      }
      if(room.status==="waiting"&&room.lastLobbySecond!==Math.floor(now/1000)){room.lastLobbySecond=Math.floor(now/1000);this.broadcastLobby(room);}
      if(room.status==="running"&&room.sim){
        room.sim.step();
        if(room.sim.tick%6===0)this.broadcast(room,{type:"snapshot",state:room.sim.snapshot()});
        if(["finished","interrupted"].includes(room.sim.phase)){
          room.status=room.sim.phase==="finished"?"finished":"interrupted";room.ended=now;
          this.broadcast(room,{type:"snapshot",state:room.sim.snapshot()});this.broadcastLobby(room);
        }
      }
      if(room.status==="finished"&&!room.saved&&room.saveAttempts<3){
        room.saved=true;room.saveAttempts++;
        void this.options.persist?.(room.id,room.sim!.snapshot()).catch(()=>{room.saved=false;this.broadcast(room,{type:"error",message:"Result could not be saved. Your on-screen score remains available."});});
      }
    }
  }
  private remove(room:Room){this.rooms.delete(room.id);for(const p of room.players)p?.peer?.close();}
  interruptAll(){for(const room of this.rooms.values()){if(room.status==="finished"||room.status==="interrupted"||room.status==="local-offer")continue;room.sim?.interrupt();if(room.sim)this.broadcast(room,{type:"snapshot",state:room.sim.snapshot()});room.status="interrupted";room.ended=this.now();this.broadcast(room,{type:"error",message:"Simulator interrupted. This match has no final result."});this.broadcastLobby(room);}}
  close(){this.draining=true;for(const room of this.rooms.values())this.remove(room);}
}
