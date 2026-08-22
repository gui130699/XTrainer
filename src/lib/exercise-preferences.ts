// Regras puras de edição da lista de alternativas preferidas de um exercício, testáveis sem
// Firebase. A ordem da lista é a prioridade de exibição no seletor de troca.

export function addAlternative(current: string[], exerciseId: string, candidateId: string): string[] {
  if (candidateId === exerciseId || current.includes(candidateId)) return current;
  return [...current, candidateId];
}

export function removeAlternative(current: string[], candidateId: string): string[] {
  return current.filter((id) => id !== candidateId);
}

export function moveAlternative(current: string[], candidateId: string, direction: -1 | 1): string[] {
  const index = current.indexOf(candidateId);
  const destination = index + direction;
  if (index < 0 || destination < 0 || destination >= current.length) return current;
  const next = [...current];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}
