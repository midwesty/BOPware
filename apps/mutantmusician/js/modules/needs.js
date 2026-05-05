import { NEED_KEYS } from './constants.js';
import { clamp } from './utils.js';

const HOURLY_DECAY = {
  food: 5,
  water: 5.2,
  rest: 4.3,
  mood: 2.2,
  inspiration: 2.0,
  vice: 4.1,
  cleanliness: 3.1,
  health: 0.35
};

function getDecayMultiplier(musician, labUpgrades){
  let multiplier = musician.isFrozen ? 0 : 1;
  multiplier -= (labUpgrades.roomTier - 1) * 0.04;
  return Math.max(0, multiplier);
}

export function applyNeedDecay(musician, elapsedMs, labUpgrades){
  if(musician.isDead || musician.isFrozen) return;
  const hours = elapsedMs / (1000 * 60 * 60);
  const decayMultiplier = getDecayMultiplier(musician, labUpgrades);
  NEED_KEYS.forEach(key=>{
    const loss = (HOURLY_DECAY[key] || 0) * hours * decayMultiplier;
    musician.needs[key] = clamp(musician.needs[key] - loss, 0, 100);
  });
  if(musician.stage === 'embryo') musician.needs.cleanliness = clamp(musician.needs.cleanliness - hours, 0, 100);
  if(musician.stage === 'teen' || musician.stage === 'adult') musician.careerStats.stress = clamp((musician.careerStats.stress || 0) + hours * 1.4, 0, 100);
  const lowCount = NEED_KEYS.filter(key=>musician.needs[key] <= 15).length;
  musician.isCritical = lowCount >= 2 || musician.needs.health <= 15;
  if(musician.isCritical) musician.needs.health = clamp(musician.needs.health - (hours * 2.5), 0, 100);
  if(musician.needs.health <= 0){
    musician.isDead = true;
    musician.isCritical = false;
  }
}

export function applyDirectEffects(musician, action){
  Object.entries(action.needs || {}).forEach(([key,val])=>{
    if(key === 'stress'){
      musician.careerStats.stress = clamp((musician.careerStats.stress || 0) + val, 0, 100);
    } else {
      musician.needs[key] = clamp((musician.needs[key] || 0) + val, 0, 100);
    }
  });
}
