export const accentPresets=[
  {name:'Lime',accent:'#c6f36b',background:'#131512'},
  {name:'Pink',accent:'#ff9acb',background:'#211019'},
  {name:'Blue',accent:'#86c4ff',background:'#101927'},
  {name:'Orange',accent:'#ffb36b',background:'#21160e'},
  {name:'Purple',accent:'#c3a7ff',background:'#191226'},
  {name:'Teal',accent:'#73e2d4',background:'#0e1d1c'},
  {name:'Pumpkin',accent:'#ff8a3d',background:'#1f1009',iconStyle:'pumpkin'},
] as const;

export const defaultAccent=accentPresets[0].accent;
export const defaultBackground=accentPresets[0].background;
export const defaultLogoAccent=accentPresets[0].accent;
export const appIconStyles=[
  {id:'classic',name:'Classic'},
  {id:'cat',name:'Cat'},
  {id:'dog',name:'Dog'},
  {id:'sparkle',name:'Stars'},
  {id:'confetti',name:'Celebrate'},
  {id:'heart',name:'Heart'},
  {id:'snow',name:'Snow day'},
  {id:'pumpkin',name:'Pumpkin'},
] as const;
export type AppIconStyle=(typeof appIconStyles)[number]['id'];
export const defaultAppIconStyle:AppIconStyle='classic';
const validHex=/^#[0-9a-f]{6}$/i;

export function safeThemeColor(value:unknown,fallback:string){
  return typeof value==='string'&&validHex.test(value)?value.toLowerCase():fallback;
}

export function accentInk(color:string){
  const value=safeThemeColor(color,defaultAccent).slice(1);
  const [r,g,b]=[0,2,4].map(index=>parseInt(value.slice(index,index+2),16)/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4);
  // WCAG contrast crossover: dark ink wins above roughly 0.179 luminance.
  return .2126*r+.7152*g+.0722*b>.179?'#14200d':'#ffffff';
}

function mix(color:string,whiteAmount:number){
  const value=safeThemeColor(color,defaultBackground).slice(1);
  const channels=[0,2,4].map(index=>parseInt(value.slice(index,index+2),16));
  return `#${channels.map(channel=>Math.round(channel+(255-channel)*whiteAmount).toString(16).padStart(2,'0')).join('')}`;
}

export function safeAppIconStyle(value:unknown):AppIconStyle{
  return appIconStyles.some(style=>style.id===value)?value as AppIconStyle:defaultAppIconStyle;
}

function iconDecoration(style:AppIconStyle,base:string,color:string){
  if(style==='cat')return `<path d="m171 136 25-69 58 61m69 8-25-69-58 61" fill="${base}"/><g fill="${color}"><path d="M210 166q15-15 30 0-15 18-30 0Zm70 0q15-15 30 0-15 18-30 0Z"/><path d="m252 190 8 6 8-6-8-5z"/></g><g stroke="${base}" stroke-width="8" stroke-linecap="round"><path d="M130 190h58m-53 24 54-10m201-14h-58m53 24-54-10"/></g>`;
  if(style==='dog')return `<path d="M157 125c-36-24-76-9-82 27-7 40 22 74 72 71l28-70Zm206 0c36-24 76-9 82 27 7 40-22 74-72 71l-28-70Z" fill="${base}"/><g fill="${color}"><ellipse cx="220" cy="169" rx="13" ry="16"/><ellipse cx="300" cy="169" rx="13" ry="16"/><path d="m244 194 16 12 16-12-16-8z"/></g>`;
  if(style==='sparkle')return `<g fill="${base}"><path d="m406 83 11 27 27 11-27 11-11 27-11-27-27-11 27-11z"/><path d="m102 332 8 20 20 8-20 8-8 20-8-20-20-8 20-8z"/><circle cx="410" cy="366" r="9"/></g>`;
  if(style==='confetti')return `<g fill="${base}"><rect x="92" y="102" width="17" height="35" rx="8" transform="rotate(-38 100 119)"/><rect x="402" y="92" width="17" height="35" rx="8" transform="rotate(29 410 109)"/><rect x="91" y="366" width="17" height="35" rx="8" transform="rotate(32 99 383)"/><rect x="405" y="351" width="17" height="35" rx="8" transform="rotate(-36 413 368)"/><circle cx="83" cy="239" r="9"/><circle cx="429" cy="239" r="9"/></g>`;
  if(style==='heart')return `<path d="M391 318c-31-34-83 5-45 51l45 44 45-44c38-46-14-85-45-51Z" fill="${base}"/><path d="M102 102c-18-20-49 3-27 30l27 26 27-26c22-27-9-50-27-30Z" fill="${base}" opacity=".7"/>`;
  if(style==='snow')return `<g fill="none" stroke="${base}" stroke-width="11" stroke-linecap="round"><path d="M408 84v100m-43-75 86 50m-86 0 86-50"/><path d="M105 333v76m-33-57 66 38m-66 0 66-38"/></g>`;
  if(style==='pumpkin')return `<path d="M258 92c-10-25 2-48 28-57" fill="none" stroke="${base}" stroke-width="16" stroke-linecap="round"/><path d="M125 118C78 151 67 224 91 283c12 30 32 52 61 67M387 118c47 33 58 106 34 165-12 30-32 52-61 67" fill="none" stroke="${base}" stroke-width="17" stroke-linecap="round" opacity=".72"/><path d="M111 177c-13 42-10 85 8 124m282-124c13 42 10 85-8 124" fill="none" stroke="${base}" stroke-width="9" stroke-linecap="round" opacity=".38"/>`;
  return '';
}

function appIconSvg(color:string,base:string,style:AppIconStyle){
  const mark=`<path d="M137 128h256l-48 96H137zm0 144h176l-48 96H137z" fill="${base}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs><linearGradient id="finish" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".16"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="${base}" stop-opacity=".09"/></linearGradient></defs><rect width="512" height="512" rx="116" fill="${color}"/><rect width="512" height="512" rx="116" fill="url(#finish)"/>${mark}${iconDecoration(style,base,color)}</svg>`;
}

export function appIconDataUrl(color:unknown,base:unknown,style:unknown){
  return `data:image/svg+xml,${encodeURIComponent(appIconSvg(safeThemeColor(color,defaultLogoAccent),safeThemeColor(base,defaultBackground),safeAppIconStyle(style)))}`;
}

function updateAppIcon(color:string,base:string,style:AppIconStyle){
  const svg=appIconDataUrl(color,base,style);
  const favicon=document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if(favicon)favicon.href=svg;
  const appleIcon=document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if(appleIcon){
    const image=new Image();
    image.onload=()=>{
      const canvas=document.createElement('canvas');
      canvas.width=180;canvas.height=180;
      canvas.getContext('2d')?.drawImage(image,0,0,180,180);
      appleIcon.href=canvas.toDataURL('image/png');
    };
    image.src=svg;
  }
}

export function applyAppearance(accent:unknown,background:unknown,appIcon:unknown,appIconStyle:unknown){
  const root=document.documentElement;
  const color=safeThemeColor(accent,defaultAccent);
  const base=safeThemeColor(background,defaultBackground);
  root.style.setProperty('--accent',color);
  root.style.setProperty('--accent-ink',accentInk(color));
  root.style.setProperty('--logo-accent',color);
  root.style.setProperty('--bg',base);
  root.style.setProperty('--surface-deep',mix(base,.035));
  root.style.setProperty('--surface',mix(base,.07));
  root.style.setProperty('--surface-raised',mix(base,.115));
  root.style.setProperty('--surface-soft',mix(base,.16));
  root.style.setProperty('--border',mix(base,.2));
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content',base);
  updateAppIcon(safeThemeColor(appIcon,defaultLogoAccent),base,safeAppIconStyle(appIconStyle));
}
