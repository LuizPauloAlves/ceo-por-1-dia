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

  // Valores iniciais do enunciado (os JSON trazem 200.000/50/50/50, mas o enunciado prevalece).
  indicadoresIniciais: Object.freeze({ financeiro: 25000, clientes: 65, equipe: 65, operacao: 60 }),
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

  // Pontuação máxima = 4*200 + 60 + 40 + 100 = 1000
  pontuacao: Object.freeze({
    pesoIndicadorPontos: 2,
    financeiroMultiploTeto: 2,
    financeiroMax: 200,
    porAtividade: 3,
    porEmergenciaNoPrazo: 8,
    bonusConclusao: 100,
  }),

  ranking: Object.freeze({ maxRegistros: 10, cookieDias: 400, cookieBytesMax: 3800 }),

  lockAba: Object.freeze({ heartbeatMs: 2000, expiraMs: 6000 }),
});

export const CATEGORIAS = Object.freeze(Object.keys(CONFIG.probabilidadesCategorias));
export const INDICADORES = Object.freeze(["financeiro", "clientes", "equipe", "operacao"]);
export const LETRAS = Object.freeze(["A", "B", "C", "D"]);
