import { useEffect, useRef } from "react";
import type { Alliance, AutoProgram, Pose, Snapshot } from "./core/types";
import { BALL, SIZE } from "./core/types";
import { hiveOutline, hiveTarget } from "./core/hive";
import { fieldToView, viewToField, viewRotation } from "./core/view";
import { DEFAULT_ROBOT,sideAngle } from "./core/robot";
import backgroundUrl from "../assets/field.png";
const colors={pollen:"#f4cf38",red:"#ef5350",blue:"#4285f4"};
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
              const target=hiveTarget(h,cell),cp=point(target.x,target.y);
              ctx.fillStyle="#111111dd";ctx.fillRect(cp[0]-43,cp[1]-11,86,22);
              ctx.fillStyle="#fff";ctx.font="bold 16px sans-serif";ctx.textAlign="center";
              ctx.fillText((cell===h.upward?"OPEN ":"DOWN ")+h.cells[cell].length,cp[0],cp[1]+6);
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
        for(const f of s.flowers){
          const p=point(f.x,f.y);ctx.fillStyle="#111111dd";ctx.fillRect(p[0]-38,p[1]+16,76,20);
          ctx.fillStyle="#fff";ctx.font="bold 13px sans-serif";ctx.textAlign="center";
          ctx.fillText(f.balls.filter(id=>s.balls[id].kind==="pollen").length+"P / "+f.balls.filter(id=>s.balls[id].kind!=="pollen").length+"N",p[0],p[1]+31);
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
            const marks=(setup.shooter===side?"S":"")+(setup.deposit===side?"F":"")+(setup.intake===side||setup.intake==="both"?"I":"");
            if(!marks)continue;
            const a=r.heading+sideAngle(side),port=point(old.x+(r.x-old.x)*blend+Math.cos(a)*.16,old.y+(r.y-old.y)*blend+Math.sin(a)*.16);
            ctx.fillStyle="#111";ctx.fillRect(port[0]-marks.length*5-3,port[1]-9,marks.length*10+6,18);
            ctx.fillStyle="#fff";ctx.font="bold 14px sans-serif";ctx.fillText(marks,port[0],port[1]+5);
          }
          }});
        }
        layers.sort((a,b)=>a.z-b.z).forEach(layer=>layer.draw());
      }
      ctx.fillStyle="#111111dd";ctx.fillRect(c.width/2-135,c.height-27,270,27);
      ctx.fillStyle=colors[view];ctx.font="bold 18px sans-serif";ctx.textAlign="center";ctx.fillText(view.toUpperCase()+" DRIVER STATION",c.width/2,c.height-7);
      id=requestAnimationFrame(draw);
    }
    id=requestAnimationFrame(draw);return()=>cancelAnimationFrame(id);
  },[program,view]);
  return <canvas ref={canvas} className="bio-field" width={900} height={900} tabIndex={0} aria-label="BIOBUZZ field. W A S D to drive, Q E to turn, J to toggle intake, F to shoot or cancel, G to place in a flower. State and waypoint coordinates are available beside the field."
    onClick={event=>{event.currentTarget.focus();if(onWaypoint){const rect=event.currentTarget.getBoundingClientRect();onWaypoint({...viewToField({x:(event.clientX-rect.left)/rect.width,y:(event.clientY-rect.top)/rect.height},view),heading:0});}}}/>;
}
