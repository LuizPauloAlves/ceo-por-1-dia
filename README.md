# CEO POR 1 DIA

Simulador gerencial de uma pequena indústria de laticínios. HTML5 + CSS3 + JavaScript ES6 (módulos), sem frameworks e sem backend.

## Como executar

Os JSON são carregados com `fetch()`, então **não funciona abrindo o `index.html` por `file://`**. Use um servidor HTTP:

```bash
cd ceo-por-1-dia
python3 -m http.server 8080      # ou: npm start
# abra http://localhost:8080
```

Hospedagem estática (GitHub Pages, Netlify, Vercel, S3, Nginx): basta publicar a pasta inteira, sem build.

## Testes

```bash
npm test      # Node 18+ (usa node:test, sem dependências)
```

45 testes: regras isoladas (probabilidades, seleção, embaralhamento, variação, limites, pontuação, ranking), fluxo do motor (gatilhos A/B/C, emergências, expiração, F5, efeito borboleta, derrota, duas abas, storage bloqueado) uma simulação de 300 partidas aleatórias (invariantes e ausência de travamentos) e testes de balanceamento por estratégia (melhor, 2ª, 3ª e pior alternativa; ver abaixo) e a checagem do padrão de atributos de cada decisão.

## Dados (`data/`)

`atividades.json` (100 problemas, 400 efeitos borboleta) e `emergencias.json` (60 emergências) foram revisados (textos em linguagem simples e impactos refeitos com trade-off em cada alternativa). `js/core/dataAdapter.js` os converte para o formato interno: resolve as referências `{"$var": ...}` em intervalos `{padrao, min, max}` e valida cada item (4 alternativas, impactos completos, pior alternativa da emergência). Itens inválidos são ignorados com aviso; JSON ausente ou malformado mostra uma tela de erro.

## Decisões de projeto e pontos de atenção

- **Valores iniciais**: R$ 100.000 / 50 / 50 / 50 (iguais aos dos JSON). Terminar a partida exatamente com esses valores vale **500 pontos**.
- **Variação de impactos**: sorteio inteiro dentro de `min`/`max` do próprio JSON (o enunciado manda priorizar os intervalos dos dados), nunca invertendo o sinal nem zerando. O modo "±20 %" existe em `gameConfig.js` (`variacao.modo = "percentual"`).
- **Duração das emergências**: fixa em 120 s (enunciado). O `tempo_limite_segundos` do JSON (60 a 120) é lido, mas não usado.
- **Pior alternativa** no timeout: `gabarito.alternativa_pior_caso_id` do JSON.
- **Prazo do efeito borboleta**: o JSON dá `dias_depois` (7 a 180 dias). Como o jogo não tem calendário, converte-se em atividades normais (`dias / 30`, entre 1 e 4) — `consequencias.diasPorAtividade` em `gameConfig.js`. O dilema de segundo nível não conta como atividade principal.
- **Tempo "elegível"** das emergências: só conta com a aba visível, com uma pergunta aberta (não em feedback) ou na tela de espera. O cronômetro de 120 s da emergência em si usa `Date.now()` e não pausa.
- **Ranking**: um cookie compacto por posição (`ceo1d_rk_0` … `_9`), cada um bem abaixo de 4 KB. Se o navegador recusar cookies, o erro é mostrado, não engolido. É local ao navegador.
- **Duas abas**: id da aba + heartbeat em LocalStorage + versão do save. Uma aba sem controle não aplica decisões e oferece "Assumir controle".

## Pontuação (0 a 1000)

Primeiro, cada indicador é levado para a escala 0–100:

- **Clientes, equipe e operação**: o próprio valor (0–100).
- **Caixa**: proporcional. R$ 100.000 valem 50 pontos e R$ 200.000 valem 100 pontos (teto). Por exemplo, R$ 150.000 valem 75 pontos. Caixa negativo vale 0.

Depois:

`pontuação = 10 × [ 80% × média geométrica + 20% × média aritmética ]`

- **Média geométrica (80%)**: premia o equilíbrio. Um indicador fraco puxa a nota para baixo, e um indicador zerado (derrota) anula essa parte.
- **Média aritmética (20%)**: preserva o que foi construído. Mesmo numa derrota, sobra uma nota pequena.

| Situação | Pontuação |
|---|---:|
| Terminar com 100.000 / 50 / 50 / 50 | 500 |
| R$ 200.000 e os três indicadores em 100 | 1000 |
| 150.000 / 50 / 50 / 50 | 555 |
| 125.000 / 62 / 63 / 62 (equilibrado) | 624 |
| 50.000 / 75 / 75 / 75 (mesma média, desequilibrado) | 581 |
| Derrota com os outros três em 80 | 120 |

Não há penalidade extra de derrota: o zero na média geométrica já cumpre esse papel. Parâmetros em `js/core/gameConfig.js` (`pontuacao`).

Desempate no ranking: mais indicadores em valor igual ou superior ao inicial, depois menos emergências expiradas, depois a partida mais antiga.

## Balanceamento dos dados

Cada decisão (atividade, desdobramento ou emergência) tem 4 alternativas, sempre neste padrão de atributos (caixa, clientes, equipe, operação):

| Alternativa | Atributos | Saldo nominal típico |
|---|---|---|
| Melhor | 3 bons e 1 ruim | ganhos ≈ 3, custo ≈ 3 |
| Duas intermediárias | 2 bons, 1 ruim e 1 estável | ganhos ≈ 2, custo ≈ 4 |
| Pior | 1 bom, 2 ruins e 1 estável | ganho ≈ 2, custos ≈ 4 |

Valores em pontos de indicador; no caixa, R$ 2.000 equivalem a 1 ponto (pouco menos nas decisões, para o melhor caminho terminar perto de R$ 200.000). Nenhuma alternativa domina outra, e o atributo ruim gira entre os quatro indicadores: ninguém ganha o jogo olhando só para um deles. Nas emergências, a alternativa escolhida quando o tempo acaba (`alternativa_pior_caso_id`) é sempre a de 1 bom e 2 ruins.

Resultado medido nas simulações (300 partidas por estratégia, ≈ 43 decisões por partida):

| Estratégia | Pontuação média | Indicadores finais (caixa / C / E / O) |
|---|---:|---|
| Sempre a melhor | ≈ 975 | ≈ R$ 200 mil / 98 / 99 / 98 |
| Sempre a 2ª melhor | ≈ 540 | ≈ R$ 108 mil / 58 / 60 / 57 |
| 2ª ou 3ª ao acaso | ≈ 465 | ≈ R$ 102 mil / 49 / 50 / 51 |
| Sempre a 3ª | ≈ 400 | ≈ R$ 95 mil / 42 / 43 / 45 |
| Escolhas aleatórias | ≈ 475 | ≈ R$ 99 mil / 51 / 53 / 52 |
| Sempre a pior | ≈ 30 (derrota antes do fim em 100% das partidas) | |

Nas estratégias intermediárias, de 2% a 6% das partidas ainda terminam em derrota por azar no sorteio (pontuação abaixo de 120).

A "melhor" alternativa é a de maior saldo nominal; ela não é perfeita (sempre tem um custo) e não aparece indicada ao jogador.

## Estrutura

Conforme o enunciado, mais `core/dataAdapter.js` (adaptação dos JSON), `ui/startUI.js` (tela inicial e de erro) e `ui/waitUI.js` (tela "aguardando emergência").
