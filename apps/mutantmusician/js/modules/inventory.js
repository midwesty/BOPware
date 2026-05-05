import { getDataStore } from './state.js';
import { applyDirectEffects } from './needs.js';

export function getItemDef(id){ return (getDataStore().items || []).find(x=>x.id===id); }

export function buyItem(state, itemId){
  const item = getItemDef(itemId);
  if(!item) return { ok:false, message:'Unknown item.' };
  if(state.playerProfile.cash < item.cost) return { ok:false, message:'Not enough cash.' };
  state.playerProfile.cash -= item.cost;
  state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
  return { ok:true, message:`Bought ${item.name}.` };
}

export function removeItem(state, itemId, qty=1){
  if((state.inventory[itemId] || 0) < qty) return false;
  state.inventory[itemId] -= qty;
  if(state.inventory[itemId] <= 0) delete state.inventory[itemId];
  return true;
}

export function useItem(state, musician, itemId){
  const item = getItemDef(itemId);
  if(!item) return { ok:false, message:'Unknown item.' };
  if(!removeItem(state, itemId, 1)) return { ok:false, message:'You do not have that item.' };

  if(item.type === 'revive'){
    if(!musician.isDead && !musician.isCritical) return { ok:false, message:'They do not need revival.' };
    musician.isDead = false;
    musician.isCritical = false;
    musician.needs.health = 35;
    musician.needs.food = 30;
    musician.needs.water = 35;
    return { ok:true, message:`${musician.name} shuddered back to life.` };
  }
  if(item.type === 'dna'){
    musician.snapshotDNA = { savedAt: Date.now(), currentRole: musician.currentRole, baseStats:{...musician.baseStats}, careerStats:{...musician.careerStats}, mutationIds:[...musician.mutationIds], traitIds:[...musician.traitIds] };
    return { ok:true, message:`Snapshot DNA captured for ${musician.name}.` };
  }
  if(item.effects){
    applyDirectEffects(musician, { needs: item.effects });
  }
  return { ok:true, message:`Used ${item.name} on ${musician.name}.` };
}
