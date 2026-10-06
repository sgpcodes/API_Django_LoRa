"""
Empurra as Leituras acumuladas no banco local ('default') para o banco da
nuvem ('nuvem', configurado via CLOUD_DATABASE_URL) e, só depois de
confirmar que cada uma foi salva com sucesso do outro lado, apaga essa
leitura do banco local — o local funciona como um buffer temporário
enquanto a internet está fora, não como uma cópia permanente.

Se CLOUD_DATABASE_URL não estiver configurada, ou se a nuvem estiver
inacessível agora, o comando simplesmente não faz nada (sem erro) — é
seguro chamar isso em loop (ver docker/backend/entrypoint.sh).

Uso:
    python manage.py sincronizar_leituras
"""

from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError

from api_rest.models import Estacao, Leitura


def nuvem_disponivel():
    if 'nuvem' not in connections.databases:
        return False
    try:
        connections['nuvem'].cursor()
        return True
    except OperationalError:
        return False


class Command(BaseCommand):
    help = 'Sincroniza leituras pendentes do banco local para a nuvem e apaga as já confirmadas.'

    def handle(self, *args, **options):
        if 'nuvem' not in connections.databases:
            self.stdout.write('CLOUD_DATABASE_URL não configurada — nada a sincronizar.')
            return

        if not nuvem_disponivel():
            self.stdout.write('Nuvem inacessível agora — tentando de novo no próximo ciclo.')
            return

        pendentes = Leitura.objects.using('default').select_related('estacao').order_by('data_hora')
        total_pendentes = pendentes.count()
        if total_pendentes == 0:
            self.stdout.write('Nada pendente para sincronizar.')
            return

        cache_estacoes = {}
        sincronizadas = 0
        falhas = 0

        for leitura in pendentes.iterator():
            try:
                estacao_nuvem = self._resolver_estacao_na_nuvem(leitura.estacao, cache_estacoes)

                Leitura.objects.using('nuvem').create(
                    sensor_id=leitura.sensor_id,
                    estacao=estacao_nuvem,
                    temperatura=leitura.temperatura,
                    umidade=leitura.umidade,
                    pressao=leitura.pressao,
                    dados_adicionais=leitura.dados_adicionais,
                    data_hora=leitura.data_hora,
                    inconsistente=leitura.inconsistente,
                    motivo_inconsistencia=leitura.motivo_inconsistencia,
                )

                # Só apaga localmente depois do create() acima ter ido bem
                # — se a conexão cair no meio, essa linha nem chega aqui.
                leitura.delete(using='default')
                sincronizadas += 1
            except OperationalError:
                # Conexão com a nuvem caiu no meio do lote — para por aqui;
                # o que já foi sincronizado e apagado fica assim mesmo, o
                # resto tenta de novo no próximo ciclo.
                self.stdout.write(self.style.WARNING('Conexão com a nuvem caiu durante a sincronização.'))
                break
            except Exception as erro:
                falhas += 1
                self.stdout.write(self.style.WARNING(f'Falha ao sincronizar leitura id={leitura.id}: {erro}'))

        self.stdout.write(self.style.SUCCESS(
            f'{sincronizadas}/{total_pendentes} leitura(s) sincronizada(s) e removida(s) do banco local.'
            + (f' {falhas} falharam e ficaram para a próxima tentativa.' if falhas else ''),
        ))

    def _resolver_estacao_na_nuvem(self, estacao_local, cache):
        """Casa a Estacao local com a correspondente na nuvem pelo
        `identificador` (nunca pelo id interno — cada banco tem sua
        própria sequência de ids). Se a estação ainda não existir na
        nuvem (caso raro — normalmente ela já existe lá, e foi importada
        para local via `importar_estacao_da_nuvem`), cria uma cópia
        básica lá em vez de perder o vínculo."""
        if estacao_local is None:
            return None

        if estacao_local.identificador in cache:
            return cache[estacao_local.identificador]

        estacao_nuvem = Estacao.objects.using('nuvem').filter(identificador=estacao_local.identificador).first()
        if estacao_nuvem is None:
            estacao_nuvem = Estacao.objects.using('nuvem').create(
                identificador=estacao_local.identificador,
                nome=estacao_local.nome,
                localizacao=estacao_local.localizacao,
                intervalo_envio_minutos=estacao_local.intervalo_envio_minutos,
                limite_offline_minutos=estacao_local.limite_offline_minutos,
                ativa=estacao_local.ativa,
            )

        cache[estacao_local.identificador] = estacao_nuvem
        return estacao_nuvem
