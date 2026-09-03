package app.fitfly.mobile.stepcounter;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * The JS-facing half of real background step counting — see
 * StepCounterService's own header comment for why a foreground service
 * is what actually makes this survive a locked screen. This plugin
 * itself does no sensing at all; it only starts/stops that service and
 * reads back whatever it has genuinely, cumulatively persisted, plus
 * relays the service's own live updates as a real Capacitor event while
 * this plugin instance is alive.
 */
@CapacitorPlugin(
    name = "FitFlyStepCounter",
    permissions = { @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = "activityRecognition") }
)
public class FitFlyStepCounterPlugin extends Plugin implements StepCounterService.UpdateListener {

    private static final String PERMISSION_GRANTED = "granted";
    private static final String PERMISSION_DENIED = "denied";
    private static final String PERMISSION_PROMPT = "prompt";

    @Override
    public void load() {
        StepCounterService.setUpdateListener(this);
    }

    @Override
    public void handleOnDestroy() {
        StepCounterService.setUpdateListener(null);
        super.handleOnDestroy();
    }

    @Override
    public void onTodayStepCountChanged(int todaySteps) {
        JSObject data = new JSObject();
        data.put("steps", todaySteps);
        notifyListeners("stepCountChanged", data);
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("activityRecognition", permissionStateString());
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && getPermissionState("activityRecognition") != PermissionState.GRANTED) {
            requestPermissionForAlias("activityRecognition", call, "permissionCallback");
        } else {
            JSObject result = new JSObject();
            result.put("activityRecognition", permissionStateString());
            call.resolve(result);
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("activityRecognition", permissionStateString());
        call.resolve(result);
    }

    @PluginMethod
    public void startBackgroundCounting(PluginCall call) {
        Intent intent = new Intent(getContext(), StepCounterService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopBackgroundCounting(PluginCall call) {
        getContext().stopService(new Intent(getContext(), StepCounterService.class));
        call.resolve();
    }

    @PluginMethod
    public void getTodayStepCount(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(StepCounterService.PREFS_NAME, Context.MODE_PRIVATE);
        String today = todayIsoDate();
        String baselineDate = prefs.getString(StepCounterService.KEY_BASELINE_DATE, null);
        int rawTotal = prefs.getInt(StepCounterService.KEY_RAW_TOTAL_SINCE_BOOT, -1);

        JSObject result = new JSObject();
        if (rawTotal < 0 || !today.equals(baselineDate)) {
            // No reading yet today — the service hasn't run since local
            // midnight, or hasn't ever run. An honest zero, never a
            // fabricated number.
            result.put("steps", 0);
            result.put("hasReading", false);
        } else {
            int baseline = prefs.getInt(StepCounterService.KEY_BASELINE_RAW_TOTAL, rawTotal);
            result.put("steps", Math.max(0, rawTotal - baseline));
            result.put("hasReading", true);
        }
        call.resolve(result);
    }

    private String permissionStateString() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return PERMISSION_GRANTED;
        PermissionState state = getPermissionState("activityRecognition");
        if (state == null) return PERMISSION_PROMPT;
        switch (state) {
            case GRANTED:
                return PERMISSION_GRANTED;
            case DENIED:
                return PERMISSION_DENIED;
            default:
                return PERMISSION_PROMPT;
        }
    }

    private static String todayIsoDate() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        return fmt.format(new Date());
    }
}
