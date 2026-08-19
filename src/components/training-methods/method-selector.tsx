"use client";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { TRAINING_METHOD_CATEGORY_LABELS } from "@/lib/training-methods";
import { normalizeSearchText } from "@/lib/utils";
import type { TrainingMethod } from "@/types";

export function MethodSelector({ methods, currentId, groupOnly = false, onSelect, onClose }: { methods: TrainingMethod[]; currentId?: string; groupOnly?: boolean; onSelect: (method: TrainingMethod) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const visible = useMemo(() => methods.filter((item) => item.active && (groupOnly ? item.engine === "group" : item.engine !== "group")).filter((item) => !category || item.category === category).filter((item) => normalizeSearchText(`${item.name} ${item.shortDescription}`).includes(normalizeSearchText(search))), [methods, search, category, groupOnly]);
  return <div className="method-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="method-dialog" role="dialog" aria-modal="true" aria-labelledby="method-dialog-title"><header><div><p className="eyebrow">MÉTODO DE TREINO</p><h2 id="method-dialog-title">Escolha como executar</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X/></button></header><div className="method-filters"><label><span className="search-input"><Search size={16}/><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar método"/></span></label><label><span className="sr-only">Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas as categorias</option>{Object.entries(TRAINING_METHOD_CATEGORY_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><div className="method-options">{visible.map((method) => <button type="button" className={method.id === currentId ? "selected" : ""} key={method.id} onClick={() => onSelect(method)}><span>{TRAINING_METHOD_CATEGORY_LABELS[method.category]}</span><strong>{method.name}</strong><small>{method.shortDescription}</small></button>)}</div>{!visible.length && <p>Nenhum método ativo encontrado.</p>}</section></div>;
}

