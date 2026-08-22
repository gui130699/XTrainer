"use client";

import { AppShell } from "@/components/app-shell";
import { Guard } from "@/components/guard";
import { Card, Empty, ErrorState, Loading } from "@/components/ui";
import { analyzeSubstanceReferenceOverlap, RISK_TAG_LABELS } from "@/lib/substance-analysis";
import { dataErrorMessage, normalizeSearchText } from "@/lib/utils";
import { substanceReferences } from "@/services/substance-reference";
import type { SubstanceReference } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";

function Reference() {
  const [items, setItems] = useState<SubstanceReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems((await substanceReferences.list()).filter((item) => item.active));
    } catch (reason) {
      setError(dataErrorMessage(reason, "Não foi possível carregar a referência de substâncias."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => items.filter((item) => {
    const query = normalizeSearchText(search);
    return !query || normalizeSearchText(`${item.name} ${item.canonicalName ?? ""} ${(item.aliases ?? []).join(" ")}`).includes(query);
  }), [items, search]);
  const selected = items.find((item) => item.id === selectedId);
  const compareItems = items.filter((item) => compareIds.includes(item.id));
  const overlaps = useMemo(() => analyzeSubstanceReferenceOverlap(compareItems), [compareItems]);

  function toggleCompare(id: string) {
    setCompareIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  }

  return <AppShell><header><p className="eyebrow">REFERÊNCIA DE SUBSTÂNCIAS</p><h1>Biblioteca educativa.</h1><p>Conteúdo informativo mantido pela administração. Não indica dose, intervalo, ciclo, combinação ou uso recomendado.</p></header>
    {error && <ErrorState message={error} onRetry={() => void load()}/>} {loading ? <Loading/> : <>
      <Card><label><span className="sr-only">Pesquisar substância</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, nome canônico ou alias"/></label></Card>

      {compareIds.length > 1 && <Card><h2>Riscos compartilhados</h2><p className="muted">Mostra apenas categorias de risco presentes em mais de uma das substâncias selecionadas. Não é uma avaliação de segurança nem uma recomendação de uso conjunto.</p>{overlaps.length ? overlaps.map((overlap) => <div className="row" key={overlap.tag}><strong>{RISK_TAG_LABELS[overlap.tag]}</strong><span>{overlap.count} substâncias</span></div>) : <Empty title="Nenhum risco compartilhado identificado" detail="As substâncias selecionadas não têm categorias de risco em comum no catálogo."/>}</Card>}

      <div className="split">
        <Card><h2>Substâncias</h2>{filtered.map((item) => <div className="row substance-row" key={item.id}><label className="check-label"><input type="checkbox" checked={compareIds.includes(item.id)} onChange={() => toggleCompare(item.id)} aria-label={`Comparar ${item.name}`}/></label><button type="button" className={`substance-select ${selectedId === item.id ? "active" : ""}`} onClick={() => setSelectedId(item.id)}><strong>{item.name}</strong><small>{item.class ?? "—"}{item.aliases?.length ? ` · ${item.aliases.join(", ")}` : ""}</small></button></div>)}{!filtered.length && <Empty title="Nenhuma substância encontrada" detail="Ajuste a pesquisa."/>}</Card>

        {selected ? <Card><h2>{selected.name}</h2>{selected.canonicalName && selected.canonicalName !== selected.name && <p className="muted">Nome canônico: {selected.canonicalName}</p>}{selected.class && <p className="muted">Classe: {selected.class}</p>}
          <h3>Descrição</h3><p>{selected.description}</p>
          {selected.mechanismSummary && <><h3>Mecanismo/função geral</h3><p>{selected.mechanismSummary}</p></>}
          {selected.medicalUseSummary && <><h3>Uso médico/histórico</h3><p>{selected.medicalUseSummary}</p></>}
          <h3>Categorias de risco conhecidas</h3>{selected.riskTags.length ? <div className="risk-tag-list">{selected.riskTags.map((tag) => <span className="risk-tag-chip" key={tag}>{RISK_TAG_LABELS[tag]}</span>)}</div> : <p className="muted">Nenhuma categoria registrada.</p>}
          {selected.sources?.length ? <><h3>Fontes</h3><ul>{selected.sources.map((source, index) => <li key={index}>{source}</li>)}</ul></> : null}
        </Card> : <Card><Empty title="Selecione uma substância" detail="Clique em um item da lista para ver os detalhes educativos."/></Card>}
      </div>
    </>}
  </AppShell>;
}

export default function Page() { return <Guard><Reference/></Guard>; }
