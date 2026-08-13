import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase Web configuration identifies the public client application; values can be overridden per environment.
const config = { apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBI1sPxggPRkZwIV4zaPavk7gOECAsDi9s", authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "xtrainer-45f8d.firebaseapp.com", projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "xtrainer-45f8d", storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "xtrainer-45f8d.firebasestorage.app", messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "204702937283", appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:204702937283:web:719cda9778e7a45669f276" };
export const firebaseEnabled = Boolean(config.apiKey && config.projectId);
export const app = getApps().length ? getApp() : initializeApp(config);
export const auth = getAuth(app);
export const db = (() => { try { return initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); } catch { return getFirestore(app); } })();
export const storage = getStorage(app);
