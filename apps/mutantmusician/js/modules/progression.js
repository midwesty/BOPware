import { LIFE_STAGE_MS, LIFE_STAGE_ORDER } from './constants.js';

export function applyStageProgression(musician, now, notifications=[]){
  const age = now - musician.createdAt;
  let nextStage = 'adult';
  for(const stage of LIFE_STAGE_ORDER){
    if(age >= LIFE_STAGE_MS[stage]) nextStage = stage;
  }
  if(nextStage !== musician.stage){
    musician.stage = nextStage;
    notifications.unshift({ type:'stage', text:`${musician.name} has entered the ${nextStage} stage.` });
    if(nextStage==='adult'){
      musician.careerStats.gigXP += 8;
      musician.needs.mood = Math.min(100, musician.needs.mood + 8);
    }
  }
}

export function getStageProgress(musician, now){
  const age = now - musician.createdAt;
  const currentStart = LIFE_STAGE_MS[musician.stage] || 0;
  const idx = LIFE_STAGE_ORDER.indexOf(musician.stage);
  const nextStage = LIFE_STAGE_ORDER[idx + 1];
  if(!nextStage) return { remainingMs:0, nextStage:null };
  const end = LIFE_STAGE_MS[nextStage];
  return { remainingMs: Math.max(0, end - age), nextStage };
}
