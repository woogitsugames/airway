package pl.samsufi.airway;

import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

/**
 * [night-12ay] R3i (D-245): Firebase Test Lab game loop. Test Lab starts MainActivity with
 * com.google.intent.action.TEST_LOOP, an int extra "scenario" and the result file as the intent data URI.
 * The web game asks launch(), plays the scenario (src/main.ts runGameLoop) and calls finish(report): the JSON
 * goes to the result file and the activity finishes. A watchdog finishes the run if the game never reports.
 */
@CapacitorPlugin(name = "AirwayGameLoop")
public class GameLoopPlugin extends Plugin {
    static final String ACTION = "com.google.intent.action.TEST_LOOP";
    /** Longest scenario (120 s) plus boot, WebView start and margin; Test Lab's own timeout is longer. */
    static final long WATCHDOG_MS = 300_000L;
    private static final String TAG = "AirwayGameLoop";
    private static final String TIMEOUT_REPORT = "{\"schema\":1,\"kind\":\"game-loop\",\"error\":\"timeout\"}\n";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean finished;

    static boolean isGameLoop(Intent intent) {
        return intent != null && ACTION.equals(intent.getAction());
    }

    @Override
    public void load() {
        if (isGameLoop(getActivity().getIntent())) {
            handler.postDelayed(() -> writeAndFinish(TIMEOUT_REPORT), WATCHDOG_MS);
        }
    }

    @PluginMethod
    public void launch(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject result = new JSObject();
        boolean active = isGameLoop(intent);
        result.put("active", active);
        if (active) result.put("scenario", intent.getIntExtra("scenario", 1));
        call.resolve(result);
    }

    @PluginMethod
    public void finish(PluginCall call) {
        if (!isGameLoop(getActivity().getIntent())) {
            call.reject("Not started as a game loop");
            return;
        }
        String report = call.getString("report", "");
        call.resolve();
        getActivity().runOnUiThread(() -> writeAndFinish(report));
    }

    private void writeAndFinish(String report) {
        if (finished) return;
        finished = true;
        handler.removeCallbacksAndMessages(null);
        Uri result = getActivity().getIntent().getData();
        if (result != null) {
            try (AssetFileDescriptor file = getContext().getContentResolver().openAssetFileDescriptor(result, "w");
                 FileOutputStream out = file.createOutputStream()) {
                out.write(report.getBytes(StandardCharsets.UTF_8));
            } catch (Exception error) {
                Log.w(TAG, "Game-loop result file not written", error);
            }
        }
        getActivity().finish();
    }
}
