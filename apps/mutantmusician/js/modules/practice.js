import { clamp } from './utils.js';

export function runPractice(primary, partner=null){
  const gain = partner ? 4 : 2;
  primary.baseStats.technique = clamp(primary.baseStats.technique + gain, 0, 99);
  primary.baseStats.discipline = clamp(primary.baseStats.discipline + 2, 0, 99);
  primary.needs.rest = clamp(primary.needs.rest - 6, 0, 100);
  primary.needs.inspiration = clamp(primary.needs.inspiration + 5, 0, 100);
  primary.careerStats.chemistry = clamp((primary.careerStats.chemistry || 0) + (partner ? 6 : 2), 0, 100);
  if(partner){
    partner.baseStats.technique = clamp(partner.baseStats.technique + 3, 0, 99);
    partner.careerStats.chemistry = clamp((partner.careerStats.chemistry || 0) + 5, 0, 100);
  }
  return { summary: partner ? `${primary.name} and ${partner.name} rehearsed together.` : `${primary.name} practiced alone and got slightly tighter.` };
}
