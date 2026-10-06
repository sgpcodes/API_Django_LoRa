# Rodando o LACOP localmente (Raspberry Pi)

Esta é uma instalação local e independente do deploy em produção
(Render + Vercel + Supabase). Os dois caminhos não se afetam: o
`Dockerfile` na raiz é ignorado pelo Render (o `render.yaml` já define
`env: python` com build/start commands próprios).

Três containers:

- `db` — PostgreSQL 17, com os dados guardados em um volume nomeado
  (sobrevivem a `docker compose down` e a reinícios da Raspberry).
- `backend` — Django + Gunicorn, só acessível pelos outros containers
  (não expõe porta pro host).
- `web` — Nginx, servindo os arquivos estáticos do frontend (build do
  Vite) e repassando `/api/`, `/admin/` e `/static/` pro backend. É o
  único container com porta exposta (80).

## Pré-requisitos

- Docker e Docker Compose instalados na Raspberry Pi (ou qualquer
  máquina Linux/Mac).
- Este repositório clonado nela.

## Primeira vez

```bash
cp .env.docker.example .env.docker
```

Edite `.env.docker` e troque pelo menos `POSTGRES_PASSWORD` (lembrando
de repetir o mesmo valor dentro de `DATABASE_URL`, logo abaixo) e
`SECRET_KEY`. Ajuste `ALLOWED_HOSTS` e `FRONTEND_URL` para o hostname
ou IP pelo qual a Raspberry vai ser acessada na rede local.

```bash
docker compose --env-file .env.docker up -d --build
```

O `--env-file .env.docker` é necessário em todo comando `docker compose`
deste projeto — é o que diz pro Compose usar `POSTGRES_DB`/`POSTGRES_USER`/
`POSTGRES_PASSWORD` do jeito que o container `db` espera (o Compose só lê o
arquivo `.env` automaticamente, e aqui usamos `.env.docker` de propósito
pra não colidir com o `.env` do Mac/Render).

Na primeira subida, o backend aplica as migrations automaticamente
(`entrypoint.sh`) antes de iniciar o Gunicorn.

Depois disso, acesse pelo navegador em `http://<ip-ou-hostname-da-raspberry>/`.

Pra criar um usuário administrador:

```bash
docker compose --env-file .env.docker exec backend python manage.py createsuperuser
```

## No dia a dia

```bash
docker compose --env-file .env.docker up -d              # subir
docker compose --env-file .env.docker logs -f backend    # acompanhar logs do backend
docker compose --env-file .env.docker down                # parar (mantém os dados do Postgres)
```

Depois de puxar atualizações do repositório:

```bash
docker compose --env-file .env.docker up -d --build
```

## Backup local + sincronização com a nuvem

Quando o ESP32 (RX) está apontado pra Raspberry em vez de direto pra
nuvem (ver `esp32-lora-climate/rx/src/config_Wifi.h` no repositório do
firmware), as leituras continuam chegando mesmo sem internet — ficam
guardadas no Postgres local até a conexão voltar.

Isso só funciona se `CLOUD_DATABASE_URL` estiver preenchida em
`.env.docker` (mesma connection string do Supabase usada no Render, em
`DATABASE_URL`). Com isso configurado, o backend passa a:

1. Tentar, a cada `SYNC_INTERVAL_SECONDS` (padrão 5 min), enviar pra
   nuvem as leituras que só existem localmente.
2. Apagar cada leitura do banco local só depois de confirmar que ela foi
   salva com sucesso na nuvem — o banco local nunca vira uma cópia
   permanente, é só um buffer enquanto durar a queda de conexão.
3. Se a nuvem estiver inacessível, não faz nada (sem erro) e tenta de
   novo no próximo ciclo — seguro deixar rodando o tempo todo.

**Antes de ligar a sincronização**, a Raspberry precisa conhecer
localmente a Estação (e o Usuário vinculado a ela) que ela vai operar —
isso é feito uma vez, puxando da nuvem:

```bash
docker compose --env-file .env.docker exec backend python manage.py importar_estacao_da_nuvem ESP32_01
```

(troque `ESP32_01` pelo identificador real da estação, já cadastrada
pelo Gestor no sistema web). Isso copia a Estação e seus Usuários pra
dentro do banco local — sem isso, a ligação de uma leitura recebida
localmente com sua Estação/Usuário correto não acontece.

Pra sincronizar manualmente a qualquer momento (sem esperar o ciclo
automático):

```bash
docker compose --env-file .env.docker exec backend python manage.py sincronizar_leituras
```
