// Ponto de entrada: apenas inicia e conecta os módulos (engine <-> interface).
import { CONFIG } from "./core/gameConfig.js";
import { bus } from "./core/eventBus.js";
import { carregarCatalogo } from "./core/dataAdapter.js";
import * as Engine from "./core/gameEngine.js";
import * as Save from "./systems/saveManager.js";
import { carregarRanking } from "./systems/rankingManager.js";
import { validarNickname } from "./utils/validators.js";
import { montarDashboard, atualizarDashboard, mostrarDeltas, mostrarSelo } from "./ui/dashboardUI.js";
import { renderPergunta } from "./ui/questionUI.js";
import { renderEmergencia, atualizarTimer } from "./ui/emergencyUI.js";
import { renderEspera } from "./ui/waitUI.js";
import { renderResultado } from "./ui/resultsUI.js";
import { renderRanking } from "./ui/rankingUI.js";
import { renderInicio, renderErro } from "./ui/startUI.js";
import { montarAjuda } from "./ui/ajudaUI.js";
import { mostrarBanner, removerBanner, confirmar } from "./ui/feedbackUI.js";

const FLAG_SESSAO = "ceo1d:emJogo"; // sobrevive ao F5 mas não ao fechar a aba

const sessao = {
  marcar() { try { sessionStorage.setItem(FLAG_SESSAO, "1"); } catch { /* sem sessionStorage */ } },
  limpar() { try { sessionStorage.removeItem(FLAG_SESSAO); } catch { /* idem */ } },
  ativa() { try { return sessionStorage.getItem(FLAG_SESSAO) === "1"; } catch { return false; } },
};

function avisarAbaInativa() {
  mostrarBanner("aba", "Esta partida está sendo controlada por outra aba. Aqui, nenhuma decisão será aplicada.", {
    tipo: "erro", fechavel: false,
    acao: { texto: "Assumir controle aqui", fn: () => { removerBanner("aba"); Engine.continuarPartida({ forcar: true }); } },
  });
}

const handlers = {
  onResponder: (id) => { const r = Engine.responder(id); if (r?.motivo === "aba") avisarAbaInativa(); },
  onContinuar: () => { const r = Engine.avancar(); if (r?.motivo === "aba") avisarAbaInativa(); },
};

function ligarEventos() {
  bus.on("dashboard:atualizar", atualizarDashboard);
  bus.on("score:atualizado", mostrarDeltas);
  bus.on("tela:pergunta", (d) => renderPergunta(d, handlers));
  bus.on("tela:emergencia", (d) => renderEmergencia(d, handlers));
  bus.on("emergencia:tick", atualizarTimer);
  bus.on("tela:espera", (d) => renderEspera(d, { onAvancar: () => Engine.avancarRelogio() }));
  bus.on("tela:resultado", ({ estado }) => renderResultado(
    { estado, ranking: carregarRanking(), erroRanking: estado.resultado.rankingErro },
    {
      onJogarNovamente: () => { const nick = estado.nickname; Engine.descartarPartida(); iniciarPartida(nick); },
      onRanking: () => abrirRanking(() => Engine.mostrar()),
      onInicio: () => { Engine.descartarPartida(); sessao.limpar(); irParaInicio(); },
    }));
  bus.on("save:ok", () => { mostrarSelo("ok"); removerBanner("save"); });
  bus.on("save:erro", ({ erro }) => {
    mostrarSelo("erro");
    mostrarBanner("save", `Não foi possível salvar o progresso (${erro}). Seu progresso NÃO está sendo salvo.`, { tipo: "erro" });
  });
  bus.on("save:conflito", () => { mostrarSelo("conflito"); avisarAbaInativa(); });
}

function abrirRanking(voltar) {
  renderRanking({ lista: carregarRanking(), erro: null }, { onVoltar: voltar });
}

async function iniciarPartida(nickInformado, setErro = () => {}) {
  const v = validarNickname(nickInformado);
  if (!v.ok) { setErro(v.erro); return; }
  const salvo = Save.inspecionarSave();
  if (salvo.existe && salvo.estado.status === "jogando") {
    const ok = await confirmar("Substituir partida salva?",
      `Existe uma partida em andamento de "${salvo.estado.nickname}". Começar outra irá substituí-la definitivamente.`, "Começar nova partida", "Cancelar");
    if (!ok) return;
  }
  let r = Engine.novaPartida(v.valor);
  if (!r.ok && r.outraAba) {
    if (!(await confirmar("Jogo aberto em outra aba", `${r.erro} Assumir o controle aqui?`, "Assumir controle", "Cancelar"))) return;
    r = Engine.novaPartida(v.valor, { forcar: true });
  }
  if (!r.ok) { setErro(r.erro); return; }
  sessao.marcar();
  if (r.avisoSave) mostrarBanner("save", `Atenção: o progresso não está sendo salvo (${r.avisoSave}).`, { tipo: "erro" });
}

async function continuar() {
  let r = Engine.continuarPartida();
  if (!r.ok && r.outraAba) {
    if (!(await confirmar("Jogo aberto em outra aba", `${r.erro} Assumir o controle aqui?`, "Assumir controle", "Cancelar"))) return;
    r = Engine.continuarPartida({ forcar: true });
  }
  if (!r.ok) { mostrarBanner("continuar", r.erro, { tipo: "erro" }); irParaInicio(); return; }
  sessao.marcar();
}

function irParaInicio() {
  const s = Save.inspecionarSave();
  const salvo = s.existe && s.estado.status === "jogando" ? s.estado : null;
  if (s.corrompido) mostrarBanner("corrupto", `${s.erro} A partida salva não pode ser restaurada.`, { tipo: "erro" });
  renderInicio(
    { salvo, nicknameSugerido: salvo?.nickname ?? "", avisoStorage: Save.armazenamentoDisponivel() ? null : "O armazenamento do navegador está bloqueado: a partida não poderá ser salva nem continuada." },
    { onIniciar: iniciarPartida, onContinuar: continuar, onRanking: () => abrirRanking(irParaInicio) });
}

async function main() {
  montarDashboard(); montarAjuda();
  ligarEventos();
  let catalogo;
  try {
    catalogo = await carregarCatalogo(CONFIG.caminhosDados);
  } catch (e) {
    renderErro(e.message);
    return;
  }
  if (catalogo.avisos.length) {
    console.warn("[dados] itens ignorados por inconsistência:", catalogo.avisos);
    mostrarBanner("dados", `${catalogo.avisos.length} problema(s) nos arquivos JSON foram ignorados (detalhes no console).`, { tipo: "aviso" });
  }
  if (catalogo.atividades.length < CONFIG.meta.atividadesNormais || catalogo.emergencias.length < CONFIG.meta.emergencias) {
    mostrarBanner("conteudo", "Há menos conteúdo válido do que o previsto; as metas da partida foram reduzidas para não repetir perguntas.", { tipo: "aviso" });
  }
  Engine.iniciarEngine(catalogo);

  // F5 durante a partida: volta direto ao ponto exato em que estava.
  if (sessao.ativa() && Save.inspecionarSave().existe) {
    const r = Engine.continuarPartida();
    if (r.ok) return;
  }
  irParaInicio();
}

main();
