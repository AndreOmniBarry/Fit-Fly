package app.fitfly.mobile;

import android.os.Bundle;
import app.fitfly.mobile.stepcounter.FitFlyStepCounterPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // FitFlyStepCounterPlugin lives directly in this app (not a
        // separate npm package like the other Capacitor plugins), so it
        // needs an explicit registerPlugin() call before super.onCreate()
        // — Capacitor only auto-discovers plugins declared in
        // capacitor.plugins.json, which is generated from node_modules.
        registerPlugin(FitFlyStepCounterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
