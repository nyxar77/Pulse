package io.github.nyxar77.pulse;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LauncherIconPlugin.class);
        registerPlugin(ScopedBackupPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
