// Sorteio de categoria segundo as probabilidades de gameConfig, com redistribuição proporcional.
import { CONFIG } from "../core/gameConfig.js";
import { sorteioPonderado } from "../utils/random.js";

/** Categorias sem atividades disponíveis recebem peso 0; as demais mantêm proporções (soma 100). */
export function pesosEfetivos(disponiveisPorCategoria) {
  const pesos = {};
  let total = 0;
  for (const [cat, p] of Object.entries(CONFIG.probabilidadesCategorias)) {
    pesos[cat] = (disponiveisPorCategoria[cat] ?? 0) > 0 ? p : 0;
    total += pesos[cat];
  }
  if (total === 0) return pesos;
  for (const cat of Object.keys(pesos)) pesos[cat] = (pesos[cat] / total) * 100;
  return pesos;
}

/** Sorteia uma categoria; devolve null se nenhuma tiver atividades. */
export function sortearCategoria(disponiveisPorCategoria) {
  return sorteioPonderado(pesosEfetivos(disponiveisPorCategoria));
}
