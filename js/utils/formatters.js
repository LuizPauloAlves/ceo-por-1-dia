// Formatação de valores para exibição (pt-BR).

/** Inteiro com separador de milhar por ponto, sem depender de Intl. */
export function milhar(n) {
  const s = String(Math.abs(Math.trunc(n)));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** R$ 25.000 (negativos: -R$ 1.500). */
export function moeda(n) {
  const v = Math.round(n);
  return `${v < 0 ? "-" : ""}R$ ${milhar(v)}`;
}

/** +R$ 500 / -R$ 1.500 / R$ 0 */
export function moedaComSinal(n) {
  const v = Math.round(n);
  if (v === 0) return "R$ 0";
  return `${v > 0 ? "+" : "-"}R$ ${milhar(v)}`;
}

/** +5 / -8 / 0 */
export function pontosComSinal(n) { return n > 0 ? `+${n}` : String(n); }

/** 65/100 */
export function pontos(n) { return `${n}/100`; }

/** 120 -> 02:00 */
export function cronometro(segundos) {
  const s = Math.max(0, Math.ceil(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** "05:30" -> "05h30" */
export function hora(texto) {
  const [h, m] = String(texto).split(":");
  return `${h.padStart(2, "0")}h${(m ?? "00").padStart(2, "0")}`;
}

/** 1 -> "1 mês", 3 -> "3 meses" */
export function meses(n) { return `${n} ${Number(n) === 1 ? "mês" : "meses"}`; }

/** Data curta pt-BR a partir de ISO. */
export function dataCurta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (x) => String(x).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
