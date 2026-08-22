"use client";

import { timestampDate } from "@/lib/training-analytics";
import type { WorkoutSession } from "@/types";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const toISODate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export function TrainingCalendar({ month, sessions, loading, onPrevMonth, onNextMonth, onClose }: {
  month: Date;
  sessions: WorkoutSession[];
  loading: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onClose: () => void;
}) {
  const trainedDays = new Map<string, number>();
  for (const session of sessions) {
    if (session.status !== "completed") continue;
    const key = toISODate(timestampDate(session.startedAt));
    trainedDays.set(key, (trainedDays.get(key) ?? 0) + 1);
  }

  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const todayKey = toISODate(new Date());
  const cells = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="method-dialog training-calendar" role="dialog" aria-modal="true" aria-labelledby="training-calendar-title">
      <header><div><p className="eyebrow">CALENDÁRIO DE TREINOS</p><h2 id="training-calendar-title">Dias treinados</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X/></button></header>
      <div className="training-calendar-nav">
        <button type="button" className="icon-button" onClick={onPrevMonth} aria-label="Mês anterior"><ChevronLeft size={18}/></button>
        <strong>{MONTH_LABEL.format(month).replace(/^./, (letter) => letter.toUpperCase())}</strong>
        <button type="button" className="icon-button" onClick={onNextMonth} aria-label="Próximo mês"><ChevronRight size={18}/></button>
      </div>
      <div className="training-calendar-weekdays">{WEEKDAY_LABELS.map((label, index) => <span key={index}>{label}</span>)}</div>
      <div className="training-calendar-grid" aria-busy={loading}>
        {cells.map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} className="training-calendar-cell is-blank"/>;
          const key = toISODate(new Date(month.getFullYear(), month.getMonth(), day));
          const count = trainedDays.get(key) ?? 0;
          return <span key={key} className={`training-calendar-cell ${count ? "is-trained" : ""} ${key === todayKey ? "is-today" : ""}`} title={count ? `${count} treino${count === 1 ? "" : "s"} concluído${count === 1 ? "" : "s"}` : undefined}>
            {day}
            {count > 0 && <i aria-hidden="true"/>}
          </span>;
        })}
      </div>
      <p className="training-calendar-legend"><i aria-hidden="true"/> Dia com treino concluído</p>
    </section>
  </div>;
}
