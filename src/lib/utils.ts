export const kg = (n: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(n) + " kg";
export const duration = (s?: number) => { const m = Math.round((s ?? 0) / 60); return `${m} min`; };
export const muscleGroups = ["Peitoral","Costas","Bíceps","Tríceps","Ombros","Quadríceps","Posteriores de coxa","Glúteos","Panturrilhas","Abdômen","Lombar","Antebraço","Trapézio","Corpo inteiro","Cardio","Mobilidade"];
