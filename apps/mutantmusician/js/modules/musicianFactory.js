import { getDataStore } from './state.js';
import { BASE_STAT_KEYS, CAREER_STAT_KEYS, NEED_KEYS } from './constants.js';
import { id, pick, rand, clamp } from './utils.js';

function blankStats(keys, base=0){
  return Object.fromEntries(keys.map(k=>[k, base]));
}

function scoreMapToStats(map={}, keys){
  const out = blankStats(keys, 0);
  keys.forEach(k=>{ out[k] = map[k] || 0; });
  return out;
}

function chooseName(){
  const names = getDataStore().names;
  const first = pick(names.first || ['Gunk']);
  const last = pick(names.last || ['Beast']);
  return `${first} ${last}`;
}

function getCatalogEntry(category, idValue){
  const options = getDataStore().creationOptions[category] || [];
  return options.find(x=>x.id===idValue) || {};
}

function buildVectors(choices){
  const base = { humanoid:40,bestial:20,aquatic:10,insectoid:10,fungal:10,skeletal:10,synthetic:10,elegant:10,trashy:20,cute:15,nightmare:12 };
  const mappings = [
    getCatalogEntry('biomassOptions', choices.biomass),
    getCatalogEntry('bodyOptions', choices.body),
    getCatalogEntry('neuralOptions', choices.neural),
    getCatalogEntry('genreOptions', choices.genre),
    getCatalogEntry('viceOptions', choices.vice),
    getCatalogEntry('catalystOptions', choices.catalyst)
  ];
  mappings.forEach(entry=>{
    Object.entries(entry.vectors || {}).forEach(([k,v])=>{ base[k] = (base[k] || 0) + v; });
  });
  return base;
}

function buildPreferredClasses(vectors){
  const bodyClass = vectors.synthetic > vectors.fungal && vectors.synthetic > vectors.bestial ? 'body-synthetic' :
    vectors.fungal > vectors.aquatic && vectors.fungal > vectors.skeletal ? 'body-fungal' :
    vectors.skeletal > 40 ? 'body-skeletal' :
    vectors.aquatic > 35 ? 'body-aquatic' :
    vectors.elegant > 35 ? 'body-elegant' : 'body-bestial';
  const eyeClass = vectors.nightmare > 28 ? 'eye-nightmare' : 'eye-cute';
  const hairClass = vectors.elegant > vectors.trashy ? 'hair-elegant' : vectors.cute > 25 ? 'hair-cute' : 'hair-trashy';
  const extraClass = vectors.synthetic > 32 ? 'extra-synthetic' : vectors.fungal > 28 ? 'extra-fungal' : vectors.nightmare > 28 ? 'extra-nightmare' : '';
  return { bodyClass, eyeClass, hairClass, extraClass };
}

function deriveRoleAptitudes(preferredRole){
  const roles = getDataStore().roles || [];
  const out={};
  roles.forEach(role=>{ out[role.id] = rand(22,58); });
  if(out[preferredRole] != null) out[preferredRole] = rand(64,88);
  return out;
}

function chooseMutations(choices, bonusItems=[]){
  const all = getDataStore().mutations || [];
  const byRole = all.filter(m=>!m.roleAffinity || m.roleAffinity.includes(choices.role));
  const primary = pick(byRole.length ? byRole : all);
  const extra = bonusItems.some(item => item.id === 'black_market_spores') ? pick(all.filter(m=>m.rarity !== 'legendary')) : null;
  return [primary?.id, extra?.id].filter(Boolean);
}

function chooseTraits(choices){
  const all = getDataStore().traits || [];
  const genreMatches = all.filter(t=>!t.genreAffinity || t.genreAffinity.includes(choices.genre));
  return [pick(genreMatches || all)?.id, pick(all)?.id].filter(Boolean);
}

export function createMusicianFromChoices(choices, source='lab_custom', extras={}){
  const data = getDataStore();
  const genre = data.genres.find(g=>g.id===choices.genre) || data.genres[0];
  const role = data.roles.find(r=>r.id===choices.role) || data.roles[0];
  const vice = data.vices.find(v=>v.id===choices.vice) || data.vices[0];
  const vectors = buildVectors(choices);
  const baseStats = blankStats(BASE_STAT_KEYS, 42);
  [getCatalogEntry('biomassOptions', choices.biomass), getCatalogEntry('bodyOptions', choices.body), getCatalogEntry('neuralOptions', choices.neural), getCatalogEntry('genreOptions', choices.genre), getCatalogEntry('viceOptions', choices.vice), getCatalogEntry('catalystOptions', choices.catalyst), getCatalogEntry('roleOptions', choices.role)].forEach(entry=>{
    Object.entries(entry.stats || {}).forEach(([k,v])=>{ baseStats[k] = clamp((baseStats[k] || 0) + v, 5, 99); });
  });
  (extras.bonusItems || []).forEach(item=>{
    Object.entries(item.effects || {}).forEach(([k,v])=>{ if(baseStats[k] != null) baseStats[k] = clamp(baseStats[k] + v, 5, 99); });
  });
  const needs = blankStats(NEED_KEYS, 82);
  needs.health = 92;
  needs.vice = rand(58,76);
  const careerStats = blankStats(CAREER_STAT_KEYS, 0);
  const musician = {
    id:id('mus'),
    dnaId:id('dna'),
    name:chooseName(),
    createdAt:Date.now(),
    updatedAt:Date.now(),
    source,
    creationChoices:{ ...choices },
    generation: extras.generation || 1,
    lineage: extras.lineage || [],
    stage:'embryo',
    genreId:genre.id,
    viceId:vice.id,
    preferredRole:role.id,
    currentRole:role.id,
    roleAptitudes:deriveRoleAptitudes(role.id),
    baseStats,
    needs,
    careerStats,
    vectors,
    mutationIds: chooseMutations(choices, extras.bonusItems || []),
    traitIds: chooseTraits(choices),
    isFrozen:false,
    isDead:false,
    isCritical:false,
    currentGigId:null,
    currentBandIds:[],
    snapshotDNA:null,
    descendants:[],
    appearance: buildPreferredClasses(vectors),
    notes:[],
    timers:{ lastEventAt:0 }
  };
  return musician;
}

export function createMusicianFromDNAArchive(rec){
  const useSnapshot = rec.snapshotDNA || null;
  const musician = createMusicianFromChoices(rec.creationChoices, 'dna_rebirth', {
    generation:(rec.generation || 1) + 1,
    lineage:[...(rec.lineage || []), rec.name]
  });
  musician.name = `${rec.name.split(' ')[0]} ${pick(['Redux','Again','II','Returned','Reborn'])}`;
  musician.preferredRole = rec.preferredRole;
  musician.currentRole = rec.preferredRole;
  musician.genreId = rec.genreId;
  musician.viceId = rec.viceId;
  musician.vectors = { ...rec.vectors };
  musician.mutationIds = [...(rec.mutationIds || musician.mutationIds)];
  if(useSnapshot){
    musician.baseStats = { ...musician.baseStats, ...useSnapshot.baseStats };
    musician.careerStats = { ...musician.careerStats, ...useSnapshot.careerStats };
    musician.traitIds = [...(useSnapshot.traitIds || musician.traitIds)];
    musician.mutationIds = [...(useSnapshot.mutationIds || musician.mutationIds)];
  }
  musician.appearance = buildPreferredClasses(musician.vectors);
  return musician;
}
