import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ExerciseSubstitutionPreference } from "@/types";

const withoutUndefined = <T extends object>(data: T) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

export const exercisePreferences = {
  list: async (uid: string) => (await getDocs(query(collection(db, "exerciseSubstitutionPreferences"), where("ownerId", "==", uid))))
    .docs.map((item) => ({ id: item.id, ...item.data() }) as ExerciseSubstitutionPreference),
  save: async (uid: string, exerciseId: string, alternativeExerciseIds: string[], existingId?: string) => {
    const payload = withoutUndefined({ ownerId: uid, exerciseId, alternativeExerciseIds, updatedAt: serverTimestamp() });
    if (existingId) return updateDoc(doc(db, "exerciseSubstitutionPreferences", existingId), payload);
    return addDoc(collection(db, "exerciseSubstitutionPreferences"), { ...payload, createdAt: serverTimestamp() });
  },
  remove: (id: string) => deleteDoc(doc(db, "exerciseSubstitutionPreferences", id)),
};
