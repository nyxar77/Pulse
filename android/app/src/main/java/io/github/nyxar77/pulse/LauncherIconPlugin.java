package io.github.nyxar77.pulse;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "LauncherIcon")
public class LauncherIconPlugin extends Plugin {
    private static final String DEFAULT_ICON = "mocha_mauve";
    private static final String PREFERENCE_FILE = "pulse_launcher_icon";
    private static final String PREFERENCE_KEY = "active_icon";
    private static final Set<String> THEMES = new HashSet<>(Arrays.asList("latte", "frappe", "macchiato", "mocha"));
    private static final Set<String> ACCENTS = new HashSet<>(Arrays.asList(
        "rosewater", "flamingo", "pink", "mauve", "red", "maroon", "peach",
        "yellow", "green", "teal", "sky", "sapphire", "blue", "lavender"
    ));

    @PluginMethod
    public void setIcon(PluginCall call) {
        String theme = call.getString("theme");
        String accent = call.getString("accent");
        if (!THEMES.contains(theme) || !ACCENTS.contains(accent)) {
            call.reject("Unknown Pulse icon theme or accent.");
            return;
        }

        Context context = getContext();
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCE_FILE, Context.MODE_PRIVATE);
        String current = preferences.getString(PREFERENCE_KEY, DEFAULT_ICON);
        String requested = theme + "_" + accent;
        if (requested.equals(current)) {
            call.resolve();
            return;
        }

        PackageManager packageManager = context.getPackageManager();
        ComponentName oldComponent = component(context, current);
        ComponentName newComponent = component(context, requested);
        int enabled = PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
        int disabled = PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
        int flags = PackageManager.DONT_KILL_APP;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            packageManager.setComponentEnabledSettings(Arrays.asList(
                new PackageManager.ComponentEnabledSetting(newComponent, enabled, flags),
                new PackageManager.ComponentEnabledSetting(oldComponent, disabled, flags)
            ));
        } else {
            packageManager.setComponentEnabledSetting(newComponent, enabled, flags);
            packageManager.setComponentEnabledSetting(oldComponent, disabled, flags);
        }

        preferences.edit().putString(PREFERENCE_KEY, requested).apply();
        call.resolve();
    }

    private ComponentName component(Context context, String icon) {
        return new ComponentName(context, context.getPackageName() + ".Launcher_" + icon);
    }
}
