// Gera variações controladas de impactos e variáveis de texto, e resolve {{marcadores}}.
import { CONFIG, INDICADORES } from "../core/gameConfig.js";
import { rand, randInt } from "../utils/random.js";
import { moeda, hora, meses } from "../utils/formatters.js";

/**
 * Sorteia um impacto inteiro a partir de {padrao, min, max}.
 * Zero permanece zero; o sinal do valor padrão é sempre preservado; magnitude mínima 1.
 */
export function sortearImpacto(spec) {
  const padrao = spec.padrao;
  if (padrao === 0) return 0;
  const sinal = Math.sign(padrao);
  let valor;
  const jsonMode = CONFIG.variacao.modo === "json";
  const temIntervalo = jsonMode && Number.isFinite(spec.min) && Number.isFinite(spec.max);
  if (temIntervalo) valor = spec.min === spec.max ? spec.min : randInt(spec.min, spec.max);
  else valor = Math.round(padrao * (1 + (rand() * 2 - 1) * CONFIG.variacao.percentual));
  if (valor * sinal <= 0) valor = sinal; // nunca inverte o sentido nem zera
  return Math.round(valor);
}

/** Converte {financeiro: spec, ...} em {financeiro: inteiro, ...}. */
export function sortearImpactos(specs) {
  const out = {};
  for (const ind of INDICADORES) out[ind] = sortearImpacto(specs[ind]);
  return out;
}

function horaParaMin(h) { const [a, b] = String(h).split(":").map(Number); return a * 60 + (b || 0); }
function minParaHora(m) { return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }

/** Sorteia as variáveis de texto de um caso/evento: {nome: valor}. Respeita min, max e passo. */
export function sortearVariaveis(defs) {
  const out = {};
  for (const [nome, d] of Object.entries(defs ?? {})) {
    if (d.tipo === "hora") {
      const lo = horaParaMin(d.min ?? d.valor_padrao), hi = horaParaMin(d.max ?? d.valor_padrao);
      out[nome] = minParaHora(lo + 15 * randInt(0, Math.floor((hi - lo) / 15)));
    } else if (Number.isFinite(d.min) && Number.isFinite(d.max)) {
      const passo = d.passo > 0 ? d.passo : 1;
      out[nome] = d.min + passo * randInt(0, Math.floor((d.max - d.min) / passo));
    } else {
      out[nome] = d.valor_padrao;
    }
  }
  return out;
}

const FORMATOS = {
  moeda: (v) => moeda(Number(v)),
  hora: (v) => hora(v),
  meses: (v) => meses(v),
  inteiro: (v) => String(v),
  numero: (v) => String(v),
};

const RE = /\{\{\s*([^}|]+?)\s*(?:\|\s*([^}]+?)\s*)?\}\}/g;

/**
 * Substitui {{contexto.nome|formato}} usando `ctx` = { empresa, caso, evento, estado_atual }.
 * Marcador sem valor vira "—" e gera aviso no console (nunca aparece "{{...}}" ao jogador).
 */
export function renderizarTexto(texto, ctx) {
  if (typeof texto !== "string") return texto;
  return texto.replace(RE, (_, caminho, formato) => {
    const [raiz, ...resto] = caminho.split(".");
    const valor = resto.length ? ctx?.[raiz]?.[resto.join(".")] : undefined;
    if (valor === undefined || valor === null) {
      console.warn(`[variableGenerator] marcador sem valor: {{${caminho}}}`);
      return "—";
    }
    return (FORMATOS[formato] ?? String)(valor);
  });
}
