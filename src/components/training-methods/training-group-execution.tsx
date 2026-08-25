"use client";
import { Check, ChevronUp, ExternalLink, Pencil, Repeat, SkipForward, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { trainingStageLabel } from "@/lib/training-methods";
import { safeVideoUrl } from "@/lib/utils";
import { ExerciseSwapPicker } from "@/components/training-methods/exercise-swap-picker";
import type { Exercise, SessionExercise, TrainingSet, WorkoutExerciseGroup } from "@/types";

export function TrainingGroupExecution({ group, members, allExercises, library, preferredIds, onChange, onComplete, onPickReplacement, onTogglePreferred, onSkip, onUndoSkip, onSync }: {
  group: WorkoutExerciseGroup;
  members: SessionExercise[];
  allExercises: SessionExercise[];
  library: Exercise[];
  preferredIds: string[];
  onChange: (exerciseIndex: number, setIndex: number, data: Partial<TrainingSet>) => void;
  onComplete: (exerciseIndex: number, setIndex: number, completed: boolean) => void;
  onPickReplacement: (exerciseIndex: number, exercise: Exercise) => void;
  onTogglePreferred: (exerciseId: string, candidateId: string) => void;
  onSkip: (exerciseIndex: number) => void;
  onUndoSkip: (exerciseIndex: number) => void;
  onSync: () => void;
}) {
  const rounds = Math.max(...members.map((item) => item.sets.length));
  const executableMembers = members.filter((item) => !item.skipInfo?.skipped);
  const allCompleted = executableMembers.length > 0 && executableMembers.every((exercise) => exercise.sets.length > 0 && exercise.sets.every((item) => item.completed || item.skipped));
  const [collapsed, setCollapsed] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [prevAllCompleted, setPrevAllCompleted] = useState(allCompleted);
  if (allCompleted !== prevAllCompleted) { setPrevAllCompleted(allCompleted); if (allCompleted) setCollapsed(true); }

  return <Card className={`group-execution ${collapsed ? "is-collapsed" : ""}`}>
    <div className="method-execution-title"><div><p className="eyebrow">SEQUÊNCIA COMBINADA</p><h2>{group.name}</h2><span className="method-chip">{group.methodSnapshot.name}</span></div><div><p>{group.methodSnapshot.fullDescription}</p>{allCompleted && !collapsed && <div className="exercise-tools"><button type="button" className="text-button" onClick={() => setCollapsed(true)}><ChevronUp size={15}/> Recolher</button></div>}</div></div>

    <div className="group-members-header">{members.map((exercise) => {
      const exerciseIndex = allExercises.findIndex((item) => item.id === exercise.id);
      const videoUrl = safeVideoUrl(library.find((item) => item.id === exercise.exerciseId)?.videoUrl);
      const skipped = exercise.skipInfo?.skipped === true;
      return <div className="group-member-tools" key={exercise.id}>
        <span>{exercise.name}
          {exercise.substitutionType === "session-only" && <span className="status-badge is-session-only">Só nesta sessão</span>}
          {skipped && <span className="status-badge is-skipped">Pulado hoje</span>}
        </span>
        {!skipped && <>
          {videoUrl && <a className="video-link" href={videoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Vídeo</a>}
          <button type="button" className="text-button" onClick={() => setSwappingId(exercise.id)}><Repeat size={14}/> Trocar</button>
          <button type="button" className="text-button" onClick={() => onSkip(exerciseIndex)}><SkipForward size={14}/> Pular hoje</button>
        </>}
        {skipped && <button type="button" className="text-button" onClick={() => onUndoSkip(exerciseIndex)}><Undo2 size={14}/> Desfazer pulo</button>}
        {swappingId === exercise.id && <ExerciseSwapPicker library={library} excludeId={exercise.exerciseId} preferredIds={preferredIds} onSelect={(item) => { onPickReplacement(exerciseIndex, item); setSwappingId(null); }} onTogglePreferred={(candidateId) => onTogglePreferred(exercise.exerciseId, candidateId)} onClose={() => setSwappingId(null)}/>}
      </div>;
    })}</div>

    {collapsed ? <div className="draft-collapsed-summary">
      <div className="draft-summary-chips">
        <span className="draft-method-chip">{group.methodSnapshot.name}</span>
        <span><b>{members.reduce((sum, exercise) => sum + exercise.sets.filter((item) => item.completed).length, 0)}</b> séries concluídas</span>
      </div>
      <button type="button" className="draft-edit-button" onClick={() => setCollapsed(false)} aria-expanded="false"><Pencil size={15}/> VER SÉRIES</button>
    </div> : Array.from({ length: rounds }, (_, round) => <section className="group-round" key={round}>
      <h3>Rodada {round + 1}</h3>
      {members.map((exercise, position) => {
        const set = exercise.sets[round];
        if (!set) return null;
        const exerciseIndex = allExercises.findIndex((item) => item.id === exercise.id);
        if (set.skipped) return <div className="set method-stage is-skipped" key={set.id}><b>{position + 1}. {exercise.name}</b><small>Pulado hoje</small></div>;
        return <div className={`set method-stage ${set.completed ? "completed" : ""}`} key={set.id}>
          <b>{position + 1}. {exercise.name}</b>
          <small>{trainingStageLabel(set)}</small>
          <label className="set-field"><span>Carga</span><input type="number" min="0" step="0.1" aria-label={`Carga de ${exercise.name}, rodada ${round + 1}`} value={set.load} onChange={(event) => onChange(exerciseIndex, round, { load: Number(event.target.value) })} onFocus={(event) => event.target.select()} onBlur={onSync}/></label>
          <span>kg ×</span>
          <label className="set-field"><span>Reps</span><input type="number" min="0" step="1" aria-label={`Repetições de ${exercise.name}, rodada ${round + 1}`} value={set.reps} onChange={(event) => onChange(exerciseIndex, round, { reps: Number(event.target.value) })} onFocus={(event) => event.target.select()} onBlur={onSync}/></label>
          {set.completed
            ? <button className="text-button" onClick={() => onComplete(exerciseIndex, round, false)}>Desfazer <Check className="success" size={16}/></button>
            : <Button onClick={() => onComplete(exerciseIndex, round, true)}>FINALIZAR SÉRIE</Button>}
        </div>;
      })}
    </section>)}
  </Card>;
}
