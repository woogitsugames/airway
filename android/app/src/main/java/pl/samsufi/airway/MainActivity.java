package pl.samsufi.airway;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // Android's back dispatcher delivers one cancelable event to the web game
    // (src/platform/back.ts). If no screen consumes it, the task moves to the
    // background like a launcher root activity instead of being destroyed.
    private static final String DISPATCH_BACK =
        "String(!window.dispatchEvent(new Event('airway:android-back', { cancelable: true })))";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final Bridge current = getBridge();
                if (current == null || current.getWebView() == null) {
                    moveTaskToBack(true);
                    return;
                }
                current.getWebView().evaluateJavascript(DISPATCH_BACK, (handled) -> {
                    // evaluateJavascript returns a JSON-encoded string: "\"true\"" when consumed.
                    if (handled == null || !handled.contains("true")) moveTaskToBack(true);
                });
            }
        });
    }
}
