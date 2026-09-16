Bolao.PicksCompleteness = {
  observer: null,
  applying: false,

  state(pick) {
    const hasWinner = Boolean(pick?.winner);
    const hasDifficulty = pick?.difficulty === 'VD' || pick?.difficulty === 'VF';

    if (hasWinner && hasDifficulty) return 'complete';
    if (hasWinner || hasDifficulty) return 'incomplete';
    return 'empty';
  },

  locked(game) {
    return Date.now() >=
      new Date(game.date).getTime() - BOLAO_CONFIG.lockMinutes * 60000;
  },

  statusContent(state, locked) {
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

  ensureSummaryPanel() {
    let panel = document.querySelector('#picks-completeness-summary');
    if (panel) return panel;

    const games = document.querySelector('#games');
    if (!games) return null;

    panel = document.createElement('section');
    panel.id = 'picks-completeness-summary';
    panel.className = 'picks-completeness-summary';
    games.parentNode.insertBefore(panel, games);
    return panel;
  },

  apply() {
    if (this.applying) return;
    this.applying = true;

    try {
      const games = Bolao.Predictions.games || [];
      const picks = Bolao.Predictions.picks || {};
      const cards = document.querySelectorAll('#games .game-card');
      const totals = { complete: 0, incomplete: 0, empty: 0 };
      let firstOpenPending = null;

      cards.forEach((card, index) => {
        const game = games[index];
        if (!game) return;

        const state = this.state(picks[game.id]);
        const locked = this.locked(game);
        totals[state] += 1;

        card.dataset.pickState = state;
        card.classList.toggle('pick-card-complete', state === 'complete');
        card.classList.toggle('pick-card-incomplete', state === 'incomplete');
        card.classList.toggle('pick-card-empty', state === 'empty');

        let status = card.querySelector('.pick-completeness-status');
        if (!status) {
          status = document.createElement('div');
          status.className = 'pick-completeness-status';
          const choices = card.querySelector('.choices');
          if (choices) choices.insertAdjacentElement('afterend', status);
          else card.appendChild(status);
        }

        const content = this.statusContent(state, locked);
        status.className = `pick-completeness-status ${content.className}`;
        status.textContent = content.text;

        if (!locked && state !== 'complete' && !firstOpenPending) {
          firstOpenPending = card;
        }
      });

      const panel = this.ensureSummaryPanel();
      if (!panel) return;

      const total = games.length;
      const allComplete = total > 0 && totals.complete === total;

      panel.innerHTML = `
        <div class="picks-summary-grid">
          <div><span>Jogos</span><b>${total}</b></div>
          <div class="summary-complete"><span>Completos</span><b>${totals.complete}</b></div>
          <div class="summary-incomplete"><span>Incompletos</span><b>${totals.incomplete}</b></div>
          <div class="summary-empty"><span>Sem palpite</span><b>${totals.empty}</b></div>
        </div>
        <div class="picks-summary-action">
          <span>${allComplete
            ? '✓ Todos os palpites da rodada estão completos.'
            : 'Palpite completo exige vencedor e dificuldade VD ou VF.'}</span>
          ${firstOpenPending
            ? '<button type="button" id="next-pending-pick" class="secondary">Ir para o próximo pendente</button>'
            : ''}
        </div>`;

      const nextButton = panel.querySelector('#next-pending-pick');
      if (nextButton) {
        nextButton.onclick = () => {
          firstOpenPending.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstOpenPending.classList.remove('pick-attention-pulse');
          requestAnimationFrame(() => firstOpenPending.classList.add('pick-attention-pulse'));
        };
      }
    } finally {
      this.applying = false;
    }
  },

  watch() {
    const games = document.querySelector('#games');
    if (!games) return;

    if (this.observer) this.observer.disconnect();
    this.observer = new MutationObserver(() => {
      requestAnimationFrame(() => this.apply());
    });
    this.observer.observe(games, { childList: true, subtree: true });
  },

  async dashboardPending() {
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

const completenessPreviousRenderGames = Bolao.Predictions.renderGames.bind(Bolao.Predictions);
Bolao.Predictions.renderGames = function(week) {
  const result = completenessPreviousRenderGames(week);
  Bolao.PicksCompleteness.apply();
  Bolao.PicksCompleteness.watch();
  return result;
};

const completenessPreviousWeekly = Bolao.Predictions.weekly.bind(Bolao.Predictions);
Bolao.Predictions.weekly = async function() {
  await completenessPreviousWeekly();
  Bolao.PicksCompleteness.apply();
  Bolao.PicksCompleteness.watch();
};

const completenessPreviousDashboard = Bolao.Dashboard.render.bind(Bolao.Dashboard);
Bolao.Dashboard.render = async function() {
  await completenessPreviousDashboard();
  await Bolao.PicksCompleteness.dashboardPending();
};
