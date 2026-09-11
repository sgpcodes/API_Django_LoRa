# Visão Geral do Projeto — Sistema de Monitoramento Agroclimático (LACOP/UFF)

> Este documento existe pra dar uma visão de cima: o que o sistema faz, como
> as peças se encaixam, onde cada dado mora e de onde vem. Ele não substitui
> os outros documentos em `docs/` (regras de negócio, relatórios de
> implementação) — é o mapa que ajuda a decidir qual deles abrir depois,
> e a entender o projeto sem precisar ler código.

---

## 1. O que é o projeto

Um SaaS de monitoramento agroclimático: estações meteorológicas próprias
(ESP32 + sensores, conectadas por LoRa a um receptor com WiFi) enviam
leituras de temperatura, umidade e pressão pra uma API central, que
alimenta um dashboard web. Além do dado da própria estação, o sistema
também mostra dado público oficial (INMET/IBGE) como complemento — numa
aba separada, sem misturar as duas fontes.

Existem dois tipos de conta:

- **Usuário** — dono de uma ou mais estações; acessa `/app`, vê o dashboard
  da própria estação, a previsão oficial do INMET, notificações, perfil e
  plano contratado.
- **Gestor** — administra a plataforma inteira; acessa `/app/adm`, vê todas
  as contas e estações, cadastra planos e funcionalidades, e tem acesso às
  telas técnicas (Manutenção) que mexem direto no banco de dados.

Uma conta Gestor só existe mediante um **token de credenciamento**
(uma senha organizacional versionada, ver `TokenCredenciamento` na seção 4)
— não é algo que qualquer pessoa cria se cadastrando.

**Stack**: Django + Django REST Framework no backend, React (Vite) no
frontend, Postgres (hospedado na Supabase) como banco de dados, deploy do
backend no Render e do frontend na Vercel.

---

## 2. Como o projeto está organizado (pastas)

```
api_django_lora/
├── api_root/        # configuração do projeto Django (settings, urls raiz, wsgi)
├── contas/          # app: contas de usuário, planos, assinaturas, auditoria
├── api_rest/        # app: estações, leituras de clima, telemetria do hardware
├── clima_externo/   # app: proxy pras APIs públicas do INMET
├── frontend/         # aplicação React (Vite) — todo o site
├── docs/            # este documento + regras de negócio + relatórios
├── manage.py, requirements.txt, Procfile, render.yaml, .env.example
```

Cada pasta na raiz (`contas`, `api_rest`, `clima_externo`) é um **app
Django** — um módulo independente com seus próprios modelos (tabelas),
views (endpoints) e rotas. `api_root` não é um app de negócio, é só a
"cola" que liga os apps entre si e configura o projeto (banco de dados,
segurança, quais apps existem).

---

## 3. Backend — os três apps

### 3.1 `contas` — contas, planos e auditoria

É o app "administrativo": tudo que não é dado de clima em si.

**O que ele guarda** (tabelas/modelos principais):

| Modelo | Pra que serve |
|---|---|
| `Usuario` | A conta em si (login, papel Gestor/Usuário, endereço, CPF). Estende o usuário padrão do Django. |
| `TokenCredenciamento` | A senha organizacional versionada que autoriza criar uma conta Gestor. |
| `Plano` | Catálogo de planos (Standard/Pro/Plus) — quantas estações permite, quantos dias de histórico, preço. |
| `Funcionalidade` | Catálogo de recursos que um plano pode liberar (ex.: exportar relatório). |
| `Assinatura` | O vínculo entre uma conta e um plano, com histórico (nunca apaga, só encerra e cria uma nova ao trocar de plano). |
| `LogAuditoria` | Registro de tudo que aconteceu (conta criada, estação removida, plano trocado etc.) — alimenta as telas de Notificações e Manutenção. |

**O que ele expõe** (endpoints, todos sob `/api/`):

- `auth/token/`, `auth/token/refresh/` — login e renovação de sessão (JWT).
- `auth/cadastro/`, `auth/confirmar-email/` — cadastro público e confirmação por e-mail.
- `auth/recredenciar/` — uma conta Gestor renova/obtém o token de credenciamento.
- `contas/` — CRUD de contas (Gestor vê todas; Usuário só vê/edita a própria).
- `planos/`, `funcionalidades/` — catálogo de planos e recursos (planos: listagem é pública, pra alimentar a página de preços).
- `assinaturas/` — histórico de assinaturas e troca de plano.
- `auditoria/recentes/` — eventos recentes pra tela de Notificações do Gestor.
- `manutencao/info-sistema/`, `manutencao/limpar-dados/`, `manutencao/limpar-leituras-antigas/` — a tela de Manutenção (ver seção 4).

### 3.2 `api_rest` — estações e leituras de clima

É o app que fala com o hardware (ESP32) e guarda o dado de clima em si.

**O que ele guarda:**

| Modelo | Pra que serve |
|---|---|
| `Estacao` | Uma estação física — identificador único (bate com o `sensor_id` que o ESP32 manda), nome, localização, quais contas têm acesso a ela. |
| `Leitura` | Cada medição recebida (temperatura, umidade, pressão, data/hora), vinculada à estação. |
| `SolicitacaoRssi` | Uma "bandeira" temporária pra pedir ao receptor que informe a qualidade do sinal LoRa daquela estação. |

**O que ele expõe:**

- `leituras/` — GET lista leituras (autenticado); POST recebe uma leitura nova, **sem autenticação** (é o próprio ESP32 quem manda, ele não tem como logar).
- `rssi/status/`, `rssi/solicitar/` — canal de solicitação de RSSI entre dashboard e receptor.
- `estacoes/`, `estacoes/orfas/` — CRUD de estações (só Gestor cria/apaga) e listagem de sensores que já mandaram leitura mas ainda não têm estação cadastrada.
- `leituras/orfas/<sensor_id>/` — Gestor apaga leituras de um sensor órfão (teste, sensor descartado etc.).

### 3.3 `clima_externo` — ponte com o INMET

App pequeno, sem tabelas próprias — só três endpoints que buscam dado
público do INMET (Instituto Nacional de Meteorologia) e devolvem já
formatado pro frontend, guardando o resultado em cache por um tempo pra
não bater na API externa a cada carregamento de tela:

| Endpoint | Busca no INMET | Cache |
|---|---|---|
| `inmet/estacoes/` | Lista de estações meteorológicas oficiais por estado | 24 horas |
| `inmet/previsao/<codigo_ibge>/` | Previsão do tempo de 5 dias por município | 2 horas |
| `inmet/avisos/` | Avisos oficiais ativos por estado | 15 minutos |

O INMET bloqueia (proteção anti-robô) o endpoint de leitura horária por
estação — por isso a aba "Clima INMET" mostra só identificação/localização
da estação de referência, não uma leitura ao vivo dela: não existe dado
real pra mostrar aí sem inventar.

### 3.4 `api_root` — configuração

Não é um app de negócio — é o `settings.py` (configuração do Django: banco
de dados, quais apps existem, segurança, e-mail) e o `urls.py` raiz, que só
junta as rotas dos três apps acima, todas sob o prefixo `/api/`.

---

## 4. Banco de dados

- **Motor**: PostgreSQL, hospedado na **Supabase** (plano gratuito/pago,
  configurável via a variável `DATABASE_QUOTA_GB`).
- **Conexão**: definida por uma única variável de ambiente, `DATABASE_URL`
  — nada de configuração espalhada.
- **Tabelas principais**: `contas_usuario`, `contas_assinatura`,
  `contas_logauditoria` (do app `contas`) e `api_rest_estacao`,
  `api_rest_leitura`, `api_rest_solicitacaorssi` (do app `api_rest`).
  `clima_externo` não tem tabela própria.
- **Painel de Manutenção** (`/app/adm/manutencao`, só Gestor): mostra o
  tamanho real do banco (consulta direta ao Postgres), quebrado por
  categoria (dados meteorológicos / contas e estações / logs / outros),
  contagem de linhas por tabela, e quantas leituras foram processadas no
  período — tudo consulta real, nada estimado.
- **Zona de risco**: duas ações de limpeza, ambas exigem confirmação
  explícita e ficam registradas no `LogAuditoria`: apagar leituras antigas
  (por período) e apagar todos os dados operacionais (contas + estações +
  leituras, preservando planos e o token de credenciamento).

---

## 5. Autenticação e permissões

- Login gera um **JWT** (token de acesso, válido por 30 minutos, mais um
  token de renovação válido por 7 dias) — biblioteca
  `djangorestframework-simplejwt`.
- O token carrega o papel da conta (`gestor` ou `usuario`) e o plano
  atual — o frontend lê isso pra decidir se mostra o layout de Usuário ou
  o Painel Administrativo.
- Toda rota da API exige autenticação por padrão; as exceções (cadastro
  público, login, listagem de planos, e o POST de leitura que vem do
  próprio ESP32) são declaradas explicitamente rota por rota.
- Regra central de permissão do Gestor (`EhGestor`): não basta o papel ser
  "gestor" — o token de credenciamento também precisa continuar válido
  (se uma versão nova do token for publicada, contas antigas perdem acesso
  administrativo até se recredenciarem).
- Uma estação pode ter várias contas vinculadas (não existe "dono único") —
  a permissão de mexer numa estação específica é: Gestor sempre pode,
  Usuário só se a conta dele estiver na lista de vinculados daquela
  estação.

---

## 6. APIs externas usadas

Tudo que é integração com serviço de terceiro fica centralizado na tela de
Manutenção (`/app/adm/manutencao`), que mostra o que cada uma faz e se está
no ar:

| Serviço | Pra que serve no sistema | Quem chama |
|---|---|---|
| **INMET** | Estações oficiais, previsão de 5 dias e avisos — aba "Clima INMET" | Backend (`clima_externo`), o frontend nunca chama o INMET direto |
| **IBGE** | Lista de municípios por estado, pra alimentar o seletor de cidade da aba "Clima INMET" | Frontend, direto do navegador (é só uma lista pública, sem risco de dado sensível) |
| **Open-Meteo** | Clima "de empréstimo" no Dashboard do Usuário, usado só até a estação própria da conta estar transmitindo de verdade | Frontend, direto do navegador |
| **Resend** | Envio do e-mail de confirmação de cadastro | Backend, via SMTP |

A tela de Manutenção verifica INMET/IBGE/Open-Meteo com um ping real
(timeout curto, resultado guardado em cache por 5 minutos); o Resend não
tem como ser "pingado" (não existe endpoint de teste de envio), então ali
é mostrado se a chave está configurada ou não, honestamente, sem fingir
verificar a entrega do e-mail.

---

## 7. Frontend

Aplicação React única (Vite), servida separadamente do backend (deploy na
Vercel). Estrutura de pastas dentro de `frontend/src/`:

| Pasta | Conteúdo |
|---|---|
| `pages/` | Uma tela por rota (Dashboard, Login, ManutencaoAdmin etc.) |
| `components/` | Peças reutilizáveis: menus, cards, gráficos, tabelas, modais |
| `services/` | Uma função por chamada de API — nenhuma tela chama `fetch`/`axios` direto |
| `hooks/` | Lógica de estado reutilizável entre telas |
| `styles/` | Cores e estilos globais (tema dia/noite) |

**Rotas públicas** (sem login): página de login (`/`, `/login`), cadastro
(`/cadastro`), confirmação de e-mail, e a página de planos (`/planos`).

**Rotas do Usuário** (`/app/...`): Dashboard, Clima INMET, Notificações,
Perfil, Estação, Configurações, Plano/Checkout.

**Rotas do Gestor** (`/app/adm/...`): Dashboard administrativo, Estações,
Contas, Manutenção, Perfil, Configurações, Notificações.

Uma conta Gestor que tentar acessar as rotas de Usuário é redirecionada de
volta pro Painel Administrativo — os dois mundos não se misturam na
navegação.

---

## 8. Deploy

| Peça | Onde roda | Observação |
|---|---|---|
| Backend (Django) | **Render** (plano gratuito) | Sobe via `gunicorn`; roda migração do banco automaticamente a cada deploy |
| Banco de dados | **Supabase** (Postgres) | Conectado só por `DATABASE_URL` |
| Frontend (React) | **Vercel** | Aponta pro backend via `VITE_API_URL` |

Variáveis de ambiente do backend (nomes, sem valores):
`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `DATABASE_URL`, `RESEND_API_KEY`,
`DEFAULT_FROM_EMAIL`, `FRONTEND_URL`, `DATABASE_QUOTA_GB`.

---

## 9. Pontos de atenção conhecidos

Registrado aqui pra não depender da memória de ninguém:

- **CORS liberado pra qualquer origem** (`CORS_ALLOW_ALL_ORIGINS = True`) —
  decisão de fase inicial, marcada no próprio código pra ser restringida
  mais adiante.
- **Sessão guardada em `localStorage`** (não em cookie protegido) — troca
  consciente de simplicidade por uma exposição maior a XSS, também já
  sinalizada no código como algo a revisitar.
- **`README.md` da raiz está desatualizado** — só descreve a parte mais
  antiga do projeto (app `api_rest`, endpoint de leituras). Este documento
  é a referência mais atual da arquitetura como um todo.
- **Console de SQL e botão de restauração de banco não existem de
  propósito** — foram avaliados e descartados por risco (vazamento de
  dado sensível, ação irreversível de um clique) na tela de Manutenção.

---

## 10. Outros documentos em `docs/`

- `regras-de-negocio.md` — as regras de negócio (RN01 em diante) por trás
  de cada comportamento do sistema, com rastreabilidade ao código.
- `relatorio-cadastro-credenciamento.md` — como funciona o cadastro e o
  token de credenciamento do Gestor em detalhe.
- `relatorio-implementacao-multi-tenant.md` — como o sistema suporta
  várias contas/estações compartilhando a mesma base.
