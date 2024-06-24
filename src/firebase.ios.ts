import { Application, Device } from "@nativescript/core";
import { DocumentSnapshot as DocumentSnapshotBase, FieldValue, firebase, GeoPoint, isDocumentReference } from "./firebase-common";
import * as firebaseFunctions from "./functions/functions";
import * as firebaseMessaging from "./messaging/messaging";
import { firebaseUtils } from "./utils";
import { getNonce, Sha256 } from "./utils/nonce-util-ios";
import { firestore } from "./firebase";

declare const ASAuthorizationAppleIDProvider, ASAuthorizationScopeFullName, ASAuthorizationScopeEmail, ASAuthorizationController, ASAuthorizationControllerDelegate, ASAuthorizationAppleIDCredential, ASAuthorizationControllerPresentationContextProviding: any;
export enum QueryOrderByType {
  KEY,
  VALUE,
  CHILD,
  PRIORITY
}

/**
 * The allowed values for QueryOptions.range.type.
 */
export enum QueryRangeType {
  START_AT,
  END_AT,
  EQUAL_TO
}

/**
 * The allowed values for QueryOptions.limit.type.
 */
export enum QueryLimitType {
  FIRST,
  LAST
}
type ActionCodeSettings = {
  url: string;
  handleCodeInApp?: boolean;
  android?: {
    installApp?: boolean;
    minimumVersion?: string;
    packageName: string;
  };
  iOS?: {
    bundleId: string;
    dynamicLinkDomain?: string;
  };
};
export interface OnDisconnectBase {
  cancel(): Promise<any>;

  remove(): Promise<any>;

  set(value: any): Promise<any>;

  setWithPriority(
      value: any,
      priority: number | string
  ): Promise<any>;

  update(values: Object): Promise<any>;
}


export interface DataSnapshot {
  key: string;
  ref: any; // TODO: Type it so that it returns a databaseReference.
  child(path: string): DataSnapshot;

  exists(): boolean;

  forEach(action: (snapshot: DataSnapshot) => any): boolean;

  getPriority(): string | number | null;

  hasChild(path: string): boolean;

  hasChildren(): boolean;

  numChildren(): number;

  toJSON(): Object;

  val(): any;
}

export interface FBData {
  type: string;
  key: string;
  value: any;
}

export interface FBDataSingleEvent extends FBData {
  children?: Array<any>;
}

export interface FBErrorData {
  error: string;
}

export interface GetAuthTokenOptions {
  /**
   * Default false.
   */
  forceRefresh?: boolean;
}
export interface IdTokenResult {
  token: string;
  claims: { [key: string]: any; };
  signInProvider: string;
  expirationTime: number;
  issuedAtTime: number;
  authTime: number;
}
export interface QueryRangeOption {
  type: QueryRangeType;
  value: any;
}

/**
 * The options object passed into the query function.
 */
export interface QueryOptions {
  /**
   * How you'd like to sort the query result.
   */
  orderBy: {
    type: QueryOrderByType;
    /**
     * mandatory when type is QueryOrderByType.CHILD
     */
    value?: string;
  };

  /**
   * You can further restrict the returned results by specifying restrictions.
   * Need more than one range restriction? Use 'ranges' instead.
   */
  range?: QueryRangeOption;

  /**
   * Same as 'range', but for a 'chain of ranges'.
   * You can further restrict the returned results by specifying restrictions.
   */
  ranges?: QueryRangeOption[];

  /**
   * You can limit the number of returned rows if you want to.
   */
  limit?: {
    type: QueryLimitType;
    value: number;
  };

  /**
   * Set this to true if you don't want to listen for any future updates,
   * but just want to retrieve the current value.
   * You can also use this to check if certain data is in the database.
   * Default false.
   */
  singleEvent?: boolean;
}
export interface Provider {
  id: string;
  token?: string;
}

export interface User {
  uid: string;
  email?: string;
  emailVerified: boolean;
  displayName?: string;
  phoneNumber?: string;
  anonymous: boolean;
  isAnonymous: boolean; // This is used by the web API
  providers: Array<Provider>;
  photoURL?: string;
  metadata: UserMetadata;
  additionalUserInfo?: AdditionalUserInfo;

  /** iOS only */
  refreshToken?: string;

  getIdToken(forceRefresh?: boolean): Promise<string>;

  getIdTokenResult(forceRefresh?: boolean): Promise<IdTokenResult>;

  sendEmailVerification(actionCodeSettings?: ActionCodeSettings): Promise<void>;
}

/**
 * The metadata of the user
 */
export interface UserMetadata {
  creationTimestamp: Date;
  lastSignInTimestamp: Date;
}

/**
 * Contains additional user information
 */
export interface AdditionalUserInfo {
  profile: Map<string, any>;
  providerId: string;
  username: string;
  isNewUser: boolean;
}

firebase._gIDAuthentication = null;
firebase._cachedDynamicLink = null;
firebase._configured = false;
firebase._currentNonce = null;

const useExternalPushProvider = NSBundle.mainBundle.infoDictionary.objectForKey("UseExternalPushProvider") === true;

let initializeArguments: any;

class DocumentSnapshot extends DocumentSnapshotBase {
  ios: FIRDocumentSnapshot;

  metadata = {
    fromCache: this.snapshot.metadata.fromCache,
    hasPendingWrites: this.snapshot.metadata.pendingWrites
  };

  constructor(public snapshot: FIRDocumentSnapshot) {
    super(snapshot.documentID, snapshot.exists, firebaseUtils.toJsObject(snapshot.data()), firebase.firestore._getDocumentReference(snapshot.reference));
    this.ios = snapshot;
  }
}

// Note that FIRApp.configure must be called only once, but not here (see https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues/564)

firebase.authStateListener = null;
firebase.addOnMessageReceivedCallback = firebaseMessaging.addOnMessageReceivedCallback;
firebase.addOnPushTokenReceivedCallback = firebaseMessaging.addOnPushTokenReceivedCallback;
firebase.registerForPushNotifications = firebaseMessaging.registerForPushNotifications;
firebase.unregisterForPushNotifications = firebaseMessaging.unregisterForPushNotifications;
firebase.getCurrentPushToken = firebaseMessaging.getCurrentPushToken;
firebase.registerForInteractivePush = firebaseMessaging.registerForInteractivePush;
firebase.subscribeToTopic = firebaseMessaging.subscribeToTopic;
firebase.unsubscribeFromTopic = firebaseMessaging.unsubscribeFromTopic;
firebase.areNotificationsEnabled = firebaseMessaging.areNotificationsEnabled;

firebase.functions = firebaseFunctions;

NSNotificationCenter.defaultCenter.addObserverForNameObjectQueueUsingBlock(
    UIApplicationDidFinishLaunchingNotification,
    null,
    NSOperationQueue.mainQueue,
    appNotification => {
      if (!firebase._configured) {
        firebase._configured = true;
        if (typeof (FIRApp) !== "undefined") {
          FIRApp.configure();
        }
      }
    });

firebase.addAppDelegateMethods = appDelegate => {
  // we need the launchOptions for this one so it's a bit hard to use the UIApplicationDidFinishLaunchingNotification pattern we're using for other things
  // however, let's not override 'applicationDidFinishLaunchingWithOptions' if we don't really need it:
  if (typeof (FIRMessaging) !== "undefined" || useExternalPushProvider || typeof (FBSDKApplicationDelegate) !== "undefined") {
    appDelegate.prototype.applicationDidFinishLaunchingWithOptions = (application, launchOptions) => {
      // If the app was terminated and iOS is launching it in result of a push notification tapped by the user, this will hold the notification data.
      if (launchOptions) {
        const remoteNotification = launchOptions.objectForKey(UIApplicationLaunchOptionsRemoteNotificationKey);
        if (remoteNotification) {
          firebaseMessaging.handleRemoteNotification(application, remoteNotification);
        }
      }

      // Firebase Facebook authentication
      if (typeof (FBSDKApplicationDelegate) !== "undefined") {
        FBSDKApplicationDelegate.sharedInstance.applicationDidFinishLaunchingWithOptions(application, launchOptions);
      }

      return true;
    };
  }

  // there's no notification event to hook into for this one, so using the appDelegate
  if (typeof (FBSDKApplicationDelegate) !== "undefined" || typeof (GIDSignIn) !== "undefined" || typeof (FIRDynamicLink) !== "undefined") {
    appDelegate.prototype.applicationOpenURLSourceApplicationAnnotation = (application, url, sourceApplication, annotation) => {
      let result = false;
      if (typeof (FBSDKApplicationDelegate) !== "undefined") {
        result = FBSDKApplicationDelegate.sharedInstance.applicationOpenURLSourceApplicationAnnotation(application, url, sourceApplication, annotation);
      }

      if (typeof (GIDSignIn) !== "undefined") {
        result = result || GIDSignIn.sharedInstance().handleURL(url);
      }

      if (typeof (FIRDynamicLink) !== "undefined") {
        const dynamicLink: FIRDynamicLink = FIRDynamicLinks.dynamicLinks().dynamicLinkFromCustomSchemeURL(url);
        if (dynamicLink) {
          console.log("Dynamic link from " + sourceApplication + ", URL: " + dynamicLink.url.absoluteString);
          firebase._cachedDynamicLink = {
            url: dynamicLink.url.absoluteString,
            // matchConfidence: dynamicLink.matchConfidence,
            minimumAppVersion: dynamicLink.minimumAppVersion
          };
          result = true;
        }
      }

      return result;
    };
  }

  if (typeof (FBSDKApplicationDelegate) !== "undefined" || typeof (GIDSignIn) !== "undefined" || typeof (FIRDynamicLink) !== "undefined") {
    appDelegate.prototype.applicationOpenURLOptions = (application, url, options) => {

      let result = false;
      if (typeof (FBSDKApplicationDelegate) !== "undefined") {
        result = FBSDKApplicationDelegate.sharedInstance.applicationOpenURLSourceApplicationAnnotation(
            application,
            url,
            options.valueForKey(UIApplicationOpenURLOptionsSourceApplicationKey),
            options.valueForKey(UIApplicationOpenURLOptionsAnnotationKey));
      }

      if (typeof (GIDSignIn) !== "undefined") {
        result = result || GIDSignIn.sharedInstance().handleURL(url);
      }

      if (typeof (FIRDynamicLink) !== "undefined") {
        const dynamicLinks: FIRDynamicLinks = FIRDynamicLinks.dynamicLinks();
        const dynamicLink: FIRDynamicLink = dynamicLinks.dynamicLinkFromCustomSchemeURL(url);
        if (dynamicLink && dynamicLink.url !== null) {
          if (firebase._dynamicLinkCallback) {
            firebase._dynamicLinkCallback({
              url: dynamicLink.url.absoluteString,
              // matchConfidence: dynamicLink.matchConfidence,
              minimumAppVersion: dynamicLink.minimumAppVersion
            });
          } else {
            firebase._cachedDynamicLink = {
              url: dynamicLink.url.absoluteString,
              // matchConfidence: dynamicLink.matchConfidence,
              minimumAppVersion: dynamicLink.minimumAppVersion
            };
          }
          result = true;
        }
      }
      return result;
    };
  }

  if (typeof (FIRDynamicLink) !== "undefined") {
    appDelegate.prototype.applicationContinueUserActivityRestorationHandler = (application, userActivity, restorationHandler) => {
      let result = false;

      if (userActivity.webpageURL) {
        // check for an email-link-login flow

        firebase.fAuth = (typeof (FIRAuth) !== "undefined") ? FIRAuth.auth() : undefined;
        if (firebase.fAuth && firebase.fAuth.isSignInWithEmailLink(userActivity.webpageURL.absoluteString)) {
          const rememberedEmail = firebase.getRememberedEmailForEmailLinkLogin();
          if (rememberedEmail !== undefined) {

            if (firebase.fAuth.currentUser) {
              const onCompletionLink = (result: FIRAuthDataResult, error: NSError) => {
                if (error) {
                  // ignore, and complete the email link sign in flow
                  firebase.fAuth.signInWithEmailLinkCompletion(rememberedEmail, userActivity.webpageURL.absoluteString, (authData: FIRAuthDataResult, error: NSError) => {
                    if (!error) {
                      firebase.notifyAuthStateListeners({
                        loggedIn: true,
                        user: toLoginResult(authData.user)
                      });
                    }
                    firebase.fAuth = null;
                  });
                } else {
                  // linking successful, so the user can now log in with either their email address, or however he logged in previously
                  firebase.notifyAuthStateListeners({
                    loggedIn: true,
                    user: toLoginResult(result.user)
                  });
                  firebase.fAuth = null;
                }
              };
              const fIRAuthCredential = FIREmailAuthProvider.credentialWithEmailLink(rememberedEmail, userActivity.webpageURL.absoluteString);
              firebase.fAuth.currentUser.linkWithCredentialCompletion(fIRAuthCredential, onCompletionLink);

            } else {
              firebase.fAuth.signInWithEmailLinkCompletion(rememberedEmail, userActivity.webpageURL.absoluteString, (authData: FIRAuthDataResult, error: NSError) => {
                if (error) {
                  console.log(error.localizedDescription);
                } else {
                  firebase.notifyAuthStateListeners({
                    loggedIn: true,
                    user: toLoginResult(authData.user)
                  });
                }
                firebase.fAuth = null;
              });
            }
          }
          result = true;

        } else {
          result = FIRDynamicLinks.dynamicLinks().handleUniversalLinkCompletion(userActivity.webpageURL, (dynamicLink, error) => {
            if (dynamicLink !== null && dynamicLink.url !== null) {
              if (firebase._dynamicLinkCallback) {
                firebase._dynamicLinkCallback({
                  url: dynamicLink.url.absoluteString,
                  // matchConfidence: dynamicLink.matchConfidence,
                  minimumAppVersion: dynamicLink.minimumAppVersion
                });
              } else {
                firebase._cachedDynamicLink = {
                  url: dynamicLink.url.absoluteString,
                  // matchConfidence: dynamicLink.matchConfidence,
                  minimumAppVersion: dynamicLink.minimumAppVersion
                };
              }
            }
          });
        }
      }
      return result;
    };
  }

  // only add the push notification delegate methods if either FIRMessaging is enabled, or an external push provider is being used
  if (typeof (FIRMessaging) !== "undefined" || useExternalPushProvider) {
    firebaseMessaging.addBackgroundRemoteNotificationHandler(appDelegate);
  }
};

firebase.fetchSignInMethodsForEmail = email => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof (email) !== "string") {
        reject("A parameter representing an email address is required.");
        return;
      }

      FIRAuth.auth().fetchSignInMethodsForEmailCompletion(email, (methodsNSArray, error) => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve(firebaseUtils.toJsObject(methodsNSArray));
        }
      });
    } catch (ex) {
      console.log("Error in firebase.fetchSignInMethodsForEmail: " + ex);
      reject(ex);
    }
  });
};

firebase.addOnDynamicLinkReceivedCallback = callback => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof (FIRDynamicLink) === "undefined") {
        reject("Set 'dynamic_links' to 'true' in firebase.nativescript.json and remove the platforms/ios folder");
        return;
      }

      firebase._dynamicLinkCallback = callback;

      // if the app was launched from a dynamic link, process it now
      if (firebase._cachedDynamicLink !== null) {
        callback(firebase._cachedDynamicLink);
        firebase._cachedDynamicLink = null;
      }

      resolve();
    } catch (ex) {
      console.log("Error in firebase.addOnDynamicLinkReceivedCallback: " + ex);
      reject(ex);
    }
  });
};

if (typeof (FIRMessaging) !== "undefined" || useExternalPushProvider) {
  firebaseMessaging.prepAppDelegate();
}

// This breaks in-app-messaging :(
function getAppDelegate() {
  // Play nice with other plugins by not completely ignoring anything already added to the appdelegate
  if (Application.ios.delegate === undefined) {

    @ObjCClass(UIApplicationDelegate)
    @NativeClass()
    class UIApplicationDelegateImpl extends UIResponder implements UIApplicationDelegate {
    }

    Application.ios.delegate = UIApplicationDelegateImpl;
  }
  return Application.ios.delegate;
}

firebase.addAppDelegateMethods(getAppDelegate());

firebase.getCallbackData = (type, snapshot: FIRDataSnapshot) => {
  return {
    type: type,
    key: snapshot.key,
    value: firebaseUtils.toJsObject(snapshot.value)
  };
};

firebase.init = arg => {
  return new Promise((resolve, reject) => {
    if (firebase.initialized) {
      reject("Firebase already initialized");
      return;
    }

    firebase.initialized = true;

    try {
      try {
        // this is only available when the Realtime DB Pod is loaded
        if (typeof (FIRServerValue) !== "undefined") {
          firebase.ServerValue = {
            TIMESTAMP: FIRServerValue.timestamp()
          };
        }
      } catch (ignore) {
      }

      arg = arg || {};
      initializeArguments = arg;

      // if deeplinks are used, then for this scheme to work the use must have added the bundle as a scheme to their plist (this is in our docs)
      if (FIROptions && FIROptions.defaultOptions() !== null) {
        FIROptions.defaultOptions().deepLinkURLScheme = NSBundle.mainBundle.bundleIdentifier;
      }

      if (typeof (FIRAnalytics) !== "undefined" && FIRAnalytics.setAnalyticsCollectionEnabled) {
        FIRAnalytics.setAnalyticsCollectionEnabled(arg.analyticsCollectionEnabled !== false);
      }

      if (!firebase._configured) {
        firebase._configured = true;
        if (typeof (FIRApp) !== "undefined") {
          FIRApp.configure();
        }
      }

      if (typeof (FIRDatabase) !== "undefined") {
        if (arg.persist) {
          FIRDatabase.database().persistenceEnabled = true;
        }
      }

      if (typeof (FIRFirestore) !== "undefined") {
        // Firestore has offline persistence enabled by default
        if (arg.persist === false) {
          const fIRFirestoreSettings = FIRFirestoreSettings.new();
          fIRFirestoreSettings.persistenceEnabled = false;
          FIRFirestore.firestore().settings = fIRFirestoreSettings;
        }
      }

      if (typeof (FIRAuth) !== "undefined") {
        if (arg.iOSEmulatorFlush) {
          try {
            // Attempt to sign out before initializing, useful in case previous
            // project token is cached which leads to following type of error:
            // "[FirebaseDatabase] Authentication failed: invalid_token ..."
            FIRAuth.auth().signOut();
          } catch (signOutErr) {
            console.log("Sign out of Firebase error: " + signOutErr);
          }
        }

        if (arg.onAuthStateChanged) {
          firebase.authStateListener = (auth, user) => {
            arg.onAuthStateChanged({
              loggedIn: user !== null,
              user: toLoginResult(user)
            });
          };
          FIRAuth.auth().addAuthStateDidChangeListener(firebase.authStateListener);
        }

        // Listen to auth state changes
        if (!firebase.authStateListener) {
          firebase.authStateListener = (auth, user) => {
            firebase.notifyAuthStateListeners({
              loggedIn: user !== null,
              user: toLoginResult(user)
            });
          };
          FIRAuth.auth().addAuthStateDidChangeListener(firebase.authStateListener);
        }
      }

      // Firebase DynamicLink
      if (arg.onDynamicLinkCallback !== undefined) {
        firebase.addOnDynamicLinkReceivedCallback(arg.onDynamicLinkCallback);
      }

      // Facebook Auth
      if (typeof (FBSDKAppEvents) !== "undefined") {
        FBSDKAppEvents.activateApp();
      }

      // Firebase notifications (FCM)
      if (typeof (FIRMessaging) !== "undefined") {
        firebaseMessaging.initFirebaseMessaging(arg);
      }

      // Firebase storage
      if (arg.storageBucket) {
        if (typeof (FIRStorage) === "undefined") {
          reject("Uncomment Storage in the plugin's Podfile first");
          return;
        }
        firebase.storageBucket = FIRStorage.storage().referenceForURL(arg.storageBucket);
      }

      resolve(typeof (FIRDatabase) !== "undefined" ? FIRDatabase.database().reference() : undefined);
    } catch (ex) {
      console.log("Error in firebase.init: " + ex);
      reject(ex);
    }
  });
};

firebase.getRemoteConfig = arg => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof (FIRRemoteConfig) === "undefined") {
        reject("Uncomment RemoteConfig in the plugin's Podfile first");
        return;
      }

      if (arg.properties === undefined) {
        reject("Argument 'properties' is missing");
        return;
      }

      // Get a Remote Config object instance
      const firebaseRemoteConfig = FIRRemoteConfig.remoteConfig();

      // Enable developer mode to allow for frequent refreshes of the cache
      // TODO this is deprecated (but not removed yet), see https://firebase.google.com/support/release-notes/ios#remote-config_2
      firebaseRemoteConfig.configSettings = new FIRRemoteConfigSettings({developerModeEnabled: arg.developerMode || false});

      const dic: any = NSMutableDictionary.new();
      for (let p in arg.properties) {
        const prop = arg.properties[p];
        if (prop.default !== undefined) {
          dic.setObjectForKey(prop.default, prop.key);
        }
      }
      firebaseRemoteConfig.setDefaults(dic);

      const onCompletion = (remoteConfigFetchStatus, error) => {
        if (remoteConfigFetchStatus === FIRRemoteConfigFetchStatus.Success ||
            remoteConfigFetchStatus === FIRRemoteConfigFetchStatus.Throttled) {

          const activated = firebaseRemoteConfig.activateFetched();

          const result = {
            lastFetch: firebaseRemoteConfig.lastFetchTime,
            throttled: remoteConfigFetchStatus === FIRRemoteConfigFetchStatus.Throttled,
            properties: {}
          };

          for (let p in arg.properties) {
            const prop = arg.properties[p];
            const key = prop.key;
            const value = firebaseRemoteConfig.configValueForKey(key).stringValue;
            // we could have the user pass in the type but this seems easier to use
            result.properties[key] = firebase.strongTypeify(value);
          }
          resolve(result);

        } else {
          reject(error ? error.localizedDescription : "Unknown error, fetch status: " + remoteConfigFetchStatus);
        }
      };

      // default 12 hours, just like the SDK does
      const expirationDuration = arg.cacheExpirationSeconds || 43200;

      firebaseRemoteConfig.fetchWithExpirationDurationCompletionHandler(expirationDuration, onCompletion);
    } catch (ex) {
      console.log("Error in firebase.getRemoteConfig: " + ex);
      reject(ex);
    }
  });
};

firebase.getCurrentUser = arg => {
  return new Promise((resolve, reject) => {
    try {
      const fAuth = FIRAuth.auth();
      if (fAuth === null) {
        reject("Run init() first!");
        return;
      }

      const user = fAuth.currentUser;
      if (user) {
        resolve(toLoginResult(user));
      } else {
        reject();
      }
    } catch (ex) {
      console.log("Error in firebase.getCurrentUser: " + ex);
      reject(ex);
    }
  });
};

firebase.sendEmailVerification = (actionCodeSettings?: ActionCodeSettings) => {
  return new Promise((resolve, reject) => {
    try {
      const fAuth = FIRAuth.auth();
      if (fAuth === null) {
        reject("Run init() first!");
        return;
      }

      const user = fAuth.currentUser;
      if (user) {
        const onCompletion = error => {
          if (error) {
            reject(error.localizedDescription);
          } else {
            resolve(true);
          }
        };
        if (actionCodeSettings) {
          const firActionCodeSettings = FIRActionCodeSettings.new();
          if (actionCodeSettings.handleCodeInApp !== undefined) {
            firActionCodeSettings.handleCodeInApp = actionCodeSettings.handleCodeInApp;
          }
          if (actionCodeSettings.url) {
            firActionCodeSettings.URL = NSURL.URLWithString(actionCodeSettings.url);
          }
          if (actionCodeSettings.iOS) {
            if (actionCodeSettings.iOS.bundleId) {
              firActionCodeSettings.setIOSBundleID(actionCodeSettings.iOS.bundleId);
            }
            if (actionCodeSettings.iOS.dynamicLinkDomain) {
              firActionCodeSettings.dynamicLinkDomain = actionCodeSettings.iOS.dynamicLinkDomain;
            }
          }
          if (actionCodeSettings.android && actionCodeSettings.android.packageName) {
            firActionCodeSettings.setAndroidPackageNameInstallIfNotAvailableMinimumVersion(actionCodeSettings.android.packageName, actionCodeSettings.android.installApp, actionCodeSettings.android.minimumVersion || null);
          }
          user.sendEmailVerificationWithActionCodeSettingsCompletion(firActionCodeSettings, onCompletion);
        } else {
          user.sendEmailVerificationWithCompletion(onCompletion);
        }
      } else {
        reject("Log in first");
      }
    } catch (ex) {
      console.log("Error in firebase.sendEmailVerification: " + ex);
      reject(ex);
    }
  });
};

firebase.logout = arg => {
  return new Promise((resolve, reject) => {
    try {
      FIRAuth.auth().signOut();

      // reset additional user info
      firebase.currentAdditionalUserInfo = null;

      // also disconnect from Google otherwise ppl can't connect with a different account
      if (typeof (GIDSignIn) !== "undefined") {
        GIDSignIn.sharedInstance().disconnect();
      }

      if (typeof (FBSDKLoginManager) !== "undefined") {
        FBSDKLoginManager.alloc().logOut();
      }

      resolve();
    } catch (ex) {
      console.log("Error in firebase.logout: " + ex);
      reject(ex);
    }
  });
};

firebase.unlink = providerId => {
  return new Promise((resolve, reject) => {
    try {
      const user = FIRAuth.auth().currentUser;
      if (!user) {
        reject("Not logged in");
        return;
      }

      user.unlinkFromProviderCompletion(providerId, (user, error) => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve(user);
        }
      });

    } catch (ex) {
      console.log("Error in firebase.logout: " + ex);
      reject(ex);
    }
  });
};

function toLoginResult(user, additionalUserInfo?: FIRAdditionalUserInfo): User {
  if (!user) {
    return null;
  }

  if (additionalUserInfo) {
    firebase.currentAdditionalUserInfo = additionalUserInfo;
  }

  const providers = [];
  if (user.providerData) {
    for (let i = 0, l = user.providerData.count; i < l; i++) {
      const firUserInfo = user.providerData.objectAtIndex(i);
      const pid = firUserInfo.valueForKey("providerID");
      // the app may have dropped Facebook support, so check if the native class is still there
      if (pid === "facebook.com" && typeof (FBSDKAccessToken) !== "undefined") { // FIRFacebookAuthProviderID
        providers.push({id: pid, token: FBSDKAccessToken.currentAccessToken ? FBSDKAccessToken.currentAccessToken.tokenString : null});
      } else if (pid === "google.com" && typeof (GIDSignIn) !== "undefined" && GIDSignIn.sharedInstance() && GIDSignIn.sharedInstance().currentUser) {
        // include web compatible oauth2 token
        const gidCurrentIdToken = GIDSignIn.sharedInstance().currentUser.authentication.idToken;
        providers.push({id: pid, token: gidCurrentIdToken});
      } else if (pid === "apple.com") {
        // TODO
      } else {
        providers.push({id: pid});
      }
    }
  }

  const loginResult: User = {
    uid: user.uid,
    anonymous: user.anonymous,
    isAnonymous: user.anonymous,
    // provider: user.providerID, // always 'Firebase'
    providers: providers,
    photoURL: user.photoURL ? user.photoURL.absoluteString : null,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    phoneNumber: user.phoneNumber,
    refreshToken: user.refreshToken,
    metadata: {
      creationTimestamp: user.metadata.creationDate as Date,
      lastSignInTimestamp: user.metadata.lastSignInDate as Date
    },
    getIdToken: (forceRefresh?: boolean) => new Promise((resolve, reject) => {
      firebase.getAuthToken({forceRefresh})
          .then((result: IdTokenResult) => resolve(result.token))
          .catch(reject);
    }),
    getIdTokenResult: (forceRefresh?: boolean) => new Promise((resolve, reject) => {
      firebase.getAuthToken({forceRefresh})
          .then((result: IdTokenResult) => resolve(result))
          .catch(reject);
    }),
    sendEmailVerification: (actionCodeSettings?: ActionCodeSettings) => firebase.sendEmailVerification(actionCodeSettings)
  };

  if (firebase.currentAdditionalUserInfo) {
    loginResult.additionalUserInfo = {
      providerId: firebase.currentAdditionalUserInfo.providerID,
      username: firebase.currentAdditionalUserInfo.username,
      isNewUser: firebase.currentAdditionalUserInfo.newUser,
      profile: firebaseUtils.toJsObject(firebase.currentAdditionalUserInfo.profile)
    };
  }

  return loginResult;
}

firebase.getAuthToken = (arg: GetAuthTokenOptions): Promise<IdTokenResult> => {
  return new Promise((resolve, reject) => {
    try {
      const fAuth = FIRAuth.auth();
      if (fAuth === null) {
        reject("Run init() first!");
        return;
      }

      const user = fAuth.currentUser;
      if (user) {
        user.getIDTokenResultForcingRefreshCompletion(arg.forceRefresh, (result: FIRAuthTokenResult, error: NSError) => {
          if (error) {
            reject(error.localizedDescription);
          } else {
            resolve({
              token: result.token,
              claims: firebaseUtils.toJsObject(result.claims),
              signInProvider: result.signInProvider,
              expirationTime: firebaseUtils.toJsObject(result.expirationDate),
              issuedAtTime: firebaseUtils.toJsObject(result.issuedAtDate),
              authTime: firebaseUtils.toJsObject(result.authDate)
            });
          }
        });
      } else {
        reject("Log in first");
      }
    } catch (ex) {
      console.log("Error in firebase.getAuthToken: " + ex);
      reject(ex);
    }
  });
};

firebase.login = arg => {
  return new Promise((resolve, reject) => {
    try {
      const onCompletionWithAuthResult = (authResult: FIRAuthDataResult, error?: NSError) => {
        if (error) {
          // also disconnect from Google otherwise ppl can't connect with a different account
          if (typeof (GIDSignIn) !== "undefined") {
            GIDSignIn.sharedInstance().disconnect();
          }
          reject(error.localizedDescription);
        } else {
          resolve(toLoginResult(authResult && authResult.user, authResult && authResult.additionalUserInfo));

          firebase.notifyAuthStateListeners({
            loggedIn: true,
            user: toLoginResult(authResult.user)
          });
        }
        firebase.fAuth = null;
      };

      firebase.fAuth = FIRAuth.auth();
      if (firebase.fAuth === null) {
        reject("Run init() first!");
        return;
      }

      firebase.moveLoginOptionsToObjects(arg);

      if (arg.type === firebase.LoginType.ANONYMOUS) {
        firebase.fAuth.signInAnonymouslyWithCompletion(onCompletionWithAuthResult);

      } else if (arg.type === firebase.LoginType.PASSWORD) {
        if (!arg.passwordOptions || !arg.passwordOptions.email || !arg.passwordOptions.password) {
          reject("Auth type PASSWORD requires an 'passwordOptions.email' and 'passwordOptions.password' argument");
          return;
        }

        const fIRAuthCredential = FIREmailAuthProvider.credentialWithEmailPassword(arg.passwordOptions.email, arg.passwordOptions.password);
        if (firebase.fAuth.currentUser) {
          // link credential, note that you only want to do this if this user doesn't already use fb as an auth provider
          const onCompletionLink = (authData: FIRAuthDataResult, error: NSError) => {
            if (error) {
              // ignore, as this one was probably already linked, so just return the user
              log("--- linking error: " + error.localizedDescription);
              firebase.fAuth.signInWithCredentialCompletion(fIRAuthCredential, onCompletionWithAuthResult);
            } else {
              onCompletionWithAuthResult(authData, error);
            }
            firebase.fAuth = null;
          };
          firebase.fAuth.currentUser.linkWithCredentialCompletion(fIRAuthCredential, onCompletionLink);

        } else {
          firebase.fAuth.signInWithEmailPasswordCompletion(arg.passwordOptions.email, arg.passwordOptions.password, onCompletionWithAuthResult);
        }

      } else if (arg.type === firebase.LoginType.EMAIL_LINK) {
        if (!arg.emailLinkOptions || !arg.emailLinkOptions.email) {
          reject("Auth type EMAIL_LINK requires an 'emailLinkOptions.email' argument");
          return;
        }

        if (!arg.emailLinkOptions.url) {
          reject("Auth type EMAIL_LINK requires an 'emailLinkOptions.url' argument");
          return;
        }

        const firActionCodeSettings = FIRActionCodeSettings.new();
        // This 'continue URL' is what's emailed to the receiver, and the domain must be whitelisted in the Firebase console
        firActionCodeSettings.URL = NSURL.URLWithString(arg.emailLinkOptions.url);
        // The sign-in operation has to always be completed in the app.
        firActionCodeSettings.handleCodeInApp = true;
        firActionCodeSettings.setIOSBundleID(arg.emailLinkOptions.iOS ? arg.emailLinkOptions.iOS.bundleId : NSBundle.mainBundle.bundleIdentifier);
        firActionCodeSettings.setAndroidPackageNameInstallIfNotAvailableMinimumVersion(
            arg.emailLinkOptions.android ? arg.emailLinkOptions.android.packageName : NSBundle.mainBundle.bundleIdentifier,
            arg.emailLinkOptions.android ? arg.emailLinkOptions.android.installApp || false : false,
            arg.emailLinkOptions.android ? arg.emailLinkOptions.android.minimumVersion || "1" : "1");
        firebase.fAuth.sendSignInLinkToEmailActionCodeSettingsCompletion(
            arg.emailLinkOptions.email,
            firActionCodeSettings,
            (error: NSError) => {
              if (error) {
                reject(error.localizedDescription);
                return;
              }
              // The link was successfully sent.
              // Save the email locally so you don't need to ask the user for it again if they open the link on the same Device.
              firebase.rememberEmailForEmailLinkLogin(arg.emailLinkOptions.email);
              resolve();
            }
        );

      } else if (arg.type === firebase.LoginType.PHONE) {
        // https://firebase.google.com/docs/auth/ios/phone-auth
        if (!arg.phoneOptions || !arg.phoneOptions.phoneNumber) {
          reject("Auth type PHONE requires a 'phoneOptions.phoneNumber' argument");
          return;
        }

        FIRPhoneAuthProvider.provider().verifyPhoneNumberUIDelegateCompletion(arg.phoneOptions.phoneNumber, null, (verificationID: string, error: NSError) => {
          if (error) {
            reject(error.localizedDescription);
            return;
          }

          firebase.requestPhoneAuthVerificationCode(userResponse => {
            if (userResponse === undefined) {
              reject("Prompt was canceled");
              return;
            }
            const fIRAuthCredential = FIRPhoneAuthProvider.provider().credentialWithVerificationIDVerificationCode(verificationID, userResponse);
            if (firebase.fAuth.currentUser) {
              const onCompletionLink = (authData: FIRAuthDataResult, error: NSError) => {
                if (error) {
                  // ignore, as this one was probably already linked, so just return the user
                  firebase.fAuth.signInWithCredentialCompletion(fIRAuthCredential, onCompletionWithAuthResult);
                } else {
                  onCompletionWithAuthResult(authData, error);
                }
                firebase.fAuth = null;
              };
              firebase.fAuth.currentUser.linkWithCredentialCompletion(fIRAuthCredential, onCompletionLink);
            } else {
              firebase.fAuth.signInWithCredentialCompletion(fIRAuthCredential, onCompletionWithAuthResult);
            }
          }, arg.phoneOptions.verificationPrompt);
        });

      } else if (arg.type === firebase.LoginType.CUSTOM) {
        if (!arg.customOptions || (!arg.customOptions.token && !arg.customOptions.tokenProviderFn)) {
          reject("Auth type CUSTOM requires a 'customOptions.token' or 'customOptions.tokenProviderFn' argument");
          return;
        }

        if (arg.customOptions.token) {
          firebase.fAuth.signInWithCustomTokenCompletion(arg.customOptions.token, onCompletionWithAuthResult);
        } else if (arg.customOptions.tokenProviderFn) {
          arg.customOptions.tokenProviderFn()
              .then(
                  token => {
                    firebase.fAuth.signInWithCustomTokenCompletion(token, onCompletionWithAuthResult);
                  },
                  error => {
                    reject(error);
                  }
              );
        }

      } else if (arg.type === firebase.LoginType.FACEBOOK) {
        if (typeof (FBSDKLoginManager) === "undefined") {
          reject("Facebook SDK not installed - see Podfile");
          return;
        }

        const onFacebookCompletion = (fbSDKLoginManagerLoginResult: FBSDKLoginManagerLoginResult, error: NSError) => {
          if (error) {
            console.log("Facebook login error " + error);
            reject(error.localizedDescription);
          } else if (fbSDKLoginManagerLoginResult.isCancelled) {
            reject("login cancelled");
          } else {
            // headless facebook auth
            // var fIRAuthCredential = FIRFacebookAuthProvider.credentialWithAccessToken(fbSDKLoginManagerLoginResult.token.tokenString);
            const fIRAuthCredential = FIRFacebookAuthProvider.credentialWithAccessToken(FBSDKAccessToken.currentAccessToken.tokenString);
            if (firebase.fAuth.currentUser) {
              // link credential, note that you only want to do this if this user doesn't already use fb as an auth provider
              const onCompletionLink = (authData: FIRAuthDataResult, error: NSError) => {
                if (error) {
                  // ignore, as this one was probably already linked, so just return the user
                  log("--- linking error: " + error.localizedDescription);
                  firebase.fAuth.signInWithCredentialCompletion(fIRAuthCredential, onCompletionWithAuthResult);
                } else {
                  onCompletionWithAuthResult(authData);
                }
                firebase.fAuth = null;
              };
              firebase.fAuth.currentUser.linkWithCredentialCompletion(fIRAuthCredential, onCompletionLink);

            } else {
              firebase.fAuth.signInWithCredentialCompletion(fIRAuthCredential, onCompletionWithAuthResult);
            }
          }
        };

        // this requires you to set the appid and customurlscheme in app_resources/.plist
        const fbSDKLoginManager = FBSDKLoginManager.new();
        // fbSDKLoginManager.loginBehavior = FBSDKLoginBehavior.Web;
        let scopes: any = ["public_profile", "email"];

        if (arg.facebookOptions && arg.facebookOptions.scopes) {
          scopes = arg.facebookOptions.scopes;
        }

        fbSDKLoginManager.logInWithPermissionsFromViewControllerHandler(
            scopes,
            null, // the viewcontroller param can be null since by default topmost is taken
            onFacebookCompletion);

      } else if (arg.type === firebase.LoginType.APPLE) {
        if (parseInt(Device.osVersion) < 13) {
          reject("Sign in with Apple requires iOS 13 or higher. You're running iOS " + Device.osVersion);
          return;
        }

        firebase._currentNonce = getNonce(32);
        const sha256Nonce = Sha256(firebase._currentNonce);
        const appleIDProvider = ASAuthorizationAppleIDProvider.new();
        const appleIDRequest = appleIDProvider.createRequest();

        let scopes = [ASAuthorizationScopeFullName, ASAuthorizationScopeEmail];

        if (arg.appleOptions && arg.appleOptions.scopes) {
          scopes = [];
          arg.appleOptions.scopes.forEach(scope => {
            if (scope === "name") {
              scopes.push(ASAuthorizationScopeFullName);
            } else if (scope === "email") {
              scopes.push(ASAuthorizationScopeEmail);
            } else {
              console.log("Unknown scope: " + scope);
            }
          });
        }

        appleIDRequest.requestedScopes = scopes;
        appleIDRequest.nonce = sha256Nonce;

        const authorizationController = ASAuthorizationController.alloc().initWithAuthorizationRequests([appleIDRequest]);
        firebase.appleAuthDelegate = ASAuthorizationControllerDelegateImpl.createWithOwnerAndResolveReject(this as any, resolve, reject);
        authorizationController.delegate = firebase.appleAuthDelegate;

        authorizationController.presentationContextProvider = ASAuthorizationControllerPresentationContextProvidingImpl.createWithOwnerAndCallback(this as any);

        authorizationController.performRequests();

      } else if (arg.type === firebase.LoginType.GOOGLE) {
        if (typeof (GIDSignIn) === "undefined") {
          reject("Google Sign In not installed - see Podfile");
          return;
        }

        const sIn = GIDSignIn.sharedInstance();
        sIn.presentingViewController = arg.ios && arg.ios.controller ? arg.ios.controller : Application.ios.rootController;
        sIn.clientID = FIRApp.defaultApp().options.clientID;

        if (arg.googleOptions && arg.googleOptions.hostedDomain) {
          sIn.hostedDomain = arg.googleOptions.hostedDomain;
        }

        if (arg.googleOptions && arg.googleOptions.scopes) {
          sIn.scopes = arg.googleOptions.scopes;
        }

        firebase.googleSignInDelegate = GIDSignInDelegateImpl.new().initWithCallback((user: GIDGoogleUser, error: NSError) => {
          if (error === null) {
            // Get a Google ID token and Google access token from the GIDAuthentication object and exchange them for a Firebase credential
            firebase._gIDAuthentication = user.authentication;
            const fIRAuthCredential = FIRGoogleAuthProvider.credentialWithIDTokenAccessToken(firebase._gIDAuthentication.idToken, firebase._gIDAuthentication.accessToken);

            // Finally, authenticate with Firebase using the credential
            if (firebase.fAuth.currentUser) {
              // link credential, note that you only want to do this if this user doesn't already use Google as an auth provider
              const onCompletionLink = (user, error) => {
                if (error) {
                  // ignore, as this one was probably already linked, so just return the user
                  firebase.fAuth.signInWithCredentialCompletion(fIRAuthCredential, onCompletionWithAuthResult);
                } else {
                  onCompletionWithAuthResult(user);
                }
                firebase.fAuth = null;
              };
              firebase.fAuth.currentUser.linkWithCredentialCompletion(fIRAuthCredential, onCompletionLink);

            } else {
              firebase.fAuth.signInWithCredentialCompletion(fIRAuthCredential, onCompletionWithAuthResult);
            }

          } else {
            reject(error.localizedDescription);
          }
          firebase.googleSignInDelegate = null;
        });

        sIn.delegate = firebase.googleSignInDelegate;
        sIn.signIn();
      } else {
        reject("Unsupported auth type: " + arg.type);
      }
    } catch (ex) {
      console.log("Error in firebase.login: " + ex);
      reject(ex);
    }
  });
};

firebase.reauthenticate = arg => {
  return new Promise((resolve, reject) => {
    try {
      const fAuth = FIRAuth.auth();
      if (fAuth === null) {
        reject("Run init() first!");
        return;
      }

      const user = fAuth.currentUser;
      if (user === null) {
        reject("no current user");
        return;
      }

      firebase.moveLoginOptionsToObjects(arg);

      let authCredential = null;
      if (arg.type === firebase.LoginType.PASSWORD) {
        if (!arg.passwordOptions || !arg.passwordOptions.email || !arg.passwordOptions.password) {
          reject("Auth type PASSWORD requires an 'passwordOptions.email' and 'passwordOptions.password' argument");
          return;
        }
        authCredential = FIREmailAuthProvider.credentialWithEmailPassword(arg.passwordOptions.email, arg.passwordOptions.password);

      } else if (arg.type === firebase.LoginType.GOOGLE) {
        if (!firebase._gIDAuthentication) {
          reject("Not currently logged in with Google");
          return;
        }
        authCredential = FIRGoogleAuthProvider.credentialWithIDTokenAccessToken(firebase._gIDAuthentication.idToken, firebase._gIDAuthentication.accessToken);

      } else if (arg.type === firebase.LoginType.FACEBOOK) {
        if (!FBSDKAccessToken.currentAccessToken) {
          reject("Not currently logged in with Facebook");
          return;
        }
        authCredential = FIRFacebookAuthProvider.credentialWithAccessToken(FBSDKAccessToken.currentAccessToken.tokenString);
      }

      if (authCredential === null) {
        reject("arg.type should be one of LoginType.PASSWORD | LoginType.GOOGLE | LoginType.FACEBOOK");
        return;
      }

      const onCompletion = (authResult: FIRAuthDataResult, error: NSError) => {
        if (error) {
          reject(error.localizedDescription);

        } else {
          firebase.notifyAuthStateListeners({
            loggedIn: true,
            user: toLoginResult(authResult.user)
          });

          resolve(toLoginResult(authResult && authResult.user, authResult && authResult.additionalUserInfo));
        }
      };
      user.reauthenticateWithCredentialCompletion(authCredential, onCompletion);

    } catch (ex) {
      console.log("Error in firebase.reauthenticate: " + ex);
      reject(ex);
    }
  });
};

firebase.reloadUser = () => {
  return new Promise((resolve, reject) => {
    try {
      const user = FIRAuth.auth().currentUser;

      if (user === null) {
        reject("no current user");
        return;
      }

      const onCompletion = error => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve();
        }
      };

      user.reloadWithCompletion(onCompletion);
    } catch (ex) {
      console.log("Error in firebase.reloadUser: " + ex);
      reject(ex);
    }
  });
};

firebase.sendPasswordResetEmail = (email: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      const onCompletion = error => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve();
        }
      };

      FIRAuth.auth().sendPasswordResetWithEmailCompletion(email, onCompletion);
    } catch (ex) {
      console.log("Error in firebase.sendPasswordResetEmail: " + ex);
      reject(ex);
    }
  });
};

firebase.updateEmail = (newEmail: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      const onCompletion = error => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve();
        }
      };

      const user = FIRAuth.auth().currentUser;
      if (user === null) {
        reject("no current user");
      } else {
        user.updateEmailCompletion(newEmail, onCompletion);
      }
    } catch (ex) {
      console.log("Error in firebase.updateEmail: " + ex);
      reject(ex);
    }
  });
};

firebase.updatePassword = (newPassword: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      const onCompletion = error => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve();
        }
      };

      const user = FIRAuth.auth().currentUser;
      if (user === null) {
        reject("no current user");
      } else {
        user.updatePasswordCompletion(newPassword, onCompletion);
      }
    } catch (ex) {
      console.log("Error in firebase.updatePassword: " + ex);
      reject(ex);
    }
  });
};

firebase.createUser = arg => {
  return new Promise((resolve, reject) => {
    try {
      const onCompletion = (authResult: FIRAuthDataResult, error: NSError) => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve(toLoginResult(authResult.user, authResult.additionalUserInfo));
        }
      };

      if (!arg.email || !arg.password) {
        reject("Creating a user requires an email and password argument");
      } else {
        // instance.createUserPasswordWithValueCompletionBlock(arg.email, arg.password, onCompletion);
        FIRAuth.auth().createUserWithEmailPasswordCompletion(arg.email, arg.password, onCompletion);
      }
    } catch (ex) {
      console.log("Error in firebase.createUser: " + ex);
      reject(ex);
    }
  });
};

firebase.deleteUser = arg => {
  return new Promise((resolve, reject) => {
    try {
      const user = FIRAuth.auth().currentUser;
      if (user === null) {
        reject("no current user");
        return;
      }

      const onCompletion = error => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve();
        }
      };

      user.deleteWithCompletion(onCompletion);
    } catch (ex) {
      console.log("Error in firebase.deleteUser: " + ex);
      reject(ex);
    }
  });
};

firebase.updateProfile = arg => {
  return new Promise((resolve, reject) => {
    try {
      const onCompletion = error => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve();
        }
      };

      const fAuth = FIRAuth.auth();
      if (fAuth === null) {
        reject("Run init() first!");
        return;
      }

      if (!arg.displayName && !arg.photoURL) {
        reject("Updating a profile requires a displayName and / or a photoURL argument");
      } else {
        const user = fAuth.currentUser;
        if (user) {
          const changeRequest = user.profileChangeRequest();
          changeRequest.displayName = arg.displayName;
          changeRequest.photoURL = NSURL.URLWithString(arg.photoURL);
          changeRequest.commitChangesWithCompletion(onCompletion);
        } else {
          reject();
        }
      }
    } catch (ex) {
      console.log("Error in firebase.updateProfile: " + ex);
      reject(ex);
    }
  });
};

/***********************************************
 * START Realtime Database Functions
 ***********************************************/

firebase._addObservers = (to, updateCallback) => {
  const listeners = [];
  listeners.push(to.observeEventTypeWithBlock(FIRDataEventType.ChildAdded, snapshot => {
    updateCallback(firebase.getCallbackData('ChildAdded', snapshot));
  }));
  listeners.push(to.observeEventTypeWithBlock(FIRDataEventType.ChildRemoved, snapshot => {
    updateCallback(firebase.getCallbackData('ChildRemoved', snapshot));
  }));
  listeners.push(to.observeEventTypeWithBlock(FIRDataEventType.ChildChanged, snapshot => {
    updateCallback(firebase.getCallbackData('ChildChanged', snapshot));
  }));
  listeners.push(to.observeEventTypeWithBlock(FIRDataEventType.ChildMoved, snapshot => {
    updateCallback(firebase.getCallbackData('ChildMoved', snapshot));
  }));
  return listeners;
};

firebase.keepInSync = (path, switchOn) => {
  return new Promise((resolve, reject) => {
    try {
      const where = FIRDatabase.database().reference().child(path);
      where.keepSynced(switchOn);
      resolve();
    } catch (ex) {
      console.log("Error in firebase.keepInSync: " + ex);
      reject(ex);
    }
  });
};

firebase.addChildEventListener = (updateCallback, path) => {
  return new Promise((resolve, reject) => {
    try {
      const where = path === undefined ? FIRDatabase.database().reference() : FIRDatabase.database().reference().child(path);
      resolve({
        path: path,
        listeners: firebase._addObservers(where, updateCallback)
      });
    } catch (ex) {
      console.log("Error in firebase.addChildEventListener: " + ex);
      reject(ex);
    }
  });
};

firebase.addValueEventListener = (updateCallback, path) => {
  return new Promise((resolve, reject) => {
    try {
      const where = path === undefined ? FIRDatabase.database().reference() : FIRDatabase.database().reference().child(path);
      const listener = where.observeEventTypeWithBlockWithCancelBlock(
          FIRDataEventType.Value,
          snapshot => {
            updateCallback(firebase.getCallbackData('ValueChanged', snapshot));
          },
          firebaseError => {
            updateCallback({
              error: firebaseError.localizedDescription
            });
          });
      resolve({
        path: path,
        listeners: [listener]
      });
    } catch (ex) {
      console.log("Error in firebase.addChildEventListener: " + ex);
      reject(ex);
    }
  });
};

firebase.getValue = path => {
  return new Promise((resolve, reject) => {
    try {
      const where = path === undefined ? FIRDatabase.database().reference() : FIRDatabase.database().reference().child(path);
      where.observeSingleEventOfTypeWithBlockWithCancelBlock(
          FIRDataEventType.Value,
          snapshot => {
            resolve(firebase.getCallbackData('ValueChanged', snapshot));
          },
          firebaseError => {
            reject(firebaseError.localizedDescription);
          });
    } catch (ex) {
      console.log("Error in firebase.getValue: " + ex);
      reject(ex);
    }
  });
};

firebase.removeEventListeners = (listeners, path) => {
  return new Promise((resolve, reject) => {
    try {
      const where = path === undefined ? FIRDatabase.database().reference() : FIRDatabase.database().reference().child(path);
      for (let i = 0; i < listeners.length; i++) {
        const listener = listeners[i];
        where.removeObserverWithHandle(listener);
      }
      resolve();
    } catch (ex) {
      console.log("Error in firebase.removeEventListeners: " + ex);
      reject(ex);
    }
  });
};

firebase.push = (path, val) => {
  return new Promise((resolve, reject) => {
    try {
      const ref = FIRDatabase.database().reference().child(path).childByAutoId();
      ref.setValueWithCompletionBlock(val, (error: NSError, dbRef: FIRDatabaseReference) => {
        error ? reject(error.localizedDescription) : resolve({key: ref.key});
      });
    } catch (ex) {
      console.log("Error in firebase.push: " + ex);
      reject(ex);
    }
  });
};

firebase.setValue = (path, val) => {
  return new Promise((resolve, reject) => {
    try {
      FIRDatabase.database().reference().child(path).setValueWithCompletionBlock(val, (error: NSError, dbRef: FIRDatabaseReference) => {
        error ? reject(error.localizedDescription) : resolve();
      });
    } catch (ex) {
      console.log("Error in firebase.setValue: " + ex);
      reject(ex);
    }
  });
};

firebase.update = (path, val) => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof val === "object") {
        FIRDatabase.database().reference().child(path).updateChildValuesWithCompletionBlock(val, (error: NSError, dbRef: FIRDatabaseReference) => {
          error ? reject(error.localizedDescription) : resolve();
        });
      } else {
        const lastPartOfPath = path.lastIndexOf("/");
        const pathPrefix = path.substring(0, lastPartOfPath);
        const pathSuffix = path.substring(lastPartOfPath + 1);
        const updateObject = '{"' + pathSuffix + '" : "' + val + '"}';
        FIRDatabase.database().reference().child(pathPrefix).updateChildValuesWithCompletionBlock(JSON.parse(updateObject), (error: NSError, dbRef: FIRDatabaseReference) => {
          error ? reject(error.localizedDescription) : resolve();
        });
      }
    } catch (ex) {
      console.log("Error in firebase.update: " + ex);
      reject(ex);
    }
  });
};

firebase.query = (updateCallback: (data: FBDataSingleEvent) => void, path: string, options: QueryOptions): Promise<any> => {
  return new Promise<any>((resolve, reject) => {
    try {
      const where = path === undefined ? FIRDatabase.database().reference() : FIRDatabase.database().reference().child(path);
      let query: FIRDatabaseQuery;

      // orderBy
      if (options.orderBy.type === firebase.QueryOrderByType.KEY) {
        query = where.queryOrderedByKey();
      } else if (options.orderBy.type === firebase.QueryOrderByType.VALUE) {
        query = where.queryOrderedByValue();
      } else if (options.orderBy.type === firebase.QueryOrderByType.PRIORITY) {
        query = where.queryOrderedByPriority();
      } else if (options.orderBy.type === firebase.QueryOrderByType.CHILD) {
        if (options.orderBy.value === undefined || options.orderBy.value === null) {
          reject("When orderBy.type is 'child' you must set orderBy.value as well.");
          return;
        }
        query = where.queryOrderedByChild(options.orderBy.value);
      } else {
        reject("Invalid orderBy.type, use constants like firebase.QueryOrderByType.VALUE");
        return;
      }

      // range
      if (options.range && options.range.type) {
        // https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues/319
        // if (options.range.value === undefined || options.range.value === null) {
        //   reject("Please set range.value");
        //   return;
        // }
        if (options.range.type === firebase.QueryRangeType.START_AT) {
          query = query.queryStartingAtValue(options.range.value);
        } else if (options.range.type === firebase.QueryRangeType.END_AT) {
          query = query.queryEndingAtValue(options.range.value);
        } else if (options.range.type === firebase.QueryRangeType.EQUAL_TO) {
          query = query.queryEqualToValue(options.range.value);
        } else {
          reject("Invalid range.type, use constants like firebase.QueryRangeType.START_AT");
          return;
        }
      }

      // ranges
      if (options.ranges) {
        for (let i = 0; i < options.ranges.length; i++) {
          const range = options.ranges[i];
          if (range.value === undefined || range.value === null) {
            reject("Please set ranges[" + i + "].value");
            return;
          }
          if (range.type === firebase.QueryRangeType.START_AT) {
            query = query.queryStartingAtValue(range.value);
          } else if (range.type === firebase.QueryRangeType.END_AT) {
            query = query.queryEndingAtValue(range.value);
          } else if (range.type === firebase.QueryRangeType.EQUAL_TO) {
            query = query.queryEqualToValue(range.value);
          } else {
            reject("Invalid ranges[" + i + "].type, use constants like firebase.QueryRangeType.START_AT");
            return;
          }
        }
      }

      // limit
      if (options.limit && options.limit.type) {
        if (options.limit.value === undefined || options.limit.value === null) {
          reject("Please set limit.value");
          return;
        }
        if (options.limit.type === firebase.QueryLimitType.FIRST) {
          query = query.queryLimitedToFirst(options.limit.value);
        } else if (options.limit.type === firebase.QueryLimitType.LAST) {
          query = query.queryLimitedToLast(options.limit.value);
        } else {
          reject("Invalid limit.type, use constants like firebase.queryOptions.limitType.FIRST");
          return;
        }
      }

      if (options.singleEvent) {
        query.observeSingleEventOfTypeWithBlock(FIRDataEventType.Value, snapshot => {
          const result = {
            type: "ValueChanged",
            key: snapshot.key,
            value: {},
            children: []
          };
          for (let i = 0; i < snapshot.children.allObjects.count; i++) {
            const snap: FIRDataSnapshot = snapshot.children.allObjects.objectAtIndex(i);
            const val = firebaseUtils.toJsObject(snap.value);
            result.value[snap.key] = val;
            result.children.push(val);
          }

          if (updateCallback) updateCallback(result);
          // resolve promise with data in case of single event, see https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues/126
          resolve(result);
        });
      } else {
        resolve({
          path: path,
          listeners: firebase._addObservers(query, updateCallback)
        });
      }
    } catch (ex) {
      console.log("Error in firebase.query: " + ex);
      reject(ex);
    }
  });
};

firebase.remove = path => {
  return new Promise((resolve, reject) => {
    try {
      FIRDatabase.database().reference().child(path).setValueWithCompletionBlock(null, (error: NSError, dbRef: FIRDatabaseReference) => {
        error ? reject(error.localizedDescription) : resolve();
      });
    } catch (ex) {
      console.log("Error in firebase.remove: " + ex);
      reject(ex);
    }
  });
};

class OnDisconnect implements OnDisconnectBase {
  constructor(private dbRef: FIRDatabaseReference, private path: string) {
  }

  cancel(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.dbRef.cancelDisconnectOperationsWithCompletionBlock((error: NSError, dbRef: FIRDatabaseReference) => {
          error ? reject(error.localizedDescription) : resolve();
        });
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.cancel: " + ex);
        reject(ex);
      }
    });
  }

  remove(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.dbRef.onDisconnectRemoveValueWithCompletionBlock((error: NSError, dbRef: FIRDatabaseReference) => {
          error ? reject(error.localizedDescription) : resolve();
        });
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.remove: " + ex);
        reject(ex);
      }
    });
  }

  set(value: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.dbRef.onDisconnectSetValueWithCompletionBlock(value, (error: NSError, dbRef: FIRDatabaseReference) => {
          error ? reject(error.localizedDescription) : resolve();
        });
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.set: " + ex);
        reject(ex);
      }
    });
  }

  setWithPriority(value: any, priority: string | number): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.dbRef.onDisconnectSetValueAndPriorityWithCompletionBlock(value, priority, (error: NSError, dbRef: FIRDatabaseReference) => {
          error ? reject(error.localizedDescription) : resolve();
        });
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.setWithPriority: " + ex);
        reject(ex);
      }
    });
  }

  update(values: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        if (typeof values === "object") {
          this.dbRef.onDisconnectUpdateChildValuesWithCompletionBlock(values, (error: NSError, dbRef: FIRDatabaseReference) => {
            error ? reject(error.localizedDescription) : resolve();
          });
        } else {
          const lastPartOfPath = this.path.lastIndexOf("/");
          const pathPrefix = this.path.substring(0, lastPartOfPath);
          const pathSuffix = this.path.substring(lastPartOfPath + 1);
          const updateObject = '{"' + pathSuffix + '" : "' + values + '"}';
          FIRDatabase.database().reference().child(pathPrefix).updateChildValuesWithCompletionBlock(JSON.parse(updateObject), (error: NSError, dbRef: FIRDatabaseReference) => {
            error ? reject(error.localizedDescription) : resolve();
          });
        }
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.update: " + ex);
        reject(ex);
      }
    });
  }
}

firebase.onDisconnect = (path: string): OnDisconnect => {
  if (!firebase.initialized) {
    console.error("Please run firebase.init() before firebase.onDisconnect()");
    throw new Error("FirebaseApp is not initialized. Make sure you run firebase.init() first");
  }
  const dbRef: FIRDatabaseReference = FIRDatabase.database().reference().child(path);
  return new OnDisconnect(dbRef, path);
};

firebase.transaction = (path: string, transactionUpdate: (currentState) => any,
                        onComplete: (a: Error | null, b: boolean, c: DataSnapshot) => Promise<any>) => {
  return new Promise<any>((resolve, reject) => {
    if (!firebase.initialized) {
      console.error("Please run firebase.init() before firebase.transaction()");
      throw new Error("FirebaseApp is not initialized. Make sure you run firebase.init() first");
    }
    const dbRef: FIRDatabaseReference = FIRDatabase.database().reference().child(path);

    dbRef.runTransactionBlockAndCompletionBlock(
        (mutableData: FIRMutableData): FIRTransactionResult => {
          const desiredValue = transactionUpdate(firebaseUtils.toJsObject(mutableData.value));
          if (desiredValue === undefined) {
            // The problem case : user returns undefined when the the value we give them (mutableData) is null.
            // This is a valid case as the user will want to abort if he thinks theres no data, BUT mutualData
            // is usually null when runTransaction is called the first time(which is why its called multiple times).
            // Result: we would abort and the transaction terminates, but the real data didn't have a chance to come in
            // for the function to be called a second time.
            // Even in the ios simple blog example their complete block is called twice with committed first being false
            // followed by a second one saying committed is true... So with this implementation I favored having an "incorrect"
            // committed boolean, but have the correct updated value

            // TLDR: if user returns undefined then we may never execute his function with the correct input
            // For now the way to resolve this is to call success with the original value (so we don't modify anything)
            // And then the user will get his expected value, but { committed: always true }....

            // return FIRTransactionResult.abort();
            return FIRTransactionResult.successWithValue(mutableData);
          } else {
            mutableData.value = desiredValue;
            return FIRTransactionResult.successWithValue(mutableData);
          }
        },
        (error: NSError, commited: boolean, snapshot: FIRDataSnapshot): void => {
          error !== null ? reject(error.localizedDescription) :
              resolve({committed: commited, snapshot: nativeSnapshotToWebSnapshot(snapshot)});
        }
    );
  });
};

// Converts FIRDataSnapshot into Web DataSnapshot
function nativeSnapshotToWebSnapshot(snapshot: FIRDataSnapshot): DataSnapshot {
  function forEach(action: (datasnapshot: DataSnapshot) => any): boolean {
    const iterator: NSEnumerator<FIRDataSnapshot> = snapshot.children;
    let innerSnapshot: FIRDataSnapshot;
    let datasnapshot: DataSnapshot;
    while (innerSnapshot = iterator.nextObject()) {
      datasnapshot = nativeSnapshotToWebSnapshot(innerSnapshot);
      if (action(datasnapshot)) {
        return true;
      }
    }
    return false;
  }

  return {
    key: snapshot.key,
    ref: snapshot.ref,
    child: (path: string) => nativeSnapshotToWebSnapshot(snapshot.childSnapshotForPath(path)),
    exists: () => snapshot.exists(),
    forEach: (func: (datasnapshot) => any) => forEach(func),
    getPriority: () => firebaseUtils.toJsObject(snapshot.priority),
    hasChild: (path: string) => snapshot.hasChild(path),
    hasChildren: () => snapshot.hasChildren(),
    numChildren: () => snapshot.childrenCount,
    toJSON: () => snapshot.valueInExportFormat(),
    val: () => firebaseUtils.toJsObject(snapshot.value)
  };
}

firebase.enableLogging = (logging: boolean, persistent?: boolean) => {
  FIRDatabase.setLoggingEnabled(logging);
};

/***********************************************
 * END Realtime Database Functions
 ***********************************************/

const ensureFirestore = (): void => {
  if (typeof (FIRFirestore) === "undefined") {
    throw new Error("Make sure 'firestore' is enabled in 'firebase.nativescript.json', then clean the node_modules and platforms folders");
  }

  if (!firebase.initialized) {
    throw new Error("Please run firebase.init() before using Firestore");
  }
};

firebase.firestore.WriteBatch = (nativeWriteBatch: FIRWriteBatch): firestore.WriteBatch => {
  class FirestoreWriteBatch implements firestore.WriteBatch {
    constructor() {
    }

    public set = (documentRef: firestore.DocumentReference, data: firestore.DocumentData, options?: firestore.SetOptions): firestore.WriteBatch => {
      fixSpecialFields(data);
      nativeWriteBatch.setDataForDocumentMerge(<any>data, (<any>documentRef).ios, options && options.merge);
      return this;
    }

    public update = (documentRef: firestore.DocumentReference, data: firestore.UpdateData): firestore.WriteBatch => {
      fixSpecialFields(data);
      nativeWriteBatch.updateDataForDocument(<any>data, (<any>documentRef).ios);
      return this;
    }

    public delete = (documentRef: firestore.DocumentReference): firestore.WriteBatch => {
      nativeWriteBatch.deleteDocument((<any>documentRef).ios);
      return this;
    }

    commit(): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        nativeWriteBatch.commitWithCompletion((error: NSError) => {
          error ? reject(error.localizedDescription) : resolve();
        });
      });
    }
  }

  return new FirestoreWriteBatch();
};

firebase.firestore.batch = (): firestore.WriteBatch => {
  ensureFirestore();
  return new firebase.firestore.WriteBatch(FIRFirestore.firestore().batch());
};

firebase.firestore.Transaction = (nativeTransaction: FIRTransaction): any => { //firestore.Transaction
  class FirestoreTransaction implements firestore.Transaction {
    constructor() {
    }

    public get: any = (documentRef: firestore.DocumentReference): DocumentSnapshot => {
      const docSnapshot: FIRDocumentSnapshot = nativeTransaction.getDocumentError((<any>documentRef).ios);
      return new DocumentSnapshot(docSnapshot);
    }

    public set = (documentRef: firestore.DocumentReference, data: firestore.DocumentData, options?: firestore.SetOptions): firestore.Transaction => {
      fixSpecialFields(data);
      nativeTransaction.setDataForDocumentMerge(<any>data, (<any>documentRef).ios, options && options.merge);
      return <any>this;
    }

    public update = (documentRef: firestore.DocumentReference, data: firestore.UpdateData): firestore.Transaction => {
      fixSpecialFields(data);
      nativeTransaction.updateDataForDocument(<any>data, (<any>documentRef).ios);
      return <any>this;
    }

    public delete = (documentRef: firestore.DocumentReference): firestore.Transaction => {
      nativeTransaction.deleteDocument((<any>documentRef).ios);
      return <any>this;
    }
  }

  return new FirestoreTransaction();
};

firebase.firestore.runTransaction = (updateFunction: (transaction: firestore.Transaction) => Promise<any>): Promise<void> => {
  ensureFirestore();
  return new Promise<void>((resolve, reject) => {
    FIRFirestore.firestore().runTransactionWithBlockCompletion(
        (nativeTransaction: FIRTransaction, err: any) => {
          const tx = new firebase.firestore.Transaction(nativeTransaction);
          return updateFunction(tx);
        },
        (result, error: NSError) => error ? reject(error.localizedDescription) : resolve());
  });
};

firebase.firestore.settings = (settings: firestore.Settings) => {
  if (typeof (FIRFirestore) !== "undefined") {
    try {
      const fIRFirestoreSettings = FIRFirestoreSettings.new();
      if (initializeArguments.persist !== undefined) fIRFirestoreSettings.persistenceEnabled = initializeArguments.persist;
      if (settings.ssl !== undefined) fIRFirestoreSettings.sslEnabled = settings.ssl;
      if (settings.host !== undefined) fIRFirestoreSettings.host = settings.host;
      // Cannot do this because of nativescript cannot convert Number to int64_t
      // fIRFirestore(<any>settings).cacheSizeBytes = (<any>settings).cacheSizeBytes;
      FIRFirestore.firestore().settings = fIRFirestoreSettings;
    } catch (err) {
      console.log("Error in firebase.firestore.settings: " + err);
    }
  }
};

firebase.firestore.clearPersistence = (): Promise<void> => {
  ensureFirestore();
  return new Promise<void>((resolve, reject) => {
    FIRFirestore.firestore().clearPersistenceWithCompletion((error: NSError) => {
      error ? reject(error.localizedDescription) : resolve();
    });
  });
};

firebase.firestore.collection = (collectionPath: string): firestore.CollectionReference => {
  ensureFirestore();
  try {
    return firebase.firestore._getCollectionReference(FIRFirestore.firestore().collectionWithPath(collectionPath));
  } catch (ex) {
    console.log("Error in firebase.firestore.collection: " + ex);
    return null;
  }
};

firebase.firestore.collectionGroup = (id: string): any => {
  ensureFirestore();
  try {
    return firebase.firestore._getCollectionGroupQuery(FIRFirestore.firestore().collectionGroupWithID(id));
  } catch (ex) {
    console.log("Error in firebase.firestore.collectionGroup: " + ex);
    return null;
  }
};

firebase.firestore.onDocumentSnapshot = (docRef: FIRDocumentReference, optionsOrCallback: firestore.SnapshotListenOptions | ((snapshot: DocumentSnapshot) => void), callbackOrOnError: (docOrError: DocumentSnapshot | Error) => void, onError: (error: Error) => void): () => void => {
  let includeMetadataChanges = false;
  let onNextCallback: (snapshot: DocumentSnapshot) => void;
  let onErrorCallback: (error: Error) => void;

  if ((typeof optionsOrCallback) === "function") {
    onNextCallback = <(snapshot: DocumentSnapshot) => void>optionsOrCallback;
    onErrorCallback = callbackOrOnError;
  } else {
    onNextCallback = callbackOrOnError;
    onErrorCallback = onError;
  }

  if ((<firestore.SnapshotListenOptions>optionsOrCallback).includeMetadataChanges === true) {
    includeMetadataChanges = true;
  }

  const listener = docRef.addSnapshotListenerWithIncludeMetadataChangesListener(includeMetadataChanges, (snapshot: FIRDocumentSnapshot, error: NSError) => {
    if (error || !snapshot) {
      error && onErrorCallback && onErrorCallback(new Error(error.localizedDescription));
      return;
    }
    onNextCallback && onNextCallback(new DocumentSnapshot(snapshot));
  });

  // There's a bug resulting this function to be undefined..
  if (listener.remove === undefined) {
    return () => {
      // .. so we're just ignoring anything received from the server (until the callback is set again when 'onSnapshot' is invoked).
      onNextCallback = () => {
      };
    };
  } else {
    return () => listener.remove();
  }
};

firebase.firestore.onCollectionSnapshot = (colRef: FIRCollectionReference, optionsOrCallback: firestore.SnapshotListenOptions | ((snapshot: QuerySnapshot) => void), callbackOrOnError: (snapshotOrError: QuerySnapshot | Error) => void, onError?: (error: Error) => void): () => void => {
  let includeMetadataChanges = false;
  let onNextCallback: (snapshot: QuerySnapshot) => void;
  let onErrorCallback: (error: Error) => void;

  // If we passed in an onNext for the first parameter, the next parameter would be onError if provided
  // If options was the first parameter then the next parameter would be onNext if provided
  if ((typeof optionsOrCallback) === "function") {
    onNextCallback = <(snapshot: QuerySnapshot) => void>optionsOrCallback;
    onErrorCallback = callbackOrOnError;
  } else {
    onNextCallback = callbackOrOnError; // Can be undefined if callback was not provided
    onErrorCallback = onError; // Can be undefined if onError was not provided
  }

  if ((<firestore.SnapshotListenOptions>optionsOrCallback).includeMetadataChanges === true) {
    includeMetadataChanges = true;
  }

  const listener = colRef.addSnapshotListenerWithIncludeMetadataChangesListener(includeMetadataChanges, (snapshot: FIRQuerySnapshot, error: NSError) => {
    if (error || !snapshot) {
      error && onErrorCallback && onErrorCallback(new Error(error.localizedDescription));
      return;
    }
    onNextCallback && onNextCallback(new QuerySnapshot(snapshot));
  });

  // There's a bug resulting in this function to be undefined..
  if (listener.remove === undefined) {
    return () => {
      // .. so we're just ignoring anything received from the server (until the callback is set again when 'onSnapshot' is invoked).
      onNextCallback = () => {
      };
    };
  } else {
    return () => listener.remove();
  }
};

firebase.firestore._getCollectionReference = (colRef?: FIRCollectionReference): firestore.CollectionReference => {
  if (!colRef) {
    return null;
  }

  const collectionPath = colRef.path;

  return {
    id: colRef.collectionID,
    parent: firebase.firestore._getDocumentReference(colRef.parent),
    firestore: firebase.firestore,
    doc: (documentPath?: string) => firebase.firestore.doc(collectionPath, documentPath),
    add: document => firebase.firestore.add(collectionPath, document),
    get: (options?: firestore.GetOptions) => firebase.firestore.get(collectionPath, options),
    where: (fieldPath: string, opStr: firestore.WhereFilterOp, value: any) => firebase.firestore.where(collectionPath, fieldPath, opStr, value),
    orderBy: (fieldPath: string, directionStr: firestore.OrderByDirection): firestore.Query => firebase.firestore.orderBy(collectionPath, fieldPath, directionStr, colRef),
    limit: (limit: number): firestore.Query => firebase.firestore.limit(collectionPath, limit, colRef),
    onSnapshot: (optionsOrCallback: firestore.SnapshotListenOptions | ((snapshot: QuerySnapshot) => void), callbackOrOnError?: (snapshotOrError: QuerySnapshot | Error) => void, onError?: (error: Error) => void) => firebase.firestore.onCollectionSnapshot(colRef, optionsOrCallback, callbackOrOnError, onError),
    startAfter: (snapshotOrFieldValue: DocumentSnapshot | any, ...fieldValues: any[]): firestore.Query => firebase.firestore.startAfter(collectionPath, snapshotOrFieldValue, fieldValues, colRef),
    startAt: (snapshotOrFieldValue: DocumentSnapshot | any, ...fieldValues: any[]): firestore.Query => firebase.firestore.startAt(collectionPath, snapshotOrFieldValue, fieldValues, colRef),
    endAt: (snapshotOrFieldValue: DocumentSnapshot | any, ...fieldValues: any[]): firestore.Query => firebase.firestore.endAt(collectionPath, snapshotOrFieldValue, fieldValues, colRef),
    endBefore: (snapshotOrFieldValue: DocumentSnapshot | any, ...fieldValues: any[]): firestore.Query => firebase.firestore.endBefore(collectionPath, snapshotOrFieldValue, fieldValues, colRef)
  };
};

firebase.firestore._getCollectionGroupQuery = (query?: FIRQuery): any => {
  if (!query) {
    return null;
  }

  return {
    where: (property: string, opStr: firestore.WhereFilterOp, value: any) => firebase.firestore.where(undefined, property, opStr, value, query)
  };
};

firebase.firestore._getDocumentReference = (docRef?: FIRDocumentReference): firestore.DocumentReference => {
  if (!docRef) {
    return null;
  }

  const collectionPath = docRef.parent.path;

  return {
    discriminator: "docRef",
    id: docRef.documentID,
    parent: firebase.firestore._getCollectionReference(docRef.parent),
    path: docRef.path,
    firestore: firebase.firestore,
    collection: cp => firebase.firestore.collection(`${collectionPath}/${docRef.documentID}/${cp}`),
    set: (data: any, options?: firestore.SetOptions) => firebase.firestore.set(collectionPath, docRef.documentID, data, options),
    get: (options?: firestore.GetOptions) => firebase.firestore.getDocument(collectionPath, docRef.documentID, options),
    update: (data: any) => firebase.firestore.update(collectionPath, docRef.documentID, data),
    delete: () => firebase.firestore.delete(collectionPath, docRef.documentID),
    onSnapshot: (optionsOrCallback: firestore.SnapshotListenOptions | ((snapshot: firestore.DocumentSnapshot) => void), callbackOrOnError?: (docOrError: firestore.DocumentSnapshot | Error) => void, onError?: (error: Error) => void) => firebase.firestore.onDocumentSnapshot(docRef, optionsOrCallback, callbackOrOnError, onError),
    ios: docRef
  };
};

firebase.firestore.doc = (collectionPath: string, documentPath?: string): firestore.DocumentReference => {
  ensureFirestore();
  try {
    const fIRCollectionReference = FIRFirestore.firestore().collectionWithPath(collectionPath);
    const fIRDocumentReference = documentPath ? fIRCollectionReference.documentWithPath(documentPath) : fIRCollectionReference.documentWithAutoID();
    return firebase.firestore._getDocumentReference(fIRDocumentReference);
  } catch (ex) {
    console.log("Error in firebase.firestore.doc: " + ex);
    return null;
  }
};

firebase.firestore.docRef = (documentPath: string): firestore.DocumentReference => {
  ensureFirestore();
  return firebase.firestore._getDocumentReference(FIRFirestore.firestore().documentWithPath(documentPath));
};

firebase.firestore.add = (collectionPath: string, document: any): Promise<firestore.DocumentReference> => {
  ensureFirestore();
  return new Promise((resolve, reject) => {
    try {
      fixSpecialFields(document);
      const defaultFirestore = FIRFirestore.firestore();
      const fIRDocumentReference = defaultFirestore
          .collectionWithPath(collectionPath)
          .addDocumentWithDataCompletion(document, (error: NSError) => {
            if (error) {
              reject(error.localizedDescription);
            } else {
              resolve(firebase.firestore._getDocumentReference(fIRDocumentReference));
            }
          });

    } catch (ex) {
      console.log("Error in firebase.firestore.add: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore.set = (collectionPath: string, documentPath: string, document: any, options?: firestore.SetOptions): Promise<void> => {
  ensureFirestore();
  return new Promise<void>((resolve, reject) => {
    try {
      fixSpecialFields(document);

      const docRef: FIRDocumentReference = FIRFirestore.firestore()
          .collectionWithPath(collectionPath)
          .documentWithPath(documentPath);

      if (options && options.merge) {
        docRef.setDataMergeCompletion(document, true, (error: NSError) => {
          if (error) {
            reject(error.localizedDescription);
          } else {
            resolve();
          }
        });

      } else {
        docRef.setDataCompletion(document, (error: NSError) => {
          if (error) {
            reject(error.localizedDescription);
          } else {
            resolve();
          }
        });
      }

    } catch (ex) {
      console.log("Error in firebase.firestore.set: " + ex);
      reject(ex);
    }
  });
};

function fixSpecialFields(item) {
  for (let k in item) {
    if (item.hasOwnProperty(k)) {
      item[k] = fixSpecialField(item[k]);
    }
  }
  return item;
}

function fixSpecialField(item): any {
  if (item === null) {
    return null;
  } else if (item === "SERVER_TIMESTAMP") {
    return FIRFieldValue.fieldValueForServerTimestamp();
  } else if (item === "DELETE_FIELD") {
    return FIRFieldValue.fieldValueForDelete();
  } else if (item instanceof FieldValue) {
    const fieldValue: FieldValue = item;
    if (fieldValue.type === "ARRAY_UNION") {
      // nested arrays are not allowed, so harden against wrong usage: arrayUnion(["foo", "bar"]) vs arrayUnion("foo", "bar")
      return FIRFieldValue.fieldValueForArrayUnion(Array.isArray(fieldValue.value[0]) ? fieldValue.value[0] : fieldValue.value);
    } else if (fieldValue.type === "ARRAY_REMOVE") {
      return FIRFieldValue.fieldValueForArrayRemove(Array.isArray(fieldValue.value[0]) ? fieldValue.value[0] : fieldValue.value);
    } else if (fieldValue.type === "INCREMENT") {
      const isInt = fieldValue.value % 1 === 0;
      if (isInt) {
        return FIRFieldValue.fieldValueForIntegerIncrement(fieldValue.value);
      } else {
        return FIRFieldValue.fieldValueForDoubleIncrement(fieldValue.value);
      }
    } else {
      console.log("You found a bug! Please report an issue at https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues, mention fieldValue.type = '" + fieldValue.type + "'. Thanks!");
    }
  } else if (item instanceof GeoPoint) {
    const geo = <GeoPoint>item;
    return new FIRGeoPoint({
      latitude: geo.latitude,
      longitude: geo.longitude
    });
  } else if (isDocumentReference(item)) {
    return (<any>item).ios;
  } else if (typeof item === "object" && item.constructor === Object) {
    return fixSpecialFields(item);
  } else {
    return item;
  }
}

firebase.firestore.update = (collectionPath: string, documentPath: string, document: any): Promise<void> => {
  ensureFirestore();
  return new Promise<void>((resolve, reject) => {
    try {
      fixSpecialFields(document);

      const docRef: FIRDocumentReference = FIRFirestore.firestore()
          .collectionWithPath(collectionPath)
          .documentWithPath(documentPath);

      docRef.updateDataCompletion(document, (error: NSError) => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve();
        }
      });
    } catch (ex) {
      console.log("Error in firebase.firestore.update: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore.delete = (collectionPath: string, documentPath: string): Promise<void> => {
  ensureFirestore();
  return new Promise<void>((resolve, reject) => {
    try {
      const docRef: FIRDocumentReference = FIRFirestore.firestore()
          .collectionWithPath(collectionPath)
          .documentWithPath(documentPath);

      docRef.deleteDocumentWithCompletion((error: NSError) => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve();
        }
      });

    } catch (ex) {
      console.log("Error in firebase.firestore.delete: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore.getCollection = (collectionPath: string, options?: firestore.GetOptions): Promise<firestore.QuerySnapshot> => {
  ensureFirestore();
  return new Promise((resolve, reject) => {
    try {
      let source = FIRFirestoreSource.Default;
      if (options && options.source) {
        if (options.source === "cache") {
          source = FIRFirestoreSource.Cache;
        } else if (options.source === "server") {
          source = FIRFirestoreSource.Server;
        }
      }

      const defaultFirestore = FIRFirestore.firestore();
      defaultFirestore
          .collectionWithPath(collectionPath)
          .getDocumentsWithSourceCompletion(source, (snapshot: FIRQuerySnapshot, error: NSError) => {
            if (error) {
              reject(error.localizedDescription);
            } else {
              resolve(new QuerySnapshot(snapshot));
            }
          });

    } catch (ex) {
      console.log("Error in firebase.firestore.getCollection: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore.get = (collectionPath: string, options?: firestore.GetOptions): Promise<firestore.QuerySnapshot> => {
  return firebase.firestore.getCollection(collectionPath, options);
};

firebase.firestore.getDocument = (collectionPath: string, documentPath: string, options?: firestore.GetOptions): Promise<DocumentSnapshot> => {
  ensureFirestore();
  return new Promise((resolve, reject) => {
    try {
      let source = FIRFirestoreSource.Default;
      if (options && options.source) {
        if (options.source === "cache") {
          source = FIRFirestoreSource.Cache;
        } else if (options.source === "server") {
          source = FIRFirestoreSource.Server;
        }
      }

      FIRFirestore.firestore()
          .collectionWithPath(collectionPath)
          .documentWithPath(documentPath)
          .getDocumentWithSourceCompletion(source, (snapshot: FIRDocumentSnapshot, error: NSError) => {
            if (error) {
              reject(error.localizedDescription);
            } else {
              resolve(new DocumentSnapshot(<any>snapshot));
            }
          });

    } catch (ex) {
      console.log("Error in firebase.firestore.getDocument: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore._getQuery = (collectionPath: string, query: FIRQuery): firestore.Query => {
  return {
    get: () => new Promise((resolve, reject) => {
      query.getDocumentsWithCompletion((snapshot: FIRQuerySnapshot, error: NSError) => {
        if (error) {
          reject(error.localizedDescription);
        } else {
          resolve(new QuerySnapshot(snapshot));
        }
      });
    }),
    where: (fp: string, os: firestore.WhereFilterOp, v: any): firestore.Query => firebase.firestore.where(collectionPath, fp, os, v, query),
    orderBy: (fp: string, directionStr: firestore.OrderByDirection): firestore.Query => firebase.firestore.orderBy(collectionPath, fp, directionStr, query),
    limit: (limit: number): firestore.Query => firebase.firestore.limit(collectionPath, limit, query),
    onSnapshot: (optionsOrCallback: firestore.SnapshotListenOptions | ((snapshot: QuerySnapshot) => void), callbackOrOnError?: (snapshotOrError: QuerySnapshot | Error) => void, onError?: (error: Error) => void) => firebase.firestore.onCollectionSnapshot(query, optionsOrCallback, callbackOrOnError, onError),
    startAfter: (snapshotOrFieldValue: DocumentSnapshot | any, ...fieldValues: any[]): firestore.Query => firebase.firestore.startAfter(collectionPath, snapshotOrFieldValue, fieldValues, query),
    startAt: (snapshotOrFieldValue: DocumentSnapshot | any, ...fieldValues: any[]): firestore.Query => firebase.firestore.startAt(collectionPath, snapshotOrFieldValue, fieldValues, query),
    endAt: (snapshotOrFieldValue: DocumentSnapshot | any, ...fieldValues: any[]): firestore.Query => firebase.firestore.endAt(collectionPath, snapshotOrFieldValue, fieldValues, query),
    endBefore: (snapshotOrFieldValue: DocumentSnapshot | any, ...fieldValues: any[]): firestore.Query => firebase.firestore.endBefore(collectionPath, snapshotOrFieldValue, fieldValues, query),
    firestore: firebase.firestore
  };
};

firebase.firestore.where = (collectionPath: string, fieldPath: string | FIRFieldPath, opStr: firestore.WhereFilterOp, value: any, query?: FIRQuery): firestore.Query => {
  ensureFirestore();
  try {
    query = query || FIRFirestore.firestore().collectionWithPath(collectionPath);
    value = fixSpecialField(value);

    let queryFieldPathType = fieldPath instanceof FIRFieldPath ? 'FieldPath' : 'Field'

    if (opStr === "<") {
      query = query[`queryWhere${queryFieldPathType}IsLessThan`](fieldPath, value);
    } else if (opStr === "<=") {
      query = query[`queryWhere${queryFieldPathType}IsLessThanOrEqualTo`](fieldPath, value);
    } else if (opStr === "==") {
      query = query[`queryWhere${queryFieldPathType}IsEqualTo`](fieldPath, value);
    } else if (opStr === ">=") {
      query = query[`queryWhere${queryFieldPathType}IsGreaterThanOrEqualTo`](fieldPath, value);
    } else if (opStr === ">") {
      query = query[`queryWhere${queryFieldPathType}IsGreaterThan`](fieldPath, value);
    } else if (opStr === "array-contains") {
      query = query[`queryWhere${queryFieldPathType}ArrayContains`](fieldPath, value);
    } else if (opStr === "array-contains-any") {
      query = query[`queryWhere${queryFieldPathType}ArrayContainsAny`](fieldPath, value);
    } else if (opStr === "in") {
      query = query[`queryWhere${queryFieldPathType}In`](fieldPath, value);
    } else {
      console.error("Illegal argument for opStr: " + opStr);
      return null;
    }

    return firebase.firestore._getQuery(collectionPath, query);

  } catch (ex) {
    console.log("Error in firebase.firestore.where: " + ex);
    return null;
  }
};

firebase.firestore.orderBy = (collectionPath: string, fieldPath: string, direction: firestore.OrderByDirection, query: FIRQuery): firestore.Query => {
  query = query.queryOrderedByFieldDescending(fieldPath, direction === "desc");
  return firebase.firestore._getQuery(collectionPath, query);
};

firebase.firestore.limit = (collectionPath: string, limit: number, query: FIRQuery): firestore.Query => {
  query = query.queryLimitedTo(limit);
  return firebase.firestore._getQuery(collectionPath, query);
};

firebase.firestore.startAfter = (collectionPath: string, snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[], query: FIRQuery): firestore.Query => {
  if (snapshotOrFieldValue && snapshotOrFieldValue.ios) {
    return firebase.firestore._getQuery(collectionPath, query.queryStartingAfterDocument(snapshotOrFieldValue.ios));
  } else {
    return firebase.firestore._getQuery(collectionPath, query.queryStartingAfterValues([snapshotOrFieldValue, ...fieldValues]));
  }
};

firebase.firestore.startAt = (collectionPath: string, snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[], query: FIRQuery): firestore.Query => {
  if (snapshotOrFieldValue && snapshotOrFieldValue.ios) {
    return firebase.firestore._getQuery(collectionPath, query.queryStartingAtDocument(snapshotOrFieldValue.ios));
  } else {
    return firebase.firestore._getQuery(collectionPath, query.queryStartingAtValues([snapshotOrFieldValue, ...fieldValues]));
  }
};

firebase.firestore.endAt = (collectionPath: string, snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[], query: FIRQuery): firestore.Query => {
  if (snapshotOrFieldValue && snapshotOrFieldValue.ios) {
    return firebase.firestore._getQuery(collectionPath, query.queryEndingAtDocument(snapshotOrFieldValue.ios));
  } else {
    return firebase.firestore._getQuery(collectionPath, query.queryEndingAtValues([snapshotOrFieldValue, ...fieldValues]));
  }
};

firebase.firestore.endBefore = (collectionPath: string, snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[], query: FIRQuery): firestore.Query => {
  if (snapshotOrFieldValue && snapshotOrFieldValue.ios) {
    return firebase.firestore._getQuery(collectionPath, query.queryEndingBeforeDocument(snapshotOrFieldValue.ios));
  } else {
    return firebase.firestore._getQuery(collectionPath, query.queryEndingBeforeValues([snapshotOrFieldValue, ...fieldValues]));
  }
};
firebase.firestore.FieldPath = class {
  static documentId() {
    return FIRFieldPath.documentID();
  }
}

@NativeClass()
class GIDSignInDelegateImpl extends NSObject implements GIDSignInDelegate {
  public static ObjCProtocols = [];

  static new(): GIDSignInDelegateImpl {
    if (GIDSignInDelegateImpl.ObjCProtocols.length === 0 && typeof (GIDSignInDelegate) !== "undefined") {
      GIDSignInDelegateImpl.ObjCProtocols.push(GIDSignInDelegate);
    }
    return <GIDSignInDelegateImpl>super.new();
  }

  private callback: (user: GIDGoogleUser, error: NSError) => void;

  public initWithCallback(callback: (user: GIDGoogleUser, error: NSError) => void): GIDSignInDelegateImpl {
    this.callback = callback;
    return this;
  }

  public signInDidSignInForUserWithError(signIn: GIDSignIn, user: GIDGoogleUser, error: NSError): void {
    this.callback(user, error);
  }
}

function convertDocChangeType(type: FIRDocumentChangeType) {
  switch (type) {
    case FIRDocumentChangeType.Added:
      return 'added';
    case FIRDocumentChangeType.Modified:
      return 'modified';
    case FIRDocumentChangeType.Removed:
      return 'removed';
    default:
      throw new Error('Unknown DocumentChangeType');
  }
}

function convertDocument(qDoc: FIRQueryDocumentSnapshot): firestore.QueryDocumentSnapshot {
  return <any>new DocumentSnapshot(<any>qDoc);
}

export class QuerySnapshot implements firestore.QuerySnapshot {
  private _docSnapshots: firestore.QueryDocumentSnapshot[];

  constructor(private snapshot: FIRQuerySnapshot) {
  }

  metadata = {
    fromCache: this.snapshot.metadata.fromCache,
    hasPendingWrites: this.snapshot.metadata.pendingWrites
  };

  get docs(): firestore.QueryDocumentSnapshot[] {
    const getSnapshots = () => {
      const docSnapshots: firestore.QueryDocumentSnapshot[] = [];
      for (let i = 0, l = this.snapshot.documents.count; i < l; i++) {
        const document = this.snapshot.documents.objectAtIndex(i);
        docSnapshots.push(<any>new DocumentSnapshot(<any>document));
      }
      this._docSnapshots = docSnapshots;

      return docSnapshots;
    };

    // The operation is lazy loaded
    return this._docSnapshots || getSnapshots();
  }

  /**
   * @deprecated use the "docs" property instead
   */
  docSnapshots = this.docs as firestore.DocumentSnapshot[]; // It's safe to cast, as our document snapshot already has the data() method

  docChanges(options?: firestore.SnapshotListenOptions): firestore.DocumentChange[] {
    if (options) {
      console.info('No options support yet, for docChanges()');
    }
    const docChanges: firestore.DocumentChange[] = [];
    const jChanges: NSArray<FIRDocumentChange> = this.snapshot.documentChanges;
    for (let i = 0; i < jChanges.count; i++) {
      const chg = jChanges[i];
      const type = convertDocChangeType(chg.type);
      const doc = convertDocument(chg.document);

      docChanges.push({
        doc,
        newIndex: chg.newIndex,
        oldIndex: chg.oldIndex,
        type,
      });
    }

    return docChanges;
  }

  forEach(callback: (result: firestore.DocumentSnapshot) => void, thisArg?: any): void {
    this.docSnapshots.map(snapshot => callback(snapshot));
  }
}

@NativeClass()
class ASAuthorizationControllerDelegateImpl extends NSObject /* implements ASAuthorizationControllerDelegate */ {
  public static ObjCProtocols = [];
  private owner: any;
  private resolve;
  private reject;

  public static createWithOwnerAndResolveReject(owner: any, resolve, reject): ASAuthorizationControllerDelegateImpl {
    // defer initialisation because this is only available since iOS 13
    if (ASAuthorizationControllerDelegateImpl.ObjCProtocols.length === 0 && parseInt(Device.osVersion) >= 13) {
      ASAuthorizationControllerDelegateImpl.ObjCProtocols.push(ASAuthorizationControllerDelegate);
    }
    const delegate = <ASAuthorizationControllerDelegateImpl>ASAuthorizationControllerDelegateImpl.new();
    delegate.owner = owner;
    delegate.resolve = resolve;
    delegate.reject = reject;
    return delegate;
  }

  public authorizationControllerDidCompleteWithAuthorization(controller, authorization): void {
    if (authorization.credential instanceof ASAuthorizationAppleIDCredential) {
      const appleIDCredential = authorization.credential;
      const rawNonce = firebase._currentNonce;

      if (!rawNonce) {
        throw new Error("Invalid state: A login callback was received, but no login request was sent.");
      }

      if (!appleIDCredential.identityToken) {
        console.log("Invalid state: A login callback was received, but no login request was sent.");
        return;
      }

      const idToken = <string><unknown>NSString.alloc().initWithDataEncoding(appleIDCredential.identityToken, NSUTF8StringEncoding);

      if (!idToken) {
        throw new Error("Unable to serialize id token from data: " + appleIDCredential.identityToken);
      }

      // Initialize a Firebase credential.
      const fIROAuthCredential = FIROAuthProvider.credentialWithProviderIDIDTokenRawNonce(
          "apple.com", idToken, rawNonce);

      // Sign in with Firebase.
      FIRAuth.auth().signInWithCredentialCompletion(
          fIROAuthCredential,
          (authResult: FIRAuthDataResult, error: NSError) => {
            if (error) {
              this.reject(error.localizedDescription);
            } else {
              firebase.notifyAuthStateListeners({
                loggedIn: true,
                user: toLoginResult(authResult.user)
              });
              this.resolve(toLoginResult(authResult && authResult.user, authResult && authResult.additionalUserInfo));
              firebase.appleAuthDelegate = null;
            }
          });
    }
  }

  public authorizationControllerDidCompleteWithError(controller, error): void {
    this.reject(error.localizedDescription);
  }
}

@NativeClass()
class ASAuthorizationControllerPresentationContextProvidingImpl extends NSObject /* implements ASAuthorizationControllerDelegate */ {
  public static ObjCProtocols = [];
  private owner: any;

  public static createWithOwnerAndCallback(owner: any): ASAuthorizationControllerPresentationContextProvidingImpl {
    // defer initialisation because this is only available since iOS 13
    if (ASAuthorizationControllerPresentationContextProvidingImpl.ObjCProtocols.length === 0 && parseInt(Device.osVersion) >= 13) {
      ASAuthorizationControllerPresentationContextProvidingImpl.ObjCProtocols.push(ASAuthorizationControllerPresentationContextProviding);
    }
    const delegate = <ASAuthorizationControllerPresentationContextProvidingImpl>ASAuthorizationControllerPresentationContextProvidingImpl.new();
    delegate.owner = owner;
    return delegate;
  }

  public presentationAnchorForAuthorizationController(controller): void {
    // nothing to do really
  }
}

export * from './firebase-common';
