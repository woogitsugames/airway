// [task-14] Hardware back adapter. Task 16 can inject @capacitor/app's backButton listener.
export type RemoveBackListener = () => void;
export type RegisterNativeBack = (callback:()=>void)=>RemoveBackListener;

export interface BackOptions {
  registerNativeBack?: RegisterNativeBack;
  browserHistory?: boolean;
}

/** Back reaches the screen router before the native app can exit. */
export function installBackHandler(onBack:()=>void,options:BackOptions={}):RemoveBackListener {
  const onKey=(event:KeyboardEvent):void=>{
    if(event.key!=='Escape' && event.key!=='BrowserBack')return;
    event.preventDefault();onBack();
  };
  const onCordovaBack=(event:Event):void=>{event.preventDefault();onBack();};
  const onPop=():void=>onBack();
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
