// Controle do avanço da partida: contagem de atividades/emergências e condição de conclusão.
import { CONFIG } from "../core/gameConfig.js";

/** Metas reais da partida: nunca maiores que o conteúdo disponível (sem repetir perguntas). */
export function calcularMetas(catalogo) {
  return {
    normais: Math.min(CONFIG.meta.atividadesNormais, catalogo.atividades.length),
    emergencias: Math.min(CONFIG.meta.emergencias, catalogo.emergencias.length),
  };
}

export const numeroPergunta = (e) => e.progresso.normaisConcluidas + 1;
export const normaisCompletas = (e) => e.progresso.normaisConcluidas >= e.metas.normais;
export const emergenciasCompletas = (e) => e.progresso.emergenciasConcluidas >= e.metas.emergencias;
export const emergenciasRestantes = (e) => Math.max(0, e.metas.emergencias - e.progresso.emergenciasConcluidas);

/** Conclusão integral: todas as atividades normais e todas as emergências resolvidas. */
export function concluiu(e) {
  return normaisCompletas(e) && emergenciasCompletas(e) && !e.atual && !e.emergenciaAtual;
}

export function registrarNormalConcluida(e) { e.progresso.normaisConcluidas += 1; }

export function registrarEmergenciaConcluida(e, expirada) {
  e.progresso.emergenciasConcluidas += 1;
  if (expirada) e.progresso.emergenciasExpiradas += 1; else e.progresso.emergenciasNoPrazo += 1;
}
