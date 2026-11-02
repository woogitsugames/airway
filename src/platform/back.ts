// [task-14] Hardware back adapter. Task 16 can inject @capacitor/app's backButton listener.
export type RemoveBackListener = () => void;
export type RegisterNativeBack = (callback:()=>boolean)=>RemoveBackListener;

export interface BackOptions {
  registerNativeBack?: RegisterNativeBack;
  browserHistory?: boolean;
}

/** Back reaches the screen router before the native app can exit. */
export function installBackHandler(onBack:()=>boolean,options:BackOptions={}):RemoveBackListener {
  const onKey=(event:KeyboardEvent):void=>{
    if(event.key!=='Escape' && event.key!=='BrowserBack')return;
    if(onBack())event.preventDefault();
  };
  const onCordovaBack=(event:Event):void=>{if(onBack())event.preventDefault();};
  const onPop=():void=>{void onBack();};
  window.addEventListener('keydown',onKey);
  document.addEventListener('backbutton',onCordovaBack);
  if(options.browserHistory)window.addEventListener('popstate',onPop);
  const detachNative=options.registerNativeBack?.(onBack);
  return ()=>{
    window.removeEventListener('keydown',onKey);
    document.removeEventListener('backbutton',onCordovaBack);
    if(options.browserHistory)window.removeEventListener('popstate',onPop);
    detachNative?.();
  };
}

// [task-24] Minimal native Android back event adapter.
// Task 14/16 owns the actual menu/pause/exit policy and will install a handler here.
export const ANDROID_BACK_EVENT = 'airway:android-back';

export function onAndroidBack(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event): void => {
    event.preventDefault();
    handler();
  };
  window.addEventListener(ANDROID_BACK_EVENT, listener);
  return () => window.removeEventListener(ANDROID_BACK_EVENT, listener);
}
