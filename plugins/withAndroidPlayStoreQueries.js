const { withAndroidManifest } = require('@expo/config-plugins');

const PLAY_STORE_PACKAGE = 'com.android.vending';

/**
 * Android 11+ не даёт открыть Google Play по market://, пока пакет или схема
 * не перечислены в <queries>. Иначе кнопка «Обновить» ничего не открывает
 * либо отдаёт магазин производителя.
 */
function withAndroidPlayStoreQueries(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.queries) manifest.queries = [{}];
    const queries = manifest.queries[0];

    if (!queries.package) queries.package = [];
    const seesPlay = queries.package.some((item) => item.$['android:name'] === PLAY_STORE_PACKAGE);
    if (!seesPlay) queries.package.push({ $: { 'android:name': PLAY_STORE_PACKAGE } });

    if (!queries.intent) queries.intent = [];
    const seesMarket = queries.intent.some((intent) =>
      (intent.data || []).some((data) => data.$['android:scheme'] === 'market'),
    );
    if (!seesMarket) {
      queries.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'market' } }],
      });
    }

    return config;
  });
}

module.exports = withAndroidPlayStoreQueries;
