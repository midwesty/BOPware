import { getDataStore } from './state.js';
import { formatHours, pick, id } from './utils.js';
import { computeBandStats } from './bands.js';

export function refreshGigBoard(state, now){
  const defs = getDataStore().gigs || [];
  const open = state.gigBoard.filter(g => g.status === 'assigned' || (g.status === 'open' && now < g.expiresAt));
  while(open.filter(g=>g.status==='open').length < 5){
    const def = pick(defs);
    const boardItem = {
      id:id('gigboard'),
      templateId:def.id,
      title:def.name,
      requiredType:def.requiredType || 'solo',
      durationMs:def.durationMinutes * 60 * 1000,
      payout:def.payout,
      fameGain:def.fameGain,
      stressGain:def.stressGain,
      recurring:def.recurring,
      status:'open',
      expiresAt:now + (def.postedHours * 60 * 60 * 1000),
      genreBias:def.genreBias,
      roleBias:def.roleBias
    };
    open.push(boardItem);
  }
  state.gigBoard = open.slice(0,10);
}

export function assignGig(state, musicianOrBand, gigBoardId, now){
  const gig = state.gigBoard.find(g=>g.id===gigBoardId && g.status==='open');
  if(!gig) return { ok:false, message:'Gig is no longer available.' };
  if(!musicianOrBand) return { ok:false, message:'Choose a musician or band.' };
  if(gig.requiredType === 'band'){
    if(!musicianOrBand.memberIds) return { ok:false, message:'This gig needs a band.' };
    if(musicianOrBand.memberIds.length < 2) return { ok:false, message:'Band is too small.' };
    const busy = state.musicians.some(m => musicianOrBand.memberIds.includes(m.id) && m.currentGigId);
    if(busy) return { ok:false, message:'One of those members is already on a gig.' };
    state.musicians.forEach(m=>{ if(musicianOrBand.memberIds.includes(m.id)) m.currentGigId = gig.id; });
    gig.assignedBandId = musicianOrBand.id;
    gig.assignedName = musicianOrBand.name;
  } else {
    if(musicianOrBand.memberIds) return { ok:false, message:'That gig is for a solo mutant.' };
    if(musicianOrBand.currentGigId) return { ok:false, message:'That musician is already on a gig.' };
    musicianOrBand.currentGigId = gig.id;
    gig.assignedMusicianId = musicianOrBand.id;
    gig.assignedName = musicianOrBand.name;
  }
  gig.status = 'assigned';
  gig.endsAt = now + gig.durationMs;
  return { ok:true, message:`${gig.assignedName} took the gig: ${gig.title}.` };
}

export function resolveFinishedGigs(state, now){
  const results=[];
  state.gigBoard.forEach(gig=>{
    if(gig.status !== 'assigned' || now < gig.endsAt) return;
    let successPower = 0;
    if(gig.assignedBandId){
      const band = state.bands.find(b=>b.id===gig.assignedBandId);
      const stats = band ? computeBandStats(band, state.musicians) : { power:0 };
      successPower = stats.power + stats.chemistry * 0.3;
      state.musicians.forEach(m=>{ if(band?.memberIds.includes(m.id)){ m.currentGigId = null; m.careerStats.gigXP += 5; m.careerStats.fame += gig.fameGain; m.careerStats.stress = Math.min(100, m.careerStats.stress + gig.stressGain); m.needs.rest = Math.max(0, m.needs.rest - 10); } });
    } else {
      const musician = state.musicians.find(m=>m.id===gig.assignedMusicianId);
      if(musician){
        successPower = musician.baseStats.talent + musician.baseStats.charisma + musician.careerStats.fame * 0.5;
        musician.currentGigId = null;
        musician.careerStats.gigXP += 8;
        musician.careerStats.fame = Math.min(999, musician.careerStats.fame + gig.fameGain);
        musician.careerStats.stress = Math.min(100, musician.careerStats.stress + gig.stressGain);
        musician.needs.rest = Math.max(0, musician.needs.rest - 12);
      }
    }
    const payout = Math.round(gig.payout * (successPower > 140 ? 1.3 : successPower > 95 ? 1.1 : 0.85));
    state.playerProfile.cash += payout;
    gig.status = gig.recurring ? 'open' : 'resolved';
    if(gig.recurring){
      gig.expiresAt = now + (12 * 60 * 60 * 1000);
      delete gig.assignedBandId; delete gig.assignedMusicianId; delete gig.assignedName; delete gig.endsAt;
    }
    results.push({ type:'gig', text:`${gig.title} paid ${payout} after ${gig.assignedName || 'a no-show'} finished.` });
  });
  state.gigBoard = state.gigBoard.filter(g=>g.status !== 'resolved');
  return results;
}

export function describeGigTime(gig, now){
  if(gig.status === 'assigned') return `Ends in ${formatHours(gig.endsAt - now)}`;
  return `Posted for ${formatHours(gig.expiresAt - now)}`;
}
