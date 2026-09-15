Bolao.TeamRecords = {
  apply() {
    const games = Bolao.Predictions.games || [];
    const cards = document.querySelectorAll('#games .game-card');

    cards.forEach((card, index) => {
      const game = games[index];
      if (!game) return;

      const teams = card.querySelectorAll('.team');
      if (teams.length < 2) return;

      this.addRecord(teams[0], game.away.record);
      this.addRecord(teams[1], game.home.record);
    });
  },

  addRecord(teamElement, record) {
    let recordElement = teamElement.querySelector('.team-record');

    if (!recordElement) {
      recordElement = document.createElement('small');
      recordElement.className = 'team-record';
      teamElement.appendChild(recordElement);
    }

    recordElement.textContent = record || 'Recorde indisponível';
  }
};

const originalRenderGames = Bolao.Predictions.renderGames.bind(Bolao.Predictions);

Bolao.Predictions.renderGames = function(week) {
  const result = originalRenderGames(week);
  Bolao.TeamRecords.apply();
  return result;
};
