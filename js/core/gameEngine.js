// Coordena o fluxo geral da partida. Não manipula DOM: comunica-se com a interface por eventos.
//
// Eventos emitidos (bus):
//   dashboard:atualizar (estado)            tela:pergunta  { atual, estado, feedback, final }
//   tela:emergencia { em, estado, final }   tela:espera    { estado }
//   tela:resultado  { estado }              emergencia:tick { restanteMs, duracaoMs, faixa }
//   score:atualizado (resultado)            estado:alterado (salvar)
import { CONFIG } from "./gameConfig.js";
import { bus } from "./eventBus.js";
import { criarEstadoInicial, getState, setState, limparState } from "./gameState.js";
import { selecionarAtividade, instanciarAtividade } from "../systems/questionSelector.js";
import { aplicarImpactos, calcularPontuacao } from "../systems/scoreManager.js";
import * as Progresso from "../systems/gameProgress.js";
import * as Emerg from "../systems/emergencyManager.js";
import * as Conseq from "../systems/consequenceManager.js";
import { iniciarTimer, pararTimer, faixaAlerta } from "../systems/emergencyTimer.js";
import * as Save from "../systems/saveManager.js";
import * as Ranking from "../systems/rankingManager.js";
import { validarNickname } from "../utils/validators.js";

let catalogo = null;
let loop = null;
let ultimoTick = 0;
let ticksDesdeSalvar = 0;

export const obterEstado = () => getState();
export const obterCatalogo = () => catalogo;

/** Inicializa o motor com o catálogo carregado dos JSON. */
export function iniciarEngine(cat) {
  catalogo = cat;
  Save.iniciarAutoSave();
  if (globalThis.addEventListener) globalThis.addEventListener("pagehide", () => { if (getState()?.status === "jogando") Save.salvar(); Save.liberarControle(); });
}

const persistir = () => bus.emit("estado:alterado", { motivo: "engine" });

// ---------- Início / restauração / descarte ----------

/** Cria nova partida (substitui qualquer save atual). */
export function novaPartida(nickname, { forcar = false } = {}) {
  const nick = validarNickname(nickname);
  if (!nick.ok) return { ok: false, erro: nick.erro };
  if (!forcar && Save.outraAbaAtiva()) return { ok: false, erro: "Há outra aba com o jogo aberto. Feche-a ou assuma o controle.", outraAba: true };
  Save.assumirControle();
  setState(criarEstadoInicial(nick.valor, Progresso.calcularMetas(catalogo)));
  getState().pontuacao = calcularPontuacao(getState()); // estado inicial = 500 pontos
  const r = Save.salvar();
  iniciarLoop();
  mostrar();
  return { ok: true, avisoSave: r.ok ? null : r.erro };
}

/** Restaura a partida salva (pergunta, embaralhamento, valores e emergência em curso). */
export function continuarPartida({ forcar = false } = {}) {
  const s = Save.inspecionarSave();
  if (!s.existe) return { ok: false, erro: s.erro ?? "Nenhuma partida salva." };
  if (!forcar && Save.outraAbaAtiva()) return { ok: false, erro: "Esta partida está aberta em outra aba.", outraAba: true };
  Save.assumirControle();
  setState(s.estado);
  if (s.estado.status === "jogando") iniciarLoop();
  mostrar();
  return { ok: true };
}

/** Apaga a partida atual (usado por "novo jogo" e "voltar ao início"). */
export function descartarPartida() {
  pararLoop();
  pararTimer();
  Save.apagarSave();
  limparState();
}

// ---------- Loop de tempo elegível (emergências) ----------

function elegivel(e) {
  if (!e || e.status !== "jogando" || Save.abaBloqueada() || e.emergenciaAtual) return false;
  return e.atual ? e.atual.estado === "aguardando" : Progresso.normaisCompletas(e);
}

/** Soma `deltaMs` de tempo elegível e dispara emergência se algum gatilho vencer. */
export function processarTempo(deltaMs) {
  const e = getState();
  if (!elegivel(e)) return null;
  const motivo = Emerg.tick(catalogo, deltaMs);
  if (motivo) { persistir(); mostrar(); }
  return motivo;
}

function iniciarLoop() {
  pararLoop();
  ultimoTick = Date.now();
  loop = setInterval(() => {
    const agora = Date.now();
    const delta = Math.min(agora - ultimoTick, CONFIG.emergencia.maxDeltaTickMs);
    ultimoTick = agora;
    if (globalThis.document?.hidden) return; // tempo "ativo": não conta com a aba oculta
    processarTempo(delta);
    if (++ticksDesdeSalvar >= 5) { ticksDesdeSalvar = 0; if (elegivel(getState())) persistir(); }
  }, 1000);
  loop.unref?.();
}

function pararLoop() { if (loop) clearInterval(loop); loop = null; }

/** Botão da tela de espera: avança o relógio simulado até a próxima emergência. */
export function avancarRelogio() {
  const e = getState();
  if (!e || !elegivel(e) || e.atual) return { ok: false };
  const motivo = Emerg.avancarRelogioSimulado(catalogo);
  if (motivo) { persistir(); mostrar(); }
  return { ok: !!motivo, motivo };
}

// ---------- Fluxo principal ----------

/** Decide o que vem depois: desdobramento vencido > nova atividade > espera > conclusão. */
function prepararProximo() {
  const e = getState();
  const venc = Conseq.proximaVencida();
  if (venc) {
    e.atual = Conseq.instanciar(catalogo, venc, catalogo.empresa);
    persistir();
    return "atual";
  }
  if (!Progresso.normaisCompletas(e)) {
    const item = selecionarAtividade(catalogo, e.usadas.perguntas);
    if (item) {
      e.usadas.perguntas.push(item.id);
      e.atual = instanciarAtividade(item, { caixaAtual: e.indicadores.financeiro, empresa: catalogo.empresa, numero: Progresso.numeroPergunta(e) });
      persistir();
      return "atual";
    }
    e.metas.normais = e.progresso.normaisConcluidas; // sem conteúdo: nunca repete, encerra a meta
  }
  Conseq.descartarRestantes();
  if (Progresso.emergenciasCompletas(e)) { finalizar("concluida"); return "fim"; }
  persistir();
  return "espera";
}

/** Escolhe e emite a tela correta a partir do estado (usado também após F5). */
export function mostrar() {
  const e = getState();
  if (!e) return;
  bus.emit("dashboard:atualizar", e);

  const feedbackPendente = e.emergenciaAtual?.estado === "feedback" || e.atual?.estado === "feedback";
  if (e.status === "encerrada" && !feedbackPendente) { pararTimer(); bus.emit("tela:resultado", { estado: e }); return; }

  if (e.emergenciaAtual) { mostrarEmergencia(); return; }
  if (e.atual) { bus.emit("tela:pergunta", { atual: e.atual, estado: e, feedback: e.atual.estado === "feedback", final: e.status === "encerrada" }); return; }

  const r = prepararProximo();
  if (r === "fim") { mostrar(); return; }
  if (r === "atual") { bus.emit("tela:pergunta", { atual: e.atual, estado: e, feedback: false, final: false }); return; }
  bus.emit("tela:espera", { estado: e });
}

function mostrarEmergencia() {
  const e = getState();
  const em = e.emergenciaAtual;
  const final = e.status === "encerrada";
  bus.emit("tela:emergencia", { em, estado: e, final });
  if (em.estado !== "aguardando") { pararTimer(); return; }
  iniciarTimer(em.expiraEm, {
    onTick: (ms) => bus.emit("emergencia:tick", { restanteMs: ms, duracaoMs: em.duracaoMs, faixa: faixaAlerta(ms, em.duracaoMs) }),
    onExpirar: expirarEmergenciaAtual,
  });
}

function expirarEmergenciaAtual() {
  const r = Emerg.expirarEmergencia(); // idempotente: só aplica se ainda "aguardando"
  if (r.ignorado) return;
  posResposta(r.resultado);
}

/** Encerramento comum depois que impactos foram aplicados. */
function posResposta(resultado) {
  if (resultado.derrota) finalizar("derrota", resultado.derrota);
  persistir();
  mostrar();
  return { ok: true, resultado };
}

/**
 * Registra a resposta do jogador na emergência ou na atividade em exibição.
 * Cliques repetidos, abas sem controle e respostas após o fim são ignorados.
 */
export function responder(altId) {
  const e = getState();
  if (!e || e.status !== "jogando") return { ok: false, ignorado: true };
  if (Save.bloqueadaOuConflito()) return { ok: false, motivo: "aba" };

  if (e.emergenciaAtual) {
    const r = Emerg.responderEmergencia(altId, Date.now());
    if (r.ignorado) return { ok: false, ignorado: true };
    pararTimer();
    return posResposta(r.resultado);
  }

  const a = e.atual;
  if (!a || a.estado !== "aguardando") return { ok: false, ignorado: true };
  const alt = a.alternativas.find((x) => x.id === altId);
  if (!alt) return { ok: false, ignorado: true };

  a.estado = "feedback";
  a.escolhaId = alt.id;
  const eventoId = a.tipo === "normal" ? `n:${a.problemaId}` : a.eventoId;
  const res = aplicarImpactos(eventoId, alt.impactos, {
    tipo: a.tipo, refId: a.problemaId, titulo: a.titulo, escolha: alt.texto, numero: a.numero ?? null,
  }, { salvar: false });
  a.resultado = res;
  if (a.tipo === "normal") {
    Progresso.registrarNormalConcluida(e);
    Emerg.registrarNormalConcluida();
    a.agendouDesdobramento = !!Conseq.agendar(catalogo, a, alt.id);
  } else {
    Conseq.marcarAplicada(a.eventoId);
  }
  return posResposta(res);
}

/** Botão "continuar" depois do feedback. */
export function avancar() {
  const e = getState();
  if (!e || Save.bloqueadaOuConflito()) return { ok: false, motivo: "aba" };
  if (e.emergenciaAtual?.estado === "feedback") Emerg.liberarEmergencia();
  else if (e.atual?.estado === "feedback") e.atual = null;
  else return { ok: false, ignorado: true };
  persistir();
  mostrar();
  return { ok: true };
}

/** Encerra a partida (conclusão ou derrota), calcula pontuação e registra no ranking uma única vez. */
function finalizar(tipo, derrota = null) {
  const e = getState();
  if (e.status === "encerrada") return;
  const concluiu = tipo === "concluida";
  Conseq.descartarRestantes();
  e.status = "encerrada";
  e.resultado = {
    concluiu, tipo,
    indicadorCritico: derrota?.indicador ?? null,
    motivo: concluiu
      ? `Você resolveu ${e.progresso.normaisConcluidas} atividades e ${e.progresso.emergenciasConcluidas} emergências. A empresa sobreviveu!`
      : derrota.motivo,
    encerradaEm: new Date().toISOString(),
  };
  e.pontuacao = calcularPontuacao(e);
  pararLoop();
  if (!e.rankingRegistrado) {
    const r = Ranking.registrar(Ranking.montarRegistro(e));
    e.rankingRegistrado = true;
    e.resultado.posicao = r.posicao;
    e.resultado.rankingErro = r.ok ? null : r.erro;
  }
  persistir();
}
