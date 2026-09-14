import { World, Vec2, Box, Circle, type Body } from "planck";
import { FIELD, ZONES, inZone } from "./field";
import { emptyMatch, scoreMatch } from "./scoring";
import { validateAuto } from "./auto";
import { botInput } from "./bots";
import { HIVE, hitHive, hivePoint } from "./hive";
import { SHOOTER, clearHiveShot, planHiveShot, clearFlowerShot, planFlowerShot, type ShotPlan, type FlowerShotPlan } from "./shooting";
import { validateRobotSetup,sideAngle,shooterHeading,ROBOT_LIMITS } from "./robot";
import { BALL, DT, HALF, ROBOT_HALF, FLOWER_TOP, FLOWER_MIDDLE, FLOWER_BASE, NEUTRAL, clamp, angle, distance, startingPose,
  type Alliance, type Ball, type Config, type Flower, type GameEvent, type Hive, type Input, type Phase, type Robot, type Snapshot, type MechanismSide } from "./types";

export function tipLoad(kinds: readonly (keyof typeof BALL)[]) { return kinds.reduce((sum, k) => sum + BALL[k].pounds, 0) + 1e-9 >= 0.440; }
export function flowerStack(balls: readonly Ball[], ids: readonly number[]) {
  let height = FLOWER_BASE;
  return ids.map(id => { const b = balls[id]; const bottom = height; height += BALL[b.kind].diameter; return { id, bottom, top: height, scoring: height > FLOWER_MIDDLE && bottom < FLOWER_TOP }; });
}
function hull(robot: Robot) { return ROBOT_HALF * (Math.abs(Math.sin(robot.heading)) + Math.abs(Math.cos(robot.heading))); }
export function parked(robot: Robot) {
  const z = ZONES[robot.alliance].loading, c = Math.cos(robot.heading), s = Math.sin(robot.heading);
  const dx = z.x - robot.x, dy = z.y - robot.y;
  return Math.abs(dx) <= z.halfX + hull(robot) && Math.abs(dy) <= z.halfY + hull(robot)
    && Math.abs(dx*c+dy*s) <= ROBOT_HALF + Math.abs(c)*z.halfX + Math.abs(s)*z.halfY
    && Math.abs(-dx*s+dy*c) <= ROBOT_HALF + Math.abs(s)*z.halfX + Math.abs(c)*z.halfY;
}
export class Simulation {
  readonly world = new World(Vec2(0, 0));
  readonly config: Config;
  readonly robots: Robot[] = [];
  readonly balls: Ball[] = [];
  readonly flowers: Flower[] = FIELD.fieldWaypoints.slice(0, 4).map(p => ({ x: p.x, y: p.y, balls: [] }));
  readonly hives: Hive[] = ["red", "blue"].map((color, i) => ({ alliance: color as Alliance, x: 0, y: i ? -0.32385 : 0.32385,
    angle: i ? Math.PI/6 : -Math.PI/6, upward: i ? 1 : 0, progress: 0, tipping: false, dumped: false, cells: [[], []], tips: 0 }));
  readonly tally = emptyMatch();
  readonly credits = { red: 0, blue: 0 };
  readonly events: GameEvent[] = [];
  tick = 0;
  phase: Phase;
  private robotBodies = new Map<number, Body>();
  private ballBodies = new Map<number, Body>();
  private commands = new Map<number, { input: Input; tick: number; shootEdge:boolean; depositEdge:boolean; aimEdge:boolean }>();
  private previousShot = new Map<number, boolean>();
  private previousDeposit = new Map<number, boolean>();
  private previousAim = new Map<number, boolean>();
  private nextIntake = new Map<number, number>();
  private nextShot = new Map<number, number>();
  private aimedShots = new Map<number, {target:"hive"|"flower";autoFire:boolean;started:number;planned:number;readyAt:number;fireUntil:number;plan:ShotPlan|FlowerShotPlan|null}>();
  private shotPlans = new Map<number, {tick:number;x:number;y:number;kind:Ball["kind"];geometry:string;plan:ShotPlan|FlowerShotPlan|null}>();
  private autoState = new Map<number, { index: number; started: number; intake: boolean }>();
  private pins = new Map<string, { ticks: number; clear: number; start: {x:number;y:number}; otherStart: {x:number;y:number} }>();
  private interfered = new Set<number>();
  private settledTicks = 0;

  constructor(config: Config = { timed: false, seats: ["human", "empty", "empty", "empty"] }) {
    if (config.seats.length !== 4 || config.seats.some(s => !["human","easy","standard","empty"].includes(s))) throw new Error("Select four valid seats.");
    this.config = structuredClone(config);
    this.phase = config.timed ? "auto" : "practice";
    const solid = this.world.createBody();
    for (const [x,y,w,h] of [[HALF+0.025,0,0.05,HALF*2],[ -HALF-0.025,0,0.05,HALF*2],[0,HALF+0.025,HALF*2,0.05],[0,-HALF-0.025,HALF*2,0.05]]) solid.createFixture(Box(w/2,h/2,Vec2(x,y)), { friction: 0.45 });
    for (const o of FIELD.obstacles) solid.createFixture(Box(o.width/2,o.height/2,Vec2(o.x,o.y)), { friction: 0.45 });
    for (let id=0;id<4;id++) {
      const controller=config.seats[id];
      if (controller==="empty") continue;
      const program=config.autos?.[id] ? validateAuto(config.autos[id]) : null;
      const alliance: Alliance=id<2?"red":"blue";
      if (program && program.alliance!==alliance) throw new Error("Auto alliance does not match its seat.");
      const p=program?.start ?? startingPose(id);
      if (this.robots.some(r => distance(r,p)<0.64)) throw new Error("Starting robots overlap.");
      const robot: Robot={...p,id,alliance,controller,inventory:[],setup:validateRobotSetup(program?.robotSetup??config.robotSetups?.[id])};
      this.robots.push(robot);
      const body=this.world.createDynamicBody({position:Vec2(p.x,p.y),angle:p.heading,linearDamping:4,angularDamping:6,bullet:true});
      body.setUserData(id);
      body.createFixture(Box(ROBOT_HALF,ROBOT_HALF),{density:15/0.45**2,friction:0.45,restitution:0.08});
      this.robotBodies.set(id,body);
      this.autoState.set(id,{index:0,started:0,intake:false});
    }
    for (let f=0;f<4;f++) for(let j=0;j<4;j++) this.store(this.add("pollen"),"flower",f);
    for(let seat=0;seat<4;seat++) for(let j=0;j<4;j++) {
      const b=this.add("pollen"), r=this.robots.find(r=>r.id===seat);
      if(r) this.store(b,"robot",seat); // absent robot preloads remain outside solo practice
    }
    for(const alliance of ["red","blue"] as const) {
      const z=ZONES[alliance].garden;
      for(let j=0;j<4;j++) this.floor(this.add("pollen"),z.x,z.y+(j-1.5)*0.12);
      const h=alliance==="red"?0:1;
      for(let j=0;j<3;j++) this.store(this.add(alliance),"hive",h*2+this.hives[h].upward);
      for(let j=0;j<5;j++) this.add(alliance);
    }
  }
  private add(kind: Ball["kind"]) {
    const b:Ball={id:this.balls.length,kind,x:0,y:0,z:BALL[kind].diameter/2,vx:0,vy:0,vz:0,location:"reserve",container:-1,returnAt:0};
    this.balls.push(b); return b;
  }
  private event(type: GameEvent["type"],message:string) {
    this.events.push({tick:this.tick,type,message}); if(this.events.length>40)this.events.shift();
  }
  private detach(b:Ball) {
    const body=this.ballBodies.get(b.id); if(body){this.world.destroyBody(body);this.ballBodies.delete(b.id);}
    for(const r of this.robots) r.inventory=r.inventory.filter(id=>id!==b.id);
    for(const f of this.flowers) f.balls=f.balls.filter(id=>id!==b.id);
    for(const h of this.hives) h.cells=h.cells.map(cell=>cell.filter(id=>id!==b.id));
  }
  private store(b:Ball, location:"robot"|"flower"|"hive", container:number) {
    this.detach(b); b.location=location;b.container=container;b.vx=0;b.vy=0;b.vz=0;
    if(location==="robot") this.robots.find(r=>r.id===container)!.inventory.push(b.id);
    if(location==="flower") this.flowers[container].balls.push(b.id);
    if(location==="hive") this.hives[Math.floor(container/2)].cells[container%2].push(b.id);
  }
  private floor(b:Ball,x:number,y:number) {
    this.detach(b);b.location="floor";b.container=-1;b.z=BALL[b.kind].diameter/2;
    b.x=clamp(x,-HALF+b.z,HALF-b.z);b.y=clamp(y,-HALF+b.z,HALF-b.z);b.vz=0;
    const body=this.world.createDynamicBody({position:Vec2(b.x,b.y),linearDamping:1.2,angularDamping:1.5,bullet:true});
    body.createFixture(Circle(b.z),{density:BALL[b.kind].pounds*0.45359237/(Math.PI*b.z*b.z),friction:0.45,restitution:0.35});
    body.setLinearVelocity(Vec2(b.vx,b.vy));this.ballBodies.set(b.id,body);
  }
  private airborne(b:Ball,x:number,y:number,z:number,vx:number,vy:number,vz:number) {
    this.detach(b);Object.assign(b,{location:"air",container:-1,x,y,z,vx,vy,vz});
  }
  command(id:number,input:Input) {
    const robot=this.robots.find(r=>r.id===id);if(!robot)return;
    if(![input.x,input.y,input.turn,input.speed,input.turretTurn??0].every(Number.isFinite)) {this.commands.delete(id);this.cancelShot(robot);return;}
    const aimingFlower=this.aimedShots.get(id)?.target==="flower";
    if((aimingFlower?!input.aimFlower:!input.aimHive)||input.turretTurn||((!robot.setup.turret||aimingFlower)&&(input.x||input.y||input.turn)))this.cancelShot(robot);
    const previous=this.commands.get(id),enabled=input.aimHive===true||input.aimFlower===true;
    // Preserve one pending edge if a network packet contains a press and its
    // release arrives before the next fixed step. Neutral/disabled input clears it.
    const shootEdge=enabled&&((input.shoot===true&&!previous?.input.shoot)||previous?.shootEdge===true);
    const depositEdge=input.aimFlower===true&&((input.deposit===true&&!previous?.input.deposit)||previous?.depositEdge===true);
    const aimEdge=input.aimHive===true&&((input.aim===true&&!previous?.input.aim)||previous?.aimEdge===true);
    this.commands.set(id,{input:{x:clamp(input.x,-1,1),y:clamp(input.y,-1,1),turn:clamp(input.turn,-1,1),
      speed:clamp(input.speed,2,5.8),intake:input.intake===true,shoot:input.shoot===true,release:input.release===true,aimHive:input.aimHive===true,aimFlower:input.aimFlower===true,deposit:input.deposit===true,
      ...(input.aim!==undefined?{aim:input.aim===true}:{}),turretTurn:clamp(input.turretTurn??0,-1,1)},tick:this.tick,shootEdge,depositEdge,aimEdge});
  }
  private cancelShot(robot:Robot,status?:Robot["shotStatus"]) {
    this.aimedShots.delete(robot.id);robot.shotStatus=status;robot.shotSpeed=undefined;if(!status)robot.shotTarget=undefined;
  }
  setController(id:number,controller:Robot["controller"]) {
    const r=this.robots.find(r=>r.id===id);if(r){this.cancelShot(r);r.controller=controller;this.commands.delete(id);this.previousShot.delete(id);this.previousDeposit.delete(id);this.previousAim.delete(id);}
  }
  interrupt() {this.phase="interrupted";this.commands.clear();for(const r of this.robots)this.cancelShot(r);for(const b of this.robotBodies.values()){b.setLinearVelocity(Vec2());b.setAngularVelocity(0);}}
  release(alliance:Alliance) {
    // G426/G427 model the drive team's floor release independently of robot
    // control. A completed AUTO tip also unlocks nectar; deadlines stop releases.
    if(!["auto","transition","teleop","practice"].includes(this.phase)) return false;
    const free=this.phase==="practice" || this.tick>= (30+8+60)*60;
    if(!free && this.credits[alliance]<=0)return false;
    const b=this.balls.find(b=>b.kind===alliance&&b.location==="reserve");
    if(!b)return false;
    const z=ZONES[alliance].loading;
    const candidates=[-0.2,-0.1,0,0.1,0.2].map(dx=>({x:z.x+dx,y:z.y}));
    const p=candidates.find(p=>!this.robots.some(r=>distance(r,p)<hull(r)+BALL[b.kind].diameter/2)
      && !this.balls.some(o=>o.location==="floor"&&distance(o,p)<(BALL[o.kind].diameter+BALL[b.kind].diameter)/2));
    if(!p)return false;
    this.floor(b,p.x,p.y);if(this.credits[alliance]>0)this.credits[alliance]--;
    this.event("release",alliance+" nectar released onto the loading-zone floor.");return true;
  }
  private autoInput(r:Robot):Input {
    const p=this.config.autos?.[r.id],a=this.autoState.get(r.id)!;
    if(!p || a.index>=p.steps.length)return {...NEUTRAL};
    const step=p.steps[a.index],elapsed=(this.tick-a.started)*DT;
    const result={...NEUTRAL,intake:a.intake};
    let done=false;
    if(step.kind==="intake"){a.intake=step.enabled;result.intake=a.intake;done=true;}
    if(step.kind==="wait")done=elapsed>=step.seconds;
    if(step.kind==="drive") {
      const d=distance(r,step.target),limit=step.preset==="safe"?0.45:0.8;
      result.x=clamp((step.target.x-r.x)*2,-limit,limit);result.y=clamp((step.target.y-r.y)*2,-limit,limit);
      result.turn=clamp(angle(step.target.heading-r.heading)*1.5,-0.7,0.7);
      done=d<0.035&&Math.abs(angle(step.target.heading-r.heading))<0.04;
    }
    if(step.kind==="shoot") {
      result.speed=step.speed;
      const pulse=elapsed-0.5;
      result.shoot=pulse>=0&&pulse<step.count*0.4&&pulse%0.4<0.12;
      done=elapsed>=0.5+step.count*0.4;
    }
    if(done){a.index++;a.started=this.tick;if(a.index>=p.steps.length)return {...NEUTRAL};}
    return result;
  }
  step() {
    if(this.phase==="finished"||this.phase==="interrupted")return;
    const active=this.phase==="practice"||this.phase==="teleop"||this.phase==="auto";
    const applied=new Map<number,Input>(),shotEdges=new Set<number>();
    for(const r of this.robots) {
      const command=this.commands.get(r.id);
      let input={...NEUTRAL};
      if(active) {
        if(this.phase==="auto"&&this.config.autos?.[r.id])input=this.autoInput(r);
        else if(r.controller==="easy"||r.controller==="standard")input=botInput(this,r);
        else if(this.phase!=="auto"&&command&&this.tick-command.tick<15)input=command.input;
      }
      const humanInput=active&&r.controller==="human"&&this.phase!=="auto"&&command&&this.tick-command.tick<15;
      const pendingShot=!!humanInput&&command.shootEdge,pendingDeposit=!!humanInput&&command.depositEdge,pendingAim=!!humanInput&&command.aimEdge;
      if(command){command.shootEdge=false;command.depositEdge=false;command.aimEdge=false;}
      if(pendingShot||pendingDeposit||pendingAim)input={...input,shoot:input.shoot||pendingShot,deposit:input.deposit||pendingDeposit,...(pendingAim?{aim:true}:{})};
      if(pendingShot||input.shoot&&!this.previousShot.get(r.id))shotEdges.add(r.id);
      this.previousShot.set(r.id,input.shoot);
      const depositEdge=pendingDeposit||input.deposit&&!this.previousDeposit.get(r.id);
      this.previousDeposit.set(r.id,input.deposit===true);
      const aimEdge=pendingAim||input.aim&&!this.previousAim.get(r.id);
      this.previousAim.set(r.id,input.aim===true);
      // An explicit aim field opts into separate controls. Older clients retain
      // their one-press shot behavior during a rolling website/service update.
      if((input.aimHive&&(aimEdge||(input.aim===undefined&&shotEdges.has(r.id))))||depositEdge) {
        if(this.aimedShots.has(r.id))this.cancelShot(r);
        else if(r.inventory.length&&((r.setup.turret&&!depositEdge)||(!input.x&&!input.y&&!input.turn))){
          const target=depositEdge?"flower":"hive";
          this.aimedShots.set(r.id,{target,autoFire:!!depositEdge||input.aim===undefined,started:this.tick,planned:-Infinity,readyAt:-Infinity,fireUntil:-Infinity,plan:null});r.shotStatus="aiming";r.shotTarget=target;
        }
      }
      const aim=this.aimedShots.get(r.id);
      if(aim) {
        // Allow a half-turn and the proportional alignment tail at the selected
        // chassis speed. Slow configurations must still be able to place balls.
        const timeoutTicks=60*Math.max(5,8/(r.setup.turnSpeed??ROBOT_LIMITS.turnSpeed.default));
        // A snapshot can still show Ready while the next trajectory check is
        // settling. Accept that explicit click briefly, with final geometry
        // validation, instead of losing it across worker/WebSocket latency.
        if(!aim.autoFire&&shotEdges.has(r.id)&&this.tick-aim.readyAt<=15)aim.fireUntil=this.tick+15;
        if((aim.target==="hive"?!input.aimHive:!input.aimFlower)||!r.inventory.length||(aim.autoFire&&this.tick-aim.started>timeoutTicks)){this.cancelShot(r);}
        else {
          const target=r.alliance==="red"?0:1,h=this.hives[target];
          const waiting=aim.target==="hive"&&h.tipping;
          if(waiting){aim.plan=null;aim.planned=-Infinity;}
          else if(this.tick-aim.planned>=12){
            const kind=this.balls[r.inventory[0]].kind,geometry=aim.target+this.hives.map(hive=>hive.angle).join(":")+(aim.target==="flower"?this.flowers.map(f=>f.balls.join(",")).join(":"):""),cached=this.shotPlans.get(r.id);
            // Reuse recent blocked-shot searches while the pose and hive geometry are unchanged.
            if(cached&&this.tick-cached.tick<12&&cached.kind===kind&&cached.geometry===geometry&&distance(cached,r)<0.03)aim.plan=cached.plan;
            else {aim.plan=aim.target==="flower"?planFlowerShot(r,kind,this.hives,this.flowers,this.balls):planHiveShot(r,kind,this.hives,target);this.shotPlans.set(r.id,{tick:this.tick,x:r.x,y:r.y,kind,geometry,plan:aim.plan});}
            aim.planned=this.tick;
          }
          if(!waiting&&!aim.plan)this.cancelShot(r,"blocked");
          else {
            r.shotStatus="aiming";r.shotSpeed=aim.plan?.speed;
            if(r.setup.turret&&aim.target==="hive") {
              if(aim.plan)r.turretAngle=angle((r.turretAngle??0)+clamp(angle(aim.plan.heading-shooterHeading(r)),-ROBOT_LIMITS.turretSpeed*DT,ROBOT_LIMITS.turretSpeed*DT));
            }else input={...input,x:0,y:0,turn:aim.plan?clamp(angle(aim.plan.heading-sideAngle(aim.target==="flower"?r.setup.deposit:r.setup.shooter)-r.heading)*1.5,-0.8,0.8):0};
          }
        }
      }
      applied.set(r.id,input);
      if(r.setup.turret&&!(this.aimedShots.get(r.id)?.target==="hive"))r.turretAngle=angle((r.turretAngle??0)+(input.turretTurn??0)*ROBOT_LIMITS.turretSpeed*DT);
      const body=this.robotBodies.get(r.id)!;
      const v=body.getLinearVelocity(),scale=Math.max(1,Math.hypot(input.x,input.y));
      const driveSpeed=r.setup.driveSpeed??ROBOT_LIMITS.driveSpeed.default,turnSpeed=r.setup.turnSpeed??ROBOT_LIMITS.turnSpeed.default;
      const mass=body.getMass(),fx=clamp((input.x/scale*driveSpeed-v.x)*mass*10,-mass*5,mass*5)+4*v.x*mass,fy=clamp((input.y/scale*driveSpeed-v.y)*mass*10,-mass*5,mass*5)+4*v.y*mass;
      body.applyForceToCenter(Vec2(fx,fy),true);
      body.applyTorque(clamp((input.turn*turnSpeed-body.getAngularVelocity())*body.getInertia()*12,-15,15)+6*body.getAngularVelocity()*body.getInertia(),true);
      if(!active){body.setLinearVelocity(Vec2());body.setAngularVelocity(0);}
      if(input.release)this.release(r.alliance);
    }
    this.world.step(DT,8,3);
    for(const r of this.robots){const b=this.robotBodies.get(r.id)!,p=b.getPosition();r.x=p.x;r.y=p.y;r.heading=angle(b.getAngle());}
    for(const b of this.balls) {
      if(b.location==="floor") {const body=this.ballBodies.get(b.id)!,p=body.getPosition(),v=body.getLinearVelocity();b.x=p.x;b.y=p.y;b.vx=v.x;b.vy=v.y;}
      else if(b.location==="air") this.fly(b);
      else if(b.location==="out"&&this.tick>=b.returnAt&&this.phase!=="settling") {
        if(b.kind==="pollen") {
          const p={x:clamp(b.x,-HALF+0.1,HALF-0.1),y:clamp(b.y,-HALF+0.1,HALF-0.1)};
          if(!this.robots.some(r=>distance(r,p)<0.4)){b.vx=0;b.vy=0;this.floor(b,p.x,p.y);}
        } else {b.location="reserve";b.container=-1;}
      }
    }
    for(const r of this.robots) {
      const input=applied.get(r.id)!;
      if(active&&input.intake&&r.inventory.length<4&&this.tick>=(this.nextIntake.get(r.id)??0))this.collect(r);
      const aim=this.aimedShots.get(r.id),body=this.robotBodies.get(r.id)!;
      const side=aim?.target==="flower"?r.setup.deposit:r.setup.shooter,heading=aim?.target==="flower"?r.heading+sideAngle(side):shooterHeading(r);
      if(active&&aim?.plan&&r.inventory.length&&this.tick>=(this.nextShot.get(r.id)??0)
        &&Math.abs(angle(aim.plan.heading-heading))<0.01&&body.getLinearVelocity().length()<0.025
        &&("flower" in aim.plan?clearFlowerShot(r,this.balls[r.inventory[0]].kind,{...aim.plan,heading},this.hives,this.flowers[aim.plan.flower],body.getLinearVelocity()):clearHiveShot(r,this.balls[r.inventory[0]].kind,{...aim.plan,heading},this.hives,r.alliance==="red"?0:1,body.getLinearVelocity()))){
        r.shotStatus="ready";
        aim.readyAt=this.tick;
        if(aim.autoFire||aim.fireUntil>=this.tick){
          this.shoot(r,aim.plan.speed,aim.plan.elevation,side,aim.target!=="flower");
          if(aim.autoFire||!r.inventory.length)this.cancelShot(r);
          else {aim.plan=null;aim.planned=-Infinity;aim.fireUntil=-Infinity;r.shotStatus="aiming";}
        }
      } else if(active&&!aim&&(!input.aimHive||input.aim!==undefined)&&input.shoot&&shotEdges.has(r.id)&&r.inventory.length&&this.tick>=(this.nextShot.get(r.id)??0))this.shoot(r,input.speed);
    }
    for(let i=0;i<2;i++)this.updateHive(i);
    // A simulated drive-team member retries blocked releases and introduces the
    // remaining reserve in the final minute. Practice only auto-releases credits.
    if(this.tick%15===0)for(const alliance of ["red","blue"] as const)
      if(this.credits[alliance]>0||(this.config.timed&&this.tick>=98*60))this.release(alliance);
    if(active)this.contactRules(applied);
    this.tick++;
    if(this.config.timed)this.advanceClock();
  }
  private collect(r:Robot) {
    const sides:MechanismSide[]=r.setup.intake==="both"?["front","back"]:[r.setup.intake];
    let ball:Ball|undefined;
    for(const side of sides){
      const a=r.heading+sideAngle(side),mouth={x:r.x+Math.cos(a)*0.27,y:r.y+Math.sin(a)*0.27};
      for(const f of this.flowers)if(distance(mouth,f)<0.16&&f.balls.length&&this.balls[f.balls[0]].kind==="pollen"){ball=this.balls[f.balls[0]];break;}
      ball??=this.balls.find(b=>b.location==="floor"&&distance(b,mouth)<0.14&&(b.kind==="pollen"||b.kind===r.alliance));
      if(ball)break;
    }
    if(ball){this.store(ball,"robot",r.id);this.nextIntake.set(r.id,this.tick+11);this.event("intake","Robot "+(r.id+1)+" collected "+ball.kind+".");}
  }
  private shoot(r:Robot,speed:number,elevation:number=SHOOTER.elevation,side:MechanismSide=r.setup.shooter,turret=true) {
    const b=this.balls[r.inventory[0]],a=turret?shooterHeading(r):r.heading+sideAngle(side),v=this.robotBodies.get(r.id)!.getLinearVelocity();
    this.airborne(b,r.x+Math.cos(a)*SHOOTER.offset,r.y+Math.sin(a)*SHOOTER.offset,SHOOTER.height,
      Math.cos(a)*speed*Math.cos(elevation)+v.x,Math.sin(a)*speed*Math.cos(elevation)+v.y,speed*Math.sin(elevation));
    this.nextShot.set(r.id,this.tick+20);this.event("shot","Robot "+(r.id+1)+" launched "+b.kind+".");
  }
  private fly(b:Ball) {
    const old={x:b.x,y:b.y,z:b.z},radius=BALL[b.kind].diameter/2;
    b.x+=b.vx*DT;b.y+=b.vy*DT;b.z+=b.vz*DT-4.905*DT*DT;b.vz-=9.81*DT;
    let hit:ReturnType<typeof hitHive>=null,index=-1;
    for(let i=0;i<this.hives.length;i++){
      const candidate=hitHive(this.hives[i],old,b,radius);
      if(candidate&&(!hit||candidate.time<hit.time)){hit=candidate;index=i;}
    }
    if(hit) {
      const h=this.hives[index];
      if(hit.capture){
        this.store(b,"hive",index*2+hit.cell);
        this.event("shot",b.kind+" entered "+h.alliance+" hive cell "+(hit.cell+1)+".");return;
      }
      const n=hit.normal,vn=b.vx*n.x+b.vy*n.y+b.vz*n.z;
      b.x=old.x+(b.x-old.x)*hit.time+n.x*0.0001;
      b.y=old.y+(b.y-old.y)*hit.time+n.y*0.0001;
      b.z=old.z+(b.z-old.z)*hit.time+n.z*0.0001;
      if(vn<0){b.vx-=(1+HIVE.restitution)*vn*n.x;b.vy-=(1+HIVE.restitution)*vn*n.y;b.vz-=(1+HIVE.restitution)*vn*n.z;}
      return;
    }
    const crossing=(height:number)=>old.z>=height&&b.z<=height&&old.z>b.z;
    const at=(height:number)=>{const t=(old.z-height)/(old.z-b.z);return{x:old.x+(b.x-old.x)*t,y:old.y+(b.y-old.y)*t};};
    if(crossing(FLOWER_TOP+radius)) {
      const p=at(FLOWER_TOP+radius);
      for(let i=0;i<4;i++) {
        const f=this.flowers[i],stack=flowerStack(this.balls,f.balls),top=stack.at(-1)?.top??FLOWER_BASE;
        if(distance(p,f)<=0.0508-radius&&top<FLOWER_TOP) {
          this.store(b,"flower",i);
          if(b.kind!=="pollen"&&this.config.timed&&this.tick<(30+8+60)*60){
            this.tally[b.kind].majorFouls++;this.event("foul","G410: early "+b.kind+" flower nectar; 20 points to opponent.");
          }
          return;
        }
        if(distance(p,f)<0.075+radius){b.vz=Math.abs(b.vz)*0.25;b.vx=-b.vx*0.4;b.vy=-b.vy*0.4;return;}
      }
    }
    if(Math.abs(b.x)>HALF-radius||Math.abs(b.y)>HALF-radius) {
      if(b.z-radius>0.3048){b.location="out";b.returnAt=this.tick+120;return;}
      if(Math.abs(b.x)>HALF-radius){b.x=clamp(b.x,-HALF+radius,HALF-radius);b.vx*=-0.4;}
      if(Math.abs(b.y)>HALF-radius){b.y=clamp(b.y,-HALF+radius,HALF-radius);b.vy*=-0.4;}
    }
    if(b.z<=0.45+radius&&old.z>0.45+radius) {
      const hit=this.robots.find(r=>Math.abs(b.x-r.x)<hull(r)+radius&&Math.abs(b.y-r.y)<hull(r)+radius);
      if(hit){b.z=0.45+radius;b.vz=Math.abs(b.vz)*0.3;b.vx+=Math.sign(b.x-hit.x)*0.5;b.vy+=Math.sign(b.y-hit.y)*0.5;}
    }
    if(b.z<=radius){b.z=radius;if(Math.abs(b.vz)>0.8){b.vz=Math.abs(b.vz)*0.35;b.vx*=0.8;b.vy*=0.8;}else this.floor(b,b.x,b.y);}
  }
  private updateHive(index:number) {
    const h=this.hives[index];
    if(!h.tipping){
      if(!tipLoad(h.cells[h.upward].map(id=>this.balls[id].kind)))return;
      h.tipping=true;h.progress=0;h.dumped=false;
    }
    h.progress=Math.min(1,h.progress+DT/0.9);
    const start=h.upward===0?-Math.PI/6:Math.PI/6,t=h.progress;
    h.angle=start*(1-2*t*t*(3-2*t));
    if(t>=0.5&&!h.dumped){
      h.dumped=true;const ids=[...h.cells[h.upward]],sign=h.upward===0?-1:1;
      ids.forEach((id,j)=>this.airborne(this.balls[id],h.x+sign*0.48,h.y+(j%4-1.5)*0.1,0.9+Math.floor(j/4)*0.06,sign*(0.7+j%3*0.15),(j%4-1.5)*0.15,-0.3));
    }
    if(t>=1){
      h.upward=1-h.upward;h.tipping=false;h.tips++;this.credits[h.alliance]++;
      this.tally[h.alliance][this.config.timed&&this.tick<38*60?"autoTips":"teleopTips"]++;
      this.event("tip",h.alliance+" hive tipped; opposite cell is open.");
      this.release(h.alliance);
    }
  }
  private contactRules(inputs:Map<number,Input>) {
    const touching=new Set<string>(),pinning=new Set<number>();
    for(let contact=this.world.getContactList();contact;contact=contact.getNext()) {
      const a=contact.getFixtureA().getBody().getUserData(),b=contact.getFixtureB().getBody().getUserData();
      if(contact.isTouching()&&typeof a==="number"&&typeof b==="number"){touching.add(a+":"+b);touching.add(b+":"+a);}
    }
    const candidates=new Set<string>();
    for(const r of this.robots)for(const other of this.robots) {
      if(r.alliance===other.alliance)continue;
      const input=inputs.get(r.id)!;
      if(touching.has(r.id+":"+other.id)&&input.x*(other.x-r.x)+input.y*(other.y-r.y)>0.12
        &&this.robotBodies.get(other.id)!.getLinearVelocity().length()<0.08){candidates.add(r.id+":"+other.id);pinning.add(other.id);}
    }
    for(const r of this.robots)for(const other of this.robots) {
      if(r.id===other.id||r.alliance===other.alliance)continue;
      const d=distance(r,other),key=r.id+":"+other.id,contact=touching.has(key);
      if(this.phase==="auto"&&contact&&(r.alliance==="red"?r.y<0:r.y>0)&&!this.interfered.has(r.id)){
        this.interfered.add(r.id);this.tally[r.alliance].majorFouls++;this.event("foul","G402: opponent-side AUTO contact by robot "+(r.id+1)+".");
      }
      // G421.C ends the count when the pinning robot itself becomes pinned.
      if(pinning.has(r.id)){this.pins.delete(key);continue;}
      let pin=this.pins.get(key);
      if(!pin&&candidates.has(key)){pin={ticks:0,clear:0,start:{x:r.x,y:r.y},otherStart:{x:other.x,y:other.y}};this.pins.set(key,pin);}
      if(!pin)continue;
      const releasing=d-hull(r)-hull(other)>=0.6096||distance(other,pin.otherStart)>=0.6096||distance(r,pin.start)>=0.6096;
      if(releasing){pin.clear++;if(pin.clear>180)this.pins.delete(key);continue;}
      pin.clear=0;
      if(candidates.has(key)){pin.ticks++;if(pin.ticks>180&&(pin.ticks-1)%180===0){this.tally[r.alliance].majorFouls++;this.event("foul","G421: pin exceeding three seconds by robot "+(r.id+1)+".");}}
    }
  }
  private advanceClock() {
    if(this.tick===30*60) {
      for(const r of this.robots){if(Math.abs(r.x)+hull(r)<HALF-0.025&&Math.abs(r.y)+hull(r)<HALF-0.025)this.tally[r.alliance].leave++;if(parked(r))this.tally[r.alliance].autoPark++;}
      this.phase="transition";this.commands.clear();this.previousShot.clear();this.event("phase","AUTO ended. Controls disabled for transition.");
      for(const r of this.robots)this.cancelShot(r);
    }
    if(this.tick===38*60){this.phase="teleop";this.event("phase","TELEOP started.");}
    if(this.tick===158*60){
      for(const r of this.robots)if(parked(r))this.tally[r.alliance].teleopPark++;
      this.phase="settling";this.event("phase","Time expired. Waiting for scoring elements to settle.");
      for(const r of this.robots)this.cancelShot(r);
    }
    if(this.phase==="settling"){
      const moving=this.balls.some(b=>b.location==="air"||(b.location==="floor"&&Math.hypot(b.vx,b.vy)>0.025))||this.hives.some(h=>h.tipping);
      this.settledTicks=moving?0:this.settledTicks+1;
      if(this.settledTicks>=30){this.phase="finished";this.event("phase","Final score.");}
      else if(this.tick>=168*60){this.interrupt();this.event("warning","Scoring elements did not settle; match result is incomplete.");}
    }
  }
  snapshot():Snapshot {
    const balls=this.balls.map(b=>({...b}));
    for(const r of this.robots)for(const id of r.inventory)Object.assign(balls[id],{x:r.x,y:r.y,z:0.2});
    for(const f of this.flowers)for(const s of flowerStack(this.balls,f.balls))Object.assign(balls[s.id],{x:f.x,y:f.y,z:(s.top+s.bottom)/2});
    for(const h of this.hives)for(let c=0;c<2;c++)for(const id of h.cells[c])Object.assign(balls[id],hivePoint(h,c,{x:HIVE.front-HIVE.depth/2,y:0,z:HIVE.bottom+BALL[balls[id].kind].diameter/2}));
    const tally=structuredClone(this.tally);
    for(const alliance of ["red","blue"] as const){
      const h=this.hives.find(h=>h.alliance===alliance)!;tally[alliance].cell=h.cells[h.upward].length;
      tally[alliance].garden=balls.filter(b=>b.location==="floor"&&inZone(b,ZONES[alliance].garden,BALL[b.kind].diameter/2)).length;
    }
    tally.flowers=this.flowers.map(f=>flowerStack(this.balls,f.balls).filter(s=>s.scoring).map(s=>this.balls[s.id].kind));
    const end=this.phase==="auto"?30:this.phase==="transition"?38:this.phase==="teleop"?158:this.tick*DT;
    return {version:1,tick:this.tick,phase:this.phase,remaining:Math.max(0,end-this.tick*DT),robots:structuredClone(this.robots),balls,flowers:structuredClone(this.flowers),hives:structuredClone(this.hives),tally,score:scoreMatch(tally),events:[...this.events],credits:{...this.credits}};
  }
}
