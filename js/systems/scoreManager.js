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
 * Converte os indicadores para a escala 0–100 usada na pontuação.
 *  - caixa: R$ 100.000 = 50 pontos, R$ 200.000 = 100 pontos (proporcional; teto 100, piso 0);
 *  - clientes, equipe e operação: já estão em 0–100.
 */
export function indicadoresNormalizados(ind) {
  const P = CONFIG.pontuacao;
  const faixa = (v) => Math.min(100, Math.max(0, v));
  return {
    financeiro: faixa((ind.financeiro / P.caixaParaCemPontos) * 100),
    clientes: faixa(ind.clientes),
    equipe: faixa(ind.equipe),
    operacao: faixa(ind.operacao),
  };
}

/**
 * Pontuação (0 a 1000), documentada no README:
 *   pontuação = 10 x [ 80% x média geométrica + 20% x média aritmética ] dos quatro indicadores em 0–100.
 *  - A média geométrica premia o equilíbrio: um indicador fraco puxa o resultado para baixo e
 *    um indicador zerado (derrota) anula essa parte; os 20% aritméticos preservam o que foi construído.
 *  - Estado inicial (100.000 / 50 / 50 / 50) = 500. Tudo no máximo (200.000 / 100 / 100 / 100) = 1000.
 */
export function calcularPontuacao(e) {
  const P = CONFIG.pontuacao;
  const n = Object.values(indicadoresNormalizados(e.indicadores));
  const aritmetica = n.reduce((t, v) => t + v, 0) / n.length;
  const geometrica = n.some((v) => v <= 0) ? 0 : Math.exp(n.reduce((t, v) => t + Math.log(v), 0) / n.length);
  return Math.round(10 * (P.pesoGeometrica * geometrica + P.pesoAritmetica * aritmetica));
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
