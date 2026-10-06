#!/bin/sh
set -e

python manage.py migrate --noinput

# Sincronização local -> nuvem em segundo plano (só roda se a instalação
# tiver CLOUD_DATABASE_URL configurada — ver .env.docker.example). Falha
# de conexão não derruba o container, só tenta de novo no próximo ciclo.
if [ -n "$CLOUD_DATABASE_URL" ]; then
    (
        while true; do
            python manage.py sincronizar_leituras
            sleep "${SYNC_INTERVAL_SECONDS:-300}"
        done
    ) &
fi

exec gunicorn api_root.wsgi \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}"
