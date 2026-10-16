export const accentPresets=[
  {name:'Lime',accent:'#c6f36b',background:'#131512'},
  {name:'Pink',accent:'#ff9acb',background:'#211019'},
  {name:'Blue',accent:'#86c4ff',background:'#101927'},
  {name:'Orange',accent:'#ffb36b',background:'#21160e'},
  {name:'Purple',accent:'#c3a7ff',background:'#191226'},
  {name:'Teal',accent:'#73e2d4',background:'#0e1d1c'},
] as const;

export const defaultAccent=accentPresets[0].accent;
export const defaultBackground=accentPresets[0].background;
export const defaultLogoAccent=accentPresets[0].accent;
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

function appIconSvg(color:string,base:string){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="116" fill="${color}"/><path d="M137 128h256l-48 96H137zm0 144h176l-48 96H137z" fill="${base}"/></svg>`;
}

function updateAppIcon(color:string,base:string){
  const svg=`data:image/svg+xml,${encodeURIComponent(appIconSvg(color,base))}`;
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

export function applyAppearance(accent:unknown,background:unknown,appIcon:unknown){
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
  updateAppIcon(safeThemeColor(appIcon,defaultLogoAccent),base);
}
