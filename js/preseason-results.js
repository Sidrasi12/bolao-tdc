Bolao.PreseasonResults = {
  deadline() {
    return new Date(BOLAO_CONFIG.preseasonDeadline);
  },

  released() {
    return Date.now() >= this.deadline().getTime();
  },

  escape(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  team(value) {
    if (!value) return 'Sem palpite';

    const lists = [
      window.NFL_TEAMS,
      window.NFL_TEAMS_2026,
      Bolao.teams,
      Bolao.NFL_TEAMS
    ].filter(Array.isArray);

    const teams = lists.flat();
    const item = teams.find(team =>
      team.abbr === value ||
      team.id === value ||
      team.name === value
    );

    return item ? item.name : value;
  },

  percent(count, total) {
    if (!total) return '0,0%';
    return (count * 100 / total).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + '%';
  },

  async render() {
    const released = this.released();

    Bolao.App.content(`
      <div class="section-title">
        <h1>Palpites da pré-temporada</h1>
        <span class="badge">${released ? 'Palpites revelados' : 'Palpites privados'}</span>
      </div>
      <div id="preseason-results" class="card">
        ${released
          ? 'Carregando palpites...'
          : '<div class="notice">Os palpites de todos os participantes serão liberados após o encerramento do prazo.</div>'}
      </div>
    `);

    if (!released) return;

    const box = document.querySelector('#preseason-results');

    try {
      const usersSnapshot = await Bolao.db.collection('users').get();
      const users = usersSnapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(user => user.active !== false)
        .sort((a, b) =>
          (a.name || a.email || '').localeCompare(
            b.name || b.email || '',
            'pt-BR'
          )
        );

      const entries = await Promise.all(users.map(async user => {
        const snapshot = await Bolao.db
          .collection('userPredictions')
          .doc(user.uid)
          .collection('preseason')
          .doc(String(BOLAO_CONFIG.season))
          .get();

        return {
          user,
          picks: snapshot.exists ? snapshot.data().picks || null : null
        };
      }));

      this.renderContent(entries);
    } catch (error) {
      box.innerHTML = `
        <div class="notice">
          Não foi possível carregar os palpites: ${this.escape(error.message)}
        </div>
      `;
    }
  },

  renderContent(entries) {
    const box = document.querySelector('#preseason-results');
    const submitted = entries.filter(entry => entry.picks);
    const missing = entries.length - submitted.length;

    if (!entries.length) {
      box.innerHTML = '<p>Nenhum participante ativo encontrado.</p>';
      return;
    }

    box.innerHTML = `
      <div class="grid">
        <div class="card">
          <div class="muted">Participantes ativos</div>
          <div class="metric">${entries.length}</div>
        </div>
        <div class="card">
          <div class="muted">Palpites enviados</div>
          <div class="metric">${submitted.length}</div>
        </div>
        <div class="card">
          <div class="muted">Sem palpite</div>
          <div class="metric">${missing}</div>
        </div>
      </div>

      ${this.summary(submitted)}

      <h2 style="margin-top:24px">Escolhas por participante</h2>
      <p class="muted">Clique no nome para consultar todos os palpites.</p>
      ${entries.map(entry => this.participantCard(entry)).join('')}
    `;
  },

  summary(submitted) {
    const total = submitted.length;

    if (!total) {
      return `
        <h2 style="margin-top:24px">Resumo das escolhas</h2>
        <div class="notice">Nenhum palpite de pré-temporada foi registrado.</div>
      `;
    }

    const categories = [
      ['champion', 'Campeão do Super Bowl', true],
      ['runner', 'Vice-campeão do Super Bowl', true],
      ['div_AFC_Leste', 'Campeão da AFC Leste', true],
      ['div_AFC_Oeste', 'Campeão da AFC Oeste', true],
      ['div_AFC_Sul', 'Campeão da AFC Sul', true],
      ['div_AFC_Norte', 'Campeão da AFC Norte', true],
      ['div_NFC_Leste', 'Campeão da NFC Leste', true],
      ['div_NFC_Oeste', 'Campeão da NFC Oeste', true],
      ['div_NFC_Sul', 'Campeão da NFC Sul', true],
      ['div_NFC_Norte', 'Campeão da NFC Norte', true],
      ['wcAFC1', 'Wildcard AFC 1', true],
      ['wcAFC2', 'Wildcard AFC 2', true],
      ['wcAFC3', 'Wildcard AFC 3', true],
      ['wcNFC1', 'Wildcard NFC 1', true],
      ['wcNFC2', 'Wildcard NFC 2', true],
      ['wcNFC3', 'Wildcard NFC 3', true],
      ['worst', 'Pior campanha', true],
      ['mvp', 'MVP', false]
    ];

    return `
      <h2 style="margin-top:24px">Resumo das escolhas</h2>
      <p class="muted">
        Os percentuais usam como base os ${total} participantes que enviaram
        os palpites de pré-temporada.
      </p>
      ${categories.map(([key, label, isTeam]) =>
        this.categoryTable(submitted, key, label, isTeam)
      ).join('')}
    `;
  },

  categoryTable(submitted, key, label, isTeam) {
    const counts = new Map();

    submitted.forEach(({ picks }) => {
      const raw = String(picks[key] || '').trim();
      const value = raw || 'Sem palpite';
      counts.set(value, (counts.get(value) || 0) + 1);
    });

    const rows = [...counts.entries()].sort((a, b) =>
      b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR')
    );

    return `
      <details class="preseason-summary">
        <summary><b>${this.escape(label)}</b></summary>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Escolha</th>
                <th>Quantidade</th>
                <th>Percentual</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(([value, count]) => `
                <tr>
                  <td>${this.escape(isTeam ? this.team(value) : value)}</td>
                  <td>${count}</td>
                  <td>${this.percent(count, submitted.length)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </details>
    `;
  },

  participantCard({ user, picks }) {
    const name = this.escape(user.name || user.email || 'Participante');

    if (!picks) {
      return `
        <details class="preseason-entry">
          <summary><b>${name}</b> · Sem palpite registrado</summary>
          <p class="muted">Nenhum palpite de pré-temporada foi salvo.</p>
        </details>
      `;
    }

    const divisions = [
      ['div_AFC_Leste', 'AFC Leste'],
      ['div_AFC_Oeste', 'AFC Oeste'],
      ['div_AFC_Sul', 'AFC Sul'],
      ['div_AFC_Norte', 'AFC Norte'],
      ['div_NFC_Leste', 'NFC Leste'],
      ['div_NFC_Oeste', 'NFC Oeste'],
      ['div_NFC_Sul', 'NFC Sul'],
      ['div_NFC_Norte', 'NFC Norte']
    ];

    const line = (label, value) => `
      <tr>
        <th>${this.escape(label)}</th>
        <td>${this.escape(value)}</td>
      </tr>
    `;

    return `
      <details class="preseason-entry">
        <summary><b>${name}</b></summary>
        <div class="table-wrap">
          <table>
            <tbody>
              ${line('Campeão do Super Bowl', this.team(picks.champion))}
              ${line('Vice-campeão', this.team(picks.runner))}
              ${divisions.map(([key, label]) =>
                line(label, this.team(picks[key]))
              ).join('')}
              ${line('Wildcard AFC 1', this.team(picks.wcAFC1))}
              ${line('Wildcard AFC 2', this.team(picks.wcAFC2))}
              ${line('Wildcard AFC 3', this.team(picks.wcAFC3))}
              ${line('Wildcard NFC 1', this.team(picks.wcNFC1))}
              ${line('Wildcard NFC 2', this.team(picks.wcNFC2))}
              ${line('Wildcard NFC 3', this.team(picks.wcNFC3))}
              ${line('Pior campanha', this.team(picks.worst))}
              ${line('MVP', picks.mvp || 'Sem palpite')}
            </tbody>
          </table>
        </div>
      </details>
    `;
  }
};
