import { getLanguage, setLanguage, t, type Language, type TranslationKey } from '../../i18n';
import '../menu/menu.css';

export interface UserSettings {
  language: Language;
  graphics: 'auto'|'low'|'high';
  sound: boolean;
  music: boolean;
  haptics: boolean;
  colorblind: boolean;
}
const KEY='airway.settings';

export function readSettings():UserSettings {
  let record:Record<string,unknown>={};
  try {
    const raw=globalThis.localStorage?.getItem(KEY);
    if(raw){ const parsed:unknown=JSON.parse(raw);if(parsed && typeof parsed==='object' && !Array.isArray(parsed))record=parsed as Record<string,unknown>; }
  } catch { /* Local storage may be denied. */ }
  return {
    language:getLanguage(),
    graphics:record.graphics==='low'||record.graphics==='high'?record.graphics:'auto',
    sound:typeof record.sound==='boolean'?record.sound:true,
    music:typeof record.music==='boolean'?record.music:true,
    haptics:typeof record.haptics==='boolean'?record.haptics:true,
    colorblind:typeof record.colorblind==='boolean'?record.colorblind:false,
  };
}

export function saveSettings(change:Partial<UserSettings>):UserSettings {
  const settings={...readSettings(),...change};
  try {
    const previous=globalThis.localStorage?.getItem(KEY);
    const parsed:unknown=previous?JSON.parse(previous):{};
    const record=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{};
    globalThis.localStorage?.setItem(KEY,JSON.stringify({...record,...settings}));
  } catch { /* Preferences still apply to this session via the calling screen. */ }
  if(change.language) setLanguage(change.language);
  return settings;
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
  function switchField(label:string,value:boolean,setting:'sound'|'music'|'haptics'|'colorblind'):void {
    const {outer,controlHost}=row(label);
    const wrap=e('label','airway-setting__switch');
    const input=e('input','');input.type='checkbox';input.checked=value;
    input.setAttribute('aria-label',label);
    input.addEventListener('change',()=>{saveSettings({[setting]:input.checked});});
    const status=e('span','',value?t('settings.on'):t('settings.off'));
    input.addEventListener('change',()=>{status.textContent=input.checked?t('settings.on'):t('settings.off');});
    wrap.append(input,status);controlHost.append(wrap);paper.append(outer);
  }
  selectField(t('settings.language'),values.language,[['pl',t('language.polish')],['en',t('language.english')]],(lang)=>{
    saveSettings({language:lang==='pl'?'pl':'en'});
    onLanguageChanged();
  });
  selectField(t('settings.graphics'),values.graphics,[['auto',t('settings.auto')],['low',t('settings.low')],['high',t('settings.high')]],(v)=>{
    saveSettings({graphics:v==='low'||v==='high'?v:'auto'});
  });
  switchField(t('settings.sound'),values.sound,'sound');
  switchField(t('settings.music'),values.music,'music');
  switchField(t('settings.haptics'),values.haptics,'haptics');
  switchField(t('settings.colorblind'),values.colorblind,'colorblind');
  paper.append(e('p','airway-setting__hint',t('settings.colorblindHint')));
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
