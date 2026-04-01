const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withFirebaseMetaFix(config) {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;

    const application = manifest.manifest.application[0];

    if (!application['meta-data']) {
      application['meta-data'] = [];
    }

    // helper для добавления или обновления meta-data
    const addOrUpdateMetaData = (name, valueKey, value, replaceAttr) => {
      const existing = application['meta-data'].find(
        (item) => item.$['android:name'] === name
      );

      if (existing) {
        existing.$[valueKey] = value;
        existing.$['tools:replace'] = replaceAttr;
      } else {
        application['meta-data'].push({
          $: {
            'android:name': name,
            [valueKey]: value,
            'tools:replace': replaceAttr,
          },
        });
      }
    };

    // 🔥 FIX конфликтов Firebase
    addOrUpdateMetaData(
      'com.google.firebase.messaging.default_notification_channel_id',
      'android:value',
      'default',
      'android:value'
    );

    addOrUpdateMetaData(
      'com.google.firebase.messaging.default_notification_color',
      'android:resource',
      '@color/notification_icon_color',
      'android:resource'
    );

    return config;
  });
};