// Sistema de tradução (pt/en) — troca de idioma real da tela
// "Configurações → Preferências gerais", tanto na conta Standard quanto
// na Gestor. A preferência é por CONTA (aparenciaService.js, chave por
// username no localStorage — mesmo padrão de tema/cor), não por
// navegador: cada conta guarda a própria escolha.
//
// `lng` inicial já lê a preferência salva pra essa conta (se já tiver
// token no localStorage, ex.: depois de um F5) — evita nascer em
// português e trocar pra inglês um instante depois. AppLayout.jsx e
// PainelAdministrativo.jsx chamam `i18n.changeLanguage` de novo ao
// montar/trocar, cobrindo o caso de login/troca de conta sem reload de
// página inteira.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { obterIdioma } from '../services/aparenciaService'
import pt from './locales/pt'
import en from './locales/en'

i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    en: { translation: en },
  },
  lng: obterIdioma(),
  fallbackLng: 'pt',
  interpolation: { escapeValue: false },
})

export default i18n
