import { useEffect, useRef } from "react";
import type { Alliance, AutoProgram, Pose, Snapshot } from "./core/types";
import { BALL, SIZE } from "./core/types";
import { HIVE, hiveOutline, hivePoint } from "./core/hive";
import { fieldToView, viewToField, viewRotation } from "./core/view";
import { DEFAULT_ROBOT,sideAngle,shooterHeading } from "./core/robot";
import backgroundUrl from "../assets/field.png";
const colors={pollen:"#f4cf38",red:"#ef5350",blue:"#4285f4"};
function Contents({state,ids}:{state:Snapshot;ids:number[]}) {
  return <span className="bio-element-counts">{(["pollen","red","blue"] as const).map(kind=>{
    const count=ids.filter(id=>state.balls[id].kind===kind).length,label=kind==="pollen"?"pollen":kind+" nectar";
    return <span key={kind} role="img" aria-label={`${count} ${label}`}><span className={`bio-ball-symbol bio-ball-${kind}`} aria-hidden="true">{kind==="pollen"?"P":kind==="red"?"R":"B"}</span><span aria-hidden="true">{count}</span></span>;
  })}</span>;
}
function Total({count,name,position,view}:{count:number;name:string;position:{x:number;y:number};view:Alliance}) {
  const p=fieldToView(position,view);
  return <span className="bio-field-total" role="img" aria-label={`${name}: ${count} balls total`} style={{left:`clamp(12px, ${p.x*100}%, calc(100% - 12px))`,top:`clamp(12px, ${p.y*100}%, calc(100% - 12px))`}}>{count}</span>;
}
export default function Field({state,program,onWaypoint,view="red"}:{state:Snapshot|null;program?:AutoProgram;onWaypoint?:(pose:Pose)=>void;view?:Alliance}) {
  const canvas=useRef<HTMLCanvasElement>(null),frame=useRef({previous:state,current:state,at:performance.now()});
  useEffect(()=>{frame.current={previous:frame.current.current,current:state,at:performance.now()};},[state]);
  useEffect(()=>{
    const image=new Image();image.src=backgroundUrl;
    let id=0;
    function draw(now:number){
      const c=canvas.current,ctx=c?.getContext("2d");if(!ctx||!c)return;
      const {current:s,previous,at}=frame.current,scale=c.width/SIZE;
      const point=(x:number,y:number)=>{const p=fieldToView({x,y},view);return [p.x*c.width,p.y*c.height];};
      ctx.clearRect(0,0,c.width,c.height);
      if(image.complete&&image.naturalWidth){ctx.save();ctx.translate(c.width/2,c.height/2);ctx.rotate(viewRotation(view));ctx.drawImage(image,-c.width/2,-c.height/2,c.width,c.height);ctx.restore();}
      if(program){
        ctx.strokeStyle="#ffffff";ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.beginPath();
        const start=point(program.start.x,program.start.y);ctx.moveTo(start[0],start[1]);
        for(const step of program.steps)if(step.kind==="drive"){const p=point(step.target.x,step.target.y);ctx.lineTo(p[0],p[1]);}
        ctx.stroke();ctx.setLineDash([]);
      }
      if(s){
        const layers:{z:number;draw:()=>void}[]=[];
        for(const h of s.hives){
          const a=point(h.x-0.45,h.y),b=point(h.x+0.45,h.y);ctx.strokeStyle=colors[h.alliance];ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
          for(let cell=0;cell<2;cell++){
            const front=hiveOutline(h,cell),back=hiveOutline(h,cell,true);
            const faces=[back,...front.map((v,i)=>[v,front[(i+1)%5],back[(i+1)%5],back[i]])];
            for(const face of faces)layers.push({z:face.reduce((z,v)=>z+v.z,0)/face.length,draw:()=>{
              ctx.fillStyle=cell===h.upward?"#bdb9aaee":"#454545ee";ctx.strokeStyle=colors[h.alliance];ctx.lineWidth=2;
              ctx.beginPath();face.forEach((v,i)=>{const p=point(v.x,v.y);if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();ctx.fill();ctx.stroke();
            }});
            layers.push({z:2,draw:()=>{
              ctx.strokeStyle=colors[h.alliance];ctx.lineWidth=5;ctx.beginPath();
              front.forEach((v,i)=>{const p=point(v.x,v.y);if(i)ctx.lineTo(p[0],p[1]);else ctx.moveTo(p[0],p[1]);});ctx.closePath();ctx.stroke();
            }});
          }
        }
        for(const b of s.balls){
          if(!["floor","air","hive"].includes(b.location))continue;
          layers.push({z:b.z,draw:()=>{
          const p=point(b.x,b.y),r=BALL[b.kind].diameter/2*scale;
          // Keep the ball at its true planar position. A height ring distinguishes
          // flight without shifting the sprite away from the collision geometry.
          if(b.location==="air"){ctx.strokeStyle="#ffffffaa";ctx.lineWidth=1;ctx.beginPath();ctx.arc(p[0],p[1],r+2+b.z*2,0,Math.PI*2);ctx.stroke();}
          ctx.fillStyle=colors[b.kind];ctx.strokeStyle="#111";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fill();ctx.stroke();
          ctx.fillStyle="#111";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText(b.kind==="pollen"?"P":"N",p[0],p[1]+4);
          }});
        }
        const blend=Math.min(1,(now-at)/Math.max(50,(s.tick-(previous?.tick??s.tick))*1000/60));
        for(const r of s.robots){
          layers.push({z:0.45,draw:()=>{
          const old=previous?.robots.find(o=>o.id===r.id)??r,p=point(old.x+(r.x-old.x)*blend,old.y+(r.y-old.y)*blend);
          ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(-r.heading+viewRotation(view));
          ctx.fillStyle=colors[r.alliance];ctx.strokeStyle="#ffffff";ctx.lineWidth=3;ctx.fillRect(-0.225*scale,-0.225*scale,0.45*scale,0.45*scale);ctx.strokeRect(-0.225*scale,-0.225*scale,0.45*scale,0.45*scale);
          ctx.fillStyle="#111";ctx.beginPath();ctx.moveTo(0,-0.2*scale);ctx.lineTo(-10,-0.1*scale);ctx.lineTo(10,-0.1*scale);ctx.fill();ctx.restore();
          ctx.fillStyle="#111";ctx.font="bold 24px sans-serif";ctx.textAlign="center";ctx.fillText(String(r.id+1),p[0],p[1]+8);
          const setup=r.setup??DEFAULT_ROBOT;
          for(const side of ["front","back"] as const){
            const marks=(!setup.turret&&setup.shooter===side?"S":"")+(setup.deposit===side?"F":"")+(setup.intake===side||setup.intake==="both"?"I":"");
            if(!marks)continue;
            const a=r.heading+sideAngle(side),port=point(old.x+(r.x-old.x)*blend+Math.cos(a)*.16,old.y+(r.y-old.y)*blend+Math.sin(a)*.16);
            ctx.fillStyle="#111";ctx.fillRect(port[0]-marks.length*5-3,port[1]-9,marks.length*10+6,18);
            ctx.fillStyle="#fff";ctx.font="bold 14px sans-serif";ctx.fillText(marks,port[0],port[1]+5);
          }
          if(setup.turret){
            const a=shooterHeading(r),tip=point(old.x+(r.x-old.x)*blend+Math.cos(a)*.28,old.y+(r.y-old.y)*blend+Math.sin(a)*.28);
            ctx.strokeStyle=r.shotStatus==="ready"?"#86efac":"#fff0a0";ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(tip[0],tip[1]);ctx.stroke();
            ctx.fillStyle="#111";ctx.beginPath();ctx.arc(p[0],p[1],.065*scale,0,2*Math.PI);ctx.fill();ctx.stroke();
            ctx.fillStyle="#fff";ctx.font="bold 16px sans-serif";ctx.fillText(String(r.id+1),p[0],p[1]+6);ctx.fillText("S",tip[0],tip[1]-10);
          }
          }});
        }
        layers.sort((a,b)=>a.z-b.z).forEach(layer=>layer.draw());
        // Small element identifiers connect the unobstructed field to its counts.
        ctx.font="bold 18px sans-serif";ctx.textAlign="center";ctx.lineWidth=3;
        for(const [i,f] of s.flowers.entries()){
          const p=point(f.x*.91,f.y*.91),label=`F${i+1}`;
          ctx.strokeStyle="#111";ctx.strokeText(label,p[0],p[1]+6);ctx.fillStyle="#fff";ctx.fillText(label,p[0],p[1]+6);
        }
      }
      ctx.fillStyle="#111111dd";ctx.fillRect(c.width/2-135,c.height-27,270,27);
      ctx.fillStyle=colors[view];ctx.font="bold 18px sans-serif";ctx.textAlign="center";ctx.fillText(view.toUpperCase()+" DRIVER STATION",c.width/2,c.height-7);
      id=requestAnimationFrame(draw);
    }
    id=requestAnimationFrame(draw);return()=>cancelAnimationFrame(id);
  },[program,view]);
  return <><div className="bio-field-display"><div className="bio-field-wrap"><canvas ref={canvas} className="bio-field" width={900} height={900} tabIndex={0} aria-label="BIOBUZZ field. W A S D to drive, Q E to turn, J to toggle intake, H to aim, F to shoot, G to place in a flower, brackets to turn the turret. State and waypoint coordinates are available beside the field."
    onClick={event=>{event.currentTarget.focus();if(onWaypoint){const rect=event.currentTarget.getBoundingClientRect();onWaypoint({...viewToField({x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height},view),heading:0});}}}/>
    {state&&<div className="bio-field-totals" role="group" aria-label="Field ball totals">
      {state.flowers.map((f,i)=><Total key={`flower-${i}`} count={f.balls.length} name={`Flower ${i+1}`} position={f} view={view}/>)}
      {state.hives.flatMap(h=>h.cells.map((ids,cell)=><Total key={`${h.alliance}-${cell}`} count={ids.length} name={`${h.alliance} hive cell ${cell+1}`} position={hivePoint(h,cell,{x:HIVE.front-HIVE.depth/2,y:0,z:HIVE.bottom+HIVE.height/2})} view={view}/>))}
    </div>}
    </div>{state&&<div className="bio-field-counts" role="group" aria-label="Live field element contents">
      {state.flowers.map((f,i)=>{
        return <div key={i} role="group" aria-label={`Flower ${i+1} contents`} data-testid={`flower-contents-${i+1}`} className="bio-element-label">
          <strong>Flower {i+1}</strong><Contents state={state} ids={f.balls}/>
        </div>;
      })}
      {state.hives.flatMap(h=>h.cells.map((ids,cell)=>{
        const name=`${h.alliance==="red"?"Red":"Blue"} C${cell+1}`;
        return <div key={`${h.alliance}-${cell}`} role="group" aria-label={`${h.alliance} hive cell ${cell+1} contents`} data-testid={`hive-contents-${h.alliance}-${cell+1}`} className={`bio-element-label bio-element-${h.alliance}`}>
          <strong>{name} · {h.tipping?"Tipping":cell===h.upward?"Open":"Down"}</strong><Contents state={state} ids={ids}/>
        </div>;
      }))}
    </div>}
  </div><p className="bio-help bio-field-legend">Numbers on the field show total balls. F1–F4 = flowers · C1/C2 = hive cells. P = pollen · R = red nectar · B = blue nectar. Scoring and bottom-to-top stacks are in Field contents.</p></>;
}
