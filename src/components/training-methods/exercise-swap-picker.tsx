"use client";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { normalizeSearchText } from "@/lib/utils";
import type { Exercise } from "@/types";

export function ExerciseSwapPicker({ library, excludeId, onSelect, onClose }: { library: Exercise[]; excludeId: string; onSelect: (exercise: Exercise) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const visible = useMemo(
    () => library
      .filter((item) => item.active && item.id !== excludeId)
      .filter((item) => !search || normalizeSearchText(`${item.name} ${item.nameEn ?? ""} ${item.muscleGroup}`).includes(normalizeSearchText(search))),
    [library, excludeId, search],
  );
  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="method-dialog" role="dialog" aria-modal="true" aria-labelledby="swap-dialog-title">
      <header>
        <div><p className="eyebrow">TROCAR EXERCÍCIO</p><h2 id="swap-dialog-title">Escolha o substituto</h2></div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X/></button>
      </header>
      <div className="method-filters swap-filters">
        <label><span className="search-input"><Search size={16}/><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar exercício"/></span></label>
      </div>
      <div className="method-options">
        {visible.slice(0, 60).map((item) => <button type="button" key={item.id} onClick={() => onSelect(item)}>
          <span>{item.muscleGroup}</span>
          <strong>{item.name}</strong>
        </button>)}
      </div>
      {!visible.length && <p>Nenhum exercício encontrado.</p>}
    </section>
  </div>;
}
