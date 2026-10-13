// Efeitos borboleta: agenda, restaura e apresenta os desdobramentos definidos nos JSON.
import { CONFIG } from "../core/gameConfig.js";
import { getState } from "../core/gameState.js";
import { embaralhar } from "./answerShuffler.js";
import { sortearImpacto, sortearImpactos, renderizarTexto } from "./variableGenerator.js";

/** Converte "dias depois" (JSON) em número de atividades normais, limitado por gameConfig. */
export function diasParaAtividades(dias) {
  const c = CONFIG.consequencias;
  return Math.min(c.maxAtividades, Math.max(c.minAtividades, Math.round(dias / c.diasPorAtividade)));
}

/** Agenda o efeito borboleta da alternativa escolhida (se existir nos dados). Idempotente. */
export function agendar(catalogo, instanciaNormal, altId) {
  const e = getState();
  const item = catalogo.atividadesPorId.get(instanciaNormal.problemaId);
  const alt = item?.alternativas.find((a) => a.id === altId);
  const eb = alt?.borboleta;
  if (!eb) return null;
  const eventoId = `c:${eb.id}`;
  const c = e.consequencias;
  if ([...c.pendentes, ...c.aplicadas, ...c.descartadas].some((x) => x.eventoId === eventoId)) return null;
  const dias = sortearImpacto(eb.dias);
  const pend = {
    eventoId, ebId: eb.id, problemaId: item.id, alternativaId: altId,
    origemTitulo: instanciaNormal.titulo,
    origemEscolha: instanciaNormal.alternativas.find((a) => a.id === altId)?.texto ?? "",
    caso: { ...instanciaNormal.caso },
    diasDepois: dias,
    agendadaEm: e.progresso.normaisConcluidas,
    venceAposNormais: e.progresso.normaisConcluidas + diasParaAtividades(dias),
  };
  c.pendentes.push(pend);
  return pend;
}

/** Próxima consequência vencida (menor prazo; empate pela ordem de agendamento) ou null. */
export function proximaVencida() {
  const e = getState();
  const vencidas = e.consequencias.pendentes
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.venceAposNormais <= e.progresso.normaisConcluidas)
    .sort((a, b) => a.p.venceAposNormais - b.p.venceAposNormais || a.i - b.i);
  return vencidas[0]?.p ?? null;
}

/** Cria a instância do dilema de segundo nível (valores sorteados e fixados agora). */
export function instanciar(catalogo, pend, empresa) {
  const e = getState();
  const item = catalogo.atividadesPorId.get(pend.problemaId);
  const eb = item.alternativas.find((a) => a.id === pend.alternativaId).borboleta;
  const ctx = { empresa, caso: pend.caso, estado_atual: { F_caixa_rs: e.indicadores.financeiro } };
  const r = (t) => renderizarTexto(t, ctx);
  return {
    tipo: "consequencia",
    ebId: eb.id,
    eventoId: pend.eventoId,
    problemaId: pend.problemaId,
    origemTitulo: pend.origemTitulo,
    origemEscolha: pend.origemEscolha,
    diasDepois: pend.diasDepois,
    titulo: `Desdobramento: ${pend.origemTitulo}`,
    situacao: r(eb.narrativa),
    pergunta: r(eb.novoDilema),
    alternativas: embaralhar(eb.alternativas).map((a) => ({
      id: a.id, letra: a.letra, texto: r(a.texto), impactos: sortearImpactos(a.impactos),
    })),
    estado: "aguardando",
  };
}

/** Move a consequência de pendente para aplicada (uma única vez). */
export function marcarAplicada(eventoId) {
  const c = getState().consequencias;
  const i = c.pendentes.findIndex((p) => p.eventoId === eventoId);
  if (i >= 0) c.aplicadas.push({ ...c.pendentes.splice(i, 1)[0], aplicadaEm: new Date().toISOString() });
}

/** Ao fim da partida, pendências que não chegaram a vencer são registradas como descartadas. */
export function descartarRestantes() {
  const c = getState().consequencias;
  if (c.pendentes.length) { c.descartadas.push(...c.pendentes); c.pendentes = []; }
}
