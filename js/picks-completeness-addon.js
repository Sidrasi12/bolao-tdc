Bolao.PicksCompleteness = {
  state(pick) {
    const hasWinner = Boolean(pick && pick.winner);
    const hasDifficulty = Boolean(
      pick && (pick.difficulty === 'VD' || pick.difficulty === 'VF')
    );

    if (hasWinner && hasDifficulty) return 'complete';
    if (hasWinner || hasDifficulty) return 'incomplete';
    return 'empty';
  },

  isLocked(game) {
    return Date.now() >=
      new Date(game.date).getTime() - BOLAO_CONFIG.lockMinutes * 60000;
  },

  status(state, locked) {
    if (state === 'complete') {
      return {
        className: 'pick-status-complete',
        text: locked ? '✓ Palpite completo' : '✓ Palpite completo e salvo'
      };
    }

    if (state === 'incomplete') {
      return {
        className: locked ? 'pick-status-locked' : 'pick-status-incomplete',
        text: locked
          ? '⚠ Prazo encerrado com palpite incompleto'
          : '⚠ Palpite incompleto: selecione o vencedor e VD ou VF'
      };
    }

    return {
      className: locked ? 'pick-status-locked' : 'pick-status-empty',
      text: locked
        ? 'Prazo encerrado sem palpite'
        : 'Palpite ainda não preenchido'
    };
  },

  summaryPanel() {
    let panel = document.querySelector('#picks-completeness-summary');
    if (panel) return panel;

    const gamesBox = document.querySelector('#games');
    if (!gamesBox || !gamesBox.parentNode) return null;

    panel = document.createElement('section');
    panel.id = 'picks-completeness-summary';
    panel.className = 'picks-completeness-summary';
    gamesBox.parentNode.insertBefore(panel, gamesBox);
    return panel;
  },

  apply() {
    const games = Bolao.Predictions.games || [];
    const picks = Bolao.Predictions.picks || {};
    const cards = document.querySelectorAll('#games .game-card');
    const totals = { complete: 0, incomplete: 0, empty: 0 };

    cards.forEach((card, index) => {
      const game = games[index];
      if (!game) return;

      const state = this.state(picks[game.id]);
      const locked = this.isLocked(game);
      totals[state] += 1;

      let statusBox = card.querySelector('.pick-completeness-status');
      if (!statusBox) {
        statusBox = document.createElement('div');
        const choices = card.querySelector('.choices');
        if (choices) choices.insertAdjacentElement('afterend', statusBox);
        else card.appendChild(statusBox);
      }

      const content = this.status(state, locked);
      statusBox.className =
        `pick-completeness-status ${content.className}`;
      statusBox.textContent = content.text;
    });

    const panel = this.summaryPanel();
    if (!panel) return;

    const total = games.length;
    const allComplete = total > 0 && totals.complete === total;

    panel.innerHTML = `
      <div class="picks-summary-grid">
        <div><span>Jogos</span><b>${total}</b></div>
        <div class="summary-complete">
          <span>Completos</span><b>${totals.complete}</b>
        </div>
        <div class="summary-incomplete">
          <span>Incompletos</span><b>${totals.incomplete}</b>
        </div>
        <div class="summary-empty">
          <span>Sem palpite</span><b>${totals.empty}</b>
        </div>
      </div>
      <div class="picks-summary-message">
        ${allComplete
          ? '✓ Todos os palpites da rodada estão completos.'
          : 'Palpite completo exige vencedor e dificuldade VD ou VF.'}
      </div>`;
  },

  async updateDashboardPending() {
    const pendingElement = document.querySelector('#pending');
    if (!pendingElement) return;

    try {
      const week = Bolao.Dashboard.currentWeek
        ? Bolao.Dashboard.currentWeek()
        : +(localStorage.getItem('bolao_week') || 1);
      const games = await Bolao.ESPN.games(week);
      const picks = await Bolao.Predictions.loadWeekly(week, games);

      pendingElement.textContent = games.filter(game =>
        this.state(picks[game.id]) !== 'complete'
      ).length;
      pendingElement.title = 'Inclui jogos sem vencedor ou sem VD/VF';
    } catch (error) {
      console.error('Falha ao recalcular palpites pendentes:', error);
    }
  }
};

const previousCompletenessRenderGames =
  Bolao.Predictions.renderGames.bind(Bolao.Predictions);

Bolao.Predictions.renderGames = function(week) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const activeElement = document.activeElement;

  if (activeElement && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }

  const result = previousCompletenessRenderGames(week);
  Bolao.PicksCompleteness.apply();

  window.scrollTo(scrollX, scrollY);
  requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));

  return result;
};

const previousCompletenessWeekly =
  Bolao.Predictions.weekly.bind(Bolao.Predictions);

Bolao.Predictions.weekly = async function() {
  await previousCompletenessWeekly();
  Bolao.PicksCompleteness.apply();
};

const previousCompletenessDashboard =
  Bolao.Dashboard.render.bind(Bolao.Dashboard);

Bolao.Dashboard.render = async function() {
  await previousCompletenessDashboard();
  await Bolao.PicksCompleteness.updateDashboardPending();
};
