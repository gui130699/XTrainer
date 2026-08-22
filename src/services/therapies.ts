import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Therapy, TherapyAdministration } from "@/types";

const withoutUndefined = <T extends object>(data: T) => Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
const withoutUndefinedDeep = <T>(data: T): T => {
  if (Array.isArray(data)) return data.map(withoutUndefinedDeep) as T;
  if (data && typeof data === "object" && Object.getPrototypeOf(data) === Object.prototype) return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined).map(([key, value]) => [key, withoutUndefinedDeep(value)])) as T;
  return data;
};

type TherapyInput = Omit<Therapy, "id" | "createdAt" | "updatedAt">;
const therapyPayload = (data: TherapyInput) => withoutUndefined({
  ownerId: data.ownerId,
  name: data.name,
  startDate: data.startDate,
  endDate: data.endDate,
  continuous: data.continuous,
  status: data.status,
  medications: withoutUndefinedDeep(data.medications),
  notes: data.notes,
  reminderOffsetDays: data.reminderOffsetDays,
});

export const therapies = {
  list: async (uid: string) => (await getDocs(query(collection(db, "therapies"), where("ownerId", "==", uid))))
    .docs.map((item) => ({ id: item.id, ...item.data() }) as Therapy)
    .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
  save: async (data: TherapyInput, id?: string) => {
    const payload = therapyPayload(data);
    if (id) return updateDoc(doc(db, "therapies", id), { ...payload, updatedAt: serverTimestamp() });
    return addDoc(collection(db, "therapies"), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },
  remove: (id: string) => deleteDoc(doc(db, "therapies", id)),
};

type AdministrationInput = Omit<TherapyAdministration, "id" | "createdAt" | "updatedAt">;
const administrationPayload = (data: AdministrationInput) => withoutUndefined({
  ownerId: data.ownerId,
  therapyId: data.therapyId,
  medicationId: data.medicationId,
  scheduledDate: data.scheduledDate,
  actualDate: data.actualDate,
  status: data.status,
  reportedAmount: data.reportedAmount,
  reportedUnit: data.reportedUnit,
  notes: data.notes,
});

export const therapyAdministrations = {
  list: async (uid: string) => (await getDocs(query(collection(db, "therapyAdministrations"), where("ownerId", "==", uid))))
    .docs.map((item) => ({ id: item.id, ...item.data() }) as TherapyAdministration),
  save: (data: AdministrationInput) => addDoc(collection(db, "therapyAdministrations"), { ...administrationPayload(data), createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
};
