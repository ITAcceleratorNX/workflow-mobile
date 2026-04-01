const { withProjectBuildGradle } = require('@expo/config-plugins');

const MAVEN_PATH =
  '${rootDir}/../node_modules/@react-native-async-storage/async-storage/android/local_repo';
const ID_MARKER = 'async-storage/async-storage/android/local_repo';

/**
 * Async Storage v3 depends on org.asyncstorage.shared_storage:storage-android, shipped
 * inside the npm package (local_repo), not on Maven Central. Ensures the repo is added
 * after every expo prebuild.
 */
module.exports = function withAsyncStorageAndroidMavenRepo(config) {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }
    let contents = config.modResults.contents;
    if (contents.includes(ID_MARKER)) {
      return config;
    }

    const block = new RegExp(
      '(allprojects\\s*\\{\\s*repositories\\s*\\{\\s*\\n\\s*google\\(\\)\\s*\\n)'
    );
    if (!block.test(contents)) {
      return config;
    }

    const injected = `    // @react-native-async-storage/async-storage v3: bundled storage-android (not on Maven Central)
    maven { url = uri("${MAVEN_PATH}") }
`;
    config.modResults.contents = contents.replace(block, `$1${injected}`);
    return config;
  });
};
