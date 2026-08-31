# Relatório — Backend multi-tenant (Gestor/Usuário/Estação/Plano)

Data: 2026-08-31
Escopo: só backend Django (`api_django_lora`), conforme combinado — frontend
React e firmware ESP32 **não foram alterados**.

## O que foi implementado

### 1. App novo `contas/` — contas e planos
- `Usuario` (`AUTH_USER_MODEL` customizado, estende `AbstractUser`) com
  campo `role` (`gestor`/`usuario`) — Gestor e Usuário são o mesmo model,
  diferenciados só por permissão (RN01-RN20).
- `Funcionalidade` — catálogo de recursos/modelos liberáveis por plano.
- `Plano` — Standard/Pro/Plus, com `max_estacoes`, `dias_historico`,
  `canais_alerta` e M2M para `Funcionalidade` (RN21-RN24).
- `Assinatura` — vínculo Usuário↔Plano com histórico (RN25) e constraint
  no banco que impede duas assinaturas ativas simultâneas.
- `LogAuditoria` — rastro de ações críticas do Gestor (RN05), genérico via
  `GenericForeignKey` (aponta pra `Usuario`, `Estacao` ou `Plano`).
- `contas/admin.py` — todos os models registrados no Django Admin
  (inclusive `filter_horizontal` em Plano, pra marcar/desmarcar
  Funcionalidades sem precisar de deploy — RN24 na prática).
- `contas/views.py` + `contas/urls.py` — login JWT
  (`POST /api/auth/token/`, `POST /api/auth/token/refresh/`) e ViewSets:
  `UsuarioViewSet` (+ actions `suspender`/`reativar`), `PlanoViewSet`,
  `FuncionalidadeViewSet`, `AssinaturaViewSet` (+ action `trocar_plano`,
  que aplica RN25/RN26).

### 2. `api_rest/` — telemetria ganhou dono
- `Estacao` (nova entidade): identificador único, `dono` (FK pra
  `Usuario`), token de API com hash (`gerar_token`/`verificar_token`),
  intervalo de envio esperado, `esta_offline` calculado (RN14-RN17).
- `Leitura` ganhou `estacao` (FK nullable) e `inconsistente` +
  `motivo_inconsistencia` (RN18). **`sensor_id` continua existindo e
  funcionando exatamente como antes** — o ESP32 não precisa de nenhuma
  mudança de firmware.
- `SolicitacaoRssi` também ganhou `estacao` (mesma lógica de resolução).
- `api_rest/validacao.py` (novo) — `detectar_inconsistencia()`: sinaliza
  temperatura/umidade/pressão fora de faixa plausível, mas **nunca
  rejeita o POST** (RN18 pede armazenamento pra auditoria, não descarte).
- `api_rest/permissions.py` (novo): `EhGestor` (RN01), `EhGestorOuDonoDaEstacao`
  (RN06/RN07), `RecursoDoPlano` (RN09/RN11 — bloqueia recurso fora do
  plano sem vazar dado; pronta pra usar quando o primeiro endpoint de
  modelo preditivo existir).
- Views atualizadas: ingestão (`POST /api/leituras`) e
  `GET /api/rssi/status/` **continuam abertas** (é o hardware quem chama,
  sem token, por enquanto); todo o resto passou a exigir login e a
  filtrar por dono da estação. Novo `EstacaoViewSet` (`/api/estacoes/`):
  só o Gestor cadastra/remove, respeitando o limite de estações do plano
  do dono (RN10).

### 3. Autenticação
- JWT via `djangorestframework-simplejwt` (access 30 min, refresh 7 dias,
  com rotação). Adicionado a `requirements.txt`.
- `REST_FRAMEWORK` no `settings.py`: padrão do projeto agora é
  `IsAuthenticated` — as views que o ESP32 chama diretamente têm
  `permission_classes = [AllowAny]` explícito nelas mesmas, como exceção
  visível (não como ausência de configuração, que era o estado anterior).

## Testes

**46 testes, todos passando** (`contas/tests.py` + `api_rest/tests.py`),
cobrindo:
- Login JWT (credenciais certas/erradas, endpoint protegido sem token).
- Gestor vê/administra tudo; Usuário comum só vê a si mesmo e às próprias
  estações/leituras (isolamento testado nos dois sentidos — GET lista e
  GET detalhe).
- Usuário não consegue se autopromover a Gestor via payload.
- Suspensão de conta pelo Gestor + registro em `LogAuditoria`.
- Troca de plano: primeira assinatura, upgrade mantendo histórico,
  bloqueio de reassinar o mesmo plano (RN26), Gestor trocando plano de
  terceiros + auditoria, e a constraint de unicidade no banco.
- Ingestão de leitura: continua aberta, funciona com ou sem `Estacao`
  cadastrada, liga a leitura à `Estacao` certa e atualiza
  `ultima_transmissao_em`, marca `inconsistente` quando fora de faixa.
- Pedido de RSSI: dono pode pedir, outro usuário não (404, não vaza
  existência da estação), fluxo de fechamento automático da solicitação
  preservado.
- `EstacaoViewSet`: só Gestor cria, limite de estações do plano é
  respeitado mesmo quando é o Gestor cadastrando para outro usuário.
- `RecursoDoPlano`: testado isoladamente (sem view real ainda) — Gestor
  sempre passa, usuário sem assinatura é bloqueado, plano sem o recurso é
  bloqueado, plano com o recurso libera, assinatura inadimplente bloqueia
  mesmo com o plano certo.

Além da suíte automatizada, rodei um smoke test manual com o servidor de
verdade (`runserver`) e `curl`: login, ingestão sem token, leitura com
token filtrando por dono, e acesso negado (403) a `/api/usuarios/` para
usuário comum — tudo bateu com o esperado.

**Importante: nada disso tocou o banco de produção (Supabase).** Todas as
migrations, testes e o smoke test rodaram contra um SQLite isolado em
`/tmp` (`DATABASE_URL` sobrescrita só nesses comandos). O `.env` do
projeto (que aponta pro Supabase) não foi alterado.

## Decisões de design (resumo — motivos completos nos comentários do código)

- **Um único model `Usuario`** com `role`, não duas tabelas Gestor/Usuário
  — os dois logam do mesmo jeito, a diferença é de permissão.
- **`Leitura.sensor_id` não foi removido**, só ganhou uma FK `estacao`
  nullable resolvida automaticamente — zero mudança de firmware exigida
  agora ou depois (quando o token de estação for ligado, só a permissão
  da view de ingestão muda, não o modelo de dados).
- **Token de Estação fica guardado como hash** (`make_password`), nunca
  em texto puro — mesmo mecanismo de senha do Django. Existe (`gerar_token`
  no model e uma action no Admin) mas **não está sendo cobrado ainda**: a
  view de ingestão continua `AllowAny` até o firmware ser adaptado.
- **Status "offline" é calculado, não persistido** — marcar de verdade
  exigiria um job periódico, que faz parte do motor de alertas (fora de
  escopo).
- **RN18 sinaliza, não rejeita** — dado ruim é armazenado com uma flag,
  nunca descartado no POST.

## O que fica de fora desta entrega (por decisão de escopo, não esquecimento)

- Motor de notificações/alertas (envio, dedup, retry, log de notificação
  — RN12/13/31-33).
- Integração de pagamento real (Stripe ou similar) — `trocar_plano`
  registra qual plano vale a partir de agora, mas não cobra ninguém.
- Exportação de relatórios (PDF/CSV).
- Qualquer mudança em frontend React ou firmware ESP32.
- Novos tipos de sensor ou modelos preditivos (RN27 continua com os
  campos atuais: temperatura, umidade, pressão, + `dados_adicionais`).

## ⚠️ Antes de colocar isso em produção — leia isto

Duas coisas que **exigem uma decisão sua**, não são só "rodar o deploy":

1. **A troca de `AUTH_USER_MODEL` no banco de produção precisa de uma
   manobra manual.** O Supabase já tem as tabelas `auth_user`/
   `django_admin_log` do Django padrão (vazias, ninguém nunca logou), mas
   *registradas* como migradas. Trocar para `contas.Usuario` exige, em
   produção, reverter e reaplicar essas migrations
   (`migrate admin zero && migrate auth zero`, depois `migrate` de novo)
   — seguro porque estão vazias, mas é uma operação estrutural que eu não
   rodei sozinho contra o banco real enquanto você estava fora. Faça isso
   numa janela de manutenção, com backup (`pg_dump`) antes. Posso fazer
   isso com você quando quiser, passo a passo.

2. **O dashboard atual vai parar de funcionar assim que isso for
   deployado**, porque o frontend não manda token nenhum hoje e a maioria
   dos GETs (leituras, RSSI solicitar) agora exige login. Só os dois
   endpoints que o ESP32 chama (`POST /api/leituras`, `GET /api/rssi/status/`)
   continuam abertos. Isso foi decisão sua (escopo só-backend), só
   reforçando o efeito prático: **não faça deploy disso até o login no
   frontend existir**, ou o dashboard em produção quebra.

## Próximos passos sugeridos (não implementados agora)

1. Tela de login no React + guardar/renovar o JWT no `services/api.js`.
2. Ligar o token de Estação no firmware do RX (o campo já existe).
3. Motor de alertas/notificações.
4. Integração de pagamento na página de assinatura.

## Arquivos tocados

Novos: `contas/` (app inteiro), `api_rest/permissions.py`,
`api_rest/validacao.py`, `api_rest/migrations/0004_*.py`,
`contas/migrations/0001_initial.py` e `0002_seed_planos.py`.

Editados: `api_rest/{models,serializers,views,urls,admin,tests}.py`,
`api_root/{settings,urls}.py`, `requirements.txt`.

Nada foi commitado — as mudanças estão só no working tree, pra você
revisar antes.
