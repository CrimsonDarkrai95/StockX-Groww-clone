'use strict';

const https = require('https');
const pool = require('../config/db');

const NSE_URL    = 'https://archives.nseindia.com/content/equities/EQUITY_L.csv';
const NASDAQ_URL = 'https://www.nasdaqtrader.com/dynamic/symdir/nasdaqlisted.txt';
const NYSE_URL   = 'https://www.nasdaqtrader.com/dynamic/symdir/otherlisted.txt';

// Fallback list used when NSE CSV returns 403 or is unreachable
const nseFallbackSymbols = [
  'RELIANCE', 'TCS', 'INFY', 'HDFC', 'HDFCBANK', 'ICICIBANK', 'SBIN',
  'KOTAKBANK', 'LT', 'AXISBANK', 'ITC', 'HINDUNILVR', 'BHARTIARTL',
  'ASIANPAINT', 'MARUTI', 'BAJFINANCE', 'ULTRACEMCO', 'SUNPHARMA',
  'TITAN', 'WIPRO', 'M&M', 'ONGC', 'NTPC', 'TECHM', 'BPCL',
  'COALINDIA', 'ADANIGREEN', 'DIVISLAB', 'BAJAJ-AUTO',
];

// Curated SGX list — deduplicated, verified symbols
const sgxSymbols = [
  { symbol: 'D05',  company: 'DBS Group Holdings Ltd',          exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'U11',  company: 'United Overseas Bank Ltd',         exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'O39',  company: 'OCBC Bank',                        exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'Z74',  company: 'Singapore Telecommunications Ltd', exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'C09',  company: 'CapitaLand Ascendas REIT',         exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'F34',  company: 'Singapore Airlines Ltd',           exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'C31',  company: 'City Developments Ltd',            exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'V03',  company: 'Venture Corp Ltd',                 exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'S68',  company: 'Sembcorp Industries Ltd',          exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'U96',  company: 'CapitaLand Investment Ltd',        exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'C52',  company: 'ComfortDelGro Corp Ltd',           exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'M44U', company: 'Mapletree Logistics Trust',        exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'ME8U', company: 'Mapletree Industrial Trust',       exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'N2IU', company: 'Mapletree Pan Asia Commercial Trust', exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'BUOU', company: 'Frasers Logistics & Commercial Trust', exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'A17U', company: 'Ascendas REIT',                    exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'T39',  company: 'SIA Engineering Company Ltd',      exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'S63',  company: 'Singapore Technologies Engineering', exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'BN4',  company: 'Keppel Ltd',                       exchange: 'SGX', listing_currency: 'SGD' },
  { symbol: 'G13',  company: 'Genting Singapore Ltd',            exchange: 'SGX', listing_currency: 'SGD' },
];

// Curated LSE list — deduplicated, verified symbols
const lseSymbols = [
  { symbol: 'HSBA', company: 'HSBC Holdings plc',                          exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'VOD',  company: 'Vodafone Group Plc',                         exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'BP',   company: 'BP plc',                                     exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'RIO',  company: 'Rio Tinto plc',                              exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'AZN',  company: 'AstraZeneca plc',                            exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'GSK',  company: 'GSK plc',                                    exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'GLEN', company: 'Glencore plc',                               exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'BATS', company: 'British American Tobacco plc',               exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'LLOY', company: 'Lloyds Banking Group plc',                   exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'BARC', company: 'Barclays plc',                               exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'SHEL', company: 'Shell plc',                                  exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'PRU',  company: 'Prudential plc',                             exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'DGE',  company: 'Diageo plc',                                 exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'IAG',  company: 'International Consolidated Airlines Group',  exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'BHP',  company: 'BHP Group plc',                              exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'NG',   company: 'National Grid plc',                          exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'TSCO', company: 'Tesco plc',                                  exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'BT.A', company: 'BT Group plc',                               exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'ULVR', company: 'Unilever plc',                               exchange: 'LSE', listing_currency: 'GBP' },
  { symbol: 'REL',  company: 'RELX plc',                                   exchange: 'LSE', listing_currency: 'GBP' },
];

// ---------------------------------------------------------------------------
// HTTP fetch helper — follows one redirect, rejects on 403/non-200
// ---------------------------------------------------------------------------
const fetchText = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        const { statusCode } = res;

        if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
          return resolve(fetchText(res.headers.location));
        }
        if (statusCode === 403) {
          return reject(new Error('HTTP 403 Forbidden'));
        }
        if (statusCode !== 200) {
          return reject(new Error(`HTTP ${statusCode}`));
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      })
      .on('error', reject);
  });

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

// NSE CSV: SYMBOL,NAME OF COMPANY,SERIES,...
// FIX: strip BOM character that may appear at start of UTF-8 file
const parseNSEData = (text) => {
  const lines = text
    .replace(/^\uFEFF/, '')           // strip BOM if present
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.toUpperCase().startsWith('SYMBOL'));

  return lines
    .map((line) => {
      const cols = line.split(',');
      const symbol = cols[0] ? cols[0].trim() : null;
      const company_name = cols[1] ? cols[1].trim() : null;
      if (!symbol) return null;
      return {
        symbol,
        company_name: company_name || symbol,
        exchange: 'NSE',
        listing_currency: 'INR',
      };
    })
    .filter(Boolean);
};

// NASDAQ listed: pipe-delimited, header line starts with "Symbol|"
// FIX: trailing summary line starts with "File Creation Time:" — skip it
const parseNasdaqListed = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('Symbol|'));

  return lines
    .map((line) => {
      const cols = line.split('|');
      const symbol = cols[0] ? cols[0].trim() : null;
      const company_name = cols[1] ? cols[1].trim() : null;
      if (
        !symbol ||
        /\^/.test(symbol) ||
        symbol.startsWith('File Creation Time')  // FIX: use startsWith not ===
      ) {
        return null;
      }
      return {
        symbol,
        company_name: company_name || symbol,
        exchange: 'NASDAQ',
        listing_currency: 'USD',
      };
    })
    .filter(Boolean);
};

// NYSE otherlisted: pipe-delimited, header line starts with "Symbol|"
// FIX: trailing summary line guard — same startsWith fix
const parseOtherListed = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('Symbol|'));

  return lines
    .map((line) => {
      const cols = line.split('|');
      const symbol = cols[0] ? cols[0].trim() : null;
      const company_name = cols[1] ? cols[1].trim() : null;
      if (
        !symbol ||
        /\^/.test(symbol) ||
        symbol.startsWith('File Creation Time')  // FIX: use startsWith not ===
      ) {
        return null;
      }
      return {
        symbol,
        company_name: company_name || symbol,
        exchange: 'NYSE',
        listing_currency: 'USD',
      };
    })
    .filter(Boolean);
};

// ---------------------------------------------------------------------------
// DB insert — ON CONFLICT (symbol, exchange) DO NOTHING
// ---------------------------------------------------------------------------
const insertStock = async (stock) => {
  const result = await pool.query(
    `INSERT INTO stocks (symbol, company_name, exchange, listing_currency, is_active)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (symbol, exchange) DO NOTHING`,
    [
      stock.symbol.toUpperCase(),
      stock.company_name || stock.symbol,
      stock.exchange,
      stock.listing_currency,
    ]
  );
  return result.rowCount || 0;
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const run = async () => {
  let totalInserted = 0;
  const perExchange = { NSE: 0, NASDAQ: 0, NYSE: 0, SGX: 0, LSE: 0 };

  const addStocks = async (stocks, exchange) => {
    for (const st of stocks) {
      try {
        const inserted = await insertStock(st);
        if (inserted) {
          totalInserted += inserted;
          perExchange[exchange] = (perExchange[exchange] || 0) + 1;
        }
      } catch (err) {
        console.error(
          `[seed] Insert error for ${st.symbol} (${exchange}):`,
          err.message
        );
      }
    }
  };

  // ── NSE ────────────────────────────────────────────────────────────────────
  let nseStocks = [];
  try {
    const nseText = await fetchText(NSE_URL);
    nseStocks = parseNSEData(nseText);
    console.log(`[seed] NSE source loaded ${nseStocks.length} symbols`);
  } catch (err) {
    console.warn(
      `[seed] NSE source unavailable (${err.message}), using fallback list`
    );
    nseStocks = nseFallbackSymbols.map((symbol) => ({
      symbol,
      company_name: symbol,
      exchange: 'NSE',
      listing_currency: 'INR',
    }));
  }
  await addStocks(nseStocks, 'NSE');

  // ── NASDAQ ─────────────────────────────────────────────────────────────────
  try {
    const nasdaqText = await fetchText(NASDAQ_URL);
    const nasdaqStocks = parseNasdaqListed(nasdaqText);
    console.log(`[seed] NASDAQ source loaded ${nasdaqStocks.length} symbols`);
    await addStocks(nasdaqStocks, 'NASDAQ');
  } catch (err) {
    console.warn(`[seed] NASDAQ source failed: ${err.message}`);
  }

  // ── NYSE ───────────────────────────────────────────────────────────────────
  try {
    const nyseText = await fetchText(NYSE_URL);
    const nyseStocks = parseOtherListed(nyseText);
    console.log(`[seed] NYSE source loaded ${nyseStocks.length} symbols`);
    await addStocks(nyseStocks, 'NYSE');
  } catch (err) {
    console.warn(`[seed] NYSE source failed: ${err.message}`);
  }

  // ── SGX ────────────────────────────────────────────────────────────────────
  console.log(`[seed] SGX hardcoded list: ${sgxSymbols.length} symbols`);
  await addStocks(sgxSymbols, 'SGX');

  // ── LSE ────────────────────────────────────────────────────────────────────
  console.log(`[seed] LSE hardcoded list: ${lseSymbols.length} symbols`);
  await addStocks(lseSymbols, 'LSE');

  console.log(
    '[seed] Done. Total inserted:',
    totalInserted,
    '| Per exchange:',
    perExchange
  );

  await pool.end();
};

run().catch(async (err) => {
  console.error('[seed] Fatal error:', err);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});