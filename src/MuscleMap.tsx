import type {BodyRegion} from './exercise-guide';
import {bodyRegions} from './exercise-guide';

export function MuscleMap({muscle}:{muscle:string}){
  const active=new Set<BodyRegion>(bodyRegions(muscle));
  const zone=(region:BodyRegion)=>`muscle-zone ${active.has(region)?'is-active':''}`;
  return <figure className="muscle-map">
    <svg viewBox="0 0 140 260" role="img" aria-label={`Human body diagram highlighting ${muscle}`}>
      <circle className="muscle-base" cx="70" cy="25" r="17"/>
      <rect className={zone('neck')} x="63" y="40" width="14" height="13" rx="5"/>
      <ellipse className={zone('shoulders')} cx="46" cy="61" rx="21" ry="12"/>
      <ellipse className={zone('shoulders')} cx="94" cy="61" rx="21" ry="12"/>
      <path className={zone('chest')} d="M51 55 Q70 48 89 55 L85 91 Q70 98 55 91Z"/>
      <path className={zone('back')} d="M53 58 Q70 50 87 58 L84 113 Q70 120 56 113Z" opacity=".72"/>
      <path className={zone('core')} d="M56 91 Q70 97 84 91 L82 125 Q70 133 58 125Z"/>
      <ellipse className={zone('upper-arms')} cx="35" cy="91" rx="10" ry="31" transform="rotate(8 35 91)"/>
      <ellipse className={zone('upper-arms')} cx="105" cy="91" rx="10" ry="31" transform="rotate(-8 105 91)"/>
      <ellipse className={zone('forearms')} cx="29" cy="137" rx="8" ry="29" transform="rotate(7 29 137)"/>
      <ellipse className={zone('forearms')} cx="111" cy="137" rx="8" ry="29" transform="rotate(-7 111 137)"/>
      <circle className="muscle-base" cx="26" cy="170" r="7"/><circle className="muscle-base" cx="114" cy="170" r="7"/>
      <path className={zone('hips')} d="M58 122 Q70 130 82 122 L88 151 Q70 163 52 151Z"/>
      <path className={zone('thighs')} d="M54 150 Q64 155 69 153 L65 205 Q57 211 49 204Z"/>
      <path className={zone('thighs')} d="M86 150 Q76 155 71 153 L75 205 Q83 211 91 204Z"/>
      <path className={zone('calves')} d="M49 203 Q58 208 65 203 L63 246 Q56 251 51 245Z"/>
      <path className={zone('calves')} d="M91 203 Q82 208 75 203 L77 246 Q84 251 89 245Z"/>
      <ellipse className="muscle-base" cx="56" cy="250" rx="11" ry="5"/><ellipse className="muscle-base" cx="84" cy="250" rx="11" ry="5"/>
    </svg>
    <figcaption><span>Primary area</span><strong>{muscle}</strong></figcaption>
  </figure>;
}
