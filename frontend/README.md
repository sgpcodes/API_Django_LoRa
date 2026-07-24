# Dashboard Meteorológico — Frontend

Frontend em React + Vite que consome a API Django (`../` neste repositório) e
exibe a temperatura atual, a condição do clima, a umidade, o sensor e um
gráfico com a média de temperatura por hora.

## Tecnologias

- React + Vite (JavaScript, sem TypeScript)
- Axios (requisições HTTP)
- Recharts (gráfico de linha)
- CSS Modules (estilos isolados por componente)

## Estrutura do projeto

```
frontend/
├── src/
│   ├── assets/        # imagens e ícones estáticos (se necessário)
│   ├── components/     # peças de UI reutilizáveis (TemperatureDisplay, InfoCard, WeatherChart, StatusMessage)
│   ├── pages/          # telas da aplicação (Dashboard, que monta a página inteira)
│   ├── services/       # comunicação com a API (api.js) e processamento dos dados (leiturasService.js)
│   ├── styles/         # CSS global e as paletas de cores dos temas (global.css, theme.css)
│   ├── App.jsx          # componente raiz, apenas renderiza a página Dashboard
│   └── main.jsx         # ponto de entrada da aplicação React
├── public/              # arquivos servidos estaticamente (favicon, etc.)
├── .env.example
├── package.json
└── README.md
```

### O que cada parte faz

- **`services/api.js`**: cria a instância do Axios com a URL base lida de `VITE_API_URL` (arquivo `.env`).
- **`services/leiturasService.js`**: busca as leituras na API e contém a lógica de agrupar por hora e calcular a média de temperatura — nenhum componente sabe como os dados são calculados, eles só recebem o resultado pronto.
- **`components/TemperatureDisplay.jsx`**: exibe a temperatura atual em destaque e a condição do clima.
- **`components/InfoCard.jsx`**: card genérico reutilizado para Umidade, Sensor e Última atualização.
- **`components/WeatherChart.jsx`**: gráfico de linha (Recharts) com a média de temperatura por hora.
- **`components/StatusMessage.jsx`**: mensagem central usada durante o carregamento, em caso de erro de conexão ou quando não há leituras.
- **`pages/Dashboard.jsx`**: busca os dados, decide o tema de cores (frio/agradável/quente) conforme a temperatura atual e organiza os componentes na tela.
- **`styles/theme.css`**: define as variáveis de cor de cada tema, trocadas através do atributo `data-theme` no elemento raiz do dashboard.

## Como funciona a atualização automática

O ESP32 envia uma leitura por minuto. O frontend busca todas as leituras ao
carregar a página e repete a busca a cada 60 segundos (veja
`INTERVALO_ATUALIZACAO_MS` em `Dashboard.jsx`), atualizando o card de
temperatura e o gráfico automaticamente conforme novas leituras chegam.

## Como executar localmente

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
3. Garanta que o backend Django esteja rodando em `http://127.0.0.1:8000`
   (veja o README na raiz do repositório).
4. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
5. Acesse `http://localhost:5173`.

## Trocando para a API em produção (Render)

Basta editar `VITE_API_URL` no `.env` para a URL do backend hospedado no
Render, por exemplo:

```
VITE_API_URL=https://sua-api.onrender.com
```

Nenhum outro arquivo do projeto precisa ser alterado.
