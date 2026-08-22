import { z } from "zod";

export const emailField = z.string().trim().min(1, "Informe seu e-mail.").email("Digite um e-mail válido.");
export const passwordField = z.string().min(6, "A senha precisa ter pelo menos 6 caracteres.");

export const authSchemasByMode = {
  login: z.object({ email: emailField, password: passwordField }),
  reset: z.object({ email: emailField }),
  register: z
    .object({ name: z.string().trim().min(1, "Informe seu nome."), email: emailField, password: passwordField, confirm: z.string() })
    .refine((data) => data.password === data.confirm, { message: "As senhas não conferem.", path: ["confirm"] }),
} as const;

export const workoutExerciseSchema = z
  .object({
    name: z.string(),
    sets: z.number().int().min(1, "Séries deve ser pelo menos 1."),
    repsMin: z.number().int().min(1, "Repetições mínimas deve ser pelo menos 1."),
    repsMax: z.number().int().min(1, "Repetições máximas deve ser pelo menos 1."),
    restSeconds: z.number().min(0, "Descanso não pode ser negativo."),
  })
  .refine((item) => item.repsMax >= item.repsMin, { message: "Repetições máximas deve ser maior ou igual às mínimas.", path: ["repsMax"] });

export const workoutFormSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do treino."),
  title: z.string().trim().min(1, "Informe o título do treino."),
  exercises: z.array(workoutExerciseSchema).min(1, "Adicione ao menos um exercício."),
});

export function workoutExerciseIssue(item: { name: string; sets: number; repsMin: number; repsMax: number; restSeconds: number }) {
  const result = workoutExerciseSchema.safeParse(item);
  return result.success ? null : `${item.name}: ${result.error.issues[0]?.message ?? "revise os dados."}`;
}

export const medicationScheduleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("interval"), intervalDays: z.number().int().min(1, "Informe um intervalo de pelo menos 1 dia.") }),
  z.object({ type: z.literal("weekdays"), weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Selecione ao menos um dia da semana.").refine((days) => new Set(days).size === days.length, "Não repita o mesmo dia da semana.") }),
  z.object({ type: z.literal("custom"), dates: z.array(z.string().min(1)).min(1, "Informe ao menos uma data.").refine((dates) => new Set(dates).size === dates.length, "Não repita a mesma data.") }),
]);

export const therapyMedicationSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome do medicamento."),
  formulation: z.string().trim().optional(),
  schedule: medicationScheduleSchema,
  reportedAmount: z.number().positive("A quantidade deve ser maior que zero.").optional(),
  reportedUnit: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const therapySchema = z
  .object({
    name: z.string().trim().min(1, "Informe o nome da terapia."),
    startDate: z.string().min(1, "Informe a data de início."),
    endDate: z.string().optional(),
    continuous: z.boolean(),
    medications: z.array(therapyMedicationSchema).min(1, "Adicione ao menos um medicamento."),
    notes: z.string().trim().optional(),
  })
  .refine((data) => data.continuous || Boolean(data.endDate), { message: "Informe a data final ou marque como contínua.", path: ["endDate"] })
  .refine((data) => !data.continuous || !data.endDate, { message: "Terapia contínua não deve ter data final.", path: ["endDate"] })
  .refine((data) => !data.endDate || data.endDate >= data.startDate, { message: "A data final deve ser igual ou posterior à data de início.", path: ["endDate"] });

export const therapyAdministrationSchema = z.object({
  scheduledDate: z.string().min(1),
  actualDate: z.string().optional(),
  status: z.enum(["completed", "skipped", "postponed"]),
  reportedAmount: z.number().positive("A quantidade deve ser maior que zero.").optional(),
  reportedUnit: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});
