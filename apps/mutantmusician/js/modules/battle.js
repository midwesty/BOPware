import { computeTraitMods } from './traits.js';
import { computeMutationMods } from './mutations.js';
import { safeJsonParse } from './utils.js';

function powerFor(m){
  const trait = computeTraitMods(m);
  const mut = computeMutationMods(m);
  const stats = m.baseStats || m.stats || {};
  const career = m.careerStats || {};
  return (stats.talent || 0) + (stats.technique || 0) + (stats.charisma || 0) + (stats.weirdness || 0) + (career.fame || 0) * 0.4 + (trait.battle || 0) + (mut.battle || 0);
}

export function buildBattleExport(musician){
  return {
    name: musician.name,
    stage: musician.stage,
    role: musician.currentRole,
    genreId: musician.genreId,
    stats: musician.baseStats,
    careerStats: musician.careerStats,
    mutationIds: musician.mutationIds,
    traitIds: musician.traitIds,
    signatureMove: `${musician.currentRole} meltdown`
  };
}

export function parseBattleImport(text){
  const parsed = safeJsonParse(text);
  if(!parsed || !parsed.name || !parsed.stats) return { ok:false, message:'Invalid battle JSON.' };
  return { ok:true, data:parsed };
}

export function runBattle(player, opponent){
  const rounds=[];
  let playerScore = powerFor(player);
  let oppScore = powerFor(opponent);
  for(let i=1;i<=3;i++){
    const p = playerScore + Math.random()*12;
    const o = oppScore + Math.random()*12;
    rounds.push(`Round ${i}: ${player.name} ${p >= o ? 'overwhelms' : 'stumbles before'} ${opponent.name}.`);
    if(p >= o) playerScore += 2; else oppScore += 2;
  }
  const winner = playerScore >= oppScore ? player.name : opponent.name;
  return {
    title:`Battle Result: ${winner}`,
    winner,
    summary:`${winner} won the music battle after three ugly rounds of ego, noise, and stage panic.`,
    rounds
  };
}
