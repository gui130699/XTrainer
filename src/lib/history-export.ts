import { timestampDate } from "@/lib/training-analytics";
import { trainingStageLabel } from "@/lib/training-methods";
import { normalizeSearchText } from "@/lib/utils";
import type { WorkoutSession } from "@/types";

export interface HistoryFilters {
  period: string;
  workout: string;
  exercise: string;
  referenceTime: number;
}

export function sessionMatchesFilters(item: WorkoutSession, filters: HistoryFilters) {
  const minimum = filters.period === "all" ? 0 : filters.referenceTime - Number(filters.period) * 86400000;
  const search = normalizeSearchText(filters.exercise);
  return (!minimum || timestampDate(item.startedAt).getTime() >= minimum)
    && (!filters.workout || item.workoutName === filters.workout)
    && (!search || item.exercises.some((entry) => normalizeSearchText(entry.name).includes(search)));
}

export interface ExportRow {
  date: string;
  workoutName: string;
  exerciseName: string;
  stage: string;
  load: string;
  repsOrDuration: string;
  volume: string;
  rpe: string;
  rir: string;
}

export function buildExportRows(items: WorkoutSession[], formatDate: (value: WorkoutSession["startedAt"]) => string): ExportRow[] {
  const rows: ExportRow[] = [];
  for (const item of items) {
    for (const entry of item.exercises) {
      for (const set of entry.sets.filter((candidate) => candidate.completed)) {
        rows.push({
          date: formatDate(item.startedAt),
          workoutName: item.workoutName,
          exerciseName: entry.name,
          stage: trainingStageLabel(set),
          load: set.load.toLocaleString("pt-BR"),
          repsOrDuration: set.durationSeconds !== undefined ? `${set.durationSeconds}s` : `${set.reps}`,
          volume: Math.round(set.load * set.reps).toLocaleString("pt-BR"),
          rpe: set.rpe != null ? String(set.rpe) : "",
          rir: set.rir != null ? String(set.rir) : "",
        });
      }
    }
  }
  return rows;
}

export const EXPORT_COLUMNS: [keyof ExportRow, string][] = [
  ["date", "Data"],
  ["workoutName", "Treino"],
  ["exerciseName", "Exercício"],
  ["stage", "Etapa"],
  ["load", "Carga (kg)"],
  ["repsOrDuration", "Reps/Duração"],
  ["volume", "Volume (kg)"],
  ["rpe", "RPE"],
  ["rir", "RIR"],
];

export function csvEscape(value: string) {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Gera o texto do CSV (sem BOM/Blob, que são responsabilidade do navegador) para poder ser testado
// isoladamente com node:test, sem depender de DOM.
export function rowsToCsvText(rows: ExportRow[]) {
  const header = EXPORT_COLUMNS.map(([, label]) => csvEscape(label)).join(";");
  const lines = rows.map((row) => EXPORT_COLUMNS.map(([key]) => csvEscape(row[key])).join(";"));
  return [header, ...lines].join("\n");
}
