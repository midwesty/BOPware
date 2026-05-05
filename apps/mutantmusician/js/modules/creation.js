import { getDataStore } from './state.js';

export function getCreationCatalog(){
  return getDataStore().creationOptions;
}

export function getStarterKits(){
  return getDataStore().creationOptions.starterKits || [];
}

export function getDefaultChoicesFromStarter(kitId){
  const kit = getStarterKits().find(k=>k.id===kitId);
  return { ...kit?.choices };
}
