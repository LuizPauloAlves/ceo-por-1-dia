// Camada de adaptação: converte o formato dos JSON fornecidos para o formato interno do jogo.
// Os dados originais NÃO são alterados; referências {"$var": "..."} viram "specs" {padrao,min,max}.
import { validarAtividade, validarEmergencia } from "../utils/validators.js";

/** Resolve {"$var": "tabela.ID.campo"} ou número literal para {padrao, min, max}. */
function resolverSpec(valor, tabelas) {
  if (typeof valor === "number") return { padrao: valor, min: valor, max: valor };
  if (valor && typeof valor === "object" && typeof valor.$var === "string") {
    const [tabela, id, campo] = valor.$var.split(".");
    const def = tabelas[tabela]?.[id]?.[campo];
    if (!def) return null;
    return { padrao: def.valor_padrao, min: def.min, max: def.max };
  }
  return null;
}

function adaptarImpactos(imp, campoCaixa, tabelas) {
  return {
    financeiro: resolverSpec(imp?.[campoCaixa], tabelas),
    clientes: resolverSpec(imp?.clientes_pts, tabelas),
    equipe: resolverSpec(imp?.equipe_pts, tabelas),
    operacao: resolverSpec(imp?.operacao_pts, tabelas),
  };
}

/** Adapta o arquivo de atividades normais. Devolve { itens, erros, empresa }. */
export function adaptarAtividades(raw) {
  const erros = [];
  const itens = [];
  if (!raw || !Array.isArray(raw.problemas)) return { itens, erros: ["atividades.json: lista \"problemas\" ausente"], empresa: {} };
  const tabelas = { variaveis_impactos: raw.variaveis_impactos ?? {}, variaveis_prazos: raw.variaveis_prazos ?? {} };
  const empresaRaw = raw.variaveis_globais?.empresa ?? {};
  const empresa = Object.fromEntries(Object.entries(empresaRaw).map(([k, v]) => [k, v?.valor_padrao]));
  const ids = new Set();

  for (const p of raw.problemas) {
    try {
      const item = {
        id: p.id, numero: p.numero, categoria: p.categoria, titulo: p.titulo,
        situacao: p.situacao, pergunta: p.pergunta,
        variaveisCaso: raw.variaveis_por_problema?.[p.id] ?? {},
        alternativas: (p.alternativas ?? []).map((a) => ({
          id: a.id, texto: a.texto,
          impactos: adaptarImpactos(a.gabarito?.impacto, "projecao_caixa_rs", tabelas),
          borboleta: a.efeito_borboleta ? {
            id: a.efeito_borboleta.id,
            dias: resolverSpec(a.efeito_borboleta.dias_depois, tabelas),
            narrativa: a.efeito_borboleta.narrativa,
            novoDilema: a.efeito_borboleta.novo_dilema,
            alternativas: (a.efeito_borboleta.alternativas ?? []).map((b) => ({
              id: b.id, texto: b.texto,
              impactos: adaptarImpactos(b.gabarito?.intensidade, "caixa_rs", tabelas),
            })),
          } : null,
        })),
      };
      const e = validarAtividade(item);
      if (ids.has(item.id)) e.push(`${item.id}: id duplicado`);
      if (e.length) erros.push(...e); else { ids.add(item.id); itens.push(item); }
    } catch (err) {
      erros.push(`${p?.id ?? "?"}: formato inesperado (${err.message})`);
    }
  }
  return { itens, erros, empresa };
}

/** Adapta o arquivo de emergências. Devolve { itens, erros }. */
export function adaptarEmergencias(raw) {
  const erros = [];
  const itens = [];
  if (!raw || !Array.isArray(raw.emergencias)) return { itens, erros: ["emergencias.json: lista \"emergencias\" ausente"] };
  const tabelas = { variaveis_impactos: raw.variaveis_impactos ?? {} };
  const ids = new Set();

  for (const em of raw.emergencias) {
    try {
      const item = {
        id: em.id, numero: em.numero, categoria: em.categoria, titulo: em.titulo,
        situacao: em.situacao, pergunta: em.pergunta,
        tempoJsonSegundos: em.tempo_limite_segundos, // informativo; o jogo usa a duração de gameConfig
        variaveisEvento: raw.variaveis_por_emergencia?.[em.id] ?? {},
        piorAlternativaId: em.gabarito?.alternativa_pior_caso_id,
        motivoTimeout: em.gabarito?.motivo_timeout ?? "",
        alternativas: (em.alternativas ?? []).map((a) => ({
          id: a.id, texto: a.texto,
          impactos: adaptarImpactos(a.gabarito?.impacto, "projecao_caixa_rs", tabelas),
        })),
      };
      const e = validarEmergencia(item);
      if (ids.has(item.id)) e.push(`${item.id}: id duplicado`);
      if (e.length) erros.push(...e); else { ids.add(item.id); itens.push(item); }
    } catch (err) {
      erros.push(`${em?.id ?? "?"}: formato inesperado (${err.message})`);
    }
  }
  return { itens, erros };
}

/**
 * Carrega os dois JSON com fetch e devolve o catálogo.
 * Lança Error com mensagem clara se arquivos ausentes/malformados ou conteúdo insuficiente.
 */
export async function carregarCatalogo(caminhos, buscar = globalThis.fetch?.bind(globalThis)) {
  async function lerJson(caminho) {
    let resp;
    try { resp = await buscar(caminho); } catch (e) { throw new Error(`Não foi possível carregar "${caminho}". Execute o jogo por um servidor HTTP (veja o README). Detalhe: ${e.message}`); }
    if (!resp.ok) throw new Error(`Arquivo "${caminho}" não encontrado (HTTP ${resp.status}).`);
    try { return await resp.json(); } catch { throw new Error(`O arquivo "${caminho}" está malformado (JSON inválido).`); }
  }
  const [rawA, rawE] = await Promise.all([lerJson(caminhos.atividades), lerJson(caminhos.emergencias)]);
  const a = adaptarAtividades(rawA);
  const e = adaptarEmergencias(rawE);
  if (a.itens.length === 0) throw new Error(`Nenhuma atividade válida em "${caminhos.atividades}". ${a.erros[0] ?? ""}`);
  if (e.itens.length === 0) throw new Error(`Nenhuma emergência válida em "${caminhos.emergencias}". ${e.erros[0] ?? ""}`);
  return {
    atividades: a.itens, emergencias: e.itens, empresa: a.empresa,
    avisos: [...a.erros, ...e.erros],
    atividadesPorId: new Map(a.itens.map((x) => [x.id, x])),
    emergenciasPorId: new Map(e.itens.map((x) => [x.id, x])),
  };
}
