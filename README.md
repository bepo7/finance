# FinanceLab: DCF, Monte Carlo e Industry Deep Dive

Portfólio de três projetos de finanças sobre **semicondutores, IA e tech**, com empresas do **Brasil e dos EUA**.

**Site:** https://bepo7.github.io/finance/

| # | Projeto | O que faz |
|---|---------|-----------|
| 01 | **DCF Valuation Model** | Monta a DRE, o balanço e o fluxo de caixa, projeta 5 anos, calcula o WACC (CAPM + risco-país + Fisher) e o valor terminal (Gordon e múltiplo) e chega ao valor por ação. Tem tabela de sensibilidade. As premissas são editáveis na grade estilo planilha, com barra de fórmulas. Exporta um **.xlsx com fórmulas reais**. |
| 02 | **Monte Carlo Simulation** | Carteira BR + EUA em R$ ou US$, simulada por bootstrap dos retornos mensais reais ou por GBM. Mostra o leque de trajetórias, o histograma do valor final, P5/P50/P95, a probabilidade de perda, o CVaR e um backtest contra S&P 500 e Ibovespa. Roda num Web Worker. |
| 03 | **Industry Deep Dive** | Cobre semicondutores, infraestrutura de IA e software. Mostra a cadeia de valor, a divisão de receita × lucro entre os elos, os principais players (gráfico de bolhas e tabela), o desempenho em 12 meses, a regulação (EUA, Brasil e UE) e um mapa de conceitos. |

Projeto educacional, não é recomendação de investimento.

## Stack (100% gratuita, sem cadastro)

- **Site:** TypeScript, React, Vite, Tailwind, ECharts, Framer Motion e SheetJS. É estático, então todo o cálculo roda no navegador.
- **Dados:** Python (uv) + `yfinance`, FRED (CSV público), BCB (SGS e Focus/Olinda) e Damodaran (NYU). O script coleta tudo e salva em `web/public/data/*.json`.
- **Hospedagem:** GitHub Pages, publicado por GitHub Actions.

## Rodar localmente

```bash
cd web
npm install
npm run dev      # http://localhost:5173
npm test         # testes das fórmulas (DCF, Monte Carlo, estatística)
```

## Atualizar os dados

```bash
cd data-pipeline
uv run python fetch_all.py   # regrava web/public/data
```

Depois é só fazer commit e push dos JSONs; o deploy roda sozinho. Para mudar o universo de empresas, edite `UNIVERSE` em `data-pipeline/fetch_all.py`.

## Como o DCF garante que o Excel bate com o site

Cada linha do modelo é definida uma única vez como expressão (`web/src/lib/finance/dcf.ts`). Essa mesma expressão é:

1. avaliada no navegador;
2. mostrada com rótulos na barra de fórmulas;
3. exportada em notação A1 para o Excel.

Um teste avalia as fórmulas A1 exportadas de forma independente e compara célula a célula com o resultado do site.

## Estrutura

```
data-pipeline/   coleta de dados (Python)
web/src/lib/finance/   motor de planilha, DCF, Monte Carlo, estatística + testes
web/src/pages/   Home, Dcf, MonteCarlo, DeepDive
web/src/content/ textos do deep dive (cadeia de valor, regulação, glossário)
```
