import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SubstanceReference } from "@/types";

export const substanceReferences = {
  list: async () => (await getDocs(query(collection(db, "substanceReferences"), orderBy("sortOrder"))))
    .docs.map((item) => ({ id: item.id, ...item.data() }) as SubstanceReference),
};
