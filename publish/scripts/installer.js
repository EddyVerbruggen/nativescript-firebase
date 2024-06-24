var fs = require('fs');
var path = require('path');
var prompt = require('prompt-lite');

// Default settings for a few prompts
var usingiOS = false, usingAndroid = false, externalPushClient = false;

// The directories where the Podfile and include.gradle are stored
var directories = {
  ios: './platforms/ios',
  android: './platforms/android'
};

console.log('NativeScript Firebase Plugin Installation');

var appRoot = "../../../";
var pluginConfigFile = "firebase.nativescript.json";
var pluginConfigPath = path.join(appRoot, pluginConfigFile);
var config = {};

function mergeConfig(result) {
  for (var key in result) {
    config[key] = isSelected(result[key]);
  }
  // note that the semantics of "external_push_client_only" changed to "external push client" with plugin version 10.1.0
  externalPushClient = isSelected(config["external_push_client_only"]);
}

function saveConfig() {
  fs.writeFileSync(pluginConfigPath, JSON.stringify(config, null, 4));
}

function readConfig() {
  try {
    config = JSON.parse(fs.readFileSync(pluginConfigPath));
    externalPushClient = isSelected(config["external_push_client_only"]);
  } catch (e) {
    console.log("Failed reading " + pluginConfigFile);
    console.log(e);
    config = {};
  }
}

function isInteractive() {
  return process.stdin && process.stdin.isTTY && process.stdout && process.stdout.isTTY;
}

// note that for CI builds you want a pluginConfigFile, otherwise the build will fail
if (process.argv.indexOf("config") === -1 && fs.existsSync(pluginConfigPath)) {
  readConfig();
  console.log("Config file exists (" + pluginConfigFile + ")");
  askiOSPromptResult(config);
  askAndroidPromptResult(config);
  promptQuestionsResult(config);
} else if (!isInteractive()) {
  console.log("No existing " + pluginConfigFile + " config file found and terminal is not interactive! Default configuration will be used.");
} else {
  console.log("No existing " + pluginConfigFile + " config file found, so let's configure the Firebase plugin!");
  prompt.start();
  askiOSPrompt();
}

/**
 * Prompt the user if they are integrating Firebase with iOS
 */
function askiOSPrompt() {
  prompt.get({
    name: 'using_ios',
    description: 'Are you using iOS (y/n)',
    default: 'y'
  }, function (err, result) {
    if (err) {
      return console.log(err);
    }
    mergeConfig(result);
    askiOSPromptResult(result);
    askAndroidPrompt();
  });
}

function askiOSPromptResult(result) {
  if (isSelected(result.using_ios)) {
    usingiOS = true;
  }
}

/**
 * Prompt the user if they are integrating Firebase with Android
 */
function askAndroidPrompt() {
  prompt.get({
    name: 'using_android',
    description: 'Are you using Android (y/n)',
    default: 'y'
  }, function (err, result) {
    if (err) {
      return console.log(err);
    }
    mergeConfig(result);
    askAndroidPromptResult(result);
    if (usingiOS || usingAndroid) {
      promptQuestions();
    } else {
      askSaveConfigPrompt();
    }
  });
}

function askAndroidPromptResult(result) {
  if (isSelected(result.using_android)) {
    usingAndroid = true;
  }
}

/**
 * Prompt the user through the configurable Firebase add-on services
 */
function promptQuestions() {
  prompt.get([{
    name: 'analytics',
    description: 'Do you want to enable Firebase Analytics? (y/n)',
    default: 'y'
  }, {
    name: 'firestore',
    description: 'Are you using Firestore? (y/n)',
    default: 'n'
  }, {
    name: 'realtimedb',
    description: 'Are you using Realtime DB? (y/n)',
    default: 'n'
  }, {
    name: 'authentication',
    description: 'Are you using Firebase Authentication (pretty likely if you use Firestore or Realtime DB)? (y/n)',
    default: 'y'
  }, {
    name: 'remote_config',
    description: 'Are you using Firebase RemoteConfig? (y/n)',
    default: 'n'
  }, {
    name: 'performance_monitoring',
    description: 'Are you using Performance Monitoring? (y/n)',
    default: 'n'
  }, {
    name: 'external_push_client_only',
    description: 'Are you using this plugin as a Push Notification client for an external (NOT Firebase Cloud Messaging) Push service? (y/n)',
    default: 'n'
  }, {
    name: 'messaging',
    description: 'Are you using Firebase Cloud Messaging? (y/n)',
    default: 'n'
  }, {
    name: 'in_app_messaging',
    description: 'Are you using In-App Messaging? (y/n)',
    default: 'n'
  }, {
    name: 'crashlytics',
    description: 'Are you using Firebase Crashlytics? (y/n)',
    default: 'n'
  }, {
    name: 'storage',
    description: 'Are you using Firebase Storage? (y/n)',
    default: 'n'
  }, {
    name: 'functions',
    description: 'Are you using Firebase Cloud Functions? (y/n)',
    default: 'n'
  }, {
    name: 'facebook_auth',
    description: 'Are you using Firebase Facebook Authentication? (y/n)',
    default: 'n'
  }, {
    name: 'google_auth',
    description: 'Are you using Firebase Google Authentication? (y/n)',
    default: 'n'
  }, {
    name: 'admob',
    description: 'Are you using AdMob? (y/n)',
    default: 'n'
  }, {
    name: 'dynamic_links',
    description: 'Are you using Firebase Dynamic Links? (y/n)',
    default: 'n'
  }, {
    name: 'ml_kit',
    description: 'Are you using ML Kit? (y/n)',
    default: 'n'
  }], function (err, result) {
    if (err) {
      return console.log(err);
    }
    if (!isSelected(result.ml_kit)) {
      mergeConfig(result);
      promptQuestionsResult(result);
      askSaveConfigPrompt();
    } else {
      prompt.get([{
        name: 'ml_kit_text_recognition',
        description: 'With ML Kit, do you want to recognize text? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_barcode_scanning',
        description: 'With ML Kit, do you want to scan barcodes? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_face_detection',
        description: 'With ML Kit, do you want to detect faces? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_image_labeling',
        description: 'With ML Kit, do you want to label images? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_object_detection',
        description: 'With ML Kit, do you want to use Object Detection and Tracking? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_automl',
        description: 'With ML Kit, do you want to use AutoML Vision Edge to label images with your own models? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_custom_model',
        description: 'With ML Kit, do you want to use a custom TensorFlow Lite model? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_natural_language_identification',
        description: 'With ML Kit, do you want to recognize natural languages? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_natural_language_translation',
        description: 'With ML Kit, do you want to translate text? (y/n)',
        default: 'n'
      }, {
        name: 'ml_kit_natural_language_smartreply',
        description: 'With ML Kit, do you want to use smart reply? (y/n)',
        default: 'n'
      }], function (mlkitErr, mlkitResult) {
        if (mlkitErr) {
          return console.log(mlkitErr);
        }
        for (var attrname in mlkitResult) {
          result[attrname] = mlkitResult[attrname];
        }
        mergeConfig(result);
        promptQuestionsResult(result);
        askSaveConfigPrompt();
      });
    }
  });
}

function promptQuestionsResult(result) {
  if (usingiOS) {
    writePodFile(result);
    writeGoogleServiceCopyHook();
    writeBuildscriptHookForCrashlytics(isSelected(result.crashlytics));
    activateIOSMLKitCameraFramework(isSelected(result.ml_kit));
  }

  if (usingAndroid) {
    writeGradleFile(result);
    writeGoogleServiceCopyHook();
    writeGoogleServiceGradleHook(result);
    echoAndroidManifestChanges(result);
    activateAndroidPushNotificationsLib(isSelected(result.messaging) || isSelected(result.external_push_client_only));
    activateAndroidMLKitCustomModelLib(isSelected(result.ml_kit) && isSelected(result.ml_kit_custom_model));
  }

  console.log('Firebase post install completed. To re-run this script, navigate to the root directory of `nativescript-plugin-firebase` in your `node_modules` folder and run: `npm run config`.');
}

function echoAndroidManifestChanges(result) {
  if (isSelected(result.ml_kit)) {
    var selectedFeatures = [];
    if (isSelected(result.ml_kit_text_recognition)) {
      selectedFeatures.push("ocr");
    }
    if (isSelected(result.ml_kit_barcode_scanning)) {
      selectedFeatures.push("barcode");
    }
    if (isSelected(result.ml_kit_face_detection)) {
      selectedFeatures.push("face");
    }
    if (isSelected(result.ml_kit_image_labeling)) {
      selectedFeatures.push("label");
    }
    if (selectedFeatures.length > 0) {
      console.log('\n######################################################################################################');
      console.log('Open your app\'s resources/Android/AndroidManifest.xml file and add this (see the demo for an example):');
      console.log('<meta-data\n' +
          '    android:name="com.google.firebase.ml.vision.DEPENDENCIES"\n' +
          '    android:value="' + selectedFeatures.join(',') + '" />');
      console.log('######################################################################################################\n');
    }
  }
}

function activateAndroidPushNotificationsLib(enable) {
  if (enable && fs.existsSync(path.join(directories.android, 'firebase-release.aar-disabled'))) {
    fs.renameSync(path.join(directories.android, 'firebase-release.aar-disabled'), path.join(directories.android, 'firebase-release.aar'));
  } else if (!enable && fs.existsSync(path.join(directories.android, 'firebase-release.aar'))) {
    fs.renameSync(path.join(directories.android, 'firebase-release.aar'), path.join(directories.android, 'firebase-release.aar-disabled'));
  }
}

function activateAndroidMLKitCustomModelLib(enable) {
  if (enable && fs.existsSync(path.join(directories.android, 'nativescript-firebase-mlkit-helper.jar-disabled'))) {
    fs.renameSync(path.join(directories.android, 'nativescript-firebase-mlkit-helper.jar-disabled'), path.join(directories.android, 'nativescript-firebase-mlkit-helper.jar'));
  } else if (!enable && fs.existsSync(path.join(directories.android, 'nativescript-firebase-mlkit-helper.jar'))) {
    fs.renameSync(path.join(directories.android, 'nativescript-firebase-mlkit-helper.jar'), path.join(directories.android, 'nativescript-firebase-mlkit-helper.jar-disabled'));
  }
}

function activateIOSMLKitCameraFramework(enable) {
  if (enable && fs.existsSync(path.join(directories.ios, 'TNSMLKitCamera.framework-disabled'))) {
    fs.renameSync(path.join(directories.ios, 'TNSMLKitCamera.framework-disabled'), path.join(directories.ios, 'TNSMLKitCamera.framework'));
  } else if (!enable && fs.existsSync(path.join(directories.ios, 'TNSMLKitCamera.framework'))) {
    fs.renameSync(path.join(directories.ios, 'TNSMLKitCamera.framework'), path.join(directories.ios, 'TNSMLKitCamera.framework-disabled'));
  }
}

function askSaveConfigPrompt() {
  prompt.get({
    name: 'save_config',
    description: 'Do you want to save the selected configuration. Reinstalling the dependency will reuse the setup from: ' + pluginConfigFile + '. CI will be easier. (y/n)',
    default: 'y'
  }, function (err, result) {
    if (err) {
      return console.log(err);
    }
    if (isSelected(result.save_config)) {
      saveConfig();
    }
  });
}

/**
 * Create the iOS PodFile for installing the Firebase iOS dependencies and service dependencies
 *
 * @param {any} result The answers to the micro-service prompts
 */
function writePodFile(result) {
  if (!fs.existsSync(directories.ios)) {
    fs.mkdirSync(directories.ios);
  }
  try {
    fs.writeFileSync(directories.ios + '/Podfile',
// The MLVision pod requires a minimum of iOS 9, otherwise the build will fail
(isPresent(result.ml_kit) ? `` : `#`) + `platform :ios, '9.0'

` + (!isSelected(result.external_push_client_only) ? `` : `#`) + `pod 'Firebase/Core', '~>6.26.0'

# Analytics
` + (isSelected(result.analytics) || isSelected(result.crashlytics) || (!isSelected(result.external_push_client_only) && !isPresent(result.analytics)) ? `` : `#`) + `pod 'Firebase/Analytics'

# Authentication
` + (isSelected(result.authentication) || (!isSelected(result.external_push_client_only) && !isPresent(result.external_push_client_only)) ? `` : `#`) + `pod 'Firebase/Auth'

# Realtime DB
` + (isSelected(result.realtimedb) || (!isSelected(result.external_push_client_only) && !isPresent(result.realtimedb)) ? `` : `#`) + `pod 'Firebase/Database'

# Cloud Firestore
` + (isSelected(result.firestore) ? `` : `#`) + `pod 'FirebaseFirestore', :git => 'https://github.com/invertase/firestore-ios-sdk-frameworks.git', :tag => '6.26.0'

# Remote Config
` + (isSelected(result.remote_config) ? `` : `#`) + `pod 'Firebase/RemoteConfig'

# Performance Monitoring
` + (isSelected(result.performance_monitoring) ? `` : `#`) + `pod 'Firebase/Performance'

# Crashlytics
` + (isSelected(result.crashlytics) ? `` : `#`) + `pod 'Firebase/Crashlytics'
` + (!isSelected(result.crashlytics) ? `` : `
# Crashlytics works best without bitcode
post_install do |installer|
    installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
            config.build_settings['ENABLE_BITCODE'] = "NO"
            config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = "YES"
        end
    end
end`) + `

# Firebase Cloud Messaging (FCM)
` + (isSelected(result.messaging) ? `` : `#`) + `pod 'Firebase/Messaging'

# Firebase In-App Messaging
` + (isSelected(result.in_app_messaging) ? `` : `#`) + `pod 'Firebase/InAppMessaging'

# Firebase Cloud Storage
` + (isSelected(result.storage) ? `` : `#`) + `pod 'Firebase/Storage'

# Firebase Cloud Functions
` + (isSelected(result.functions) ? `` : `#`) + `pod 'Firebase/Functions'

# AdMob
` + (isSelected(result.admob) ? `` : `#`) + `pod 'Firebase/AdMob'

# Dynamic Links
` + (isSelected(result.dynamic_links) ? `` : `#`) + `pod 'Firebase/DynamicLinks'

# ML Kit
` + (isSelected(result.ml_kit) ? `` : `#`) + `pod 'Firebase/MLVision'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_text_recognition) ? `` : `#`) + `pod 'Firebase/MLVisionTextModel'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_barcode_scanning) ? `` : `#`) + `pod 'Firebase/MLVisionBarcodeModel'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_face_detection) ? `` : `#`) + `pod 'Firebase/MLVisionFaceModel'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_image_labeling) ? `` : `#`) + `pod 'Firebase/MLVisionLabelModel'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_object_detection) ? `` : `#`) + `pod 'Firebase/MLVisionObjectDetection'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_custom_model) ? `` : `#`) + `pod 'Firebase/MLModelInterpreter'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_automl) ? `` : `#`) + `pod 'Firebase/MLVisionAutoML'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_natural_language_identification) ? `` : `#`) + `pod 'Firebase/MLNaturalLanguage'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_natural_language_identification) ? `` : `#`) + `pod 'Firebase/MLNLLanguageID'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_natural_language_translation) ? `` : `#`) + `pod 'Firebase/MLNLTranslate'
` + (isSelected(result.ml_kit) && (isSelected(result.ml_kit_natural_language_smartreply) || isSelected(result.ml_kit_natural_language_translation)) ? `` : `#`) + `pod 'Firebase/MLCommon'
` + (isSelected(result.ml_kit) && isSelected(result.ml_kit_natural_language_smartreply) ? `` : `#`) + `pod 'Firebase/MLNLSmartReply'

# Facebook Authentication
` + (isSelected(result.facebook_auth) ? `` : `#`) + `pod 'FBSDKCoreKit'
` + (isSelected(result.facebook_auth) ? `` : `#`) + `pod 'FBSDKLoginKit'

# Google Authentication
` + (isSelected(result.google_auth) ? `` : `#`) + `pod 'GoogleSignIn', '~> 5.0.2'`);
    console.log('Successfully created iOS (Pod) file.');
  } catch (e) {
    console.log('Failed to create iOS (Pod) file.');
    console.log(e);
  }
}

/**
 * Create the iOS build script for uploading dSYM files to Crashlytics
 *
 * @param {any} enable Is Crashlytics enabled
 */
function writeBuildscriptHookForCrashlytics(enable) {
  var scriptPath = path.join(appRoot, "hooks", "after-prepare", "firebase-crashlytics-buildscript.js");

  if (!enable) {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
    }
    return
  }

  console.log("Install Crashlytics buildscript hook.");
  try {
    var scriptContent =
        `const fs = require('fs-extra');
const path = require('path');
const xcode = require('xcode');

const pattern1 = /\\n\\s*\\/\\/Crashlytics 1 BEGIN[\\s\\S]*\\/\\/Crashlytics 1 END.*\\n/m;
const pattern2 = /\\n\\s*\\/\\/Crashlytics 2 BEGIN[\\s\\S]*\\/\\/Crashlytics 2 END.*\\n/m;
const pattern3 = /\\n\\s*\\/\\/Crashlytics 3 BEGIN[\\s\\S]*\\/\\/Crashlytics 3 END.*\\n/m;

const string1 = \`
//Crashlytics 1 BEGIN
#else
#import <FirebaseCrashlytics/FirebaseCrashlytics.h>
#endif
//Crashlytics 1 END
\`;

const string2 = \`
//Crashlytics 2 BEGIN
#if DEBUG
#else
static int redirect_cls(const char *prefix, const char *buffer, int size) {
  [[FIRCrashlytics crashlytics] logWithFormat:@"%s: %.*s", prefix, size, buffer];
  return size;
}

static int stderr_redirect(void *inFD, const char *buffer, int size) {
  return redirect_cls("stderr", buffer, size);
}

static int stdout_redirect(void *inFD, const char *buffer, int size) {
  return redirect_cls("stdout", buffer, size);
}
#endif
//Crashlytics 2 END
\`;

const string3 = \`
//Crashlytics 3 BEGIN
#if DEBUG
#else
  // Per https://docs.fabric.io/apple/crashlytics/enhanced-reports.html#custom-logs :
  // Crashlytics ensures that all log entries are recorded, even if the very next line of code crashes.
  // This means that logging must incur some IO. Be careful when logging in performance-critical areas.

  // As per the note above, enabling this can affect performance if too much logging is present.
  // stdout->_write = stdout_redirect;

  // stderr usually only occurs during critical failures;
  // so it is usually essential to identifying crashes, especially in JS
  stderr->_write = stderr_redirect;
#endif
//Crashlytics 3 END
\`;

module.exports = function($logger, $projectData, hookArgs) {
  const platformFromHookArgs = hookArgs && (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform));
  const platform = (platformFromHookArgs  || '').toLowerCase();
  return new Promise(function(resolve, reject) {
    const isNativeProjectPrepared = hookArgs.prepareData ? (!hookArgs.prepareData.nativePrepare || !hookArgs.prepareData.nativePrepare.skipNativePrepare) : (!hookArgs.nativePrepare || !hookArgs.nativePrepare.skipNativePrepare);
    if (isNativeProjectPrepared) {
      try {
        if (platform === 'ios') {
          const sanitizedAppName = path.basename($projectData.projectDir).split('').filter((c) => /[a-zA-Z0-9]/.test(c)).join('');

          // write buildscript for dSYM upload
          const xcodeProjectPath = path.join($projectData.platformsDir, 'ios', sanitizedAppName + '.xcodeproj', 'project.pbxproj');
          $logger.trace('Using Xcode project', xcodeProjectPath);
          if (fs.existsSync(xcodeProjectPath)) {
            var xcodeProject = xcode.project(xcodeProjectPath);
            xcodeProject.parseSync();

            // Xcode 10 requires 'inputPaths' set, see https://firebase.google.com/docs/crashlytics/get-started
            var options = {
              shellPath: '/bin/sh', shellScript: '\"\${PODS_ROOT}/FirebaseCrashlytics/run\"',
              inputPaths: ['"\$(SRCROOT)/$(BUILT_PRODUCTS_DIR)/$(INFOPLIST_PATH)\"']
            };

            xcodeProject.addBuildPhase(
              [], 'PBXShellScriptBuildPhase', 'Configure Crashlytics', undefined, options
            ).buildPhase;
            fs.writeFileSync(xcodeProjectPath, xcodeProject.writeSync());
            $logger.trace('Xcode project written');
          } else {
            $logger.error(xcodeProjectPath + ' is missing.');
            reject();
            return;
          }

          // Logging from stdout/stderr
          $logger.info('Add iOS crash logging');
          const mainmPath = path.join($projectData.platformsDir, 'ios', 'internal', 'main.m');
          if (fs.existsSync(mainmPath)) {
            let mainmContent = fs.readFileSync(mainmPath).toString();
            // string1
            mainmContent = pattern1.test(mainmContent)
              ? mainmContent.replace(pattern1, string1)
              : mainmContent.replace(/(\\n#endif\\n)/, string1);
            // string2
            mainmContent = pattern2.test(mainmContent)
              ? mainmContent.replace(pattern2, string2)
              : mainmContent.replace(/(\\nint main.*)/, string2 + '$1');
            // string3
            mainmContent = pattern3.test(mainmContent)
              ? mainmContent.replace(pattern3, string3)
              : mainmContent.replace(/(int main.*\\n)/, '$1' + string3 + '\\n');
            fs.writeFileSync(mainmPath, mainmContent);
          } else {
            $logger.error(mainmPath + ' is missing.');
            reject();
            return;
          }

          resolve();
        } else {
          resolve();
        }
      } catch (e) {
        $logger.error('Unknown error during prepare Crashlytics', e);
        reject();
      }
    } else {
      $logger.trace("Native project not prepared.");
      resolve();
    }
  });
};
`;
    var afterPrepareDirPath = path.dirname(scriptPath);
    var hooksDirPath = path.dirname(afterPrepareDirPath);
    if (!fs.existsSync(afterPrepareDirPath)) {
      if (!fs.existsSync(hooksDirPath)) {
        fs.mkdirSync(hooksDirPath);
      }
      fs.mkdirSync(afterPrepareDirPath);
    }
    fs.writeFileSync(scriptPath, scriptContent);
  } catch (e) {
    console.log("Failed to install Crashlytics buildscript hook.");
    console.log(e);
  }
}

/**
 * Create the Android Gradle for installing the Firebase Android dependencies and service dependencies
 *
 * @param {any} result The answers to the micro-service prompts
 */
function writeGradleFile(result) {
  if (!fs.existsSync(directories.android)) {
    fs.mkdirSync(directories.android);
  }
  try {
    fs.writeFileSync(directories.android + '/include.gradle',
        `
android {
    // (possibly-temporary) workaround for https://stackoverflow.com/questions/52518378/more-than-one-file-was-found-with-os-independent-path-meta-inf-proguard-android
    packagingOptions {
        exclude 'META-INF/proguard/androidx-annotations.pro'
    }
}

repositories {
    mavenCentral()
    maven {
        url "https://maven.google.com"
    }
    jcenter()
}

dependencies {
    def supportVersion = project.hasProperty("supportVersion") ? project.supportVersion : "26.1.0"
    def googlePlayServicesVersion = project.hasProperty('googlePlayServicesVersion') ? project.googlePlayServicesVersion : "16.0.1"

    if (googlePlayServicesVersion != '+' && org.gradle.util.VersionNumber.parse(googlePlayServicesVersion) < org.gradle.util.VersionNumber.parse('15.0.+')) {
        throw new GradleException(" googlePlayServicesVersion set too low, please update to at least 15.0.0 / 15.0.+ (currently set to $googlePlayServicesVersion)");
    }

    implementation "com.android.support:appcompat-v7:$supportVersion"
    implementation "com.android.support:cardview-v7:$supportVersion"
    implementation "com.android.support:customtabs:$supportVersion"
    implementation "com.android.support:design:$supportVersion"
    implementation "com.android.support:support-compat:$supportVersion"

    // make sure you have these versions by updating your local Android SDK's (Android Support repo and Google repo)

    ` + (isSelected(result.analytics) || (!isSelected(result.external_push_client_only) && !isPresent(result.analytics)) ? `` : `//`) + ` implementation "com.google.firebase:firebase-analytics:17.2.2"

    // for reading google-services.json and configuration
    implementation "com.google.android.gms:play-services-base:$googlePlayServicesVersion"

    // Authentication
    ` + (isSelected(result.authentication) || (!isSelected(result.external_push_client_only) && !isPresent(result.authentication)) ? `` : `//`) + ` implementation "com.google.firebase:firebase-auth:20.0.0"

    // Realtime DB
    ` + (isSelected(result.realtimedb) || (!isSelected(result.external_push_client_only) && !isPresent(result.realtimedb)) ? `` : `//`) + ` implementation "com.google.firebase:firebase-database:19.2.1"

    // Cloud Firestore
    ` + (isSelected(result.firestore) ? `` : `//`) + ` implementation "com.google.firebase:firebase-firestore:22.0.0"

    // Remote Config
    ` + (isSelected(result.remote_config) ? `` : `//`) + ` implementation "com.google.firebase:firebase-config:20.0.0"

    // Performance Monitoring
    ` + (isSelected(result.performance_monitoring) ? `` : `//`) + ` implementation "com.google.firebase:firebase-perf:19.0.5"

    // Crashlytics
    ` + (isSelected(result.crashlytics) ? `` : `//`) + ` implementation "com.google.firebase:firebase-crashlytics:17.2.2"

    // Cloud Messaging (FCM)
    ` + (isSelected(result.messaging) || isSelected(result.external_push_client_only) ? `` : `//`) + ` implementation "com.google.firebase:firebase-messaging:21.0.0"
    // ` + (isSelected(result.messaging) || isSelected(result.external_push_client_only) ? `` : `//`) + ` implementation "me.leolin:ShortcutBadger:1.1.22@aar"

    // In-App Messaging
    ` + (isSelected(result.in_app_messaging) ? `` : `//`) + ` implementation "com.google.firebase:firebase-inappmessaging-display:19.1.2"
    // Analytics seems to be required for In-App Messaging
    ` + (isSelected(result.in_app_messaging) && !isSelected(result.analytics) ? `` : `//`) + ` implementation "com.google.firebase:firebase-analytics:18.0.0"

    // Cloud Storage
    ` + (isSelected(result.storage) ? `` : `//`) + ` implementation "com.google.firebase:firebase-storage:19.2.0"

    // Cloud Functions
    ` + (isSelected(result.functions) ? `` : `//`) + ` implementation "com.google.firebase:firebase-functions:19.1.0"

    // AdMob / Ads
    ` + (isSelected(result.admob) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ads:18.3.0"

    // ML Kit
    ` + (isSelected(result.ml_kit) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-vision:24.0.1"
    ` + (isSelected(result.ml_kit_image_labeling) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-vision-image-label-model:19.0.0"
    ` + (isSelected(result.ml_kit_object_detection) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-vision-object-detection-model:19.0.3"
    ` + (isSelected(result.ml_kit_custom_model) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-model-interpreter:22.0.1"
    ` + (isSelected(result.ml_kit_automl) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-vision-automl:18.0.3"
    ` + (isSelected(result.ml_kit_natural_language_identification) || isSelected(result.ml_kit_natural_language_smartreply) || isSelected(result.ml_kit_natural_language_translation) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-natural-language:22.0.0"
    ` + (isSelected(result.ml_kit_natural_language_identification) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-natural-language-language-id-model:20.0.7"
    ` + (isSelected(result.ml_kit_natural_language_translation) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-natural-language-translate-model:20.0.7"
    ` + (isSelected(result.ml_kit_natural_language_smartreply) ? `` : `//`) + ` implementation "com.google.firebase:firebase-ml-natural-language-smart-reply-model:20.0.7"

    // Facebook Authentication
    ` + (isSelected(result.facebook_auth) ? `` : `//`) + ` implementation "com.facebook.android:facebook-core:5.4.0"
    ` + (isSelected(result.facebook_auth) ? `` : `//`) + ` implementation "com.facebook.android:facebook-login:5.4.0"

    // Google Sign-In Authentication
    ` + (isSelected(result.google_auth) ? `` : `//`) + ` implementation "com.google.android.gms:play-services-auth:$googlePlayServicesVersion"

    // Dynamic Links
    ` + (isSelected(result.dynamic_links) ? `` : `//`) + ` implementation "com.google.firebase:firebase-dynamic-links:19.0.0"
}

apply plugin: "com.google.gms.google-services"

// Crashlytics
` + (isSelected(result.crashlytics) ? `` : `//`) + `apply plugin: "com.google.firebase.crashlytics"
`);
    console.log('Successfully created Android (include.gradle) file.');
  } catch (e) {
    console.log('Failed to create Android (include.gradle) file.');
    console.log(e);
  }
}

/**
 * Installs an after-prepare build hook to copy the app/App_Resources/Android/google-services.json to platform/android on build.
 * Installs before-checkForChange build hook to detect changes in environment and copy GoogleServices.plist on build.
 */
function writeGoogleServiceCopyHook() {
  // Install after-prepare hook
  console.log("Install google-service.json after-prepare copy hook.");
  try {
    var afterPrepareScriptContent =
        `
var path = require("path");
var fs = require("fs");

module.exports = function($logger, $projectData, hookArgs) {

return new Promise(function(resolve, reject) {

        /* Decide whether to prepare for dev or prod environment */
        var validStagingEnvs = ["dev", "development", "staging"];
        var validProdEnvs = ['prod','production'];
        var isProdEnv = false; // building with --env.prod or --env.production flag
        var isStagingEnv = false;
        var env = (hookArgs.platformSpecificData || hookArgs.prepareData).env;

        if (env) {
            Object.keys(env).forEach((key) => {
                if (validProdEnvs.indexOf(key)>-1) { 
			isProdEnv = true;
		}
		if (validStagingEnvs.indexOf(key) > -1) {
			isStagingEnv = true;
		}
            });
        }

        var buildType = isProdEnv && !isStagingEnv ? "production" : "development";
        const platformFromHookArgs = hookArgs && (hookArgs.platform || (hookArgs.prepareData && hookArgs.prepareData.platform));
        const platform = (platformFromHookArgs  || '').toLowerCase();

        /* Create info file in platforms dir so we can detect changes in environment and force prepare if needed */

        var npfInfoPath = path.join($projectData.platformsDir, platform, ".pluginfirebaseinfo");
        var npfInfo = {
            buildType: buildType,
        };

        try { fs.writeFileSync(npfInfoPath, JSON.stringify(npfInfo)); }
        catch (err) {
            $logger.info('nativescript-plugin-firebase: unable to create '+npfInfoPath+', prepare will be forced next time!');
        }


        /* Handle preparing of Google Services files */

        if (platform === 'android') {
            var destinationGoogleJson = path.join($projectData.platformsDir, "android", "app", "google-services.json");
            var destinationGoogleJsonAlt = path.join($projectData.platformsDir, "android", "google-services.json");
            var sourceGoogleJson = path.join($projectData.appResourcesDirectoryPath, "Android", "google-services.json");
            var sourceGoogleJsonProd = path.join($projectData.appResourcesDirectoryPath, "Android", "google-services.json.prod");
            var sourceGoogleJsonDev = path.join($projectData.appResourcesDirectoryPath, "Android", "google-services.json.dev");

            // ensure we have both dev/prod versions so we never overwrite singlular google-services.json
            if (fs.existsSync(sourceGoogleJsonProd) && fs.existsSync(sourceGoogleJsonDev)) {
                if (buildType==='production') { sourceGoogleJson = sourceGoogleJsonProd; } // use prod version
                else { sourceGoogleJson = sourceGoogleJsonDev; } // use dev version
            }

            // copy correct version to destination
            if (fs.existsSync(sourceGoogleJson) && fs.existsSync(path.dirname(destinationGoogleJson))) {
                $logger.info("Copy " + sourceGoogleJson + " to " + destinationGoogleJson + ".");
                fs.writeFileSync(destinationGoogleJson, fs.readFileSync(sourceGoogleJson));
                resolve();
            } else if (fs.existsSync(sourceGoogleJson) && fs.existsSync(path.dirname(destinationGoogleJsonAlt))) {
                // NativeScript < 4 doesn't have the 'app' folder
                $logger.info("Copy " + sourceGoogleJson + " to " + destinationGoogleJsonAlt + ".");
                fs.writeFileSync(destinationGoogleJsonAlt, fs.readFileSync(sourceGoogleJson));
                resolve();
            } else {
                $logger.warn("Unable to copy google-services.json. You need this file, because the Google Services Plugin cannot function without it..");
                reject();
            }
        } else if (platform === 'ios') {
            // we have copied our GoogleService-Info.plist during before-checkForChanges hook, here we delete it to avoid changes in git
            var destinationGooglePlist = path.join($projectData.appResourcesDirectoryPath, "iOS", "GoogleService-Info.plist");
            var sourceGooglePlistProd = path.join($projectData.appResourcesDirectoryPath, "iOS", "GoogleService-Info.plist.prod");
            var sourceGooglePlistDev = path.join($projectData.appResourcesDirectoryPath, "iOS", "GoogleService-Info.plist.dev");

            // if we have both dev/prod versions, let's remove GoogleService-Info.plist in destination dir
            if (fs.existsSync(sourceGooglePlistProd) && fs.existsSync(sourceGooglePlistDev)) {
                if (fs.existsSync(destinationGooglePlist)) { fs.unlinkSync(destinationGooglePlist); }
                resolve();
            } else { // single GoogleService-Info.plist modus
                resolve();
            }
        } else {
            resolve();
        }
    });
};
`;
    var scriptPath = path.join(appRoot, "hooks", "after-prepare", "firebase-copy-google-services.js");
    var afterPrepareDirPath = path.dirname(scriptPath);
    var hooksDirPath = path.dirname(afterPrepareDirPath);
    if (!fs.existsSync(afterPrepareDirPath)) {
      if (!fs.existsSync(hooksDirPath)) {
        fs.mkdirSync(hooksDirPath);
      }
      fs.mkdirSync(afterPrepareDirPath);
    }
    fs.writeFileSync(scriptPath, afterPrepareScriptContent);
  } catch (e) {
    console.log("Failed to install google-service.json after-prepare copy hook.");
    console.log(e);
  }

  /*
     Install before-checkForChanges hook
  */

  console.log("Install google-service.json before-checkForChanges copy hook.");
  try {
    var beforeCheckForChangesContent =
        `
var path = require("path");
var fs = require("fs");

module.exports = function($logger, hookArgs) {
    return new Promise(function(resolve, reject) {

        /* Decide whether to prepare for dev or prod environment */

        var isReleaseBuild = !!((hookArgs.checkForChangesOpts && hookArgs.checkForChangesOpts.projectChangesOptions) || hookArgs.prepareData).release;
        var validProdEnvs = ['prod','production'];
        var validStagingEnvs = ["dev", "development", "staging"];
        var isStagingEnv = false;
        var isProdEnv = false; // building with --env.prod or --env.production flag

        var env = ((hookArgs.checkForChangesOpts && hookArgs.checkForChangesOpts.projectData && hookArgs.checkForChangesOpts.projectData.$options && hookArgs.checkForChangesOpts.projectData.$options.argv) || hookArgs.prepareData).env;
        if (env) {
            Object.keys(env).forEach((key) => {
                if (validProdEnvs.indexOf(key)>-1) { isProdEnv=true; }
                if (validStagingEnvs.indexOf(key) > -1) { isStagingEnv = true; }
            });
            
            
        }

        var buildType = (isReleaseBuild && !isStagingEnv) || isProdEnv ? 'production' : 'development';

        /*
            Detect if we have nativescript-plugin-firebase temp file created during after-prepare hook, so we know
            for which environment {development|prod} the project was prepared. If needed, we delete the NS .nsprepareinfo
            file so we force a new prepare
        */
        var platform = (hookArgs.checkForChangesOpts || hookArgs.prepareData).platform.toLowerCase();
        var projectData = (hookArgs.checkForChangesOpts && hookArgs.checkForChangesOpts.projectData) || hookArgs.projectData;
        var platformsDir = projectData.platformsDir;
        var appResourcesDirectoryPath = projectData.appResourcesDirectoryPath;
        var forcePrepare = true; // whether to force NS to run prepare, defaults to true
        var npfInfoPath = path.join(platformsDir, platform, ".pluginfirebaseinfo");
        var nsPrepareInfoPath = path.join(platformsDir, platform, ".nsprepareinfo");
        var copyPlistOpts = { platform, appResourcesDirectoryPath, buildType, $logger }

        if (fs.existsSync(npfInfoPath)) {
            var npfInfo = undefined;
            try { npfInfo = JSON.parse(fs.readFileSync(npfInfoPath, 'utf8')); }
            catch (e) { $logger.info('nativescript-plugin-firebase: error reading '+npfInfoPath); }

            if (npfInfo && npfInfo.hasOwnProperty('buildType') && npfInfo.buildType===buildType) {
                $logger.info('nativescript-plugin-firebase: building for same environment, not forcing prepare.');
                forcePrepare=false;
            }
        } else { $logger.info('nativescript-plugin-firebase: '+npfInfoPath+' not found, forcing prepare!'); }

        if (forcePrepare) {
            $logger.info('nativescript-plugin-firebase: running release build or change in environment detected, forcing prepare!');

            if (fs.existsSync(npfInfoPath)) { fs.unlinkSync(npfInfoPath); }
            if (fs.existsSync(nsPrepareInfoPath)) { fs.unlinkSync(nsPrepareInfoPath); }

            if (copyPlist(copyPlistOpts)) { resolve(); } else { reject(); }
        } else { resolve(); }
    });
};

/*
    Handle preparing of Google Services files for iOS
*/
var copyPlist = function(copyPlistOpts) {
    if (copyPlistOpts.platform === 'android') { return true; }
    else if (copyPlistOpts.platform === 'ios') {
        var sourceGooglePlistProd = path.join(copyPlistOpts.appResourcesDirectoryPath, "iOS", "GoogleService-Info.plist.prod");
        var sourceGooglePlistDev = path.join(copyPlistOpts.appResourcesDirectoryPath, "iOS", "GoogleService-Info.plist.dev");
        var destinationGooglePlist = path.join(copyPlistOpts.appResourcesDirectoryPath, "iOS", "GoogleService-Info.plist");

        // if we have both dev/prod versions, we copy (or overwrite) GoogleService-Info.plist in destination dir
        if (fs.existsSync(sourceGooglePlistProd) && fs.existsSync(sourceGooglePlistDev)) {
            if (copyPlistOpts.buildType==='production') { // use prod version
                copyPlistOpts.$logger.info("nativescript-plugin-firebase: copy " + sourceGooglePlistProd + " to " + destinationGooglePlist + ".");
                fs.writeFileSync(destinationGooglePlist, fs.readFileSync(sourceGooglePlistProd));
                return true;
            } else { // use dev version
                copyPlistOpts.$logger.info("nativescript-plugin-firebase: copy " + sourceGooglePlistDev + " to " + destinationGooglePlist + ".");
                fs.writeFileSync(destinationGooglePlist, fs.readFileSync(sourceGooglePlistDev));
                return true;
            }
        } else if (!fs.existsSync(destinationGooglePlist)) { // single GoogleService-Info.plist modus but missing`;
    if (externalPushClient) {
      beforeCheckForChangesContent += `
            return true; // this may be a push-only project, so this is allowed`;
    } else {
      beforeCheckForChangesContent += `
            copyPlistOpts.$logger.warn("nativescript-plugin-firebase: " + destinationGooglePlist + " does not exist. Please follow the installation instructions from the documentation");
            return false;`;
    }
    beforeCheckForChangesContent += `
        } else {
            return true; // single GoogleService-Info.plist modus
        }
    } else { return true; }
}
`;
    var scriptPath = path.join(appRoot, "hooks", "before-checkForChanges", "firebase-copy-google-services.js");
    var afterPrepareDirPath = path.dirname(scriptPath);
    var hooksDirPath = path.dirname(afterPrepareDirPath);
    if (!fs.existsSync(afterPrepareDirPath)) {
      if (!fs.existsSync(hooksDirPath)) {
        fs.mkdirSync(hooksDirPath);
      }
      fs.mkdirSync(afterPrepareDirPath);
    }
    fs.writeFileSync(scriptPath, beforeCheckForChangesContent);
  } catch (e) {
    console.log("Failed to install google-service.json before-checkForChanges copy hook.");
    console.log(e);
  }
}

function writeGoogleServiceGradleHook(result) {
  try {
    var scriptContent =
        `var path = require("path");
var fs = require("fs");

module.exports = function($logger, $projectData) {

    return new Promise(function(resolve, reject) {
        $logger.info("Configure firebase");
        let projectBuildGradlePath = path.join($projectData.platformsDir, "android", "build.gradle");
        if (fs.existsSync(projectBuildGradlePath)) {
            let buildGradleContent = fs.readFileSync(projectBuildGradlePath).toString();

            if (buildGradleContent.indexOf(" google()\\n") === -1) {
                let repositoriesNode = buildGradleContent.indexOf("repositories", 0);
                if (repositoriesNode > -1) {
                    repositoriesNode = buildGradleContent.indexOf("}", repositoriesNode);
                    buildGradleContent = buildGradleContent.substr(0, repositoriesNode - 1) + '\\t\\tgoogle()\\n' + buildGradleContent.substr(repositoriesNode - 1);
                }

            }
            
            if (buildGradleContent.indexOf("https://dl.bintray.com/android/android-tools") === -1) {
                let repositoriesNode = buildGradleContent.indexOf("repositories", 0);
                if (repositoriesNode > -1) {
                    repositoriesNode = buildGradleContent.indexOf("}", repositoriesNode);
                    buildGradleContent = buildGradleContent.substr(0, repositoriesNode - 1) + '\\t\\tmaven { url "https://dl.bintray.com/android/android-tools" }\\n' + buildGradleContent.substr(repositoriesNode - 1);
                }
            }
            
            if (buildGradleContent.indexOf("com.google.firebase:firebase-crashlytics-gradle") === -1) {
              let dependenciesNode = buildGradleContent.indexOf("dependencies", 0);
              if (dependenciesNode > -1) {
                  dependenciesNode = buildGradleContent.indexOf("}", dependenciesNode);
                  buildGradleContent = buildGradleContent.substr(0, dependenciesNode - 1) + '	    classpath "com.google.firebase:firebase-crashlytics-gradle:2.3.0"\\n' + buildGradleContent.substr(dependenciesNode - 1);
              }
            }

            let gradlePattern = /classpath ('|")com\\.android\\.tools\\.build:gradle:\\d+\\.\\d+\\.\\d+('|")/;
            let googleServicesPattern = /classpath ('|")com\\.google\\.gms:google-services:\\d+\\.\\d+\\.\\d+('|")/;
            let latestGoogleServicesPlugin = 'classpath "com.google.gms:google-services:4.3.4"';
            if (googleServicesPattern.test(buildGradleContent)) {
                buildGradleContent = buildGradleContent.replace(googleServicesPattern, latestGoogleServicesPlugin);
            } else {
                buildGradleContent = buildGradleContent.replace(gradlePattern, function (match) {
                    return match + '\\n        ' + latestGoogleServicesPlugin;
                });
            }

            fs.writeFileSync(projectBuildGradlePath, buildGradleContent);
        }

        let projectAppBuildGradlePath = path.join($projectData.platformsDir, "android", "app", "build.gradle");
        if (fs.existsSync(projectAppBuildGradlePath)) {
          let appBuildGradleContent = fs.readFileSync(projectAppBuildGradlePath).toString();
          if (appBuildGradleContent.indexOf("buildMetadata.finalizedBy(copyMetadata)") === -1) {
            appBuildGradleContent = appBuildGradleContent.replace("ensureMetadataOutDir.finalizedBy(buildMetadata)", "ensureMetadataOutDir.finalizedBy(buildMetadata)\\n\\t\\tbuildMetadata.finalizedBy(copyMetadata)");
            appBuildGradleContent += \`
task copyMetadata {
  doFirst {
      // before tns-android 5.2.0 its gradle version didn't have this method implemented, so pri
      android.applicationVariants.all { variant ->
          if (variant.buildType.name == project.selectedBuildType) {
              def task
              if (variant.metaClass.respondsTo(variant, "getMergeAssetsProvider")) {
                  def provider = variant.getMergeAssetsProvider()
                  task = provider.get();
              } else {
                  // fallback for older android gradle plugin versions
                  task = variant.getMergeAssets()
              }
              for (File file : task.getOutputs().getFiles()) {
                  if (!file.getPath().contains("/incremental/")) {
                      project.ext.mergedAssetsOutputPath = file.getPath()
                  }
              }
          }
      }
  }
  doLast {
    copy {
      if (!project.mergedAssetsOutputPath) {
        // mergedAssetsOutputPath not found fallback to the default value for android gradle plugin 3.4.0
        project.ext.mergedAssetsOutputPath = "$projectDir/build/intermediates/assets/" + project.selectedBuildType + "/out"
      }
      from "$projectDir/src/main/assets/metadata"
      into project.mergedAssetsOutputPath + "/metadata"
    }
  }
}\`;
            fs.writeFileSync(projectAppBuildGradlePath, appBuildGradleContent);
          }
        }

        resolve();
    });
};
`;
    var scriptPath = path.join(appRoot, "hooks", "after-prepare", "firebase-build-gradle.js");
    fs.writeFileSync(scriptPath, scriptContent);
  } catch (e) {
    console.log("Failed to install firebase-build-gradle hook.");
    console.log(e);
  }
}

/**
 * Determines if the answer validates as selected
 *
 * @param {any} value The user input for a prompt
 * @returns {boolean} The answer is yes, {false} The answer is no
 */
function isSelected(value) {
  return value === true || (typeof value === "string" && value.toLowerCase() === 'y');
}

function isPresent(value) {
  return value !== undefined;
}
