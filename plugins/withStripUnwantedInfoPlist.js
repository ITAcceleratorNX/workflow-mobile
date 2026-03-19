const { withInfoPlist } = require('expo/config-plugins');

/**
 * Удаляет лишние ключи из Info.plist после prebuild.
 * expo-task-manager добавляет "fetch" в UIBackgroundModes, но для expo-background-task нужен только "processing".
 */
function withStripUnwantedInfoPlist(config) {
  return withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;

    // Убираем "fetch" из UIBackgroundModes — оставляем только "processing" для BGTaskScheduler
    if (Array.isArray(plist.UIBackgroundModes)) {
      plist.UIBackgroundModes = plist.UIBackgroundModes.filter((m) => m !== 'fetch');
    }

    return cfg;
  });
}

module.exports = withStripUnwantedInfoPlist;
