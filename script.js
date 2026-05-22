// ==========================================
// translate to spanish (mymemory api)
// ==========================================
const randomWords = [
  'adventure', 'butterfly', 'sunshine', 'freedom', 'strength',
  'beautiful', 'dream', 'ocean', 'fire', 'moonlight',
  'warrior', 'love', 'thunder', 'courage', 'shadow',
  'paradise', 'legend', 'storm', 'spirit', 'diamond'
];

// cleans up the translation so it looks right
function cleanTranslation(text) {
  return text.toLowerCase().replace(/[,.]+$/, '').trim();
}

let translateTimer = null;

// picks a random word and translates it
async function cycleRandomWord() {
  const input = document.getElementById('translate-input');
  const output = document.getElementById('translate-output');
  const word = randomWords[Math.floor(Math.random() * randomWords.length)];
  input.value = word;

  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|es`);
    const data = await response.json();
    const translated = cleanTranslation(data.responseData.translatedText);
    output.innerHTML = `<p><strong>${word}</strong> → <strong>${translated}</strong></p>`;
  } catch (error) {
    output.innerHTML = '<p class="error">Could not load translation.</p>';
  }
}

// when user clicks translate button
async function translateText() {
  const input = document.getElementById('translate-input');
  const output = document.getElementById('translate-output');
  const text = input.value.trim();

  if (!text) {
    output.innerHTML = '<p class="error">Please enter some text to translate.</p>';
    return;
  }
  output.innerHTML = '<p class="loading">Translating...</p>';

  try {
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|es`);
    const data = await response.json();
    const translated = cleanTranslation(data.responseData.translatedText);
    output.innerHTML = `<p><strong>${text}</strong> → <strong>${translated}</strong></p>`;
  } catch (error) {
    output.innerHTML = '<p class="error">Translation failed. Try again.</p>';
  }
}

// ==========================================
// sports headlines (espn api)
// ==========================================
async function getSportsNews() {
  const sport = document.getElementById('sport-select').value;
  const output = document.getElementById('sports-output');
  output.innerHTML = '<p class="loading">Loading headlines...</p>';

  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${sport}/news`);
    const data = await response.json();
    const articles = data.articles.slice(0, 5);

    let html = '<ul>';
    for (const article of articles) {
      const link = article.links.web.href;
      html += `<li><a href="${link}" target="_blank">${article.headline}</a></li>`;
    }
    html += '</ul>';
    output.innerHTML = html;
  } catch (error) {
    output.innerHTML = '<p class="error">Could not load sports news.</p>';
  }
}

// ==========================================
// mlb live scores (espn api)
// ==========================================

// maps division names to where they are in the standings api
const divisionMap = {
  'AL East': { league: 0, division: 0 },
  'AL Central': { league: 0, division: 1 },
  'AL West': { league: 0, division: 2 },
  'NL East': { league: 1, division: 0 },
  'NL Central': { league: 1, division: 1 },
  'NL West': { league: 1, division: 2 }
};

// helper to grab a stat from the stats array
function getStat(stats, name) {
  const stat = stats.find(s => s.name === name);
  return stat ? stat.displayValue : '-';
}

async function getMLBScores() {
  const output = document.getElementById('mlb-output');
  const filter = document.getElementById('division-select').value;

  try {
    // grab standings and todays scores at the same time
    const [standingsRes, scoreboardRes] = await Promise.all([
      fetch('https://site.api.espn.com/apis/v2/sports/baseball/mlb/standings?level=3'),
      fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard')
    ]);

    const standingsData = await standingsRes.json();
    const scoreboardData = await scoreboardRes.json();

    // build lookup of todays games by team abbreviation
    const todaysGames = {};
    if (scoreboardData.events) {
      for (const event of scoreboardData.events) {
        const competition = event.competitions[0];
        const away = competition.competitors.find(c => c.homeAway === 'away');
        const home = competition.competitors.find(c => c.homeAway === 'home');
        const inning = event.status.period;
        const outs = event.status.type.state === 'in' ? (competition.situation?.outs ?? 0) : 0;
        const isLive = event.status.type.state === 'in';
        const isFinal = event.status.type.state === 'post';

        const gameInfo = { away, home, inning, outs, isLive, isFinal, date: event.date, state: event.status.type.state };
        todaysGames[away.team.abbreviation] = gameInfo;
        todaysGames[home.team.abbreviation] = gameInfo;
      }
    }

    // get the teams in the selected division
    const { league, division } = divisionMap[filter];
    const divisionData = standingsData.children[league].children[division];
    const teams = divisionData.standings.entries;

    // sort by win pct
    teams.sort((a, b) => {
      const aWinPct = parseFloat(getStat(a.stats, 'winPercent')) || 0;
      const bWinPct = parseFloat(getStat(b.stats, 'winPercent')) || 0;
      return bWinPct - aWinPct;
    });

    // track which games already rendered so no duplicates
    const renderedGames = new Set();
    let html = '';

    for (const team of teams) {
      const abbrev = team.team.abbreviation;
      const logo = team.team.logos[0].href;
      const record = `${getStat(team.stats, 'wins')}-${getStat(team.stats, 'losses')}`;
      const game = todaysGames[abbrev];

      if (game && !renderedGames.has(game)) {
        renderedGames.add(game);

        const outsHTML = `
          <div class="outs">
            <span class="out-dot ${game.outs >= 1 ? 'active' : ''}"></span>
            <span class="out-dot ${game.outs >= 2 ? 'active' : ''}"></span>
            <span class="out-dot ${game.outs >= 3 ? 'active' : ''}"></span>
          </div>
        `;

        const statusHTML = game.isFinal
          ? `<span class="game-status final">FINAL</span>`
          : game.isLive
          ? `<span class="game-status live">▶ ${game.inning === 1 ? '1ST' : game.inning === 2 ? '2ND' : game.inning === 3 ? '3RD' : game.inning + 'TH'} INN ${outsHTML}</span>`
          : `<span class="game-status upcoming">${new Date(game.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>`;

        html += `
          <div class="mlb-game">
            <div class="mlb-game-status">${statusHTML}</div>
            <div class="mlb-team">
              <img class="team-logo" src="${game.away.team.logo}" alt="${game.away.team.abbreviation}">
              <span class="team-abbrev">${game.away.team.abbreviation}</span>
              <span class="team-record">${game.away.records?.[0]?.summary ?? ''}</span>
              <span class="team-score ${game.isFinal && parseInt(game.away.score) > parseInt(game.home.score) ? 'winner' : ''}">${game.away.score}</span>
            </div>
            <div class="mlb-team">
              <img class="team-logo" src="${game.home.team.logo}" alt="${game.home.team.abbreviation}">
              <span class="team-abbrev">${game.home.team.abbreviation}</span>
              <span class="team-record">${game.home.records?.[0]?.summary ?? ''}</span>
              <span class="team-score ${game.isFinal && parseInt(game.home.score) > parseInt(game.away.score) ? 'winner' : ''}">${game.home.score}</span>
            </div>
          </div>
        `;
      } else if (!game) {
        // no game today for this team
        html += `
          <div class="mlb-game">
            <div class="mlb-game-status"><span class="game-status final">NO GAME</span></div>
            <div class="mlb-team">
              <img class="team-logo" src="${logo}" alt="${abbrev}">
              <span class="team-abbrev">${abbrev}</span>
              <span class="team-record">${record}</span>
            </div>
          </div>
        `;
      }
    }

    output.innerHTML = html;
  } catch (error) {
    output.innerHTML = '<p class="error">Could not load MLB data.</p>';
  }
}

// ==========================================
// betting odds (the odds api)
// ==========================================
async function fetchOdds() {
  const output = document.getElementById('odds-output');
  const apiKey = '130bdf7eb0f503831a3bbcb71284e08d';
  const americanSports = ['baseball_mlb', 'basketball_nba', 'americanfootball_nfl', 'icehockey_nhl'];

  try {
    const responses = await Promise.all(
      americanSports.map(sport =>
        fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${apiKey}&regions=us&markets=h2h&oddsFormat=american&bookmakers=draftkings`)
        .then(r => r.json())
        .catch(() => [])
      )
    );

    const allGames = responses.flat().filter(g => g.bookmakers?.length);

    if (!allGames.length) {
      output.innerHTML = '<p class="no-data">No odds available right now.</p>';
      return;
    }

    // live games first then sort by time
    const now = new Date();
    allGames.sort((a, b) => {
      const aLive = new Date(a.commence_time) <= now;
      const bLive = new Date(b.commence_time) <= now;
      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;
      return new Date(a.commence_time) - new Date(b.commence_time);
    });

    let html = '';
    allGames.slice(0, 5).forEach(game => {
      const home = game.bookmakers[0]?.markets?.[0]?.outcomes?.find(o => o.name === game.home_team);
      const away = game.bookmakers[0]?.markets?.[0]?.outcomes?.find(o => o.name === game.away_team);
      const isLive = new Date(game.commence_time) <= now;

      html += `
        <div class="odds-game">
          <div class="odds-sport">
            ${isLive ? '<span class="live-dot">● LIVE</span>' : ''}
            ${game.sport_title}
          </div>
          <div class="odds-team">
            <span>${game.away_team}</span>
            <span class="odds-line ${away?.price > 0 ? 'plus' : 'minus'}">${away?.price > 0 ? '+' : ''}${away?.price ?? 'N/A'}</span>
          </div>
          <div class="odds-team">
            <span>${game.home_team}</span>
            <span class="odds-line ${home?.price > 0 ? 'plus' : 'minus'}">${home?.price > 0 ? '+' : ''}${home?.price ?? 'N/A'}</span>
          </div>
        </div>
      `;
    });

    output.innerHTML = html;
  } catch (error) {
    output.innerHTML = '<p class="error">Could not load betting odds.</p>';
  }
}

// ==========================================
// usd currency converter (exchangerate api)
// ==========================================
async function fetchCurrency() {
  const amount = parseFloat(document.getElementById('currency-input').value) || 1;
  const output = document.getElementById('currency-output');

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await response.json();
    const rates = data.rates;

    const currencies = [
      { code: 'COP', flag: '🇨🇴' },
      { code: 'EUR', flag: '🇪🇺' },
      { code: 'GBP', flag: '🇬🇧' },
      { code: 'MXN', flag: '🇲🇽' },
      { code: 'CAD', flag: '🇨🇦' },
      { code: 'JPY', flag: '🇯🇵' },
    ];

    let html = '';
    currencies.forEach(({ code, flag }) => {
      const converted = (amount * rates[code]).toLocaleString('en-US', { maximumFractionDigits: 2 });
      html += `
        <div class="currency-row">
          <span class="currency-flag">${flag}</span>
          <span class="currency-name">${code}</span>
          <span class="currency-value">${converted}</span>
        </div>
      `;
    });

    output.innerHTML = html;
  } catch (error) {
    output.innerHTML = '<p class="error">Could not load exchange rates.</p>';
  }
}

// ==========================================
// bitcoin live price (coingecko api)
// ==========================================
let btcChart = null;
const btcPriceHistory = [];
const btcLabels = [];

async function fetchBitcoin() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true');
    const data = await response.json();
    const price = data.bitcoin.usd;
    const change = data.bitcoin.usd_24h_change.toFixed(2);
    const isUp = change >= 0;

    document.getElementById('btc-price').textContent = '$' + price.toLocaleString();
    const changeEl = document.getElementById('btc-change');
    changeEl.textContent = (isUp ? '▲' : '▼') + ' ' + Math.abs(change) + '%';
    changeEl.style.color = isUp ? '#4ade80' : '#f87171';

    // keep last 20 points for the chart
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    btcPriceHistory.push(price);
    btcLabels.push(now);
    if (btcPriceHistory.length > 20) {
      btcPriceHistory.shift();
      btcLabels.shift();
    }

    // build or update the chart
    const ctx = document.getElementById('btc-chart').getContext('2d');
    if (!btcChart) {
      btcChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: btcLabels,
          datasets: [{
            data: btcPriceHistory,
            borderColor: isUp ? '#4ade80' : '#f87171',
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
            backgroundColor: isUp ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { display: false },
            y: {
              display: true,
              ticks: {
                color: '#555',
                font: { size: 9 },
                callback: val => '$' + val.toLocaleString()
              },
              grid: { color: '#222' }
            }
          },
          animation: { duration: 300 }
        }
      });
    } else {
      btcChart.data.labels = btcLabels;
      btcChart.data.datasets[0].data = btcPriceHistory;
      btcChart.data.datasets[0].borderColor = isUp ? '#4ade80' : '#f87171';
      btcChart.data.datasets[0].backgroundColor = isUp ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)';
      btcChart.update();
    }
  } catch (error) {
    // just keep showing the last price if it fails
  }
}

// ==========================================
// nba scores (espn api)
// ==========================================
async function fetchNBA() {
  const output = document.getElementById('nba-output');

  try {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard');
    const data = await response.json();
    const events = data.events;

    if (!events || !events.length) {
      output.innerHTML = '<p class="no-data">No NBA games today.</p>';
      return;
    }

    let html = '';
    events.slice(0, 4).forEach(event => {
      const competition = event.competitions[0];
      const home = competition.competitors.find(c => c.homeAway === 'home');
      const away = competition.competitors.find(c => c.homeAway === 'away');
      const isLive = event.status.type.state === 'in';
      const isFinal = event.status.type.state === 'post';
      const period = event.status.period;
      const clock = event.status.displayClock;

      // playoff series info
      const series = competition.series;
      const notes = competition.notes?.[0]?.headline || '';
      let seriesText = '';
      if (series) {
        seriesText = `<div class="series-record">${notes} · ${series.summary || ''}</div>`;
      }

      const statusHTML = isFinal
        ? `<span class="game-status final">FINAL</span>`
        : isLive
        ? `<span class="game-status live">▶ Q${period} ${clock}</span>`
        : `<span class="game-status upcoming">${new Date(event.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>`;

      html += `
        <div class="mlb-game">
          <div class="mlb-game-status">${statusHTML} ${seriesText}</div>
          <div class="mlb-team">
            <img class="team-logo" src="${away.team.logo}" alt="${away.team.abbreviation}">
            <span class="team-abbrev">${away.team.abbreviation}</span>
            <span class="team-record">${away.records?.[0]?.summary ?? ''}</span>
            <span class="team-score ${isFinal && parseInt(away.score) > parseInt(home.score) ? 'winner' : ''}">${away.score}</span>
          </div>
          <div class="mlb-team">
            <img class="team-logo" src="${home.team.logo}" alt="${home.team.abbreviation}">
            <span class="team-abbrev">${home.team.abbreviation}</span>
            <span class="team-record">${home.records?.[0]?.summary ?? ''}</span>
            <span class="team-score ${isFinal && parseInt(home.score) > parseInt(away.score) ? 'winner' : ''}">${home.score}</span>
          </div>
        </div>
      `;
    });

    output.innerHTML = html;
  } catch (error) {
    output.innerHTML = '<p class="error">Could not load NBA scores.</p>';
  }
}

// ==========================================
// weather in medellin (open-meteo api)
// ==========================================
async function fetchWeather() {
  const output = document.getElementById('weather-output');

  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=6.2518&longitude=-75.5636&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit');
    const data = await response.json();
    const current = data.current;

    const weatherCodes = {
      0: { label: 'Clear Sky', icon: '☀️' },
      1: { label: 'Mainly Clear', icon: '🌤' },
      2: { label: 'Partly Cloudy', icon: '⛅' },
      3: { label: 'Overcast', icon: '☁️' },
      45: { label: 'Foggy', icon: '🌫' },
      51: { label: 'Light Drizzle', icon: '🌦' },
      61: { label: 'Light Rain', icon: '🌧' },
      63: { label: 'Rain', icon: '🌧' },
      80: { label: 'Rain Showers', icon: '🌦' },
      95: { label: 'Thunderstorm', icon: '⛈' },
    };

    const condition = weatherCodes[current.weather_code] ?? { label: 'Unknown', icon: '🌡' };

    output.innerHTML = `
      <div class="weather-display">
        <div class="weather-icon">${condition.icon}</div>
        <div class="weather-temp">${Math.round(current.temperature_2m)}°F</div>
        <div class="weather-condition">${condition.label}</div>
        <div class="weather-details">
          <span>💧 ${current.relative_humidity_2m}%</span>
          <span>💨 ${current.wind_speed_10m} mph</span>
        </div>
        <div class="weather-city">Medellín, Colombia</div>
      </div>
    `;
  } catch (error) {
    output.innerHTML = '<p class="error">Could not load weather data.</p>';
  }
}

// ==========================================
// load everything when the page opens
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // start the translate cycling
  cycleRandomWord();
  translateTimer = setInterval(cycleRandomWord, 3000);

  // stop cycling when user clicks the input
  const input = document.getElementById('translate-input');
  input.addEventListener('focus', () => {
    clearInterval(translateTimer);
    translateTimer = null;
    input.value = '';
  });

  getSportsNews();
  document.getElementById('sport-select').addEventListener('change', getSportsNews);

  getMLBScores();
  setInterval(getMLBScores, 30000);
  document.getElementById('division-select').addEventListener('change', getMLBScores);

  fetchBitcoin();
  setInterval(fetchBitcoin, 10000);

  fetchOdds();

  fetchCurrency();
  document.getElementById('currency-input').addEventListener('keypress', e => {
    if (e.key === 'Enter') fetchCurrency();
  });

  fetchNBA();
  setInterval(fetchNBA, 30000);

  fetchWeather();
});
