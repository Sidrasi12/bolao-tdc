Bolao.SmartRefresh = {
  timer: null,
  running: false,

  interval(games) {
    if (!games?.length) return 300000;
    if (games.every(game => game.completed)) return 0;
    if (games.some(game => game.state === 'in')) return 30000;

    const now = Date.now();
    const nextStart = games
      .filter(game => !game.completed && new Date(game.date).getTime() > now)
      .map(game => new Date(game.date).getTime())
      .sort((a, b) => a - b)[0];

    if (!nextStart) return 300000;
    return nextStart - now <= 90 * 60000 ? 60000 : 300000;
  },

  label(delay) {
    if (delay === 0) return 'Atualização automática encerrada: rodada finalizada.';
    if (delay === 30000) return 'Atualização automática a cada 30 segundos.';
    if (delay === 60000) return 'Atualização automática a cada 1 minuto.';
    return 'Atualização automática a cada 5 minutos.';
  },

  show(delay) {
    const actions = document.querySelector('.weekly-actions');
    if (!actions) return;

    let status = document.querySelector('#smart-refresh-status');
    if (!status) {
      status = document.createElement('small');
      status.id = 'smart-refresh-status';
      status.className = 'muted';
      actions.insertAdjacentElement('afterend', status);
    }
    status.textContent = this.label(delay);
  },

  stopLegacyTimers() {
    clearInterval(Bolao.Predictions.liveTimer);
    Bolao.Predictions.liveTimer = null;

    if (Bolao.TDCOddsFallback) {
      clearInterval(Bolao.TDCOddsFallback.timer);
      Bolao.TDCOddsFallback.timer = null;
    }

    if (Bolao.LiveRoundRanking) {
      clearInterval(Bolao.LiveRoundRanking.timer);
      Bolao.LiveRoundRanking.timer = null;
    }
  },

  schedule(week) {
    clearTimeout(this.timer);
    this.stopLegacyTimers();

    const delay = this.interval(Bolao.Predictions.games || []);
    this.show(delay);
    if (!delay || !document.querySelector('#games')) return;

    this.timer = setTimeout(() => this.run(week, false), delay);
  },

  async run(week, manual) {
    if (this.running || !document.querySelector('#games')) return;
    this.running = true;

    const button = document.querySelector('#refresh-live');
    if (button) {
      button.disabled = true;
      button.textContent = 'Atualizando...';
    }

    try {
      await Bolao.Predictions.refreshLive(week, false);

      if (Bolao.TDCOddsFallback) {
        clearInterval(Bolao.TDCOddsFallback.timer);
        await Bolao.TDCOddsFallback.apply();
      }

      if (Bolao.LiveRoundRanking) {
        clearInterval(Bolao.LiveRoundRanking.timer);
        await Bolao.LiveRoundRanking.update(manual);
      }

      if (manual) Bolao.App.toast('Placar atualizado');
    } catch (error) {
      if (manual) Bolao.App.toast('Não foi possível atualizar o placar');
      console.error('Falha na atualização inteligente:', error);
    } finally {
      this.running = false;
      if (button) {
        button.disabled = false;
        button.textContent = '↻ Atualizar';
      }
      this.schedule(week);
    }
  },

  start(week) {
    clearTimeout(this.timer);
    this.stopLegacyTimers();

    const button = document.querySelector('#refresh-live');
    if (button) button.onclick = () => this.run(week, true);

    this.schedule(week);
  }
};

if (Bolao.TDCOddsFallback) {
  Bolao.TDCOddsFallback.start = function() {
    clearInterval(this.timer);
    this.timer = null;
    setTimeout(() => this.apply(), 0);
  };
}

if (Bolao.LiveRoundRanking) {
  Bolao.LiveRoundRanking.start = function() {
    clearInterval(this.timer);
    this.timer = null;
    this.update(true);
  };
}

const tdcSmartPreviousWeekly = Bolao.Predictions.weekly.bind(Bolao.Predictions);
Bolao.Predictions.weekly = async function() {
  clearTimeout(Bolao.SmartRefresh.timer);
  await tdcSmartPreviousWeekly();

  Bolao.SmartRefresh.stopLegacyTimers();
  const week = +(localStorage.getItem('bolao_week') || 1);
  Bolao.SmartRefresh.start(week);
};
