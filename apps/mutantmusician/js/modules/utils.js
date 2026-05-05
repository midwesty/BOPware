export const clamp = (v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export const rand = (min,max)=>Math.floor(Math.random()*(max-min+1))+min;
export const pick = (arr)=>arr[Math.floor(Math.random()*arr.length)];
export const id = (prefix='id')=>`${prefix}_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`;
export const chance = (p)=>Math.random() < p;
export const average = (nums)=>nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : 0;
export function titleCase(text=''){ return text.replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase()); }
export function formatMoney(n=0){ return `$${Math.round(n)}`; }
export function formatHours(ms=0){
  const total = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(total/3600);
  const m = Math.floor((total%3600)/60);
  return `${h}h ${m}m`;
}
export function formatClock(date = new Date()){
  return date.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
}
export function safeJsonParse(text, fallback=null){ try{return JSON.parse(text);}catch{return fallback;} }
