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

# Coleta das estações tipo=online (Open-Meteo) em segundo plano — sempre
# ativo, sem variável de ambiente de controle: o próprio comando não faz
# nada quando não existe nenhuma estação online cadastrada.
(
    while true; do
        python manage.py coletar_dados_online
        sleep "${ONLINE_COLLECT_INTERVAL_SECONDS:-600}"
    done
) &

exec gunicorn api_root.wsgi \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}"
