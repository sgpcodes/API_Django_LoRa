"""
RN18 — dados fora de faixas fisicamente plausíveis devem ser sinalizados
como inconsistentes (e excluídos dos modelos preditivos), mas SEM
prejuízo do armazenamento para auditoria: por isso essa função só
classifica a leitura, nunca rejeita o POST.

Os limiares abaixo são ilustrativos (baseados em faixas fisicamente
plausíveis para estações terrestres) — ajustar com quem define os
parâmetros reais de cada instalação antes de produção.
"""

TEMPERATURA_MIN, TEMPERATURA_MAX = -50, 60  # °C
UMIDADE_MIN, UMIDADE_MAX = 0, 100  # %
PRESSAO_MIN, PRESSAO_MAX = 300, 1100  # hPa


def detectar_inconsistencia(temperatura, umidade, pressao=None):
    """Retorna (inconsistente: bool, motivo: str) para uma leitura.
    `pressao` é opcional porque o campo já é opcional no model (nem toda
    estação tem esse sensor)."""
    motivos = []

    if temperatura is not None and not (TEMPERATURA_MIN <= temperatura <= TEMPERATURA_MAX):
        motivos.append(f'temperatura {temperatura} fora da faixa plausível ({TEMPERATURA_MIN} a {TEMPERATURA_MAX}°C)')

    if umidade is not None and not (UMIDADE_MIN <= umidade <= UMIDADE_MAX):
        motivos.append(f'umidade {umidade} fora da faixa plausível ({UMIDADE_MIN} a {UMIDADE_MAX}%)')

    if pressao is not None and not (PRESSAO_MIN <= pressao <= PRESSAO_MAX):
        motivos.append(f'pressão {pressao} fora da faixa plausível ({PRESSAO_MIN} a {PRESSAO_MAX} hPa)')

    return bool(motivos), '; '.join(motivos)
