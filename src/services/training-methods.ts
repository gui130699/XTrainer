import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { TrainingMethod } from "@/types";

let cache: TrainingMethod[] | null = null;
export const trainingMethodsService = {
  list: async (refresh = false) => {
    if (cache && !refresh) return cache;
    const snapshot = await getDocs(collection(db, "trainingMethods"));
    cache = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as TrainingMethod)).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"));
    return cache;
  },
  active: async () => (await trainingMethodsService.list()).filter((item) => item.active),
  clearCache: () => { cache = null; },
};

