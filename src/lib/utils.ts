export const kg = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n) + " kg";
export const duration = (s?: number) => { const m = Math.round((s ?? 0) / 60); return `${m} min`; };
export const muscleGroups = ["Peitoral","Costas","Bíceps","Tríceps","Ombros","Quadríceps","Posteriores de coxa","Glúteos","Panturrilhas","Abdômen","Lombar","Antebraço","Trapézio","Corpo inteiro","Cardio","Mobilidade"];
export const exerciseMuscleGroups = ["Peito","Dorsais","Costas","Trapézio","Ombros","Bíceps","Tríceps","Antebraço","Quadríceps","Posterior de Coxa","Glúteos","Abdutores","Adutores","Panturrilha","Tibial Anterior","Abdômen","Core","Lombar"];
export const normalizeSearchText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
export const slugifyExerciseName = (name: string) => normalizeSearchText(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const parseBrazilianNumber = (value: string) => Number(value.trim().replace(",", "."));
export const formatDateBR = (value: string) => { const [year, month, day] = value.split("-"); return /^\d{4}$/.test(year ?? "") && /^\d{1,2}$/.test(month ?? "") && /^\d{1,2}$/.test(day ?? "") ? `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}` : value; };
export function dataErrorMessage(error: unknown, fallback = "Não foi possível concluir esta operação.") {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code).replace(/^firestore\//, "") : "";
  if (code === "permission-denied") return "Sua conta não possui permissão para esta operação.";
  if (code === "unauthenticated") return "Sua sessão expirou. Entre novamente.";
  if (code === "unavailable" || code === "network-request-failed") return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  if (code === "failed-precondition") return "A configuração do banco ainda não está pronta para esta consulta. Publique os índices do Firestore.";
  if (code === "resource-exhausted") return "O serviço está temporariamente ocupado. Aguarde e tente novamente.";
  const message = error instanceof Error ? error.message : "";
  return message && !/^(Firebase|Function|Missing or insufficient permissions)/i.test(message) ? message : fallback;
}
