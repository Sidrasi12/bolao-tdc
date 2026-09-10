Bolao.Predictions = {
  liveTimer: null,

  gameDoc(week, gameId) {
    return Bolao.db.collection('userPredictions').doc(Bolao.Auth.user.uid)
      .collection('games').doc(`${BOLAO_CONFIG.season}_${week}_${gameId}`);
  },

  summaryDoc(week, gameId) {
    return Bolao.db.collection('weeklyBetSummaries')
      .doc(`${BOLAO_CONFIG.season}_${week}_${gameId}`);
  },

  revealDoc(week, gameId) {
    return Bolao.db.collection('weeklyPickReveals')
      .doc(`${BOLAO_CONFIG.season}_${week}_${gameId}`);
  },

  async loadWeekly(week, games) {
    const entries = await Promise.all(games.map(async game => {
      const doc = await this.gameDoc(week, game.id).get();
      return [game.id, doc.exists ? doc.data() : null];
    }));
    return Object.fromEntries(entries.filter(([, value]) => value));
  },

  async loadPublicData(week, games) {
    const now = Date.now();
    const entries = await Promise.all(games.map(async game => {
      const lockAt = new Date(game.date).getTime() - BOLAO_CONFIG.lockMinutes * 60000;
      if (now < lockAt) return [game.id, { summary: null, reveal: null }];

      const [summary, reveal] = await Promise.all([
        this.summaryDoc(week, game.id).get().catch(() => null),
        this.revealDoc(week, game.id).get().catch(() => null)
      ]);

      return [game.id, {
        summary: summary?.exists ? summary.data() : null,
        reveal: reveal?.exists ? reveal.data() : null
      }];
    }));
    return Object.fromEntries(entries);
  },

  async saveGame(week, game, pick) {
    const start = firebase.firestore.Timestamp.fromDate(new Date(game.date));
    const lock = firebase.firestore.Timestamp.fromMillis(
      start.toMillis() - BOLAO_CONFIG.lockMinutes * 60000
    );
    await this.gameDoc(week, game.id).set({
      userId: Bolao.Auth.user.uid,
      userName: Bolao.Auth.user.name,
      season: BOLAO_CONFIG.season,
      week,
      gameId: game.id,
      winner: pick.winner || '',
      difficulty: pick.difficulty || '',
      gameStart: start,
      lockAt: lock,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  lockLabel() {
    return BOLAO_CONFIG.lockMinutes === 60
      ? '1 hora antes da partida'
      : `${BOLAO_CONFIG.lockMinutes} minutos antes da partida`;
  },

  percent(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + '%';
  },

  points(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2
    });
  },

  statusText(game) {
    if (game.completed) return 'Final';
    if (game.state === 'in') {
      return game.statusDetail || `${game.period}º período · ${game.clock}`;
    }
    return '';
  },

  scoreHtml(game) {
    const status = this.statusText(game);
    return `
      <section class="score-panel ${game.state === 'in' ? 'is-live' : ''}">
        <div class="score-panel-title">
          <span>PLACAR</span>
          ${game.state === 'in' ? '<b>AO VIVO</b>' : ''}
        </div>
        <div class="score-row">
          <span class="score-team">${game.away.abbr}</span>
          <strong>${game.away.score}</strong>
          <span class="score-x">×</span>
          <strong>${game.home.score}</strong>
          <span class="score-team">${game.home.abbr}</span>
        </div>
        ${status ? `<div class="score-status">${status}</div>` : ''}
      </section>
    `;
  },

  oddsHtml(game) {
    const favorite = Bolao.ESPN.favorite(game);
    return `
      <section class="odds-card">
        <div class="odds-column">
          <span>SPREAD</span>
          <strong>${Bolao.ESPN.spreadText(game)}</strong>
        </div>
        <div class="odds-column">
          <span>FAVORITO</span>
          <strong>${favorite || 'Não definido'}</strong>
        </div>
      </section>
    `;
  },

  summaryHtml(game, summary, locked) {
    if (!locked) {
      return '<div class="notice game-note">Distribuição disponível após o encerramento.</div>';
    }
    if (!summary) {
      return '<div class="notice game-note">Distribuição aguardando atualização da Administração.</div>';
    }
    return `
      <section class="distribution-card">
        <div class="distribution-title">
          <h3>Distribuição dos palpites</h3>
          <span class="badge">Encerrado ${this.lockLabel()}</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Escolha</th><th>Quantidade</th><th>Percentual</th></tr></thead>
            <tbody>
              <tr><td>${game.away.name} (${game.away.abbr})</td><td>${summary.awayCount} aposta(s)</td><td>${this.percent(summary.awayPercent)}</td></tr>
              <tr><td>${game.home.name} (${game.home.abbr})</td><td>${summary.homeCount} aposta(s)</td><td>${this.percent(summary.homePercent)}</td></tr>
              <tr><td>Sem palpite</td><td>${summary.missingCount} participante(s)</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
        <p>Base do percentual: ${summary.submittedCount} palpite(s) enviado(s) · Participantes ativos: ${summary.activeParticipants}</p>
      </section>
    `;
  },

  picksHtml(game, reveal, locked) {
    if (!locked) return '';
    if (!reveal) {
      return '<div class="notice game-note">Palpites individuais aguardando publicação da Administração.</div>';
    }

    const participants = reveal.participants || [];
    const active = Number(reveal.activeParticipants || participants.length || 1);
    const result = Bolao.Scoring.liveResult(game);
    const winnerPct = result
      ? participants.filter(item => item.winner === result.winner).length * 100 / active
      : 0;
    const difficultyPct = result
      ? participants.filter(item => item.winner === result.winner && item.difficulty === result.difficulty).length * 100 / active
      : 0;
    const provisional = !game.completed;

    return `
      <details class="live-picks">
        <summary><b>Palpites e ${provisional ? 'pontuação provisória' : 'pontuação final'}</b></summary>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Participante</th><th>Palpite</th><th>Pontos</th></tr></thead>
            <tbody>
              ${participants.map(item => {
                const pick = item.winner ? { winner: item.winner, difficulty: item.difficulty } : null;
                const score = Bolao.Scoring.scoreAgainst(pick, game, winnerPct, difficultyPct, provisional);
                const label = pick
                  ? `${item.winner}${item.difficulty ? ' · ' + item.difficulty : ''}`
                  : 'Sem palpite';
                return `<tr><td>${item.name}</td><td>${label}</td><td class="live-points">${this.points(score.total)}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="muted">${provisional
          ? 'Pontuação provisória, sujeita a alteração até o final.'
          : 'A pontuação oficial depende da apuração da rodada.'}</p>
      </details>
    `;
  },

  async weekly() {
    clearInterval(this.liveTimer);
    const week = +(localStorage.getItem('bolao_week') || 1);

    Bolao.App.content(`
      <div class="section-title">
        <h1>Palpites semanais</h1>
        <div class="weekly-actions">
          <select id="week">${Array.from({ length: 18 }, (_, i) => `<option ${i + 1 === week ? 'selected' : ''}>${i + 1}</option>`).join('')}</select>
          <button id="refresh-live" class="secondary">↻ Atualizar</button>
        </div>
      </div>
      <div class="notice">Placar atualizado periodicamente. Pontuações durante os jogos são provisórias.</div>
      <div id="games" class="card" style="margin-top:14px">Carregando jogos...</div>
    `);

    document.querySelector('#week').onchange = event => {
      localStorage.setItem('bolao_week', event.target.value);
      this.weekly();
    };
    document.querySelector('#refresh-live').onclick = () => this.refreshLive(week, true);

    await this.refreshLive(week, false);
    this.liveTimer = setInterval(() => this.refreshLive(week, false), 30000);
  },

  async refreshLive(week, showToast) {
    try {
      this.games = await Bolao.ESPN.games(week);
      [this.picks, this.publicData] = await Promise.all([
        this.loadWeekly(week, this.games),
        this.loadPublicData(week, this.games)
      ]);
      this.renderGames(week);
      if (showToast) Bolao.App.toast('Placar atualizado');
    } catch (error) {
      document.querySelector('#games').innerHTML = `<div class="notice">Não foi possível atualizar: ${error.message}</div>`;
    }
  },

  renderGames(week) {
    const now = Date.now();
    document.querySelector('#games').innerHTML = this.games.length
      ? this.games.map(game => {
          const locked = now >= new Date(game.date).getTime() - BOLAO_CONFIG.lockMinutes * 60000;
          const pick = this.picks[game.id] || {};
          const publicData = this.publicData?.[game.id] || {};

          return `
            <article class="game-card weekly-game-card">
              <div class="matchup-row">
                <div class="matchup-team"><img src="${game.away.logo}"><span>${game.away.name}</span></div>
                <div class="matchup-meta">
                  <div class="venue">🏟️ ${game.venue}${game.venueCity ? ' · ' + game.venueCity : ''}</div>
                  <div>${locked ? '🔒 Palpite encerrado' : `🔐 Palpite aberto · fecha ${this.lockLabel()}`}</div>
                </div>
                <div class="matchup-team home"><span>${game.home.name}</span><img src="${game.home.logo}"></div>
              </div>

              <div class="choices ${locked ? 'locked' : ''}">
                <button class="choice ${pick.winner === game.away.abbr ? 'selected' : ''}" data-g="${game.id}" data-w="${game.away.abbr}">${game.away.abbr}</button>
                <button class="choice ${pick.winner === game.home.abbr ? 'selected' : ''}" data-g="${game.id}" data-w="${game.home.abbr}">${game.home.abbr}</button>
                <button class="choice ${pick.difficulty === 'VD' ? 'selected' : ''}" data-g="${game.id}" data-d="VD">VD</button>
                <button class="choice ${pick.difficulty === 'VF' ? 'selected' : ''}" data-g="${game.id}" data-d="VF">VF</button>
              </div>

              ${this.scoreHtml(game)}
              ${this.oddsHtml(game)}
              ${this.summaryHtml(game, publicData.summary, locked)}
              ${this.picksHtml(game, publicData.reveal, locked)}
            </article>
          `;
        }).join('')
      : '<p>Nenhum jogo encontrado.</p>';

    document.querySelectorAll('.choice').forEach(button => {
      button.onclick = async () => {
        const game = this.games.find(item => item.id === button.dataset.g);
        const lockAt = new Date(game.date).getTime() - BOLAO_CONFIG.lockMinutes * 60000;
        if (Date.now() >= lockAt) return Bolao.App.toast('Prazo encerrado');

        const pick = this.picks[game.id] = this.picks[game.id] || {};
        if (button.dataset.w) pick.winner = button.dataset.w;
        if (button.dataset.d) pick.difficulty = button.dataset.d;

        try {
          await this.saveGame(week, game, pick);
          this.renderGames(week);
          Bolao.App.toast('Palpite salvo com segurança');
        } catch (error) {
          Bolao.App.toast(error.code === 'permission-denied'
            ? 'Prazo encerrado ou operação não permitida'
            : 'Erro ao salvar: ' + error.message);
        }
      };
    });
  },

  async preseason() {
    const ref = Bolao.db.collection('userPredictions').doc(Bolao.Auth.user.uid)
      .collection('preseason').doc(String(BOLAO_CONFIG.season));
    const snap = await ref.get();
    const picks = snap.exists ? snap.data().picks || {} : {};
    const divisions = [['AFC','Leste'],['AFC','Oeste'],['AFC','Sul'],['AFC','Norte'],['NFC','Leste'],['NFC','Oeste'],['NFC','Sul'],['NFC','Norte']];
    const field = (id, label, filter = {}) => `<label>${label}<select id="${id}">${Bolao.teamOptions(filter)}</select></label>`;

    Bolao.App.content(`<div class="section-title"><h1>Pré-temporada</h1><span class="badge">Prazo: 9 de setembro, às 21h20</span></div><div class="notice">Os palpites ficam privados até o prazo final da pré-temporada.</div><form id="pre-form" class="card" style="margin-top:14px"><div class="form-grid">${field('champion','Campeão do Super Bowl')}${field('runner','Vice-campeão')}${divisions.map(([conference,division]) => field(`div_${conference}_${division}`,`${conference} ${division}`,{conference,division})).join('')}${field('worst','Pior campanha')}<label>MVP<input id="mvp" placeholder="Nome do jogador"></label></div><h3>Wild Cards</h3><div class="form-grid">${[1,2,3].map(i => field('wcAFC'+i,'Wildcard AFC '+i,{conference:'AFC'})).join('')}${[1,2,3].map(i => field('wcNFC'+i,'Wildcard NFC '+i,{conference:'NFC'})).join('')}</div><button>Salvar palpites</button></form>`);

    Object.entries(picks).forEach(([key,value]) => { const element=document.getElementById(key); if(element) element.value=value; });
    const deadline = firebase.firestore.Timestamp.fromDate(new Date(BOLAO_CONFIG.preseasonDeadline));
    if (Date.now() >= deadline.toMillis()) document.querySelector('#pre-form').classList.add('locked');
    document.querySelector('#pre-form').onsubmit = async event => {
      event.preventDefault();
      const values = {};
      event.target.querySelectorAll('select,input').forEach(element => values[element.id]=element.value);
      try {
        await ref.set({userId:Bolao.Auth.user.uid,userName:Bolao.Auth.user.name,season:BOLAO_CONFIG.season,deadline,picks:values,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
        Bolao.App.toast('Pré-temporada salva com segurança');
      } catch (error) {
        Bolao.App.toast(error.code === 'permission-denied' ? 'Prazo encerrado ou operação não permitida' : 'Erro ao salvar: '+error.message);
      }
    };
  }
};
