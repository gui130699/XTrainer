"use client";
import { Check, ExternalLink, Pencil, Repeat } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { trainingStageLabel } from "@/lib/training-methods";
import { ExerciseSwapPicker } from "@/components/training-methods/exercise-swap-picker";
import type { Exercise, SessionExercise, TrainingSet, WorkoutExerciseGroup } from "@/types";

export function TrainingGroupExecution({ group, members, allExercises, library, onChange, onComplete, onSwap, onSync }: { group: WorkoutExerciseGroup; members: SessionExercise[]; allExercises: SessionExercise[]; library: Exercise[]; onChange: (exerciseIndex: number, setIndex: number, data: Partial<TrainingSet>) => void; onComplete: (exerciseIndex: number, setIndex: number, completed: boolean) => void; onSwap: (exerciseIndex: number, exercise: Exercise) => void; onSync: () => void }) {
  const rounds = Math.max(...members.map((item) => item.sets.length));
  const allCompleted = members.every((exercise) => exercise.sets.length > 0 && exercise.sets.every((item) => item.completed));
  const [collapsed, setCollapsed] = useState(false);
  const [swappingId, setSwappingId] = useState<string | null>(null);
  const [prevAllCompleted, setPrevAllCompleted] = useState(allCompleted);
  if (allCompleted !== prevAllCompleted) { setPrevAllCompleted(allCompleted); if (allCompleted) setCollapsed(true); }

  return <Card className={`group-execution ${collapsed ? "is-collapsed" : ""}`}>
    <div className="method-execution-title"><div><p className="eyebrow">SEQUÊNCIA COMBINADA</p><h2>{group.name}</h2><span className="method-chip">{group.methodSnapshot.name}</span></div><p>{group.methodSnapshot.fullDescription}</p></div>

    <div className="group-members-header">{members.map((exercise) => {
      const exerciseIndex = allExercises.findIndex((item) => item.id === exercise.id);
      const videoUrl = library.find((item) => item.id === exercise.exerciseId)?.videoUrl;
      return <div className="group-member-tools" key={exercise.id}>
        <span>{exercise.name}</span>
        {videoUrl && <a className="video-link" href={videoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Vídeo</a>}
        <button type="button" className="text-button" onClick={() => setSwappingId(exercise.id)}><Repeat size={14}/> Trocar</button>
        {swappingId === exercise.id && <ExerciseSwapPicker library={library} excludeId={exercise.exerciseId} onSelect={(item) => { onSwap(exerciseIndex, item); setSwappingId(null); }} onClose={() => setSwappingId(null)}/>}
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
