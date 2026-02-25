try { console.log('[ATP][LOAD] config.js carregado com sucesso'); } catch (e) { }

'use strict';

const LOG_PREFIX = '[ATP]';
const TABLE_ID = 'tableAutomatizacaoLocalizadores';
let onlyConflicts = false;
const ATP_VERSION = '10.14';

const tipoRank = {
  'Colisão Total': 5,
  'Colisão Parcial': 4,
  'Looping': 5,
  'Looping Potencial': 5,
  'Contradição': 5,
  'Quebra de Fluxo': 4,
  'Perda de Objeto': 3,
  'Perda de Objeto Condicional': 3,
  'Sobreposição': 2,
  'Possível Sobreposição': 2
};

const impactoRank = {
  'Alto': 3,
  'Médio': 2,
  'Baixo': 1
};

const ATP_CONFIG = {
  analisarLooping: false,
  analisarPerdaObjetoCondicional: true,
  analisarQuebraFluxo: true,
};

// Compatibilidade com versões antigas da UI que consultam esta função.
function isDesativarResultPage() {
  try {
    const href = String((window && window.location && window.location.href) || '');
    if (!/controlador\.php/i.test(href)) return true;
    const acao = String(new URL(href).searchParams.get('acao') || '').toLowerCase();
    if (!acao) return false;
    return acao !== 'automatizar_localizadores';
  } catch (_) {
    return false;
  }
}

try { console.log('[ATP][OK] config.js inicializado'); } catch (e) { }
