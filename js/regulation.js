Bolao.Regulation = {
  render() {
    Bolao.App.content(`
      <h1>Regulamento do Bolão TDC 2026</h1>

      <div class="card regulation-text">
        <h2>1. Objetivo e participação</h2>
        <p>1.1. O Bolão TDC 2026 é uma competição recreativa baseada em palpites sobre os jogos e os resultados da temporada da NFL.</p>
        <p>1.2. A participação implica a aceitação integral deste regulamento.</p>
        <p>1.3. Cada participante deverá utilizar uma conta individual, identificada por e-mail e senha.</p>
        <p>1.4. O nome informado no cadastro será exibido no cabeçalho, no ranking, nos palpites, nas apurações e nas demais áreas de identificação do participante.</p>
        <p>1.5. O participante é responsável pela segurança da própria senha, pela conferência dos palpites e pelo cumprimento dos prazos.</p>

        <h2>2. Inscrição</h2>
        <p>2.1. O valor da inscrição será de <strong>R$ 100,00 por participante</strong>.</p>
        <p>2.2. Não haverá multa ou cobrança adicional para o participante que terminar o bolão na última colocação.</p>
        <p>2.3. Para o cálculo das premiações, será considerada a quantidade oficial de participantes ativos.</p>

        <h2>3. Destinação das inscrições</h2>
        <ul>
          <li>R$ 50,00 por participante para a premiação da classificação final;</li>
          <li>R$ 20,00 por participante para o maior pontuador acumulado da temporada regular;</li>
          <li>R$ 10,00 por participante para o maior pontuador acumulado dos playoffs;</li>
          <li>R$ 20,00 por participante para os maiores pontuadores das 21 rodadas premiadas.</li>
        </ul>
        <p>3.1. O valor integral de R$ 100,00 de cada inscrição será destinado às modalidades acima.</p>

        <h2>4. Premiação por rodada</h2>
        <p>4.1. O fundo das rodadas será formado por R$ 20,00 de cada inscrição e dividido igualmente entre 21 rodadas premiadas.</p>
        <p>4.2. As rodadas premiadas serão as 18 rodadas da temporada regular, Wild Card, Divisional e Finais de Conferência.</p>
        <p>4.3. O prêmio de cada rodada será calculado pela fórmula: número de participantes ativos multiplicado por R$ 20,00, dividido por 21.</p>
        <p>4.4. Havendo empate na maior pontuação da rodada, o prêmio será dividido igualmente entre todos os participantes empatados.</p>
        <p>4.5. O Super Bowl pontuará nos playoffs e na classificação geral, mas não terá prêmio específico de rodada.</p>

        <h2>5. Premiações acumuladas</h2>
        <p>5.1. O fundo do maior pontuador da temporada regular será formado por R$ 20,00 de cada inscrição e considerará exclusivamente os pontos das 18 rodadas regulares.</p>
        <p>5.2. O fundo do maior pontuador dos playoffs será formado por R$ 10,00 de cada inscrição e considerará Wild Card, Divisional, Finais de Conferência e Super Bowl.</p>

        <h2>6. Premiação da classificação final</h2>
        <p>6.1. O fundo final será formado por R$ 50,00 de cada inscrição.</p>
        <ul>
          <li>Até 10 participantes: 100% para o primeiro colocado;</li>
          <li>De 11 a 20 participantes: 90% para o primeiro e 10% para o segundo;</li>
          <li>Mais de 20 participantes: 80% para o primeiro, 15% para o segundo e 5% para o terceiro.</li>
        </ul>
        <p>6.2. A classificação final será formada pela soma dos pontos da pré-temporada, da temporada regular e dos playoffs.</p>

        <h2>7. Palpites de pré-temporada</h2>
        <p>7.1. Cada participante poderá indicar:</p>
        <ul>
          <li>campeão e vice-campeão do Super Bowl;</li>
          <li>campeões das oito divisões;</li>
          <li>três Wild Cards da AFC e três Wild Cards da NFC;</li>
          <li>equipe de pior campanha;</li>
          <li>MVP da temporada.</li>
        </ul>
        <p>7.2. Os palpites deverão ser registrados até as 23h59 do dia 8 de setembro de 2026, no horário de Brasília, e não poderão ser alterados depois do encerramento.</p>
        <p>7.3. A ausência de palpite em qualquer item valerá zero ponto.</p>

        <h2>8. Pontuação dos palpites de pré-temporada</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Tipo de acerto</th><th>Pontos</th></tr>
            </thead>
            <tbody>
              <tr><td>Cada equipe indicada que estiver presente no Super Bowl</td><td>10</td></tr>
              <tr><td>Campeão do Super Bowl</td><td>10</td></tr>
              <tr><td>Vice-campeão do Super Bowl</td><td>5</td></tr>
              <tr><td>Cada campeão de divisão</td><td>8</td></tr>
              <tr><td>Cada Wild Card</td><td>4</td></tr>
              <tr><td>Equipe com a pior campanha</td><td>10</td></tr>
              <tr><td>MVP da temporada</td><td>10</td></tr>
            </tbody>
          </table>
        </div>
       

        <h2>9. Palpites dos jogos</h2>
        <p>9.1. Para cada partida, o participante deverá indicar a equipe vencedora e a dificuldade da vitória.</p>
        <p>9.2. VD, Vitória Difícil, corresponde à vitória por diferença de até 10 pontos.</p>
        <p>9.3. VF, Vitória Fácil, corresponde à vitória por diferença superior a 10 pontos.</p>
        <p>9.4. O palpite será encerrado 15 minutos antes do horário previsto para o início de cada partida.</p>
        <p>9.5. A ausência de palpite valerá zero ponto e o participante continuará incluído no denominador do fator de correção.</p>

        <h2>10. Pontuação dos jogos</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Etapa</th><th>Vencedor</th><th>Dificuldade VD/VF</th></tr>
            </thead>
            <tbody>
              <tr><td>Temporada regular</td><td>3 pontos</td><td>1 ponto</td></tr>
              <tr><td>Playoffs</td><td>6 pontos</td><td>2 pontos</td></tr>
            </tbody>
          </table>
        </div>
        <p>10.1. A dificuldade somente pontuará quando o participante também acertar a equipe vencedora.</p>

        <h2>11. Fator de correção</h2>
        <p>11.1. A pontuação de cada tipo de acerto nos jogos será multiplicada pelo fator correspondente ao percentual de participantes ativos que acertarem o respectivo palpite.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Percentual de acertadores</th><th>Fator de correção</th></tr>
            </thead>
            <tbody>
              <tr><td>100%</td><td>1,0</td></tr>
              <tr><td>85% a 99%</td><td>1,1</td></tr>
              <tr><td>70% a 84%</td><td>1,2</td></tr>
              <tr><td>55% a 69%</td><td>1,4</td></tr>
              <tr><td>40% a 54%</td><td>1,6</td></tr>
              <tr><td>21% a 39%</td><td>1,8</td></tr>
              <tr><td>10% a 20%</td><td>2,0</td></tr>
              <tr><td>Menos de 10%</td><td>2,5</td></tr>
            </tbody>
          </table>
        </div>
        <p>11.2. O fator do vencedor será calculado pela proporção de acertos da equipe vencedora.</p>
        <p>11.3. O fator da dificuldade será calculado pela proporção de participantes que acertarem simultaneamente o vencedor e a dificuldade.</p>

        <h2>12. Apuração e ranking</h2>
        <p>12.1. Somente partidas finalizadas serão consideradas na apuração.</p>
        <p>12.2. A Administração poderá registrar resultados manuais quando houver indisponibilidade ou divergência na fonte externa.</p>
        <p>12.3. A reapuração substituirá a apuração anterior e não duplicará pontos.</p>
        <p>12.4. O ranking poderá apresentar classificação geral, classificação por rodada, temporada regular, playoffs, pré-temporada, vencedores acertados e dificuldades acertadas.</p>

        <h2>13. Critérios de desempate</h2>
        <p>13.1. Nos rankings acumulados e na classificação final, serão aplicados sucessivamente:</p>
        <ol>
          <li>maior número de vencedores acertados;</li>
          <li>maior número de dificuldades acertadas;</li>
          <li>maior pontuação nos playoffs;</li>
          <li>maior pontuação de pré-temporada;</li>
          <li>divisão do prêmio, se o empate permanecer.</li>
        </ol>
        <p>13.2. No prêmio de uma rodada isolada, não serão aplicados critérios adicionais: os participantes empatados na maior pontuação dividirão diretamente o prêmio.</p>

        <h2>14. Administração</h2>
        <p>14.1. O bolão poderá ter até dois administradores, que também poderão participar da competição.</p>
        <p>14.2. Compete à Administração acompanhar cadastros e pagamentos, inserir ou corrigir resultados, executar ou reprocessar apurações, conferir rankings e premiações e resolver situações não previstas.</p>
        <p>14.3. Alterações técnicas não poderão modificar indevidamente palpites válidos, resultados corretos, pontos conquistados ou critérios de premiação.</p>
      </div>
    `);
  }
};
