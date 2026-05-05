import { DATA_FILES, CARE_ACTIONS } from './modules/constants.js';
import { setDataStore, setState, getState, mutateState, getDataStore } from './modules/state.js';
import { loadSave, saveState, clearSave } from './modules/saveLoad.js';
import { applyElapsedTime, tickClock, getNow } from './modules/clock.js';
import { renderApp, getSelectedMusician } from './modules/render.js';
import { bindGlobalUI, registerUIHandlers, showToast, openStarterModal, openCreationModal, openRosterModal, openInfoModal, openInventoryModal, openShopModal, openGigsModal, openAssignGigModal, openDNAModal, openBattleModal, openPracticeModal, openCheatsModal, openSettingsModal, promptRoleChange, closeModal, openModal, openBandsModal, openStudioModal } from './modules/ui.js';
import { playSound } from './modules/audio.js';
import { getStarterKits, getDefaultChoicesFromStarter, getCreationCatalog } from './modules/creation.js';
import { createMusicianFromChoices, createMusicianFromDNAArchive } from './modules/musicianFactory.js';
import { applyStageProgression } from './modules/progression.js';
import { applyNeedDecay, applyDirectEffects } from './modules/needs.js';
import { maybeTriggerRandomEvent } from './modules/events.js';
import { buyItem, useItem, getItemDef, removeItem } from './modules/inventory.js';
import { refreshGigBoard, assignGig, resolveFinishedGigs } from './modules/gigs.js';
import { buildBattleExport, parseBattleImport, runBattle } from './modules/battle.js';
import { runPractice } from './modules/practice.js';
import { runCheat } from './modules/cheats.js';
import { spliceDNA } from './modules/genetics.js';
import { createBand } from './modules/bands.js';

async function boot(){
  const data = {};
  for (const name of DATA_FILES){
    const res = await fetch(`./data/${name}.json`);
    data[name] = await res.json();
  }
  setDataStore(data);
  setState(loadSave(1));
  applyElapsedTime();
  simulateElapsed();
  refreshGigBoard(getState(), getNow());
  ensureDNAArchive();
  bindGlobalUI();
  registerUIHandlers({
    handleAction,
    handleModalAction,
    getItemType:(id)=>getItemDef(id)?.type,
    getItemName:(id)=>getItemDef(id)?.name,
    getBattleExport:(m)=>JSON.stringify(buildBattleExport(m), null, 2)
  });
  render();
  if(!getState().playerProfile.starterChosen) openStarterModal(getStarterKits());
  startLoop();
}
boot();

function startLoop(){
  setInterval(()=>{
    tickClock();
    simulateTick(getState().clockState.freezeTime ? 0 : 1000*(getState().clockState.speedMultiplier||1));
    render();
  }, 1000);
  setInterval(()=>save(), Math.max(5000, getState().settings.fastTickSeconds * 1000));
}

function simulateElapsed(){
  const elapsed = getState().clockState.elapsedMs || 0;
  simulateTick(elapsed);
}

function simulateTick(elapsedMs){
  const state = getState();
  const now = getNow();
  state.musicians.forEach(m=>{
    applyNeedDecay(m, elapsedMs, state.labUpgrades);
    applyStageProgression(m, now, state.notifications);
    const evt = maybeTriggerRandomEvent(m, state, now);
    if(evt) state.notifications.unshift(evt);
    if(m.isDead) archiveMusician(m, true);
  });
  const gigResults = resolveFinishedGigs(state, now);
  if(gigResults.length) state.notifications.unshift(...gigResults);
  refreshGigBoard(state, now);
  trimNotifications();
  ensureSelection();
  save();
}

function ensureDNAArchive(){
  const state=getState();
  state.musicians.forEach(m=>archiveMusician(m, true));
}

function archiveMusician(m, silent=false){
  const state=getState();
  const existing = state.dnaArchive.find(d=>d.dnaId===m.dnaId);
  if(!existing){
    state.dnaArchive.unshift({
      dnaId:m.dnaId,
      name:m.name,
      creationChoices:{...m.creationChoices},
      preferredRole:m.preferredRole,
      genreId:m.genreId,
      viceId:m.viceId,
      lineage:m.lineage||[],
      generation:m.generation||1,
      baseStats:{...m.baseStats},
      vectors:{...m.vectors},
      mutationIds:[...m.mutationIds],
      snapshotDNA:m.snapshotDNA || null
    });
    if(!silent) showToast(`${m.name} added to DNA archive.`, 'warn');
  } else {
    existing.name = m.name;
    existing.lineage = [...(m.lineage || [])];
    existing.generation = m.generation || existing.generation || 1;
    existing.snapshotDNA = m.snapshotDNA || existing.snapshotDNA || null;
    existing.mutationIds = [...m.mutationIds];
    existing.baseStats = {...m.baseStats};
  }
}

function ensureSelection(){
  const state=getState();
  if(!state.musicians.length){ state.playerProfile.selectedMusicianId = null; return; }
  if(!state.musicians.some(m=>m.id===state.playerProfile.selectedMusicianId)){
    state.playerProfile.selectedMusicianId = state.musicians[0].id;
  }
}

function trimNotifications(){
  const state=getState();
  state.notifications = state.notifications.slice(0, 40);
}

function render(){
  renderApp(getState(), getDataStore());
}

function save(slot = getState().playerProfile.activeSaveSlot){
  mutateState(s=>{ s.clockState.lastSavedAt = Date.now(); });
  saveState(getState(), slot);
}

function switchSlot(slot){
  setState(loadSave(slot));
  applyElapsedTime();
  simulateElapsed();
  refreshGigBoard(getState(), getNow());
  ensureDNAArchive();
  render();
}

function handleAction(action){
  const state=getState();
  const selected=getSelectedMusician(state);
  playSound('uiClick');
  if(['feed','water','rest','clean','vice'].includes(action)){
    if(!selected) return showToast('No musician selected.', 'bad');
    if(selected.isDead) return showToast('That musician is dead.', 'bad');
    if(selected.isFrozen) return showToast('Thaw them first.', 'bad');
    applyDirectEffects(selected, CARE_ACTIONS[action]);
    state.playerProfile.cash = Math.max(0, state.playerProfile.cash + (CARE_ACTIONS[action].cash || 0));
    showToast(`${selected.name} received ${action}.`);
  } else if(action==='practiceAction'){
    if(!selected) return showToast('No musician selected.', 'bad');
    const out=runPractice(selected);
    showToast(out.summary);
  } else if(action==='openLab'){
    openCreationModal(getCreationCatalog(), state.inventory, state.dnaArchive);
  } else if(action==='openRoster'){
    openRosterModal(state, getDataStore());
  } else if(action==='openInfo'){
    openInfoModal(selected, getDataStore());
  } else if(action==='inventory'){
    openInventoryModal(state, getDataStore(), selected);
  } else if(action==='openShop'){
    openShopModal(state, getDataStore());
  } else if(action==='openGigs'){
    openGigsModal(state, getDataStore());
  } else if(action==='openDNA'){
    openDNAModal(state, getDataStore());
  } else if(action==='openBattle'){
    openBattleModal(state, getDataStore(), selected);
  } else if(action==='openCheats'){
    openCheatsModal();
  } else if(action==='openBands'){
    openBandsModal(state);
  } else if(action==='openStudio'){
    openStudioModal(state);
  } else if(action==='freezeToggle'){
    if(!selected) return showToast('No musician selected.', 'bad');
    selected.isFrozen = !selected.isFrozen;
    showToast(`${selected.name} is now ${selected.isFrozen ? 'frozen' : 'thawed'}.`, 'warn');
  } else if(action==='cloneSelected'){
    if(!selected) return showToast('No musician selected.', 'bad');
    archiveMusician(selected, true);
    const rec=state.dnaArchive.find(d=>d.dnaId===selected.dnaId);
    const clone=createMusicianFromDNAArchive(rec);
    state.musicians.push(clone);
    state.playerProfile.selectedMusicianId = clone.id;
    showToast(`${clone.name} begins as a rebirth clone.`, 'good');
  } else if(action==='openSettings'){
    openSettingsModal(state);
  }
  ensureDNAArchive();
  render();
  save();
}

function handleModalAction(action, btn){
  const state=getState();
  const selected=getSelectedMusician(state);
  if(action==='createStarterBatch'){
    const picks = [...document.querySelectorAll('input[name="starterKit"]:checked')].slice(0,3).map(el=>el.value);
    if(!picks.length) return showToast('Choose at least one starter kit.', 'bad');
    picks.forEach(kitId=>{
      const choices=getDefaultChoicesFromStarter(kitId);
      const musician=createMusicianFromChoices(choices, 'starter_kit');
      state.musicians.push(musician);
      archiveMusician(musician, true);
    });
    state.playerProfile.selectedMusicianId = state.musicians[0]?.id || null;
    state.playerProfile.starterChosen = true;
    closeModal();
    showToast(`Starter set incubated: ${picks.length} embryo${picks.length>1?'s':''}.`);
  }
  else if(action==='createEmbryo'){
    const form=document.getElementById('creationForm');
    const formData=new FormData(form);
    const choices=Object.fromEntries([...formData.entries()].filter(([k])=>['biomass','body','neural','genre','vice','catalyst','role'].includes(k)));
    const bonusItemId=formData.get('bonusItem');
    let bonusItems=[];
    if(bonusItemId){ const item=getItemDef(bonusItemId); if(item && removeItem(state, bonusItemId, 1)) bonusItems=[item]; }
    const spliceA = state.dnaArchive.find(d=>d.dnaId===formData.get('spliceA'));
    const spliceB = state.dnaArchive.find(d=>d.dnaId===formData.get('spliceB'));
    let extras={ bonusItems };
    if(spliceA && spliceB){
      const splice = spliceDNA(spliceA, spliceB);
      choices.genre = splice.genre || choices.genre;
      choices.role = splice.role || choices.role;
      extras.generation = Math.max(spliceA.generation||1, spliceB.generation||1) + 1;
      extras.lineage = [spliceA.name, spliceB.name];
      bonusItems = bonusItems.concat([{ effects: splice.stats }]);
      extras.bonusItems = bonusItems;
    }
    const musician=createMusicianFromChoices(choices, 'lab_custom', extras);
    state.musicians.push(musician);
    state.playerProfile.selectedMusicianId = musician.id;
    archiveMusician(musician, true);
    closeModal();
    showToast(`${musician.name} bubbles to life.`, 'good');
  }
  else if(action==='selectMusician'){
    state.playerProfile.selectedMusicianId = btn.dataset.musicianId;
    closeModal();
  }
  else if(action==='toggleFreezeRoster'){
    const m=state.musicians.find(x=>x.id===btn.dataset.musicianId); if(m){ m.isFrozen=!m.isFrozen; showToast(`${m.name} ${m.isFrozen?'frozen':'thawed'}.`, 'warn'); }
    openRosterModal(state, getDataStore());
  }
  else if(action==='snapshotDNA'){
    const m=state.musicians.find(x=>x.id===btn.dataset.musicianId); if(!m) return;
    if(!state.labUpgrades.snapshotUnlocked && !removeItem(state, 'dna_snapshot_vial', 1)) return showToast('You need a DNA Snapshot Vial from the shop.', 'bad');
    m.snapshotDNA = { savedAt: getNow(), currentRole:m.currentRole, baseStats:{...m.baseStats}, careerStats:{...m.careerStats}, mutationIds:[...m.mutationIds], traitIds:[...m.traitIds] };
    archiveMusician(m, true);
    showToast(`Snapshot DNA saved for ${m.name}.`, 'good');
    openRosterModal(state, getDataStore());
  }
  else if(action==='setRole'){
    const m=state.musicians.find(x=>x.id===btn.dataset.musicianId); if(m) promptRoleChange(m, getDataStore().roles);
  }
  else if(action==='applyRoleChange'){
    const m=state.musicians.find(x=>x.id===btn.dataset.musicianId); if(m){ m.currentRole = btn.dataset.roleId; showToast(`${m.name} now assigned as ${btn.dataset.roleId}.`); closeModal(); }
  }
  else if(action==='buyItem'){
    const out=buyItem(state, btn.dataset.itemId);
    showToast(out.message, out.ok?'good':'bad');
    openShopModal(state, getDataStore());
  }
  else if(action==='useItem'){
    if(!selected) return showToast('No selected musician.', 'bad');
    const out=useItem(state, selected, btn.dataset.itemId);
    showToast(out.message, out.ok?'good':'bad');
    openInventoryModal(state, getDataStore(), selected);
  }
  else if(action==='assignGigPrompt'){
    openAssignGigModal(state, getDataStore(), btn.dataset.gigBoardId);
  }
  else if(action==='assignGig'){
    let target = null;
    if(btn.dataset.bandId) target = state.bands.find(x=>x.id===btn.dataset.bandId);
    else target = state.musicians.find(x=>x.id===btn.dataset.musicianId);
    const out=assignGig(state, target, btn.dataset.gigBoardId, getNow());
    showToast(out.message, out.ok?'good':'bad'); if(out.ok) playSound('gigStart'); openGigsModal(state, getDataStore());
  }
  else if(action==='rebirthFromDNA'){
    const rec=state.dnaArchive.find(d=>d.dnaId===btn.dataset.dnaId); if(!rec) return;
    const clone=createMusicianFromDNAArchive(rec); state.musicians.push(clone); state.playerProfile.selectedMusicianId = clone.id; archiveMusician(clone, true);
    showToast(`${clone.name} started from archive DNA.`, 'good'); openDNAModal(state, getDataStore());
  }
  else if(action==='copyBattleExport'){
    const box=document.getElementById('battleExportBox'); box.select(); document.execCommand('copy'); showToast('Battle export copied.');
  }
  else if(action==='runBattleImport'){
    if(!selected) return showToast('Select a musician first.', 'bad');
    const text=document.getElementById('battleImportBox').value.trim(); const parsed=parseBattleImport(text); if(!parsed.ok) return showToast(parsed.message,'bad');
    const result=runBattle(selected, parsed.data); selected.careerStats.gigXP += result.winner===selected.name ? 10 : 4; selected.needs.rest=Math.max(0, selected.needs.rest-8); selected.needs.mood=Math.max(0, selected.needs.mood + (result.winner===selected.name ? 6 : -4));
    openModal(result.title, `<div class="battle-card"><strong>Winner: ${result.winner}</strong><div class="small">${result.summary}</div><div class="code-box">${result.rounds.join('\n')}</div></div>`, `<button data-close-modal>Close</button>`);
    playSound('battle');
  }
  else if(action==='practicePrompt'){
    if(!selected) return showToast('Select a musician first.', 'bad');
    openPracticeModal(state, selected);
  }
  else if(action==='runPracticePair'){
    if(!selected) return showToast('Select a musician first.', 'bad');
    const partner=state.musicians.find(x=>x.id===btn.dataset.musicianId); const out=runPractice(selected, partner); showToast(out.summary); closeModal();
  }
  else if(action==='runCheat'){
    const msg=runCheat(state, btn.dataset.cheatCode, selected); showToast(msg, 'warn'); openCheatsModal();
  }
  else if(action==='createBand'){
    const form = document.getElementById('bandForm');
    const formData = new FormData(form);
    const name = String(formData.get('bandName') || '').trim();
    const memberIds = [...document.querySelectorAll('input[name="bandMember"]:checked')].map(el=>el.value);
    if(!name) return showToast('Give the band a name.', 'bad');
    if(memberIds.length < 2) return showToast('Pick at least two members.', 'bad');
    state.bands.push(createBand(name, memberIds));
    showToast(`Band created: ${name}.`, 'good');
    openBandsModal(state);
  }
  else if(action==='deleteBand'){
    state.bands = state.bands.filter(b=>b.id !== btn.dataset.bandId);
    showToast('Band deleted.', 'warn');
    openBandsModal(state);
  }
  else if(action==='buyStudioUpgrade'){
    const upgrade = btn.dataset.upgradeId;
    if(upgrade === 'roomTier'){
      const cost = 120 * state.labUpgrades.roomTier;
      if(state.playerProfile.cash < cost) return showToast('Not enough cash.', 'bad');
      state.playerProfile.cash -= cost;
      state.labUpgrades.roomTier += 1;
      showToast(`Shared room upgraded to tier ${state.labUpgrades.roomTier}.`, 'good');
    } else if(upgrade === 'snapshotUnlocked'){
      if(state.labUpgrades.snapshotUnlocked) return showToast('Snapshot station already installed.', 'warn');
      if(state.playerProfile.cash < 200) return showToast('Not enough cash.', 'bad');
      state.playerProfile.cash -= 200;
      state.labUpgrades.snapshotUnlocked = true;
      showToast('Snapshot station installed.', 'good');
    } else if(upgrade === 'studioPolish'){
      const cost = 90 + (state.labUpgrades.studioPolish * 60);
      if(state.playerProfile.cash < cost) return showToast('Not enough cash.', 'bad');
      state.playerProfile.cash -= cost;
      state.labUpgrades.studioPolish += 1;
      state.musicians.forEach(m=>{ m.needs.mood = Math.min(100, m.needs.mood + 6); });
      showToast('Shared room mood lighting upgraded.', 'good');
    }
    openStudioModal(state);
  }
  else if(action==='saveSettings'){
    state.settings.audioEnabled = document.getElementById('audioToggle').checked;
    const motionToggle = document.getElementById('motionToggle');
    state.settings.reduceMotion = motionToggle ? motionToggle.checked : false;
    showToast('Settings saved.');
    closeModal();
  }
  else if(action==='hardSave'){
    save(); showToast('Saved.');
  }
  else if(action==='loadSaveSlot'){
    switchSlot(Number(btn.dataset.slotId));
    closeModal();
    if(!getState().playerProfile.starterChosen) openStarterModal(getStarterKits());
    showToast(`Loaded save slot ${btn.dataset.slotId}.`, 'good');
  }
  else if(action==='overwriteSaveSlot'){
    const slot = Number(btn.dataset.slotId);
    state.playerProfile.activeSaveSlot = slot;
    save(slot);
    openSettingsModal(state);
    showToast(`Saved current game to slot ${slot}.`, 'good');
  }
  else if(action==='deleteSaveSlot'){
    const slot = Number(btn.dataset.slotId);
    clearSave(slot);
    openSettingsModal(state);
    showToast(`Deleted slot ${slot}.`, 'warn');
  }
  else if(action==='wipeSave'){
    clearSave(state.playerProfile.activeSaveSlot || 1);
    location.reload();
  }
  ensureDNAArchive();
  render();
  save();
}
