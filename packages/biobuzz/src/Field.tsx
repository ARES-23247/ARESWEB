import { useEffect, useRef } from "react";
import type { AutoProgram, Pose, Snapshot } from "./core/types";
import { BALL, HALF, SIZE } from "./core/types";
import backgroundUrl from "../assets/field.png";
const colors={pollen:"#f4cf38",red:"#ef5350",blue:"#4285f4"};
export default function Field({state,program,onWaypoint}:{state:Snapshot|null;program?:AutoProgram;onWaypoint?:(pose:Pose)=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null),frame=useRef({previous:state,current:state,at:performance.now()});
  useEffect(()=>{frame.current={previous:frame.current.current,current:state,at:performance.now()};},[state]);
  useEffect(()=>{
    const image=new Image();image.src=backgroundUrl;
    let id=0;
    function draw(now:number){
      const c=canvas.current,ctx=c?.getContext("2d");if(!ctx||!c)return;
      const {current:s,previous,at}=frame.current,scale=c.width/SIZE;
      const point=(x:number,y:number)=>[(HALF-y)*scale,(HALF-x)*scale];
      ctx.clearRect(0,0,c.width,c.height);
      if(image.complete&&image.naturalWidth)ctx.drawImage(image,0,0,c.width,c.height);
      if(program){
        ctx.strokeStyle="#ffffff";ctx.lineWidth=3;ctx.setLineDash([8,5]);ctx.beginPath();
        const start=point(program.start.x,program.start.y);ctx.moveTo(start[0],start[1]);
        for(const step of program.steps)if(step.kind==="drive"){const p=point(step.target.x,step.target.y);ctx.lineTo(p[0],p[1]);}
        ctx.stroke();ctx.setLineDash([]);
      }
      if(s){
        for(const h of s.hives){
          const p=point(h.x,h.y);ctx.strokeStyle=colors[h.alliance];ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(p[0],p[1]-0.45*scale);ctx.lineTo(p[0],p[1]+0.45*scale);ctx.stroke();
          for(let cell=0;cell<2;cell++){
            const cp=point(h.x+(cell===0?-1:1)*0.39116*Math.cos(h.angle),h.y);
            ctx.fillStyle=cell===h.upward?"#eee7d3":"#444444";ctx.strokeStyle=colors[h.alliance];ctx.lineWidth=5;
            ctx.fillRect(cp[0]-0.254*scale,cp[1]-0.153*scale,0.508*scale,0.306*scale);ctx.strokeRect(cp[0]-0.254*scale,cp[1]-0.153*scale,0.508*scale,0.306*scale);
            ctx.fillStyle=cell===h.upward?"#111111":"#ffffff";ctx.font="bold 18px sans-serif";ctx.textAlign="center";
            ctx.fillText((cell===h.upward?"OPEN ":"DOWN ")+h.cells[cell].length,cp[0],cp[1]);
          }
        }
        for(const b of s.balls){
          if(!["floor","air"].includes(b.location))continue;
          const p=point(b.x,b.y),r=BALL[b.kind].diameter/2*scale;
          if(b.location==="air"){ctx.fillStyle="#00000060";ctx.beginPath();ctx.ellipse(p[0],p[1],r,r*0.65,0,0,Math.PI*2);ctx.fill();}
          const y=p[1]-(b.location==="air"?b.z*scale*0.18:0);
          ctx.fillStyle=colors[b.kind];ctx.strokeStyle="#111";ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p[0],y,r,0,Math.PI*2);ctx.fill();ctx.stroke();
          ctx.fillStyle="#111";ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText(b.kind==="pollen"?"P":"N",p[0],y+4);
        }
        for(const f of s.flowers){
          const p=point(f.x,f.y);ctx.fillStyle="#111111dd";ctx.fillRect(p[0]-38,p[1]+16,76,20);
          ctx.fillStyle="#fff";ctx.font="bold 13px sans-serif";ctx.textAlign="center";
          ctx.fillText(f.balls.filter(id=>s.balls[id].kind==="pollen").length+"P / "+f.balls.filter(id=>s.balls[id].kind!=="pollen").length+"N",p[0],p[1]+31);
        }
        const blend=Math.min(1,(now-at)/Math.max(50,(s.tick-(previous?.tick??s.tick))*1000/60));
        for(const r of s.robots){
          const old=previous?.robots.find(o=>o.id===r.id)??r,p=point(old.x+(r.x-old.x)*blend,old.y+(r.y-old.y)*blend);
          ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(-r.heading);
          ctx.fillStyle=colors[r.alliance];ctx.strokeStyle="#ffffff";ctx.lineWidth=3;ctx.fillRect(-0.225*scale,-0.225*scale,0.45*scale,0.45*scale);ctx.strokeRect(-0.225*scale,-0.225*scale,0.45*scale,0.45*scale);
          ctx.fillStyle="#111";ctx.beginPath();ctx.moveTo(0,-0.2*scale);ctx.lineTo(-10,-0.1*scale);ctx.lineTo(10,-0.1*scale);ctx.fill();ctx.restore();
          ctx.fillStyle="#111";ctx.font="bold 24px sans-serif";ctx.textAlign="center";ctx.fillText(String(r.id+1),p[0],p[1]+8);
        }
      }
      id=requestAnimationFrame(draw);
    }
    id=requestAnimationFrame(draw);return()=>cancelAnimationFrame(id);
  },[program]);
  return <canvas ref={canvas} className="bio-field" width={900} height={900} tabIndex={0} aria-label="BIOBUZZ field. W A S D to drive, Q E to turn, J to intake, F to shoot. State and waypoint coordinates are available beside the field."
    onClick={event=>{event.currentTarget.focus();if(onWaypoint){const rect=event.currentTarget.getBoundingClientRect();onWaypoint({x:HALF-(event.clientY-rect.top)/rect.height*SIZE,y:HALF-(event.clientX-rect.left)/rect.width*SIZE,heading:0});}}}/>;
}
