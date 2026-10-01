FROM python:3.12-slim

WORKDIR /app

RUN groupadd -r django && useradd -r -g django -u 1000 django

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

RUN chown -R django:django /app
USER django

EXPOSE 8000

ENTRYPOINT ["docker/backend/entrypoint.sh"]
