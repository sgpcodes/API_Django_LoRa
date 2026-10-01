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
