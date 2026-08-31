# Relatório — Cadastro público + Credenciamento por token

Data: 2026-08-31 (madrugada)
Escopo: telas de Cadastro e Login (baseadas nas imagens enviadas), com o
mecanismo de "conta credenciada" via token (hoje "Lacop22"). Backend
mudou pra sustentar isso; frontend ganhou as duas telas.

## Como ficou o fluxo

- **`/planos`** (pública) — continua igual, vitrine sem ação de fato,
  agora com um botão "Criar conta" no rodapé além do "Entrar como
  gerenciador" que já existia.
- **`/cadastro`** (pública, nova) — layout no estilo da imagem que você
  mandou: painel de marca à esquerda, formulário à direita. Dois
  caminhos, alternados por um link **acima do botão principal**
  ("Tenho um token de credenciamento"):
  - **Com plano**: escolhe Standard/Pro/Plus (dados reais, vindos do
    backend — inclusive preço: Standard grátis, Pro R$49, Plus R$99) →
    cria Usuário comum com aquela assinatura.
  - **Credenciada**: digita o token da organização (**Lacop22**, por
    enquanto) → cria conta como **Gestor**, sem precisar de plano. Token
    errado é rejeitado com mensagem clara.
  - Nos dois casos, a pessoa já sai logada (sem precisar fazer login
    de novo depois de cadastrar).
- **`/login`** (pública, reformulada) — mais simples que o cadastro:
  - Primeira vez neste navegador → formulário completo (usuário/e-mail +
    senha).
  - Depois de logar uma vez, a conta fica "salva neste navegador"; da
    próxima vez o login abre direto numa lista ("Quem está entrando?") —
    escolhe a conta, digita só a senha. Dá pra remover uma conta salva ou
    usar outra do zero. **Isso é o que resolve o "ter mais de uma
    conta"**: você pode salvar tanto uma conta credenciada (gestora)
    quanto uma conta comum (sua estação) neste mesmo navegador e alternar
    entre elas sem redigitar o e-mail toda vez — não são duas sessões
    simultâneas, é uma de cada vez, mas trocar é rápido.
  - Se a conta é Gestor mas o token dela **não é mais o mais recente**
    (rotacionou), depois da senha certa aparece uma etapa extra
    ("Credenciamento atualizado") pedindo o token novo — só depois disso
    ela recupera o acesso de Gestor. Tem uma saída ("Entrar sem
    privilégios de gestor por enquanto") pra não travar quem só precisa
    entrar rapidinho.

Confirmando o que você me lembrou: os planos (Standard/Pro/Plus) **não
têm nenhuma tela própria ainda** — só existem como opção no cadastro. O
dashboard que já existe (`/app`) continua sendo, na prática, a "área
credenciada" — só quem é Gestor de verdade (token válido) usa ele hoje.

## Como funciona a troca do token por trás (a parte que você pediu pra garantir)

- O token nunca é guardado em texto puro — é um hash, igual senha.
- Cada troca de token cria uma **versão nova** (nunca edita a antiga) —
  histórico completo de quando cada rotação aconteceu, pra auditoria.
- Cada conta credenciada guarda **com qual versão** ela foi credenciada.
  Se a versão atual do token mudar, a conta perde o efeito de Gestor
  automaticamente (em qualquer lugar do sistema que já checava
  `eh_gestor`, sem precisar mexer em mais nada) até digitar o token novo.
- **Importante**: isso só vale pra quem virou Gestor pelo cadastro
  público com token. Uma conta que você promover a Gestor manualmente
  (pelo Django Admin, por exemplo) não é afetada por rotação nenhuma —
  já testei isso separadamente pra garantir que não vira um jeito de
  "trancar a si mesma" por engano.
- **Trocar o token**: `/admin/` → "Tokens de credenciamento" → "Adicionar"
  → digita o novo valor em texto puro → salva. Ele vira hash na hora, não
  tem como ver de novo depois (nem você).

## Testes

**60 testes de backend, todos passando** (14 novos: cadastro com plano,
cadastro credenciado, token errado rejeitado, e-mail duplicado rejeitado,
senha≠confirmação rejeitada, rotação derruba só quem veio do token
público, recredenciar restaura o acesso, token antigo não vale mais
depois de rotacionar, etc.).

Testei os dois fluxos completos num navegador de verdade (Playwright),
com screenshot de cada tela — inclusive o caso de ponta a ponta de
**rotacionar o token de verdade e confirmar que a conta credenciada fica
bloqueada até digitar o valor novo**. Tudo bateu:

1. `/cadastro` mostra os 3 planos com preço real ✅
2. Cadastro com plano → vira Usuário, cai logado no dashboard ✅
3. Cadastro credenciado com "Lacop22" → vira Gestor, cai logado ✅
4. Cadastro credenciado com token errado → erro, não cria conta ✅
5. `/login` sem conta salva → formulário completo ✅
6. `/login` com conta salva → lista, escolhe, só senha ✅
7. Token rotacionado → login pede recredenciamento em vez de entrar ✅
8. Token novo errado → rejeitado ✅
9. Token novo certo → restaura acesso, cai no dashboard ✅

Nenhum erro de console além dos 400/401 esperados (senha errada, token
errado — a própria validação que estava sendo testada).

**De novo: nada tocou o Supabase de produção.** Tudo rodou contra o
mesmo SQLite isolado em `/tmp` de antes.

## Decisões que tomei sem te perguntar de novo (documentando por
transparência)

- **CPF**: campo novo em `Usuario`, guardado como texto simples, sem
  validação de dígito verificador — é só cadastro, nenhuma regra de
  negócio usa isso ainda.
- **E-mail = usuário de login**: o cadastro só pede e-mail (como na
  imagem, sem campo de "usuário" separado); esse e-mail vira o
  `username` de login também — por isso "logar com usuário ou e-mail"
  já funciona sozinho pra quem se cadastra por aqui.
- **Ilustração da tela de cadastro**: troquei o desenho 3D (nuvem, sol,
  estação com gráficos) por um ícone simples (nuvem+sol) no estilo do
  resto do app — não consigo gerar uma ilustração customizada como
  aquela, só código. Se quiser aquela arte de verdade, me manda o
  arquivo (SVG/PNG) que eu encaixo no lugar certo.
- Preço dos planos (R$0 / R$49 / R$99) que você via na imagem: apliquei
  esses valores nos planos reais do banco (antes estavam sem preço) —
  ajustável no admin a qualquer momento.

## Arquivos tocados

**Backend**: `contas/models.py` (TokenCredenciamento + campos novos em
Usuario), `contas/serializers.py` (CadastroSerializer,
RecredenciarSerializer, claim `precisa_recredenciar` no JWT,
`funcionalidades_detalhe` no PlanoSerializer), `contas/views.py`
(CadastroView, RecredenciarView, planos públicos), `contas/urls.py`,
`contas/admin.py` (rotação do token), `contas/tests.py` (+14 testes),
`contas/migrations/0003-0005`.

**Frontend**: `pages/Cadastro.jsx` + `.module.css` (novo),
`pages/Login.jsx` + `.module.css` (reescrito), `services/authService.js`
(cadastrar, recredenciar, contas salvas), `services/planosService.js`
(novo), `pages/Planos.jsx` (link novo no rodapé), `App.jsx` (rota
`/cadastro`).

Nada foi commitado — igual da última vez, deixei pra você revisar antes.

## Pendente de decisão sua (não bloqueante, só pra saber que existe)

- O token "Lacop22" está valendo em produção quando isso for deployado —
  convém trocar pra um valor de verdade antes de divulgar o cadastro
  publicamente (é literalmente a chave que dá acesso de Gestor).
- Continua valendo o aviso de antes: isso tudo só entra no ar depois da
  manobra de migração no Supabase + login funcionando (já funciona
  agora) — nada mudou nessa frente.
