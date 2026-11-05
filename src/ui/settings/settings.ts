// Settings screen (task 14). One store per concern: language → i18n, text scale / glyphs / haptics →
// ui/a11y (task 20). Graphics and audio toggles live here; the composition root applies them
// (world.setQuality, audio.setSettings) through onSettingsChange.
import { getLanguage, LANGUAGES, setLanguage, t, type Language, type TranslationKey } from '../../i18n';
import { QUALITY_PREFERENCES, type GlobeMode, type QualityPreference } from '../../render';
import { readAccessibilitySettings, updateAccessibilitySettings, type TextScale } from '../a11y';
import { reducedMotion, setReducedMotion } from '../motion';
import { readAirportLabelMode, type AirportLabelMode } from '../airportLabel';
import { AIRLINE_COLOURS, airlineColourHex, applyAirlineColour, isAirlineColour, readAirlineColour, type AirlineColourId } from '../airlineColour';
import { regionGlyph } from '../glyphs';
import { REGION_IDS } from '../../data/regions';
import { SHORTCUT_HELP } from '../../input/keyboard';
import '../menu/menu.css';

export interface UserSettings {
  language: Language;
  graphics: QualityPreference;
  sound: boolean;
  music: boolean;
  haptics: boolean;
  colorblind: boolean;
  textScale: TextScale;
  /** [night-05] D-68: airport code or city name on stamps and airport labels. */
  airportLabels: AirportLabelMode;
  /** [night-09c] D-80: the player's airline colour (tail fin, livery accents, boarding pass band). */
  airlineColour: AirlineColourId;
  /** [night-11g] D-88: still the game's own motion; the system setting until the player changes it. */
  reduceMotion: boolean;
  /** [G8] D-172: Satelita (default) or Mapa; also switched by the dock tag in game. */
  globeMode: GlobeMode;
}
const KEY='airway.settings';
type LocalField='sound'|'music'|'graphics'|'airportLabels'|'airlineColour'|'globeMode';
const QUALITY:readonly QualityPreference[]=QUALITY_PREFERENCES;
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
    airportLabels:readAirportLabelMode(),
    airlineColour:readAirlineColour(),
    reduceMotion:reducedMotion(),
    globeMode:record.globeMode==='map'?'map':'satellite',
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
  if(change.reduceMotion!==undefined) setReducedMotion(change.reduceMotion);
  const local:Partial<Record<LocalField,boolean|QualityPreference|AirportLabelMode|AirlineColourId|GlobeMode>>={};
  if(change.globeMode!==undefined) local.globeMode=change.globeMode==='map'?'map':'satellite';
  if(change.sound!==undefined) local.sound=change.sound;
  if(change.music!==undefined) local.music=change.music;
  if(change.graphics!==undefined) local.graphics=change.graphics;
  if(change.airportLabels!==undefined) local.airportLabels=change.airportLabels==='name'?'name':'code';
  if(change.airlineColour!==undefined && isAirlineColour(change.airlineColour)) local.airlineColour=change.airlineColour;
  if(Object.keys(local).length){
    try { globalThis.localStorage?.setItem(KEY,JSON.stringify({...storedRecord(),...local})); }
    catch { /* Preferences still apply to this session via the listeners. */ }
  }
  const settings={...readSettings(),...local} as UserSettings;
  if(change.airlineColour!==undefined && isAirlineColour(change.airlineColour)) applyAirlineColour(change.airlineColour);
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

/** [night-12k] D-114 (R1a): the leaderboard data the settings screen can delete (src/net Leaderboards). */
export interface RankingData {
  hasData():boolean;
  deleteMyData():Promise<'deleted'|'none'|'offline'|'failed'>;
  /** [night-11v] D-197 (D-135): leaderboards configured in this build; the sharing switch is shown only then. */
  readonly enabled?:boolean;
  isSharing?():boolean;
  setSharing?(on:boolean):void;
}

/** [night-11v] D-197: the D-135 objection switch; the net layer stores it and drops queued runs when it goes off. */
function sharingRow(ranking:RankingData):HTMLElement {
  const label=t('settings.shareRanking');
  const wrap=e('div','airway-settings__share');
  wrap.dataset.testid='settings-share-ranking-row';
  const {outer,controlHost}=row(label);
  const toggle=e('label','airway-setting__switch');
  const input=e('input','');input.type='checkbox';input.checked=ranking.isSharing?.()??false;
  input.dataset.testid='settings-share-ranking';
  input.setAttribute('aria-label',label);
  const status=e('span','',input.checked?t('settings.on'):t('settings.off'));
  input.addEventListener('change',()=>{
    ranking.setSharing?.(input.checked);
    status.textContent=input.checked?t('settings.on'):t('settings.off');
  });
  toggle.append(input,status);controlHost.append(toggle);
  wrap.append(outer,e('p','airway-setting__hint',t('settings.shareRanking.hint')));
  return wrap;
}

/** [night-12k] D-114: "Delete my ranking data" → inline confirmation → the server's answer, never a faked success. */
function deleteRankingRow(ranking:RankingData):HTMLElement {
  const wrap=e('div','airway-settings__delete');
  wrap.dataset.testid='settings-delete-ranking-row';
  const start=e('button','airway-settings__licenses',t('settings.deleteRanking'));
  start.type='button';start.dataset.testid='settings-delete-ranking';
  const confirm=e('div','airway-settings__delete-confirm');
  confirm.hidden=true;
  const yes=e('button','airway-settings__licenses',t('settings.deleteRanking.confirm'));
  yes.type='button';yes.dataset.testid='settings-delete-ranking-confirm';
  const no=e('button','airway-settings__licenses',t('settings.deleteRanking.cancel'));
  no.type='button';no.dataset.testid='settings-delete-ranking-cancel';
  confirm.append(e('p','airway-setting__hint',t('settings.deleteRanking.warning')),yes,no);
  const status=e('p','airway-setting__hint');
  status.dataset.testid='settings-delete-ranking-status';
  status.setAttribute('aria-live','polite');
  start.addEventListener('click',()=>{start.hidden=true;confirm.hidden=false;status.textContent='';yes.focus({preventScroll:true});});
  no.addEventListener('click',()=>{confirm.hidden=true;start.hidden=false;start.focus({preventScroll:true});});
  yes.addEventListener('click',()=>{
    yes.disabled=true;no.disabled=true;
    status.textContent=t('settings.deleteRanking.working');
    void ranking.deleteMyData().then((result)=>{
      yes.disabled=false;no.disabled=false;
      status.textContent=t(`settings.deleteRanking.${result}` as TranslationKey);
      confirm.hidden=true;
      // Done: nothing left to delete on this device. Offline or failed: the player may try again.
      start.hidden=result==='deleted'||result==='none';
    });
  });
  wrap.append(start,confirm,status);
  return wrap;
}

export function createSettings(onBack:()=>void,onLicenses:()=>void,onLanguageChanged:()=>void,onReplayTutorial?:()=>void,onPrivacy?:()=>void,ranking?:RankingData,onTerms?:()=>void):SettingsHandle {
  const values=readSettings();
  const root=e('section','airway-settings');
  const paper=e('div','airway-settings__paper');
  const top=header(t('menu.settings'),onBack);
  paper.append(top);
  // [night-10k] Settings grouped by what they change: the game's words, the picture, sound and touch.
  const groups=e('div','airway-settings__groups');
  paper.append(groups);
  let host:HTMLElement=groups;
  function group(title:string,testId:string):void {
    const section=e('section','airway-settings__group');
    section.dataset.testid=testId;
    const heading=e('h2','airway-settings__group-title',title);
    heading.id='settings-group-'+testId;
    section.setAttribute('aria-labelledby',heading.id);
    section.append(heading);
    groups.append(section);
    host=section;
  }
  function selectField(label:string,value:string,options:Array<readonly [string,string]>,onChange:(value:string)=>void):HTMLElement {
    const {outer,controlHost}=row(label);
    const select=e('select','airway-setting__control');
    select.setAttribute('aria-label',label);
    for(const [v,name] of options){const option=e('option','',name);option.value=v;select.append(option);}
    select.value=value;select.addEventListener('change',()=>onChange(select.value));
    controlHost.append(select);host.append(outer);
    return outer;
  }
  function switchField(label:string,value:boolean,setting:'sound'|'music'|'haptics'|'colorblind'|'reduceMotion',testId:string):void {
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
    wrap.append(input,status);controlHost.append(wrap);host.append(outer);
  }
  group(t('settings.group.game'),'settings-group-game');
  selectField(t('settings.language'),values.language,LANGUAGES.entries.map((entry)=>[entry.code,t(entry.labelKey as TranslationKey)]),(lang)=>{
    saveSettings({language:LANGUAGES.normalise(lang)??LANGUAGES.fallback}); // [night-12w] R7f
    onLanguageChanged();
  });
  selectField(t('settings.airportLabels'),values.airportLabels,[['code',t('settings.airportLabels.code')],['name',t('settings.airportLabels.name')]],(v)=>{
    saveSettings({airportLabels:v==='name'?'name':'code'});
  });
  // [night-09c] D-80: the swatch beside the label shows the chosen colour; names come from i18n.
  const airlineRow=selectField(t('settings.airline'),values.airlineColour,AIRLINE_COLOURS.map((id)=>[id,t(`settings.airline.${id}` as TranslationKey)] as const),(v)=>{
    if(isAirlineColour(v)) saveSettings({airlineColour:v});
    swatch.style.background=airlineColourHex(readAirlineColour());
  });
  airlineRow.dataset.testid='settings-airline';
  const swatch=e('i','airway-setting__swatch');
  swatch.setAttribute('aria-hidden','true');
  swatch.style.background=airlineColourHex(values.airlineColour);
  airlineRow.firstElementChild?.prepend(swatch);
  group(t('settings.group.display'),'settings-group-display');
  selectField(t('settings.globeMode'),values.globeMode,[['satellite',t('settings.globeMode.satellite')],['map',t('settings.globeMode.map')]],(v)=>{
    saveSettings({globeMode:v==='map'?'map':'satellite'});
  });
  selectField(t('settings.graphics'),values.graphics,[['auto',t('settings.auto')],['saver',t('settings.saver')],['low',t('settings.low')],['medium',t('settings.medium')],['high',t('settings.high')]],(v)=>{
    saveSettings({graphics:QUALITY.includes(v as QualityPreference)?v as QualityPreference:'auto'});
  });
  selectField(t('a11y.textScale'),String(values.textScale),[['100','100%'],['115','115%'],['130','130%']],(v)=>{
    saveSettings({textScale:v==='115'?115:v==='130'?130:100});
  });
  switchField(t('settings.colorblind'),values.colorblind,'colorblind','settings-colorblind');
  host.append(e('p','airway-setting__hint',t('a11y.enhancedGlyphs')));
  switchField(t('settings.reduceMotion'),values.reduceMotion,'reduceMotion','settings-reduce-motion');
  host.append(e('p','airway-setting__hint',t('settings.reduceMotion.hint')));
  group(t('settings.group.sound'),'settings-group-sound');
  switchField(t('settings.sound'),values.sound,'sound','settings-sound');
  switchField(t('settings.music'),values.music,'music','settings-music');
  switchField(t('settings.haptics'),values.haptics,'haptics','settings-haptics');
  group(t('settings.group.help'),'settings-group-help');
  if(onReplayTutorial){
    const replay=e('button','airway-settings__licenses',t('tutorial.replay'));
    replay.type='button';replay.dataset.testid='settings-tutorial-replay';
    replay.addEventListener('click',onReplayTutorial);
    host.append(replay);
  }
  // [night-11p] D-129: the glyph legend: the shape on a luggage tag is the destination region (shape, not colour).
  const legend=e('div','airway-glyph-legend');legend.dataset.testid='settings-glyph-legend';
  legend.append(e('p','airway-glyph-legend__title',t('settings.legend')),e('p','airway-setting__hint',t('settings.legend.hint')));
  const rows=e('ul','airway-glyph-legend__rows');
  for(const region of REGION_IDS){
    const row=e('li','airway-glyph-legend__row');row.dataset.region=region;
    row.append(regionGlyph(region,20),e('span','',t(`settings.legend.${region}` as TranslationKey)));
    rows.append(row);
  }
  legend.append(rows);host.append(legend);
  host.append(shortcutList()); // [night-11ai] R4g
  const licences=e('button','airway-settings__licenses',t('settings.licenses'));
  licences.type='button';licences.dataset.testid='settings-licenses';licences.addEventListener('click',onLicenses);
  host.append(licences);
  if(onPrivacy){ // [night-11e] R1b: the privacy policy is reachable inside the app, offline.
    const privacy=e('button','airway-settings__licenses',t('settings.privacy'));
    privacy.type='button';privacy.dataset.testid='settings-privacy';
    privacy.addEventListener('click',onPrivacy);
    host.append(privacy);
  }
  if(onTerms){ // [night-11an] R7b, D-244: the terms of use, offline, like the privacy policy (D-86).
    const terms=e('button','airway-settings__licenses',t('settings.terms'));
    terms.type='button';terms.dataset.testid='settings-terms';
    terms.addEventListener('click',onTerms);
    host.append(terms);
  }
  host.append(publisherBlock()); // [night-11al] R7c, D-241
  // [night-11v] D-197 (D-135, R7l): "Send results to the leaderboard", only when this build has leaderboards.
  if(ranking?.enabled && ranking.isSharing && ranking.setSharing) host.append(sharingRow(ranking));
  // [night-12k] D-114: shown only once this device has a leaderboard identity (or a queued run).
  if(ranking?.hasData()) host.append(deleteRankingRow(ranking));
  root.append(paper);
  return {element:root,firstFocus:top.querySelector('button') as HTMLElement};
}

/**
 * [night-11ai] R4g: keyboard and mouse controls (Settings → Help). Hidden by CSS on screens where no input can hover
 * (a phone without a mouse), so touch players do not read about keys they do not have.
 */
function shortcutList():HTMLElement {
  const box=e('div','airway-keys');box.dataset.testid='settings-keys';
  box.append(e('p','airway-glyph-legend__title',t('settings.keys')));
  const rows=e('ul','airway-keys__rows');
  for(const item of SHORTCUT_HELP){
    const row=e('li','airway-keys__row');row.dataset.keys=item.label.slice('settings.keys.'.length);
    if(item.keys.length){
      const caps=e('span','airway-keys__caps');
      for(const cap of item.keys) caps.append(e('kbd','airway-keys__cap',cap.startsWith('settings.keys.')?t(cap as TranslationKey):cap));
      row.append(caps);
    }
    row.append(e('span','airway-keys__label',t(item.label)));
    rows.append(row);
  }
  box.append(rows);
  return box;
}

/** [night-11al] R7c, D-241: rows of the publisher block, as PUBLISHER_FIELDS in site/publisher.js (test:publisher). */
export const PUBLISHER_ROWS=['name','address','register','email','phone','trader'] as const;
/** Publisher / service-provider details (e-services act art. 5, the store trader card), offline, text only. */
function publisherBlock():HTMLElement {
  const box=e('div','airway-publisher');box.dataset.testid='settings-publisher';
  box.append(e('p','airway-glyph-legend__title',t('publisher.title')));
  const list=e('dl','airway-publisher__rows');
  for(const field of PUBLISHER_ROWS){
    const row=e('div','airway-publisher__row');row.dataset.field=field;
    row.append(e('dt','',t(`publisher.${field}.label` as TranslationKey)),e('dd','',t(`publisher.${field}` as TranslationKey)));
    list.append(row);
  }
  box.append(list,e('p','airway-setting__hint',t('publisher.note')));
  return box;
}

/** Data transcribed from docs/ASSETS.md; all names are displayed through i18n. */
const ASSETS: ReadonlyArray<{name:TranslationKey;license:TranslationKey}>=[
  {name:'licenses.overpass',license:'licenses.ofl'},
  {name:'licenses.overpassMono',license:'licenses.ofl'},
  {name:'licenses.atkinson',license:'licenses.ofl'},
  {name:'licenses.naturalEarth',license:'licenses.publicDomain'},
  {name:'licenses.nasaEarth',license:'licenses.publicDomain'}, // [ext-03 G1] D-170
  {name:'licenses.noaaRelief',license:'licenses.publicDomain'},
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

/** [night-11e] Sections of the in-app privacy policy, in the order of site/privacy.html (test:privacy-text). */
export const PRIVACY_SECTIONS=[1,2,3,4,5,6,7,8,9,10,11,12,13,14] as const;
/** [night-11am] R7a: a policy or terms (R7b) body is paragraphs split by a blank line; a block of "• " lines is a list (as site.js). */
export function policyBlocks(text:string):HTMLElement[] {
  return text.split(/\n\s*\n/).map((block)=>{
    const lines=block.split('\n');
    if(!lines.every((line)=>line.startsWith('• '))) return e('p','',block);
    const list=e('ul','');
    for(const line of lines) list.append(e('li','',line.slice(2)));
    return list;
  });
}
export function createPrivacy(onBack:()=>void):SettingsHandle {
  const root=e('section','airway-settings');
  const paper=e('div','airway-settings__paper airway-privacy');
  paper.dataset.testid='privacy-page';
  const top=header(t('privacy.title'),onBack);
  paper.append(top,e('p','airway-privacy__overline',t('privacy.overline')),e('p','airway-privacy__warning',t('privacy.warning')));
  for(const n of PRIVACY_SECTIONS){
    const section=e('section','airway-privacy__section');
    section.append(e('h2','',t(`privacy.s${n}.title` as TranslationKey)),...policyBlocks(t(`privacy.s${n}.body` as TranslationKey)));
    paper.append(section);
  }
  paper.append(e('p','airway-privacy__date',t('privacy.date')),e('p','airway-setting__hint',t('privacy.offline')));
  root.append(paper);
  return {element:root,firstFocus:top.querySelector('button') as HTMLElement};
}

/** [night-11an] R7b, D-244: sections of the in-app terms of use, in the order of site/terms.html (test:terms). */
export const TERMS_SECTIONS=[1,2,3,4,5,6,7,8,9,10] as const;
export function createTerms(onBack:()=>void):SettingsHandle {
  const root=e('section','airway-settings');
  const paper=e('div','airway-settings__paper airway-privacy');
  paper.dataset.testid='terms-page';
  const top=header(t('terms.title'),onBack);
  paper.append(top,e('p','airway-privacy__overline',t('terms.overline')),e('p','airway-privacy__warning',t('terms.warning')));
  for(const n of TERMS_SECTIONS){
    const section=e('section','airway-privacy__section');
    section.append(e('h2','',t(`terms.s${n}.title` as TranslationKey)),...policyBlocks(t(`terms.s${n}.body` as TranslationKey)));
    paper.append(section);
  }
  paper.append(e('p','airway-privacy__date',t('terms.date')),e('p','airway-setting__hint',t('terms.offline')));
  root.append(paper);
  return {element:root,firstFocus:top.querySelector('button') as HTMLElement};
}
