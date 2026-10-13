// Embaralhamento de alternativas (Fisher-Yates) preservando ids e vínculos.
import { LETRAS } from "../core/gameConfig.js";
import { fisherYates } from "../utils/random.js";

/** Nova lista embaralhada; cada item recebe `letra` (posição visual). Originais intactos. */
export function embaralhar(alternativas) {
  return fisherYates(alternativas).map((alt, i) => ({ ...alt, letra: LETRAS[i] }));
}
