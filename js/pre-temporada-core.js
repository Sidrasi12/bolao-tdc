/* =====================================================================
   BOLÃO NFL — APURAÇÃO DA PRÉ-TEMPORADA (núcleo de cálculo)
   ---------------------------------------------------------------------
   Regras (Regulamento, Arts. 7, 8 e 9):
     - Cada equipe presente no Super Bowl ........ 10
     - Campeão do Super Bowl ..................... 10
     - Vice-campeão do Super Bowl ................  5
     - Cada equipe presente nos playoffs .........  5
     - Cada campeão de divisão ...................  8
     - Cada Wild Card ............................  4
     - Time de pior campanha ..................... 10
     - MVP da temporada .......................... 10
   Pré-temporada: SEM fator de correção (o fator do Art. 8 vale só para os jogos).
   Cada acerto vale exatamente os pontos da tabela. Pontuações cumulativas.
   Item não preenchido pelo participante = 0 ponto.
   Este arquivo não acessa a internet nem o Firebase: só calcula.
   ===================================================================== */
(function (root) {
  'use strict';
 
  // ---------- 32 times (id = ID da ESPN) ----------
  const TIMES = [
    ['2','BUF','Buffalo','Bills','AFC','East'], ['15','MIA','Miami','Dolphins','AFC','East'],
    ['17','NE','New England','Patriots','AFC','East'], ['20','NYJ','New York','Jets','AFC','East'],
    ['33','BAL','Baltimore','Ravens','AFC','North'], ['4','CIN','Cincinnati','Bengals','AFC','North'],
    ['5','CLE','Cleveland','Browns','AFC','North'], ['23','PIT','Pittsburgh','Steelers','AFC','North'],
    ['34','HOU','Houston','Texans','AFC','South'], ['11','IND','Indianapolis','Colts','AFC','South'],
    ['30','JAX','Jacksonville','Jaguars','AFC','South'], ['10','TEN','Tennessee','Titans','AFC','South'],
    ['7','DEN','Denver','Broncos','AFC','West'], ['12','KC','Kansas City','Chiefs','AFC','West'],
    ['13','LV','Las Vegas','Raiders','AFC','West'], ['24','LAC','Los Angeles','Chargers','AFC','West'],
    ['6','DAL','Dallas','Cowboys','NFC','East'], ['19','NYG','New York','Giants','NFC','East'],
    ['21','PHI','Philadelphia','Eagles','NFC','East'], ['28','WSH','Washington','Commanders','NFC','East'],
    ['3','CHI','Chicago','Bears','NFC','North'], ['8','DET','Detroit','Lions','NFC','North'],
    ['9','GB','Green Bay','Packers','NFC','North'], ['16','MIN','Minnesota','Vikings','NFC','North'],
    ['1','ATL','Atlanta','Falcons','NFC','South'], ['29','CAR','Carolina','Panthers','NFC','South'],
    ['18','NO','New Orleans','Saints','NFC','South'], ['27','TB','Tampa Bay','Buccaneers','NFC','South'],
    ['22','ARI','Arizona','Cardinals','NFC','West'], ['14','LAR','Los Angeles','Rams','NFC','West'],
    ['25','SF','San Francisco','49ers','NFC','West'], ['26','SEA','Seattle','Seahawks','NFC','West']
  ].map(t => ({ id: t[0], abbr: t[1], cidade: t[2], nome: t[3], conf: t[4], div: t[5],
                divisao: t[4] + ' ' + t[5], completo: t[2] + ' ' + t[3] }));
 
  const DIVISOES = ['AFC East','AFC North','AFC South','AFC West','NFC East','NFC North','NFC South','NFC West'];
 
  // Siglas alternativas usadas por outras fontes
  const ALIAS = { WAS: 'WSH', JAC: 'JAX', LA: 'LAR', OAK: 'LV', SD: 'LAC', STL: 'LAR', ARZ: 'ARI', GNB: 'GB', KAN: 'KC', NOR: 'NO', SFO: 'SF', TAM: 'TB', NWE: 'NE' };
 
  function chave(txt) {
    return String(txt == null ? '' : txt).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9]/g, '');
  }
 
  const INDICE = {};
  TIMES.forEach(t => {
    [t.id, t.abbr, t.nome, t.completo, t.cidade + t.nome].forEach(v => { INDICE[chave(v)] = t; });
  });
  Object.keys(ALIAS).forEach(a => { INDICE[chave(a)] = INDICE[chave(ALIAS[a])]; });
 
  /** Aceita ID da ESPN, sigla (BUF, WAS/WSH...), apelido ("Bills") ou nome completo. */
  function time(valor) {
    if (valor == null || valor === '') return null;
    if (typeof valor === 'object') valor = valor.id || valor.abbr || valor.abbreviation || valor.nome || valor.name || '';
    return INDICE[chave(valor)] || null;
  }
  function idTime(valor) { const t = time(valor); return t ? t.id : null; }
 
  function chaveDivisao(txt) {
    const k = chave(txt);
    return DIVISOES.find(d => chave(d) === k) || null;
  }
 
  function normalizaNome(txt) {
    return String(txt == null ? '' : txt).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
 
  const BASE = { SB_EQUIPE: 10, CAMPEAO: 10, VICE: 5, PLAYOFFS: 5, DIVISAO: 8, WILDCARD: 4, PIOR: 10, MVP: 10 };
 
  /** Converte o palpite bruto (já lido pelo adaptador) para IDs de times padronizados. */
  function padronizaPalpite(p) {
    const divisoes = {};
    Object.keys(p.divisoes || {}).forEach(k => {
      const d = chaveDivisao(k);
      const id = idTime(p.divisoes[k]);
      if (d && id) divisoes[d] = id;
    });
    const wildCards = [...new Set((p.wildCards || []).map(idTime).filter(Boolean))];
    const playoffs = [...new Set([...Object.values(divisoes), ...wildCards])];
    const campeao = idTime(p.campeao);
    const vice = idTime(p.vice);
    return {
      uid: p.uid, nome: p.nome || '',
      campeao, vice,
      superBowl: [...new Set([campeao, vice].filter(Boolean))],
      divisoes, wildCards, playoffs,
      pior: idTime(p.pior),
      mvp: normalizaNome(p.mvp)
    };
  }
 
  /**
   * Calcula a pontuação de pré-temporada de todos os participantes.
   * @param participantes [{uid, nome}] — todos os participantes ativos (inclusive quem não enviou palpite)
   * @param palpitesBrutos [{uid, campeao, vice, divisoes:{'AFC East':time}, wildCards:[...], pior, mvp}]
   * @param resultado {divisoes:{'AFC East':time}, wildCards:{AFC:[3], NFC:[3]}, pior, campeao, vice, mvpAceitos:[textos]}
   * Sem fator de correção: cada acerto vale os pontos base da tabela.
   */
  function apurar(participantes, palpitesBrutos, resultado) {
    const palpites = {};
    (palpitesBrutos || []).forEach(p => { if (p && p.uid) palpites[p.uid] = padronizaPalpite(p); });
 
    const enviaram = participantes.filter(u => palpites[u.uid]).length;
    const lista = participantes.map(u => palpites[u.uid] || padronizaPalpite({ uid: u.uid }));
 
    const conta = (cond) => lista.filter(cond).length;
 
    // --- resultado padronizado ---
    const r = resultado || {};
    const resDiv = {};
    Object.keys(r.divisoes || {}).forEach(k => { const d = chaveDivisao(k); const id = idTime(r.divisoes[k]); if (d && id) resDiv[d] = id; });
    const resWC = [];
    ['AFC', 'NFC'].forEach(c => ((r.wildCards || {})[c] || []).forEach(v => { const id = idTime(v); if (id) resWC.push(id); }));
    const divCompletas = DIVISOES.every(d => resDiv[d]);
    const wcCompletos = resWC.length === 6;
    const resPlayoffs = (divCompletas && wcCompletos) ? [...Object.values(resDiv), ...resWC] : [];
    const resPior = idTime(r.pior);
    const resCampeao = idTime(r.campeao);
    const resVice = idTime(r.vice);
    const resSB = (resCampeao && resVice) ? [resCampeao, resVice] : [];
    const mvpAceitos = (r.mvpAceitos || []).map(normalizaNome).filter(Boolean);
 
    const pendentes = [];
    if (!divCompletas) pendentes.push('Campeões de divisão');
    if (!wcCompletos) pendentes.push('Wild Cards');
    if (!resPlayoffs.length) pendentes.push('Equipes nos playoffs');
    if (!resPior) pendentes.push('Pior campanha');
    if (!resSB.length) pendentes.push('Equipes no Super Bowl / Campeão / Vice');
    if (!mvpAceitos.length) pendentes.push('MVP');
 
    const nomeTime = id => { const t = time(id); return t ? t.abbr : id; };
 
    const resultados = lista.map(p => {
      const itens = [];
      // Sem fator de correção: pontos = base. "acertadores" é apenas informativo.
      const add = (grupo, descricao, base, qtd) => {
        itens.push({ grupo, descricao, base, acertadores: qtd, pontos: base });
      };
 
      // Campeões de divisão (8 cada)
      DIVISOES.forEach(d => {
        if (resDiv[d] && p.divisoes[d] === resDiv[d]) {
          add('divisoes', 'Campeão ' + d + ' (' + nomeTime(resDiv[d]) + ')', BASE.DIVISAO, conta(x => x.divisoes[d] === resDiv[d]));
        }
      });
      // Wild Cards (4 cada) — só quando os 6 estiverem definidos
      if (wcCompletos) {
        p.wildCards.forEach(id => {
          if (resWC.includes(id)) add('wildcards', 'Wild Card ' + nomeTime(id), BASE.WILDCARD, conta(x => x.wildCards.includes(id)));
        });
      }
      // Equipes nos playoffs (5 cada) — times apontados como campeão de divisão ou Wild Card
      if (resPlayoffs.length) {
        p.playoffs.forEach(id => {
          if (resPlayoffs.includes(id)) add('playoffs', 'Nos playoffs: ' + nomeTime(id), BASE.PLAYOFFS, conta(x => x.playoffs.includes(id)));
        });
      }
      // Pior campanha (10)
      if (resPior && p.pior === resPior) add('pior', 'Pior campanha (' + nomeTime(resPior) + ')', BASE.PIOR, conta(x => x.pior === resPior));
      // Super Bowl
      if (resSB.length) {
        p.superBowl.forEach(id => {
          if (resSB.includes(id)) add('superbowl', 'No Super Bowl: ' + nomeTime(id), BASE.SB_EQUIPE, conta(x => x.superBowl.includes(id)));
        });
        if (p.campeao && p.campeao === resCampeao) add('campeao', 'Campeão (' + nomeTime(resCampeao) + ')', BASE.CAMPEAO, conta(x => x.campeao === resCampeao));
        if (p.vice && p.vice === resVice) add('vice', 'Vice (' + nomeTime(resVice) + ')', BASE.VICE, conta(x => x.vice === resVice));
      }
      // MVP (10)
      if (mvpAceitos.length && p.mvp && mvpAceitos.includes(p.mvp)) {
        add('mvp', 'MVP', BASE.MVP, conta(x => x.mvp && mvpAceitos.includes(x.mvp)));
      }
 
      const total = Math.round(itens.reduce((s, i) => s + i.pontos, 0) * 100) / 100;
      const u = participantes.find(x => x.uid === p.uid) || {};
      return { uid: p.uid, nome: u.nome || p.nome || '', enviouPalpite: !!palpites[p.uid], total, itens };
    });
 
    resultados.sort((a, b) => b.total - a.total);
    return { resultados, enviaram, pendentes };
  }
 
  // ---------- Leitura da classificação da ESPN ----------
  /**
   * Interpreta o JSON de site.api.espn.com/apis/v2/sports/football/nfl/standings
   * Retorna campeões de divisão (seeds 1-4), Wild Cards (seeds 5-7) e pior campanha.
   */
  function interpretaClassificacaoESPN(json) {
    const linhas = [];
    (function percorre(no) {
      if (!no || typeof no !== 'object') return;
      if (no.standings && Array.isArray(no.standings.entries)) {
        no.standings.entries.forEach(e => {
          const t = time(e.team && (e.team.id || e.team.abbreviation));
          if (!t) return;
          const st = {};
          (e.stats || []).forEach(s => { st[s.name || s.type || s.abbreviation] = (s.value != null ? s.value : s.displayValue); });
          linhas.push({
            id: t.id, abbr: t.abbr, conf: t.conf, divisao: t.divisao,
            seed: st.playoffSeed != null ? Number(st.playoffSeed) : null,
            vitorias: Number(st.wins || 0), derrotas: Number(st.losses || 0), empates: Number(st.ties || 0),
            pct: st.winPercent != null ? Number(st.winPercent) : null
          });
        });
      }
      (no.children || []).forEach(percorre);
    })(json);
 
    const unicos = {};
    linhas.forEach(l => { unicos[l.id] = l; });
    const times = Object.values(unicos);
    const avisos = [];
    if (times.length !== 32) avisos.push('A ESPN retornou ' + times.length + ' times (esperado: 32).');
 
    const divisoes = {}, wildCards = { AFC: [], NFC: [] };
    ['AFC', 'NFC'].forEach(c => {
      const daConf = times.filter(t => t.conf === c && t.seed);
      daConf.filter(t => t.seed >= 1 && t.seed <= 4).forEach(t => { divisoes[t.divisao] = t.id; });
      wildCards[c] = daConf.filter(t => t.seed >= 5 && t.seed <= 7).sort((a, b) => a.seed - b.seed).map(t => t.id);
    });
    DIVISOES.forEach(d => { if (!divisoes[d]) avisos.push('Campeão da ' + d + ' não identificado.'); });
    ['AFC', 'NFC'].forEach(c => { if (wildCards[c].length !== 3) avisos.push('Wild Cards da ' + c + ': ' + wildCards[c].length + ' identificados (esperado: 3).'); });
 
    // Pior campanha: menor aproveitamento (empate conta meia vitória)
    const comPct = times.map(t => {
      const jogos = t.vitorias + t.derrotas + t.empates;
      const pct = t.pct != null ? t.pct : (jogos ? (t.vitorias + 0.5 * t.empates) / jogos : 1);
      return Object.assign({}, t, { pct });
    });
    let pior = null, empatadosPior = [];
    if (comPct.length) {
      const minimo = Math.min.apply(null, comPct.map(t => t.pct));
      empatadosPior = comPct.filter(t => Math.abs(t.pct - minimo) < 1e-9).map(t => t.id);
      if (empatadosPior.length === 1) pior = empatadosPior[0];
      else avisos.push('Empate na pior campanha entre ' + empatadosPior.map(id => time(id).abbr).join(', ') + '. Definição pelos administradores (Art. 10).');
    }
    return { divisoes, wildCards, pior, empatadosPior, avisos, times: comPct };
  }
 
  const API = { TIMES, DIVISOES, BASE, time, idTime, chaveDivisao, normalizaNome, padronizaPalpite, apurar, interpretaClassificacaoESPN };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.PreTemporadaCore = API;
})(typeof window !== 'undefined' ? window : globalThis);
