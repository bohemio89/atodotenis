const urls = [
 'https://app.atptour.com/api/v2/gateway/livematches/website?scoringTournamentLevel=tour',
 'https://app.atptour.com/api/gateway/scores.liveMatches',
 'https://www.atptour.com/en/-/www/LiveMatches/2026/605',
 'https://www.atptour.com/en/scores/current/nitto-atp-finals/605/results',
 'https://www.atptour.com/en/scores/current/nitto-atp-finals/605/live-scores',
 'https://www.atptour.com/en/-/tournaments/calendar/tour',
 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard',
];
const H = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', Accept: 'application/json, text/html;q=0.9', 'Accept-Language': 'en-US,en;q=0.9' };
for (const u of urls) {
  try { const t0 = Date.now(); const r = await fetch(u, { headers: H, signal: AbortSignal.timeout(20000) }); const s = await r.text();
    console.log('URL', u, r.status, r.headers.get('content-type'), s.length, Date.now() - t0 + 'ms'); console.log('   ', s.replace(/\s+/g, ' ').slice(0, 400));
    if (/cobolli|alcaraz|medvedev/i.test(s)) { const i = s.search(/medvedev|cobolli/i); console.log('  HIT', s.slice(Math.max(0,i-300), i+500).replace(/\s+/g,' ')); }
  } catch (e) { console.log('URL', u, 'ERR', e.message); }
}
