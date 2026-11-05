import { localNumber, t, type TranslationKey } from '../../i18n';
import { SplitFlap } from '../flap';
import { FLAP_CELLS } from '../../i18n/limits'; // [night-11ac] R7h: the same cell counts as the length budgets
import type { RegionId } from '../../data/regions';
import type { LicenceClass } from '../../sim';
import '../skin/current.css'; // [night-11aq] skin tokens read by menu.css
import './menu.css';
import { skinPreview, kartaScale } from '../skin/preview'; // [night-11av] D-256, [night-11ax] D-257: KARTA skin helpers

export type MenuMode = 'continue' | 'endless' | 'puzzles' | 'daily';
export interface MenuData {
  readonly bestPassengers?: number | null;
  readonly solvedPuzzles?: number;
  readonly totalPuzzles?: number;
  readonly today?: Date;
  readonly dailyNew?: boolean;
  /** [night-10d] Subtitle of the daily row (today's score / streak); the generic hint when absent. */
  readonly dailyHint?: string;
  /** A resumable saved flight; adds the CONTINUE row on top of the board. */
  readonly saved?: { readonly week: number; readonly passengers: number } | null;
  /** [night-10c] One-line paper notice under the sign (e.g. a saved flight that cannot be continued). */
  readonly notice?: string | null;
  /**
   * [night-11aj] R2g: the Endless home-region choice. `regions` are the offered regions (Random is always first);
   * without them the Endless row has no select. `homeRegion` null = Random.
   */
  readonly homeRegions?: readonly RegionId[];
  readonly homeRegion?: RegionId | null;
  /**
   * [night-12bc] R2h, D-251: the open licence classes (class I first). With more than one, the Endless row's gate
   * cell becomes the licence stamp select; `licence` is the chosen class.
   */
  readonly licences?: readonly LicenceClass[];
  readonly licence?: LicenceClass;
}
export interface MenuHandle {
  readonly element: HTMLElement;
  refresh(data?: MenuData): void;
  announce(text: string): void;
  dispose(): void;
}
export type MenuService = 'settings' | 'logbook';
interface Flight {
  readonly id: MenuMode | MenuService;
  readonly gate: string;
  readonly title: string;
  readonly sub: string;
  readonly status: string;
  readonly hot?: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node=document.createElement(tag);
  node.className=className;
  if (text!==undefined) node.textContent=text;
  return node;
}
function formatDay(day: Date): string {
  return String(day.getDate()).padStart(2,'0')+'.'+String(day.getMonth()+1).padStart(2,'0');
}
function flightRows(data: MenuData): Flight[] {
  const puzzlesTotal=data.totalPuzzles ?? 0;
  const record=data.bestPassengers;
  const rows:Flight[]=[];
  if(data.saved) rows.push({id:'continue',gate:'A0',title:t('menu.continue'),sub:t('menu.continueHint',{week:data.saved.week,count:localNumber(data.saved.passengers)}),status:t('menu.boarding'),hot:true});
  return [...rows,
    {id:'endless',gate:'A1',title:t('menu.endless'),sub:record==null?t('menu.noRecord'):t('menu.record',{count:localNumber(record)}),status:t('menu.boarding'),hot:!data.saved},
    {id:'puzzles',gate:'B4',title:t('menu.puzzles'),sub:puzzlesTotal?t('menu.progress',{solved:data.solvedPuzzles ?? 0,total:puzzlesTotal}):t('menu.puzzlesHint'),status:t('menu.onTime')},
    {id:'daily',gate:'C2',title:t('menu.today',{date:formatDay(data.today ?? new Date())}),sub:data.dailyHint ?? t('menu.dailyHint'),status:data.dailyNew===false?t('menu.onTime'):t('menu.new')},
    // [night-10n] Service row: settings and the logbook share the last line, so the board keeps its height.
    {id:'settings',gate:'D0',title:t('menu.settings'),sub:'',status:''},
    {id:'logbook',gate:'D1',title:t('menu.logbook'),sub:'',status:''},
  ];
}

const REGION_SHORT:Record<RegionId,TranslationKey>={
  NAM:'region.short.NAM',SAM:'region.short.SAM',EUN:'region.short.EUN',EUS:'region.short.EUS',
  AFR:'region.short.AFR',ME:'region.short.ME',ASI:'region.short.ASI',OCE:'region.short.OCE',
};
const REGION_NAME:Record<RegionId,TranslationKey>={
  NAM:'region.name.NAM',SAM:'region.name.SAM',EUN:'region.name.EUN',EUS:'region.name.EUS',
  AFR:'region.name.AFR',ME:'region.name.ME',ASI:'region.name.ASI',OCE:'region.name.OCE',
};

/**
 * [night-11aj] R2g: the home-region select takes the Endless row's status cell (the board keeps its height). A
 * native select: the system picker on phones, keyboard and screen readers for free; the closed cell shows the
 * short name, the picker lists the full ones through each option's label.
 */
function regionSelect(regions:readonly RegionId[],selected:RegionId|null,onChange:(region:RegionId|null)=>void):HTMLSelectElement {
  const select=el('select','airway-flight__region');
  select.dataset.testid='menu-home-region';
  const fill=(current:RegionId|null):void => {
    select.replaceChildren();
    const random=el('option','',t('menu.homeRegion.random'));random.value='random';
    select.append(random);
    for(const region of regions){
      const option=el('option','',t(REGION_SHORT[region]));
      option.value=region;option.label=t(REGION_SHORT[region]);option.title=t(REGION_NAME[region]);
      option.setAttribute('aria-label',t(REGION_NAME[region]));
      select.append(option);
    }
    select.value=current && regions.includes(current)?current:'random';
    select.setAttribute('aria-label',t('menu.homeRegion'));
    select.title=t('menu.homeRegion');
  };
  fill(selected);
  select.addEventListener('change',()=>{ onChange(select.value==='random'?null:select.value as RegionId); });
  (select as HTMLSelectElement&{refill?:typeof fill}).refill=fill;
  return select;
}

const LICENCE_SHORT:Record<LicenceClass,TranslationKey>={1:'licence.short.1',2:'licence.short.2',3:'licence.short.3'};
const LICENCE_NAME:Record<LicenceClass,TranslationKey>={1:'licence.name.1',2:'licence.name.2',3:'licence.name.3'};

/**
 * [night-12bc] R2h: the licence stamp takes the Endless row's gate cell once class II is open (the board keeps its
 * height and columns). A native select like the home region: the closed cell shows the class numeral, the picker
 * lists each class with what it changes.
 */
function licenceSelect(open:readonly LicenceClass[],selected:LicenceClass,onChange:(licence:LicenceClass)=>void):HTMLSelectElement {
  const select=el('select','airway-flight__region airway-flight__licence');
  select.dataset.testid='menu-licence';
  const fill=(classes:readonly LicenceClass[],current:LicenceClass):void => {
    select.replaceChildren();
    for(const licence of classes){
      const option=el('option','',t(LICENCE_SHORT[licence]));
      option.value=String(licence);option.title=t(LICENCE_NAME[licence]);
      option.setAttribute('aria-label',t(LICENCE_NAME[licence]));
      select.append(option);
    }
    select.value=String(classes.includes(current)?current:1);
    select.setAttribute('aria-label',t('menu.licence'));
    select.title=t('menu.licence');
  };
  fill(open,selected);
  // The closed stamp shows the numeral; while the picker is open each option names what its class changes.
  const names=(full:boolean):void => {
    for(const option of select.options){
      const licence=Number(option.value) as LicenceClass;
      option.textContent=t(full?LICENCE_NAME[licence]:LICENCE_SHORT[licence]);
    }
  };
  select.addEventListener('pointerdown',()=>names(true));
  select.addEventListener('blur',()=>names(false));
  select.addEventListener('change',()=>{ names(false); onChange(Number(select.value) as LicenceClass); });
  (select as HTMLSelectElement&{refill?:typeof fill}).refill=fill;
  return select;
}

function ariaLabel(flight:Flight):string {
  return flight.status ? `${flight.title}, ${t('menu.gate')} ${flight.gate}, ${flight.status}` : `${flight.title}, ${t('menu.gate')} ${flight.gate}`;
}

function makeSign():HTMLElement {
  const sign=el('div','airway-sign');
  const symbol=el('div','airway-sign__pictogram');
  // Original top-down aircraft silhouette; no icon packs or image assets.
  symbol.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path fill="currentColor" d="M30 5c0-3 4-3 4 0l2 20 21 13v6L36 38l-1 12 8 6v4L32 57l-11 3v-4l8-6-1-12-21 6v-6l21-13z"/></svg>';
  const titleBox=el('div','airway-sign__copy');
  titleBox.append(el('div','airway-sign__title',t('app.title')),el('div','airway-sign__subtitle',t('menu.terminal')));
  sign.append(symbol,titleBox);
  // [night-11av] D-256, DEV-only KARTA preview: the title block carries the chart's graphic scale.
  if (skinPreview.karta) sign.append(kartaScale());
  return sign;
}

/** Presentation-only departure board; the router in src/game/screens.ts handles each row. */
export function createMenu(onFlight:(mode:MenuMode|MenuService)=>void,initial:MenuData={},
    onHomeRegion?:(region:RegionId|null)=>void,onLicence?:(licence:LicenceClass)=>void):MenuHandle {
  const root=el('section','airway-menu');
  root.setAttribute('aria-label',t('menu.departures'));
  // The shared world canvas (src/game/world.ts) is the backdrop; the menu owns no WebGL context.
  root.append(makeSign());
  const board=el('nav','airway-board');
  board.setAttribute('aria-label',t('menu.departures'));
  const header=el('div','airway-board__header');
  header.append(el('span','',t('menu.departures')),el('span','',t('menu.gate')),el('span','',t('menu.status')));
  board.append(header);
  const notice=el('div','airway-notice');
  notice.setAttribute('role','status');
  notice.hidden=true;
  const flaps:SplitFlap[]=[];
  const items=new Map<Flight['id'],{title:SplitFlap;gate:SplitFlap;status:SplitFlap;sub:HTMLElement}>();
  const service=el('div','airway-board__service');
  let region:(HTMLSelectElement&{refill?:(current:RegionId|null)=>void})|null=null;
  let licence:(HTMLSelectElement&{refill?:(open:readonly LicenceClass[],current:LicenceClass)=>void})|null=null;
  for(const flight of flightRows(initial)) {
    const half=flight.id==='settings'||flight.id==='logbook';
    const button=el('button',half?'airway-flight airway-flight--half':'airway-flight');
    button.type='button';
    button.dataset.mode=flight.id;
    button.dataset.testid='menu-'+flight.id;
    const main=el('span','airway-flight__main');
    const title=new SplitFlap(flight.title,{highlight:flight.hot,initialAnimation:true,maxCells:half?FLAP_CELLS.half:FLAP_CELLS.title});
    const gate=new SplitFlap(flight.gate,{initialAnimation:true,maxCells:FLAP_CELLS.gate});
    const status=new SplitFlap(flight.status,{highlight:flight.hot,initialAnimation:true,maxCells:FLAP_CELLS.status});
    flaps.push(title,gate,status);
    const sub=el('span','airway-flight__sub',flight.sub);
    if(!flight.sub) sub.hidden=true;
    main.append(title.element,sub);
    const gateWrap=el('span','airway-flight__gate');gateWrap.append(gate.element);
    const statusWrap=el('span','airway-flight__status');statusWrap.append(status.element);
    const withRegion=flight.id==='endless' && !!initial.homeRegions?.length && !!onHomeRegion;
    // [night-12bc] R2h: with a second licence class open, the licence select replaces the decorative gate.
    const withLicence=withRegion && (initial.licences?.length ?? 0)>1 && !!onLicence;
    if(withLicence) button.append(main);
    else if(half || withRegion) button.append(main,gateWrap); else button.append(main,gateWrap,statusWrap);
    button.setAttribute('aria-label',ariaLabel(flight));
    button.addEventListener('click',()=>onFlight(flight.id));
    if(withRegion){
      // [night-11aj] R2g: one board row = the Endless button (title + gate) and the home-region select.
      const line=el('div','airway-flight-line');
      button.classList.add('airway-flight--with-region');
      region=regionSelect(initial.homeRegions!,initial.homeRegion ?? null,(choice)=>onHomeRegion!(choice));
      const cell=el('span','airway-flight__status airway-flight__region-cell');
      cell.append(region);
      if(withLicence){
        line.classList.add('airway-flight-line--licence');
        button.classList.add('airway-flight--with-licence');
        licence=licenceSelect(initial.licences!,initial.licence ?? 1,(choice)=>onLicence!(choice));
        const stamp=el('span','airway-flight__gate airway-flight__licence-cell');
        stamp.append(licence);
        line.append(button,stamp,cell);
      } else line.append(button,cell);
      board.append(line);
    }
    else if(half) service.append(button); else board.append(button);
    items.set(flight.id,{title,gate,status,sub});
  }
  board.append(service);
  root.append(board,notice);
  const applyNotice=(data:MenuData):void => {
    if(data.notice===undefined) return;
    notice.textContent=data.notice ?? '';
    notice.hidden=!data.notice;
  };
  applyNotice(initial);
  return {
    element:root,
    refresh(data:MenuData=initial):void {
      initial=data;
      applyNotice(data);
      root.setAttribute('aria-label',t('menu.departures'));
      const headers=header.children;
      (headers[0] as HTMLElement).textContent=t('menu.departures');
      (headers[1] as HTMLElement).textContent=t('menu.gate');
      (headers[2] as HTMLElement).textContent=t('menu.status');
      for(const flight of flightRows(data)) {
        const item=items.get(flight.id);
        if(!item)continue;
        item.title.set(flight.title);
        item.gate.set(flight.gate);
        item.status.set(flight.status);
        item.sub.textContent=flight.sub;
        item.sub.hidden=!flight.sub;
        const button=item.title.element.closest('button');
        button?.setAttribute('aria-label',ariaLabel(flight));
      }
      if(region && data.homeRegions) region.refill?.(data.homeRegion ?? null);
      if(licence && data.licences) licence.refill?.(data.licences,data.licence ?? 1);
    },
    announce(message:string):void { notice.textContent=message; notice.hidden=false; },
    dispose():void { flaps.forEach(f=>f.dispose());root.remove(); },
  };
}
