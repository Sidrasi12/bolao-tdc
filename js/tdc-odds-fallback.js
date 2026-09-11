Bolao.TDCOddsFallback = {
  timer: null,

  async apply() {
    const week = +(localStorage.getItem('bolao_week') || 1);
    const games = Bolao.Predictions.games || [];
    const cards = document.querySelectorAll('.game-card');

    await Promise.all(games.map(async (game, index) => {
      const card = cards[index];
      if (!card) return;

      const id = `${BOLAO_CONFIG.season}_${week}_${game.id}`;
      const snapshot = await Bolao.db
        .collection('weeklyPickReveals')
        .doc(id)
        .get()
        .catch(() => null);

      if (!snapshot || !snapshot.exists) return;

      const reveal = snapshot.data() || {};
      const values = card.querySelectorAll('.odds-column strong');
      if (values.length < 2) return;

      const currentSpread = values[0].textContent.trim();
      const currentFavorite = values[1].textContent.trim();

      if ((!currentSpread || currentSpread === 'Spread indisponível') && reveal.spread) {
        values[0].textContent = reveal.spread;
      }

      if ((!currentFavorite || currentFavorite === 'Não definido') && reveal.favorite) {
        values[1].textContent = reveal.favorite;
      }
    }));
  },

  start() {
    clearInterval(this.timer);
    setTimeout(() => this.apply(), 500);
    this.timer = setInterval(() => this.apply(), 30000);
  }
};

const originalTDCWeekly = Bolao.Predictions.weekly.bind(Bolao.Predictions);

Bolao.Predictions.weekly = async function() {
  await originalTDCWeekly();
  Bolao.TDCOddsFallback.start();
};
