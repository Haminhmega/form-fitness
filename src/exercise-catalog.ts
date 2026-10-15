import rawCatalog from './data/gym-exercises.json';
import type {Exercise} from './types';

export const gymExerciseCatalog=rawCatalog as Exercise[];
export const gymExerciseCatalogSource={
  title:'Gym Exercise Dataset',
  url:'https://www.kaggle.com/datasets/niharika41298/gym-exercise-data',
  license:'CC0: Public Domain',
  importedRecords:gymExerciseCatalog.length,
} as const;
