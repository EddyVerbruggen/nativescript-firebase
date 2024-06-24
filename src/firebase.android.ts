import { Application, AndroidActivityResultEventData, Utils, AndroidApplication } from "@nativescript/core";
import lazy from "@nativescript/core/utils/lazy";
import { DocumentSnapshot as DocumentSnapshotBase, FieldValue, firebase, GeoPoint, isDocumentReference } from "./firebase-common";
import * as firebaseFunctions from "./functions/functions";
import * as firebaseMessaging from "./messaging/messaging";
import { firestore } from "./firebase";

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
declare const com: any;
const gmsAds = (<any>com.google.android.gms).ads;
const gmsTasks = (<any>com.google.android.gms).tasks;

class DocumentSnapshot extends DocumentSnapshotBase {
  android: com.google.firebase.firestore.DocumentSnapshot;

  metadata = {
    fromCache: this.snapshot.getMetadata().isFromCache(),
    hasPendingWrites: this.snapshot.getMetadata().hasPendingWrites()
  };

  constructor(public snapshot: com.google.firebase.firestore.DocumentSnapshot) {
    super(snapshot ? snapshot.getId() : null, snapshot.exists(), firebase.toJsObject(snapshot.getData()), firebase.firestore._getDocumentReference(snapshot.getReference()));
    this.android = snapshot;
  }
}

firebase._launchNotification = null;
firebase._cachedDynamicLink = null;

// we need to cache and restore the context, otherwise the next invocation is broken
firebase._googleSignInIdToken = null;
firebase._facebookAccessToken = null;
firebase._appleSignInIdToken = null;

let fbCallbackManager = null;
let initializeArguments: any;

const GOOGLE_SIGNIN_INTENT_ID = 123;

const authEnabled = lazy(() => typeof (com.google.firebase.auth) !== "undefined" && typeof (com.google.firebase.auth.FirebaseAuth) !== "undefined");
const messagingEnabled = lazy(() => typeof (com.google.firebase.messaging) !== "undefined");
const dynamicLinksEnabled = lazy(() => typeof (com.google.firebase.dynamiclinks) !== "undefined");

(() => {
  // note that this means we need to 'require()' the plugin before the app is loaded
  Application.on(Application.launchEvent, args => {
    if (messagingEnabled()) {
      firebaseMessaging.onAppModuleLaunchEvent(args);
    }
    if (dynamicLinksEnabled()) {
      // let's see if this is part of an email-link authentication flow
      const emailLink = "" + args.android.getData();
      if (authEnabled() && com.google.firebase.auth.FirebaseAuth.getInstance().isSignInWithEmailLink(emailLink)) {
        const rememberedEmail = firebase.getRememberedEmailForEmailLinkLogin();
        if (rememberedEmail !== undefined) {
          const emailLinkOnCompleteListener = new gmsTasks.OnCompleteListener({
            onComplete: task => {
              if (task.isSuccessful()) {
                const authResult = task.getResult();
                firebase.notifyAuthStateListeners({
                  loggedIn: true,
                  user: toLoginResult(authResult.getUser(), authResult.getAdditionalUserInfo())
                });
              }
            }
          });
          const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
          if (user) {
            const authCredential = com.google.firebase.auth.EmailAuthProvider.getCredentialWithLink(rememberedEmail, emailLink);
            user.linkWithCredential(authCredential).addOnCompleteListener(emailLinkOnCompleteListener);
          } else {
            com.google.firebase.auth.FirebaseAuth.getInstance().signInWithEmailLink(rememberedEmail, emailLink).addOnCompleteListener(emailLinkOnCompleteListener);
          }
        }

      } else {
        const getDynamicLinksCallback = new gmsTasks.OnSuccessListener({
          onSuccess: pendingDynamicLinkData => {
            if (pendingDynamicLinkData != null) {

              const deepLink = pendingDynamicLinkData.getLink().toString();
              const minimumAppVersion = pendingDynamicLinkData.getMinimumAppVersion();

              if (firebase._dynamicLinkCallback === null) {
                firebase._cachedDynamicLink = {
                  url: deepLink,
                  minimumAppVersion: minimumAppVersion
                };
              } else {
                setTimeout(function () {
                  firebase._dynamicLinkCallback({
                    url: deepLink,
                    minimumAppVersion: minimumAppVersion
                  });
                });
              }
            }
          }
        });
        const firebaseDynamicLinks = com.google.firebase.dynamiclinks.FirebaseDynamicLinks.getInstance();
        firebaseDynamicLinks.getDynamicLink(args.android).addOnSuccessListener(getDynamicLinksCallback);
      }
    }
  });

  Application.on(Application.resumeEvent, args => {
    if (messagingEnabled()) {
      firebaseMessaging.onAppModuleResumeEvent(args);
    }
  });
})();

firebase.toHashMap = obj => {
  const node = new java.util.HashMap();
  for (const property in obj) {
    if (obj.hasOwnProperty(property)) {
      if (obj[property] === null) {
        node.put(property, null);
      } else {
        // note that the Android Firestore SDK only supports this for 'update' (not for 'set')
        if (obj[property] === "SERVER_TIMESTAMP") {
          node.put(property, com.google.firebase.firestore.FieldValue.serverTimestamp());
        } else if (obj[property] === "DELETE_FIELD") {
          node.put(property, com.google.firebase.firestore.FieldValue.delete());
        } else if (obj[property] instanceof FieldValue) {
          const fieldValue: FieldValue = obj[property];
          if (fieldValue.type === "ARRAY_UNION") {
            // nested arrays are not allowed, so harden against wrong usage: arrayUnion(["foo", "bar"]) vs arrayUnion("foo", "bar")
            let values: Array<any> = Array.isArray(fieldValue.value[0]) ? fieldValue.value[0] : fieldValue.value;
            values = values.map(v => typeof (v) === "object" ? firebase.toHashMap(v) : v);
            node.put(property, com.google.firebase.firestore.FieldValue.arrayUnion(values));
          } else if (fieldValue.type === "ARRAY_REMOVE") {
            let values: Array<any> = Array.isArray(fieldValue.value[0]) ? fieldValue.value[0] : fieldValue.value;
            values = values.map(v => typeof (v) === "object" ? firebase.toHashMap(v) : v);
            node.put(property, com.google.firebase.firestore.FieldValue.arrayRemove(values));
          } else if (fieldValue.type === "INCREMENT") {
            node.put(property, com.google.firebase.firestore.FieldValue.increment(fieldValue.value));
          } else {
            console.log("You found a bug! Please report an issue at https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues, mention fieldValue.type = '" + fieldValue.type + "'. Thanks!");
          }
        } else if (obj[property] instanceof Date) {
          node.put(property, new java.util.Date(obj[property].getTime()));
        } else if (obj[property] instanceof GeoPoint) {
          const geo = <GeoPoint>obj[property];
          node.put(property, new com.google.firebase.firestore.GeoPoint(geo.latitude, geo.longitude));
        } else if (isDocumentReference(obj[property])) {
          node.put(property, obj[property].android);
        } else if (Array.isArray(obj[property])) {
          node.put(property, firebase.toJavaArray(obj[property]));
        } else {
          switch (typeof obj[property]) {
            case 'object':
              node.put(property, firebase.toHashMap(obj[property], node));
              break;
            case 'boolean':
              node.put(property, java.lang.Boolean.valueOf(String(obj[property])));
              break;
            case 'number':
              if (Number(obj[property]) === obj[property] && obj[property] % 1 === 0)
                node.put(property, java.lang.Long.valueOf(String(obj[property])));
              else
                node.put(property, java.lang.Double.valueOf(String(obj[property])));
              break;
            case 'string':
              node.put(property, String(obj[property]));
              break;
          }
        }
      }
    }
  }
  return node;
};

firebase.toJavaArray = val => {
  const javaArray = new java.util.ArrayList();
  for (let i = 0; i < val.length; i++) {
    javaArray.add(firebase.toValue(val[i]));
  }
  return javaArray;
};

firebase.toValue = val => {
  let returnVal = null;
  if (val !== null) {
    if (val instanceof Date) {
      returnVal = new java.util.Date(val.getTime());
    } else if (Array.isArray(val)) {
      returnVal = firebase.toJavaArray(val);
    } else if (val instanceof GeoPoint) {
      returnVal = new com.google.firebase.firestore.GeoPoint(val.latitude, val.longitude);
    } else if (isDocumentReference(val)) {
      returnVal = (<any>val).android;
    } else {
      switch (typeof val) {
        case 'object':
          returnVal = firebase.toHashMap(val);
          break;
        case 'boolean':
          returnVal = java.lang.Boolean.valueOf(String(val));
          break;
        case 'number':
          if (Number(val) === val && val % 1 === 0)
            returnVal = java.lang.Long.valueOf(String(val));
          else
            returnVal = java.lang.Double.valueOf(String(val));
          break;
        case 'string':
          returnVal = String(val);
          break;
      }
    }
  }
  return returnVal;
};

firebase.toJsObject = javaObj => {
  if (javaObj === null || typeof javaObj !== "object") {
    return javaObj;
  }

  let node;
  switch (javaObj.getClass().getName()) {
    case 'java.lang.Boolean':
      const str = String(javaObj);
      return Boolean(!!(str === "True" || str === "true"));
    case 'java.lang.String':
      return String(javaObj);
    case 'java.lang.Integer':
    case 'java.lang.Long':
    case 'java.lang.Double':
      return Number(String(javaObj));
    case 'java.util.Date':
      return new Date(javaObj.getTime());
    case 'com.google.firebase.Timestamp':
      return new Date(javaObj.toDate().getTime());
    case 'com.google.firebase.firestore.GeoPoint':
      return {
        "latitude": javaObj.getLatitude(),
        "longitude": javaObj.getLongitude()
      };
    case 'com.google.firebase.firestore.DocumentReference':
      const path: string = javaObj.getPath();
      const lastSlashIndex = path.lastIndexOf("/");
      return firebase.firestore._getDocumentReference(javaObj, path.substring(0, lastSlashIndex), path.substring(lastSlashIndex + 1));
    case 'java.util.ArrayList':
      node = [];
      for (let i = 0; i < javaObj.size(); i++) {
        node[i] = firebase.toJsObject(javaObj.get(i));
      }
      break;
    case 'android.util.ArrayMap':
    case 'android.support.v4.util.ArrayMap':
    case 'androidx.collection.ArrayMap':
      node = {};
      for (let i = 0; i < javaObj.size(); i++) {
        node[javaObj.keyAt(i)] = firebase.toJsObject(javaObj.valueAt(i));
      }
      break;
    default:
      try {
        node = {};
        const iterator = javaObj.entrySet().iterator();
        while (iterator.hasNext()) {
          const item = iterator.next();
          node[item.getKey()] = firebase.toJsObject(item.getValue());
        }
      } catch (e) {
        if (JSON.stringify(e).includes("Attempt to use cleared object reference")) {
          console.log("Error while transforming Java to Js: " + e);
        } else {
          console.log("PLEASE REPORT THIS AT https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues: Tried to serialize an unsupported type: " + javaObj.getClass().getName() + ", error: " + e);
        }
      }
  }
  return node;
};

firebase.getCallbackData = (type, snapshot) => {
  return {
    type: type,
    key: snapshot.getKey(),
    value: firebase.toJsObject(snapshot.getValue())
  };
};

firebase.authStateListener = null;

firebase.init = arg => {
  return new Promise((resolve, reject) => {
    if (firebase.initialized) {
      reject("Firebase already initialized");
      return;
    }

    firebase.initialized = true;

    const runInit = () => {
      arg = arg || {};
      initializeArguments = arg;

      if (typeof (com.google.firebase.analytics) !== "undefined" && typeof (com.google.firebase.analytics.FirebaseAnalytics) !== "undefined") {
        com.google.firebase.analytics.FirebaseAnalytics.getInstance(
            Application.android.context || Application.getNativeApplication()
        ).setAnalyticsCollectionEnabled(arg.analyticsCollectionEnabled !== false);
      }

      if (typeof (com.google.firebase.database) !== "undefined" && typeof (com.google.firebase.database.ServerValue) !== "undefined") {
        firebase.ServerValue = {
          TIMESTAMP: firebase.toJsObject(com.google.firebase.database.ServerValue.TIMESTAMP)
        };

        const fDatabase = com.google.firebase.database.FirebaseDatabase;
        if (arg.persist) {
          try {
            fDatabase.getInstance().setPersistenceEnabled(true);
          } catch (ignore) {
          }
        }
        firebase.instance = fDatabase.getInstance().getReference();
      }

      // Firestore has offline persistence enabled by default
      if (arg.persist === false && typeof (com.google.firebase.firestore) !== "undefined") {
        try {
          com.google.firebase.firestore.FirebaseFirestore.getInstance().setFirestoreSettings(
              new com.google.firebase.firestore.FirebaseFirestoreSettings.Builder()
                  .setPersistenceEnabled(false)
                  .build());
        } catch (ignore) {
          // this may happen during livesync, and without catching this exception the app would crash
        }
      }

      if (authEnabled()) {
        const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();

        if (arg.onAuthStateChanged) {
          firebase.addAuthStateListener(arg.onAuthStateChanged);
        }

        // Listen to auth state changes
        if (!firebase.authStateListener) {
          firebase.authStateListener = new com.google.firebase.auth.FirebaseAuth.AuthStateListener({
            onAuthStateChanged: fbAuth => {
              const user = fbAuth.getCurrentUser();
              firebase.notifyAuthStateListeners({
                loggedIn: user !== null,
                user: toLoginResult(user)
              });
            }
          });
          firebaseAuth.addAuthStateListener(firebase.authStateListener);
        }
      }

      // Firebase notifications (FCM)
      if (messagingEnabled()) {
        firebaseMessaging.initFirebaseMessaging(arg);
      }

      // Firebase DynamicLink
      if (arg.onDynamicLinkCallback !== undefined) {
        firebase.addOnDynamicLinkReceivedCallback(arg.onDynamicLinkCallback);
      }

      // Firebase storage
      if (arg.storageBucket) {
        if (typeof (com.google.firebase.storage) === "undefined") {
          reject("Uncomment firebase-storage in the plugin's include.gradle first");
          return;
        }
        firebase.storageBucket = com.google.firebase.storage.FirebaseStorage.getInstance().getReferenceFromUrl(arg.storageBucket);
      }

      // Firebase AdMob
      if (typeof (gmsAds) !== "undefined" && typeof (gmsAds.MobileAds) !== "undefined") {
        // init admob
        gmsAds.MobileAds.initialize(Application.android.context);
      }

      resolve(firebase.instance);
    };

    try {
      if (Application.android.startActivity) {
        runInit();
      } else {
        // if this is called before application.start() wait for the event to fire
        Application.on(Application.launchEvent, runInit);
      }
    } catch (ex) {
      console.log("Error in firebase.init: " + ex);
      reject(ex);
    }
  });
};

firebase.fetchSignInMethodsForEmail = email => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof (email) !== "string") {
        reject("A parameter representing an email address is required.");
        return;
      }

      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task /* <SignInMethodQueryResult> */ => {
          if (!task.isSuccessful()) {
            reject((task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
          } else {
            const signInMethods = task.getResult().getSignInMethods();
            resolve(firebase.toJsObject(signInMethods));
          }
        }
      });

      com.google.firebase.auth.FirebaseAuth.getInstance().fetchSignInMethodsForEmail(email).addOnCompleteListener(onCompleteListener);
    } catch (ex) {
      console.log("Error in firebase.fetchSignInMethodsForEmail: " + ex);
      reject(ex);
    }
  });
};

firebase.getCurrentPushToken = firebaseMessaging.getCurrentPushToken;
firebase.addOnMessageReceivedCallback = firebaseMessaging.addOnMessageReceivedCallback;
firebase.addOnPushTokenReceivedCallback = firebaseMessaging.addOnPushTokenReceivedCallback;
firebase.registerForPushNotifications = firebaseMessaging.registerForPushNotifications;
firebase.unregisterForPushNotifications = firebaseMessaging.unregisterForPushNotifications;
firebase.subscribeToTopic = firebaseMessaging.subscribeToTopic;
firebase.unsubscribeFromTopic = firebaseMessaging.unsubscribeFromTopic;
firebase.areNotificationsEnabled = firebaseMessaging.areNotificationsEnabled;

firebase.functions = firebaseFunctions;

firebase.addOnDynamicLinkReceivedCallback = callback => {
  return new Promise((resolve, reject) => {
    try {
      if (typeof (com.google.firebase.dynamiclinks) === "undefined") {
        reject("Uncomment dynamic links in the plugin's include.gradle first");
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

firebase.getRemoteConfigDefaults = properties => {
  let defaults = {};
  for (const p in properties) {
    const prop = properties[p];
    if (prop.default !== undefined) {
      defaults[prop.key] = prop.default;
    }
  }
  return defaults;
};

firebase._isGooglePlayServicesAvailable = () => {
  const ctx = Application.android.foregroundActivity || Application.android.startActivity || Application.getNativeApplication();
  const googleApiAvailability = com.google.android.gms.common.GoogleApiAvailability.getInstance();
  const playServiceStatusSuccess = 0; // com.google.android.gms.common.ConnectionResult.SUCCESS;
  const playServicesStatus = googleApiAvailability.isGooglePlayServicesAvailable(ctx);
  const available = playServicesStatus === playServiceStatusSuccess;
  if (!available && googleApiAvailability.isUserResolvableError(playServicesStatus)) {
    // show a dialog offering the user to update (no need to wait for it to finish)
    googleApiAvailability.showErrorDialogFragment(ctx, playServicesStatus, 1, new android.content.DialogInterface.OnCancelListener({
      onCancel: dialogInterface => {
        console.log("Canceled");
      }
    }));
  }
  return available;
};

firebase.getRemoteConfig = arg => {
  return new Promise((resolve, reject) => {

    if (typeof (com.google.firebase.remoteconfig) === "undefined") {
      reject("Uncomment firebase-config in the plugin's include.gradle first");
      return;
    }

    if (arg.properties === undefined) {
      reject("Argument 'properties' is missing");
      return;
    }

    const runGetRemoteConfig = () => {
      if (!firebase._isGooglePlayServicesAvailable()) {
        reject("Google Play services is required for this feature, but not available on this device");
        return;
      }

      // Get a Remote Config object instance
      const firebaseRemoteConfig = com.google.firebase.remoteconfig.FirebaseRemoteConfig.getInstance();

      // Enable developer mode to allow for frequent refreshes of the cache (this changed, see https://firebase.google.com/support/release-notes/android#version_1700)
      const remoteConfigSettingsBuilder = new com.google.firebase.remoteconfig.FirebaseRemoteConfigSettings.Builder();
      if (arg.developerMode === true) {
        remoteConfigSettingsBuilder.setFetchTimeoutInSeconds(0);
      }

      const onSetConfigSettingsCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (!task.isSuccessful()) {
            reject((task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
          } else {
            const defaults = firebase.getRemoteConfigDefaults(arg.properties);
            firebaseRemoteConfig.setDefaultsAsync(firebase.toHashMap(defaults))
                .addOnCompleteListener(new gmsTasks.OnCompleteListener({
                  onComplete: task => {
                    if (!task.isSuccessful()) {
                      reject((task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
                    } else {
                      const returnMethod = throttled => {
                        const addOnCompleteActivateListener = new gmsTasks.OnCompleteListener({
                          onComplete: task => {
                            if (!task.isSuccessful()) {
                              reject((task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
                            } else {
                              const lastFetchTime = firebaseRemoteConfig.getInfo().getFetchTimeMillis();
                              const lastFetch = new Date(lastFetchTime);

                              const result = {
                                lastFetch,
                                throttled,
                                properties: {}
                              };

                              for (const p in arg.properties) {
                                const prop = arg.properties[p];
                                const key = prop.key;
                                const value = firebaseRemoteConfig.getString(key);
                                // we could have the user pass in the type but this seems easier to use
                                result.properties[key] = firebase.strongTypeify(value);
                              }
                              resolve(result);
                            }
                          }
                        });
                        firebaseRemoteConfig.activate().addOnCompleteListener(addOnCompleteActivateListener);
                      };

                      const onSuccessListener = new gmsTasks.OnSuccessListener({
                        onSuccess: () => returnMethod(false)
                      });

                      const onFailureListener = new gmsTasks.OnFailureListener({
                        onFailure: exception => {
                          if (exception.getMessage() === "com.google.firebase.remoteconfig.FirebaseRemoteConfigFetchThrottledException") {
                            returnMethod(true);
                          } else {
                            reject("Retrieving remote config data failed. " + exception);
                          }
                        }
                      });

                      // default 12 hours, just like the SDK does
                      const expirationDuration = arg.cacheExpirationSeconds || 43200;

                      firebaseRemoteConfig.fetch(expirationDuration)
                          .addOnSuccessListener(onSuccessListener)
                          .addOnFailureListener(onFailureListener);
                    }
                  }
                }));
          }
        }
      });

      firebaseRemoteConfig.setConfigSettingsAsync(remoteConfigSettingsBuilder.build())
          .addOnCompleteListener(onSetConfigSettingsCompleteListener);

    };

    try {
      if (Application.android.foregroundActivity) {
        runGetRemoteConfig();
      } else {
        // if this is called before application.start(), wait for the event to fire
        const callback = () => {
          runGetRemoteConfig();
          Application.off(Application.resumeEvent, callback);
        };
        Application.on(Application.resumeEvent, callback);
      }
    } catch (ex) {
      console.log("Error in firebase.getRemoteConfig: " + ex);
      reject(ex);
    }
  });
};

firebase.getCurrentUser = arg => {
  return new Promise((resolve, reject) => {
    try {
      const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();
      const user = firebaseAuth.getCurrentUser();
      if (user !== null) {
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
      const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();
      const user = firebaseAuth.getCurrentUser();
      if (user !== null) {
        const addOnCompleteListener = new gmsTasks.OnCompleteListener({
          onComplete: task => {
            if (!task.isSuccessful()) {
              reject((task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
            } else {
              resolve();
            }
          }
        });

        if (actionCodeSettings) {
          const settingsBuilder = new com.google.firebase.auth.ActionCodeSettings.newBuilder();
          if (actionCodeSettings.handleCodeInApp !== undefined) {
            settingsBuilder.setHandleCodeInApp(actionCodeSettings.handleCodeInApp);
          }
          if (actionCodeSettings.url) {
            settingsBuilder.setUrl(actionCodeSettings.url);
          }
          if (actionCodeSettings.iOS && actionCodeSettings.iOS.bundleId) {
            settingsBuilder.setIOSBundleId(actionCodeSettings.iOS.bundleId);
          }
          if (actionCodeSettings.android && actionCodeSettings.android.packageName) {
            settingsBuilder.setAndroidPackageName(actionCodeSettings.android.packageName, actionCodeSettings.android.installApp, actionCodeSettings.android.minimumVersion || null);
          }
          user.sendEmailVerification(settingsBuilder.build()).addOnCompleteListener(addOnCompleteListener);
        } else {
          user.sendEmailVerification().addOnCompleteListener(addOnCompleteListener);
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
      com.google.firebase.auth.FirebaseAuth.getInstance().signOut();

      // reset additional user info
      firebase.currentAdditionalUserInfo = null;

      // also disconnect from Google otherwise ppl can't connect with a different account
      if (firebase._mGoogleApiClient && firebase._mGoogleApiClient.isConnected()) {
        com.google.android.gms.auth.api.Auth.GoogleSignInApi.revokeAccess(firebase._mGoogleApiClient);
      }

      if (typeof (com.facebook) !== "undefined" && typeof (com.facebook.login) !== "undefined") {
        com.facebook.login.LoginManager.getInstance().logOut();
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
      const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
      if (!user) {
        reject("Not logged in");
        return;
      }

      user.unlink(providerId)
          .addOnCompleteListener(new gmsTasks.OnCompleteListener({
                onComplete: task => {
                  if (task.isSuccessful()) {
                    resolve();
                  } else {
                    reject((task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
                  }
                }
              })
          );
    } catch (ex) {
      console.log("Error in firebase.unlink: " + ex);
      reject(ex);
    }
  });
};

firebase.getAuthToken = (arg: GetAuthTokenOptions): Promise<IdTokenResult> => {
  return new Promise((resolve, reject) => {
    try {
      const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();
      const user = firebaseAuth.getCurrentUser();
      if (user !== null) {
        const onSuccessListener = new gmsTasks.OnSuccessListener({
          onSuccess: tokenResult => {
            resolve({
              token: tokenResult.getToken(),
              claims: firebase.toJsObject(tokenResult.getClaims()),
              signInProvider: tokenResult.getSignInProvider(),
              expirationTime: tokenResult.getExpirationTimestamp(),
              issuedAtTime: tokenResult.getIssuedAtTimestamp(),
              authTime: tokenResult.getAuthTimestamp()
            });
          }
        });

        const onFailureListener = new gmsTasks.OnFailureListener({
          onFailure: exception => {
            reject(exception);
          }
        });

        user.getIdToken(arg.forceRefresh)
            .addOnSuccessListener(onSuccessListener)
            .addOnFailureListener(onFailureListener);

      } else {
        reject("Log in first");
      }
    } catch (ex) {
      console.log("Error in firebase.getAuthToken: " + ex);
      reject(ex);
    }
  });
};

function toLoginResult(user, additionalUserInfo?): User {
  if (user === null) {
    return null;
  }

  if (additionalUserInfo) {
    firebase.currentAdditionalUserInfo = additionalUserInfo;
  }

  // for convenience return the result in multiple formats
  const providers = [];
  const providerData = user.getProviderData();
  for (let i = 0; i < providerData.size(); i++) {
    const pid = providerData.get(i).getProviderId();
    if (pid === 'facebook.com') {
      providers.push({id: pid, token: firebase._facebookAccessToken});
    } else if (pid === 'google.com') {
      providers.push({id: pid, token: firebase._googleSignInIdToken});
    } else if (pid === 'apple.com') {
      providers.push({id: pid, token: firebase._appleSignInIdToken});
    } else {
      providers.push({id: pid});
    }
  }

  const loginResult: User = {
    uid: user.getUid(),
    displayName: user.getDisplayName(),
    email: user.getEmail(),
    emailVerified: user.isEmailVerified(),
    // provider: user.getProviderId(), // always 'firebase'
    providers: providers,
    anonymous: user.isAnonymous(),
    isAnonymous: user.isAnonymous(),
    phoneNumber: user.getPhoneNumber(),
    photoURL: user.getPhotoUrl() ? user.getPhotoUrl().toString() : null,
    metadata: {
      creationTimestamp: user.getMetadata() ? new Date(user.getMetadata().getCreationTimestamp() as number) : null,
      lastSignInTimestamp: user.getMetadata() ? new Date(user.getMetadata().getLastSignInTimestamp() as number) : null
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
      providerId: firebase.currentAdditionalUserInfo.getProviderId(),
      username: firebase.currentAdditionalUserInfo.getUsername(),
      isNewUser: firebase.currentAdditionalUserInfo.isNewUser(),
      profile: firebase.toJsObject(firebase.currentAdditionalUserInfo.getProfile())
    };
  }

  return loginResult;
}

firebase.login = arg => {
  return new Promise((resolve, reject) => {
    try {
      // need these to support using phone auth more than once
      firebase.resolve = resolve;
      firebase.reject = reject;

      if (!firebase._isGooglePlayServicesAvailable()) {
        reject("Google Play services is required for this feature, but not available on this device");
        return;
      }

      firebase.moveLoginOptionsToObjects(arg);

      const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();
      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (!task.isSuccessful()) {
            console.log("Logging in the user failed. " + (task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
            // also disconnect from Google otherwise ppl can't connect with a different account
            if (firebase._mGoogleApiClient) {
              com.google.android.gms.auth.api.Auth.GoogleSignInApi.revokeAccess(firebase._mGoogleApiClient);
            }
            if (firebase.reject) {
              firebase.reject("Logging in the user failed. " + (task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
            }
          } else {
            const user = task.getResult().getUser();
            let additionalUserInfo = task.getResult().getAdditionalUserInfo();
            if (firebase.resolve) {
              firebase.resolve(toLoginResult(user, additionalUserInfo));
            }
          }
        }
      });

      if (arg.type === firebase.LoginType.ANONYMOUS) {
        firebaseAuth.signInAnonymously().addOnCompleteListener(onCompleteListener);

      } else if (arg.type === firebase.LoginType.PASSWORD) {
        if (!arg.passwordOptions || !arg.passwordOptions.email || !arg.passwordOptions.password) {
          reject("Auth type PASSWORD requires an 'passwordOptions.email' and 'passwordOptions.password' argument");
          return;
        }

        const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
        if (user) {
          if (firebase._alreadyLinkedToAuthProvider(user, "password")) {
            firebaseAuth.signInWithEmailAndPassword(arg.passwordOptions.email, arg.passwordOptions.password).addOnCompleteListener(onCompleteListener);
          } else {
            const authCredential = com.google.firebase.auth.EmailAuthProvider.getCredential(arg.passwordOptions.email, arg.passwordOptions.password);
            user.linkWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
          }
        } else {
          firebaseAuth.signInWithEmailAndPassword(arg.passwordOptions.email, arg.passwordOptions.password).addOnCompleteListener(onCompleteListener);
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

        const actionCodeSettings = com.google.firebase.auth.ActionCodeSettings.newBuilder()
            // URL you want to redirect back to. The domain must be whitelisted in the Firebase Console.
            .setUrl(arg.emailLinkOptions.url)
            .setHandleCodeInApp(true)
            .setIOSBundleId(arg.emailLinkOptions.iOS ? arg.emailLinkOptions.iOS.bundleId : Application.android.context.getPackageName())
            .setAndroidPackageName(
                arg.emailLinkOptions.android ? arg.emailLinkOptions.android.packageName : Application.android.context.getPackageName(),
                arg.emailLinkOptions.android ? arg.emailLinkOptions.android.installApp || false : false,
                arg.emailLinkOptions.android ? arg.emailLinkOptions.android.minimumVersion || "1" : "1")
            .build();

        const onEmailLinkCompleteListener = new gmsTasks.OnCompleteListener({
          onComplete: task => {
            if (!task.isSuccessful()) {
              reject((task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
            } else {
              // The link was successfully sent.
              // Save the email locally so you don't need to ask the user for it again if they open the link on the same device.
              firebase.rememberEmailForEmailLinkLogin(arg.emailLinkOptions.email);
              resolve();
            }
          }
        });

        firebaseAuth.sendSignInLinkToEmail(arg.emailLinkOptions.email, actionCodeSettings).addOnCompleteListener(onEmailLinkCompleteListener);

      } else if (arg.type === firebase.LoginType.PHONE) {
        // https://firebase.google.com/docs/auth/android/phone-auth
        if (!arg.phoneOptions || !arg.phoneOptions.phoneNumber) {
          reject("Auth type PHONE requires a 'phoneOptions.phoneNumber' argument");
          return;
        }

        const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();

        if (user && firebase._alreadyLinkedToAuthProvider(user, "phone")) {
          // skip sending an SMS if user is already linked to the phone-provider
          resolve(toLoginResult(user));
          return;
        }

        const OnVerificationStateChangedCallbacks = com.google.firebase.auth.PhoneAuthProvider.OnVerificationStateChangedCallbacks.extend({
          onVerificationCompleted: phoneAuthCredential => {
            firebase._verifyPhoneNumberInProgress = false;
            const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();

            if (!user || firebase._alreadyLinkedToAuthProvider(user, "phone")) {
              // the user previously authenticated with phone (or no prompt was required), so sign in and complete
              firebaseAuth.signInWithCredential(phoneAuthCredential).addOnCompleteListener(onCompleteListener);
            } else {
              user.linkWithCredential(phoneAuthCredential).addOnCompleteListener(onCompleteListener);
            }
          },
          onVerificationFailed: firebaseException => {
            firebase._verifyPhoneNumberInProgress = false;
            const errorMessage = firebaseException.getMessage();
            if (errorMessage.includes("INVALID_APP_CREDENTIAL")) {
              if (firebase.reject) {
                firebase.reject("Please upload the SHA1 fingerprint of your debug and release keystores to the Firebase console, see https://github.com/EddyVerbruggen/nativescript-plugin-firebase/blob/master/docs/AUTHENTICATION.md#phone-verification");
              }
            } else {
              if (firebase.reject) {
                firebase.reject(errorMessage);
              }
            }
          },
          onCodeSent: (verificationId, forceResendingToken) => {
            // If the device has a SIM card auto-verification may occur in the background (eventually calling onVerificationCompleted)
            // .. so the prompt would be redundant, but it's recommended by Google not to wait to long before showing the prompt
            setTimeout(() => {
              if (firebase._verifyPhoneNumberInProgress) {
                firebase._verifyPhoneNumberInProgress = false;
                firebase.requestPhoneAuthVerificationCode(userResponse => {
                  if (userResponse === undefined && firebase.reject) {
                    firebase.reject("Prompt was canceled");
                    return;
                  }
                  const authCredential = com.google.firebase.auth.PhoneAuthProvider.getCredential(verificationId, userResponse);
                  const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();

                  if (!user || firebase._alreadyLinkedToAuthProvider(user, "phone")) {
                    firebaseAuth.signInWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
                  } else {
                    user.linkWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
                  }
                }, arg.phoneOptions.verificationPrompt);
              }
            }, 3000);
          }
        });

        firebase._verifyPhoneNumberInProgress = true;

        let timeout = arg.phoneOptions.android ? arg.phoneOptions.android.timeout : 60;
        com.google.firebase.auth.PhoneAuthProvider.getInstance().verifyPhoneNumber(
            arg.phoneOptions.phoneNumber,
            timeout, // timeout (in seconds, because of the next argument)
            java.util.concurrent.TimeUnit.SECONDS,
            Application.android.foregroundActivity,
            new OnVerificationStateChangedCallbacks());

      } else if (arg.type === firebase.LoginType.CUSTOM) {
        if (!arg.customOptions || (!arg.customOptions.token && !arg.customOptions.tokenProviderFn)) {
          reject("Auth type CUSTOM requires a 'customOptions.token' or 'customOptions.tokenProviderFn' argument");
          return;
        }

        if (arg.customOptions.token) {
          firebaseAuth.signInWithCustomToken(arg.customOptions.token).addOnCompleteListener(onCompleteListener);
        } else if (arg.customOptions.tokenProviderFn) {
          arg.customOptions.tokenProviderFn()
              .then(
                  token => {
                    firebaseAuth.signInWithCustomToken(token).addOnCompleteListener(onCompleteListener);
                  },
                  error => {
                    reject(error);
                  }
              );
        }

      } else if (arg.type === firebase.LoginType.FACEBOOK) {
        if (typeof (com.facebook) === "undefined" || typeof (com.facebook.FacebookSdk) === "undefined") {
          reject("Facebook SDK not installed - see gradle config");
          return;
        }

        // Lazy loading the Facebook callback manager
        if (!fbCallbackManager) {
          com.facebook.FacebookSdk.sdkInitialize(Application.getNativeApplication());
          fbCallbackManager = com.facebook.CallbackManager.Factory.create();
        }

        const callback = (eventData: AndroidActivityResultEventData) => {
          Application.android.off(AndroidApplication.activityResultEvent, callback);
          fbCallbackManager.onActivityResult(eventData.requestCode, eventData.resultCode, eventData.intent);
        };
        Application.android.on(AndroidApplication.activityResultEvent, callback);

        const fbLoginManager = com.facebook.login.LoginManager.getInstance();
        fbLoginManager.registerCallback(
            fbCallbackManager,
            new com.facebook.FacebookCallback({
              onSuccess: loginResult => {
                firebase._facebookAccessToken = loginResult.getAccessToken().getToken();
                const authCredential = com.google.firebase.auth.FacebookAuthProvider.getCredential(firebase._facebookAccessToken);

                const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
                if (user) {
                  if (firebase._alreadyLinkedToAuthProvider(user, "facebook.com")) {
                    firebaseAuth.signInWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
                  } else {
                    user.linkWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
                  }
                } else {
                  firebaseAuth.signInWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
                }
              },
              onCancel: () => reject("Facebook Login canceled"),
              onError: ex => reject("Error while trying to login with Fb " + ex)
            })
        );

        let scopes = ["public_profile", "email"];
        if (arg.facebookOptions && arg.facebookOptions.scopes) {
          scopes = arg.facebookOptions.scopes;
        }
        const permissions = Utils.android.collections.stringArrayToStringSet(scopes);

        const activity = Application.android.foregroundActivity;
        fbLoginManager.logInWithReadPermissions(activity, permissions);

      } else if (arg.type === firebase.LoginType.APPLE) {
        const onSuccessListener = new gmsTasks.OnSuccessListener({
          onSuccess: (authResult: com.google.firebase.auth.AuthResult) => {
            firebase._appleSignInIdToken = (<any>authResult.getCredential()).getIdToken();
            const loginResult = toLoginResult(authResult.getUser(), authResult.getAdditionalUserInfo());
            firebase.notifyAuthStateListeners({
              loggedIn: true,
              user: loginResult
            });
            resolve(loginResult);
            // TODO for reauth and linking, see https://firebase.google.com/docs/auth/android/apple#reauthentication_and_account_linking
          }
        });

        const onFailureListener = new gmsTasks.OnFailureListener({
          onFailure: exception => {
            reject(exception.getMessage());
          }
        });

        const pendingAuthResult = firebaseAuth.getPendingAuthResult();
        if (pendingAuthResult) {
          pendingAuthResult
              .addOnSuccessListener(onSuccessListener)
              .addOnFailureListener(onFailureListener);

        } else {
          // no pending result; start the sign in flow
          const oAuthProviderBuilder = com.google.firebase.auth.OAuthProvider.newBuilder("apple.com");

          let scopes = ["name", "email"];
          if (arg.appleOptions && arg.appleOptions.scopes) {
            scopes = arg.appleOptions.scopes;
          }
          oAuthProviderBuilder.setScopes(firebase.toJavaArray(scopes));

          if (arg.appleOptions && arg.appleOptions.locale) {
            oAuthProviderBuilder.addCustomParameter("locale", arg.appleOptions.locale);
          }

          const provider = oAuthProviderBuilder.build();

          firebaseAuth.startActivityForSignInWithProvider(Application.android.foregroundActivity || Application.android.startActivity, provider)
              .addOnSuccessListener(onSuccessListener)
              .addOnFailureListener(onFailureListener);
        }

      } else if (arg.type === firebase.LoginType.GOOGLE) {
        if (typeof (com.google.android.gms.auth.api.Auth) === "undefined") {
          reject("Google Sign In not installed - see gradle config");
          return;
        }

        const clientStringId = Utils.android.resources.getStringId("default_web_client_id");
        const clientId = Utils.android.getApplicationContext().getResources().getString(clientStringId);

        // Configure Google Sign In
        const googleSignInOptionsBuilder = new com.google.android.gms.auth.api.signin.GoogleSignInOptions.Builder(com.google.android.gms.auth.api.signin.GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(clientId)
            .requestEmail();

        if (arg.googleOptions && arg.googleOptions.hostedDomain) {
          googleSignInOptionsBuilder.setHostedDomain(arg.googleOptions.hostedDomain);
        }

        if (arg.googleOptions && arg.googleOptions.scopes) {
          const scopesArray = [];
          if (arg.googleOptions.scopes.length > 1) {
            arg.googleOptions.scopes.forEach(s => scopesArray.push(new com.google.android.gms.common.api.Scope(s)));
          }
          googleSignInOptionsBuilder.requestScopes(new com.google.android.gms.common.api.Scope(arg.googleOptions.scopes[0]), scopesArray);
        }

        const googleSignInOptions = googleSignInOptionsBuilder.build();

        const onConnectionFailedListener = new com.google.android.gms.common.api.GoogleApiClient.OnConnectionFailedListener({
          onConnectionFailed: connectionResult => {
            reject(connectionResult.getErrorMessage());
          }
        });

        firebase._mGoogleApiClient = new com.google.android.gms.common.api.GoogleApiClient.Builder(Application.getNativeApplication())
            .addOnConnectionFailedListener(onConnectionFailedListener)
            .addApi(com.google.android.gms.auth.api.Auth.GOOGLE_SIGN_IN_API, googleSignInOptions)
            .build();

        const signInIntent = com.google.android.gms.auth.api.Auth.GoogleSignInApi.getSignInIntent(firebase._mGoogleApiClient);
        (Application.android.foregroundActivity || Application.android.startActivity).startActivityForResult(signInIntent, GOOGLE_SIGNIN_INTENT_ID);

        const callback = (eventData: AndroidActivityResultEventData) => {
          if (eventData.requestCode === GOOGLE_SIGNIN_INTENT_ID) {
            Application.android.off(AndroidApplication.activityResultEvent, callback);
            const googleSignInResult = com.google.android.gms.auth.api.Auth.GoogleSignInApi.getSignInResultFromIntent(eventData.intent);
            if (googleSignInResult === null) {
              reject("No googleSignInResult, eventData.intent seems to be invalid");
              return;
            }

            const success = googleSignInResult.isSuccess();
            if (success) {
              const googleSignInAccount = googleSignInResult.getSignInAccount();
              firebase._googleSignInIdToken = googleSignInAccount.getIdToken();
              const accessToken = null;
              const authCredential = com.google.firebase.auth.GoogleAuthProvider.getCredential(firebase._googleSignInIdToken, accessToken);

              firebase._mGoogleApiClient.connect();

              const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
              if (user) {
                if (firebase._alreadyLinkedToAuthProvider(user, "google.com")) {
                  firebaseAuth.signInWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
                } else {
                  user.linkWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
                }
              } else {
                firebaseAuth.signInWithCredential(authCredential).addOnCompleteListener(onCompleteListener);
              }
            } else {
              console.log("Make sure you've uploaded your SHA1 fingerprint(s) to the Firebase console. Status: " + googleSignInResult.getStatus());
              reject("Has the SHA1 fingerprint been uploaded? Sign-in status: " + googleSignInResult.getStatus());
            }
          }
        };
        Application.android.on(AndroidApplication.activityResultEvent, callback);

      } else {
        reject("Unsupported auth type: " + arg.type);
      }
    } catch (ex) {
      console.log("Error in firebase.login: " + ex);
      reject(ex);
    }
  });
};

firebase._alreadyLinkedToAuthProvider = (user, providerId) => {
  const providerData = user.getProviderData();
  for (let i = 0; i < providerData.size(); i++) {
    const profile = providerData.get(i);
    if (profile.getProviderId() === providerId) {
      return true;
    }
  }
  return false;
};

firebase.reauthenticate = arg => {
  return new Promise((resolve, reject) => {
    try {
      const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
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
        authCredential = com.google.firebase.auth.EmailAuthProvider.getCredential(arg.passwordOptions.email, arg.passwordOptions.password);

      } else if (arg.type === firebase.LoginType.GOOGLE) {
        if (!firebase._googleSignInIdToken) {
          reject("Not currently logged in with Google");
          return;
        }
        authCredential = com.google.firebase.auth.GoogleAuthProvider.getCredential(firebase._googleSignInIdToken, null);

      } else if (arg.type === firebase.LoginType.FACEBOOK) {
        if (!firebase._facebookAccessToken) {
          reject("Not currently logged in with Facebook");
          return;
        }
        authCredential = com.google.firebase.auth.FacebookAuthProvider.getCredential(firebase._facebookAccessToken);
      }

      if (authCredential === null) {
        reject("arg.type should be one of LoginType.PASSWORD | LoginType.GOOGLE | LoginType.FACEBOOK");
        return;
      }

      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (task.isSuccessful()) {
            const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
            const loginResult = toLoginResult(user);

            firebase.notifyAuthStateListeners({
              loggedIn: true,
              user: loginResult
            });
            resolve(loginResult);
          } else {
            reject((task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
          }
        }
      });
      user.reauthenticate(authCredential).addOnCompleteListener(onCompleteListener);

    } catch (ex) {
      console.log("Error in firebase.reauthenticate: " + ex);
      reject(ex);
    }
  });
};

firebase.reloadUser = () => {
  return new Promise((resolve, reject) => {
    try {
      const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();
      if (user === null) {
        reject("no current user");
        return;
      }

      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (task.isSuccessful()) {
            resolve();
          } else {
            reject("Reload failed " + task.getException());
          }
        }
      });

      user.reload().addOnCompleteListener(onCompleteListener);
    } catch (ex) {
      reject(ex);
    }
  });
};

firebase.sendPasswordResetEmail = (email: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (task.isSuccessful()) {
            resolve();
          } else {
            // TODO extract error
            reject("Sending password reset email failed");
          }
        }
      });

      const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();
      firebaseAuth.sendPasswordResetEmail(email).addOnCompleteListener(onCompleteListener);
    } catch (ex) {
      console.log("Error in firebase.sendPasswordResetEmail: " + ex);
      reject(ex);
    }
  });
};

firebase.updateEmail = (newEmail: string): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    try {
      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (task.isSuccessful()) {
            resolve();
          } else {
            reject("Updating email failed. " + (task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
          }
        }
      });

      const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();

      if (user === null) {
        reject("no current user");
      } else {
        user.updateEmail(newEmail).addOnCompleteListener(onCompleteListener);
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
      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (task.isSuccessful()) {
            resolve();
          } else {
            reject("Updating password failed. " + (task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
          }
        }
      });

      const user = com.google.firebase.auth.FirebaseAuth.getInstance().getCurrentUser();

      if (user === null) {
        reject("no current user");
      } else {
        user.updatePassword(newPassword).addOnCompleteListener(onCompleteListener);
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
      if (!arg.email || !arg.password) {
        reject("Creating a user requires an email and password argument");
      } else {
        const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();

        const onCompleteListener = new gmsTasks.OnCompleteListener({
          onComplete: task => {
            // see https://firebase.google.com/docs/reference/android/com/google/firebase/auth/FirebaseAuth#public-methods
            if (!task.isSuccessful()) {
              reject("Creating a user failed. " + (task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
            } else {
              const user = task.getResult().getUser();
              const additionalUserInfo = task.getResult().getAdditionalUserInfo();
              resolve(toLoginResult(user, additionalUserInfo));
            }
          }
        });
        firebaseAuth.createUserWithEmailAndPassword(arg.email, arg.password).addOnCompleteListener(onCompleteListener);
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
      const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();
      const user = firebaseAuth.getCurrentUser();

      if (user === null) {
        reject("no current user");
        return;
      }

      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (!task.isSuccessful()) {
            reject("Deleting a user failed. " + (task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
          } else {
            resolve();
          }
        }
      });

      user.delete().addOnCompleteListener(onCompleteListener);
    } catch (ex) {
      console.log("Error in firebase.deleteUser: " + ex);
      reject(ex);
    }
  });
};

firebase.updateProfile = arg => {
  return new Promise((resolve, reject) => {
    try {
      if (!arg.displayName && !arg.photoURL) {
        reject("Updating a profile requires a displayName and / or a photoURL argument");
      } else {
        const firebaseAuth = com.google.firebase.auth.FirebaseAuth.getInstance();
        const user = firebaseAuth.getCurrentUser();

        if (user === null) {
          reject("No current user");
          return;
        }

        const onCompleteListener = new gmsTasks.OnCompleteListener({
          onComplete: task => {
            if (task.isSuccessful()) {
              resolve();
            } else {
              reject("Updating a profile failed. " + (task.getException() && task.getException().getReason ? task.getException().getReason() : task.getException()));
            }
          }
        });

        const profileUpdateBuilder = new com.google.firebase.auth.UserProfileChangeRequest.Builder();

        if (arg.displayName)
          profileUpdateBuilder.setDisplayName(arg.displayName);

        if (arg.photoURL)
          profileUpdateBuilder.setPhotoUri(android.net.Uri.parse(arg.photoURL));

        const profileUpdate = profileUpdateBuilder.build();
        user.updateProfile(profileUpdate).addOnCompleteListener(onCompleteListener);
      }
    } catch (ex) {
      console.log("Error in firebase.updateProfile: " + ex);
      reject(ex);
    }
  });
};

/***********************************************
 * Start Realtime Database Functions
 ***********************************************/

firebase.keepInSync = (path, switchOn) => {
  return new Promise((resolve, reject) => {
    try {
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      const where = firebase.instance.child(path);
      where.keepSynced(switchOn);
      resolve();
    } catch (ex) {
      console.log("Error in firebase.keepInSync: " + ex);
      reject(ex);
    }
  });
};

firebase._addObservers = (to, updateCallback) => {
  const listener = new com.google.firebase.database.ChildEventListener({
    onCancelled: databaseError => {
      updateCallback({
        error: databaseError.getMessage()
      });
    },
    onChildAdded: (snapshot, previousChildKey) => {
      updateCallback(firebase.getCallbackData('ChildAdded', snapshot));
    },
    onChildRemoved: snapshot => {
      updateCallback(firebase.getCallbackData('ChildRemoved', snapshot));
    },
    onChildChanged: (snapshot, previousChildKey) => {
      updateCallback(firebase.getCallbackData('ChildChanged', snapshot));
    },
    onChildMoved: (snapshot, previousChildKey) => {
      updateCallback(firebase.getCallbackData('ChildMoved', snapshot));
    }
  });
  to.addChildEventListener(listener);
  return listener;
};

firebase.addChildEventListener = (updateCallback, path) => {
  return new Promise((resolve, reject) => {
    try {
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      resolve({
        path: path,
        listeners: [firebase._addObservers(firebase.instance.child(path), updateCallback)]
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
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      const listener = new com.google.firebase.database.ValueEventListener({
        onDataChange: snapshot => {
          updateCallback(firebase.getCallbackData('ValueChanged', snapshot));
        },
        onCancelled: databaseError => {
          updateCallback({
            error: databaseError.getMessage()
          });
        }
      });
      firebase.instance.child(path).addValueEventListener(listener);
      resolve({
        path: path,
        listeners: [listener]
      });
    } catch (ex) {
      console.log("Error in firebase.addValueEventListener: " + ex);
      reject(ex);
    }
  });
};

firebase.getValue = path => {
  return new Promise((resolve, reject) => {
    try {
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      const listener = new com.google.firebase.database.ValueEventListener({
        onDataChange: snapshot => {
          resolve(firebase.getCallbackData('ValueChanged', snapshot));
        },
        onCancelled: databaseError => {
          reject(databaseError.getMessage());
        }
      });
      firebase.instance.child(path).addListenerForSingleValueEvent(listener);
    } catch (ex) {
      console.log("Error in firebase.getValue: " + ex);
      reject(ex);
    }
  });
};

firebase.removeEventListeners = (listeners, path) => {
  return new Promise((resolve, reject) => {
    try {
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      const ref = firebase.instance.child(path);
      for (let i = 0; i < listeners.length; i++) {
        const listener = listeners[i];
        ref.removeEventListener(listener);
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
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      const pushInstance = firebase.instance.child(path).push();

      pushInstance.setValue(firebase.toValue(val))
          .addOnSuccessListener(new gmsTasks.OnSuccessListener({
            onSuccess: () => resolve({key: pushInstance.getKey()})
          }))
          .addOnFailureListener(new gmsTasks.OnFailureListener({
            onFailure: exception => reject(exception.getMessage())
          }));

    } catch (ex) {
      console.log("Error in firebase.push: " + ex);
      reject(ex);
    }
  });
};

firebase.setValue = (path, val) => {
  return new Promise((resolve, reject) => {
    try {
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      firebase.instance.child(path).setValue(firebase.toValue(val))
          .addOnSuccessListener(new gmsTasks.OnSuccessListener({
            onSuccess: () => resolve()
          }))
          .addOnFailureListener(new gmsTasks.OnFailureListener({
            onFailure: exception => reject(exception.getMessage())
          }));

    } catch (ex) {
      console.log("Error in firebase.setValue: " + ex);
      reject(ex);
    }
  });
};

firebase.update = (path, val) => {
  return new Promise((resolve, reject) => {
    try {
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      const onSuccessListener = new gmsTasks.OnSuccessListener({
        onSuccess: () => resolve()
      });

      const onFailureListener = new gmsTasks.OnFailureListener({
        onFailure: exception => reject(exception.getMessage())
      });

      if (typeof val === "object") {
        firebase.instance.child(path).updateChildren(firebase.toHashMap(val))
            .addOnSuccessListener(onSuccessListener)
            .addOnFailureListener(onFailureListener);
      } else {
        const lastPartOfPath = path.lastIndexOf("/");
        const pathPrefix = path.substring(0, lastPartOfPath);
        const pathSuffix = path.substring(lastPartOfPath + 1);
        const updateObject = '{"' + pathSuffix + '" : "' + val + '"}';
        firebase.instance.child(pathPrefix).updateChildren(firebase.toHashMap(JSON.parse(updateObject)))
            .addOnSuccessListener(onSuccessListener)
            .addOnFailureListener(onFailureListener);
      }
    } catch (ex) {
      console.log("Error in firebase.update: " + ex);
      reject(ex);
    }
  });
};

firebase.query = (updateCallback: (data: FBDataSingleEvent | FBErrorData) => void, path: string, options: QueryOptions): Promise<any> => {
  return new Promise<any>((resolve, reject) => {
    try {
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      let query;

      // orderBy
      if (options.orderBy.type === firebase.QueryOrderByType.KEY) {
        query = firebase.instance.child(path).orderByKey();
      } else if (options.orderBy.type === firebase.QueryOrderByType.VALUE) {
        query = firebase.instance.child(path).orderByValue();
      } else if (options.orderBy.type === firebase.QueryOrderByType.PRIORITY) {
        query = firebase.instance.child(path).orderByPriority();
      } else if (options.orderBy.type === firebase.QueryOrderByType.CHILD) {
        if (options.orderBy.value === undefined || options.orderBy.value === null) {
          reject("When orderBy.type is 'child' you must set orderBy.value as well.");
          return;
        }
        query = firebase.instance.child(path).orderByChild(options.orderBy.value);
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
          query = query.startAt(options.range.value);
        } else if (options.range.type === firebase.QueryRangeType.END_AT) {
          query = query.endAt(options.range.value);
        } else if (options.range.type === firebase.QueryRangeType.EQUAL_TO) {
          query = query.equalTo(options.range.value);
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
            query = query.startAt(range.value);
          } else if (range.type === firebase.QueryRangeType.END_AT) {
            query = query.endAt(range.value);
          } else if (range.type === firebase.QueryRangeType.EQUAL_TO) {
            query = query.equalTo(range.value);
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
          query = query.limitToFirst(options.limit.value);
        } else if (options.limit.type === firebase.QueryLimitType.LAST) {
          query = query.limitToLast(options.limit.value);
        } else {
          reject("Invalid limit.type, use constants like firebase.QueryLimitType.FIRST");
          return;
        }
      }

      if (options.singleEvent) {
        const listener = new com.google.firebase.database.ValueEventListener({
          onDataChange: snapshot => {

            const result = {
              type: "ValueChanged",
              key: snapshot.getKey(),
              value: {},
              children: []
            };

            for (let iterator = snapshot.getChildren().iterator(); iterator.hasNext();) {
              const snap = iterator.next();
              const val = firebase.toJsObject(snap.getValue());
              result.value[snap.getKey()] = val;
              result.children.push(val);
            }

            if (updateCallback) updateCallback(result);
            // resolve promise with data in case of single event, see https://github.com/EddyVerbruggen/nativescript-plugin-firebase/issues/126
            resolve(result);
          },
          onCancelled: databaseError => {
            if (updateCallback) updateCallback({
              error: databaseError.getMessage()
            });
            // see comment at 'onDataChange'
            resolve({
              error: databaseError.getMessage()
            });
          }
        });
        query.addListenerForSingleValueEvent(listener);
      } else {
        resolve({
          path: path,
          listeners: [firebase._addObservers(query, updateCallback)]
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
      if (firebase.instance === null) {
        reject("Run init() first!");
        return;
      }

      firebase.instance.child(path).setValue(null)
          .addOnSuccessListener(new gmsTasks.OnSuccessListener({
            onSuccess: () => resolve()
          }))
          .addOnFailureListener(new gmsTasks.OnFailureListener({
            onFailure: exception => reject(exception.getMessage())
          }));
    } catch (ex) {
      console.log("Error in firebase.remove: " + ex);
      reject(ex);
    }
  });
};

class OnDisconnect implements OnDisconnectBase {

  constructor(private disconnectInstance: com.google.firebase.database.OnDisconnect) {
  }

  cancel(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.disconnectInstance.cancel()
            .addOnSuccessListener(new gmsTasks.OnSuccessListener({
              onSuccess: () => resolve()
            }))
            .addOnFailureListener(new gmsTasks.OnFailureListener({
              onFailure: exception => reject(exception.getMessage())
            }));
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.cancel: " + ex);
        reject(ex);
      }
    });
  }

  remove(): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.disconnectInstance.removeValue()
            .addOnSuccessListener(new gmsTasks.OnSuccessListener({
              onSuccess: () => resolve()
            }))
            .addOnFailureListener(new gmsTasks.OnFailureListener({
              onFailure: exception => reject(exception.getMessage())
            }));
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.remove: " + ex);
        reject(ex);
      }
    });
  }

  set(value: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.disconnectInstance.setValue(firebase.toValue(value))
            .addOnSuccessListener(new gmsTasks.OnSuccessListener({
              onSuccess: () => resolve()
            }))
            .addOnFailureListener(new gmsTasks.OnFailureListener({
              onFailure: exception => reject(exception.getMessage())
            }));
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.set: " + ex);
        reject(ex);
      }
    });
  }

  setWithPriority(value: any, priority: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.disconnectInstance.setValue(firebase.toValue(value), priority)
            .addOnSuccessListener(new gmsTasks.OnSuccessListener({
              onSuccess: () => resolve()
            }))
            .addOnFailureListener(new gmsTasks.OnFailureListener({
              onFailure: exception => reject(exception.getMessage())
            }));
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.setWithPriority: " + ex);
        reject(ex);
      }
    });
  }

  update(values: Object, onComplete?: (a: Error | null) => any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        this.disconnectInstance.updateChildren(firebase.toHashMap(values))
            .addOnSuccessListener(new gmsTasks.OnSuccessListener({
              onSuccess: () => resolve()
            }))
            .addOnFailureListener(new gmsTasks.OnFailureListener({
              onFailure: exception => reject(exception.getMessage())
            }));
      } catch (ex) {
        console.log("Error in firebase.onDisconnect.update: " + ex);
        reject(ex);
      }
    });
  }
}

firebase.onDisconnect = (path: string): OnDisconnectBase => {
  if (!firebase.initialized) {
    console.error("Please run firebase.init() before firebase.onDisconnect()");
    throw new Error("FirebaseApp is not initialized. Make sure you run firebase.init() first");
  }
  const disconnectInstance: com.google.firebase.database.OnDisconnect = firebase.instance.child(path).onDisconnect();
  return new OnDisconnect(disconnectInstance);
};

firebase.transaction = (path: string, transactionUpdate: (currentState) => any,
                        onComplete: (a: Error | null, b: boolean, c: DataSnapshot) => Promise<any>) => {
  return new Promise((resolve, reject) => {
    if (!firebase.initialized) {
      console.error("Please run firebase.init() before firebase.transaction()");
      throw new Error("FirebaseApp is not initialized. Make sure you run firebase.init() first");
    }
    const dbRef: com.google.firebase.database.DatabaseReference = firebase.instance.child(path);
    const handler: com.google.firebase.database.Transaction.Handler = new com.google.firebase.database.Transaction.Handler({
      doTransaction: (mutableData: com.google.firebase.database.MutableData) => {
        const desiredValue = transactionUpdate(firebase.toJsObject(mutableData.getValue()));
        // Java does not have undefined, but web transactions use undefined to detect if an abort() is desired.
        if (desiredValue === undefined) {
          // Same problem as iOS. The very first call to runTransaction will see that we get undefined
          // and immediately abort the transaction which results in us failing to update the value. Subsequent
          // calls are working fine unlike in iOS which always fail.

          // TLDR: Abort would be ideal, but atm it can result in a failed update (when it shouln't)
          // Returning success fixes this but makes our { committed: always true }...

          // return com.google.firebase.database.Transaction.abort();
          return com.google.firebase.database.Transaction.success(mutableData);
        }
        mutableData.setValue(firebase.toValue(desiredValue));
        return com.google.firebase.database.Transaction.success(mutableData);

      },
      onComplete: (databaseError: com.google.firebase.database.DatabaseError, commited: boolean, snapshot: com.google.firebase.database.DataSnapshot) => {
        databaseError !== null ? reject(databaseError.getMessage()) :
            resolve({committed: commited, snapshot: nativeSnapshotToWebSnapshot(snapshot)});
      }
    });
    dbRef.runTransaction(handler);
  });
};

// Converts Android DataSnapshot into Web Datasnapshot
function nativeSnapshotToWebSnapshot(snapshot: com.google.firebase.database.DataSnapshot): DataSnapshot {
  function forEach(action: (datasnapshot: DataSnapshot) => any): boolean {
    let innerSnapshot: DataSnapshot;
    for (let iterator = snapshot.getChildren().iterator(); iterator.hasNext();) {
      innerSnapshot = nativeSnapshotToWebSnapshot(iterator.next());
      if (action(innerSnapshot)) {
        return true;
      }
    }
    return false;
  }

  return {
    key: snapshot.getKey(),
    ref: snapshot.getRef(),
    child: (path: string) => nativeSnapshotToWebSnapshot(snapshot.child(path)),
    exists: () => snapshot.exists(),
    forEach: (func: (datasnapshot) => any) => forEach(func),
    getPriority: () => firebase.toJsObject(snapshot.getPriority()),
    hasChild: (path: string) => snapshot.hasChild(path),
    hasChildren: () => snapshot.hasChildren(),
    numChildren: () => snapshot.getChildrenCount(),
    toJSON: () => firebase.toJsObject(snapshot.toString()),
    val: () => firebase.toJsObject(snapshot.getValue())
  };
}

firebase.enableLogging = (logging: boolean, persistent?: boolean) => {
  if (logging) {
    com.google.firebase.database.FirebaseDatabase.getInstance().setLogLevel(com.google.firebase.database.Logger.Level.DEBUG);
  } else {
    com.google.firebase.database.FirebaseDatabase.getInstance().setLogLevel(com.google.firebase.database.Logger.Level.NONE);
  }
};

/***********************************************
 * END Realtime Database Functions
 ***********************************************/

const ensureFirestore = (): void => {
  if (typeof (com.google.firebase.firestore) === "undefined") {
    throw new Error("Make sure 'firestore' is enabled in 'firebase.nativescript.json', then clean the node_modules and platforms folders");
  }
};

class FirestoreWriteBatch {

  public nativeWriteBatch: com.google.firebase.firestore.WriteBatch;

  public set = (documentRef: firestore.DocumentReference, data: firestore.DocumentData, options?: firestore.SetOptions): any => {
    if (options && options.merge) {
      this.nativeWriteBatch.set((<any>documentRef).android, firebase.toValue(data), com.google.firebase.firestore.SetOptions.merge());
    } else {
      this.nativeWriteBatch.set((<any>documentRef).android, firebase.toValue(data));
    }
    return this;
  }

  public update(documentRef: firestore.DocumentReference, data: firestore.UpdateData): any {
    this.nativeWriteBatch.update((<any>documentRef).android, firebase.toValue(data));
    return this;
  }

  public delete = (documentRef: firestore.DocumentReference): any => {
    this.nativeWriteBatch.delete((<any>documentRef).android);
    return this;
  }

  public commit(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (!task.isSuccessful()) {
            const ex = task.getException();
            reject(ex && ex.getReason ? ex.getReason() : ex);
          } else {
            resolve();
          }
        }
      });
      this.nativeWriteBatch.commit().addOnCompleteListener(onCompleteListener);
    });
  }
}

firebase.firestore.batch = (): any => {
  const batch = new FirestoreWriteBatch();
  batch.nativeWriteBatch = com.google.firebase.firestore.FirebaseFirestore.getInstance().batch();
  return batch;
};

firebase.firestore.runTransaction = (updateFunction: (transaction: firestore.Transaction) => Promise<any>): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    // Why? See the note in the commented 'runTransaction' function below.

    // TODO .. but let's try again, with:
    // StrictMode.ThreadPolicy policy = new StrictMode.ThreadPolicy.Builder().permitAll().build();
    // StrictMode.setThreadPolicy(policy);
    reject("Not supported on Android. If you need a x-platform implementation, use 'batch' instead.");
  });
};


/*
class FirestoreTransaction implements firestore.Transaction {

  public nativeTransaction: com.google.firebase.firestore.Transaction;

  public get = (documentRef: firestore.DocumentReference): DocumentSnapshot => {
    const docSnapshot: com.google.firebase.firestore.DocumentSnapshot = this.nativeTransaction.get((<any>documentRef).android);
    return new DocumentSnapshot(docSnapshot ? docSnapshot.getId() : null, docSnapshot.exists(), firebase.toJsObject(docSnapshot.getData()));
  };

  public set = (documentRef: firestore.DocumentReference, data: firestore.DocumentData, options?: firestore.SetOptions): firestore.Transaction => {
    if (options && options.merge) {
      this.nativeTransaction.set((<any>documentRef).android, firebase.toValue(data), com.google.firebase.firestore.SetOptions.merge());
    } else {
      this.nativeTransaction.set((<any>documentRef).android, firebase.toValue(data));
    }
    return this;
  };

  public update = (documentRef: firestore.DocumentReference, data: firestore.UpdateData): firestore.Transaction => {
    this.nativeTransaction.update((<any>documentRef).android, firebase.toValue(data));
    return this;
  };

  public delete = (documentRef: firestore.DocumentReference): firestore.Transaction => {
    this.nativeTransaction.delete((<any>documentRef).android);
    return this;
  }
};

firebase.firestore.Transaction = (nativeTransaction: com.google.firebase.firestore.Transaction): firestore.Transaction => {
  const tx = new FirestoreTransaction();
  tx.nativeTransaction = nativeTransaction;
  return tx;
};

firebase.firestore.runTransaction = (updateFunction: (transaction: firestore.Transaction) => Promise<any>): Promise<void> => {
  return new Promise((resolve, reject) => {

    const onSuccessListenert = new gmsTasks.OnSuccessListener({
      onSuccess: () => {
        const i = 1;
      }
    });

    const onSuccessListener = new gmsTasks.OnSuccessListener({
      onSuccess: () => resolve()
    });

    const onFailureListener = new gmsTasks.OnFailureListener({
      onFailure: exception => reject(exception.getMessage())
    });

    // NOTE: Here's the problem: 'apply' is called from java to js, so that makes it run on the main/UI thread,
    // which is not allowed by Firebase.. so doesn't work in {N}
    const txFunction = new com.google.firebase.firestore.Transaction.Function({
      apply: (nativeTransaction: com.google.firebase.firestore.Transaction) => {
        const tx = new firebase.firestore.Transaction(nativeTransaction);
        return updateFunction(tx);
      }
    });

    com.google.firebase.firestore.FirebaseFirestore.getInstance().runTransaction(txFunction)
        .addOnSuccessListener(onSuccessListener)
        .addOnFailureListener(onFailureListener);
  });
};
*/

firebase.firestore.settings = (settings: firestore.Settings) => {
  if (typeof (com.google.firebase.firestore) !== "undefined") {
    try {
      const builder = new com.google.firebase.firestore.FirebaseFirestoreSettings.Builder();
      ((<any>settings).cacheSizeBytes !== undefined) && builder.setCacheSizeBytes(long((<any>settings).cacheSizeBytes));
      (settings.ssl !== undefined) && builder.setSslEnabled(settings.ssl);
      (settings.host !== undefined) && builder.setHost(settings.host);
      (initializeArguments.persist !== undefined) && builder.setPersistenceEnabled(initializeArguments.persist);

      com.google.firebase.firestore.FirebaseFirestore.getInstance().setFirestoreSettings(builder.build());
    } catch (err) {
      console.log("Error in firebase.firestore.settings: " + err);
    }
  }
};

firebase.firestore.clearPersistence = (): Promise<void> => {
  ensureFirestore();
  return new Promise<void>((resolve, reject) => {
    const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();
    const onSuccessListener = new gmsTasks.OnSuccessListener({
      onSuccess: () => resolve()
    });

    const onFailureListener = new gmsTasks.OnFailureListener({
      onFailure: exception => reject(exception.getMessage())
    });

    db.clearPersistence()
        .addOnSuccessListener(onSuccessListener)
        .addOnFailureListener(onFailureListener);
  });
};

firebase.firestore.collection = (collectionPath: string): firestore.CollectionReference => {
  ensureFirestore();
  try {
    if (!firebase.initialized) {
      console.log("Please run firebase.init() before firebase.firestore.collection()");
      return null;
    }

    const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();
    return firebase.firestore._getCollectionReference(db.collection(collectionPath));
  } catch (ex) {
    console.log("Error in firebase.firestore.collection: " + ex);
    return null;
  }
};

firebase.firestore.collectionGroup = (id: string): any => {
  ensureFirestore();
  try {
    const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();
    return firebase.firestore._getCollectionGroupQuery(db.collectionGroup(id));
  } catch (ex) {
    console.log("Error in firebase.firestore.collectionGroup: " + ex);
    return null;
  }
};

firebase.firestore.onDocumentSnapshot = (docRef: com.google.firebase.firestore.DocumentReference, optionsOrCallback: firestore.SnapshotListenOptions | ((snapshot: DocumentSnapshot) => void), callbackOrOnError: (docOrError: DocumentSnapshot | Error) => void, onError: (error: Error) => void): () => void => {
  let options = com.google.firebase.firestore.MetadataChanges.EXCLUDE;
  let onNextCallback: (snapshot: DocumentSnapshot) => void;
  let onErrorCallback: (error: Error) => void;

  if ((typeof optionsOrCallback) === "function") {
    onNextCallback = <(snapshot: DocumentSnapshot) => void>optionsOrCallback;
    onErrorCallback = callbackOrOnError;
  } else {
    onNextCallback = callbackOrOnError;
    onErrorCallback = onError;
  }
  if ((<firestore.SnapshotListenOptions>optionsOrCallback).includeMetadataChanges) {
    options = com.google.firebase.firestore.MetadataChanges.INCLUDE;
  }

  const listener = docRef.addSnapshotListener(options, new com.google.firebase.firestore.EventListener({
        onEvent: ((snapshot: com.google.firebase.firestore.DocumentSnapshot, exception: com.google.firebase.firestore.FirebaseFirestoreException) => {
          if (exception !== null) {
            const error = "onDocumentSnapshot error code: " + exception.getCode();
            onErrorCallback && onErrorCallback(new Error(error));
            return;
          }
          onNextCallback && onNextCallback(new DocumentSnapshot(snapshot));
        })
      })
  );

  return () => listener.remove();
};

firebase.firestore.onCollectionSnapshot = (colRef: com.google.firebase.firestore.CollectionReference, optionsOrCallback: firestore.SnapshotListenOptions | ((snapshot: QuerySnapshot) => void), callbackOrOnError: (snapshotOrError: QuerySnapshot | Error) => void, onError?: (error: Error) => void): () => void => {
  let options = com.google.firebase.firestore.MetadataChanges.EXCLUDE;
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
  if ((<firestore.SnapshotListenOptions>optionsOrCallback).includeMetadataChanges) {
    options = com.google.firebase.firestore.MetadataChanges.INCLUDE;
  }

  const listener = colRef.addSnapshotListener(options, new com.google.firebase.firestore.EventListener({
    onEvent: ((snapshot: com.google.firebase.firestore.QuerySnapshot, exception: com.google.firebase.firestore.FirebaseFirestoreException) => {
      if (exception !== null) {
        const error = "onCollectionSnapshot error code: " + exception.getCode();
        onErrorCallback && onErrorCallback(new Error(error));
        return;
      }
      onNextCallback && onNextCallback(new QuerySnapshot(snapshot));
    })
  }));
  return () => listener.remove();
};

firebase.firestore._getDocumentReference = (docRef?: JDocumentReference): firestore.DocumentReference => {
  if (!docRef) {
    return null;
  }

  const collectionPath = docRef.getParent().getPath();

  return {
    discriminator: "docRef",
    id: docRef.getId(),
    parent: firebase.firestore._getCollectionReference(docRef.getParent()),
    path: docRef.getPath(),
    firestore: firebase.firestore,
    collection: cp => firebase.firestore.collection(`${collectionPath}/${docRef.getId()}/${cp}`),
    set: (data: any, options?: firestore.SetOptions) => firebase.firestore.set(collectionPath, docRef.getId(), data, options),
    get: (options?: firestore.GetOptions) => firebase.firestore.getDocument(collectionPath, docRef.getId(), options),
    update: (data: any) => firebase.firestore.update(collectionPath, docRef.getId(), data),
    delete: () => firebase.firestore.delete(collectionPath, docRef.getId()),
    onSnapshot: (optionsOrCallback: firestore.SnapshotListenOptions | ((snapshot: firestore.DocumentSnapshot) => void), callbackOrOnError?: (docOrError: firestore.DocumentSnapshot | Error) => void, onError?: (error: Error) => void) => firebase.firestore.onDocumentSnapshot(docRef, optionsOrCallback, callbackOrOnError, onError),
    android: docRef
  };
};

firebase.firestore._getCollectionGroupQuery = (query?: com.google.firebase.firestore.Query): firestore.CollectionGroup => {
  if (!query) {
    return null;
  }

  return {
    where: (property: string, opStr: firestore.WhereFilterOp, value: any) => firebase.firestore.where(undefined, property, opStr, value, query)
  };
};

firebase.firestore._getCollectionReference = (colRef?: JCollectionReference): firestore.CollectionReference => {
  if (!colRef) {
    return null;
  }

  const collectionPath = colRef.getPath();

  return {
    id: colRef.getId(),
    parent: firebase.firestore._getDocumentReference(colRef.getParent()),
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

firebase.firestore.doc = (collectionPath: string, documentPath?: string): firestore.DocumentReference => {
  ensureFirestore();
  try {
    if (!firebase.initialized) {
      console.log("Please run firebase.init() before firebase.firestore.doc()");
      return null;
    }

    const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();
    const colRef: com.google.firebase.firestore.CollectionReference = db.collection(collectionPath);
    const docRef: com.google.firebase.firestore.DocumentReference = documentPath ? colRef.document(documentPath) : colRef.document();
    return firebase.firestore._getDocumentReference(docRef);
  } catch (ex) {
    console.log("Error in firebase.firestore.doc: " + ex);
    return null;
  }
};

firebase.firestore.docRef = (documentPath: string): firestore.DocumentReference => {
  ensureFirestore();
  const db: com.google.firebase.firestore.FirebaseFirestore = com.google.firebase.firestore.FirebaseFirestore.getInstance();
  return firebase.firestore._getDocumentReference(db.document(documentPath));
};

firebase.firestore.add = (collectionPath: string, document: any): Promise<firestore.DocumentReference> => {
  ensureFirestore();
  return new Promise<firestore.DocumentReference>((resolve, reject) => {
    try {
      const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();

      const onSuccessListener = new gmsTasks.OnSuccessListener({
        onSuccess: (docRef: com.google.firebase.firestore.DocumentReference) => {
          resolve(firebase.firestore._getDocumentReference(docRef));
        }
      });

      const onFailureListener = new gmsTasks.OnFailureListener({
        onFailure: exception => reject(exception.getMessage())
      });

      db.collection(collectionPath)
          .add(firebase.toValue(document))
          .addOnSuccessListener(onSuccessListener)
          .addOnFailureListener(onFailureListener);

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
      const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();

      const onSuccessListener = new gmsTasks.OnSuccessListener({
        onSuccess: () => resolve()
      });

      const onFailureListener = new gmsTasks.OnFailureListener({
        onFailure: exception => reject(exception.getMessage())
      });

      const docRef: com.google.firebase.firestore.DocumentReference = db.collection(collectionPath).document(documentPath);
      if (options && options.merge) {
        docRef
            .set(firebase.toValue(document), com.google.firebase.firestore.SetOptions.merge())
            .addOnSuccessListener(onSuccessListener)
            .addOnFailureListener(onFailureListener);
      } else {
        docRef
            .set(firebase.toValue(document))
            .addOnSuccessListener(onSuccessListener)
            .addOnFailureListener(onFailureListener);
      }

    } catch (ex) {
      console.log("Error in firebase.firestore.set: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore.update = (collectionPath: string, documentPath: string, document: any): Promise<void> => {
  ensureFirestore();
  return new Promise<void>((resolve, reject) => {
    try {
      const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();

      const onSuccessListener = new gmsTasks.OnSuccessListener({
        onSuccess: () => resolve()
      });

      const onFailureListener = new gmsTasks.OnFailureListener({
        onFailure: exception => reject(exception.getMessage())
      });

      const docRef: com.google.firebase.firestore.DocumentReference = db.collection(collectionPath).document(documentPath);
      docRef
          .update(firebase.toValue(document))
          .addOnSuccessListener(onSuccessListener)
          .addOnFailureListener(onFailureListener);

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
      const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();

      const onSuccessListener = new gmsTasks.OnSuccessListener({
        onSuccess: () => resolve()
      });

      const onFailureListener = new gmsTasks.OnFailureListener({
        onFailure: exception => reject(exception.getMessage())
      });

      const docRef: com.google.firebase.firestore.DocumentReference = db.collection(collectionPath).document(documentPath);
      docRef
          .delete()
          .addOnSuccessListener(onSuccessListener)
          .addOnFailureListener(onFailureListener);

    } catch (ex) {
      console.log("Error in firebase.firestore.delete: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore.getCollection = (collectionPath: string, options?: firestore.GetOptions): Promise<firestore.QuerySnapshot> => {
  ensureFirestore();
  return new Promise<firestore.QuerySnapshot>((resolve, reject) => {
    try {
      const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();

      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (!task.isSuccessful()) {
            const ex = task.getException();
            reject(ex && ex.getReason ? ex.getReason() : ex);
          } else {
            const result: com.google.firebase.firestore.QuerySnapshot = task.getResult();
            resolve(new QuerySnapshot(result));
          }
        }
      });

      let source = com.google.firebase.firestore.Source.DEFAULT;
      if (options && options.source) {
        if (options.source === "cache") {
          source = com.google.firebase.firestore.Source.CACHE;
        } else if (options.source === "server") {
          source = com.google.firebase.firestore.Source.SERVER;
        }
      }

      db.collection(collectionPath)
          .get(source)
          .addOnCompleteListener(onCompleteListener);

    } catch (ex) {
      console.log("Error in firebase.firestore.getCollection: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore.get = (collectionPath: string, options?: firestore.GetOptions): Promise<firestore.QuerySnapshot> => {
  return firebase.firestore.getCollection(collectionPath, options);
};

firebase.firestore.getDocument = (collectionPath: string, documentPath: string, options?: firestore.GetOptions): Promise<firestore.DocumentSnapshot> => {
  ensureFirestore();
  return new Promise<firestore.DocumentSnapshot>((resolve, reject) => {
    try {
      const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();

      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: task => {
          if (!task.isSuccessful()) {
            const ex = task.getException();
            reject(ex && ex.getReason ? ex.getReason() : ex);
          } else {
            const result: com.google.firebase.firestore.DocumentSnapshot = task.getResult();
            resolve(<any>new DocumentSnapshot(result));
          }
        }
      });

      let source = com.google.firebase.firestore.Source.DEFAULT;
      if (options && options.source) {
        if (options.source === "cache") {
          source = com.google.firebase.firestore.Source.CACHE;
        } else if (options.source === "server") {
          source = com.google.firebase.firestore.Source.SERVER;
        }
      }

      db.collection(collectionPath)
          .document(documentPath)
          .get(source)
          .addOnCompleteListener(onCompleteListener);

    } catch (ex) {
      console.log("Error in firebase.firestore.getDocument: " + ex);
      reject(ex);
    }
  });
};

firebase.firestore._getQuery = (collectionPath: string, query: com.google.firebase.firestore.Query): firestore.Query => {
  return {
    get: () => new Promise((resolve, reject) => {
      const onCompleteListener = new gmsTasks.OnCompleteListener({
        onComplete: (task: any) => {
          if (!task.isSuccessful()) {
            const ex = task.getException();
            reject(ex && ex.getReason ? ex.getReason() : ex);
          } else {
            const result: com.google.firebase.firestore.QuerySnapshot = task.getResult();
            resolve(new QuerySnapshot(result));
          }
        }
      });
      query.get().addOnCompleteListener(onCompleteListener);
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

firebase.firestore.where = (collectionPath: string, fieldPath: string, opStr: firestore.WhereFilterOp, value: any, query?: com.google.firebase.firestore.Query): firestore.Query => {
  ensureFirestore();
  try {
    const db = com.google.firebase.firestore.FirebaseFirestore.getInstance();
    query = query || db.collection(collectionPath);

    if (opStr === "<") {
      query = query.whereLessThan(fieldPath, firebase.toValue(value));
    } else if (opStr === "<=") {
      query = query.whereLessThanOrEqualTo(fieldPath, firebase.toValue(value));
    } else if (opStr === "==") {
      query = query.whereEqualTo(fieldPath, firebase.toValue(value));
    } else if (opStr === ">=") {
      query = query.whereGreaterThanOrEqualTo(fieldPath, firebase.toValue(value));
    } else if (opStr === ">") {
      query = query.whereGreaterThan(fieldPath, firebase.toValue(value));
    } else if (opStr === "in") {
      query = query.whereIn(fieldPath, firebase.toValue(value));
    } else if (opStr === "array-contains") {
      query = query.whereArrayContains(fieldPath, firebase.toValue(value));
    } else if (opStr === "array-contains-any") {
      query = query.whereArrayContainsAny(fieldPath, firebase.toValue(value));
    } else {
      console.log("Illegal argument for opStr: " + opStr);
      return null;
    }

    return firebase.firestore._getQuery(collectionPath, query);

  } catch (ex) {
    console.log("Error in firebase.firestore.where: " + ex);
    return null;
  }
};

firebase.firestore.orderBy = (collectionPath: string, fieldPath: string, direction: firestore.OrderByDirection, query: com.google.firebase.firestore.Query): firestore.Query => {
  query = query.orderBy(fieldPath, direction === "desc" ? com.google.firebase.firestore.Query.Direction.DESCENDING : com.google.firebase.firestore.Query.Direction.ASCENDING);
  return firebase.firestore._getQuery(collectionPath, query);
};

firebase.firestore.limit = (collectionPath: string, limit: number, query: com.google.firebase.firestore.Query): firestore.Query => {
  query = query.limit(limit);
  return firebase.firestore._getQuery(collectionPath, query);
};

firebase.firestore.startAfter = (collectionPath: string, snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[], query: com.google.firebase.firestore.Query): firestore.Query => {
  return firebase.firestore._getQuery(collectionPath, query.startAfter(firebase.firestore._getSnapshotOrFieldValues(snapshotOrFieldValue, fieldValues)));
};

firebase.firestore.startAt = (collectionPath: string, snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[], query: com.google.firebase.firestore.Query): firestore.Query => {
  return firebase.firestore._getQuery(collectionPath, query.startAt(firebase.firestore._getSnapshotOrFieldValues(snapshotOrFieldValue, fieldValues)));
};

firebase.firestore.endAt = (collectionPath: string, snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[], query: com.google.firebase.firestore.Query): firestore.Query => {
  return firebase.firestore._getQuery(collectionPath, query.endAt(firebase.firestore._getSnapshotOrFieldValues(snapshotOrFieldValue, fieldValues)));
};

firebase.firestore.endBefore = (collectionPath: string, snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[], query: com.google.firebase.firestore.Query): firestore.Query => {
  return firebase.firestore._getQuery(collectionPath, query.endBefore(firebase.firestore._getSnapshotOrFieldValues(snapshotOrFieldValue, fieldValues)));
};

firebase.firestore._getSnapshotOrFieldValues = (snapshotOrFieldValue: DocumentSnapshot | any, fieldValues: any[]): any => {
  if (snapshotOrFieldValue && snapshotOrFieldValue.android) {
    return snapshotOrFieldValue.android;
  } else {
    const AllFieldValues = [snapshotOrFieldValue, ...fieldValues];
    const javaArray = Array.create('java.lang.Object', AllFieldValues.length);
    AllFieldValues.forEach((value, index) => {
      javaArray[index] = firebase.toValue(value);
    });
    return javaArray;
  }
};

export type JDocumentReference = com.google.firebase.firestore.DocumentReference;
export type JCollectionReference = com.google.firebase.firestore.CollectionReference;

function convertDocChangeType(type: com.google.firebase.firestore.DocumentChange.Type) {
  switch (type) {
    case com.google.firebase.firestore.DocumentChange.Type.ADDED:
      return 'added';
    case com.google.firebase.firestore.DocumentChange.Type.MODIFIED:
      return 'modified';
    case com.google.firebase.firestore.DocumentChange.Type.REMOVED:
      return 'removed';
    default:
      throw new Error('Unknown DocumentChangeType');
  }
}

function convertDocument(qDoc: com.google.firebase.firestore.QueryDocumentSnapshot): firestore.QueryDocumentSnapshot {
  return <any>new DocumentSnapshot(qDoc);
}

export class QuerySnapshot implements firestore.QuerySnapshot {
  private _docSnapshots: firestore.QueryDocumentSnapshot[];

  constructor(private snapshot: com.google.firebase.firestore.QuerySnapshot) {
  }

  metadata = {
    fromCache: this.snapshot.getMetadata().isFromCache(),
    hasPendingWrites: this.snapshot.getMetadata().hasPendingWrites()
  };

  get docs(): firestore.QueryDocumentSnapshot[] {
    const getSnapshots = () => {
      const docSnapshots: firestore.QueryDocumentSnapshot[] = [];
      for (let i = 0; i < this.snapshot.size(); i++) {
        const documentSnapshot: com.google.firebase.firestore.DocumentSnapshot = this.snapshot.getDocuments().get(i);
        docSnapshots.push(<any>new DocumentSnapshot(documentSnapshot));
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
    const docChanges: firestore.DocumentChange[] = [];
    const jChanges: java.util.List<com.google.firebase.firestore.DocumentChange> = this.snapshot.getDocumentChanges();
    for (let i = 0; i < jChanges.size(); i++) {
      const chg: com.google.firebase.firestore.DocumentChange = jChanges.get(i);
      const type = convertDocChangeType(chg.getType());
      const doc = convertDocument(chg.getDocument());

      docChanges.push({
        doc,
        newIndex: chg.getNewIndex(),
        oldIndex: chg.getOldIndex(),
        type,
      });
    }

    return docChanges;
  }

  forEach(callback: (result: firestore.DocumentSnapshot) => void, thisArg?: any): void {
    this.docSnapshots.map(snapshot => callback(snapshot));
  }
}
firebase.firestore.FieldPath = class {
  static documentId() {
    return com.google.firebase.firestore.FieldPath.documentId();
  }
}

export * from './firebase-common';
