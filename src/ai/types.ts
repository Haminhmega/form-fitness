/** Clip timestamps are seconds; landmarks use normalized image coordinates. */
export interface PosePoint { x: number; y: number; z: number; visibility: number; presence?: number }
/** worldLandmarks are optional model-inferred meter coordinates, grouped by
 * detected person. They are preserved separately from normalized image poses. */
export interface PoseFrame { time: number; poses: PosePoint[][]; worldLandmarks?: PosePoint[][] }
export interface AnalysisInput { frames: PoseFrame[]; duration: number; width: number; height: number; sampleRate: number }
export interface AnalyzedFrame { time: number; landmarks: PosePoint[]; worldLandmarks?: PosePoint[]; valid: boolean; angle: number | null; reason?: string }
export interface SquatRep { index: number; start: number; bottom: number; end: number; descentSeconds: number; ascentSeconds: number; rangeDegrees: number; minKneeAngle: number; side: 'left' | 'right' }
export interface MovementObservation { id: string; title: string; detail: string; repIndexes: number[]; time?: number; tone: 'neutral' | 'notice' }
export interface SquatAnalysis { status: 'assessed' | 'partial' | 'unable'; reps: SquatRep[]; frames: AnalyzedFrame[]; duration: number; validFraction: number; issues: string[]; observations: MovementObservation[]; metricLabel?: string; phaseLabels?: [string,string]; holdSeconds?:number }
export interface AnalysisProgress { phase: 'model' | 'frames' | 'analysis'; completed: number; total: number }
export interface AnalyzeVideoOptions { signal: AbortSignal; onProgress: (progress: AnalysisProgress) => void }
