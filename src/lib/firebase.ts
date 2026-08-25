import { getApp, getApps, initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// PUBLIC CLIENT CONFIG - not a secret. The Firebase Web apiKey/authDomain/projectId/appId only
// identify which Firebase project this client talks to; Firebase ships them in every web app's
// bundle by design (see https://firebase.google.com/docs/projects/api-keys). The values below
// are that same public config, kept as a fallback so local dev/CI works without a .env.local -
// see .env.example. Actual access control lives entirely in firestore.rules (owner-only) and,
// once enabled, App Check - never in hiding this object.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBI1sPxggPRkZwIV4zaPavk7gOECAsDi9s",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "xtrainer-45f8d.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "xtrainer-45f8d",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "xtrainer-45f8d.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "204702937283",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:204702937283:web:719cda9778e7a45669f276",
};
export const firebaseEnabled = Boolean(config.apiKey && config.projectId);
export const app = getApps().length ? getApp() : initializeApp(config);
// App Check (Fase 25 do hardening): fica desligado até NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY
// ser configurada (site key pública do reCAPTCHA Enterprise - também PUBLIC CLIENT CONFIG, não é
// segredo). Habilitar isso no Console primeiro em modo "Monitor" e só considerar enforcement
// depois de confirmar tráfego real dos dois apps chegando com token válido - ver docs/SECURITY.md.
const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY;
if (typeof window !== "undefined" && recaptchaSiteKey) {
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
}
export const auth = getAuth(app);
export const db = (() => { try { return initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); } catch { return getFirestore(app); } })();
