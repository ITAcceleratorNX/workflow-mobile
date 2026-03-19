const { withAppDelegate, withPodfile, createRunOncePlugin } = require('@expo/config-plugins');

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
  // 1. Always add import FirebaseCore if missing (required for FirebaseApp)
  if (!src.includes('import FirebaseCore')) {
    const importMatch = src.match(/^import\s+(\w+)/m);
    if (importMatch) {
      src = src.replace(importMatch[0], importMatch[0] + '\nimport FirebaseCore');
    } else {
      src = `import FirebaseCore\n${src}`;
    }
  }

  // 2. Add FirebaseApp.configure() if not present
  if (src.includes('FirebaseApp.configure()')) return src;

  const marker = 'didFinishLaunchingWithOptions';
  const idx = src.indexOf(marker);
  if (idx === -1) return src;

  const braceIdx = src.indexOf('{', idx);
  if (braceIdx === -1) return src;

  const insert = '\n    FirebaseApp.configure()\n';
  return src.slice(0, braceIdx + 1) + insert + src.slice(braceIdx + 1);
}

const GOOGLE_UTILITIES_LINE = "  pod 'GoogleUtilities', :modular_headers => true\n";

const RND_HEADERS_FIX = `    # Fix: ReactNativeDependencies prepare_command can copy incomplete headers.
    rnd_path = File.join(__dir__, 'Pods', 'ReactNativeDependencies')
    headers_root = File.join(rnd_path, 'Headers')
    src_dirs = Dir.glob(File.join(rnd_path, '*', 'Headers'))
    src_headers = src_dirs.find { |d| File.exist?(File.join(d, 'boost', 'preprocessor')) }
    if src_headers
      # Copy missing boost/preprocessor (expr_iif.hpp not found)
      boost_dest = File.join(headers_root, 'boost')
      preprocessor_dest = File.join(boost_dest, 'preprocessor')
      if File.directory?(boost_dest) && !File.exist?(preprocessor_dest)
        preprocessor_src = File.join(src_headers, 'boost', 'preprocessor')
        FileUtils.cp_r(preprocessor_src, preprocessor_dest, :remove_destination => true) if File.directory?(preprocessor_src)
      end
      # Copy missing fast_float (fast_float.h not found)
      fast_float_dest = File.join(headers_root, 'fast_float')
      if !File.exist?(fast_float_dest)
        fast_float_src = File.join(src_headers, 'fast_float')
        FileUtils.cp_r(fast_float_src, fast_float_dest, :remove_destination => true) if File.directory?(fast_float_src)
      end
    end`;

function addGoogleUtilitiesToPodfile(contents) {
  if (!contents.includes("require 'fileutils'")) {
    contents = contents.replace(/^(require\s+File\.join)/m, "require 'fileutils'\n$1");
  }
  if (contents.includes("pod 'GoogleUtilities'") === false) {
    const targetMatch = contents.match(/target\s+['"]Workflow['"]\s+do\s*\n/);
    if (targetMatch) {
      const insertPos = targetMatch.index + targetMatch[0].length;
      contents = contents.slice(0, insertPos) + GOOGLE_UTILITIES_LINE + contents.slice(insertPos);
    }
  }
  if (!contents.includes('fast_float_dest = File.join(headers_root') && contents.includes('post_install do |installer|')) {
    contents = contents.replace(
      /(react_native_post_install\([\s\S]*?\)\s*\n)(\s+end\s*\n\s*end)/m,
      `$1${RND_HEADERS_FIX}\n$2`
    );
  }
  return contents;
}

function withFirebaseAppDelegate(config) {
  config = withPodfile(config, (cfg) => {
    cfg.modResults.contents = addGoogleUtilitiesToPodfile(cfg.modResults.contents);
    return cfg;
  });
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

