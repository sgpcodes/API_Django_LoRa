# API de Monitoramento Meteorológico

API backend em Python/Django para receber leituras de sensores (ESP32 + LoRa) e salvar em PostgreSQL, com um dashboard React para visualização.

## Tecnologias usadas

- Python
- Django + Django REST Framework
- PostgreSQL (Supabase)
- React (frontend, pasta `frontend/`)
- Render (deploy)

## Estrutura do projeto

```
api_django_lora/
├── .env.example
├── .gitignore
├── Procfile
├── README.md
├── render.yaml
├── requirements.txt
├── manage.py
├── api_root/
│   ├── __init__.py
│   ├── asgi.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── api_rest/
│   ├── __init__.py
│   ├── models.py
│   ├── serializers.py
│   ├── urls.py
│   ├── views.py
│   ├── migrations/
│   ├── admin.py
│   ├── apps.py
│   └── tests.py
└── frontend/        (dashboard React, ver frontend/README.md)
```

## O que cada arquivo faz

- `manage.py`: utilitário do Django para rodar servidor, migrar banco e testes.
- `api_root/settings.py`: configurações principais do Django, incluindo banco de dados, CORS e variáveis de ambiente.
- `api_root/urls.py`: define o ponto de entrada `/api/` para o app de leituras.
- `api_rest/urls.py`: define as rotas REST para listar, criar e consultar leituras.
- `api_rest/views.py`: contém a lógica de API para receber e retornar leituras.
- `api_rest/serializers.py`: valida os dados enviados pelo sensor antes de salvar.
- `api_rest/models.py`: model `Leitura` (Django ORM/PostgreSQL).
- `.env.example`: exemplo de variáveis de ambiente necessárias.
- `requirements.txt`: dependências do projeto.
- `Procfile` / `render.yaml`: configuração para deploy no Render.

## Endpoints disponíveis

- POST `/api/leituras/`
  - Recebe uma leitura enviada pela ESP32 receptora (via LoRa) e salva no PostgreSQL.
  - A chave do payload é `sensor` (é o que a ESP32 envia), guardada internamente como `sensor_id` — o mesmo nome que o frontend já espera.
  - `data_hora` é gerada automaticamente pela API caso não venha no payload.
  - Exemplo de payload:
    ```json
    {
      "sensor": "ESP32_01",
      "temperatura": 24.5,
      "umidade": 68.2,
      "pressao": 1018.5,
      "dados_adicionais": {
        "altitude": 120,
        "co2": 410
      }
    }
    ```
  - Resposta em caso de sucesso:
    ```json
    {
      "status": "success",
      "message": "Leitura salva com sucesso."
    }
    ```
- GET `/api/leituras/`
  - Lista todas as leituras, da mais recente para a mais antiga.
  - Pode filtrar por sensor:
    `/api/leituras/?sensor_id=ESP32_01`
- GET `/api/leituras/<id>/`
  - Busca uma leitura específica pelo ID.

## Variáveis de ambiente

Use `.env.example` como base e crie um arquivo `.env` na raiz do projeto.

- `SECRET_KEY`: chave secreta do Django.
- `DEBUG`: `True` em desenvolvimento, `False` em produção.
- `ALLOWED_HOSTS`: domínios permitidos, separados por vírgula.
- `DATABASE_URL`: string de conexão do PostgreSQL (local ou Supabase).

## Executando localmente

1. Crie e ative um ambiente virtual:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```
2. Instale dependências:
   ```bash
   pip install -r requirements.txt
   ```
3. Copie o arquivo de ambiente:
   ```bash
   cp .env.example .env
   ```
4. Ajuste `DATABASE_URL` (Postgres local ou Supabase).
5. Execute migrações do Django:
   ```bash
   python manage.py migrate
   ```
6. Inicie o servidor:
   ```bash
   python manage.py runserver
   ```
7. Acesse a API:
   - `http://127.0.0.1:8000/api/leituras/`

## Deploy no Render

1. Crie um banco PostgreSQL gratuito no [Supabase](https://supabase.com) e copie a connection string (Project Settings → Database → Connection string → URI).
2. No Render, crie um novo Blueprint apontando para este repositório (usa o `render.yaml` já configurado com plano free).
3. Defina as variáveis de ambiente no Render:
   - `SECRET_KEY`
   - `DEBUG=False`
   - `ALLOWED_HOSTS=<seu-dominio>.onrender.com`
   - `DATABASE_URL` (a connection string do Supabase)
4. O build já roda `collectstatic` e `migrate` automaticamente (ver `render.yaml`).

## Observações

- O backend salva as leituras no PostgreSQL (Supabase em produção).
- O frontend React (pasta `frontend/`) consome esta API e mostra o dashboard.
- O projeto foi mantido simples, com arquivos separados por responsabilidade.
