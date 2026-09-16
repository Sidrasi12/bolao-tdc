Bolao.AdminHealth = {
  escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  },

  statusClass(ok, warning = false) {
    if (ok) return 'health-ok';
    return warning ? 'health-warning' : 'health-error';
  },

  label(ok, yes, no, warning = false) {
    return `<span class="health-status ${this.statusClass(ok, warning)}">${ok ? '✓ ' + yes : '⚠ ' + no}</span>`;
  },

  async documentData(collection, id) {
    try {
      const snapshot = await Bolao.db.collection(collection).doc(id).get();
      return snapshot.exists ? snapshot.data() : null;
    } catch (error) {
      if (error?.code === 'permission-denied') return null;
      throw error;
    }
  },

  async pickCount(users, week, gameId) {
    const id = `${BOLAO_CONFIG.season}_${week}_${gameId}`;
    const picks = await Promise.all(users.map(async user => {
      const snapshot = await Bolao.db.collection('userPredictions')
        .doc(user.uid).collection('games').doc(id).get();
      return snapshot.exists && Boolean(snapshot.data().winner);
    }));
    return picks.filter(Boolean).length;
  },

  async roundProcessed(week) {
    const id = `${BOLAO_CONFIG.season}_${week}`;
    return this.documentData('roundResults', id);
  },

  async inspectGame(game, week, users, roundResult) {
    const id = `${BOLAO_CONFIG.season}_${week}_${game.id}`;
    const lockMs = new Date(game.date).getTime() - BOLAO_CONFIG.lockMinutes * 60000;
    const locked = Date.now() >= lockMs;

    let summary = null;
    let reveal = null;

    // weeklyBetSummaries e weeklyPickReveals só podem ser lidos após lockAt.
    // Jogos ainda abertos não são consultados, evitando permission-denied.
    if (locked) {
      [summary, reveal] = await Promise.all([
        this.documentData('weeklyBetSummaries', id),
        this.documentData('weeklyPickReveals', id)
      ]);
    }

    const submitted = await this.pickCount(users, week, game.id);
    const spreadSaved = Boolean(
      reveal?.spread && reveal.spread !== 'Spread indisponível'
    );
    const favoriteSaved = Boolean(
      reveal?.favorite && reveal.favorite !== 'Não definido'
    );
    const processed = Boolean(roundResult?.gameStats?.[game.id]);

    let attention = 0;
    if (locked && !summary) attention += 1;
    if (locked && !reveal) attention += 1;
    if (locked && (!spreadSaved || !favoriteSaved)) attention += 1;
    if (game.completed && !processed) attention += 1;

    return {
      game, id, locked, lockMs, summary, reveal, submitted,
      spreadSaved, favoriteSaved, processed, attention
    };
  },

  gameState(game) {
    if (game.completed) return 'Finalizado';
    if (game.state === 'in') return game.statusDetail || 'Em andamento';
    return 'Agendado';
  },

  renderSummary(items, users) {
    const total = items.length;
    const locked = items.filter(item => item.locked).length;
    const summaries = items.filter(item => item.summary).length;
    const reveals = items.filter(item => item.reveal).length;
    const spreads = items.filter(item => item.spreadSaved && item.favoriteSaved).length;
    const finalGames = items.filter(item => item.game.completed).length;
    const processed = items.filter(item => item.processed).length;
    const attention = items.filter(item => item.attention > 0).length;

    return `<div class="health-metrics">
      <div class="health-metric"><span>Jogos</span><b>${total}</b></div>
      <div class="health-metric"><span>Participantes ativos</span><b>${users.length}</b></div>
      <div class="health-metric"><span>Prazos encerrados</span><b>${locked}</b></div>
      <div class="health-metric"><span>Distribuições</span><b>${summaries}</b></div>
      <div class="health-metric"><span>Revelações</span><b>${reveals}</b></div>
      <div class="health-metric"><span>Spread preservado</span><b>${spreads}</b></div>
      <div class="health-metric"><span>Finalizados</span><b>${finalGames}</b></div>
      <div class="health-metric"><span>Apurados</span><b>${processed}</b></div>
      <div class="health-metric ${attention ? 'needs-attention' : ''}"><span>Exigem atenção</span><b>${attention}</b></div>
    </div>`;
  },

  renderGame(item, activeUsers) {
    const game = item.game;
    const lockText = new Date(item.lockMs).toLocaleString('pt-BR', {
      dateStyle: 'short', timeStyle: 'short'
    });
    const picksOk = item.submitted === activeUsers;

    return `<article class="health-game ${item.attention ? 'has-alert' : ''}">
      <div class="health-game-head">
        <div>
          <b>${this.escape(game.away.name)} × ${this.escape(game.home.name)}</b>
          <small>${this.escape(this.gameState(game))} · fechamento ${lockText}</small>
        </div>
        <span class="health-alert-count">${item.attention ? item.attention + ' alerta(s)' : 'Tudo certo'}</span>
      </div>
      <div class="health-grid">
        <div><span>Prazo</span>${this.label(item.locked, 'Encerrado', 'Aberto', true)}</div>
        <div><span>Palpites</span><b>${item.submitted} de ${activeUsers}</b>${picksOk ? '' : '<small>Há participantes sem escolha.</small>'}</div>
        <div><span>Distribuição</span>${this.label(Boolean(item.summary), 'Publicada', item.locked ? 'Ausente' : 'Aguardando', !item.locked)}</div>
        <div><span>Escolhas individuais</span>${this.label(Boolean(item.reveal), 'Publicadas', item.locked ? 'Ausentes' : 'Aguardando', !item.locked)}</div>
        <div><span>Spread congelado</span>${this.label(item.spreadSaved, this.escape(item.reveal?.spread), item.locked ? 'Ausente' : 'Aguardando', !item.locked)}</div>
        <div><span>Favorito congelado</span>${this.label(item.favoriteSaved, this.escape(item.reveal?.favorite), item.locked ? 'Ausente' : 'Aguardando', !item.locked)}</div>
        <div><span>Resultado</span>${this.label(game.completed, 'Final disponível', game.state === 'in' ? 'Parcial' : 'Pendente', true)}</div>
        <div><span>Apuração</span>${this.label(item.processed, 'Realizada', game.completed ? 'Pendente' : 'Aguardando', !game.completed)}</div>
      </div>
    </article>`;
  },

  async load(week) {
    const box = document.querySelector('#health-results');
    const button = document.querySelector('#health-refresh');
    if (!box || !button) return;

    button.disabled = true;
    button.textContent = 'Verificando...';
    box.innerHTML = '<div class="notice">Consultando jogos, palpites e documentos da rodada...</div>';

    try {
      const [games, users, roundResult] = await Promise.all([
        Bolao.ESPN.games(week, 2),
        Bolao.Admin.activeUsers(),
        this.roundProcessed(week)
      ]);
      const ordered = [...games].sort((a, b) => new Date(a.date) - new Date(b.date));
      const items = await Promise.all(
        ordered.map(game => this.inspectGame(game, week, users, roundResult))
      );

      box.innerHTML = `${this.renderSummary(items, users)}
        <div class="health-actions-note"><b>Leitura do painel:</b> jogos abertos aparecem como “Aguardando” e não geram alerta.</div>
        <div class="health-games">${items.map(item => this.renderGame(item, users.length)).join('') || '<p>Nenhum jogo encontrado.</p>'}</div>`;
    } catch (error) {
      box.innerHTML = `<div class="notice">Não foi possível verificar a rodada: ${this.escape(error.message)}</div>`;
    } finally {
      button.disabled = false;
      button.textContent = 'Atualizar painel';
    }
  },

  mount() {
    if (document.querySelector('#admin-health-panel')) return;
    const usersBox = document.querySelector('#users');
    if (!usersBox) return;

    const panel = document.createElement('section');
    panel.id = 'admin-health-panel';
    panel.className = 'card admin-health-panel';
    panel.innerHTML = `<div class="section-title health-title">
      <div><h2>Painel de saúde da rodada</h2><p class="muted">Confira publicação, spread, resultado e apuração de cada jogo.</p></div>
      <div class="health-controls">
        <label>Rodada<select id="health-week">${Array.from({length:18},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label>
        <button id="health-refresh">Atualizar painel</button>
      </div>
    </div><div id="health-results"><p>Selecione a rodada e atualize o painel.</p></div>`;

    usersBox.parentNode.insertBefore(panel, usersBox);
    const week = Number(localStorage.getItem('bolao_week') || 1);
    panel.querySelector('#health-week').value = String(Math.max(1, Math.min(18, week)));
    panel.querySelector('#health-refresh').onclick = () =>
      this.load(Number(panel.querySelector('#health-week').value));
  }
};

const healthPreviousAdminRender = Bolao.Admin.render.bind(Bolao.Admin);
Bolao.Admin.render = async function() {
  await healthPreviousAdminRender();
  Bolao.AdminHealth.mount();
};
