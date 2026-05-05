import { NEED_KEYS } from './constants.js';
import { createMusicianFromChoices } from './musicianFactory.js';
import { getDataStore } from './state.js';

export function runCheat(state, code, selected){
  if(code === 'cash') { state.playerProfile.cash += 500; return 'Added $500.'; }
  if(code === 'maxNeeds' && selected){ NEED_KEYS.forEach(k=>selected.needs[k]=100); return `${selected.name} is stabilized.`; }
  if(code === 'heal' && selected){ selected.needs.health = 100; selected.isDead = false; selected.isCritical = false; return `${selected.name} patched up.`; }
  if(code === 'ageUp' && selected){ selected.createdAt -= 18 * 60 * 60 * 1000; return `${selected.name} pushed forward in time.`; }
  if(code === 'adult' && selected){ selected.createdAt = Date.now() - (73 * 60 * 60 * 1000); return `${selected.name} forced to adulthood.`; }
  if(code === 'freezeTime'){ state.clockState.freezeTime = !state.clockState.freezeTime; return `Freeze time: ${state.clockState.freezeTime ? 'on' : 'off'}.`; }
  if(code === 'speedTime'){ state.clockState.speedMultiplier = state.clockState.speedMultiplier === 1 ? 8 : 1; return `Speed multiplier set to ${state.clockState.speedMultiplier}x.`; }
  if(code === 'spawn'){ const c=getDataStore().creationOptions; const mus=createMusicianFromChoices({ biomass:c.biomassOptions[0].id, body:c.bodyOptions[0].id, neural:c.neuralOptions[0].id, genre:c.genreOptions[0].id, vice:c.viceOptions[0].id, catalyst:c.catalystOptions[0].id, role:c.roleOptions[0].id }, 'cheat_spawn'); state.musicians.push(mus); state.playerProfile.selectedMusicianId = mus.id; return `${mus.name} spawned.`; }
  if(code === 'unlockSnapshot'){ state.labUpgrades.snapshotUnlocked = true; return 'Snapshot station permanently unlocked.'; }
  return 'Cheat executed.';
}
