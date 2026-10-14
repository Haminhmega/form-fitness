import {z} from 'zod';
const text=(max:number)=>z.string().max(max);
const id=text(120).min(1);
const number=z.number().finite().nonnegative().max(10000000);
const set=z.object({id,weight:number,reps:number,done:z.boolean()}).strict();
export const profileSchema=z.object({
  name:z.string().trim().min(1,'Enter your name.').max(60),
  age:z.number().int().min(13).max(120).nullable(),
  heightCm:z.number().finite().min(50).max(260).nullable(),
  weightKg:z.number().finite().min(20).max(500).nullable(),
  targetWeightKg:z.number().finite().min(20).max(500).nullable(),
  activity:z.enum(['Mostly seated','Lightly active','Moderately active','Very active']),
}).strict();
export const preferencesSchema=z.object({units:z.enum(['kg','lb']),notifications:z.boolean(),cloud:z.boolean(),contribute:z.boolean(),retention:text(50),goal:text(60),experience:text(60),equipment:z.array(text(50)).max(20),days:z.array(z.string().refine(day=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(day))).max(7),onboarded:z.boolean(),firstTime:z.boolean()}).strict();
const exercise=z.object({id,name:text(100),muscle:text(100),equipment:text(100),supported:z.boolean(),instructions:text(5000),variation:text(100),filming:text(5000),custom:z.boolean().optional()}).strict();
const routine=z.object({id,name:text(100),description:text(1000),exercises:z.array(z.object({exerciseId:id,sets:z.number().int().min(1).max(100),reps:text(100),rest:number,notes:text(5000)}).strict()).max(100)}).strict();
const history=z.object({id,name:text(100),date:text(30),duration:number,sets:number,volume:number,feedback:z.boolean(),exercises:z.array(z.object({exerciseId:id.optional(),name:text(100),sets:z.array(set).max(100)}).strict()).max(100),sample:z.boolean().optional(),feedbackExerciseId:id.optional()}).strict();
export const documentSchema=z.object({profile:profileSchema,training:z.object({preferences:preferencesSchema,routines:z.array(routine).max(200),exercises:z.array(exercise).max(500),history:z.array(history).max(2000)}).strict()}).strict();
export const saveSchema=z.object({revision:z.number().int().nonnegative(),document:documentSchema}).strict();
export type FitnessProfile=z.infer<typeof profileSchema>;
export type AccountDocument=z.infer<typeof documentSchema>;
export type CloudRecord={revision:number;updatedAt:string;document:AccountDocument};
export type AccountUser={id:string;email:string;name:string;provider:'google'|'chatgpt';googleLinked:boolean};
