import { MAX_SAVE_SLOTS, STORAGE_PREFIX } from './constants.js';
import { id } from './utils.js';

function defaultLocations(){
  return [{
    id:'shared_room',
    name:'Shared Room',
    type:'shared_room',
    tier:1,
    moodBonus:0,
    decayReduction:0,
    unlocked:true,
    installedUpgradeIds:[]
  }];
}

export function getDefaultState(){
  return {
    playerProfile:{
      selectedMusicianId:null,
      starterChosen:false,
      cash:180,
      activeSaveSlot:1,
      labName:'Mutant Musician Lab'
    },
    musicians:[],
    dnaArchive:[],
    inventory:{
      snack_bricks:4,
      clean_wipes:3,
      revival_capsule:1,
      dna_snapshot_vial:0,
      black_market_spores:1,
      cheap_strings:2
    },
    labUpgrades:{
      snapshotUnlocked:false,
      automationTier:0,
      roomTier:1,
      studioPolish:0,
      saveSlotCount:MAX_SAVE_SLOTS
    },
    locations:defaultLocations(),
    bands:[],
    gigBoard:[],
    notifications:[],
    settings:{
      audioEnabled:true,
      fastTickSeconds:10,
      reduceMotion:false
    },
    clockState:{
      now:Date.now(),
      lastSavedAt:Date.now(),
      elapsedMs:0,
      speedMultiplier:1,
      freezeTime:false
    },
    battleExports:[],
    meta:{ version:2, seed:id('save') }
  };
}

export function getSlotKey(slot){ return `${STORAGE_PREFIX}_slot_${slot}`; }

export function loadSave(slot=1){
  const raw = localStorage.getItem(getSlotKey(slot));
  if(!raw){
    const state = getDefaultState();
    state.playerProfile.activeSaveSlot = slot;
    return state;
  }
  try{
    const parsed = JSON.parse(raw);
    const merged = { ...getDefaultState(), ...parsed };
    merged.playerProfile = { ...getDefaultState().playerProfile, ...(parsed.playerProfile||{}) , activeSaveSlot: slot };
    merged.settings = { ...getDefaultState().settings, ...(parsed.settings||{}) };
    merged.clockState = { ...getDefaultState().clockState, ...(parsed.clockState||{}) };
    merged.labUpgrades = { ...getDefaultState().labUpgrades, ...(parsed.labUpgrades||{}) };
    merged.locations = parsed.locations || defaultLocations();
    merged.bands = parsed.bands || [];
    merged.meta = { ...getDefaultState().meta, ...(parsed.meta||{}) };
    return merged;
  }catch{
    const state = getDefaultState();
    state.playerProfile.activeSaveSlot = slot;
    return state;
  }
}

export function saveState(state, slot=state.playerProfile.activeSaveSlot || 1){
  localStorage.setItem(getSlotKey(slot), JSON.stringify(state));
}

export function clearSave(slot=1){
  localStorage.removeItem(getSlotKey(slot));
}

export function listSaveSlots(){
  const slots=[];
  for(let i=1;i<=MAX_SAVE_SLOTS;i++){
    const raw = localStorage.getItem(getSlotKey(i));
    if(!raw){
      slots.push({ slot:i, exists:false, label:'Empty Slot' });
      continue;
    }
    try{
      const parsed = JSON.parse(raw);
      slots.push({
        slot:i,
        exists:true,
        label:parsed.playerProfile?.labName || 'Mutant Musician Lab',
        cash:parsed.playerProfile?.cash || 0,
        musicians:(parsed.musicians||[]).length,
        updatedAt:parsed.clockState?.lastSavedAt || 0
      });
    }catch{
      slots.push({ slot:i, exists:true, label:'Unreadable Save' });
    }
  }
  return slots;
}
