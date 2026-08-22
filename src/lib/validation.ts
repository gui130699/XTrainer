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
