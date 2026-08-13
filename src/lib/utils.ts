export const kg = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n) + " kg";
export const duration = (s?: number) => { const m = Math.round((s ?? 0) / 60); return `${m} min`; };
export const muscleGroups = ["Peitoral","Costas","Bíceps","Tríceps","Ombros","Quadríceps","Posteriores de coxa","Glúteos","Panturrilhas","Abdômen","Lombar","Antebraço","Trapézio","Corpo inteiro","Cardio","Mobilidade"];
export const exerciseMuscleGroups = ["Peito","Dorsais","Costas","Trapézio","Ombros","Bíceps","Tríceps","Antebraço","Quadríceps","Posterior de Coxa","Glúteos","Abdutores","Adutores","Panturrilha","Tibial Anterior","Abdômen","Core","Lombar"];
export const normalizeSearchText = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, " ");
export const slugifyExerciseName = (name: string) => normalizeSearchText(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
