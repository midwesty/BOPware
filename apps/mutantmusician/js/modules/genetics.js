import { pick } from './utils.js';

export function spliceDNA(a, b){
  const stats = {};
  const keys = Object.keys(a.baseStats || {});
  keys.forEach(key=>{
    const av = a.baseStats?.[key] || 0;
    const bv = b.baseStats?.[key] || 0;
    stats[key] = Math.round((av + bv) / 2) + (Math.random() < 0.18 ? (Math.random() < 0.5 ? -2 : 3) : 0);
  });
  return {
    genre: Math.random() < 0.5 ? a.genreId : b.genreId,
    role: Math.random() < 0.5 ? a.preferredRole : b.preferredRole,
    stats,
    vectors:{ ...a.vectors, ...b.vectors },
    lineage:[a.name, b.name]
  };
}
