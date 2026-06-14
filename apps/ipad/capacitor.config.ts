import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.logicsim.app",
  appName: "LogicSim",
  // The identical web bundle all shells share (determinism prerequisite).
  webDir: "../web/dist",
  ios: {
    contentInset: "never",
    // The canvas owns all gestures; never let WKWebView scroll/bounce.
    scrollEnabled: false,
  },
};

export default config;
