import { getState, getDataStore } from './state.js';
import { titleCase, formatMoney, formatHours } from './utils.js';
import { computeBandStats } from './bands.js';
import { listSaveSlots } from './saveLoad.js';
import { getStageProgress } from './progression.js';
import { getItemDef } from './inventory.js';
import { describeGigTime } from './gigs.js';

let handlers = {};

export function bindGlobalUI(){
  document.addEventListener('click', (event)=>{
    const actionEl = event.target.closest('[data-action]');
    if(actionEl){
      const isModal = !!event.target.closest('.modal-window');
      if(isModal && handlers.handleModalAction) handlers.handleModalAction(actionEl.dataset.action, actionEl, event);
      else if(handlers.handleAction) handlers.handleAction(actionEl.dataset.action, actionEl, event);
    }
    if(event.target.matches('[data-close-modal], .modal-backdrop')){
      if(event.target.matches('.modal-backdrop') && event.target.closest('.modal-window')) return;
      closeModal();
    }
  });
}

export function registerUIHandlers(next){ handlers = next; }

export function openModal(title, bodyHtml, footerHtml=''){
  const template = document.getElementById('modalTemplate');
  const frag = template.content.cloneNode(true);
  frag.querySelector('.modal-title').innerHTML = title;
  frag.querySelector('.modal-body').innerHTML = bodyHtml;
  frag.querySelector('.modal-footer').innerHTML = footerHtml || '<button data-close-modal>Close</button>';
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';
  root.appendChild(frag);
}

export function closeModal(){ document.getElementById('modalRoot').innerHTML = ''; }

export function showToast(message, type='good'){
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(()=>el.remove(), 3400);
}

export function openStarterModal(kits=[]){
  const body = `
    <div class="notice">Choose up to three starter embryos to begin with. This lets you manage multiple musicians immediately.</div>
    <div class="modal-grid">
      ${kits.map(kit=>`
        <label class="starter-card checkbox-row">
          <input type="checkbox" name="starterKit" value="${kit.id}">
          <div>
            <strong>${kit.name}</strong>
            <div class="small">${kit.description}</div>
            <div class="tree-tag-row">${Object.entries(kit.choices).map(([k,v])=>`<span class="badge">${titleCase(v)}</span>`).join('')}</div>
          </div>
        </label>
      `).join('')}
    </div>`;
  const footer = `<button data-close-modal>Cancel</button><button data-action="createStarterBatch">Incubate Starter Set</button>`;
  openModal('Starter Embryo Set', body, footer);
}

export function openCreationModal(catalog, inventory, dnaArchive){
  const makeSelect = (id,label,options)=>`
    <label class="form-stack"><span>${label}</span>
      <select name="${id}">${options.map(opt=>`<option value="${opt.id}">${opt.name}</option>`).join('')}</select>
    </label>`;
  const body = `
    <form id="creationForm" class="split-panel">
      <div class="form-stack">
        ${makeSelect('biomass','Base Biomass', catalog.biomassOptions)}
        ${makeSelect('body','Body Frame', catalog.bodyOptions)}
        ${makeSelect('neural','Neural Seasoning', catalog.neuralOptions)}
        ${makeSelect('genre','Early Genre Exposure', catalog.genreOptions)}
        ${makeSelect('vice','Vice Imprint', catalog.viceOptions)}
        ${makeSelect('catalyst','Mutation Catalyst', catalog.catalystOptions)}
        ${makeSelect('role','Role Inclination', catalog.roleOptions)}
      </div>
      <div class="form-stack">
        <label class="form-stack"><span>Bonus Item</span>
          <select name="bonusItem">
            <option value="">None</option>
            ${(getDataStore().items || []).filter(item => item.type === 'bonus' && (inventory[item.id] || 0) > 0).map(item=>`<option value="${item.id}">${item.name} (${inventory[item.id]})</option>`).join('')}
          </select>
        </label>
        <label class="form-stack"><span>Archive Splice A</span>
          <select name="spliceA"><option value="">None</option>${dnaArchive.map(rec=>`<option value="${rec.dnaId}">${rec.name}</option>`).join('')}</select>
        </label>
        <label class="form-stack"><span>Archive Splice B</span>
          <select name="spliceB"><option value="">None</option>${dnaArchive.map(rec=>`<option value="${rec.dnaId}">${rec.name}</option>`).join('')}</select>
        </label>
        <div class="notice">Shared-room build: every new musician starts in the same lab room for this MVP, leaving space for future locations.</div>
      </div>
    </form>`;
  openModal('Embryo Creation Lab', body, `<button data-close-modal>Cancel</button><button data-action="createEmbryo">Create Embryo</button>`);
}

export function openRosterModal(state){
  const body = `<div class="list-stack">${state.musicians.map(m=>{
    const prog = getStageProgress(m, state.clockState.now);
    return `<div class="roster-card">
      <div class="between"><strong>${m.name}</strong><span class="small">${titleCase(m.stage)}${prog.nextStage ? ` • ${prog.nextStage} in ${Math.ceil(prog.remainingMs/(1000*60*60))}h` : ''}</span></div>
      <div class="small">${titleCase(m.currentRole)} • ${titleCase(m.genreId)} • ${m.isDead ? 'Dead' : m.isFrozen ? 'Frozen' : 'Active'}</div>
      <div class="tree-tag-row">${m.traitIds.map(t=>`<span class="badge">${titleCase(t)}</span>`).join('')}</div>
      <div class="row" style="margin-top:8px">
        <button data-action="selectMusician" data-musician-id="${m.id}">Select</button>
        <button data-action="toggleFreezeRoster" data-musician-id="${m.id}">${m.isFrozen ? 'Thaw' : 'Freeze'}</button>
        <button data-action="snapshotDNA" data-musician-id="${m.id}">Snapshot DNA</button>
        <button data-action="setRole" data-musician-id="${m.id}">Role</button>
      </div>
    </div>`;
  }).join('')}</div>`;
  openModal('Roster', body);
}

export function openInfoModal(m){
  if(!m) return openModal('No Musician Selected', '<div class="notice">Create or select a musician first.</div>');
  const body = `
    <div class="split-panel">
      <div class="status-card">
        <strong>${m.name}</strong>
        <div class="small">Generation ${m.generation} • ${titleCase(m.stage)} • Preferred ${titleCase(m.preferredRole)}</div>
        <div class="tree-tag-row">${m.mutationIds.map(id=>`<span class="badge tag-info">${titleCase(id)}</span>`).join('')}</div>
        <div class="tree-tag-row">${m.traitIds.map(id=>`<span class="badge">${titleCase(id)}</span>`).join('')}</div>
      </div>
      <div class="status-card">
        ${Object.entries(m.baseStats).map(([k,v])=>`<div class="between"><span>${titleCase(k)}</span><strong>${Math.round(v)}</strong></div>`).join('')}
      </div>
    </div>`;
  openModal('Musician Info', body);
}

export function openInventoryModal(state, _data, selected){
  const items = getDataStore().items || [];
  const body = `<div class="modal-grid">${items.filter(item => state.inventory[item.id] > 0).map(item=>`
    <div class="shop-item">
      <div class="between"><strong>${item.name}</strong><span class="small">x${state.inventory[item.id]}</span></div>
      <div class="small">${item.description}</div>
      <div class="row" style="margin-top:8px"><button data-action="useItem" data-item-id="${item.id}" ${selected ? '' : 'disabled'}>Use on Selected</button></div>
    </div>`).join('') || '<div class="notice">Inventory is empty.</div>'}</div>`;
  openModal('Inventory', body);
}

export function openShopModal(state){
  const items = getDataStore().items || [];
  const body = `<div class="modal-grid">${items.map(item=>`
    <div class="shop-item">
      <div class="between"><strong>${item.name}</strong><span class="small">${formatMoney(item.cost)}</span></div>
      <div class="small">${item.description}</div>
      <button style="margin-top:8px" data-action="buyItem" data-item-id="${item.id}">Buy</button>
    </div>`).join('')}</div>`;
  openModal('Shop', body);
}

export function openGigsModal(state){
  const now = state.clockState.now;
  const body = `<div class="modal-grid">${state.gigBoard.map(gig=>`
    <div class="gig-card">
      <div class="between"><strong>${gig.title}</strong><span class="small">${gig.requiredType === 'band' ? 'Band' : 'Solo'}</span></div>
      <div class="small">${describeGigTime(gig, now)} • Payout ${formatMoney(gig.payout)}</div>
      <div class="row" style="margin-top:8px">${gig.status === 'open' ? `<button data-action="assignGigPrompt" data-gig-board-id="${gig.id}">Assign</button>` : `<span class="badge tag-warn">${gig.assignedName || 'Assigned'}</span>`}</div>
    </div>`).join('')}</div>`;
  openModal('Gig Board', body);
}

export function openAssignGigModal(state, _data, gigBoardId){
  const gig = state.gigBoard.find(g=>g.id===gigBoardId);
  if(!gig) return;
  const soloCards = state.musicians.filter(m=>!m.isDead).map(m=>`
    <div class="choice-tile"><strong>${m.name}</strong><div class="small">${titleCase(m.currentRole)} • ${titleCase(m.stage)}</div><button style="margin-top:8px" data-action="assignGig" data-musician-id="${m.id}" data-gig-board-id="${gigBoardId}">Assign</button></div>`).join('');
  const bandCards = state.bands.map(b=>{ const stats = computeBandStats(b, state.musicians); return `<div class="band-card"><strong>${b.name}</strong><div class="small">Power ${stats.power} • Chemistry ${stats.chemistry}</div><button style="margin-top:8px" data-action="assignGig" data-band-id="${b.id}" data-gig-board-id="${gigBoardId}">Assign Band</button></div>`; }).join('');
  const body = `<div class="notice">Assign for ${gig.title}.</div>${gig.requiredType === 'band' ? `<div class="band-grid">${bandCards || '<div class="notice">No bands yet.</div>'}</div>` : `<div class="modal-grid">${soloCards}</div><div class="notice">Bands only appear on band gigs.</div>`}`;
  openModal('Assign Gig', body);
}

function renderGenealogy(selected, state){
  if(!selected) return '<div class="notice">Select a musician to view the family tree.</div>';
  const record = state.dnaArchive.find(d=>d.dnaId===selected.dnaId);
  const parents = (record?.lineage || selected.lineage || []).map(name=>`<div class="tree-card"><strong>${name}</strong><div class="small">Ancestor record</div></div>`).join('') || '<div class="tree-card"><strong>Unknown Origin</strong><div class="small">Starter sludge or lab accident.</div></div>';
  const children = state.dnaArchive.filter(d=> (d.lineage || []).includes(selected.name)).map(child=>`
    <div class="tree-card"><strong>${child.name}</strong><div class="small">Generation ${child.generation || 1}</div><div class="tree-tag-row">${(child.mutationIds || []).slice(0,4).map(t=>`<span class="badge tag-info">${titleCase(t)}</span>`).join('')}</div></div>
  `).join('') || '<div class="tree-card"><strong>No descendants yet</strong><div class="small">Splice or clone this musician to grow the tree.</div></div>';
  return `
    <div class="genealogy-panel">
      <div class="tree-lineage">
        ${parents}
      </div>
      <div class="tree-card self-card">
        <strong>${selected.name}</strong>
        <div class="small">Current subject • ${titleCase(selected.stage)} • ${titleCase(selected.currentRole)}</div>
        <div class="tree-tag-row">${selected.mutationIds.map(t=>`<span class="badge tag-info">${titleCase(t)}</span>`).join('')}</div>
      </div>
      <div class="tree-children">
        ${children}
      </div>
    </div>`;
}

export function openDNAModal(state){
  const selected = state.musicians.find(m=>m.id===state.playerProfile.selectedMusicianId) || null;
  const archiveList = state.dnaArchive.map(rec=>`
    <div class="archive-card">
      <div class="between"><strong>${rec.name}</strong><span class="small">Gen ${rec.generation || 1}</span></div>
      <div class="small">Role ${titleCase(rec.preferredRole)} • Genre ${titleCase(rec.genreId)}</div>
      <div class="tree-tag-row">${(rec.mutationIds || []).map(t=>`<span class="badge tag-info">${titleCase(t)}</span>`).join('')}</div>
      <div class="row" style="margin-top:8px"><button data-action="rebirthFromDNA" data-dna-id="${rec.dnaId}">Rebirth</button></div>
    </div>`).join('');
  const body = `
    <div class="split-panel">
      <div>
        <h3>Genealogy Panel</h3>
        ${renderGenealogy(selected, state)}
      </div>
      <div>
        <h3>Archive Records</h3>
        <div class="list-stack">${archiveList || '<div class="notice">Archive empty.</div>'}</div>
      </div>
    </div>`;
  openModal('DNA Archive', body);
}

export function openBattleModal(state, _data, selected){
  const exportText = selected && handlers.getBattleExport ? handlers.getBattleExport(selected) : '';
  const body = `
    <div class="split-panel">
      <div class="battle-card">
        <strong>Export Selected Fighter</strong>
        <textarea id="battleExportBox">${exportText}</textarea>
        <div class="row" style="margin-top:8px"><button data-action="copyBattleExport">Copy Export</button><button data-action="practicePrompt">Practice Instead</button></div>
      </div>
      <div class="battle-card">
        <strong>Import Opponent JSON</strong>
        <textarea id="battleImportBox" placeholder="Paste another musician export here."></textarea>
        <div class="row" style="margin-top:8px"><button data-action="runBattleImport">Run Battle</button></div>
      </div>
    </div>`;
  openModal('Battle / Practice', body);
}

export function openPracticeModal(state, selected){
  const body = `<div class="modal-grid">${state.musicians.filter(m=>m.id!==selected.id && !m.isDead).map(m=>`
    <div class="choice-tile"><strong>${m.name}</strong><div class="small">${titleCase(m.currentRole)} • Chemistry ${Math.round(m.careerStats.chemistry || 0)}</div><button style="margin-top:8px" data-action="runPracticePair" data-musician-id="${m.id}">Practice Together</button></div>
  `).join('') || '<div class="notice">No practice partners available.</div>'}</div>`;
  openModal('Choose Practice Partner', body);
}

export function openCheatsModal(){
  const cheats = [
    ['cash','Add $500'],['maxNeeds','Max Needs'],['heal','Heal Selected'],['ageUp','Age Forward'],['adult','Force Adult'],['freezeTime','Freeze Time'],['speedTime','8x Time'],['spawn','Spawn Random'],['unlockSnapshot','Unlock Snapshot Station']
  ];
  const body = `<div class="modal-grid">${cheats.map(([code,label])=>`<button data-action="runCheat" data-cheat-code="${code}">${label}</button>`).join('')}</div>`;
  openModal('Cheat Terminal', body);
}

export function openBandsModal(state){
  const body = `
    <div class="split-panel">
      <div>
        <h3>Create or Update Band</h3>
        <form id="bandForm" class="form-stack">
          <label class="form-stack"><span>Band Name</span><input id="bandNameInput" name="bandName" placeholder="The Tube Rotters"></label>
          <div class="list-stack">${state.musicians.filter(m=>!m.isDead).map(m=>`
            <label class="checkbox-row roster-card"><input type="checkbox" name="bandMember" value="${m.id}"><span>${m.name} • ${titleCase(m.currentRole)} • ${titleCase(m.stage)}</span></label>
          `).join('')}</div>
        </form>
      </div>
      <div>
        <h3>Current Bands</h3>
        <div class="band-grid">${state.bands.map(b=>{
          const stats = computeBandStats(b, state.musicians);
          return `<div class="band-card"><div class="between"><strong>${b.name}</strong><span class="small">${stats.memberCount} members</span></div>
            <div class="band-stat-grid">
              <div class="band-stat"><div class="small">Power</div><strong>${stats.power}</strong></div>
              <div class="band-stat"><div class="small">Chemistry</div><strong>${stats.chemistry}</strong></div>
              <div class="band-stat"><div class="small">Fame</div><strong>${stats.fame}</strong></div>
              <div class="band-stat"><div class="small">Talent</div><strong>${stats.talent}</strong></div>
              <div class="band-stat"><div class="small">Technique</div><strong>${stats.technique}</strong></div>
              <div class="band-stat"><div class="small">Weirdness</div><strong>${stats.weirdness}</strong></div>
            </div>
            <div class="tree-tag-row">${b.memberIds.map(id=>`<span class="badge">${state.musicians.find(m=>m.id===id)?.name || 'Unknown'}</span>`).join('')}</div>
            <div class="row" style="margin-top:8px"><button data-action="deleteBand" data-band-id="${b.id}">Delete</button></div>
          </div>`;
        }).join('') || '<div class="notice">No bands yet.</div>'}</div>
      </div>
    </div>`;
  openModal('Bands', body, `<button data-close-modal>Close</button><button data-action="createBand">Save Band</button>`);
}

export function openStudioModal(state){
  const room = state.locations.find(l=>l.id==='shared_room');
  const body = `
    <div class="studio-grid">
      <div class="upgrade-card">
        <strong>${room?.name || 'Shared Room'}</strong>
        <div class="small">One shared room for all active musicians in this MVP. Future locations can hang off this structure later.</div>
        <div class="tree-tag-row"><span class="badge tag-good">Tier ${state.labUpgrades.roomTier}</span><span class="badge tag-info">Decay Reduction ${Math.round((state.labUpgrades.roomTier-1)*4)}%</span></div>
      </div>
      <div class="upgrade-card">
        <strong>Upgrade Options</strong>
        <div class="list-stack">
          <button data-action="buyStudioUpgrade" data-upgrade-id="roomTier">Improve Shared Room (+decay reduction)</button>
          <button data-action="buyStudioUpgrade" data-upgrade-id="snapshotUnlocked">Install Snapshot Station</button>
          <button data-action="buyStudioUpgrade" data-upgrade-id="studioPolish">Add Sticky Mood Lighting (+mood)</button>
        </div>
      </div>
    </div>`;
  openModal('Studio Upgrades', body);
}

export function openSettingsModal(state){
  const slots = listSaveSlots();
  const body = `
    <div class="form-stack">
      <label class="checkbox-row"><input id="audioToggle" type="checkbox" ${state.settings.audioEnabled ? 'checked' : ''}><span>Audio Enabled</span></label>
      <label class="checkbox-row"><input id="motionToggle" type="checkbox" ${state.settings.reduceMotion ? 'checked' : ''}><span>Reduce Motion</span></label>
      <div class="save-grid">${slots.map(slot=>`
        <div class="save-slot ${slot.slot === state.playerProfile.activeSaveSlot ? 'active-slot' : ''}">
          <div class="between"><strong>Slot ${slot.slot}</strong><span class="small">${slot.exists ? 'Used' : 'Empty'}</span></div>
          <div class="small">${slot.label}</div>
          ${slot.exists ? `<div class="small">Cash ${formatMoney(slot.cash || 0)} • Musicians ${slot.musicians || 0}</div>` : '<div class="small">No save data yet.</div>'}
          <div class="row" style="margin-top:8px">
            <button data-action="overwriteSaveSlot" data-slot-id="${slot.slot}">Save Here</button>
            <button data-action="loadSaveSlot" data-slot-id="${slot.slot}">Load</button>
            <button data-action="deleteSaveSlot" data-slot-id="${slot.slot}">Delete</button>
          </div>
        </div>
      `).join('')}</div>
    </div>`;
  openModal('Settings & Save Slots', body, `<button data-action="hardSave">Save Current Slot</button><button data-action="saveSettings">Save Settings</button>`);
}

export function promptRoleChange(m, roles){
  const body = `<div class="modal-grid">${roles.map(role=>`<button data-action="applyRoleChange" data-musician-id="${m.id}" data-role-id="${role.id}">${role.name}</button>`).join('')}</div>`;
  openModal(`Assign Role for ${m.name}`, body);
}
