import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, runTransaction, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile } from "@/types";

export async function getSystemConfig() { const snap = await getDoc(doc(db, "system", "config")); return snap.exists() ? (snap.data() as { initialized: boolean; adminUid: string }) : null; }
export async function createFirstAdmin(data: { name: string; email: string; password: string }) {
  const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
  try { await runTransaction(db, async tx => { const config = doc(db, "system", "config"); const existing = await tx.get(config); if (existing.exists() && existing.data().initialized) throw new Error("O administrador inicial já foi criado."); tx.set(doc(db, "users", credential.user.uid), { uid: credential.user.uid, name: data.name, email: data.email, role: "admin", createdAt: serverTimestamp() }); tx.set(config, { initialized: true, adminUid: credential.user.uid, updatedAt: serverTimestamp() }); }); }
  catch (error) { await credential.user.delete(); throw error; }
}
export async function registerUser(data: { name: string; email: string; password: string }) {
  const credential = await createUserWithEmailAndPassword(auth, data.email, data.password);
  try {
    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name: data.name,
      email: data.email,
      role: "user",
      createdAt: serverTimestamp(),
    });
  } catch (error) { await credential.user.delete(); throw error; }
}
export function friendlyAuthError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já possui uma conta. Use “Entrar” ou recupere sua senha.",
    "auth/invalid-email": "Informe um endereço de e-mail válido.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/invalid-credential": "E-mail ou senha incorretos. Verifique os dados e tente novamente.",
    "auth/user-not-found": "Não encontramos uma conta com este e-mail.",
    "auth/wrong-password": "Senha incorreta. Tente novamente ou recupere sua senha.",
    "auth/network-request-failed": "Sem conexão com a internet. Verifique sua rede e tente novamente.",
    "permission-denied": "Sua conta foi criada, mas o perfil não pôde ser salvo. Tente entrar novamente em alguns instantes.",
    "firestore/permission-denied": "Sua conta foi criada, mas o perfil não pôde ser salvo. Tente entrar novamente em alguns instantes.",
  };
  return messages[code] ?? "Não foi possível concluir a operação agora. Tente novamente em alguns instantes.";
}
export const login = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export async function profile(uid: string) { const snap = await getDoc(doc(db, "users", uid)); return snap.exists() ? snap.data() as UserProfile : null; }
export async function updateProfile(uid: string, data: Partial<UserProfile>) { await setDoc(doc(db, "users", uid), data, { merge: true }); }
