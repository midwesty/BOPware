export const DATA_FILES = [
  'creationOptions',
  'genres',
  'roles',
  'vices',
  'traits',
  'mutations',
  'items',
  'gigs',
  'events',
  'names',
  'audioMap',
  'uiText'
];

export const CARE_ACTIONS = {
  feed: { needs: { food: 24, mood: 3, health: 2 }, cash: -4 },
  water: { needs: { water: 28, health: 1 }, cash: -2 },
  rest: { needs: { rest: 24, mood: 2, stress: -8 }, cash: 0 },
  clean: { needs: { cleanliness: 28, mood: 2, health: 1 }, cash: -3 },
  vice: { needs: { vice: 24, mood: 6, health: -3 }, cash: -5 }
};

export const NEED_KEYS = ['food','water','rest','mood','inspiration','vice','cleanliness','health'];
export const BASE_STAT_KEYS = ['talent','technique','originality','discipline','ego','charisma','weirdness','resilience'];
export const CAREER_STAT_KEYS = ['fame','hipness','fanbase','gigXP','stress','chemistry'];

export const LIFE_STAGE_ORDER = ['embryo','infant','child','teen','adult'];
export const LIFE_STAGE_MS = {
  embryo: 0,
  infant: 12 * 60 * 60 * 1000,
  child: 30 * 60 * 60 * 1000,
  teen: 52 * 60 * 60 * 1000,
  adult: 72 * 60 * 60 * 1000
};

export const MAX_SAVE_SLOTS = 5;
export const STORAGE_PREFIX = 'mutant_musician_lab_v2';
