// Barramento de eventos simples: desacopla lógica (sistemas) e interface (ui).
const ouvintes = new Map();

export const bus = {
  /** Registra um ouvinte; devolve função para cancelar. */
  on(evento, fn) {
    if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
    ouvintes.get(evento).add(fn);
    return () => bus.off(evento, fn);
  },
  off(evento, fn) {
    ouvintes.get(evento)?.delete(fn);
  },
  /** Dispara o evento; erros de um ouvinte não impedem os demais. */
  emit(evento, dados) {
    for (const fn of [...(ouvintes.get(evento) ?? [])]) {
      try { fn(dados); } catch (e) { console.error(`[eventBus] erro em "${evento}":`, e); }
    }
  },
  /** Remove todos os ouvintes (uso em testes). */
  limpar() { ouvintes.clear(); },
};
