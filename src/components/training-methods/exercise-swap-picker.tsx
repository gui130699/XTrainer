"use client";
import { Search, Star, X } from "lucide-react";
import { useMemo, useState } from "react";
import { normalizeSearchText } from "@/lib/utils";
import type { Exercise } from "@/types";

export function ExerciseSwapPicker({ library, excludeId, preferredIds = [], onSelect, onTogglePreferred, onClose }: {
  library: Exercise[];
  excludeId: string;
  preferredIds?: string[];
  onSelect: (exercise: Exercise) => void;
  onTogglePreferred?: (exerciseId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const activeLibrary = useMemo(() => library.filter((item) => item.active && item.id !== excludeId), [library, excludeId]);
  const preferred = useMemo(() => preferredIds.map((id) => activeLibrary.find((item) => item.id === id)).filter((item): item is Exercise => Boolean(item)), [preferredIds, activeLibrary]);
  const visible = useMemo(
    () => activeLibrary.filter((item) => !search || normalizeSearchText(`${item.name} ${item.nameEn ?? ""} ${item.muscleGroup}`).includes(normalizeSearchText(search))),
    [activeLibrary, search],
  );
  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="method-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-dialog-title">
      <header>
        <div><p className="eyebrow">TROCAR EXERCÍCIO</p><h2 id="swap-dialog-title">Escolha o substituto</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X/></button>
      </header>

      {preferred.length > 0 && !search && <div className="swap-preferred-section">
        <span className="swap-section-label">ALTERNATIVAS PREFERIDAS</span>
        <div className="method-options">{preferred.map((item) => <button type="button" key={item.id} onClick={() => onSelect(item)}>
          <span><Star size={11} fill="currentColor"/> {item.muscleGroup}</span>
          <strong>{item.name}</strong>
        </button>)}</div>
      </div>}

      <div className="method-filters swap-filters">
        <label><span className="search-input"><Search size={16}/><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar exercício"/></span></label>
      </div>
      <span className="swap-section-label">TODOS OS EXERCÍCIOS</span>
      <div className="method-options">
        {visible.slice(0, 60).map((item) => <div className="swap-option-row" key={item.id}>
          <button type="button" onClick={() => onSelect(item)}>
            <span>{item.muscleGroup}</span>
            <strong>{item.name}</strong>
          </button>
          {onTogglePreferred && <button type="button" className={`swap-favorite-toggle ${preferredIds.includes(item.id) ? "is-active" : ""}`} onClick={() => onTogglePreferred(item.id)} aria-label={preferredIds.includes(item.id) ? `Remover ${item.name} das alternativas preferidas` : `Adicionar ${item.name} às alternativas preferidas`} aria-pressed={preferredIds.includes(item.id)}>
            <Star size={16} fill={preferredIds.includes(item.id) ? "currentColor" : "none"}/>
          </button>}
        </div>)}
      </div>
      {!visible.length && <p>Nenhum exercício encontrado.</p>}
    </section>
  </div>;
}
