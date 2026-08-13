"use client";

import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { Button, Card, Empty, Loading } from "@/components/ui";
import { useAuth } from "@/components/providers";
import { formatDateBR, parseBrazilianNumber } from "@/lib/utils";
import { weights } from "@/services/data";
import type { BodyWeight } from "@/types";
import { useEffect, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function Evolution() {
  const { user } = useAuth();
  const uid = user?.uid; const [items, setItems] = useState<BodyWeight[]>([]);
  const [editing, setEditing] = useState<BodyWeight | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reload = async () => { if (uid) setItems(await weights.list(uid)); };
  useEffect(() => { if (uid) weights.list(uid).then(setItems); }, [uid]);
  if (!uid) return <Loading />;
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const current = sorted.at(-1); const first = sorted[0]; const previous = sorted.at(-2);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const weight = parseBrazilianNumber(String(form.get("weight"))); setError("");
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1000) { setError("Informe um peso válido."); return; }
    const data = { date: String(form.get("date")), weight, note: String(form.get("note")).trim() || undefined };
    try { if (editing) await weights.update(editing.id, data); else await weights.save({ ownerId: uid!, ...data }); setMessage(editing ? "Peso atualizado com sucesso." : "Peso registrado com sucesso."); setFormOpen(false); setEditing(null); await reload(); } catch { setError("Não foi possível salvar. Tente novamente."); }
  }
  return <AppShell><header><p className="eyebrow">EVOLUÇÃO</p><h1>Seu progresso em dados.</h1><Button onClick={() => { setEditing(null); setFormOpen(true); }}>+ REGISTRAR PESO</Button></header>
    {message && <p className="success">{message}</p>}
    {formOpen && <Card><h2>{editing ? "Editar pesagem" : "Registrar peso"}</h2><form onSubmit={save}><label>Peso (kg)<input required name="weight" inputMode="decimal" defaultValue={editing?.weight} placeholder="Ex.: 91,5" /></label><label>Data<input required name="date" type="date" defaultValue={editing?.date ?? new Date().toISOString().slice(0, 10)} /></label><label>Observação<textarea name="note" defaultValue={editing?.note} /></label>{error && <p className="error">{error}</p>}<Button>SALVAR PESO</Button><button type="button" className="text-button" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancelar</button></form></Card>}
    <div className="stat-grid"><Card><span>Peso atual</span><strong>{current ? `${current.weight.toLocaleString("pt-BR")} kg` : "—"}</strong></Card><Card><span>Peso inicial</span><strong>{first ? `${first.weight.toLocaleString("pt-BR")} kg` : "—"}</strong></Card><Card><span>Variação total</span><strong>{current && first ? `${(current.weight - first.weight).toFixed(1)} kg` : "—"}</strong></Card><Card><span>Registros</span><strong>{items.length}</strong></Card></div>
    {current && previous && <p className="muted">Última alteração: {(current.weight - previous.weight).toFixed(1)} kg</p>}
    <Card className="chart"><h2>Peso corporal</h2>{items.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={sorted}><XAxis dataKey="date" tickFormatter={formatDateBR} /><YAxis domain={["auto", "auto"]} /><Tooltip labelFormatter={value => formatDateBR(String(value))} formatter={value => [`${Number(value).toLocaleString("pt-BR")} kg`, "Peso"]} /><Line type="monotone" dataKey="weight" stroke="#a78bfa" strokeWidth={3} /></LineChart></ResponsiveContainer> : <Empty title="Você ainda não registrou seu peso." detail="Registre sua primeira pesagem para acompanhar sua evolução." />}</Card>
    <Card><h2>Histórico de peso</h2>{[...sorted].reverse().length ? [...sorted].reverse().map(item => <div className="row" key={item.id}><div><strong>{item.weight.toLocaleString("pt-BR")} kg</strong><small>{formatDateBR(item.date)}{item.note ? ` · ${item.note}` : ""}</small></div><span><button className="text-button" onClick={() => { setEditing(item); setFormOpen(true); }}>Editar</button><button className="text-button" onClick={async () => { if (confirm(`Excluir esta pesagem?\n${item.weight} kg · ${formatDateBR(item.date)}`)) { await weights.remove(item.id); await reload(); } }}>Excluir</button></span></div>) : <Empty title="Sem histórico de peso" detail="Use Registrar peso para criar seu primeiro lançamento." />}</Card>
  </AppShell>;
}
export default function Page() { return <Guard><Evolution /></Guard>; }
