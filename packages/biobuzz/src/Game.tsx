import { useEffect, useRef, useState } from "react";
import Field from "./Field";
import MatchClock from "./MatchClock";
import AutoEditor, { defaultAuto } from "./AutoEditor";
import RobotSetupFields from "./RobotSetupFields";
import { DEFAULT_ROBOT,validateRobotSetup,ROBOT_LIMITS } from "./core/robot";
import { validateAuto } from "./core/auto";
import { NEUTRAL, type Alliance, type AutoProgram, type Config, type Input, type SeatKind, type Snapshot } from "./core/types";
import { driverInput } from "./core/view";
import type { ClientMessage, Lobby, OnlineClient, ServerMessage, Session } from "./core/protocol";
import "./biobuzz.css";

const initial:Config={timed:false,seats:["human","empty","empty","empty"]};
function localConfig():Config {
  try{const setups=JSON.parse(localStorage.getItem("ares-biobuzz-robot-v1")??"null");if(Array.isArray(setups)&&setups.length===4)return {...initial,robotSetups:setups.map(validateRobotSetup)};}catch{/* Use the reference robot when saved settings are unavailable. */}
  return initial;
}
export default function Game({online}:{online?:OnlineClient}) {
  const [config,setConfig]=useState<Config>(localConfig),[state,setState]=useState<Snapshot|null>(null),[error,setError]=useState("");
  const [program,setProgram]=useState<AutoProgram>(defaultAuto),[editing,setEditing]=useState(false),[paused,setPaused]=useState(false);
  const [seat,setSeat]=useState(0),[speed,setSpeed]=useState(5.8),[intake,setIntake]=useState(false),[code,setCode]=useState("");
  const [aimHive,setAimHive]=useState(true),padIntake=useRef(false);
  const [driverView,setDriverView]=useState<Alliance>("red");
  const [configuring,setConfiguring]=useState(false),[robotDraft,setRobotDraft]=useState({...DEFAULT_ROBOT});
  const [gamepadName,setGamepadName]=useState(""),padView=useRef(false),wasGamepad=useRef(false);
  const shotClicks=useRef(0),previousTrigger=useRef(false);
  const depositClicks=useRef(0),previousDeposit=useRef(false);
  const aimClicks=useRef(0),previousAim=useRef(false);
  const [lobby,setLobby]=useState<Lobby|null>(null),[busy,setBusy]=useState(false),[connected,setConnected]=useState(false);
  const terminal=useRef(false);
  const worker=useRef<Worker|null>(null),socket=useRef<WebSocket|null>(null),session=useRef<Session|null>(null),keys=useRef(new Set<string>());
  const pressTimes=useRef(new Map<string,number>()),keyTimers=useRef(new Map<string,ReturnType<typeof setTimeout>>());
  const control=useRef({seat,speed,intake,paused,aimHive,driverView,configuring}),retry=useRef<ReturnType<typeof setTimeout>|null>(null),sequence=useRef(0),closed=useRef(false);
  useEffect(()=>{control.current={seat,speed,intake,paused,aimHive,driverView,configuring};},[seat,speed,intake,paused,aimHive,driverView,configuring]);
  const send=(message:ClientMessage)=>{if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify(message));};
  function leaveOnline(){
    send({type:"leave"});
    session.current=null;if(retry.current)clearTimeout(retry.current);socket.current?.close();socket.current=null;
    setLobby(null);setConnected(false);worker.current?.postMessage({type:"pause",paused:false});
  }
  function connect(s:Session,until?:number){
    if(closed.current)return;
    terminal.current=false;session.current=s;worker.current?.postMessage({type:"pause",paused:true});
    const ws=new WebSocket(s.socketUrl);socket.current=ws;
    ws.onopen=()=>{sequence.current=0;ws.send(JSON.stringify({type:"hello",version:1,roomId:s.roomId,token:s.token}));};
    ws.onmessage=event=>{
      try{
        const m=JSON.parse(event.data) as ServerMessage;
        if(m.type==="snapshot"){setState(m.state);if(["finished","interrupted"].includes(m.state.phase))terminal.current=true;}
        if(m.type==="lobby"){setLobby(m.lobby);if(m.lobby.status!=="waiting"||m.lobby.ready[control.current.seat])setConfiguring(false);if(["finished","interrupted","local-offer"].includes(m.lobby.status))terminal.current=true;}
        if(m.type==="joined"){setSeat(m.seat);setDriverView(m.seat<2?"red":"blue");setPaused(false);setConnected(true);setError("");}
        if(m.type==="error")setError(m.message);
      }catch{setError("Invalid simulator response.");ws.close();}
    };
    ws.onclose=()=>{
      setConnected(false);
      if(closed.current||session.current!==s||terminal.current)return;
      const deadline=until??Date.now()+30000;
      if(Date.now()<deadline){setError("Connection lost. Reconnecting…");retry.current=setTimeout(()=>connect(s,deadline),1000);}
      else {setError("The online match was interrupted. Start a new room or return to local practice.");setLobby(old=>old?{...old,status:"interrupted"}:null);}
    };
  }
  async function admit(action:"create"|"join"|"queue"){
    if(!online)return;
    setBusy(true);setError("");
    try{leaveOnline();const result=await online.admit(action,action==="join"?{code:code.trim().toUpperCase()}:undefined);connect(result);}
    catch(e){setError(e instanceof Error?e.message:"Online play is unavailable.");}
    finally{setBusy(false);}
  }
  useEffect(()=>{
    closed.current=false;
    const timeouts=keyTimers.current;
    const w=new Worker(new URL("./worker.ts",import.meta.url),{type:"module"});worker.current=w;
    w.onmessage=event=>{if(session.current)return;if(event.data.type==="snapshot")setState(event.data.state);else setError(event.data.message);};
    const clear=()=>{keys.current.clear();shotClicks.current=0;depositClicks.current=0;aimClicks.current=0;};
    const down=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest("input,select,textarea"))return;
      if(e.code==="KeyJ"){if(!e.repeat)setIntake(on=>!on);e.preventDefault();return;}
      if(["KeyW","KeyA","KeyS","KeyD","KeyQ","KeyE","KeyJ","KeyF","KeyG","KeyH","KeyR","BracketLeft","BracketRight"].includes(e.code)){keys.current.add(e.code);e.preventDefault();}
    };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code);
    const visibility=()=>{clear();w.postMessage({type:"pause",paused:document.hidden||control.current.paused||!!session.current});};
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",clear);document.addEventListener("visibilitychange",visibility);
    const timer=setInterval(()=>{
      const c=control.current,k=keys.current,pads=navigator.getGamepads?.()??[],pad=pads.find(p=>p?.connected&&p.mapping==="standard");
      setGamepadName(pad?.id??(pads.some(p=>p?.connected)?"Unsupported controller mapping":""));
      const disconnected=wasGamepad.current&&!pad;
      if(disconnected){setIntake(false);shotClicks.current=0;depositClicks.current=0;aimClicks.current=0;}
      wasGamepad.current=!!pad;
      const disabled=c.paused||c.configuring||document.hidden||disconnected;
      if(disabled){shotClicks.current=0;depositClicks.current=0;aimClicks.current=0;}
      const click=shotClicks.current>0&&!previousTrigger.current;
      if(click)shotClicks.current--;
      const trigger=click||k.has("KeyF")||!!pad?.buttons[7]?.pressed;
      previousTrigger.current=trigger;
      const depositClick=depositClicks.current>0&&!previousDeposit.current;
      if(depositClick)depositClicks.current--;
      const deposit=depositClick||k.has("KeyG")||!!pad?.buttons[2]?.pressed;
      previousDeposit.current=deposit;
      const aimClick=aimClicks.current>0&&!previousAim.current;
      if(aimClick)aimClicks.current--;
      const aim=aimClick||k.has("KeyH")||!!pad?.buttons[6]?.pressed;
      if(aim&&!previousAim.current&&!disabled)setAimHive(true);
      previousAim.current=aim;
      const pressed=!!pad?.buttons[0]?.pressed;
      if(pressed&&!padIntake.current&&!disabled)setIntake(on=>!on);
      padIntake.current=pressed;
      const viewPressed=!!pad?.buttons[8]?.pressed;
      if(viewPressed&&!padView.current&&!disabled)setDriverView(view=>view==="red"?"blue":"red");
      padView.current=viewPressed;
      const dead=(v:number)=>Math.abs(v)<0.12?0:v;
      const drive=driverInput(
        (k.has("KeyW")?1:0)-(k.has("KeyS")?1:0)-(pad?dead(pad.axes[1]??0):0),
        (k.has("KeyA")?1:0)-(k.has("KeyD")?1:0)-(pad?dead(pad.axes[0]??0):0),c.driverView);
      const input:Input=disabled?{...NEUTRAL}:{
        ...drive,
        turn:(k.has("KeyQ")?1:0)-(k.has("KeyE")?1:0)-(pad?dead(pad.axes[2]??0):0),
        intake:c.intake,shoot:trigger,aimHive:c.aimHive||aim,aim,deposit,aimFlower:true,
        turretTurn:(k.has("BracketLeft")||pad?.buttons[4]?.pressed?1:0)-(k.has("BracketRight")||pad?.buttons[5]?.pressed?1:0),
        speed:c.speed,release:k.has("KeyR")||!!pad?.buttons[3]?.pressed};
      if(session.current){if(socket.current?.readyState===WebSocket.OPEN)socket.current.send(JSON.stringify({type:"input",sequence:sequence.current++,input}));}
      else w.postMessage({type:"input",id:c.seat,input});
    },1000/30);
    return()=>{closed.current=true;for(const timeout of timeouts.values())clearTimeout(timeout);clearInterval(timer);w.terminate();worker.current=null;if(retry.current)clearTimeout(retry.current);socket.current?.close();window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",clear);document.removeEventListener("visibilitychange",visibility);};
  },[]);
  useEffect(()=>{if(!session.current)worker.current?.postMessage({type:"start",config});},[config]);
  useEffect(()=>{if(!session.current)worker.current?.postMessage({type:"pause",paused});},[paused]);
  const waiting=lobby?.status==="waiting"||lobby?.status==="local-offer";
  const interrupted=lobby?.status==="interrupted";
  const unavailable=waiting||interrupted;
  const selected=unavailable?undefined:state?.robots.find(r=>r.id===seat);
  const robotSetup=selected?.setup??lobby?.robotSetups?.[seat]??config.robotSetups?.[seat]??DEFAULT_ROBOT;
  const aimingAtHive=selected?.shotTarget==="hive"&&selected.shotStatus!==undefined;
  let robotDraftError="";try{validateRobotSetup(robotDraft);}catch(e){robotDraftError=(e as Error).message;}
  const reset=(next:Config,controlled?:number)=>{leaveOnline();keys.current.clear();shotClicks.current=0;depositClicks.current=0;aimClicks.current=0;previousAim.current=false;previousTrigger.current=false;previousDeposit.current=false;setIntake(false);setAimHive(true);setPaused(false);setError("");setConfiguring(false);const id=controlled??Math.max(0,next.seats.findIndex(s=>s==="human"));setSeat(id);setDriverView(id<2?"red":"blue");setConfig({...next,robotSetups:next.robotSetups??config.robotSetups});};
  const hold=(key:string)=>({
    onPointerDown:(e:React.PointerEvent<HTMLButtonElement>)=>{e.currentTarget.setPointerCapture(e.pointerId);clearTimeout(keyTimers.current.get(key));pressTimes.current.set(key,performance.now());keys.current.add(key);},
    onPointerUp:()=>{const remaining=Math.max(0,250-(performance.now()-(pressTimes.current.get(key)??0)));keyTimers.current.set(key,setTimeout(()=>keys.current.delete(key),remaining));},
    onPointerCancel:()=>keys.current.delete(key),
    onClick:(e:React.MouseEvent<HTMLButtonElement>)=>{if(e.detail===0){keys.current.add(key);keyTimers.current.set(key,setTimeout(()=>keys.current.delete(key),250));}},
  });
  const seatOptions=(["human","easy","standard","empty"] as SeatKind[]).map(kind=><option key={kind} value={kind}>{kind==="empty"?"Empty":kind==="human"?"Human":kind==="easy"?"Easy bot":"Standard bot"}</option>);
  return <section className="bio-page" aria-label="BIOBUZZ simulator">
    <header><p>ARES Arcade · BIOBUZZ</p><h1>Drive. Collect. Tip the hive.</h1><p>Practice on your own, build an auto, or play a 2v2 match.</p></header>
    {error&&<p role="alert" className="bio-error">{error}</p>}
    <div className="bio-grid"><div>
      <div className="bio-card"><div className="bio-score"><span className="red" data-testid="red-score">Red {unavailable?0:state?.score.red.total??0}</span><span className="blue" data-testid="blue-score">Blue {unavailable?0:state?.score.blue.total??0}</span></div>
      <MatchClock phase={interrupted?"interrupted":waiting?"waiting":state?.phase??"loading"} tick={unavailable?0:state?.tick} remaining={unavailable?0:state?.remaining} paused={paused}/>
      {!lobby&&<div className="bio-row"><button onClick={()=>reset({...config,timed:true})}>{config.timed?"Restart timed match":"Start timed match"}</button>{config.timed&&<button onClick={()=>reset({...config,timed:false})}>Return to untimed practice</button>}</div>}
      <div className="bio-row" role="group" aria-label="Driver station view">{(["red","blue"] as const).map(alliance=><button key={alliance} aria-pressed={driverView===alliance} onClick={()=>setDriverView(alliance)}>{alliance==="red"?"Red":"Blue"} driver view</button>)}</div>
      <p className="bio-help">{driverView==="red"?"Red":"Blue"} station at the bottom. Forward drives up the field from this view, regardless of robot heading.</p>
      <Field view={driverView} state={unavailable?null:state} program={editing?program:undefined} onWaypoint={editing&&!session.current&&program.steps.length<128?p=>setProgram({...program,steps:[...program.steps,{kind:"drive",target:p,preset:"safe"}]}):undefined}/>
      <div className="bio-row"><button disabled={!!session.current} onClick={()=>setPaused(!paused)}>{paused?"Resume":"Pause"}</button><button onClick={()=>reset(config)}>Reset local field</button><button disabled={!!session.current} onClick={()=>{if(!editing&&!program.steps.length)setProgram({...program,robotSetup:validateRobotSetup(robotSetup)});setEditing(!editing);}}>{editing?"Close auto editor":"Build an auto"}</button></div>
      <p className="bio-help">WASD drive · Q/E turn · J toggle intake · H aim/cancel aim · F shoot · G place in flower/cancel · R release nectar · [ / ] turn turret.</p>
      <p role="status" data-testid="gamepad-status">{gamepadName?gamepadName==="Unsupported controller mapping"?"This controller has no standard browser mapping. Keyboard and touch controls remain available.":"Gamepad connected: "+gamepadName:"Gamepad: connect a controller and press a button to activate it."}</p>
      <p className="bio-help">Standard gamepad: left stick drive · right stick turn · A / Cross toggle intake · left trigger aim/cancel aim · right trigger shoot · bumpers turn turret · X / Square place in flower · Y / Triangle release nectar · View / Share switch driver view. Disconnecting stops gamepad inputs and switches intake off.</p>
      <div className="bio-row bio-touch" aria-label="Driving controls"><button {...hold("KeyW")} aria-label="Drive forward">↑</button><button {...hold("KeyS")} aria-label="Drive backward">↓</button><button {...hold("KeyA")} aria-label="Drive left">←</button><button {...hold("KeyD")} aria-label="Drive right">→</button><button {...hold("KeyQ")}>Turn left</button><button {...hold("KeyE")}>Turn right</button><button aria-pressed={intake} onClick={()=>setIntake(on=>!on)}>{intake?"Intake on":"Intake off"}</button><button aria-pressed={!!aimingAtHive} onClick={()=>{setAimHive(true);aimClicks.current=Math.min(2,aimClicks.current+1);}}>{aimingAtHive?"Cancel aim":"Aim"}</button><button onClick={()=>{shotClicks.current=Math.min(2,shotClicks.current+1);}}>Shoot</button><button onClick={()=>{depositClicks.current=Math.min(2,depositClicks.current+1);}}>{selected?.shotStatus==="aiming"&&selected.shotTarget==="flower"?"Cancel placement":"Place in flower"}</button><button {...hold("KeyR")}>Release nectar</button>{robotSetup.turret&&<><button {...hold("BracketLeft")}>Turret left</button><button {...hold("BracketRight")}>Turret right</button></>}</div>
      </div>
      {editing&&<AutoEditor program={program} onChange={setProgram} onPreview={()=>{const id=program.alliance==="red"?0:2;setSeat(id);const seats:SeatKind[]=["empty","empty","empty","empty"];seats[id]="human";const autos:(AutoProgram|null)[]=[null,null,null,null];autos[id]=validateAuto(program);reset({timed:true,seats,autos});}}/>}
    </div><aside>
      <section className="bio-card"><h2>Your robot</h2>
        <label>Controlled robot<select value={seat} disabled={!!session.current} onChange={e=>{const id=Number(e.target.value);setSeat(id);setDriverView(id<2?"red":"blue");}}>{state?.robots.map(r=><option key={r.id} value={r.id}>{r.alliance} {r.id%2+1}</option>)}</select></label>
        <p className="bio-stat" data-testid="robot-position">{selected?"X "+selected.x.toFixed(2)+" m · Y "+selected.y.toFixed(2)+" m · "+selected.heading.toFixed(2)+" rad":waiting?"Your robot appears when the match starts.":"No robot in this seat."}</p>
        <p data-testid="inventory">Inventory {selected?.inventory.length??0}/4: {selected?.inventory.map(id=>state!.balls[id].kind==="pollen"?"Pollen":state!.balls[id].kind+" nectar").join(", ")||"empty"}</p>
        <p data-testid="robot-setup">Shooter: {robotSetup.shooter} · Flower placement: {robotSetup.deposit} · Intake: {robotSetup.intake}</p>
        <p data-testid="robot-motion">Turret: {robotSetup.turret?"on":"off"} · Chassis {(robotSetup.driveSpeed??ROBOT_LIMITS.driveSpeed.default).toFixed(2)} m/s · Turn {((robotSetup.turnSpeed??ROBOT_LIMITS.turnSpeed.default)*180/Math.PI).toFixed(0)}°/s</p>
        {robotSetup.turret&&<p data-testid="turret-angle">Turret angle: {((selected?.turretAngle??0)*180/Math.PI).toFixed(1)}° from shooter home</p>}
        {robotSetup.turret&&<p className="bio-help">The turret automatically locks onto your hive and tracks as you drive. Shoot fires separately when Ready. H / left trigger toggles the lock; brackets / bumpers temporarily override it. Flower placement takes priority, then tracking resumes.</p>}
        <button disabled={!!session.current&&(!waiting||lobby?.ready[seat])} onClick={()=>{setRobotDraft(validateRobotSetup(robotSetup));setConfiguring(!configuring);}}>Configure robot</button>
        {configuring&&<section aria-label="Robot configuration"><RobotSetupFields value={robotDraft} onChange={setRobotDraft}/>{robotDraftError&&<p role="alert">{robotDraftError}</p>}<p className="bio-help">The arrow marks the robot's front. S = shooter, F = flower placement, I = intake. Local changes reset the field. Online configuration locks when you ready.</p><div className="bio-row"><button disabled={!!robotDraftError} onClick={()=>{
          if(session.current){send({type:"robot",setup:robotDraft});setConfiguring(false);}
          else {const robotSetups=[0,1,2,3].map(i=>i===seat?robotDraft:validateRobotSetup(config.robotSetups?.[i])),autos=config.autos?.map((auto,i)=>auto&&i===seat?{...auto,robotSetup:robotDraft}:auto);reset({...config,robotSetups,autos},seat);try{localStorage.setItem("ares-biobuzz-robot-v1",JSON.stringify(robotSetups));}catch{setError("Robot configured, but this browser could not save its settings.");}}
        }}>{session.current?"Apply robot configuration":"Apply configuration and reset"}</button><button onClick={()=>setConfiguring(false)}>Cancel configuration</button></div></section>}
        <label><input type="checkbox" checked={intake} onChange={e=>setIntake(e.target.checked)}/> Run intake</label>
        <p className="bio-help">Intake stays on until toggled off, collecting whenever there is space. Capacity: four balls.</p>
        <p role="status" data-testid="aim-status">{selected?.shotStatus==="ready"?"Ready to shoot. Press Shoot to release one ball.":selected?.shotStatus==="aiming"?selected.shotTarget==="flower"?"Lining up flower placement. Place again or drive to cancel.":robotSetup.turret?"Turret tracking the hive. Stop moving and wait for Ready, then press Shoot.":"Lining up the hive. Aim again or drive to cancel. Wait for Ready, then press Shoot.":selected?.shotStatus==="blocked"?selected.shotTarget==="flower"?"No clear flower placement. Move within 0.95 m of a flower with space and try again.":robotSetup.turret?"No clear hive shot. Move toward the outward-facing OPEN cell; the turret will retry automatically.":"No clear hive shot from here. Move toward the outward-facing OPEN cell and aim again.":"Aim lines up the hive without firing. Shoot releases one ball; without Aim, it uses manual power and the current shooter direction."}</p>
        {aimingAtHive&&selected?.shotSpeed!==undefined&&<p>Calculated launch speed: {selected.shotSpeed.toFixed(2)} m/s</p>}
        <p className="bio-help">Place in flower aims a short arc through the nearest flower's top using the configured placement side. Turn intake off to avoid retrieving pollen again. Early nectar placement still incurs the match penalty.</p>
        <label>Manual launch speed: {speed.toFixed(2)} m/s<input type="range" disabled={!!aimingAtHive} min={2} max={5.8} step={0.01} value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label>
        <div className="bio-row"><button onClick={()=>{setAimHive(false);setSpeed(3.08);}}>Flower power</button></div>
        <p className="bio-help">Shots can hit the rim, sides, or underside. Airborne balls have a white height ring.</p>
      </section>
      <section className="bio-card"><h2>{lobby?"Online room":"Local practice"}</h2>
        {!lobby?<><label><input type="checkbox" checked={config.timed} onChange={e=>reset({...config,timed:e.target.checked})}/> Match timer and AUTO</label>
          <div className="bio-row">{config.seats.map((kind,i)=><label key={i}>{i<2?"Red":"Blue"} {i%2+1}<select value={kind} onChange={e=>{const seats=[...config.seats];seats[i]=e.target.value as SeatKind;reset({...config,seats});}}>{seatOptions}</select></label>)}</div>
          <button onClick={()=>{setSeat(0);reset(initial);}}>Solo, no bots</button> <button onClick={()=>reset({timed:true,seats:["human","standard","standard","standard"]})}>Practice with bots</button>
        </>:<><p>Room <strong>{lobby.code}</strong> · {lobby.status==="finished"?"Match complete":interrupted?"Interrupted":connected?"Connected":"Reconnecting"}</p><p>{lobby.status==="waiting"?lobby.public?"Matchmaking · "+lobby.waitSeconds+"s":"Waiting for players":lobby.status}</p>
          <div className="bio-row">{lobby.seats.map((kind,i)=><label key={i}>{i<2?"Red":"Blue"} {i%2+1} {lobby.ready[i]?"✓":""}<select disabled={lobby.public||seat!==lobby.host||lobby.status!=="waiting"||lobby.occupied[i]} value={kind} onChange={e=>{const seats=[...lobby.seats];seats[i]=e.target.value as SeatKind;send({type:"configure",seats});}}>{seatOptions}</select></label>)}</div>
          {lobby.status==="waiting"&&<div className="bio-row"><button disabled={lobby.ready[seat]} onClick={()=>send({type:"ready",auto:null})}>Ready without auto</button><button disabled={lobby.ready[seat]} onClick={()=>{try{send({type:"ready",auto:validateAuto(program)});}catch(e){setError((e as Error).message);}}}>Ready with this auto</button>{!lobby.public&&seat===lobby.host&&<button onClick={()=>send({type:"start"})}>Start match</button>}</div>}
          {lobby.status==="local-offer"&&<p>No other humans are waiting. <button onClick={()=>{setSeat(0);reset({timed:true,seats:["human","standard","standard","standard"]});}}>Play locally with bots</button></p>}
          <button onClick={()=>reset(initial)}>Leave room</button>
        </>}
      </section>
      {!lobby&&<section className="bio-card"><h2>Play online</h2>{online?<><div className="bio-row"><button disabled={busy} onClick={()=>admit("queue")}>Find 2v2 match</button><button disabled={busy} onClick={()=>admit("create")}>Create private room</button></div><label>Room code<input maxLength={8} value={code} onChange={e=>setCode(e.target.value)}/></label><button disabled={busy||code.trim().length!==8} onClick={()=>admit("join")}>Join room</button></>:<p>Online hosting is not configured here. Solo practice, bots, and the auto editor are available.</p>}</section>}
      {!unavailable&&state&&<section className="bio-card"><h2>Field contents</h2>{state.flowers.map((f,i)=><details key={i}><summary>Flower {i+1}: {f.balls.filter(id=>state.balls[id].kind==="pollen").length} pollen / {f.balls.filter(id=>state.balls[id].kind!=="pollen").length} nectar</summary><p>Bottom → top: {f.balls.map(id=><span key={id} className="bio-chip">{state.balls[id].kind==="pollen"?"Pollen":state.balls[id].kind+" nectar"}</span>)}</p><p>Scoring elements: {state.tally.flowers[i].length}. Owner: {state.score.flowers[i].owner??"none"}.</p></details>)}
        {state.hives.map(h=><p key={h.alliance}>{h.alliance} hive: {h.tips} tips · cell {h.upward+1} open · {h.cells[h.upward].length} balls {h.tipping?"· tipping":""}</p>)}
        {(["red","blue"] as const).map(alliance=><p key={alliance} data-testid={`nectar-reserve-${alliance}`}>{alliance} nectar: {state.balls.filter(b=>b.kind===alliance&&b.location==="reserve").length} in reserve · {state.credits[alliance]} release credits</p>)}
        <details><summary>Score breakdown</summary>{(["red","blue"] as const).map(c=><p key={c}>{c}: AUTO {state.score[c].auto}, TELEOP {state.score[c].teleop}, penalties received {state.score[c].penalties}{state.phase==="finished"?", RP "+state.score[c].totalRP:""}</p>)}</details>
        <div className="bio-events" aria-label="Recent game events">{state.events.slice(-6).map((e,i)=><p key={e.tick+":"+i}>{(e.tick/60).toFixed(1)}s · {e.message}</p>)}</div>
      </section>}
      <details className="bio-card"><summary>Practice rules and physics</summary><p>Competition Manual V1. Dynamic 2D contacts with projectile height. Hive load uses the nominal 0.440 lb calibration. Referee judgments about intent, cards, and disqualification are outside automatic practice scoring.</p><p>Flowers unlock for nectar in TELEOP's final minute. Each completed hive tip automatically releases one reserve nectar into that alliance's loading zone, including in AUTO. A blocked zone queues the release until clear. During timed matches, remaining reserves release in the final minute. Release nectar also allows manual requests; untimed practice allows them at any time.</p></details>
    </aside></div>
  </section>;
}
