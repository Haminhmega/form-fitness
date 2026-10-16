import {z} from 'zod';
import {focusAreas,trainingStyles,impactOptions,movementAvoidances,sportFocusOptions,sessionDurationRange} from './coaching';
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
export const coachingSchema=z.object({version:z.literal(1),focusAreas:z.array(z.enum(focusAreas)).max(3),sessionMinutes:z.number().int().min(sessionDurationRange.min).max(sessionDurationRange.max),trainingStyle:z.enum(trainingStyles),trainingStyles:z.array(z.enum(trainingStyles)).min(1).max(4).refine(styles=>new Set(styles).size===styles.length).optional(),impact:z.enum(impactOptions),avoidMovements:z.array(z.enum(movementAvoidances)).max(4),sportFocus:z.enum(sportFocusOptions)}).strict();
export const preferencesSchema=z.object({units:z.enum(['kg','lb']),notifications:z.boolean(),cloud:z.boolean(),contribute:z.boolean(),retention:text(50),goal:text(60),experience:text(60),equipment:z.array(text(50)).max(20),days:z.array(z.string().refine(day=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(day))).max(7),onboarded:z.boolean(),firstTime:z.boolean(),coaching:coachingSchema.optional()}).strict();
const exercise=z.object({id,name:text(100),muscle:text(100),equipment:text(100),supported:z.boolean(),supportLevel:z.enum(['real_ai','experimental_ai','illustrative_only','logging_only']).optional(),instructions:text(5000),variation:text(100),filming:text(5000),custom:z.boolean().optional(),catalog:z.boolean().optional(),level:text(50).nullable().optional(),category:text(80).nullable().optional(),rating:z.number().finite().nonnegative().nullable().optional(),source:text(200).optional()}).strict();
const recoveryPlan=z.object({minutes:z.number().int().min(1).max(120),steps:z.array(text(500)).min(1).max(10)}).strict();
const routine=z.object({kind:z.literal('recovery').optional(),scheduledDay:z.enum(['Mon','Tue','Wed','Thu','Fri','Sat','Sun']).optional(),recovery:recoveryPlan.optional(),id,name:text(100),description:text(1000),exercises:z.array(z.object({exerciseId:id,sets:z.number().int().min(1).max(100),reps:text(100),rest:number,notes:text(5000)}).strict()).max(100)}).strict().superRefine((value,ctx)=>{if(value.kind==='recovery'&&(!value.recovery||value.exercises.length))ctx.addIssue({code:'custom',message:'Recovery sessions need recovery guidance and no resistance exercises.'});if(value.recovery&&value.kind!=='recovery')ctx.addIssue({code:'custom',message:'Recovery guidance requires a recovery session.'})});
const history=z.object({kind:z.literal('recovery').optional(),id,routineId:id.optional(),name:text(100),date:text(30),completedAt:text(40).optional(),duration:number,sets:number,volume:number,feedback:z.boolean(),exercises:z.array(z.object({exerciseId:id.optional(),name:text(100),notes:text(5000).optional(),sets:z.array(set).max(100)}).strict()).max(100),sample:z.boolean().optional(),feedbackExerciseId:id.optional(),feedbackKind:z.enum(['analysis','sample']).optional()}).strict();
export const documentSchema=z.object({profile:profileSchema,training:z.object({preferences:preferencesSchema,routines:z.array(routine).max(200),exercises:z.array(exercise).max(500),history:z.array(history).max(2000)}).strict()}).strict();
export const saveSchema=z.object({revision:z.number().int().nonnegative(),document:documentSchema}).strict();
export type FitnessProfile=z.infer<typeof profileSchema>;
export type AccountDocument=z.infer<typeof documentSchema>;
export type CloudRecord={revision:number;updatedAt:string;document:AccountDocument};
export type AccountUser={id:string;email:string;name:string;provider:'password'|'google'|'chatgpt';googleLinked:boolean};
