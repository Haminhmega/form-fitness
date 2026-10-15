import {POUNDS_PER_KILOGRAM} from './units';

export type MeasurementUnits='kg'|'lb';
export type BodyMeasurements={heightCm:number|null;weightKg:number|null;targetWeightKg:number|null};
export type MeasurementFields={height:string;heightFeet:string;heightInches:string;weight:string;target:string};
export type MeasurementState={units:MeasurementUnits;values:BodyMeasurements;fields:MeasurementFields};
const display=(value:number|null)=>value===null?'':String(Number(value.toFixed(1)));

export function createMeasurements(values:BodyMeasurements,units:MeasurementUnits):MeasurementState{
  const totalInches=values.heightCm===null?null:Math.round(values.heightCm/2.54*10)/10;
  return {units,values:{...values},fields:{
    height:display(values.heightCm),
    heightFeet:totalInches===null?'':String(Math.floor(totalInches/12)),
    heightInches:totalInches===null?'':display(totalInches%12),
    weight:display(values.weightKg===null?null:values.weightKg*(units==='lb'?POUNDS_PER_KILOGRAM:1)),
    target:display(values.targetWeightKg===null?null:values.targetWeightKg*(units==='lb'?POUNDS_PER_KILOGRAM:1)),
  }};
}

const optionalNumber=(value:string)=>value.trim()===''?null:Number(value);
export function editMeasurement(state:MeasurementState,field:keyof MeasurementFields,text:string):MeasurementState{
  const fields={...state.fields,[field]:text},values={...state.values};
  if(field==='height')values.heightCm=optionalNumber(text);
  else if(field==='heightFeet'||field==='heightInches'){
    const feet=optionalNumber(fields.heightFeet),inches=optionalNumber(fields.heightInches);
    values.heightCm=feet===null&&inches===null?null:
      Number.isInteger(feet??0)&&(feet??0)>=0&&Number.isFinite(inches??0)&&(inches??0)>=0&&(inches??0)<12?
        ((feet??0)*12+(inches??0))*2.54:NaN;
  }else{
    const value=optionalNumber(text);
    values[field==='weight'?'weightKg':'targetWeightKg']=value===null?null:value/(state.units==='lb'?POUNDS_PER_KILOGRAM:1);
  }
  return {...state,fields,values};
}

// A unit change renders the stored metric value; it never converts a rounded input back.
export function changeMeasurementUnits(state:MeasurementState,units:MeasurementUnits):MeasurementState{
  return units===state.units?state:createMeasurements(state.values,units);
}
export function hasInvalidMeasurements(state:MeasurementState){return Object.values(state.values).some(value=>value!==null&&!Number.isFinite(value))}

export function formatHeight(heightCm:number,units:MeasurementUnits){
  if(units==='kg')return `${display(heightCm)} cm`;
  const {fields}=createMeasurements({heightCm,weightKg:null,targetWeightKg:null},units);
  return `${fields.heightFeet} ft ${fields.heightInches} in`;
}
