Bolao.TeamRecords = {
  apply() {
    const games = Bolao.Predictions.games || [];
    const cards = document.querySelectorAll('#games .game-card');

    cards.forEach((card, index) => {
      const game = games[index];
      if (!game) return;

      const teams = card.querySelectorAll('.team');
      if (teams.length < 2) return;

      this.formatTeam(teams[0], game.away.name, game.away.record, false);
      this.formatTeam(teams[1], game.home.name, game.home.record, true);
    });
  },

  formatTeam(teamElement, teamName, record, isHome) {
    const image = teamElement.querySelector('img');
    const info = document.createElement('span');
    const name = document.createElement('span');
    const recordLine = document.createElement('small');

    info.className = 'team-info';
    name.className = 'team-name';
    recordLine.className = 'team-record';

    name.textContent = teamName;
    recordLine.textContent = `(${record || 'Recorde indisponível'})`;
    info.append(name, recordLine);

    teamElement.replaceChildren();
    teamElement.classList.toggle('team-home', isHome);

    if (isHome) {
      teamElement.append(info);
      if (image) teamElement.append(image);
    } else {
      if (image) teamElement.append(image);
      teamElement.append(info);
    }
  }
};

const originalRenderGames = Bolao.Predictions.renderGames.bind(Bolao.Predictions);

Bolao.Predictions.renderGames = function(week) {
  const result = originalRenderGames(week);
  Bolao.TeamRecords.apply();
  return result;
};
