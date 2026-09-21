import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.nyxar77.pulse",
  appName: "Pulse",
  webDir: "build",
  android: {
    allowMixedContent: false,
    backgroundColor: "#11111b",
  },
  server: {
    androidScheme: "https",
    appStartPath: "?appShell=1",
  },
};

export default config;
