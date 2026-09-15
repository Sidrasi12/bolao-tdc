Bolao.Dashboard = {
  currentWeek() {
    const now = new Date();
    const brasilia = new Date(
      now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
    );

    const weekOneTuesday = new Date(2026, 8, 8, 0, 0, 0, 0);
    const elapsed = brasilia.getTime() - weekOneTuesday.getTime();
    const calculated = Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)) + 1;

    return Math.max(1, Math.min(18, calculated));
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
          <div class="metric">${week}</div>
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
        <h2>Jogos da rodada ${week}</h2>
        <button id="dashboard-weekly-button">Fazer palpites</button>
      </div>

      <div id="dash-games" class="card">Carregando todos os jogos...</div>
    `);

    document.querySelector('#dashboard-weekly-button').onclick = () => {
      localStorage.setItem('bolao_week', String(week));
      Bolao.App.navigate('weekly');
    };

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

      document.querySelector('#pending').textContent = pending;
      document.querySelector('#my-points').textContent = points.toLocaleString(
        'pt-BR',
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      );

      document.querySelector('#dash-games').innerHTML = orderedGames.length
        ? orderedGames.map(game => `
            <div class="game-card dashboard-game">
              <div class="game">
                <div class="team">
                  <img src="${game.away.logo}" alt="">
                  ${game.away.name}
                </div>
                <div class="game-meta">
                  ${new Date(game.date).toLocaleString('pt-BR', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  })}
                  <div class="venue">
                    🏟️ ${game.venue}${game.venueCity ? ' · ' + game.venueCity : ''}
                  </div>
                </div>
                <div class="team">
                  ${game.home.name}
                  <img src="${game.home.logo}" alt="">
                </div>
              </div>
            </div>
          `).join('')
        : 'Jogos ainda não disponíveis.';
    } catch (error) {
      document.querySelector('#pending').textContent = '--';
      document.querySelector('#my-points').textContent = '--';
      document.querySelector('#dash-games').innerHTML =
        'Não foi possível carregar o painel.';
      console.error('Falha ao carregar o dashboard:', error);
    }
  }
};
