import { getDataStore } from './state.js';

export function computeMutationMods(musician){
  const defs = getDataStore().mutations || [];
  return musician.mutationIds.reduce((acc, id)=>{
    const def = defs.find(t=>t.id===id);
    if(def?.mods){
      Object.entries(def.mods).forEach(([k,v])=>{ acc[k] = (acc[k] || 0) + v; });
    }
    return acc;
  }, {});
}
