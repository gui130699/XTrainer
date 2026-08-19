import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile as updateAuthProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";
import type { SystemConfig, UserProfile } from "@/types";

export async function getSystemConfig() {
  const snapshot = await getDoc(doc(db, "system", "config"));
  return snapshot.exists() ? snapshot.data() as SystemConfig : null;
}

export async function registerUser(data: { name: string; email: string; password: string }) {
  const name = data.name.trim();
  const email = data.email.trim();
  const credential = await createUserWithEmailAndPassword(auth, email, data.password);
  try {
    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name,
      email,
      role: "user",
      createdAt: serverTimestamp(),
    });
    await updateAuthProfile(credential.user, { displayName: name });
  } catch (error) {
    await credential.user.delete();
    throw error;
  }
}

export function friendlyAuthError(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já possui uma conta. Use Entrar ou recupere sua senha.",
    "auth/invalid-email": "Informe um endereço de e-mail válido.",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
    "auth/invalid-credential": "E-mail ou senha incorretos. Verifique os dados e tente novamente.",
    "auth/wrong-password": "A senha atual está incorreta.",
    "auth/requires-recent-login": "Por segurança, saia, entre novamente e repita esta alteração.",
    "auth/network-request-failed": "Sem conexão com a internet. Verifique sua rede e tente novamente.",
    "permission-denied": "Sua conta não possui permissão para concluir esta operação.",
    "firestore/permission-denied": "Sua conta não possui permissão para concluir esta operação.",
  };
  return messages[code] ?? (error instanceof Error ? error.message : "Não foi possível concluir a operação agora.");
}

export const login = (email: string, password: string) => signInWithEmailAndPassword(auth, email.trim(), password);
export const logout = () => signOut(auth);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email.trim());

export async function profile(uid: string) {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() as UserProfile : null;
}

type EditableProfile = Pick<UserProfile, "name" | "height" | "goal" | "birthDate" | "sex" | "photoURL">;

export async function updateProfile(uid: string, data: Partial<EditableProfile>) {
  const payload = { ...data, updatedAt: serverTimestamp() };
  await setDoc(doc(db, "users", uid), payload, { merge: true });
  if (auth.currentUser?.uid === uid) {
    await updateAuthProfile(auth.currentUser, {
      ...(data.name !== undefined ? { displayName: data.name } : {}),
      ...(data.photoURL !== undefined ? { photoURL: data.photoURL } : {}),
    });
  }
}

export async function changePassword(user: User, currentPassword: string, newPassword: string) {
  if (!user.email) throw new Error("A conta atual não possui e-mail para reautenticação.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
}

export async function uploadProfilePhoto(uid: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size >= 8 * 1024 * 1024) throw new Error("A imagem deve ter menos de 8 MB.");
  const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const target = ref(storage, `users/${uid}/profile/avatar-${Date.now()}.${extension}`);
  await uploadBytes(target, file, { contentType: file.type });
  return getDownloadURL(target);
}
