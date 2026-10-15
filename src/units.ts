export const POUNDS_PER_KILOGRAM=2.2046226218;
export const MAX_WEIGHT_KG=1000;
export const MAX_REPS=999;

export const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
export const toDisplayWeight=(kilograms:number,units:'kg'|'lb')=>kilograms*(units==='lb'?POUNDS_PER_KILOGRAM:1);
export const toKilograms=(value:number,units:'kg'|'lb')=>value/(units==='lb'?POUNDS_PER_KILOGRAM:1);
