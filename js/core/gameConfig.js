// Configurações centralizadas do jogo. Altere aqui, nunca nos módulos.
export const CONFIG = Object.freeze({
  versaoSave: 1,

  chaves: Object.freeze({
    partida: "ceo1d:partida",
    lockAba: "ceo1d:aba",
    cookieRanking: "ceo1d_rk", // um cookie por posição: ceo1d_rk_0 ... ceo1d_rk_9
  }),

  caminhosDados: Object.freeze({
    atividades: "data/atividades.json",
    emergencias: "data/emergencias.json",
  }),

  nicknameMax: 20,

  // Valores iniciais: R$ 100.000 e 50 pontos em cada indicador (mesmos valores dos JSON). Valem 500 pontos.
  indicadoresIniciais: Object.freeze({ financeiro: 100000, clientes: 50, equipe: 50, operacao: 50 }),
  limitePontos: Object.freeze({ min: 0, max: 100 }),

  meta: Object.freeze({ atividadesNormais: 20, emergencias: 5 }),

  probabilidadesCategorias: Object.freeze({
    "Pessoas": 25, "Clientes": 20, "Financeiro": 15,
    "Operação": 15, "Marketing": 15, "Desenvolvimento": 10,
  }),

  // modo "json": sorteia dentro de min/max do próprio JSON (prioridade do enunciado);
  // modo "percentual": ±percentual sobre valor_padrao; também é o fallback se faltar min/max.
  variacao: Object.freeze({ modo: "json", percentual: 0.2 }),

  emergencia: Object.freeze({
    duracaoSegundos: 120,          // fixo: ignora tempo_limite_segundos individual do JSON
    habilitarAposNormais: 3,
    sorteioIntervaloSeg: 60,       // Mecanismo A
    sorteioProbabilidade: 0.25,
    tempoMaximoSemEmergenciaSeg: 300, // Mecanismo B
    normaisParaAgendar: 3,         // Mecanismo C
    atrasoAgendadaSeg: 20,
    alertaFinalSeg: 20,
    maxDeltaTickMs: 5000,          // limita saltos de relógio (aba em segundo plano / suspensão)
    limiteAvancoSimuladoSeg: 900,  // proteção contra laço infinito no avanço do relógio
  }),

  // Efeito borboleta: dias_depois (JSON) -> número de atividades normais até o evento.
  consequencias: Object.freeze({ diasPorAtividade: 30, minAtividades: 1, maxAtividades: 4 }),

  // Pontuação de 0 a 1000 = 1000 x média dos quatro indicadores normalizados (0 a 1).
  //  - clientes, equipe e operação: valor / 100;
  //  - financeiro: caixa / (2 x caixa inicial), com teto em 1.
  // Estado inicial (100.000 / 50 / 50 / 50) = 500 pontos. Derrota: a pontuação é multiplicada por penalidadeDerrota.
  pontuacao: Object.freeze({
    financeiroMultiploTeto: 2,
    penalidadeDerrota: 0.3,
  }),

  ranking: Object.freeze({ maxRegistros: 10, cookieDias: 400, cookieBytesMax: 3800 }),

  lockAba: Object.freeze({ heartbeatMs: 2000, expiraMs: 6000 }),
});

export const CATEGORIAS = Object.freeze(Object.keys(CONFIG.probabilidadesCategorias));
export const INDICADORES = Object.freeze(["financeiro", "clientes", "equipe", "operacao"]);
export const LETRAS = Object.freeze(["A", "B", "C", "D"]);
