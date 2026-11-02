package pl.samsufi.airway;

import android.os.Bundle;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // [task-24] Android's back dispatcher delivers a single event to the web game.
    // Task 16/14 will register the gameplay/menu policy in src/platform/back.ts.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                final Bridge current = getBridge();
                if (current != null && current.getWebView() != null) {
                    current.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new Event('airway:android-back'))", null
                    );
                }
            }
        });
    }
}
