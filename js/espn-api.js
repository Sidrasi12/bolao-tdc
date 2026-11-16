Bolao.ESPN = {
  normalizeRecord(summary) {
    const parts = String(summary || '')
      .split('-')
      .map(value => Number.parseInt(value, 10));

    if (parts.length < 2 || parts.some(Number.isNaN)) {
      return 'Recorde indisponível';
    }

    return `${parts[0]}-${parts[1]}-${parts[2] || 0}`;
  },

  competitorRecord(competitor) {
    const records = competitor.records || [];
    const total = records.find(record => record.type === 'total') || records[0];
    return this.normalizeRecord(total?.summary);
  },

  async games(week = 1, type = 2) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates=${BOLAO_CONFIG.season}&seasontype=${type}&week=${week}`;
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) throw Error('Falha ao consultar jogos');

    const data = await response.json();

    return (data.events || []).map(event => {
      const competition = event.competitions[0];
      const away = competition.competitors.find(item => item.homeAway === 'away');
      const home = competition.competitors.find(item => item.homeAway === 'home');
      const odds = (competition.odds || [])[0] || {};
      const status = event.status || {};
      const statusType = status.type || {};

      return {
        id: event.id,
        date: event.date,
        status: statusType.name,
        completed: Boolean(statusType.completed),
        state: statusType.state || 'pre',
        statusDetail: statusType.shortDetail || statusType.detail || '',
        clock: status.displayClock || '',
        period: Number(status.period || 0),
        venue: competition.venue?.fullName || 'Estádio a definir',
        venueCity: competition.venue?.address?.city || '',
        spread: odds.details || '',
        away: {
          name: away.team.displayName,
          abbr: away.team.abbreviation,
          logo: away.team.logo,
          score: Number(away.score || 0),
          record: this.competitorRecord(away)
        },
        home: {
          name: home.team.displayName,
          abbr: home.team.abbreviation,
          logo: home.team.logo,
          score: Number(home.score || 0),
          record: this.competitorRecord(home)
        },
        playoff: type === 3
      };
    });
  },

  difficulty(game) {
    return Math.abs(game.home.score - game.away.score) > 10 ? 'VF' : 'VD';
  },

  spreadText(game) {
    return game.spread || 'Spread indisponível';
  },

  favorite(game) {
    if (!game.spread) return '';

    const text = game.spread.toUpperCase();
    if (text.includes('EVEN') || text.includes('PICK')) {
      return 'Sem favorito definido';
    }

    const abbreviation = [game.away.abbr, game.home.abbr]
      .find(value => text.includes(value.toUpperCase()));

    if (!abbreviation) return '';
    return abbreviation === game.away.abbr
      ? game.away.name
      : game.home.name;
  }
};
