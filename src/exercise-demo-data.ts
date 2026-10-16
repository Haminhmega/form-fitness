import type {Demo,Pose} from './exercise-demonstrations';

// Each entry describes a named variation. Shared geometry is used only when
// stance, contact points and movement direction also match that variation.
export function additionalDemonstrations(base:Record<string,Demo>):Record<string,Demo>{
 const bench:Pose={head:[102,222],shoulder:[140,214],hip:[244,219],knee:[295,237],ankle:[315,290],elbow:[179,245],hand:[157,193]};
 const benchTop:Pose={...bench,elbow:[141,158],hand:[141,113]};
 const seated:Pose={head:[195,65],shoulder:[200,100],hip:[220,190],knee:[150,210],ankle:[139,287],elbow:[207,150],hand:[201,197]};
 const extended:Pose={...seated,ankle:[73,194]};
 const standing=base.curl.poses[0];
 const goblet=base.squat.poses.map(p=>({...p,elbow:[p.shoulder[0]-9,p.shoulder[1]+42],hand:[p.shoulder[0]-29,p.shoulder[1]+7]} as Pose)) as [Pose,Pose];
 const backSquat=base.squat.poses.map(p=>({...p,elbow:[p.shoulder[0]+39,p.shoulder[1]+22],hand:[p.shoulder[0]+17,p.shoulder[1]-5]} as Pose)) as [Pose,Pose];
 const incline:Pose={...bench,head:[154,111],shoulder:[175,145],hip:[235,218],elbow:[211,180],hand:[210,127]};
 const chest:Pose={...seated,elbow:[215,151],hand:[158,116]};
 const chestEnd:Pose={...chest,elbow:[145,107],hand:[84,106]};
 const row:Pose={...seated,head:[250,70],shoulder:[240,105],hip:[220,190],knee:[295,218],ankle:[310,290],elbow:[295,109],hand:[348,113]};
 const rowEnd:Pose={...row,elbow:[196,141],hand:[247,150]};
 const pull:Pose={...seated,elbow:[190,57],hand:[177,15]};
 const pullEnd:Pose={...seated,elbow:[188,154],hand:[174,103]};
 const legPress:Pose={head:[370,133],shoulder:[348,164],hip:[300,245],knee:[243,210],ankle:[232,133],elbow:[321,210],hand:[302,260]};
 const legPressEnd:Pose={...legPress,knee:[215,214],ankle:[145,167]};
 const wall:Pose={head:[241,55],shoulder:[247,88],hip:[273,182],knee:[288,238],ankle:[302,290],elbow:[196,89],hand:[144,90]};
 const wallEnd:Pose={...wall,head:[169,99],shoulder:[188,129],hip:[236,209],elbow:[191,179]};
 const raised:Pose={head:[118,127],shoulder:[151,149],hip:[251,199],knee:[309,244],ankle:[368,289],elbow:[135,202],hand:[118,250]};
 const raisedEnd:Pose={...raised,head:[111,170],shoulder:[148,189],hip:[262,228],elbow:[187,231]};
 const thrust:Pose={head:[105,156],shoulder:[135,183],hip:[231,254],knee:[303,223],ankle:[326,290],elbow:[178,210],hand:[221,242]};
 const thrustEnd:Pose={...thrust,hip:[254,183],knee:[324,219],elbow:[188,187],hand:[244,176]};
 const calfEnd:Pose={...standing,head:[204,38],shoulder:[204,76],hip:[208,166],knee:[203,224],ankle:[203,275],elbow:[206,141],hand:[218,207]};
 return {
  'goblet-squat':{...base.squat,title:'Dumbbell goblet squat',poses:goblet,dumbbells:true,weightStyle:'goblet',cues:['Hold one dumbbell at your chest','Bend hips and knees together','Keep your whole foot planted']},
  'barbell-squat':{...base.squat,title:'Barbell back squat',poses:backSquat,equipment:'barbell-back',cues:['Bar rests across the upper back','Bend hips and knees together','Stand through the whole foot']},
  'barbell-rdl':{...base.rdl,title:'Barbell Romanian deadlift',dumbbells:false,equipment:'barbell-hand',cues:['Keep the bar close to your legs','Send hips backward with softly bent knees','Return to standing without leaning back']},
  'barbell-row':{title:'Bent-over barbell row',view:'Side view',equipment:'barbell-hand',start:'Arms extended below your shoulders',finish:'Pull the bar toward your lower ribs',poses:[
   {head:[125,127],shoulder:[159,148],hip:[244,180],knee:[220,236],ankle:[202,290],elbow:[164,204],hand:[169,260]},
   {head:[125,127],shoulder:[159,148],hip:[244,180],knee:[220,236],ankle:[202,290],elbow:[213,132],hand:[219,188]}],
   cues:['Keep the hip-hinge position steady','Draw elbows back beside your torso','Lower the bar without standing upright']},
  'hammer-curl':{...base.curl,title:'Dumbbell hammer curl',weightStyle:'neutral',fixedElbows:true,cues:['Palms face each other throughout','Keep upper arms beside the torso','Lower through the same path']},
  'bench-dumbbell':{title:'Flat dumbbell bench press',view:'Side view',support:'flat',dumbbells:true,start:'Dumbbells beside your chest',finish:'Press above your chest',poses:[bench,benchTop],cues:['Head and back remain on the bench','Feet stay planted','Wrists stay over elbows']},
  'bench-barbell':{title:'Flat barbell bench press',view:'Side view',support:'flat',equipment:'barbell-hand',start:'Bar near your chest',finish:'Press above your shoulders',poses:[bench,benchTop],cues:['Head and back remain on the bench','Feet stay planted','Keep both hands evenly spaced on the bar']},
  'incline-dumbbell':{title:'Low-incline dumbbell press',view:'Side view',support:'incline',dumbbells:true,start:'Dumbbells beside upper chest',finish:'Press upward',poses:[incline,{...incline,elbow:[175,90],hand:[175,49]}],cues:['Use a modest bench incline','Keep your back against the bench','Lower with wrists above elbows']},
  'lateral-raise':{title:'Standing dumbbell lateral raise',view:'Front view',front:true,dumbbells:true,start:'Arms beside your thighs',finish:'Raise toward shoulder height',poses:[
   {head:[220,52],shoulder:[220,90],hip:[220,183],knee:[199,236],ankle:[190,290],elbow:[181,136],hand:[168,197],farElbow:[259,136],farHand:[272,197],farKnee:[241,236],farAnkle:[250,290]},
   {head:[220,52],shoulder:[220,90],hip:[220,183],knee:[199,236],ankle:[190,290],elbow:[161,94],hand:[103,112],farElbow:[279,94],farHand:[337,112],farKnee:[241,236],farAnkle:[250,290]}],
   cues:['Keep a soft elbow bend','Move arms out and slightly forward','Lower without swinging your torso']},
  'leg-extension':{title:'Seated leg extension',view:'Side view · machine',support:'seat',equipment:'leg-extension',fixedKnees:true,start:'Knees bent',finish:'Extend your knees',poses:[seated,extended],cues:['Align knees with the machine pivot','Pad rests above your ankles','Keep hips and back against the seat']},
  'leg-curl':{title:'Seated leg curl',view:'Side view · machine',support:'seat',equipment:'leg-curl',fixedKnees:true,start:'Legs extended',finish:'Curl heels down and back',poses:[extended,seated],cues:['Align knees with the machine pivot','Keep thighs under the top pad','Bend the knees without lifting your hips']},
  'leg-press':{title:'Seated leg press',view:'Side view · machine',equipment:'leg-press',start:'Knees bent toward your torso',finish:'Press the platform away',poses:[legPress,legPressEnd],cues:['Keep hips and back supported','Whole feet remain on the platform','Bend and extend the knees together']},
  'machine-chest-press':{title:'Seated machine chest press',view:'Side view · machine',support:'seat',equipment:'machine-press',start:'Handles beside your chest',finish:'Press forward',poses:[chest,chestEnd],cues:['Set handles around chest height','Keep your back against the pad','Return the handles with control']},
  'machine-row':{title:'Chest-supported machine row',view:'Side view · machine',support:'chest-pad',equipment:'machine-row',start:'Reach toward the handles',finish:'Draw elbows back',poses:[row,rowEnd],cues:['Keep chest against the support','Draw elbows toward your ribs','Reach forward without lifting off the pad']},
  'lat-pulldown':{title:'Seated lat pull-down',view:'Side view · cable',support:'seat',equipment:'lat-pull',start:'Reach upward',finish:'Pull toward upper chest',poses:[pull,pullEnd],cues:['Keep thighs beneath the pad','Pull elbows down beside your torso','Return the bar overhead with control']},
  'cable-pushdown':{title:'Cable triceps pushdown',view:'Side view · cable',equipment:'cable-high',fixedElbows:true,start:'Elbows bent beside your ribs',finish:'Straighten your elbows',poses:[{...standing,elbow:[197,152],hand:[140,130]},{...standing,elbow:[197,152],hand:[179,211]}],cues:['Upper arms stay beside the torso','Move through the elbows','Return without moving the shoulders forward']},
  'hip-thrust':{title:'Bench-supported barbell hip thrust',view:'Side view',support:'hip',equipment:'barbell-hip',fixedShoulder:true,start:'Lower your hips',finish:'Lift hips toward bench height',poses:[thrust,thrustEnd],cues:['Upper back stays on the bench','Keep feet planted','Finish with ribs over the pelvis']},
  'calf-standing':{title:'Standing calf raise',view:'Side view',start:'Heels down',finish:'Rise onto the balls of your feet',poses:[standing,calfEnd],cues:['Use a nearby support for balance','Keep the knees softly extended','Lower heels with control']},
  'calf-seated':{title:'Seated calf raise',view:'Side view · machine',support:'seat',start:'Heels lowered',finish:'Raise your heels',poses:[seated,{...seated,knee:[150,198],ankle:[139,274]}],cues:['Rest the thigh pad above the knees','Keep the balls of your feet supported','Raise and lower the heels without bouncing']},
  'wall-pushup':{title:'Wall push-up',view:'Side view',support:'wall',start:'Arms extended',finish:'Bring your chest toward the wall',poses:[wall,wallEnd],cues:['Hands remain on a solid wall','Move your body as one line','Press away through your hands']},
  'incline-pushup':{title:'Incline push-up',view:'Side view',support:'raised',start:'Arms extended on the support',finish:'Lower chest toward the support',poses:[raised,raisedEnd],cues:['Use a stable, immovable support','Keep hands and toes planted','Move chest and hips together']},
 };
}

// Exact reviewed IDs only; an arbitrary catalog name never selects a similar
// animation with different equipment or contact points.
export const additionalDemoKeys:Record<string,{key:string;equipment:string}>=Object.fromEntries([
 ['goblet-squat','Dumbbells','coach-dumbbell-goblet-squat'],
 ['barbell-squat','Barbell','gym-1810-barbell-squat'],
 ['barbell-rdl','Barbell','coach-barbell-rdl','gym-1305-romanian-deadlift'],
 ['barbell-row','Barbell','gym-1640-bent-over-barbell-row'],
 ['hammer-curl','Dumbbells','coach-hammer-curl','gym-732-hammer-curls'],
 ['bench-dumbbell','Dumbbells','gym-1105-dumbbell-bench-press'],
 ['bench-barbell','Barbell','gym-928-barbell-bench-press-medium-grip'],
 ['incline-dumbbell','Dumbbells','coach-incline-dumbbell-press','gym-1107-incline-dumbbell-bench-press'],
 ['lateral-raise','Dumbbells','gym-2580-dumbbell-lateral-raise'],
 ['leg-extension','Machine','coach-leg-extension','gym-2074-leg-extensions'],
 ['leg-curl','Machine','gym-1351-seated-leg-curl'],
 ['leg-press','Machine','gym-2067-leg-press'],
 ['machine-chest-press','Machine','gym-1054-machine-chest-press'],
 ['machine-row','Machine','gym-1495-machine-seated-row'],
 ['lat-pulldown','Cable','gym-1473-lat-pull-down'],
 ['cable-pushdown','Cable','coach-cable-pushdown','gym-2838-triceps-pushdown'],
 ['hip-thrust','Barbell','gym-1215-barbell-hip-thrust'],
 ['calf-standing','Bodyweight','gym-909-standing-calf-raise'],
 ['calf-seated','Machine','gym-888-seated-calf-raise'],
 ['wall-pushup','Bodyweight','coach-wall-pushup'],
 ['incline-pushup','Bodyweight','gym-961-incline-push-up'],
].flatMap(([key,equipment,...ids])=>ids.map(id=>[id,{key,equipment}])));
