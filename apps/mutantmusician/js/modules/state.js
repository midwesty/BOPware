let STATE = null;
let DATA = {};

export function setState(next){ STATE = next; }
export function getState(){ return STATE; }
export function mutateState(fn){ fn(STATE); return STATE; }
export function setDataStore(data){ DATA = data; }
export function getDataStore(){ return DATA; }
