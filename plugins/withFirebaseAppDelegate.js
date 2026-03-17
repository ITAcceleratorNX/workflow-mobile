const { withAppDelegate, createRunOncePlugin } = require('@expo/config-plugins');

function addObjCImport(src) {
  if (src.includes('<FirebaseCore/FirebaseCore.h>')) return src;
  if (src.includes('#import "AppDelegate.h"')) {
    return src.replace(
      '#import "AppDelegate.h"',
      '#import "AppDelegate.h"\n#import <FirebaseCore/FirebaseCore.h>'
    );
  }
  // Fallback: add near top
  return `#import <FirebaseCore/FirebaseCore.h>\n${src}`;
}

function addObjCConfigureCall(src) {
  if (src.includes('[FIRApp configure]')) return src;

  // Common Expo AppDelegate pattern (ObjC/ObjC++)
  const returnSuper = 'return [super application:application didFinishLaunchingWithOptions:launchOptions];';
  if (src.includes(returnSuper)) {
    return src.replace(returnSuper, '[FIRApp configure];\n  ' + returnSuper);
  }

  // Generic: insert before first "return YES;"
  const returnYes = 'return YES;';
  if (src.includes(returnYes)) {
    return src.replace(returnYes, '[FIRApp configure];\n  ' + returnYes);
  }

  return src;
}

function addSwiftImportAndConfigure(src) {
  if (src.includes('FirebaseApp.configure()')) return src;
  if (!src.includes('import FirebaseCore')) {
    src = src.replace(/^import\s+UIKit/m, (m) => `${m}\nimport FirebaseCore`);
  }

  // Insert inside didFinishLaunchingWithOptions
  const marker = 'didFinishLaunchingWithOptions';
  const idx = src.indexOf(marker);
  if (idx === -1) return src;

  // Find first "{" after the marker
  const braceIdx = src.indexOf('{', idx);
  if (braceIdx === -1) return src;

  const insert = '\n    FirebaseApp.configure()\n';
  return src.slice(0, braceIdx + 1) + insert + src.slice(braceIdx + 1);
}

function withFirebaseAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (cfg.modResults.language === 'objc') {
      cfg.modResults.contents = addObjCConfigureCall(addObjCImport(src));
    } else if (cfg.modResults.language === 'swift') {
      cfg.modResults.contents = addSwiftImportAndConfigure(src);
    } else {
      // Best-effort for objcpp or unknown: treat as ObjC text
      cfg.modResults.contents = addObjCConfigureCall(addObjCImport(src));
    }
    return cfg;
  });
}

module.exports = createRunOncePlugin(withFirebaseAppDelegate, 'with-firebase-app-delegate', '1.0.0');

