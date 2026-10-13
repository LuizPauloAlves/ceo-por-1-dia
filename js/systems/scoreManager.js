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
 * Pontuação final (0 a 1000), documentada no README:
 *  - Clientes, equipe e operação: valor x 2 (até 200 cada);
 *  - Financeiro: proporcional ao caixa, com teto em 2x o capital inicial (até 200);
 *  - 3 pontos por atividade normal concluída (até 60);
 *  - 8 pontos por emergência resolvida no prazo (até 40);
 *  - +100 pela conclusão integral da partida.
 */
export function calcularPontuacao(e) {
  const P = CONFIG.pontuacao;
  const ind = e.indicadores;
  const fin = Math.min(Math.max(ind.financeiro, 0) / (CONFIG.indicadoresIniciais.financeiro * P.financeiroMultiploTeto), 1) * P.financeiroMax;
  const pts = (ind.clientes + ind.equipe + ind.operacao) * P.pesoIndicadorPontos;
  const base = fin + pts
    + e.progresso.normaisConcluidas * P.porAtividade
    + e.progresso.emergenciasNoPrazo * P.porEmergenciaNoPrazo
    + (e.resultado?.concluiu ? P.bonusConclusao : 0);
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
