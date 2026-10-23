import {useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import {House,Dumbbell,ChartNoAxesCombined,UserRound} from 'lucide-react';
import {pulseHaptic} from './haptics';
import './mobile-navigation.css';

const destinations=[{name:'Today',icon:House},{name:'Train',icon:Dumbbell},{name:'Progress',icon:ChartNoAxesCombined},{name:'Profile',icon:UserRound}] as const;
type Destination=typeof destinations[number]['name'];
type Cell={x:number;y:number;width:number;height:number};
type Gesture={id:number;startX:number;startY:number;index:number;dragged:boolean};

export default function MobileNavigation({view,onNavigate}:{view:string;onNavigate:(view:Destination)=>void}){
  const nav=useRef<HTMLElement>(null),buttons=useRef<(HTMLButtonElement|null)[]>([]);
  const [cells,setCells]=useState<Cell[]>([]),[pressed,setPressed]=useState(false);
  const geometry=useRef<Cell[]>([]),gesture=useRef<Gesture|null>(null),frame=useRef(0);
  const active=destinations.findIndex(d=>d.name===view),selected=useRef(active);
  selected.current=active;
  const current=useRef({x:0,width:0,vx:0,vw:0}),target=useRef({x:0,width:0});
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function paint(){nav.current?.style.setProperty('--lens-x',`${current.current.x}px`);nav.current?.style.setProperty('--lens-width',`${current.current.width}px`)}
  function aim(x:number,width:number,immediate=false){
    cancelAnimationFrame(frame.current);target.current={x,width};
    if(immediate||reduced()){current.current={x,width,vx:0,vw:0};paint();return}
    let previous=performance.now();
    const step=(now:number)=>{
      const dt=Math.min((now-previous)/1000,1/30);previous=now;
      const s=current.current,t=target.current;
      s.vx+=(440*(t.x-s.x)-36*s.vx)*dt;s.vw+=(440*(t.width-s.width)-36*s.vw)*dt;
      s.x+=s.vx*dt;s.width+=s.vw*dt;paint();
      if(Math.abs(t.x-s.x)+Math.abs(t.width-s.width)<.15&&Math.abs(s.vx)+Math.abs(s.vw)<.5){current.current={...t,vx:0,vw:0};paint();frame.current=0;return}
      frame.current=requestAnimationFrame(step);
    };
    frame.current=requestAnimationFrame(step);
  }
  function rest(index=selected.current,immediate=false){const c=geometry.current[index];if(c)aim(c.x,c.width,immediate)}
  function cancel(){
    const id=gesture.current?.id;gesture.current=null;setPressed(false);rest();
    if(id!==undefined&&nav.current?.hasPointerCapture(id))nav.current.releasePointerCapture(id);
  }
  useLayoutEffect(()=>{
    const el=nav.current;if(!el)return;
    function measure(){
      gesture.current=null;setPressed(false);
      const next=buttons.current.map(button=>({x:button?.offsetLeft||0,y:button?.offsetTop||0,width:button?.offsetWidth||0,height:button?.offsetHeight||0}));
      geometry.current=next;setCells(next);rest(selected.current,true);
    }
    const observer=new ResizeObserver(measure);observer.observe(el);measure();
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    const stop=()=>cancel();
    window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);motion.addEventListener('change',stop);
    return()=>{observer.disconnect();cancelAnimationFrame(frame.current);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);motion.removeEventListener('change',stop)};
  },[]);
  useLayoutEffect(()=>{cancel()},[view]);
  function nearest(x:number){return geometry.current.reduce((best,c,i)=>Math.abs(c.x+c.width/2-x)<Math.abs(geometry.current[best].x+geometry.current[best].width/2-x)?i:best,0)}
  function preview(clientX:number){
    const el=nav.current,g=gesture.current;if(!el||!g)return;
    const x=clientX-el.getBoundingClientRect().left-el.clientLeft;
    const index=nearest(x),cell=geometry.current[index];if(!cell)return;
    g.index=index;
    const width=cell.width*(reduced()?1:1.14);
    const left=Math.max(3,Math.min(el.clientWidth-width-3,x-width/2));
    aim(left,width,true);
  }
  function down(event:PointerEvent<HTMLElement>){
    if(event.button!==0||!event.isPrimary||gesture.current)return;
    const index=buttons.current.findIndex(b=>b?.contains(event.target as Node));if(index<0)return;
    event.preventDefault();buttons.current[index]?.focus({preventScroll:true});
    gesture.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,index,dragged:false};
    event.currentTarget.setPointerCapture(event.pointerId);setPressed(true);
    const c=geometry.current[index];if(c)aim(c.x-(reduced()?0:c.width*.04),c.width*(reduced()?1:1.08));
  }
  function move(event:PointerEvent<HTMLElement>){
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;
    const dx=Math.abs(event.clientX-g.startX),dy=Math.abs(event.clientY-g.startY);
    if(!g.dragged&&dy>12&&dy>dx*1.3){cancel();return}
    if(dx>6)g.dragged=true;
    if(g.dragged)preview(event.clientX);
  }
  function commit(index:number,trusted:boolean){if(index!==selected.current){if(trusted)pulseHaptic();onNavigate(destinations[index].name)}rest(index)}
  function up(event:PointerEvent<HTMLElement>){
    const g=gesture.current;if(!g||g.id!==event.pointerId)return;
    const r=event.currentTarget.getBoundingClientRect();
    if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom){cancel();return}
    gesture.current=null;setPressed(false);event.currentTarget.releasePointerCapture(event.pointerId);commit(g.index,event.isTrusted);
  }
  return <nav ref={nav} className={`mobile-nav lens-navigation${view==='Workout'?' session-nav':''}`} aria-label="Mobile navigation" data-managed-haptics data-pressed={pressed} data-selected={active>=0} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={()=>{if(gesture.current)cancel()}} onKeyDown={e=>{if(e.key==='Escape')cancel()}}>
    {destinations.map((d,i)=><button ref={el=>{buttons.current[i]=el}} type="button" key={d.name} className={view===d.name?'active':''} aria-current={view===d.name?'page':undefined} onClick={e=>{if(e.detail===0)commit(i,e.isTrusted)}}><d.icon size={20} aria-hidden="true"/><span>{d.name}</span></button>)}
    <div className="nav-lens" aria-hidden="true"/>
    <div className="nav-lens-optics" aria-hidden="true">{destinations.map((d,i)=><span className="nav-optic-cell" key={d.name} style={cells[i]?{left:cells[i].x,top:cells[i].y,width:cells[i].width,height:cells[i].height}:undefined}><span><d.icon size={20}/><span>{d.name}</span></span></span>)}</div>
    <div className="nav-lens-edge" aria-hidden="true"/>
  </nav>;
}
