// Seleção de atividades normais não utilizadas e criação da "instância" exibida ao jogador.
import { sortearCategoria } from "./categorySelector.js";
import { embaralhar } from "./answerShuffler.js";
import { sortearImpactos, sortearVariaveis, renderizarTexto } from "./variableGenerator.js";
import { escolher } from "../utils/random.js";

/** Quantidade de atividades ainda disponíveis por categoria. */
export function contarDisponiveis(catalogo, usadas) {
  const usado = new Set(usadas);
  const cont = {};
  for (const a of catalogo.atividades) if (!usado.has(a.id)) cont[a.categoria] = (cont[a.categoria] ?? 0) + 1;
  return cont;
}

/** Escolhe uma atividade ainda não usada (categoria ponderada, depois item aleatório). */
export function selecionarAtividade(catalogo, usadas) {
  const usado = new Set(usadas);
  const cat = sortearCategoria(contarDisponiveis(catalogo, usadas));
  if (!cat) return null;
  return escolher(catalogo.atividades.filter((a) => a.categoria === cat && !usado.has(a.id))) ?? null;
}

/** Cria a instância da pergunta: sorteia variáveis, embaralha e fixa impactos (tudo vai para o save). */
export function instanciarAtividade(item, { caixaAtual, empresa, numero }) {
  const caso = sortearVariaveis(item.variaveisCaso);
  const ctx = { empresa, caso, estado_atual: { F_caixa_rs: caixaAtual } };
  const r = (t) => renderizarTexto(t, ctx);
  return {
    tipo: "normal",
    problemaId: item.id,
    numero,
    categoria: item.categoria,
    titulo: r(item.titulo),
    situacao: r(item.situacao),
    pergunta: r(item.pergunta),
    caso,
    alternativas: embaralhar(item.alternativas).map((a) => ({
      id: a.id, letra: a.letra, texto: r(a.texto), impactos: sortearImpactos(a.impactos),
    })),
    estado: "aguardando",
  };
}
