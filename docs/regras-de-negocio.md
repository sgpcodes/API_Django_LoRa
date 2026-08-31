# Regras de Negócio — Sistema de Monitoramento Meteorológico (LACOP/UFF)

> Uma regra de negócio descreve uma política ou restrição do domínio —
> "o que deve ser verdade" no funcionamento do sistema — independente
> de como isso foi codificado. Por isso, cada regra abaixo é enunciada
> em linguagem de domínio (ator, gatilho, condição), sem referência a
> arquivo/função/linha. A prova de que cada regra está de fato
> implementada (rastreabilidade ao código) fica isolada no
> [Anexo A](#anexo-a--matriz-de-rastreabilidade), no final do documento,
> para não competir com a leitura das regras em si.

**Atores do domínio:**

- **TX** — ESP32 transmissor, junto ao sensor DHT11 (temperatura/umidade).
- **RX** — ESP32 receptor, ponte entre o TX (via LoRa) e o dashboard (via WiFi/HTTP).
- **Usuário** — quem opera o dashboard web.
- **Backend** — API Django que recebe as leituras e serve o dashboard.

---

## 1. Coleta e Envio de Leituras

| ID | Tipo | Ator | Gatilho |
|---|---|---|---|
| RN01 | Restrição temporal | TX | Temporizador interno |
| RN02 | Restrição de integridade | TX / RX | A cada transmissão |
| RN03 | Condição de disparo | RX | Par completo recebido no ciclo |
| RN04 | Restrição de política | RX | Falha no envio ao backend |

**RN01 — Periodicidade fixa de coleta**
O TX deve coletar e transmitir temperatura e umidade em intervalos
fixos de 60 segundos, sem depender de solicitação externa.

**RN02 — Identificação e integridade de cada valor transmitido**
Cada valor transmitido pelo TX deve ser identificado por um comando
específico (temperatura ou umidade) e acompanhado de um código de
verificação (CRC16), que o RX deve validar antes de aceitar o valor.

**RN03 — Leitura só é enviada com o par completo**
O RX só deve encaminhar uma leitura ao backend quando tiver recebido,
dentro do mesmo ciclo, tanto a temperatura quanto a umidade do TX.
Receber só um dos dois não é suficiente para gerar uma leitura.

**RN04 — Falha de envio não gera reenvio retroativo**
Se o envio de uma leitura ao backend falhar (rede indisponível, erro
do servidor etc.), o sistema não deve tentar reenviar esse dado depois
— ele é descartado e o RX segue normalmente para o próximo ciclo.

---

## 2. Qualidade de Enlace (RSSI/SNR)

| ID | Tipo | Ator | Gatilho |
|---|---|---|---|
| RN05 | Ação-gatilho | Usuário → RX | Clique em "Analisar" no dashboard |
| RN06 | Restrição de política | RX | A cada ciclo de leitura |
| RN07 | Regra de transição de estado | Backend | Chegada de uma leitura com RSSI |
| RN08 | Regra de cálculo/transformação | RX | Leitura do módulo de rádio |

**RN05 — Consulta de sinal só sob demanda**
A qualidade do sinal do rádio (RSSI/SNR) só deve ser consultada quando
existir, no momento do ciclo do RX, uma solicitação de análise
pendente — e essa solicitação só pode ser originada por uma ação do
usuário no dashboard.

**RN06 — Sem consulta automática de RSSI/SNR**
Nenhuma leitura de temperatura/umidade deve, por si só, disparar uma
consulta de RSSI/SNR. A ausência de uma solicitação pendente é o
estado padrão do sistema.

**RN07 — Encerramento automático da solicitação**
Uma solicitação de análise deixa de ser pendente automaticamente assim
que uma leitura contendo o resultado do RSSI chega ao backend — não é
necessária nenhuma ação manual do usuário para "fechar" o pedido.

**RN08 — Conversão para unidade real**
O valor de potência de sinal (RSSI) deve ser convertido do formato
bruto retornado pelo módulo de rádio para dBm real antes de ser
armazenado ou exibido ao usuário.

---

## 3. Protocolo de Comunicação (LoRa)

| ID | Tipo | Ator | Gatilho |
|---|---|---|---|
| RN09 | Restrição de integridade | TX / RX | A cada mensagem trocada entre rádios |
| RN10 | Restrição temporal | TX / RX | A cada operação de rádio |

**RN09 — Toda mensagem entre rádios deve ser íntegra**
Toda mensagem trocada entre os dois rádios LoRa deve ser validada por
CRC16. Uma mensagem corrompida deve ser descartada silenciosamente —
sem interromper a execução do dispositivo que a recebeu.

**RN10 — Toda operação de rádio tem tempo-limite**
Nenhuma operação de rádio (comando + espera de resposta) pode esperar
indefinidamente. Se o tempo-limite for atingido sem resposta, isso
deve ser tratado como uma falha comum — não como um erro fatal.

---

## 4. Persistência e Conectividade

| ID | Tipo | Ator | Gatilho |
|---|---|---|---|
| RN11 | Regra de valor derivado | Backend | Leitura sem data/hora informada |
| RN12 | Restrição de opcionalidade | Backend | Leitura sem dados de RSSI/SNR |
| RN13 | Ação-gatilho | RX | Necessidade de conexão WiFi |

**RN11 — Toda leitura tem data/hora de recebimento**
Toda leitura aceita pelo backend deve ficar associada a uma data/hora.
Se o dispositivo não informar esse dado no envio, o backend deve
assumir o instante em que a requisição foi recebida.

**RN12 — RSSI/SNR nunca bloqueiam o registro da leitura**
A ausência de dados de qualidade de enlace (RSSI/SNR) em uma leitura
não é um erro — a leitura de temperatura/umidade deve ser registrada
normalmente mesmo sem esse dado.

**RN13 — Conexão automática entre redes conhecidas**
O RX deve ser capaz de se conectar automaticamente a qualquer rede
WiFi que já esteja pré-cadastrada nele, sem exigir reconfiguração
manual, desde que uma dessas redes esteja no alcance.

> **Nuance:** esta regra vale para redes **já cadastradas previamente**
> no firmware (hoje, duas). Trocar de local só dispensa reconfiguração
> se o novo local usar uma dessas redes conhecidas — o RX não descobre
> nem se conecta a redes novas sozinho.

---

## Anexo A — Matriz de Rastreabilidade

Evidência de implementação de cada regra, para consulta/auditoria.
Repositórios: `api_django_lora` (backend Django + frontend React) e
`esp32-lora-climate` (firmware, pastas `tx` e `rx`).

| ID | Repositório / Arquivo | Onde |
|---|---|---|
| RN01 | `esp32-lora-climate/tx/src/main.cpp` | `intervaloEnvio = 60000` (L12); checagem no `loop()` (L41) |
| RN02 | `esp32-lora-climate/tx/src/main.cpp` + `config_Lora_test.h`; `rx/src/config_Lora.h` | `CMD_TEMPERATURA`/`CMD_UMIDADE` (L7-8); `ComputeCRC()`; `readResponse()` (L63-85) valida e descarta se inválido |
| RN03 | `esp32-lora-climate/rx/src/main.cpp` | Flags `temperaturaRecebida`/`umidadeRecebida` (L12-13); condição (L55) |
| RN04 | `esp32-lora-climate/rx/src/api_dashboard.cpp` | `enviarParaDashboard()` (L62-116): loga e retorna em falha, sem fila de retry |
| RN05 | `frontend/src/pages/DadosLora.jsx` (`aoClicarAnalisar`, L91) → `api_rest/views.py` (`RssiSolicitarView`, L75-82) → `esp32-lora-climate/rx/src/api_dashboard.cpp` (`verificarSolicitacaoRSSI`, L36-60) → `rx/src/main.cpp` (L60) |
| RN06 | `esp32-lora-climate/rx/src/main.cpp` (L60) | Curto-circuito `solicitado && getRSSI(3)` |
| RN07 | `api_rest/views.py` | `LeituraListCreateView.post()` (L52-59) |
| RN08 | `esp32-lora-climate/rx/src/config_Lora.h` | `getRSSI()` (L233-235): `rssiIda = -(int16_t)resp[5]` |
| RN09 | `esp32-lora-climate/rx/src/config_Lora.h` (espelhado em `tx/src/config_Lora_test.h`) | `ComputeCRC()` + `readResponse()` (L37-85) |
| RN10 | `esp32-lora-climate/rx/src/config_Lora.h` | Parâmetro `timeoutMs` de `readResponse()` (L63, L68); 1000 ms padrão, 3000 ms no `getRSSI()` (L223) |
| RN11 | `api_django_lora/api_rest/serializers.py` | `LeituraSerializer.data_hora` com `default=timezone.now` |
| RN12 | `api_django_lora/api_rest/models.py` | `dados_adicionais = models.JSONField(default=dict, blank=True)` |
| RN13 | `esp32-lora-climate/rx/src/api_dashboard.cpp` | `WiFiMulti` + `addAP()` (L10, L14-15); `wifiMulti.run()` (L19, L68) |

---

## Anexo B — Notas técnicas (fora do escopo das regras de negócio)

Achados durante a verificação do código que não são regra de negócio,
mas valem registrar:

1. **`config_Lora_test.h` está ativo em produção.** O `tx/src/main.cpp`
   inclui `config_Lora_test.h` (não `config_Lora.h`) — e é essa versão
   "de teste" que tem a validação de CRC/timeout corretas; o
   `config_Lora.h` "definitivo" é uma versão mais antiga, sem essa
   validação, e está sem uso. Vale renomear antes de qualquer revisão
   externa do repositório do firmware, para não sugerir que o código em
   produção é o não-validado.
2. **Credenciais de WiFi em texto puro** em
   `esp32-lora-climate/rx/src/config_Wifi.h`. Não afeta nenhuma regra
   de negócio, mas é um ponto comum de pergunta em banca/revisão de
   segurança.
