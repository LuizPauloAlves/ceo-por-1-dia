// Tela de atividade normal e de desdobramento (efeito borboleta). Apenas constrói e atualiza a interface.
import { el, porId, limpar, mostrarTela } from "./screenManager.js";
import { criarFeedback } from "./feedbackUI.js";

const pad = (n) => String(n).padStart(2, "0");

/** Lista de alternativas; após a resposta ficam travadas e a escolhida é destacada. */
export function listaAlternativas(alternativas, { escolhaId = null, onEscolher }) {
  const lista = el("div", { class: "alternativas", role: "group", "aria-label": "Alternativas" });
  for (const a of alternativas) {
    const b = el("button", {
      type: "button",
      class: `alt${escolhaId === a.id ? " escolhida" : ""}${escolhaId && escolhaId !== a.id ? " apagada" : ""}`,
      disabled: !!escolhaId,
      onclick: (ev) => {
        if (lista.dataset.travada) return;
        lista.dataset.travada = "1"; // bloqueia duplo clique antes mesmo do engine
        lista.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        ev.currentTarget.classList.add("escolhida");
        onEscolher(a.id);
      },
    }, el("span", { class: "alt-letra" }, a.letra), el("span", { class: "alt-texto" }, a.texto));
    lista.append(b);
  }
  return lista;
}

export function renderPergunta({ atual: a, estado, feedback, final }, { onResponder, onContinuar }) {
  mostrarTela("jogo");
  const area = limpar(porId("area-jogo"));
  const ehConsequencia = a.tipo === "consequencia";

  const topo = ehConsequencia
    ? el("div", { class: "q-topo" },
        el("span", { class: "q-contador" }, "Desdobramento"),
        el("span", { class: "badge badge-borboleta" }, `🦋 Efeito borboleta · cerca de ${a.diasDepois} dias depois`))
    : el("div", { class: "q-topo" },
        el("span", { class: "q-contador" }, `Pergunta ${pad(a.numero)} de ${estado.metas.normais}`),
        el("span", { class: "badge" }, `Categoria: ${a.categoria}`));

  area.append(el("article", { class: `questao${ehConsequencia ? " consequencia" : ""}` },
    topo,
    el("h2", { class: "q-titulo" }, a.titulo),
    ehConsequencia ? el("p", { class: "q-origem" }, el("strong", {}, "Sua decisão anterior: "), a.origemEscolha) : null,
    el("p", { class: "q-situacao" }, a.situacao),
    el("p", { class: "q-pergunta" }, a.pergunta),
    listaAlternativas(a.alternativas, { escolhaId: feedback ? a.escolhaId : null, onEscolher: onResponder })));

  if (feedback) {
    const escolhida = a.alternativas.find((x) => x.id === a.escolhaId);
    const msgs = [];
    if (a.agendouDesdobramento) msgs.push("Esta decisão pode ter desdobramentos nos próximos dias. Fique atento.");
    if (final) msgs.push(estado.resultado.motivo);
    area.append(criarFeedback({
      escolha: escolhida.texto, resultado: a.resultado, mensagens: msgs,
      alerta: final ? "FIM DE JOGO" : null, classe: final ? "derrota" : "",
      textoBotao: final ? "VER RESULTADO" : "CONTINUAR", onContinuar,
    }));
    area.lastChild.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}
