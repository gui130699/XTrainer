"use client";

import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { useAuth } from "@/components/providers";
import { Button, Card, Empty, Loading } from "@/components/ui";
import { exercises, sessions, workouts } from "@/services/data";
import type { Exercise, Workout, WorkoutSession } from "@/types";
import { Check, Plus, Timer } from "lucide-react";
import { useEffect, useState } from "react";

function Work() {
  const { user } = useAuth(); const [plans, setPlans] = useState<Workout[]>([]); const [library, setLibrary] = useState<Exercise[]>([]); const [creating, setCreating] = useState(false); const [session, setSession] = useState<WorkoutSession | null>(null); const [rest, setRest] = useState(0);
  const reload = () => { if (user) workouts.list(user.uid).then(setPlans); };
  useEffect(() => { reload(); exercises.list().then(setLibrary); }, [user]);
  useEffect(() => { if (!rest) return; const timer = setInterval(() => setRest(value => Math.max(0, value - 1)), 1000); return () => clearInterval(timer); }, [rest]);
  if (!user) return <Loading />;

  async function createWorkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const exercise = library.find(item => item.id === String(form.get("exerciseId"))); if (!exercise) return;
    await workouts.save({ ownerId: user.uid, name: String(form.get("name")), title: String(form.get("title")), description: String(form.get("description")) || undefined, muscleGroups: [exercise.muscleGroup], active: true, exercises: [{ id: crypto.randomUUID(), exerciseId: exercise.id, name: exercise.name, order: 1, sets: Number(form.get("sets")), repsMin: Number(form.get("repsMin")), repsMax: Number(form.get("repsMax")), restSeconds: Number(form.get("rest")) }] });
    event.currentTarget.reset(); setCreating(false); reload();
  }
  async function start(workout: Workout) { const reference = await sessions.start(user.uid, workout); setSession(await sessions.get(reference.id)); }
  async function complete(exerciseIndex: number, setIndex: number) { if (!session) return; const exercise = session.exercises[exerciseIndex]; const trainingSet = exercise.sets[setIndex]; trainingSet.completed = true; trainingSet.volume = trainingSet.load * trainingSet.reps; const next = { ...session, exercises: [...session.exercises], totalSets: session.totalSets + 1, totalVolume: session.totalVolume + trainingSet.volume }; setSession(next); setRest(exercise.target.restSeconds); await sessions.save(session.id, { exercises: next.exercises, totalSets: next.totalSets, totalVolume: next.totalVolume }); }
  async function finish() { if (!session) return; await sessions.save(session.id, { status: "completed", endedAt: new Date() as never, durationSeconds: Math.round((Date.now() - (session.startedAt as unknown as { seconds: number }).seconds * 1000) / 1000) }); setSession(null); }

  if (!session) return <AppShell><header><p className="eyebrow">SESSÃO</p><h1>Qual treino vamos fazer?</h1><Button onClick={() => setCreating(value => !value)}><Plus size={16} /> NOVO TREINO</Button></header>
    {creating && <Card><h2>Montar novo treino</h2><p>Escolha um exercício já cadastrado na biblioteca.</p><form onSubmit={createWorkout}><label>Nome do treino<input name="name" required placeholder="Treino A" /></label><label>Título<input name="title" required placeholder="Peitoral" /></label><label>Descrição<textarea name="description" placeholder="Opcional" /></label><label>Exercício<select name="exerciseId" required defaultValue=""><option value="" disabled>Selecione um exercício</option>{library.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} — {item.muscleGroup}</option>)}</select></label><div className="form-grid"><label>Séries<input name="sets" type="number" min="1" defaultValue="3" /></label><label>Repetições mín.<input name="repsMin" type="number" min="1" defaultValue="8" /></label><label>Repetições máx.<input name="repsMax" type="number" min="1" defaultValue="12" /></label><label>Descanso (s)<input name="rest" type="number" min="0" defaultValue="90" /></label></div><Button>CRIAR TREINO</Button></form>{!library.length && <Empty title="Sem exercícios disponíveis" detail="Peça ao administrador para cadastrar exercícios na biblioteca." />}</Card>}
    <div className="cards">{plans.filter(item => item.active).map(workout => <Card key={workout.id}><h2>{workout.title}</h2><p>{workout.description}</p><small>{workout.exercises.length} exercícios</small><Button onClick={() => start(workout)}>INICIAR</Button></Card>)}</div>{!plans.length && !creating && <Empty title="Nenhum treino ativo" detail="Use “Novo treino” para montar o seu." />}
  </AppShell>;

  return <AppShell><header><p className="eyebrow">EM ANDAMENTO</p><h1>{session.workoutName}</h1><p>{session.totalSets} séries concluídas · {Math.round(session.totalVolume).toLocaleString("pt-BR")} kg</p></header>{rest > 0 && <Card className="rest"><Timer /><strong>{String(Math.floor(rest / 60)).padStart(2, "0")}:{String(rest % 60).padStart(2, "0")}</strong><Button onClick={() => setRest(0)}>PULAR DESCANSO</Button><button onClick={() => setRest(value => value + 15)}>+15s</button></Card>}{session.exercises.map((exercise, exerciseIndex) => <Card key={exercise.id} className="exercise"><h2>{exercise.name}</h2><p>{exercise.target.repsMin}–{exercise.target.repsMax} repetições · descanso {exercise.target.restSeconds}s</p>{exercise.sets.map((trainingSet, setIndex) => <div className="set" key={trainingSet.id}><b>{setIndex + 1}</b><input aria-label="Carga" type="number" value={trainingSet.load} onChange={event => { trainingSet.load = Number(event.target.value); setSession({ ...session }); }} /><span>kg ×</span><input aria-label="Repetições" type="number" value={trainingSet.reps} onChange={event => { trainingSet.reps = Number(event.target.value); setSession({ ...session }); }} />{trainingSet.completed ? <Check className="success" /> : <Button onClick={() => complete(exerciseIndex, setIndex)}>CONCLUIR</Button>}</div>)}<button className="text-button" onClick={() => { exercise.sets.push({ id: crypto.randomUUID(), load: 0, reps: exercise.target.repsMin, completed: false, volume: 0 }); setSession({ ...session }); }}><Plus size={16} /> Adicionar série</button></Card>)}<Button className="finish" onClick={finish}>FINALIZAR TREINO</Button></AppShell>;
}

export default function Training() { return <Guard><Work /></Guard>; }
