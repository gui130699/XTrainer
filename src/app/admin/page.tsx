"use client";

import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { Button, Card, Empty } from "@/components/ui";
import { useAuth } from "@/components/providers";
import { muscleGroups } from "@/lib/utils";
import { exercises, weights, workouts } from "@/services/data";
import type { Exercise, Workout } from "@/types";
import { useEffect, useState } from "react";

function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"exercises" | "workouts" | "weight">("exercises");
  const [exerciseList, setExerciseList] = useState<Exercise[]>([]);
  const [workoutList, setWorkoutList] = useState<Workout[]>([]);
  const [saved, setSaved] = useState("");
  const reload = () => { if (user) { exercises.list().then(setExerciseList); workouts.list(user.uid).then(setWorkoutList); } };
  useEffect(reload, [user]);
  if (!user) return null;

  return <AppShell><header><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Configure seu XTrainer.</h1></header>
    <div className="tabs">{(["exercises", "workouts", "weight"] as const).map(item => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item === "exercises" ? "Exercícios" : item === "workouts" ? "Treinos" : "Peso"}</button>)}</div>
    {saved && <p className="success">{saved}</p>}
    {tab === "exercises" && <>
      <Card><h2>Novo exercício</h2><form onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await exercises.save({ name: String(form.get("name")), muscleGroup: String(form.get("group")), equipment: String(form.get("equipment")) || undefined, videoUrl: String(form.get("video")) || undefined, description: String(form.get("description")) || undefined, active: true }); event.currentTarget.reset(); setSaved("Exercício salvo."); reload(); }}>
        <label>Nome<input name="name" required /></label><label>Grupo muscular<select name="group">{muscleGroups.map(group => <option key={group}>{group}</option>)}</select></label><label>Equipamento<input name="equipment" /></label><label>Vídeo<input name="video" type="url" placeholder="https://" /></label><label>Descrição<textarea name="description" /></label><Button>SALVAR EXERCÍCIO</Button>
      </form></Card>
      <Card><h2>Biblioteca</h2>{exerciseList.length ? exerciseList.map(exercise => <div className="row" key={exercise.id}><span><strong>{exercise.name}</strong><small>{exercise.muscleGroup}</small></span><button className="text-button" onClick={async () => { if (confirm(`Excluir ${exercise.name}?`)) { await exercises.remove(exercise.id); reload(); } }}>Excluir</button></div>) : <Empty title="Biblioteca vazia" detail="Cadastre os exercícios que você utiliza." />}</Card>
    </>}
    {tab === "workouts" && <>
      <Card><h2>Novo treino</h2><form onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await workouts.save({ ownerId: user.uid, name: String(form.get("name")), title: String(form.get("title")), description: String(form.get("description")) || undefined, muscleGroups: [], exercises: [], active: true }); event.currentTarget.reset(); setSaved("Treino criado."); reload(); }}>
        <label>Nome<input name="name" required placeholder="Treino A" /></label><label>Título<input name="title" required placeholder="Peitoral e tríceps" /></label><label>Descrição<textarea name="description" /></label><Button>CRIAR TREINO</Button>
      </form></Card>
      <Card><h2>Treinos ativos</h2>{workoutList.length ? workoutList.map(workout => <div className="row" key={workout.id}><span><strong>{workout.title}</strong><small>{workout.name} · {workout.exercises.length} exercícios</small></span></div>) : <Empty title="Sem treinos" detail="Crie sua divisão semanal." />}</Card>
    </>}
    {tab === "weight" && <Card><h2>Registrar peso</h2><form onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await weights.save({ ownerId: user.uid, date: String(form.get("date")), weight: Number(form.get("weight")), note: String(form.get("note")) || undefined }); event.currentTarget.reset(); setSaved("Peso registrado."); }}>
      <label>Data<input type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Peso (kg)<input type="number" name="weight" step="0.1" required /></label><label>Observação<textarea name="note" /></label><Button>SALVAR PESO</Button>
    </form></Card>}
  </AppShell>;
}

export default function Page() { return <Guard admin><Admin /></Guard>; }
