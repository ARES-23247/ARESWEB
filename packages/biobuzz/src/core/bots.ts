import type { Simulation } from "./engine";
import { FIELD, ZONES } from "./field";
import { hiveTarget } from "./hive";
import { sideAngle,shooterHeading,canIntakeBall } from "./robot";
import { NEUTRAL, HALF, BALL, angle, clamp, distance, type Input, type Robot } from "./types";

function blocked(x:number,y:number) {
  return Math.abs(x)>HALF-0.24||Math.abs(y)>HALF-0.24||FIELD.obstacles.some(o=>Math.abs(x-o.x)<o.width/2+0.26&&Math.abs(y-o.y)<o.height/2+0.26);
}
/** Bounded A* over the same static obstacle geometry used by physics. */
export function navigation(start:{x:number;y:number},goal:{x:number;y:number},robots:readonly {x:number;y:number}[]=[]) {
  const occupied=(x:number,y:number)=>blocked(x,y)||robots.some(r=>Math.hypot(r.x-x,r.y-y)<0.65);
  const n=25,cell=(HALF*2-0.52)/(n-1),origin=-HALF+0.26;
  const index=(p:{x:number;y:number})=>Math.round(clamp((p.y-origin)/cell,0,n-1))*n+Math.round(clamp((p.x-origin)/cell,0,n-1));
  const point=(i:number)=>({x:origin+i%n*cell,y:origin+Math.floor(i/n)*cell});
  const from=index(start),to=index(goal),open=[from],g=new Map([[from,0]]),parent=new Map<number,number>(),closed=new Set<number>();
  for(let iterations=0;open.length&&iterations<n*n;iterations++) {
    open.sort((a,b)=>(g.get(a)!+distance(point(a),goal))-(g.get(b)!+distance(point(b),goal)));
    const current=open.shift()!;if(current===to){
      let next=to;while(parent.has(next)&&parent.get(next)!==from)next=parent.get(next)!;
      return next===to?goal:point(next);
    }
    closed.add(current);
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]) {
      const x=current%n+dx,y=Math.floor(current/n)+dy,next=y*n+x;
      if(x<0||y<0||x>=n||y>=n||closed.has(next))continue;
      const p=point(next);
      if(next!==to&&occupied(p.x,p.y))continue;
      if(dx&&dy&&(occupied(point(current).x+dx*cell,point(current).y)||occupied(point(current).x,point(current).y+dy*cell)))continue;
      const score=g.get(current)!+Math.hypot(dx,dy)*cell;
      if(score<(g.get(next)??Infinity)){g.set(next,score);parent.set(next,current);if(!open.includes(next))open.push(next);}
    }
  }
  return goal;
}
export function shotSpeed(range:number,height:number) {
  const d=Math.max(0.05,range-0.28),denominator=0.5*(d*Math.sqrt(3)-(height-0.36));
  return denominator>0?clamp(Math.sqrt(9.81*d*d/denominator),2,5.8):5.8;
}
const aiming=new WeakMap<Simulation,Map<number,number>>();
const routes=new WeakMap<Simulation,Map<number,{tick:number;goal:{x:number;y:number};waypoint:{x:number;y:number}}>>();
export function botInput(sim:Simulation,r:Robot):Input {
  const input={...NEUTRAL,release:true},late=sim.phase==="practice"||sim.tick>=98*60;
  let goal:{x:number;y:number},aim:{x:number;y:number}|undefined,canShoot=true;
  if(sim.phase==="teleop"&&sim.tick>=143*60) goal=ZONES[r.alliance].loading;
  else if(r.inventory.length){
    const nectar=r.inventory.some(id=>sim.balls[id].kind!=="pollen");
    if(late&&nectar){
      const f=sim.flowers[[1,0,3,2][r.id]];
      aim=f;goal=Math.abs(f.x)>Math.abs(f.y)?{x:f.x-Math.sign(f.x)*0.8,y:f.y}:{x:f.x,y:f.y-Math.sign(f.y)*0.8};
      input.speed=shotSpeed(distance(r,f),0.5461+BALL[sim.balls[r.inventory[0]].kind].diameter/2);
    }else{
      const h=sim.hives[r.id<2?0:1],target=hiveTarget(h);
      // Two alliance bots cover opposite ends and take turns as the hive tips.
      // A lone bot follows the open end so a human teammate need not assist it.
      const partner=sim.robots.find(other=>other.id!==r.id&&other.alliance===r.alliance&&other.controller!=="human");
      const end=partner?((r.id%2+(r.alliance==="blue"?1:0))%2):h.upward;
      aim=target;goal={x:(end===0?-1:1)*(partner?1.42:1.48),y:(r.alliance==="red"?1:-1)*(partner?1.42:1.03)};
      canShoot=end===h.upward;
      input.speed=shotSpeed(distance(r,aim),target.z);
      if(h.tipping)aim=undefined;
    }
  } else {
    const targets=[...sim.balls.filter(b=>b.location==="floor"&&canIntakeBall(r,b.kind)),...sim.flowers.filter(f=>f.balls.length&&sim.balls[f.balls[0]].kind==="pollen")];
    const approaches=targets.map(target=>{
      let dx=target.x-r.x,dy=target.y-r.y;
      const edgeX=Math.abs(target.x)>HALF-0.42,edgeY=Math.abs(target.y)>HALF-0.42;
      if(edgeX||edgeY){dx=edgeX?Math.sign(target.x):0;dy=edgeY?Math.sign(target.y):0;}
      const d=Math.hypot(dx,dy)||1;
      return {target,goal:{x:target.x-dx/d*0.40,y:target.y-dy/d*0.40}};
    }).filter(candidate=>!sim.robots.some(other=>other.id!==r.id&&distance(other,candidate.goal)<0.62))
      .sort((a,b)=>(late?Number("kind" in b.target&&b.target.kind===r.alliance)-Number("kind" in a.target&&a.target.kind===r.alliance):0)||distance(r,a.goal)-distance(r,b.goal));
    const candidate=approaches[0];if(!candidate)return input;
    goal=candidate.goal;aim=candidate.target;input.intake=true;
  }
  if(!aiming.has(sim))aiming.set(sim,new Map());
  if(!routes.has(sim))routes.set(sim,new Map());
  const cache=routes.get(sim)!,previous=cache.get(r.id);
  let waypoint=previous?.waypoint;
  if(!previous||sim.tick-previous.tick>=12||distance(previous.goal,goal)>0.2) {
    waypoint=navigation(r,goal,sim.robots.filter(other=>other.id!==r.id));cache.set(r.id,{tick:sim.tick,goal,waypoint});
  }
  waypoint??=goal;
  const speed=r.controller==="easy"?0.45:0.8;
  input.x=clamp((waypoint.x-r.x)*2,-speed,speed);input.y=clamp((waypoint.y-r.y)*2,-speed,speed);
  for(const other of sim.robots)if(other.id!==r.id&&distance(r,other)<0.62){
    const d=Math.max(0.1,distance(r,other));input.x+=(r.x-other.x)/d*0.25;input.y+=(r.y-other.y)/d*0.25;
  }
  if(aim){
    const side=input.intake?(r.setup.intake==="back"?"back":"front"):r.setup.shooter;
    const error=angle(Math.atan2(aim.y-r.y,aim.x-r.x)-(input.intake?r.heading+sideAngle(side):shooterHeading(r)));
    if(r.setup.turret&&!input.intake)input.turretTurn=clamp(error*1.5,-0.8,0.8);
    else input.turn=clamp(error*1.5,-0.8,0.8);
    if(r.inventory.length&&distance(r,goal)<0.06&&Math.abs(error)<(r.controller==="easy"?0.045:0.012)){
      const ticks=(aiming.get(sim)!.get(r.id)??0)+1;aiming.get(sim)!.set(r.id,ticks);
      input.x=0;input.y=0;input.shoot=canShoot&&ticks>30&&sim.tick%(r.controller==="easy"?90:36)===0;
    }else aiming.get(sim)!.set(r.id,0);
  }
  return input;
}
