Bolao.AdminExcelExport = {
  escape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  cell(value, type = 'String', style = '') {
    const styleAttribute = style ? ` ss:StyleID="${style}"` : '';
    const safeValue = value === null || value === undefined ? '' : value;
    return `<Cell${styleAttribute}><Data ss:Type="${type}">${this.escape(safeValue)}</Data></Cell>`;
  },

  row(values, header = false) {
    return `<Row>${values.map(value => {
      const numeric = typeof value === 'number' && Number.isFinite(value);
      return this.cell(value, numeric ? 'Number' : 'String', header ? 'Header' : '');
    }).join('')}</Row>`;
  },

  worksheet(name, headers, rows) {
    return `<Worksheet ss:Name="${this.escape(name)}"><Table>
      ${this.row(headers, true)}
      ${rows.map(row => this.row(row)).join('')}
    </Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane>
      <ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions></Worksheet>`;
  },

  workbook(worksheets) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
  <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#0B3B2E" ss:Pattern="Solid"/><Alignment ss:Vertical="Center"/></Style>
 </Styles>
 ${worksheets.join('')}
</Workbook>`;
  },

  download(content, filename) {
    const blob = new Blob([content], {
      type: 'application/vnd.ms-excel;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async activeUsers() {
    return Bolao.Admin.activeUsers();
  },

  async gamePicks(users, week, games) {
    const rows = [];

    for (const game of games) {
      const documentId = `${BOLAO_CONFIG.season}_${week}_${game.id}`;
      const lockAt = new Date(
        new Date(game.date).getTime() - BOLAO_CONFIG.lockMinutes * 60000
      );

      const picks = await Promise.all(users.map(async user => {
        const snapshot = await Bolao.db.collection('userPredictions')
          .doc(user.uid).collection('games').doc(documentId).get();
        return snapshot.exists ? snapshot.data() : null;
      }));

      users.forEach((user, index) => {
        const pick = picks[index];
        rows.push([
          BOLAO_CONFIG.season,
          week,
          game.id,
          game.away.name,
          game.home.name,
          new Date(game.date).toLocaleString('pt-BR'),
          lockAt.toLocaleString('pt-BR'),
          user.name || user.email || user.uid,
          pick?.winner || '',
          pick?.difficulty || '',
          pick?.winner && pick?.difficulty ? 'Completo' : pick?.winner || pick?.difficulty ? 'Incompleto' : 'Sem palpite'
        ]);
      });
    }

    return rows;
  },

  async roundScores(week) {
    const snapshot = await Bolao.db.collection('roundScores')
      .where('season', '==', BOLAO_CONFIG.season)
      .where('week', '==', week)
      .get();

    return snapshot.docs.map(document => {
      const data = document.data();
      return [
        data.userName || data.userId,
        Number(data.points || 0),
        Number(data.winnerHits || 0),
        Number(data.difficultyHits || 0),
        data.stage || 'regular'
      ];
    }).sort((a, b) => b[1] - a[1]);
  },

  async generalRanking(users) {
    const snapshot = await Bolao.db.collection('roundScores')
      .where('season', '==', BOLAO_CONFIG.season)
      .get();
    const scores = snapshot.docs.map(document => document.data());

    return users.map(user => {
      const userScores = scores.filter(score => score.userId === user.uid);
      const regular = userScores
        .filter(score => score.stage === 'regular' || !score.stage)
        .reduce((sum, score) => sum + Number(score.points || 0), 0);
      const playoffs = userScores
        .filter(score => score.stage === 'playoffs')
        .reduce((sum, score) => sum + Number(score.points || 0), 0);
      const preseason = Number(user.preseasonPoints || 0);

      return [
        user.name || user.email || user.uid,
        +regular.toFixed(2),
        +playoffs.toFixed(2),
        +preseason.toFixed(2),
        +(regular + playoffs + preseason).toFixed(2),
        user.paid ? 'Sim' : 'Não'
      ];
    }).sort((a, b) => b[4] - a[4]);
  },

  async export(week) {
    const button = document.querySelector('#export-excel');
    const status = document.querySelector('#process-status');
    button.disabled = true;
    button.textContent = 'Preparando arquivo...';

    try {
      const [users, games] = await Promise.all([
        this.activeUsers(),
        Bolao.ESPN.games(week, 2)
      ]);

      const [pickRows, scoreRows, rankingRows] = await Promise.all([
        this.gamePicks(users, week, games),
        this.roundScores(week),
        this.generalRanking(users)
      ]);

      const participantRows = users.map(user => [
        user.name || '',
        user.email || '',
        user.role || 'player',
        user.active === false ? 'Não' : 'Sim',
        user.paid ? 'Sim' : 'Não'
      ]);

      const worksheets = [
        this.worksheet('Participantes',
          ['Nome', 'E-mail', 'Função', 'Ativo', 'Pago'], participantRows),
        this.worksheet(`Palpites R${week}`,
          ['Temporada', 'Rodada', 'ID do jogo', 'Visitante', 'Mandante', 'Início', 'Prazo', 'Participante', 'Vencedor', 'VD/VF', 'Situação'], pickRows),
        this.worksheet(`Pontuação R${week}`,
          ['Participante', 'Pontos', 'Vencedores', 'VD/VF', 'Etapa'], scoreRows),
        this.worksheet('Ranking geral',
          ['Participante', 'Regular', 'Playoffs', 'Pré-temporada', 'Total', 'Pago'], rankingRows)
      ];

      const filename = `bolao-${BOLAO_CONFIG.season}-rodada-${week}.xml`;
      this.download(this.workbook(worksheets), filename);
      status.innerHTML = `<b>Exportação concluída.</b><br>Arquivo gerado: ${filename}`;
      Bolao.App.toast('Arquivo do Excel gerado');
    } catch (error) {
      status.textContent = 'Erro na exportação: ' + error.message;
      Bolao.App.toast('Falha ao exportar');
    } finally {
      button.disabled = false;
      button.textContent = 'Exportar para Excel';
    }
  },

  mount() {
    if (document.querySelector('#excel-export-card')) return;
    const grid = document.querySelector('.grid');
    if (!grid) return;

    const card = document.createElement('div');
    card.id = 'excel-export-card';
    card.className = 'card';
    card.innerHTML = `<h3>Exportação para Excel</h3>
      <label>Rodada<select id="export-week">
        ${Array.from({ length: 18 }, (_, index) =>
          `<option value="${index + 1}">${index + 1}</option>`
        ).join('')}
      </select></label>
      <button id="export-excel">Exportar para Excel</button>
      <p class="muted">Gera um arquivo com participantes, palpites, pontuação da rodada e ranking geral.</p>`;
    grid.appendChild(card);

    const currentWeek = Number(localStorage.getItem('bolao_week') || 1);
    card.querySelector('#export-week').value = String(
      Math.max(1, Math.min(18, currentWeek))
    );
    card.querySelector('#export-excel').onclick = () =>
      this.export(Number(card.querySelector('#export-week').value));
  }
};

const excelExportPreviousAdminRender = Bolao.Admin.render.bind(Bolao.Admin);
Bolao.Admin.render = async function() {
  await excelExportPreviousAdminRender();
  Bolao.AdminExcelExport.mount();
};
