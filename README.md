# API de Monitoramento Meteorológico

API backend em Python/Django para receber leituras de sensores e salvar em MongoDB.

## Tecnologias usadas

- Python
- Django
- Django REST Framework
- MongoDB
- Render (deploy)

## Estrutura do projeto

```
api_django_lora/
├── .env.example
├── .gitignore
├── Procfile
├── README.md
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
└── api_rest/
    ├── __init__.py
    ├── mongo.py
    ├── serializers.py
    ├── urls.py
    ├── views.py
    ├── models.py
    ├── admin.py
    ├── apps.py
    └── tests.py
```

## O que cada arquivo faz

- `manage.py`: utilitário do Django para rodar servidor, migrar banco e testes.
- `api_root/settings.py`: configurações principais do Django, incluindo MongoDB, CORS e variáveis de ambiente.
- `api_root/urls.py`: define o ponto de entrada `/api/` para o app de leituras.
- `api_rest/urls.py`: define as rotas REST para listar, criar e consultar leituras.
- `api_rest/views.py`: contém a lógica de API para receber e retornar leituras.
- `api_rest/serializers.py`: valida os dados enviados pelo sensor antes de salvar.
- `api_rest/mongo.py`: gerencia a conexão com o MongoDB.
- `api_rest/models.py`: arquivo explicativo do app; não usamos modelos Django para leituras.
- `.env.example`: exemplo de variáveis de ambiente necessárias.
- `requirements.txt`: dependências do projeto.
- `Procfile` / `render.yaml`: configuração para deploy no Render.

## Endpoints disponíveis

- POST `/api/leituras/`
  - Recebe uma leitura enviada pela ESP32 receptora (via LoRa) e salva no MongoDB.
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
- `MONGO_URI`: URI de conexão com MongoDB.
- `MONGO_DB_NAME`: nome do banco de dados MongoDB.

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
4. Ajuste `MONGO_URI` se necessário e verifique se o MongoDB está rodando.
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

1. Crie um novo serviço web no Render.
2. Aponte para este repositório.
3. Use `python` como ambiente.
4. Defina o comando de start:
   ```bash
   gunicorn api_root.wsgi --bind 0.0.0.0:$PORT
   ```
5. Defina as variáveis de ambiente no Render:
   - `SECRET_KEY`
   - `DEBUG=False`
   - `ALLOWED_HOSTS=<seu-dominio>.onrender.com`
   - `MONGO_URI`
   - `MONGO_DB_NAME`

> Dica: no Render, `MONGO_URI` pode apontar para MongoDB Atlas ou para um MongoDB hospedado fora do Render.

## Observações

- O backend salva as leituras no MongoDB.
- A API foi criada apenas para o backend, sem frontend.
- O projeto foi mantido simples, com arquivos separados por responsabilidade.
