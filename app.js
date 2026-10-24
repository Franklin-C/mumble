import { Mumble, PRESETS, normalizeOptions, renderSpeech, encodeWav } from './lib/mumble.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const iconPaths = {
  code: '<path d="m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4"/>',
  upload: '<path d="M12 16V4m-4 4 4-4 4 4M5 16v4h14v-4"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5"/><rect x="9" y="9" width="6" height="6" rx="1"/>',
  play: '<path d="m8 4 12 8-12 8z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" stroke="none"/>',
  shuffle: '<path d="m17 3 4 4-4 4m0 2 4 4-4 4M3 7h3c5 0 7 10 12 10h3M3 17h3c2 0 3-1 5-4m3-4c1-1 2-2 4-2h3"/>',
  repeat: '<path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 3v7h7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.5 1.5m12.6 12.6 1.5 1.5M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5"/>',
  sparkles: '<path d="m9 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6zm10 10 1.2 3.8L24 18l-3.8 1.2L19 23l-1.2-3.8L14 18l3.8-1.2L19 13zM19 2v5m-2.5-2.5h5"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
  link: '<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 14a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" transform="translate(0 0) scale(.95)"/>',
};
function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.play}</svg>`; }
function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); }); }

const cast = {
  sprout: { name: 'Sprout', label: 'The forest friend', subtitle: 'Warm & wonderfully curious', color: '#bddca4', rgb: '189,220,164', bg: '#354b36' },
  pip: { name: 'Pip', label: 'The pocket adventurer', subtitle: 'Small voice, big energy', color: '#edbc83', rgb: '237,188,131', bg: '#514234' },
  byte: { name: 'Byte', label: 'The helpful little robot', subtitle: 'Perfectly imperfect robot', color: '#94cbd3', rgb: '148,203,211', bg: '#30474c' },
  grumble: { name: 'Grumble', label: 'The gentle giant', subtitle: 'A very lovable grump', color: '#d5a3a0', rgb: '213,163,160', bg: '#493b3a' },
  wisp: { name: 'Wisp', label: 'The midnight daydreamer', subtitle: 'Soft, floaty, otherworldly', color: '#c1b0e5', rgb: '193,176,229', bg: '#433d56' },
  orbit: { name: 'Orbit', label: 'The curious visitor', subtitle: 'A little out of this world', color: '#add3cb', rgb: '173,211,203', bg: '#344943' },
  ember: { name: 'Ember', label: 'The tiny firecracker', subtitle: 'Bright, bold & a bit chaotic', color: '#eca07e', rgb: '236,160,126', bg: '#513b30' },
  sage: { name: 'Sage', label: 'The keeper of stories', subtitle: 'Old soul. Good stories.', color: '#afbdcf', rgb: '175,189,207', bg: '#3b4552' },
};
const mouths = (x=60,y=81) => `<g stroke="#23322a" stroke-width="3" stroke-linecap="round"><path class="mouth-closed" d="M${x-5} ${y}q5 5 10 0" fill="none"/><ellipse class="mouth-open" cx="${x}" cy="${y+2}" rx="5" ry="6" fill="#283a2d" stroke="none"/></g>`;
function avatar(id) {
  const eyes = '<rect x="41" y="62" width="5" height="9" rx="2.5" fill="#243a2a"/><rect x="74" y="62" width="5" height="9" rx="2.5" fill="#243a2a"/><circle cx="39" cy="77" r="5" fill="#e2a78a" opacity=".5"/><circle cx="82" cy="77" r="5" fill="#e2a78a" opacity=".5"/>';
  const shapes = {
    sprout: `<path d="M45 115v11m30-11v11" stroke="#789b58" stroke-width="12"/><path d="M31 78 22 97m67-19 9 19" stroke="#a8cc8a" stroke-width="12"/><path d="M32 53Q31 30 60 33q29-3 29 20v46q-2 23-29 23-27 0-28-23Z" fill="#b8d990" stroke="#293f2c" stroke-width="3"/><path d="M60 34V20" stroke="#61854a" stroke-width="4"/><path d="M60 24q-24 1-21-19 20-1 21 19" fill="#7ba75d" stroke="#293f2c" stroke-width="2"/><path d="M61 26q-1-22 20-22 3 20-20 22" fill="#b5d58b" stroke="#293f2c" stroke-width="2"/><path d="M37 101q23 13 46 0v7q-22 20-46 0Z" fill="#9bbd73"/>${eyes}${mouths()}<path d="M48 103v12m24-12v12" stroke="#e3d09c" stroke-width="3"/><rect x="47" y="96" width="26" height="19" rx="4" fill="#caad72" stroke="#6c6c46" stroke-width="2"/><path d="M51 102h18m-9-4v8" stroke="#ecdbb0" stroke-width="2"/>`,
    pip: `<path d="M36 42 25 17q-6-14 9-12l17 33m18 0 17-30q12-11 11 6L86 45" fill="#dfad73" stroke="#443424" stroke-width="3"/><path d="M43 114v13m34-13v13" stroke="#c89e68" stroke-width="11"/><path d="M32 83 21 95m67-12 11 12" stroke="#e4b683" stroke-width="12"/><rect x="29" y="36" width="64" height="82" rx="27" fill="#edc791" stroke="#443424" stroke-width="3"/><path d="M31 89q30 8 59 0v11q-31 14-59 0" fill="#9daf89" stroke="#506344" stroke-width="2"/><path d="m79 95 9 19 9-11-10-12" fill="#9daf89" stroke="#506344" stroke-width="2"/>${eyes}${mouths()}<path d="M57 72h6l-3 4Z" fill="#ad8268"/>`,
    byte: `<path d="M60 29V13" stroke="#7eaab1" stroke-width="4"/><circle cx="60" cy="11" r="5" fill="#f1bb85"/><path d="M43 115v12m34-12v12" stroke="#618c97" stroke-width="11"/><path d="M26 78 15 99m79-21 11 21" stroke="#759eab" stroke-width="10"/><rect x="28" y="31" width="65" height="85" rx="14" fill="#93bcc4" stroke="#293c43" stroke-width="3"/><rect x="35" y="45" width="51" height="41" rx="8" fill="#293f46"/><rect x="44" y="56" width="7" height="13" rx="3" fill="#c0e8ce"/><rect x="70" y="56" width="7" height="13" rx="3" fill="#c0e8ce"/><path class="mouth-closed" d="M54 77h13" stroke="#c0e8ce" stroke-width="3"/><path class="mouth-open" d="M51 75h4v6h4v-9h4v9h4v-6h4" stroke="#c0e8ce" stroke-width="2" fill="none"/><rect x="42" y="94" width="37" height="11" rx="3" fill="#648f9d"/><circle cx="48" cy="99.5" r="2" fill="#eac08b"/><path d="M57 99h16" stroke="#b8d2cf" stroke-width="2"/>`,
    grumble: `<path d="M37 43 25 29q-9-10-5-18 15 0 25 26m37 6 13-14q9-10 5-18-15 0-25 26" fill="#d3c5a2" stroke="#493c35" stroke-width="3"/><path d="M38 113v14m45-14v14" stroke="#9f7976" stroke-width="14"/><path d="M27 76 15 97m78-21 12 21" stroke="#be9590" stroke-width="14"/><path d="M23 59Q23 30 60 30t37 29v40q0 23-37 23t-37-23Z" fill="#cda39b" stroke="#493b37" stroke-width="3"/><path d="M37 59 50 63m19 0 14-4" stroke="#6c5149" stroke-width="4" stroke-linecap="round"/>${eyes}${mouths(60,83)}<path d="m40 84 3 9 4-9m26 0 4 9 3-9" fill="#f2dcc0"/><path d="M30 100q30 10 60 0" stroke="#a98479" stroke-width="5"/><path d="m53 106 7 4 7-4" fill="none" stroke="#a98479" stroke-width="3"/>`,
    wisp: `<path d="M28 72Q26 27 60 25q35-2 35 47l9 39q-10 10-21 1-12 14-23 1-13 14-25 1-11 9-21-1Z" fill="#c7bce6" stroke="#463f60" stroke-width="3"/><path d="M28 77 17 91m77-14 10 14" stroke="#b7abda" stroke-width="10"/><path d="M37 48q6-10 15-11" stroke="#e8e0f7" stroke-width="5" stroke-linecap="round"/>${eyes}${mouths(60,83)}<path d="M42 102q18 10 36 0" fill="none" stroke="#b0a1d4" stroke-width="3"/><path d="m102 33 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#dcd3ec"/><circle cx="17" cy="44" r="3" fill="#b7a8d4"/>`,
    orbit: `<path d="M39 112v14m42-14v14" stroke="#87b9a9" stroke-width="12"/><path d="M30 83 18 102m72-19 12 19" stroke="#9acaaf" stroke-width="11"/><path d="M29 56q-1-30 31-30t32 30v40q0 24-32 24T29 96Z" fill="#b1d5b3" stroke="#324e42" stroke-width="3"/><path d="M45 29 39 15m36 14 6-14" stroke="#85b69a" stroke-width="3"/><circle cx="38" cy="12" r="5" fill="#e1c789"/><circle cx="82" cy="12" r="5" fill="#e1c789"/><ellipse cx="43" cy="63" rx="10" ry="14" transform="rotate(-20 43 63)" fill="#2c443b"/><ellipse cx="77" cy="63" rx="10" ry="14" transform="rotate(20 77 63)" fill="#2c443b"/><circle cx="40" cy="59" r="3" fill="#d0e5d1"/><circle cx="74" cy="59" r="3" fill="#d0e5d1"/>${mouths(60,85)}<path d="M31 100q28 10 59 0" stroke="#86b49f" stroke-width="5"/><circle cx="60" cy="105" r="5" fill="#dac28d"/>`,
    ember: `<path d="M40 114v13m39-13v13" stroke="#ba7756" stroke-width="12"/><path d="M29 85 17 100m74-15 12 15" stroke="#de9870" stroke-width="12"/><path d="M25 70q-5-20 9-37l8 11q3-22 18-39 0 27 17 30l7-15q12 16 12 45v33q-1 23-36 23T25 98Z" fill="#e5a07c" stroke="#583e2b" stroke-width="3"/><path d="M40 47q8-9 18-18-1 20 15 22" fill="#f3bf89"/>${eyes}${mouths()}<path d="M42 96q18-8 36 0v12q-18 13-36 0Z" fill="#f0c591"/><path d="M13 49 8 40m99 18 7-7" stroke="#dfa278" stroke-width="3" stroke-linecap="round"/>`,
    sage: `<path d="M43 114v13m35-13v13" stroke="#788899" stroke-width="11"/><path d="M28 79 17 100m76-21 10 21" stroke="#91a3b8" stroke-width="11"/><rect x="29" y="40" width="63" height="79" rx="23" fill="#b0bdca" stroke="#39444d" stroke-width="3"/><path d="M22 44 48 12q12-7 18 4l14 28" fill="#7f93a9" stroke="#39444d" stroke-width="3"/><path d="M16 45h88" stroke="#61798e" stroke-width="8" stroke-linecap="round"/>${eyes}<circle cx="44" cy="68" r="12" fill="none" stroke="#64717a" stroke-width="3"/><circle cx="77" cy="68" r="12" fill="none" stroke="#64717a" stroke-width="3"/><path d="M56 67h9" stroke="#64717a" stroke-width="2"/>${mouths(60,89)}<path d="M33 96q9 4 18-3l9 15 10-15q9 7 17 3-5 26-27 30-23-6-27-30Z" fill="#d0d3d1" stroke="#83929a" stroke-width="2"/>`,
  };
  return `<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g stroke-linejoin="round" stroke-linecap="round">${shapes[id] || shapes.sprout}</g></svg>`;
}

const sliderDefs = [
  { key:'voiceType', name:'Voice type', min:0, max:1, step:.01, low:'Blip', middle:'Mumble', high:'Robot', wide:true, format:v=>v===0?'Blip':v===.5?'Mumble':v===1?'Robot':v<.5?`Blip / mumble · ${Math.round(v*200)}%`:`Mumble / robot · ${Math.round((v-.5)*200)}%` },
  { key:'mood', name:'Mood', min:-1, max:1, step:.01, low:'Subdued', middle:'Neutral', high:'Animated', wide:true, format:v=>v===0?'Neutral':`${v<0?'Subdued':'Animated'} · ${Math.round(Math.abs(v)*100)}%` },
  { key:'pitch', name:'Pitch', min:60, max:700, step:1, low:'Low', high:'High', format:v=>`${Math.round(v)} Hz` },
  { key:'speed', name:'Speaking pace', min:.35, max:2.5, step:.01, low:'Slow', high:'Fast', format:v=>`${Number(v).toFixed(2)}×` },
  { key:'variation', name:'Variation', min:0, max:1, step:.01, low:'Steady', high:'Expressive', format:v=>`${Math.round(v*100)}%` },
  { key:'brightness', name:'Brightness', min:0, max:1, step:.01, low:'Warm', high:'Crisp', format:v=>`${Math.round(v*100)}%` },
  { key:'roughness', name:'Roughness', min:0, max:1, step:.01, low:'Smooth', high:'Gravelly', format:v=>`${Math.round(v*100)}%` },
  { key:'breathiness', name:'Breathiness', min:0, max:1, step:.01, low:'Clear', high:'Airy', format:v=>`${Math.round(v*100)}%` },
  { key:'volume', name:'Volume', min:0, max:1, step:.01, low:'Quiet', high:'Loud', format:v=>`${Math.round(v*100)}%` },
  { key:'seed', name:'Variation seed', min:0, max:4294967295, step:1, low:'Same seed, same take', high:'', format:v=>String(v) },
];
const examples = [
  'Hey, stranger! Got a minute for a tiny adventure?',
  'Three gold coins for a mysterious mushroom. A bargain, if you ask me!',
  'Wait... did that tree just wink at us?',
  'Greetings, Earth creature. Take me to your snack drawer.',
  'The door is locked. The key? Oh... I may have eaten it.',
  'You did it! The whole forest is cheering for you!',
  'Welcome back, traveller. I kept the kettle on.',
  'Beep. Boop. Friendship protocol successfully installed.',
];
const storageKey = 'mumble-lab-v1';
const punctuationSamples = {'.':'Hello there.','?':'Hello there?','!':'Hello there!','…':'Hello… there.'};
let selected = 'sprout';
let settings = normalizeOptions({...PRESETS.sprout.options, seed:42});
let rendered = null;
let playback = null;
let pending = false;
let playGeneration = 0;
let loop = false;
let animation = 0;
let renderTimer;
let toastTimer;
let codeFormat = 'javascript';
let rawCode = '';
let cachedBars = [];
let exampleIndex = 0;
let lastProgress = 0;
const synth = new Mumble(settings);

function toast(message) { const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3400); }
function fail(error) { const message=error instanceof Error?error.message:String(error);$('#audio-status').textContent=message;toast(message); }
function textValid() { const length=Array.from($('#dialogue').value).length;return length>0 && length<=500 && /\S/u.test($('#dialogue').value); }
function formatTime(value) { const n=Math.max(0,Number(value)||0);return `${Math.floor(n/60)}:${(n%60).toFixed(1).padStart(4,'0')}`; }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function saveState() { try {localStorage.setItem(storageKey,JSON.stringify(voiceState()));} catch {} }
function validImport(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('That file does not contain a voice preset.');
  const opts=value.options || value;
  if(!opts || typeof opts!=='object' || Array.isArray(opts) || !['pitch','speed','style','seed','voiceType','mood'].some(k=>k in opts)) throw new Error('No voice settings found in this file.');
  if(value.text!==undefined && (typeof value.text!=='string' || Array.from(value.text).length>500)) throw new Error('Preset dialogue must be text of 500 characters or fewer.');
  return {preset:typeof value.preset==='string'&&Object.hasOwn(cast,value.preset)?value.preset:'sprout',options:normalizeOptions(opts),text:value.text};
}
function encodeState(value) { const bytes=new TextEncoder().encode(JSON.stringify(value));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,''); }
function decodeState(value) { if(value.length>12000) throw new Error('This shared voice link is too long.'); const raw=value.replaceAll('-','+').replaceAll('_','/');return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(raw),c=>c.charCodeAt(0)))); }
function restore() {
  try { const shared=location.hash.startsWith('#voice=')?decodeState(location.hash.slice(7)):null;const local=shared || JSON.parse(localStorage.getItem(storageKey)||'null');if(!local)return;const v=validImport(local);selected=v.preset;settings=v.options;if(typeof v.text==='string')$('#dialogue').value=v.text; } catch { toast('Could not load saved settings. Starting with Sprout.'); }
}

function buildControls() {
  $('#preset-select').innerHTML=Object.entries(cast).map(([id,voice])=>`<option value="${id}">${voice.name} — ${voice.label.toLowerCase()}</option>`).join('');
  for(const d of sliderDefs) {
    const seedButton=d.key==='seed'?`<button id="seed-button" class="seed-button" aria-label="Roll a new variation seed" title="Roll a new variation seed">${icon('shuffle')}</button>`:'';
    const html=`<div class="slider-row${d.wide?' slider-row-wide':''}"><div class="slider-label"><span><label for="control-${d.key}">${d.name}</label>${seedButton}</span><output id="value-${d.key}" for="control-${d.key}"></output></div><div class="slider-track"><input id="control-${d.key}" type="range" min="${d.min}" max="${d.max}" step="${d.step}" data-setting="${d.key}"></div><div class="slider-scale"><span>${d.low}</span>${d.middle?`<span>${d.middle}</span>`:''}<span>${d.high}</span></div></div>`;
    $('#sliders').insertAdjacentHTML('beforeend',html);
  }
  $('#preset-select').addEventListener('change',()=>{
    selected=$('#preset-select').value;settings=normalizeOptions({...PRESETS[selected].options, seed:settings.seed});updateCharacter();updateSettings();onChange();
  });
  $$('[data-setting]').forEach(input=>input.addEventListener('input',()=>{
    settings=normalizeOptions({...settings,[input.dataset.setting]:Number(input.value)});updateSettings();onChange();
  }));
}
function updateCharacter() {
  const voice=cast[selected];document.documentElement.style.setProperty('--voice',voice.color);document.documentElement.style.setProperty('--voice-rgb',voice.rgb);
  $('#avatar-stage').innerHTML=avatar(selected);$('#preset-avatar').innerHTML=avatar(selected);$('#character-name').textContent=voice.name;$('#character-label').textContent=voice.label;$('#stage').dataset.character=selected;$('#preset-select').value=selected;
}
function updateSettings() {
  for(const d of sliderDefs) { const input=$(`#control-${d.key}`);input.value=settings[d.key];input.style.setProperty('--fill',`${(settings[d.key]-d.min)/(d.max-d.min)*100}%`);input.setAttribute('aria-valuetext',d.format(settings[d.key]));$(`#value-${d.key}`).textContent=d.format(settings[d.key]); }
  updateCode();
}
function onChange() {
  stopPlayback();rendered=null;cachedBars=[];lastProgress=0;updateTextCount();updateCode();saveState();$('#audio-status').textContent='Changes apply on the next play';clearTimeout(renderTimer);renderTimer=setTimeout(()=>prepareAudio(),160);
}
function updateTextCount() { const n=Array.from($('#dialogue').value).length;$('#char-count').textContent=`${n} / 500`;$('#char-count').style.color=n>500?'#b72f27':'';$('#play-button').disabled=!textValid();$('#wav-button').disabled=!textValid();if(!playback)$('#speech-text').textContent=shortBubble($('#dialogue').value);$$('[data-punctuation]').forEach(button=>button.setAttribute('aria-pressed',String($('#dialogue').value===punctuationSamples[button.dataset.punctuation]))); }
function shortBubble(text) { return text.length>100?text.slice(0,97)+'…':(text||'A little voice, waiting for your words.'); }
function prepareAudio() {
  if(!textValid()) {rendered=null;cachedBars=[];$('#duration').textContent='0:00.0';drawWaveform(0);return null;}
  if(rendered)return rendered;
  try {const start=performance.now();rendered=renderSpeech($('#dialogue').value,settings);const elapsed=performance.now()-start;$('#duration').textContent=formatTime(rendered.duration);$('#render-info').textContent=`${rendered.events.filter(e=>e.kind==='vowel').length} vowels · ${rendered.sampleRate/1000} kHz mono`;$('#audio-status').textContent=`Generated in ${Math.max(1,Math.round(elapsed))} ms`;computeBars();drawWaveform(0);return rendered;}
  catch(error) {fail(error);return null;}
}
function computeBars() {
  if(!rendered){cachedBars=[];return;}
  const count=180,samples=rendered.samples;cachedBars=new Array(count).fill(0);for(let j=0;j<count;j++){const start=Math.floor(j*samples.length/count),end=Math.floor((j+1)*samples.length/count);let peak=0;for(let i=start;i<end;i+=3)peak=Math.max(peak,Math.abs(samples[i]));cachedBars[j]=peak;}
  const peak=Math.max(.01,...cachedBars);cachedBars=cachedBars.map(v=>Math.pow(v/peak,.7));
}
function drawWaveform(progress=0) {
  lastProgress=progress;const canvas=$('#waveform'),rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);if(!rect.width)return;const w=Math.round(rect.width*dpr),h=Math.round(rect.height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,w,h);const mid=h/2;
  ctx.strokeStyle='#e7dfd9';ctx.lineWidth=dpr*.5;ctx.beginPath();ctx.moveTo(0,mid);ctx.lineTo(w,mid);ctx.stroke();
  const count=Math.floor(rect.width/3.7),gap=w/count,bw=Math.max(1.2*dpr,gap*.48);for(let j=0;j<count;j++){const v=cachedBars[Math.min(cachedBars.length-1,Math.floor(j/count*cachedBars.length))]||0;const bh=Math.max(dpr*1.3,v*(h-6*dpr));ctx.fillStyle=j/count<progress?'#d64036':'#dba69d';ctx.fillRect(j*gap,(h-bh)/2,bw,bh);}
  if(progress>0&&progress<1){ctx.fillStyle='#b72f27';ctx.fillRect(progress*w,0,dpr,h);}
}
function playbackUI(playing) {
  $('#stage').classList.toggle('is-playing',playing);$('#stage-status').textContent=playing?'A LITTLE CONVERSATION':'READY WHEN YOU ARE';$('#play-label').textContent=playing?'Stop voice':'Play voice';$('#play-button [data-icon]').innerHTML=icon(playing?'stop':'play');$('#play-button').setAttribute('aria-label',playing?'Stop playback':'Play generated voice');
}
function stopPlayback() {
  playGeneration++;pending=false;clearTimeout(renderTimer);cancelAnimationFrame(animation);if(playback){playback.stop();playback=null;}synth.stop();playbackUI(false);$('#stage').classList.remove('is-speaking','is-pausing');$('#playback-time').textContent='0:00.0';$('#speech-text').textContent=shortBubble($('#dialogue').value);drawWaveform(0);
}
async function startPlayback() {
  if(playback||pending){stopPlayback();return;}
  if(!textValid()){toast('Enter between 1 and 500 characters to make a voice.');return;}
  const generation=++playGeneration;pending=true;$('#play-label').textContent='Waking up…';
  try {
    const text=$('#dialogue').value;
    const handle=await synth.speak(text,settings);
    if(generation!==playGeneration){handle.stop();return;}
    pending=false;playback=handle;rendered=handle.rendered;computeBars();$('#duration').textContent=formatTime(rendered.duration);$('#audio-status').textContent=loop?'Looping · click stop to finish':'Playing locally';$('#render-info').textContent=`${rendered.events.filter(e=>e.kind==='vowel').length} vowels · ${rendered.sampleRate/1000} kHz mono`;playbackUI(true);
    let eventIndex=0;
    const tick=()=>{
      if(playback!==handle)return;
      const t=handle.currentTime;$('#playback-time').textContent=formatTime(t);drawWaveform(Math.min(1,t/rendered.duration));
      while(eventIndex<rendered.events.length-1&&rendered.events[eventIndex+1].start<=t)eventIndex++;
      const event=rendered.events[eventIndex];
      if(event && t>=event.start){const revealed=text.slice(0,event.index+event.char.length);$('#speech-text').textContent=revealed.length>100?'…'+revealed.slice(-97):revealed;const talking=event.kind==='vowel'&&t<event.start+event.duration;$('#stage').classList.toggle('is-speaking',talking);$('#stage').classList.toggle('is-pausing',!talking);}
      animation=requestAnimationFrame(tick);
    };
    tick();
    await handle.ended;
    if(generation!==playGeneration)return;
    playback=null;cancelAnimationFrame(animation);playbackUI(false);$('#stage').classList.remove('is-speaking','is-pausing');$('#speech-text').textContent=shortBubble(text);drawWaveform(1);$('#playback-time').textContent=formatTime(rendered.duration);$('#audio-status').textContent='That’s a wrap. Make another?';
    if(loop){setTimeout(()=>{if(generation===playGeneration&&loop&&!document.hidden)startPlayback();},400);}
  } catch(error) {if(generation===playGeneration){pending=false;playback=null;playbackUI(false);fail(error);}}
}

function download(content,type,filename) { const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000); }
async function copy(text,message) {
  try {await navigator.clipboard.writeText(text);toast(message);}catch{
    const textarea=document.createElement('textarea');textarea.value=text;textarea.style.cssText='position:fixed;opacity:0;left:0;top:0';document.body.appendChild(textarea);textarea.select();let success=false;try{success=document.execCommand('copy');}catch{}textarea.remove();toast(success?message:'Clipboard unavailable. Select and copy the code below.');
  }
}
function voiceState() { return {schema:'mumble.voice.v2',preset:selected,options:settings,text:$('#dialogue').value}; }
function updateCode() {
  if(codeFormat==='json')rawCode=JSON.stringify(voiceState(),null,2);
  else rawCode=`import { Mumble } from './lib/mumble.js';\n\nconst voice = new Mumble({\n  pitch: ${settings.pitch}, speed: ${settings.speed},\n  voiceType: ${settings.voiceType}, mood: ${settings.mood},\n  variation: ${settings.variation}, brightness: ${settings.brightness},\n  breathiness: ${settings.breathiness}, roughness: ${settings.roughness},\n  volume: ${settings.volume}, seed: ${settings.seed}\n});\n\n// Start audio from a click or tap.\ndocument.querySelector('#talk').addEventListener('click', async () => {\n  await voice.speak(${JSON.stringify($('#dialogue').value)});\n});`;
  const pattern=/(\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b(?:import|from|const|new|await|async)\b|\b\d+(?:\.\d+)?\b)/g;
  let html='',last=0;for(const match of rawCode.matchAll(pattern)){html+=escapeHtml(rawCode.slice(last,match.index));const token=match[0];const kind=token.startsWith('//')?'comment':/^['"]/.test(token)?'string':/^\d/.test(token)?'number':'keyword';html+=`<span class="code-${kind}">${escapeHtml(token)}</span>`;last=match.index+token.length;}html+=escapeHtml(rawCode.slice(last));$('#code-output').innerHTML=html;
  $$('[data-format]').forEach(b=>{const active=b.dataset.format===codeFormat;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  $('#copy-button').innerHTML=icon('copy')+(codeFormat==='json'?'Copy JSON':'Copy code');
}
function randomize() {
  const random=(min,max,places=2)=>Number((min+Math.random()*(max-min)).toFixed(places));
  settings=normalizeOptions({...settings,pitch:random(95,520,0),speed:random(.6,1.8),variation:random(.05,.85),brightness:random(.12,.9),breathiness:random(0,.42),roughness:random(0,.65),seed:Math.floor(Math.random()*999999),mood:random(-1,1),voiceType:random(0,1)});updateSettings();onChange();toast('A new personality. Press play to meet them.');
}

hydrateIcons();restore();buildControls();updateCharacter();updateSettings();updateTextCount();
$('#dialogue').addEventListener('input',onChange);
$('#play-button').addEventListener('click',startPlayback);
$('#wav-button').addEventListener('click',()=>{const result=prepareAudio();if(!result)return;try{download(encodeWav(result),'audio/wav',`mumble-${selected}-${settings.seed}.wav`);toast('WAV exported. Drop it into your game.');}catch(error){fail(error);}});
$('#loop-button').addEventListener('click',()=>{loop=!loop;$('#loop-button').setAttribute('aria-pressed',String(loop));toast(loop?'Loop on. Press play to keep the conversation going.':'Loop off.');});
$('#example-button').addEventListener('click',()=>{exampleIndex=(exampleIndex+1)%examples.length;$('#dialogue').value=examples[exampleIndex];onChange();});
$$('[data-punctuation]').forEach(button=>button.addEventListener('click',()=>{$('#dialogue').value=punctuationSamples[button.dataset.punctuation];onChange();void startPlayback();}));
$('#reset-button').addEventListener('click',()=>{settings=normalizeOptions({...PRESETS[selected].options,seed:42});updateSettings();onChange();toast(`${cast[selected].name} is back to their usual self.`);});
$('#randomize-button').addEventListener('click',randomize);
$('#seed-button').addEventListener('click',()=>{settings=normalizeOptions({...settings,seed:Math.floor(Math.random()*4294967295)});updateSettings();onChange();});
$('#save-preset-button').addEventListener('click',()=>{download(JSON.stringify(voiceState(),null,2),'application/json',`mumble-${selected}-voice.json`);toast('Voice settings saved as JSON.');});
$('#import-preset-button').addEventListener('click',()=>$('#preset-file').click());
$('#preset-file').addEventListener('change',async()=>{
  const input=$('#preset-file'),file=input.files[0];if(!file)return;
  try{if(file.size>50000)throw new Error('Please choose a voice JSON file smaller than 50 KB.');const value=validImport(JSON.parse(await file.text()));selected=value.preset;settings=value.options;if(value.text!==undefined)$('#dialogue').value=value.text;updateCharacter();updateSettings();onChange();toast('Voice preset loaded. Make some noise.');}catch(error){fail(error);}finally{input.value='';}
});
$$('[data-format]').forEach(button=>button.addEventListener('click',()=>{codeFormat=button.dataset.format;updateCode();}));
$('#copy-button').addEventListener('click',()=>copy(rawCode,codeFormat==='json'?'Voice JSON copied.':'Ready-to-use code copied.'));
$('#share-button').addEventListener('click',()=>{if(!textValid()){toast('Enter between 1 and 500 characters before sharing.');return;}const url=new URL(location.href);url.hash=`voice=${encodeState(voiceState())}`;copy(url.href,'Voice link copied.');});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();startPlayback();}if(event.key==='Escape'&&(playback||pending))stopPlayback();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){const wasActive=playback||pending;stopPlayback();if(wasActive)$('#audio-status').textContent='Stopped when you left the playground';}});
window.addEventListener('pagehide',event=>{stopPlayback();if(!event.persisted)void synth.dispose().catch(()=>{});});
window.addEventListener('hashchange',()=>{if(!location.hash.startsWith('#voice='))return;try{const value=validImport(decodeState(location.hash.slice(7)));selected=value.preset;settings=value.options;if(value.text!==undefined)$('#dialogue').value=value.text;updateCharacter();updateSettings();onChange();toast('Shared voice loaded.');}catch(error){fail(error);}});
new ResizeObserver(()=>drawWaveform(lastProgress)).observe($('#waveform'));
prepareAudio();
