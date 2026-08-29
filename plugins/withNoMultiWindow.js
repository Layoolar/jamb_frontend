/**
 * Sets `android:resizeableActivity="false"` on the main activity.
 *
 * This asks Android not to offer split-screen or freeform windowing for the app,
 * which removes the easiest way to put an AI assistant beside a live question.
 * `expo-build-properties` does not expose this attribute, so it needs a plugin.
 *
 * It is a request, not a guarantee — some launchers and large-screen devices
 * force resizeability regardless, which is why the app ALSO detects
 * split-screen at runtime and blocks play (src/lib/anticheat.ts).
 */

const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withNoMultiWindow(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;

    for (const activity of app.activity ?? []) {
      if (activity.$?.['android:name'] === '.MainActivity') {
        activity.$['android:resizeableActivity'] = 'false';
      }
    }

    return cfg;
  });
};
