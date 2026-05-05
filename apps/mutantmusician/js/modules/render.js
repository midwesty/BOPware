import { NEED_KEYS } from './constants.js';
import { titleCase, formatMoney, formatClock } from './utils.js';
import { getStageProgress } from './progression.js';
import { getDataStore } from './state.js';

export function getSelectedMusician(state){
  return state.musicians.find(m=>m.id===state.playerProfile.selectedMusicianId) || state.musicians[0] || null;
}

function meterClass(value){
  if(value <= 25) return 'meter-card meter-low';
  if(value <= 55) return 'meter-card meter-mid';
  return 'meter-card';
}

export function renderApp(state){
  const selected = getSelectedMusician(state);
  document.getElementById('cashValue').textContent = formatMoney(state.playerProfile.cash);
  document.getElementById('clockValue').textContent = formatClock(new Date(state.clockState.now));
  document.getElementById('alertCount').textContent = String(state.notifications.length);
  document.getElementById('saveSlotLabel').textContent = String(state.playerProfile.activeSaveSlot || 1);

  const selectedName = document.getElementById('selectedName');
  const selectedMeta = document.getElementById('selectedMeta');
  const eventTicker = document.getElementById('eventTicker');
  const overlay = document.getElementById('statusOverlay');
  const scene = document.getElementById('musicianScene');
  const sprite = document.getElementById('musicianSprite');
  const needMeters = document.getElementById('needMeters');
  const statusCards = document.getElementById('statusCards');

  if(!selected){
    selectedName.textContent = 'No Active Musician';
    selectedMeta.textContent = 'Open the lab to create one.';
    needMeters.innerHTML = '';
    statusCards.innerHTML = '';
    overlay.classList.add('hidden');
    return;
  }

  const prog = getStageProgress(selected, state.clockState.now);
  const roleLabel = titleCase(selected.currentRole);
  const genreLabel = (getDataStore().genres || []).find(g=>g.id===selected.genreId)?.name || titleCase(selected.genreId);
  const viceLabel = (getDataStore().vices || []).find(v=>v.id===selected.viceId)?.name || titleCase(selected.viceId);
  selectedName.textContent = selected.name;
  selectedMeta.textContent = `${titleCase(selected.stage)} • ${genreLabel} • ${roleLabel} • ${viceLabel}${prog.nextStage ? ` • ${prog.nextStage} in ${Math.ceil(prog.remainingMs/(1000*60*60))}h` : ''}`;
  eventTicker.textContent = state.notifications[0]?.text || 'No incidents yet.';

  scene.className = `musician-scene stage-${selected.stage} room-shared idle-anim ${selected.isCritical ? 'critical-anim' : 'pulse-anim'} ${selected.currentRole ? `inst-${selected.currentRole}` : ''}`;
  sprite.className = `musician-sprite ${selected.appearance.bodyClass} ${selected.appearance.eyeClass} ${selected.appearance.hairClass} ${selected.appearance.extraClass}`;

  if(selected.isDead){ overlay.textContent = 'DEAD'; overlay.classList.remove('hidden'); }
  else if(selected.isFrozen){ overlay.textContent = 'FROZEN'; overlay.classList.remove('hidden'); }
  else if(selected.isCritical){ overlay.textContent = 'CRITICAL'; overlay.classList.remove('hidden'); }
  else { overlay.classList.add('hidden'); }

  needMeters.innerHTML = NEED_KEYS.map(key=>{
    const value = Math.round(selected.needs[key] || 0);
    return `<div class="${meterClass(value)}"><div class="meter-head"><span>${titleCase(key)}</span><strong>${value}</strong></div><div class="meter-bar"><div class="meter-fill" style="width:${value}%"></div></div></div>`;
  }).join('');

  statusCards.innerHTML = `
    <div class="status-card">
      <div class="between"><strong>Traits</strong><span class="small">${selected.traitIds.length}</span></div>
      <div class="tree-tag-row">${selected.traitIds.map(t=>`<span class="badge">${titleCase(t)}</span>`).join('') || '<span class="small">No traits yet.</span>'}</div>
    </div>
    <div class="status-card">
      <div class="between"><strong>Mutations</strong><span class="small">${selected.mutationIds.length}</span></div>
      <div class="tree-tag-row">${selected.mutationIds.map(t=>`<span class="badge tag-info">${titleCase(t)}</span>`).join('') || '<span class="small">No mutations yet.</span>'}</div>
    </div>
    <div class="status-card">
      <div class="between"><strong>Base Power</strong><span class="small">Preferred ${titleCase(selected.preferredRole)}</span></div>
      <div class="small">Talent ${Math.round(selected.baseStats.talent)} • Technique ${Math.round(selected.baseStats.technique)} • Charisma ${Math.round(selected.baseStats.charisma)} • Weirdness ${Math.round(selected.baseStats.weirdness)}</div>
    </div>
    <div class="status-card">
      <div class="between"><strong>Career</strong><span class="small">Gig XP ${Math.round(selected.careerStats.gigXP || 0)}</span></div>
      <div class="small">Fame ${Math.round(selected.careerStats.fame || 0)} • Stress ${Math.round(selected.careerStats.stress || 0)} • Chemistry ${Math.round(selected.careerStats.chemistry || 0)}</div>
    </div>
  `;
}
