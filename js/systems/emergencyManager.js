// Regras de emergências: gatilhos A/B/C, seleção, prioridade, resposta e expiração.
// Não toca na interface nem no cronômetro de tela; o engine conecta as peças.
import { CONFIG } from "../core/gameConfig.js";
import { getState } from "../core/gameState.js";
import { bus } from "../core/eventBus.js";
import { rand, escolher } from "../utils/random.js";
import { embaralhar } from "./answerShuffler.js";
import { sortearImpactos, sortearVariaveis, renderizarTexto } from "./variableGenerator.js";
import { aplicarImpactos } from "./scoreManager.js";
import { registrarEmergenciaConcluida } from "./gameProgress.js";

const E = CONFIG.emergencia;

/** Só a partir da 3ª atividade normal respondida, uma por vez, até a meta. */
export function emergenciasHabilitadas(e = getState()) {
  return e.status === "jogando"
    && e.progresso.normaisConcluidas >= E.habilitarAposNormais
    && !e.emergenciaAtual
    && e.usadas.emergencias.length < e.metas.emergencias;
}

/** Zera os três mecanismos (após cada emergência surgir/ser resolvida). */
function zerarContadores(e) {
  e.relogio = { semEmergenciaMs: 0, sorteioMs: 0, agendadaRestanteMs: null, normaisDesdeUltima: 0 };
}

/** Mecanismo C: chamado a cada atividade normal concluída. */
export function registrarNormalConcluida() {
  const e = getState();
  e.relogio.normaisDesdeUltima += 1;
  if (emergenciasHabilitadas(e) && e.relogio.normaisDesdeUltima >= E.normaisParaAgendar && e.relogio.agendadaRestanteMs === null) {
    e.relogio.agendadaRestanteMs = E.atrasoAgendadaSeg * 1000;
  }
}

/**
 * Avança os contadores em `deltaMs` de TEMPO ELEGÍVEL e dispara no máximo UMA emergência.
 * Prioridade: B (tempo máximo) > C (agendada) > A (sorteio).
 * Devolve o motivo ("tempo_maximo" | "perguntas" | "sorteio") ou null.
 */
export function tick(catalogo, deltaMs) {
  const e = getState();
  if (!emergenciasHabilitadas(e) || deltaMs <= 0) return null;
  const r = e.relogio;
  r.semEmergenciaMs += deltaMs;
  if (r.agendadaRestanteMs === null && r.normaisDesdeUltima >= E.normaisParaAgendar) r.agendadaRestanteMs = E.atrasoAgendadaSeg * 1000;
  if (r.agendadaRestanteMs !== null) r.agendadaRestanteMs -= deltaMs;
  r.sorteioMs += deltaMs;

  if (r.semEmergenciaMs >= E.tempoMaximoSemEmergenciaSeg * 1000) return disparar(catalogo, "tempo_maximo");
  if (r.agendadaRestanteMs !== null && r.agendadaRestanteMs <= 0) return disparar(catalogo, "perguntas");
  const intervalo = E.sorteioIntervaloSeg * 1000;
  while (r.sorteioMs >= intervalo) {
    r.sorteioMs -= intervalo;
    if (rand() < E.sorteioProbabilidade) return disparar(catalogo, "sorteio");
  }
  return null;
}

/**
 * Avanço do relógio de simulação (tela de espera): roda os mesmos gatilhos, em passos fixos,
 * até surgir a próxima emergência. Não cria extras.
 */
export function avancarRelogioSimulado(catalogo) {
  const passo = 1000;
  for (let t = 0; t < E.limiteAvancoSimuladoSeg * 1000; t += passo) {
    const motivo = tick(catalogo, passo);
    if (motivo) return motivo;
    if (!emergenciasHabilitadas()) return null;
  }
  return null;
}

/** Cria a emergência atual (guarda contra disparo duplo/simultâneo). */
export function disparar(catalogo, motivo, agora = Date.now()) {
  const e = getState();
  if (!emergenciasHabilitadas(e)) return null;
  const usadas = new Set(e.usadas.emergencias);
  const item = escolher(catalogo.emergencias.filter((x) => !usadas.has(x.id)));
  if (!item) return null;

  const evento = sortearVariaveis(item.variaveisEvento);
  const r = (t) => renderizarTexto(t, { evento });
  e.usadas.emergencias.push(item.id);
  e.emergenciaAtual = {
    tipo: "emergencia",
    emergenciaId: item.id,
    numero: e.usadas.emergencias.length,
    categoria: item.categoria,
    titulo: r(item.titulo),
    situacao: r(item.situacao),
    pergunta: r(item.pergunta),
    evento,
    piorAlternativaId: item.piorAlternativaId,
    motivoTimeout: item.motivoTimeout,
    motivoDisparo: motivo,
    iniciadaEm: agora,
    duracaoMs: E.duracaoSegundos * 1000,
    expiraEm: agora + E.duracaoSegundos * 1000,
    alternativas: embaralhar(item.alternativas).map((a) => ({
      id: a.id, letra: a.letra, texto: r(a.texto), impactos: sortearImpactos(a.impactos),
    })),
    estado: "aguardando",
    escolhaId: null,
    motivoEncerramento: null,
    resultado: null,
  };
  zerarContadores(e);
  bus.emit("emergencia:disparada", { motivo, id: item.id });
  return motivo;
}

function encerrar(motivoEncerramento, altId) {
  const e = getState();
  const em = e.emergenciaAtual;
  const alt = em.alternativas.find((a) => a.id === altId);
  em.estado = "feedback";
  em.escolhaId = alt.id;
  em.motivoEncerramento = motivoEncerramento;
  em.resultado = aplicarImpactos(`e:${em.emergenciaId}`, alt.impactos, {
    tipo: "emergencia", refId: em.emergenciaId, titulo: em.titulo,
    escolha: alt.texto, motivoEncerramento,
  }, { salvar: false });
  registrarEmergenciaConcluida(e, motivoEncerramento === "tempo_esgotado");
  zerarContadores(e);
  return em.resultado;
}

/** Aplica a pior alternativa (definida pelo JSON) uma única vez. */
export function expirarEmergencia() {
  const em = getState().emergenciaAtual;
  if (!em || em.estado !== "aguardando") return { ignorado: true };
  return { ok: true, resultado: encerrar("tempo_esgotado", em.piorAlternativaId) };
}

/**
 * Registra a resposta do jogador. Se o prazo já venceu (inclusive no instante do clique),
 * o tempo esgotado prevalece. Respostas repetidas são ignoradas.
 */
export function responderEmergencia(altId, agora = Date.now()) {
  const em = getState().emergenciaAtual;
  if (!em || em.estado !== "aguardando") return { ignorado: true };
  if (agora >= em.expiraEm) return expirarEmergencia();
  if (!em.alternativas.some((a) => a.id === altId)) return { ignorado: true };
  return { ok: true, resultado: encerrar("resposta", altId) };
}

/** Remove a emergência já resolvida (após o jogador ver o feedback). */
export function liberarEmergencia() {
  const e = getState();
  if (e.emergenciaAtual?.estado === "feedback") e.emergenciaAtual = null;
}
