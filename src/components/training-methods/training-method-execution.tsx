"use client";
import { Check, ChevronUp, ExternalLink, Pencil, Plus, Repeat, SkipForward, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { trainingStageLabel } from "@/lib/training-methods";
import { ExerciseSwapPicker } from "@/components/training-methods/exercise-swap-picker";
import type { Exercise, SessionExercise, TrainingSet } from "@/types";

export function TrainingMethodExecution({ exercise, exerciseIndex, exerciseCount, library, preferredIds, onChange, onComplete, onAdd, onRemove, onPickReplacement, onTogglePreferred, onSkip, onUndoSkip, onSync }: {
  exercise: SessionExercise;
  exerciseIndex: number;
  exerciseCount?: number;
  library: Exercise[];
  preferredIds: string[];
  onChange: (exerciseIndex: number, setIndex: number, data: Partial<TrainingSet>) => void;
  onComplete: (exerciseIndex: number, setIndex: number, completed: boolean) => void;
  onAdd: (exerciseIndex: number) => void;
  onRemove: (exerciseIndex: number, setIndex: number) => void;
  onPickReplacement: (exerciseIndex: number, exercise: Exercise) => void;
  onTogglePreferred: (exerciseId: string, candidateId: string) => void;
  onSkip: (exerciseIndex: number) => void;
  onUndoSkip: (exerciseIndex: number) => void;
  onSync: () => void;
}) {
  const method = exercise.target.methodSnapshot;
  const [swapping, setSwapping] = useState(false);
  const skipped = exercise.skipInfo?.skipped === true;
  const allCompleted = !skipped && exercise.sets.length > 0 && exercise.sets.every((item) => item.completed);
  const [collapsed, setCollapsed] = useState(false);
  const [prevAllCompleted, setPrevAllCompleted] = useState(allCompleted);
  if (allCompleted !== prevAllCompleted) { setPrevAllCompleted(allCompleted); if (allCompleted) setCollapsed(true); }
  const videoUrl = library.find((item) => item.id === exercise.exerciseId)?.videoUrl;

  return <Card className={`exercise method-execution ${collapsed ? "is-collapsed" : ""} ${skipped ? "is-skipped" : ""}`}>
    <div className="method-execution-title">
      <div>{exerciseCount != null && <span className="exercise-counter">EXERCÍCIO {exerciseIndex + 1} DE {exerciseCount}</span>}<h2>{exercise.name}
        {exercise.substitutionType === "session-only" && <span className="status-badge is-session-only">Só nesta sessão</span>}
        {skipped && <span className="status-badge is-skipped">Pulado hoje</span>}
      </h2>
        {exercise.originalExerciseId && exercise.originalExerciseId !== exercise.exerciseId && <p className="exercise-original-note">Original: {exercise.originalExerciseName}</p>}
        <span className="method-chip">{method?.name ?? "Séries normais"}{exercise.target.groupId ? ` · posição ${(exercise.target.groupPosition ?? 0) + 1}` : ""}</span>
      </div>
      {!skipped && <div className="exercise-tools">
        {videoUrl && <a className="video-link" href={videoUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/> Vídeo</a>}
        <button type="button" className="text-button" onClick={() => setSwapping(true)}><Repeat size={15}/> Trocar</button>
        <button type="button" className="text-button" onClick={() => onSkip(exerciseIndex)}><SkipForward size={15}/> Pular hoje</button>
        {allCompleted && !collapsed && <button type="button" className="text-button" onClick={() => setCollapsed(true)}><ChevronUp size={15}/> Recolher</button>}
      </div>}
    </div>
    <p>{exercise.target.repsMin}–{exercise.target.repsMax} repetições · descanso {exercise.target.restSeconds}s</p>

    {skipped ? <div className="skip-undo-row">
      <small>{exercise.skipInfo?.reasonText ? `Motivo: ${exercise.skipInfo.reasonText}` : exercise.skipInfo?.reasonCode ? "Motivo informado" : "Sem motivo informado"}</small>
      <button type="button" className="text-button" onClick={() => onUndoSkip(exerciseIndex)}><Undo2 size={15}/> Desfazer pulo</button>
    </div> : collapsed ? <div className="draft-collapsed-summary">
      <div className="draft-summary-chips">
        <span className="draft-method-chip">{method?.name ?? "Séries normais"}</span>
        <span><b>{exercise.sets.filter((item) => item.completed).length}</b> séries concluídas</span>
        <span><b>{Math.round(exercise.sets.reduce((sum, item) => sum + (item.completed ? item.load * item.reps : 0), 0)).toLocaleString("pt-BR")} kg</b> volume</span>
      </div>
      <button type="button" className="draft-edit-button" onClick={() => setCollapsed(false)} aria-expanded="false"><Pencil size={15}/> VER SÉRIES</button>
    </div> : <>
      {exercise.sets.map((trainingSet, setIndex) => <div className={`set method-stage ${trainingSet.completed ? "completed" : ""}`} key={trainingSet.id}>
        <b>{trainingStageLabel(trainingSet)}</b>
        <label className="set-field"><span>Carga</span><input aria-label={`Carga: ${trainingStageLabel(trainingSet)}`} type="number" min="0" step="0.1" value={trainingSet.load} onChange={(event) => onChange(exerciseIndex, setIndex, { load: Number(event.target.value) })} onFocus={(event) => event.target.select()} onBlur={onSync}/></label>
        <span>kg ×</span>
        {trainingSet.durationSeconds !== undefined
          ? <label className="set-field"><span>Tempo</span><input aria-label={`Tempo: ${trainingStageLabel(trainingSet)}`} type="number" min="0" step="1" value={trainingSet.durationSeconds} onChange={(event) => onChange(exerciseIndex, setIndex, { durationSeconds: Number(event.target.value) })} onFocus={(event) => event.target.select()} onBlur={onSync}/><span>s</span></label>
          : <label className="set-field"><span>Reps</span><input aria-label={`Repetições: ${trainingStageLabel(trainingSet)}`} type="number" min="0" step="1" value={trainingSet.reps} onChange={(event) => onChange(exerciseIndex, setIndex, { reps: Number(event.target.value) })} onFocus={(event) => event.target.select()} onBlur={onSync}/></label>}
        {trainingSet.tempo && <small>{trainingSet.tempo.eccentric}-{trainingSet.tempo.pause}-{trainingSet.tempo.concentric}-{trainingSet.tempo.top}</small>}
        {trainingSet.toFailure && <small>até a falha</small>}
        {trainingSet.completed
          ? <button className="text-button" onClick={() => onComplete(exerciseIndex, setIndex, false)}>Desfazer <Check className="success" size={16}/></button>
          : <Button onClick={() => onComplete(exerciseIndex, setIndex, true)}>FINALIZAR SÉRIE</Button>}
        {setIndex >= exercise.target.sets && <button className="text-button" disabled={trainingSet.completed} onClick={() => onRemove(exerciseIndex, setIndex)}>Remover</button>}
      </div>)}
      <button className="text-button" onClick={() => onAdd(exerciseIndex)}><Plus size={16}/> Adicionar série normal</button>
    </>}

    {swapping && <ExerciseSwapPicker library={library} excludeId={exercise.exerciseId} preferredIds={preferredIds} onSelect={(item) => { onPickReplacement(exerciseIndex, item); setSwapping(false); }} onTogglePreferred={(candidateId) => onTogglePreferred(exercise.exerciseId, candidateId)} onClose={() => setSwapping(false)}/>}
  </Card>;
}
