import { getState } from './state.js';

export function getNow(){
  return getState().clockState.now || Date.now();
}

export function applyElapsedTime(){
  const state = getState();
  const now = Date.now();
  const last = state.clockState.lastSavedAt || now;
  state.clockState.now = now;
  state.clockState.elapsedMs = Math.max(0, now - last);
}

export function tickClock(){
  const state = getState();
  if(state.clockState.freezeTime) return state.clockState.now;
  state.clockState.now = (state.clockState.now || Date.now()) + (1000 * (state.clockState.speedMultiplier || 1));
  return state.clockState.now;
}
