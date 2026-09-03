package app.fitfly.mobile.stepcounter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import app.fitfly.mobile.R;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Keeps Sensor.TYPE_STEP_COUNTER registered for the entire time this
 * service is alive — including with the screen locked or the app fully
 * backgrounded — which a plain Activity-scoped SensorEventListener
 * cannot do (Android tears those down well before a real background
 * step count would be useful; a couple of off-the-shelf Capacitor
 * pedometer plugins were tried first and rejected for exactly this —
 * they unregister on the host Activity's onPause). A foreground service
 * with a persistent notification is the same architecture
 * @capacitor-community/background-geolocation already uses for Run's
 * GPS tracking, applied to Steps instead: the OS keeps this process
 * (and its sensor registration) alive specifically because there's a
 * visible, ongoing notification explaining why.
 *
 * Every reading here is a genuine, real hardware-reported cumulative
 * step count since the device last booted — never estimated or
 * interpolated — persisted to SharedPreferences so
 * FitFlyStepCounterPlugin can answer "how many steps today" at any
 * later time without this service needing to still be running at query
 * time, only to have run continuously since the last local-midnight
 * rollover.
 */
public class StepCounterService extends Service implements SensorEventListener {
    public static final String PREFS_NAME = "fitfly_step_counter";
    public static final String KEY_RAW_TOTAL_SINCE_BOOT = "rawTotalSinceBoot";
    public static final String KEY_BASELINE_DATE = "baselineDate";
    public static final String KEY_BASELINE_RAW_TOTAL = "baselineRawTotal";

    private static final String CHANNEL_ID = "fitfly_step_counter_channel";
    private static final int NOTIFICATION_ID = 8471;

    /** Notifies the running plugin instance of a fresh reading, if one is
     *  listening — a live "steps so far today" update while the app is
     *  actually open, on top of the real background persistence above.
     *  Never the other way around: this service persists real data on
     *  its own regardless of whether anything is listening. */
    public interface UpdateListener {
        void onTodayStepCountChanged(int todaySteps);
    }

    @Nullable
    private static volatile UpdateListener updateListener;

    public static void setUpdateListener(@Nullable UpdateListener listener) {
        updateListener = listener;
    }

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;

    @Override
    public void onCreate() {
        super.onCreate();
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        if (sensorManager != null && stepCounterSensor != null) {
            sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
        // START_STICKY: if Android kills this process under memory
        // pressure, it restarts the service (with a null Intent) rather
        // than leaving background counting silently off — the same
        // "honest best-effort, not a broken promise" contract as every
        // other sensor integration in this app.
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() != Sensor.TYPE_STEP_COUNTER) return;
        int rawTotalSinceBoot = (int) event.values[0];

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putInt(KEY_RAW_TOTAL_SINCE_BOOT, rawTotalSinceBoot);

        String today = todayIsoDate();
        String baselineDate = prefs.getString(KEY_BASELINE_DATE, null);
        int baseline = prefs.getInt(KEY_BASELINE_RAW_TOTAL, rawTotalSinceBoot);
        // A new local calendar day (or the very first reading ever) resets
        // the baseline to *this* raw value, so "today's steps" starts
        // back at 0 instead of carrying a prior day's cumulative count
        // forward.
        if (!today.equals(baselineDate)) {
            baseline = rawTotalSinceBoot;
            editor.putString(KEY_BASELINE_DATE, today);
            editor.putInt(KEY_BASELINE_RAW_TOTAL, baseline);
        }
        editor.apply();

        UpdateListener listener = updateListener;
        if (listener != null) {
            listener.onTodayStepCountChanged(Math.max(0, rawTotalSinceBoot - baseline));
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No-op — TYPE_STEP_COUNTER has no meaningful accuracy tiers.
    }

    private static String todayIsoDate() {
        SimpleDateFormat fmt = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        return fmt.format(new Date());
    }

    private Notification buildNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Step counting",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Keeps counting your real steps while Fit Fly is in the background.");
            manager.createNotificationChannel(channel);
        }

        Intent openApp = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = null;
        if (openApp != null) {
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_IMMUTABLE;
            contentIntent = PendingIntent.getActivity(this, 0, openApp, flags);
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Fit Fly is counting your steps")
            .setContentText("Real background step counting — tap to open Fit Fly.")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(contentIntent)
            .build();
    }
}
