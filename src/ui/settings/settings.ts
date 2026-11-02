// Settings screen (task 14). One store per concern: language → i18n, graphics → render/quality,
// text scale / glyphs / haptics → ui/a11y (task 20). Only audio toggles live in this module.
import { getLanguage, setLanguage, t, type Language, type TranslationKey } from '../../i18n';
import { readQualityPreference, saveQualityPreference, type QualityPreference } from '../../render/quality';
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
}
const KEY='airway.settings';
type AudioField='sound'|'music';
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
    graphics:readQualityPreference(),
    sound:typeof record.sound==='boolean'?record.sound:true,
    music:typeof record.music==='boolean'?record.music:true,
    haptics:a11y.hapticsEnabled,
    colorblind:a11y.enhancedGlyphs,
    textScale:a11y.textScale,
  };
}

/** Route each change to the module that owns it, then notify the composition root (audio). */
export function saveSettings(change:Partial<UserSettings>):UserSettings {
  if(change.language) setLanguage(change.language);
  if(change.graphics) saveQualityPreference(change.graphics);
  const a11y:Parameters<typeof updateAccessibilitySettings>[0]={};
  if(change.haptics!==undefined) a11y.hapticsEnabled=change.haptics;
  if(change.colorblind!==undefined) a11y.enhancedGlyphs=change.colorblind;
  if(change.textScale!==undefined) a11y.textScale=change.textScale;
  if(Object.keys(a11y).length) updateAccessibilitySettings(a11y);
  const audio:Partial<Record<AudioField,boolean>>={};
  if(change.sound!==undefined) audio.sound=change.sound;
  if(change.music!==undefined) audio.music=change.music;
  if(Object.keys(audio).length){
    try { globalThis.localStorage?.setItem(KEY,JSON.stringify({...storedRecord(),...audio})); }
    catch { /* Preferences still apply to this session via the listeners. */ }
  }
  const settings=readSettings();
  if(change.sound!==undefined) settings.sound=change.sound;
  if(change.music!==undefined) settings.music=change.music;
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

export function createSettings(onBack:()=>void,onLicenses:()=>void,onLanguageChanged:()=>void):SettingsHandle {
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
  function switchField(label:string,value:boolean,setting:'sound'|'music'|'haptics'|'colorblind',testId:string):void {
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
  switchField(t('settings.colorblind'),values.colorblind,'colorblind','settings-colorblind');
  paper.append(e('p','airway-setting__hint',t('a11y.enhancedGlyphs')));
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
