import {useState} from 'react';
import type {Exercise} from './types';
import {muscleEmphasis,muscleNames,type Muscle} from './muscle-emphasis';
const outline='M60 18 C48 18 47 39 53 46 L54 55 Q45 61 35 64 Q26 67 23 85 L15 124 L10 156 Q8 165 14 168 Q21 171 23 159 L29 132 L39 103 L42 127 Q37 146 40 166 L43 206 L41 244 L35 255 Q33 260 43 260 L56 258 L59 212 L64 173 L69 212 L72 258 L85 260 Q95 260 93 255 L87 244 L85 206 L88 166 Q91 146 86 127 L89 103 L99 132 L105 159 Q107 171 114 168 Q120 165 118 156 L113 124 L105 85 Q102 67 93 64 Q83 61 74 55 L75 46 C81 39 80 18 68 18 Z';
type Zone=[Muscle,string];
const front:Zone[]=[
['frontDelt','M36 67 Q44 63 48 67 L44 87 L30 93 Q27 76 36 67Z'],
['sideDelt','M30 72 L35 68 L29 96 L24 99 Q24 82 30 72Z'],
['upperChest','M49 66 L62 69 L62 78 L46 76Z'],
['chest','M46 79 L62 81 L62 98 Q49 101 44 91Z'],
['biceps','M30 98 L40 94 L35 119 L27 125Z'],
['forearms','M25 129 L33 123 L23 151 L17 157Z'],
['abs','M55 103 L62 103 L62 141 L54 144Z'],
['obliques','M45 101 L52 106 L51 140 L43 133Z'],
['quads','M44 150 L57 151 L59 173 L53 202 L45 199Z'],
['adductors','M58 147 L63 150 L61 179 L57 170Z'],
['calves','M46 210 L54 210 L51 239 L45 241Z']];
const back:Zone[]=[
['upperBack','M54 54 L62 57 L62 105 L51 94 L40 70Z'],
['rearDelt','M35 68 Q42 66 47 72 L42 88 L29 93 Q28 77 35 68Z'],
['sideDelt','M29 73 L34 69 L28 96 L24 100Z'],
['lats','M43 92 L58 106 L54 132 L43 124Z'],
['triceps','M29 99 L40 94 L35 122 L27 125Z'],
['forearms','M25 129 L33 124 L23 152 L17 157Z'],
['erectors','M58 107 L62 109 L62 142 L57 137Z'],
['sideGlutes','M43 133 L55 137 L52 148 L41 149Z'],
['glutes','M42 152 Q49 143 61 148 L62 167 Q47 176 41 164Z'],
['hamstrings','M43 176 L59 175 L55 205 L45 205Z'],
['calves','M45 211 Q52 205 55 215 L52 237 L46 239Z']];
export function MuscleMap({exercise}:{exercise:Exercise}){
 const info=muscleEmphasis(exercise);
 const [selected,setSelected]=useState<Muscle|null>(null);
 const muscle=selected&&[...info.primary,...info.secondary].includes(selected)?selected:info.primary[0];
 const zoneClass=(key:Muscle)=>'anatomy-zone '+(info.primary.includes(key)?'primary':info.secondary.includes(key)?'secondary':'')+(key===muscle?' selected':'');
 return <figure className="muscle-map anatomy-map">
 <div className="anatomy-heading"><span className="eyebrow">MUSCLE ATLAS</span><span>Front + back</span></div>
 <div className="anatomy-views">{(['Front','Back'] as const).map(view=><div key={view}><svg viewBox="0 0 128 278" role="img" aria-label={view+' anatomy; primary: '+info.primary.map(key=>muscleNames[key]).join(', ')+'; assisting: '+info.secondary.map(key=>muscleNames[key]).join(', ')}>
 <path d={outline} className="anatomy-silhouette"/>
 <path d="M54 24 Q64 19 74 24 M55 49 Q64 54 73 49 M64 65 L64 143" className="anatomy-detail"/>
 {(view==='Front'?front:back).map(([key,path])=><g key={key}><path d={path} className={zoneClass(key)}><title>{muscleNames[key]}</title></path><path d={path} transform="translate(128 0) scale(-1 1)" className={zoneClass(key)}><title>{muscleNames[key]}</title></path></g>)}
 {view==='Front'&&[113,124,135].map(y=><path key={y} d={'M54 '+y+' H74'} className="anatomy-detail"/>)}
 </svg><span className="anatomy-view-label">{view}</span></div>)}</div>
 <div className="anatomy-legend"><span><i/>Primary</span><span><i/>Assisting</span></div>
 <figcaption><span>Explore the highlighted muscles</span><div className="anatomy-muscle-buttons">{[...new Set([...info.primary,...info.secondary])].map(key=><button key={key} type="button" aria-pressed={muscle===key} onClick={()=>setSelected(key)}>{muscleNames[key]}</button>)}</div>{muscle&&<strong>{muscleNames[muscle]}</strong>}<small>Schematic location · color does not represent activation percentage.</small></figcaption>
 </figure>;
}
