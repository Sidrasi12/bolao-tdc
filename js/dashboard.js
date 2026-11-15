Bolao.Dashboard = {
  currentWeek() {
    const now = new Date();
    const brasilia = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
    );

    const weekOneTuesday = new Date(2026, 8, 8, 0, 0, 0, 0);
    const elapsed = brasilia.getTime() - weekOneTuesday.getTime();
    const calculated = Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)) + 1;

    // Garante que o limite seja de 1 a 22 semanas (Temporada Regular + Playoffs)
    return Math.max(1, Math.min(22, calculated));
  },

  getWeekLabel(i) {
    if (i <= 18) return `Semana ${i}`;
    if (i === 19) return `Wild Card`;
    if (i === 20) return `Divisional`;
    if (i === 21) return `Conferências`;
    if (i === 22) return `Super Bowl`;
    return `Semana ${i}`;
  },

  async render() {
    const week = this.currentWeek();
    localStorage.setItem('bolao_week', String(week));

    Bolao.App.content(`
      <div class="hero">
        <h1>Olá, ${Bolao.Auth.user.name}! 🏈</h1>
        <p>Acompanhe a rodada, registre seus palpites e dispute o topo.</p>
      </div>

      <div class="grid">
        <div class="card">
          <div class="muted">Rodada atual</div>
          <div class="metric">${this.getWeekLabel(week)}</div>
        </div>
        <div class="card">
          <div class="muted">Seus pontos apurados</div>
          <div class="metric" id="my-points">...</div>
        </div>
        <div class="card">
          <div class="muted">Palpites pendentes</div>
          <div class="metric" id="pending">...</div>
        </div>
      </div>

      <div class="section-title">
        <h2>Jogos da rodada</h2>
        <button id="dashboard-weekly-button">Fazer palpites</button>
      </div>

      <div id="dash-games" class="card">Carregando todos os jogos...</div>
    `);

    const btn = document.querySelector('#dashboard-weekly-button');
    if (btn) {
      btn.onclick = () => {
        localStorage.setItem('bolao_week', String(week));
        Bolao.App.navigate('weekly');
      };
    }

    try {
      const [games, scores] = await Promise.all([
        Bolao.ESPN.games(week),
        Bolao.db.collection('roundScores')
          .where('season', '==', BOLAO_CONFIG.season)
          .where('userId', '==', Bolao.Auth.user.uid)
          .get()
      ]);

      const orderedGames = [...games].sort((a, b) => {
        const timeDifference = new Date(a.date) - new Date(b.date);
        return timeDifference || String(a.id).localeCompare(String(b.id));
      });

      const picks = await Bolao.Predictions.loadWeekly(week, orderedGames);
      const pending = orderedGames.filter(game => !picks[game.id]).length;
      const points = scores.docs.reduce(
        (total, document) => total + Number(document.data().points || 0),
        0
      );

      const pendingEl = document.querySelector('#pending');
      const pointsEl = document.querySelector('#my-points');
      const dashGamesEl = document.querySelector('#dash-games');

      if (pendingEl) pendingEl.textContent = pending;
      if (pointsEl) {
        pointsEl.textContent = points.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }

      if (dashGamesEl) {
        dashGamesEl.innerHTML = orderedGames.length
          ? orderedGames.map(game => {
              const isLive = game.state === 'in';
              const isCompleted = game.completed || game.state === 'post';
              return `
                <div class="game-card dashboard-game" style="margin-bottom:14px; padding:12px; border:1px solid rgba(255,255,255,0.1); border-radius:8px;">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <span class="badge" style="background:${isLive ? '#b30000' : 'rgba(255,255,255,0.1)'}; color:#fff;">
                      ${isLive ? 'AO VIVO' : (isCompleted ? 'FINALIZADO' : 'PRÉ-JOGO')}
                    </span>
                    <span style="font-size:0.85rem; color:var(--muted);">${game.statusDetail || new Date(game.date).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </div>
                  <div class="game" style="display:flex; justify-content:space-between; align-items:center;">
                    <div class="team" style="display:flex; align-items:center; gap:8px;">
                      <img src="${game.away.logo}" alt="" style="width:24px; height:24px;">
                      <span>${game.away.name}</span>
                    </div>
                    <div style="font-weight:bold; font-size:1.1rem; color:var(--gold, #d4af37);">
                      ${game.away.score} × ${game.home.score}
                    </div>
                    <div class="team" style="display:flex; align-items:center; gap:8px;">
                      <span>${game.home.name}</span>
                      <img src="${game.home.logo}" alt="" style="width:24px; height:24px;">
                    </div>
                  </div>
                  <div class="venue" style="font-size:0.8rem; color:var(--muted); margin-top:8px; text-align:center;">
                    🏟️ ${game.venue}${game.venueCity ? ' · ' + game.venueCity : ''}
                  </div>
                </div>
              `;
            }).join('')
          : 'Jogos ainda não disponíveis.';
      }
    } catch (error) {
      const pendingEl = document.querySelector('#pending');
      const pointsEl = document.querySelector('#my-points');
      const dashGamesEl = document.querySelector('#dash-games');
      if (pendingEl) pendingEl.textContent = '--';
      if (pointsEl) pointsEl.textContent = '--';
      if (dashGamesEl) dashGamesEl.innerHTML = 'Não foi possível carregar o painel.';
      console.error('Falha ao carregar o dashboard:', error);
    }
  }
};
