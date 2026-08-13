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
export const login = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export async function profile(uid: string) { const snap = await getDoc(doc(db, "users", uid)); return snap.exists() ? snap.data() as UserProfile : null; }
export async function updateProfile(uid: string, data: Partial<UserProfile>) { await setDoc(doc(db, "users", uid), data, { merge: true }); }
