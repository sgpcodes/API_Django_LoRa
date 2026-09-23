// Geração dos arquivos de exportação (RF-23 a RF-25) — TXT, CSV e PDF, tudo
// no navegador em cima do que `buscarClimaAtual`/`derivarVisaoPeriodo` já
// buscaram: não existe endpoint de exportação no backend, os dados já
// estão todos do lado do cliente (mesmo motivo do resto do Dashboard não
// buscar de novo ao trocar de período).
import jsPDF from 'jspdf'
import { derivarVisaoPeriodo } from './climaExternoService'

// `vento` guarda velocidade num campo com nome diferente das outras 4
// métricas (`velocidade`/`velocidadeMedia` em vez de `valor`/`media`) — e
// `chuva` por dia é a SOMA do dia, não a média (chove em rajadas, "chuva
// média por hora" não é uma leitura útil) — mesma regra que o gráfico de
// barras da chuva já usa (ver `derivarVisaoPeriodo` em
// climaExternoService.js).
function valorDaLinha(chave, granularidade, linha) {
  if (!linha) return null
  if (chave === 'vento') return granularidade === 'hora' ? linha.velocidade : linha.velocidadeMedia
  if (chave === 'chuva' && granularidade === 'dia') return linha.soma
  return granularidade === 'hora' ? linha.valor : linha.media
}

// Todas as métricas vêm do mesmo filtro de período (mesmas datas/horas, na
// mesma ordem — ver derivarVisaoPeriodo), então dá pra usar a tabela da
// primeira métrica selecionada só como referência das linhas (data/hora de
// cada uma) e completar as colunas das outras por índice.
function montarLinhas(clima, periodo, metricasSelecionadas) {
  const visao = derivarVisaoPeriodo(clima, periodo)
  const referencia = visao.tabela[metricasSelecionadas[0]?.chave] ?? []

  const linhas = referencia.map((linhaRef, indice) => {
    const rotulo = linhaRef.dataHora ? formatarDataHoraCompleta(linhaRef.dataHora) : linhaRef.data ?? linhaRef.rotulo
    const valores = metricasSelecionadas.map((metrica) => valorDaLinha(metrica.chave, visao.granularidade, visao.tabela[metrica.chave]?.[indice]))
    return { rotulo, valores }
  })

  return { granularidade: visao.granularidade, linhas }
}

function formatarDataHoraCompleta(dataHoraISO) {
  const data = new Date(dataHoraISO)
  return `${data.toLocaleDateString('pt-BR')} ${data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
}

function cabecalhoColunas(metricasSelecionadas) {
  return ['Data/Hora', ...metricasSelecionadas.map((m) => `${m.titulo} (${m.unidade})`)]
}

function formatarValor(valor) {
  return valor == null ? '—' : String(valor)
}

function contexto({ local, periodoRotulo }) {
  const agora = new Date()
  return [
    'LACOP — Exportação de dados climáticos',
    `Local: ${local}`,
    `Período: ${periodoRotulo}`,
    `Gerado em: ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
  ]
}

export function gerarTxt({ clima, periodo, periodoRotulo, local, metricasSelecionadas }) {
  const { linhas } = montarLinhas(clima, periodo, metricasSelecionadas)
  const cabecalho = cabecalhoColunas(metricasSelecionadas)

  const partes = [...contexto({ local, periodoRotulo }), '', cabecalho.join(' | ')]
  linhas.forEach(({ rotulo, valores }) => {
    partes.push([rotulo, ...valores.map(formatarValor)].join(' | '))
  })

  return new Blob([partes.join('\n')], { type: 'text/plain;charset=utf-8' })
}

export function gerarCsv({ clima, periodo, metricasSelecionadas }) {
  const { linhas } = montarLinhas(clima, periodo, metricasSelecionadas)
  const cabecalho = cabecalhoColunas(metricasSelecionadas)

  const escapar = (texto) => (String(texto).includes(',') ? `"${texto}"` : String(texto))
  const partes = [cabecalho.map(escapar).join(',')]
  linhas.forEach(({ rotulo, valores }) => {
    partes.push([rotulo, ...valores.map(formatarValor)].map(escapar).join(','))
  })

  return new Blob([partes.join('\n')], { type: 'text/csv;charset=utf-8' })
}

export function gerarPdf({ clima, periodo, periodoRotulo, local, metricasSelecionadas }) {
  const { linhas } = montarLinhas(clima, periodo, metricasSelecionadas)
  const cabecalho = cabecalhoColunas(metricasSelecionadas)

  const doc = new jsPDF()
  const margemEsquerda = 14
  const alturaPagina = doc.internal.pageSize.getHeight()
  let y = 18

  doc.setFontSize(14)
  doc.text('LACOP — Exportação de dados climáticos', margemEsquerda, y)
  doc.setFontSize(10)
  contexto({ local, periodoRotulo }).slice(1).forEach((linha) => {
    y += 6
    doc.text(linha, margemEsquerda, y)
  })

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text(cabecalho.join('   |   '), margemEsquerda, y)
  doc.setFont('helvetica', 'normal')

  linhas.forEach(({ rotulo, valores }) => {
    y += 6
    if (y > alturaPagina - 14) {
      doc.addPage()
      y = 18
    }
    doc.text([rotulo, ...valores.map(formatarValor)].join('   |   '), margemEsquerda, y)
  })

  return doc.output('blob')
}

export function baixarArquivo(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
