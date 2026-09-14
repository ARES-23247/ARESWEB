import type { AutoProgram, Config, Input, SeatKind, Snapshot, RobotSetup } from "./types";
export const PROTOCOL = 1;
export interface Session { roomId:string; token:string; seat:number; code:string; socketUrl:string }
export interface Lobby { roomId:string; code:string; public:boolean; seats:SeatKind[]; occupied:boolean[]; ready:boolean[]; host:number; status:"waiting"|"running"|"local-offer"|"finished"|"interrupted"; waitSeconds:number; robotSetups?:RobotSetup[] }
export type ClientMessage = {type:"hello";version:1;roomId:string;token:string}
 | {type:"input";sequence:number;input:Input}
 | {type:"ready";auto:AutoProgram|null}
 | {type:"configure";seats:SeatKind[]}
 | {type:"robot";setup:RobotSetup}
 | {type:"start"} | {type:"leave"};
export type ServerMessage = {type:"snapshot";state:Snapshot} | {type:"lobby";lobby:Lobby} | {type:"error";message:string} | {type:"joined";seat:number};
export interface OnlineClient { admit(action:"create"|"join"|"queue",body?:{code?:string;seats?:Config["seats"]}):Promise<Session> }
