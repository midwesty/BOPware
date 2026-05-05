import { BASE_STAT_KEYS } from './constants.js';
import { average, id } from './utils.js';

export function computeBandStats(band, musicians){
  const members = musicians.filter(m=>band.memberIds.includes(m.id) && !m.isDead);
  const avgBase = {};
  BASE_STAT_KEYS.forEach(key=> avgBase[key] = Math.round(average(members.map(m=>m.baseStats[key] || 0))));
  const fame = Math.round(average(members.map(m=>m.careerStats.fame || 0)) + members.length * 4);
  const chemistry = Math.round(average(members.map(m=>m.careerStats.chemistry || 0)) + Math.max(0, members.length - 1) * 5);
  const stress = Math.round(average(members.map(m=>m.careerStats.stress || 0)));
  return {
    memberCount: members.length,
    talent: avgBase.talent || 0,
    technique: avgBase.technique || 0,
    charisma: avgBase.charisma || 0,
    weirdness: avgBase.weirdness || 0,
    discipline: avgBase.discipline || 0,
    originality: avgBase.originality || 0,
    fame,
    chemistry,
    stress,
    power: Math.round((avgBase.talent + avgBase.technique + avgBase.charisma + avgBase.weirdness + chemistry) / 5)
  };
}

export function createBand(name, memberIds=[]){
  return { id:id('band'), name, memberIds, createdAt:Date.now() };
}
