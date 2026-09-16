Bolao.LiveRoundRanking = {
  timer: null,
  revealCache: {},
  cacheWeek: null,
  cacheTime: 0,

  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  },

  points(value) {
    return Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  ensurePanel() {
    let panel = document.querySelector('#live-round-ranking');
    if (panel) return panel;

    const gamesBox = document.querySelector('#games');
    if (!gamesBox || !gamesBox.parentNode) return null;

    panel = document.createElement('section');
    panel.id = 'live-round-ranking';
    panel.className = 'live-round-ranking';
    gamesBox.insertAdjacentElement('afterend', panel);
    return panel;
  },

  async loadReveals(week, games, force = false) {
    const now = Date.now();
    const cacheValid =
      !force &&
      this.cacheWeek === week &&
      now - this.cacheTime < 120000;

    if (cacheValid) return this.revealCache;

    const entries = await Promise.all(games.map(async game => {
      const lockAt = new Date(game.date).getTime() -
        BOLAO_CONFIG.lockMinutes * 60000;

      if (now < lockAt) return [game.id, null];

      const id = `${BOLAO_CONFIG.season}_${week}_${game.id}`;
      const snapshot = await Bolao.db.collection('weeklyPickReveals')
        .doc(id).get().catch(() => null);

      return [game.id, snapshot?.exists ? snapshot.data() : null];
    }));

    this.revealCache = Object.fromEntries(entries);
    this.cacheWeek = week;
    this.cacheTime = now;
    return this.revealCache;
  },

  gameResult(game) {
    if (game.completed) return Bolao.Scoring.result(game);
    if (game.state === 'in') return Bolao.Scoring.liveResult(game);
    return null;
  },

  calculate(games, reveals) {
    const participants = new Map();
    let considered = 0;
    let live = 0;
    let final = 0;

    games.forEach(game => {
      const reveal = reveals[game.id];
      const result = this.gameResult(game);
      if (!reveal || !result) return;

      const picks = reveal.participants || [];
      const active = Number(reveal.activeParticipants || picks.length || 1);
      const winnerPct = picks.filter(item =>
        item.winner === result.winner
      ).length * 100 / active;
      const difficultyPct = picks.filter(item =>
        item.winner === result.winner &&
        item.difficulty === result.difficulty
      ).length * 100 / active;

      considered += 1;
      if (game.completed) final += 1;
      else live += 1;

      picks.forEach((item, index) => {
        const name = item.name || `Participante ${index + 1}`;
        if (!participants.has(name)) {
          participants.set(name, {
            name,
            points: 0,
            winnerHits: 0,
            difficultyHits: 0
          });
        }

        const row = participants.get(name);
        const pick = item.winner
          ? { winner: item.winner, difficulty: item.difficulty }
          : null;
        const score = Bolao.Scoring.scoreAgainst(
          pick,
          game,
          winnerPct,
          difficultyPct,
          !game.completed
        );

        row.points += score.total;
        if (score.winnerCorrect) row.winnerHits += 1;
        if (score.difficultyCorrect) row.difficultyHits += 1;
      });
    });

    const rows = [...participants.values()]
      .map(row => ({ ...row, points: +row.points.toFixed(2) }))
      .sort((a, b) =>
        b.points - a.points ||
        b.winnerHits - a.winnerHits ||
        b.difficultyHits - a.difficultyHits ||
        a.name.localeCompare(b.name, 'pt-BR')
      );

    return { rows, considered, live, final };
  },

  render(data, games) {
    const panel = this.ensurePanel();
    if (!panel) return;

    const allFinished = games.length > 0 && games.every(game => game.completed);
    const title = allFinished
      ? 'Classificação pelo resultado dos jogos'
      : 'Classificação provisória da rodada';
    const updated = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });

    if (!data.considered) {
      panel.innerHTML = `
        <div class="live-ranking-head">
          <div>
            <h2>${title}</h2>
            <p>Nenhum jogo iniciado com escolhas publicadas.</p>
          </div>
          <span>Atualizado às ${updated}</span>
        </div>`;
      return;
    }

    panel.innerHTML = `
      <div class="live-ranking-head">
        <div>
          <h2>${title}</h2>
          <p>${data.considered} jogo(s) considerado(s) · ${data.live} em andamento · ${data.final} finalizado(s)</p>
        </div>
        <span>Atualizado às ${updated}</span>
      </div>
      <div class="table-wrap">
        <table class="live-ranking-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Participante</th>
              <th>Pontos</th>
              <th>Vencedores</th>
              <th>VD/VF</th>
            </tr>
          </thead>
          <tbody>
            ${data.rows.map((row, index) => `
              <tr>
                <td class="rank">${index + 1}</td>
                <td>${this.escape(row.name)}</td>
                <td><b>${this.points(row.points)}</b></td>
                <td>${row.winnerHits}</td>
                <td>${row.difficultyHits}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="live-ranking-note">
        Pontuação provisória. A classificação oficial depende da apuração administrativa.
      </p>`;
  },

  async update(force = false) {
    const games = Bolao.Predictions.games || [];
    if (!games.length || !document.querySelector('#games')) return;

    const week = +(localStorage.getItem('bolao_week') || 1);
    const reveals = await this.loadReveals(week, games, force);
    this.render(this.calculate(games, reveals), games);
  },

  start() {
    clearInterval(this.timer);
    this.update(true);
    this.timer = setInterval(() => this.update(false), 30000);
  }
};

const previousLiveRankingWeekly = Bolao.Predictions.weekly.bind(Bolao.Predictions);
Bolao.Predictions.weekly = async function() {
  await previousLiveRankingWeekly();
  Bolao.LiveRoundRanking.start();
};

const previousLiveRankingRenderGames =
  Bolao.Predictions.renderGames.bind(Bolao.Predictions);
Bolao.Predictions.renderGames = function(week) {
  const result = previousLiveRankingRenderGames(week);
  setTimeout(() => Bolao.LiveRoundRanking.update(false), 0);
  return result;
};
