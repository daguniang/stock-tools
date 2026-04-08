#!/usr/bin/env node
const https = require('https');

function inferMarket(code) {
  if (!/^\d{6}$/.test(code)) return null;
  if (code.startsWith('6') || code.startsWith('9') || code.startsWith('5')) return 'sh';
  return 'sz';
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 OpenClaw stock-tools',
        'Referer': 'https://finance.sina.com.cn/'
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Request timeout')));
  });
}

function parseSina(code, text) {
  const market = inferMarket(code);
  const symbol = `${market}${code}`;
  const re = new RegExp(`var hq_str_${symbol}="([^"]*)"`);
  const m = text.match(re);
  if (!m) throw new Error(`Quote not found for ${symbol}`);
  const raw = m[1];
  const parts = raw.split(',');
  if (parts.length < 32) throw new Error('Unexpected quote payload');

  const name = parts[0] || code;
  const open = Number(parts[1]);
  const prevClose = Number(parts[2]);
  const price = Number(parts[3]);
  const high = Number(parts[4]);
  const low = Number(parts[5]);
  const volume = Number(parts[8]);
  const amount = Number(parts[9]);
  const date = parts[30] || null;
  const time = parts[31] || null;
  const change = Number((price - prevClose).toFixed(2));
  const pct = prevClose ? Number((((price - prevClose) / prevClose) * 100).toFixed(2)) : null;

  return {
    code,
    market,
    symbol,
    name,
    open,
    prevClose,
    price,
    high,
    low,
    volume,
    amount,
    change,
    pct,
    quoteDate: date,
    quoteTime: time,
    detailUrl: `https://stockpage.10jqka.com.cn/${code}/`
  };
}

async function main() {
  const codes = process.argv.slice(2).filter(Boolean);
  if (!codes.length) {
    console.error('Usage: fetch_quote.js <code> [code2 ...]');
    process.exit(1);
  }

  const normalized = codes.map(code => code.trim()).filter(code => /^\d{6}$/.test(code));
  if (!normalized.length) {
    console.error('No valid 6-digit stock codes provided');
    process.exit(1);
  }

  const symbols = normalized.map(code => `${inferMarket(code)}${code}`).join(',');
  const text = await fetchText(`https://hq.sinajs.cn/list=${symbols}`);
  const result = normalized.map(code => parseSina(code, text));
  process.stdout.write(JSON.stringify(result, null, 2));
}

main().catch(err => {
  console.error(err.message || String(err));
  process.exit(1);
});
