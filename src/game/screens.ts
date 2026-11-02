// [task-14] Accessible menu/settings screen router. Game modes are callback-only until task 17.
import { t } from '../i18n';
import { installBackHandler, type BackOptions } from '../platform/back';
import { createMenu, type MenuData, type MenuMode } from '../ui/menu/menu';
import { createSettings, createLicenses } from '../ui/settings/settings';

export type ScreenName='menu'|'settings'|'licenses';
export interface ScreensOptions {
  readonly getMenuData?:()=>MenuData;
  readonly onMode?: (mode:MenuMode)=>void;
  readonly back?:BackOptions;
}
export interface ScreensHandle {
  readonly current:()=>ScreenName;
  show:(screen:ScreenName)=>void;
  refresh:()=>void;
  dispose:()=>void;
}

export function mountScreens(host:HTMLElement,options:ScreensOptions={}):ScreensHandle {
  const layer=document.createElement('div');
  layer.className='airway-screen-root';
  host.append(layer);
  const menu=createMenu((mode)=>{
    if(mode==='settings')return show('settings');
    if(options.onMode)options.onMode(mode);
    else menu.announce(t('menu.unavailable'));
  },options.getMenuData?.());
  let name:ScreenName='menu';
  let active:HTMLElement=menu.element;
  layer.append(active);
  let previousFocus:HTMLElement|null=null;
  const show=(screen:ScreenName, force=false):void=>{
    if(screen===name && !force)return;
    if(name==='menu')previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const old=active;
    name=screen;
    if(screen==='menu'){
      menu.refresh(options.getMenuData?.());
      active=menu.element;
    } else if(screen==='settings'){
      const view=createSettings(()=>show('menu'),()=>show('licenses'),()=>show('settings',true));
      active=view.element;
    } else {
      active=createLicenses(()=>show('settings')).element;
    }
    old.remove();layer.append(active);
    if(screen==='menu'){
      previousFocus?.focus({preventScroll:true});
    }else{
      const back=active.querySelector<HTMLElement>('.airway-settings__back');
      back?.focus({preventScroll:true});
    }
  };
  const back=():void=>{
    if(name==='licenses')show('settings');
    else if(name==='settings')show('menu');
    // On the root menu the OS owns app exit.
  };
  const removeBack=installBackHandler(back,options.back);
  return {current:()=>name,show,refresh:()=>menu.refresh(options.getMenuData?.()),dispose:()=>{removeBack();menu.dispose();layer.remove();}};
}
