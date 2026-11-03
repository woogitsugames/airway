// Settings screen (task 14). One store per concern: language → i18n, text scale / glyphs / haptics →
// ui/a11y (task 20). Graphics and audio toggles live here; the composition root applies them
// (world.setQuality, audio.setSettings) through onSettingsChange.
import { getLanguage, setLanguage, t, type Language, type TranslationKey } from '../../i18n';
import type { QualityPreference } from '../../render';
import { readAccessibilitySettings, updateAccessibilitySettings, type TextScale } from '../a11y';
import '../menu/menu.css';

export interface UserSettings {
  language: Language;
  graphics: QualityPreference;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  colorblind: boolean;
  textScale: TextScale;
  hints: boolean; // [m2] contextual ATC hints in a run (D-54)
}
const KEY='airway.settings';
type LocalField='sound'|'music'|'graphics'|'hints'; // [m2] hints
const QUALITY:readonly QualityPreference[]=['auto','low','medium','high'];
const listeners=new Set<(settings:UserSettings)=>void>();

function storedRecord():Record<string,unknown> {
  try {
    const raw=globalThis.localStorage?.getItem(KEY);
    if(raw){ const parsed:unknown=JSON.parse(raw);if(parsed && typeof parsed==='object' && !Array.isArray(parsed))return parsed as Record<string,unknown>; }
  } catch { /* Local storage may be denied. */ }
  return {};
}

export function readSettings():UserSettings {
  const record=storedRecord();
  const a11y=readAccessibilitySettings();
  return {
    language:getLanguage(),
    graphics:QUALITY.includes(record.graphics as QualityPreference)?record.graphics as QualityPreference:'auto',
    sound:typeof record.sound==='boolean'?record.sound:true,
    music:typeof record.music==='boolean'?record.music:true,
    haptics:a11y.hapticsEnabled,
    colorblind:a11y.enhancedGlyphs,
    textScale:a11y.textScale,
    hints:typeof record.hints==='boolean'?record.hints:true, // [m2]
  };
}

/** Route each change to the module that owns it, then notify the composition root (audio). */
export function saveSettings(change:Partial<UserSettings>):UserSettings {
  if(change.language) setLanguage(change.language);
  const a11y:Parameters<typeof updateAccessibilitySettings>[0]={};
  if(change.haptics!==undefined) a11y.hapticsEnabled=change.haptics;
  if(change.colorblind!==undefined) a11y.enhancedGlyphs=change.colorblind;
  if(change.textScale!==undefined) a11y.textScale=change.textScale;
  if(Object.keys(a11y).length) updateAccessibilitySettings(a11y);
  const local:Partial<Record<LocalField,boolean|QualityPreference>>={};
  if(change.sound!==undefined) local.sound=change.sound;
  if(change.music!==undefined) local.music=change.music;
  if(change.graphics!==undefined) local.graphics=change.graphics;
  if(change.hints!==undefined) local.hints=change.hints; // [m2]
  if(Object.keys(local).length){
    try { globalThis.localStorage?.setItem(KEY,JSON.stringify({...storedRecord(),...local})); }
    catch { /* Preferences still apply to this session via the listeners. */ }
  }
  const settings={...readSettings(),...local} as UserSettings;
  listeners.forEach((listener)=>listener(settings));
  return settings;
}

export function onSettingsChange(listener:(settings:UserSettings)=>void):()=>void {
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
}

function e<K extends keyof HTMLElementTagNameMap>(tag:K,klass:string,text?:string):HTMLElementTagNameMap[K]{
  const node=document.createElement(tag);node.className=klass;
  if(text!==undefined)node.textContent=text;
  return node;
}
function row(label:string):{outer:HTMLElement;controlHost:HTMLElement}{
  const outer=e('div','airway-setting');
  outer.append(e('span','',label));
  const controlHost=e('span','');
  outer.append(controlHost);
  return {outer,controlHost};
}
function header(title:string,onBack:()=>void):HTMLElement {
  const bar=e('div','airway-settings__heading');
  const back=e('button','airway-settings__back',t('action.back'));
  back.type='button';back.addEventListener('click',onBack);
  bar.append(back,e('h1','',title));
  return bar;
}

export interface SettingsHandle { readonly element:HTMLElement; readonly firstFocus:HTMLElement; }

export function createSettings(onBack:()=>void,onLicenses:()=>void,onLanguageChanged:()=>void,onReplayTutorial?:()=>void):SettingsHandle {
  const values=readSettings();
  const root=e('section','airway-settings');
  const paper=e('div','airway-settings__paper');
  const top=header(t('menu.settings'),onBack);
  paper.append(top);
  function selectField(label:string,value:string,options:Array<readonly [string,string]>,onChange:(value:string)=>void):void {
    const {outer,controlHost}=row(label);
    const select=e('select','airway-setting__control');
    select.setAttribute('aria-label',label);
    for(const [v,name] of options){const option=e('option','',name);option.value=v;select.append(option);}
    select.value=value;select.addEventListener('change',()=>onChange(select.value));
    controlHost.append(select);paper.append(outer);
  }
  function switchField(label:string,value:boolean,setting:'sound'|'music'|'haptics'|'colorblind'|'hints',testId:string):void {
    const {outer,controlHost}=row(label);
    const wrap=e('label','airway-setting__switch');
    const input=e('input','');input.type='checkbox';input.checked=value;
    input.dataset.testid=testId;
    input.setAttribute('aria-label',label);
    const status=e('span','',value?t('settings.on'):t('settings.off'));
    input.addEventListener('change',()=>{
      saveSettings({[setting]:input.checked});
      status.textContent=input.checked?t('settings.on'):t('settings.off');
    });
    wrap.append(input,status);controlHost.append(wrap);paper.append(outer);
  }
  selectField(t('settings.language'),values.language,[['pl',t('language.polish')],['en',t('language.english')]],(lang)=>{
    saveSettings({language:lang==='pl'?'pl':'en'});
    onLanguageChanged();
  });
  selectField(t('settings.graphics'),values.graphics,[['auto',t('settings.auto')],['low',t('settings.low')],['medium',t('settings.medium')],['high',t('settings.high')]],(v)=>{
    saveSettings({graphics:v==='low'||v==='medium'||v==='high'?v:'auto'});
  });
  selectField(t('a11y.textScale'),String(values.textScale),[['100','100%'],['115','115%'],['130','130%']],(v)=>{
    saveSettings({textScale:v==='115'?115:v==='130'?130:100});
  });
  switchField(t('settings.sound'),values.sound,'sound','settings-sound');
  switchField(t('settings.music'),values.music,'music','settings-music');
  switchField(t('settings.haptics'),values.haptics,'haptics','settings-haptics');
  switchField(t('settings.hints'),values.hints,'hints','settings-hints'); // [m2]
  switchField(t('settings.colorblind'),values.colorblind,'colorblind','settings-colorblind');
  paper.append(e('p','airway-setting__hint',t('a11y.enhancedGlyphs')));
  if(onReplayTutorial){
    const replay=e('button','airway-settings__licenses',t('tutorial.replay'));
    replay.type='button';replay.dataset.testid='settings-tutorial-replay';
    replay.addEventListener('click',onReplayTutorial);
    paper.append(replay);
  }
  const licences=e('button','airway-settings__licenses',t('settings.licenses'));
  licences.type='button';licences.addEventListener('click',onLicenses);
  paper.append(licences);root.append(paper);
  return {element:root,firstFocus:top.querySelector('button') as HTMLElement};
}

/** Data transcribed from docs/ASSETS.md; all names are displayed through i18n. */
const ASSETS: ReadonlyArray<{name:TranslationKey;license:TranslationKey}>=[
  {name:'licenses.overpass',license:'licenses.ofl'},
  {name:'licenses.overpassMono',license:'licenses.ofl'},
  {name:'licenses.atkinson',license:'licenses.ofl'},
  {name:'licenses.naturalEarth',license:'licenses.publicDomain'},
  {name:'licenses.worldAtlas',license:'licenses.isc'},
  {name:'licenses.three',license:'licenses.mit'},
];
export function createLicenses(onBack:()=>void):SettingsHandle {
  const root=e('section','airway-settings');
  const paper=e('div','airway-settings__paper airway-licenses');
  const top=header(t('settings.licenses'),onBack);
  paper.append(top,e('p','',t('licenses.intro')));
  const list=e('ul','');
  for(const asset of ASSETS){
    const item=e('li','');
    item.append(e('strong','',t(asset.name)),e('span','',t(asset.license)));
    list.append(item);
  }
  paper.append(list);root.append(paper);
  return {element:root,firstFocus:top.querySelector('button') as HTMLElement};
}
