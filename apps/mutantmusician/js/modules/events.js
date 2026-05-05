import { getDataStore } from './state.js';
import { chance, pick } from './utils.js';

export function maybeTriggerRandomEvent(musician, state, now){
  if(musician.isDead || musician.isFrozen) return null;
  const hoursSince = (now - (musician.timers.lastEventAt || 0)) / (1000 * 60 * 60);
  const baseChance = Math.min(0.25, hoursSince * 0.04);
  if(!chance(baseChance)) return null;
  const pool = (getDataStore().events || []).filter(e => !e.stage || e.stage.includes(musician.stage));
  const evt = pick(pool);
  if(!evt) return null;
  musician.timers.lastEventAt = now;
  Object.entries(evt.effects || {}).forEach(([key,val])=>{
    if(musician.needs[key] != null) musician.needs[key] = Math.max(0, Math.min(100, musician.needs[key] + val));
    else if(musician.careerStats[key] != null) musician.careerStats[key] = Math.max(0, Math.min(100, musician.careerStats[key] + val));
  });
  if(evt.addTrait && !musician.traitIds.includes(evt.addTrait)) musician.traitIds.push(evt.addTrait);
  return { type:'event', text:`${musician.name}: ${evt.text}` };
}
