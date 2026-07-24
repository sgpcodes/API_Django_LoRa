# Este app não usa "models.Model" do Django.
#
# O motivo é simples: os dados das leituras meteorológicas são salvos no
# MongoDB (um banco não-relacional, sem schema fixo), e não no banco
# relacional configurado em DATABASES (settings.py) — esse último serve
# apenas para as tabelas internas do Django, como autenticação e sessões.
#
# Por isso, o formato de uma "leitura" (sensor_id, temperatura, umidade,
# pressao, data_hora) é definido diretamente no serializer, em
# api_rest/serializers.py. A conexão com o MongoDB fica em api_rest/mongo.py.
