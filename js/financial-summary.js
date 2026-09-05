Bolao.FinancialSummary = {
  render(users) {
    const finance = Bolao.Finance.calculate(users);
    const money = Bolao.Finance.money;

    return `
      <div class="grid">
        <div class="card">
          <div class="muted">Arrecadação prevista</div>
          <div class="metric">${money(finance.totalExpected)}</div>
        </div>
        <div class="card">
          <div class="muted">Arrecadação recebida</div>
          <div class="metric">${money(finance.totalReceived)}</div>
        </div>
        <div class="card">
          <div class="muted">Prêmio por rodada</div>
          <div class="metric">${money(finance.roundPrize)}</div>
        </div>
      </div>
      <div class="card table-wrap" style="margin-top:16px">
        <h3>Distribuição dos fundos</h3>
        <table>
          <thead><tr><th>Modalidade</th><th>Valor por participante</th><th>Fundo total</th></tr></thead>
          <tbody>
            <tr><td>Premiação final</td><td>R$ 50,00</td><td>${money(finance.finalPool)}</td></tr>
            <tr><td>Maior pontuador acumulado dos playoffs</td><td>R$ 10,00</td><td>${money(finance.playoffChampionPool)}</td></tr>
            <tr><td>Maior pontuador acumulado da temporada regular</td><td>R$ 20,00</td><td>${money(finance.regularChampionPool)}</td></tr>
            <tr><td>Maiores pontuadores das 21 rodadas</td><td>R$ 20,00</td><td>${money(finance.roundWinnersPool)}</td></tr>
            <tr><td><strong>Total</strong></td><td><strong>R$ 100,00</strong></td><td><strong>${money(finance.allocatedTotal)}</strong></td></tr>
          </tbody>
        </table>
        <p class="muted">Cada rodada premiada paga ${money(finance.roundPrize)}. O valor decorre da divisão igual do fundo de rodadas entre 21 etapas.</p>
        <h3>Premiação final estimada</h3>
        <p>1º lugar: ${money(finance.finalPrizes[0])} · 2º lugar: ${money(finance.finalPrizes[1])} · 3º lugar: ${money(finance.finalPrizes[2])}</p>
        <p>Multa adicional do último colocado: ${money(finance.lastPlaceFine)}.</p>
      </div>
    `;
  }
};
