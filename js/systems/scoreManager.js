// Aplicação de impactos, limites dos indicadores, derrota, histórico e pontuação final.
import { CONFIG, INDICADORES } from "../core/gameConfig.js";
import { getState } from "../core/gameState.js";
import { bus } from "../core/eventBus.js";

const MOTIVOS_DERROTA = {
  financeiro: "O caixa chegou a zero: a empresa faliu.",
  clientes: "A confiança dos clientes chegou a zero: a carteira desapareceu.",
  equipe: "O engajamento da equipe chegou a zero: a equipe abandonou a empresa.",
  operacao: "A operação chegou a zero: a produção parou por completo.",
};

const limitar = (v) => Math.min(CONFIG.limitePontos.max, Math.max(CONFIG.limitePontos.min, v));

/** Retorna { indicador, motivo } se alguma condição de derrota foi atingida; senão null. */
export function verificarDerrota(ind) {
  for (const k of INDICADORES) if (ind[k] <= 0) return { indicador: k, motivo: MOTIVOS_DERROTA[k] };
  return null;
}

/** Quantidade de indicadores que terminaram em valor igual ou superior ao inicial. */
export function indicadoresPreservados(ind) {
  return INDICADORES.filter((k) => ind[k] >= CONFIG.indicadoresIniciais[k]).length;
}

/**
 * Pontuação (0 a 1000), documentada no README:
 *  1000 x média de [caixa / (2 x caixa inicial) (teto 1), clientes / 100, equipe / 100, operação / 100].
 *  Os valores iniciais (100.000 / 50 / 50 / 50) valem 500. Se a partida termina em derrota,
 *  a pontuação é multiplicada por CONFIG.pontuacao.penalidadeDerrota.
 */
export function calcularPontuacao(e) {
  const P = CONFIG.pontuacao;
  const ind = e.indicadores;
  const norm = (v, max) => Math.min(Math.max(v, 0) / max, 1);
  const soma = norm(ind.financeiro, CONFIG.indicadoresIniciais.financeiro * P.financeiroMultiploTeto)
    + norm(ind.clientes, CONFIG.limitePontos.max)
    + norm(ind.equipe, CONFIG.limitePontos.max)
    + norm(ind.operacao, CONFIG.limitePontos.max);
  let base = 1000 * soma / 4;
  if (e.status === "encerrada" && !e.resultado?.concluiu) base *= P.penalidadeDerrota;
  return Math.round(base);
}

/**
 * Aplica os impactos UMA ÚNICA VEZ por `eventoId` (idempotente).
 * `opcoes.salvar=false` adia o evento de salvamento (o chamador salva depois).
 */
export function aplicarImpactos(eventoId, impactos, registro = {}, opcoes = {}) {
  const e = getState();
  if (e.appliedEvents.includes(eventoId)) return { duplicado: true };
  for (const k of INDICADORES) {
    if (!Number.isFinite(impactos[k] ?? 0)) throw new Error(`Impacto inválido em ${k}`);
  }
  const antes = { ...e.indicadores };
  const efetivos = {};
  const nominais = {};
  let limitado = false;
  for (const k of INDICADORES) {
    const nominal = Math.round(impactos[k] ?? 0);
    const novo = k === "financeiro" ? antes[k] + nominal : limitar(antes[k] + nominal);
    nominais[k] = nominal;
    efetivos[k] = novo - antes[k];
    if (efetivos[k] !== nominal) limitado = true;
    e.indicadores[k] = novo;
  }
  e.appliedEvents.push(eventoId);
  e.pontuacao = calcularPontuacao(e);
  const derrota = verificarDerrota(e.indicadores);
  const resultado = { eventoId, antes, depois: { ...e.indicadores }, nominais, efetivos, limitado, derrota };
  e.historico.push({
    ...registro, eventoId, nominais, efetivos,
    depois: { ...e.indicadores }, quando: new Date().toISOString(),
  });
  bus.emit("score:atualizado", resultado);
  if (opcoes.salvar !== false) bus.emit("estado:alterado", { motivo: "impactos" });
  return resultado;
}
