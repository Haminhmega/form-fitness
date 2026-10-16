export const accentPresets=[
  {name:'Lime',value:'#c6f36b'},
  {name:'Pink',value:'#ff8fc7'},
  {name:'Blue',value:'#78b7ff'},
  {name:'Orange',value:'#ffad66'},
  {name:'Purple',value:'#bd9cff'},
  {name:'Teal',value:'#68ddcf'},
] as const;

export const defaultAccent=accentPresets[0].value;
export const defaultLogoAccent=accentPresets[0].value;
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

export function applyAppearance(accent:unknown,logoAccent:unknown){
  const root=document.documentElement;
  const color=safeThemeColor(accent,defaultAccent);
  root.style.setProperty('--accent',color);
  root.style.setProperty('--accent-ink',accentInk(color));
  root.style.setProperty('--logo-accent',safeThemeColor(logoAccent,defaultLogoAccent));
}
