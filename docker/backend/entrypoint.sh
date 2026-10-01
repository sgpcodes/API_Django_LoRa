#!/bin/sh
set -e

python manage.py migrate --noinput

exec gunicorn api_root.wsgi \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}"
