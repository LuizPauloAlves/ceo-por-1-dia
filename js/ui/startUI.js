// Tela inicial: nickname, iniciar, continuar, ranking e explicação do jogo. Também a tela de erro fatal.
import { REGRAS } from "./ajudaUI.js";
import { el, porId, limpar, mostrarTela } from "./screenManager.js";
import { CONFIG } from "../core/gameConfig.js";

export function renderInicio({ salvo, avisoStorage, nicknameSugerido = "" }, { onIniciar, onContinuar, onRanking }) {
  mostrarTela("inicio");
  const tela = limpar(porId("tela-inicio"));
  const erro = el("p", { class: "campo-erro", role: "alert", id: "nick-erro" });
  const input = el("input", {
    id: "nickname", type: "text", maxlength: CONFIG.nicknameMax, autocomplete: "nickname",
    placeholder: "Seu nickname (até 20 caracteres)", value: nicknameSugerido, "aria-describedby": "nick-erro", required: true,
  });
  const iniciar = () => onIniciar(input.value, (msg) => { erro.textContent = msg; input.focus(); });
  input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") iniciar(); });
  input.addEventListener("input", () => { erro.textContent = ""; });

  tela.append(el("div", { class: "inicio" },
    el("div", { class: "inicio-hero" },
      el("h1", {}, "CEO POR 1 DIA"),
      el("p", { class: "subtitulo" }, "Suas decisões podem salvar ou destruir uma indústria de laticínios.")),
    avisoStorage ? el("p", { class: "aviso-storage" }, `⚠ ${avisoStorage}`) : null,
    el("div", { class: "inicio-card" },
      el("label", { for: "nickname" }, "Nickname"), input, erro,
      el("div", { class: "inicio-botoes" },
        el("button", { class: "btn btn-primario btn-grande", type: "button", onclick: iniciar }, "INICIAR JOGO"),
        salvo ? el("button", { class: "btn btn-sec btn-grande", type: "button", onclick: onContinuar },
          "CONTINUAR PARTIDA", el("small", {}, `${salvo.nickname} · atividade ${Math.min(salvo.progresso.normaisConcluidas + 1, salvo.metas.normais)}/${salvo.metas.normais}`)) : null,
        el("button", { class: "btn btn-sec btn-grande", type: "button", onclick: onRanking }, "RANKING")),
      salvo ? el("p", { class: "nota" }, "Iniciar um novo jogo substitui a partida salva.") : null),
    el("div", { class: "inicio-explica" },
      el("h2", {}, "Como funciona"),
      el("ul", {}, REGRAS.map((r) => el("li", {}, r))))));
  input.focus();
}

/** Tela de erro fatal (JSON ausente/malformado, por exemplo). */
export function renderErro(mensagem) {
  mostrarTela("erro");
  const tela = limpar(porId("tela-erro"));
  tela.append(el("div", { class: "espera" },
    el("h1", {}, "Não foi possível iniciar o jogo"),
    el("p", { class: "aviso-storage" }, mensagem),
    el("button", { class: "btn btn-primario btn-grande", type: "button", onclick: () => location.reload() }, "TENTAR NOVAMENTE")));
}
