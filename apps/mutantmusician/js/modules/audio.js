import { getDataStore, getState } from './state.js';

let ctx;
function beep(freq=440, dur=0.05){
  try{
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = freq;
    g.gain.value = 0.03;
    o.start();
    o.stop(ctx.currentTime + dur);
  }catch{}
}

export function playSound(key='uiClick'){
  const state = getState();
  if(!state?.settings?.audioEnabled) return;
  const freqMap = { uiClick:440, good:560, bad:220, warn:330, gigStart:520, battle:300, event:390, mutation:610 };
  const audioMap = getDataStore().audioMap || {};
  const file = audioMap[key];
  if(file){
    const a = new Audio(file);
    a.volume = 0.3;
    a.play().catch(()=>beep(freqMap[key] || 440));
  } else {
    beep(freqMap[key] || 440);
  }
}
