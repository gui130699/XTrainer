import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile as updateAuthProfile } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile } from "@/types";

export async function getSystemConfig() { const snapshot = await getDoc(doc(db, "system", "config")); return snapshot.exists() ? snapshot.data() as { initialized: boolean; adminUid: string } : null; }
export async function createFirstAdmin(data: { name: string; email: string; password: string }) {
  let credential; let newAccount = true;
  try { credential = await createUserWithEmailAndPassword(auth, data.email, data.password); }
  catch (error) { if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/email-already-in-use") { credential = await signInWithEmailAndPassword(auth, data.email, data.password); newAccount = false; } else throw error; }
  try { await runTransaction(db, async transaction => { const config = doc(db, "system", "config"); const existing = await transaction.get(config); if (existing.exists() && existing.data().initialized) throw new Error("O administrador inicial já foi criado."); const userDoc = doc(db, "users", credential.user.uid); const existingUser = await transaction.get(userDoc); if (existingUser.exists()) transaction.update(userDoc, { role: "admin", name: data.name }); else transaction.set(userDoc, { uid: credential.user.uid, name: data.name, email: data.email, role: "admin", createdAt: serverTimestamp() }); transaction.set(config, { initialized: true, adminUid: credential.user.uid, updatedAt: serverTimestamp() }); }); await updateAuthProfile(credential.user, { displayName: data.name }); }
  catch (error) { if (newAccount) await credential.user.delete(); throw error; }
}
export async function registerUser(data: { name: string; email: string; password: string }) { const credential = await createUserWithEmailAndPassword(auth, data.email, data.password); try { await setDoc(doc(db, "users", credential.user.uid), { uid: credential.user.uid, name: data.name, email: data.email, role: "user", createdAt: serverTimestamp() }); await updateAuthProfile(credential.user, { displayName: data.name }); } catch (error) { await credential.user.delete(); throw error; } }
export function friendlyAuthError(error: unknown) { const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""; const messages: Record<string, string> = { "auth/email-already-in-use": "Este e-mail já possui uma conta. Use “Entrar” ou recupere sua senha.", "auth/invalid-email": "Informe um endereço de e-mail válido.", "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.", "auth/invalid-credential": "E-mail ou senha incorretos. Verifique os dados e tente novamente.", "auth/network-request-failed": "Sem conexão com a internet. Verifique sua rede e tente novamente.", "permission-denied": "Não foi possível salvar seu perfil. Tente novamente em alguns instantes.", "firestore/permission-denied": "Não foi possível salvar seu perfil. Tente novamente em alguns instantes." }; return messages[code] ?? "Não foi possível concluir a operação agora. Tente novamente em alguns instantes."; }
export const login = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export async function loginAsAdmin(email: string, password: string) {
  const credential = await login(email, password);
  const config = await getSystemConfig();
  if (!config?.initialized || config.adminUid !== credential.user.uid) {
    await signOut(auth);
    throw new Error("Esta conta não possui acesso administrativo.");
  }
  return credential;
}
export const logout = () => signOut(auth);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export async function profile(uid: string) { const snapshot = await getDoc(doc(db, "users", uid)); return snapshot.exists() ? snapshot.data() as UserProfile : null; }
export async function updateProfile(uid: string, data: Partial<UserProfile>) { await setDoc(doc(db, "users", uid), data, { merge: true }); }
