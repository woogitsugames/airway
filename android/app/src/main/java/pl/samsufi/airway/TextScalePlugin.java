package pl.samsufi.airway;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * [night-11ap] R1g: the system font scale (Settings → Display → Font size), read once by the web game on first
 * launch to preset its own text size (src/platform/textScale.ts). The WebView keeps textZoom 100, so the game's
 * setting is the only scale applied and an explicit choice in the game always wins.
 */
@CapacitorPlugin(name = "AirwayTextScale")
public class TextScalePlugin extends Plugin {
    @PluginMethod
    public void get(PluginCall call) {
        JSObject result = new JSObject();
        result.put("scale", getContext().getResources().getConfiguration().fontScale);
        call.resolve(result);
    }
}
