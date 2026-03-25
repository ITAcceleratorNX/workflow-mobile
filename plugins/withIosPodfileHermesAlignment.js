/**
 * Aligns iOS native deps with the Hermes prebuilt pod.
 *
 * When `ios.buildReactNativeFromSource` is `true`, Xcode links RN built from
 * node_modules while `hermes-engine` stays on the **Pre-built** binary. That
 * mismatch often surfaces as undefined symbols for Hermes CDP / inspector
 * (e.g. CDPHandler, CDPDebugAPI, RuntimeAdapter).
 *
 * Expo/EAS default is to use prebuilt React Native artifacts (`RCT_USE_RN_DEP`),
 * which stay in sync with the bundled Hermes.
 */
const { withPodfileProperties } = require('@expo/config-plugins');

function withIosPodfileHermesAlignment(config) {
  return withPodfileProperties(config, (mod) => {
    mod.modResults['ios.buildReactNativeFromSource'] = 'false';
    // Prevent Hermes CDP/inspector symbols from being referenced via
    // dev-client network inspector. This avoids Hermes inspector/link
    // mismatches in certain prebuilt combinations.
    mod.modResults['EX_DEV_CLIENT_NETWORK_INSPECTOR'] = 'false';
    return mod;
  });
}

module.exports = withIosPodfileHermesAlignment;
