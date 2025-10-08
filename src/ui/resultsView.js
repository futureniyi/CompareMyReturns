// src/ui/resultsView.js
import { toDisplay } from '../services/FxService.js';
import { calculateReturns } from '../calc/returns.js';

// ---------- helpers ----------
function fmtPct(n) {
  const fixed = Number.isFinite(n) ? n.toFixed(2) : '0.00';
  return `${fixed}%`;
}

function tsToUtcStamp(tsMs) {
  const d = new Date(tsMs);
  // Example: "Oct 4, 2025, 13:47 UTC"
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'UTC'
  }) + ' UTC';
}

/**
 * Render results cards for Lump Sum vs DCA and a summary message.
 * Money values are displayed in the currently selected currency via toDisplay(..., currency, rates).
 *
 * @param {Object} args
 * @param {Array<[number, number]>} args.prices  Array of [timestampMs, priceUSD] (inclusive start/end)
 * @param {string} args.currency                 Selected currency code (e.g., 'USD', 'NGN')
 * @param {Record<string, number>} args.rates    USD->CUR FX rates map
 * @param {HTMLElement} args.mount               Container (#results)
 * @param {HTMLElement} [args.stampEl]           Stamp element
 * @param {HTMLElement} [args.summaryEl]         Summary message container (#summary)
 * @param {string} [args.assetCode='btc']        Asset code for display (e.g., "btc")
 * @param {number} [args.investedUSD=100]        Principal in USD-space
 * @param {number} [args.periodDays]             Number of days in the window (e.g., 7/30/365)
 */
export function renderResultsCards({
  prices, currency, rates, mount, stampEl, summaryEl,
  assetCode = 'btc', investedUSD = 100, periodDays
}) {
  if (!mount || !Array.isArray(prices) || prices.length === 0) return;

  // 1) Compute returns in USD space
  const data = calculateReturns(prices, investedUSD); // { invested, lumpSum, dca }

  // 2) Prepare display values in the selected currency
  const sym = (assetCode || 'btc').toUpperCase();

  // Contributed
  const investedDisp = toDisplay(data.invested, currency, rates);

  // Lump Sum
  const lumpUnits = Number(data.lumpSum.units || 0).toFixed(8);
  const lumpStartDisp = toDisplay(data.lumpSum.startPrice, currency, rates);
  const lumpEndDisp = toDisplay(data.lumpSum.endPrice, currency, rates);
  const lumpFinalDisp = toDisplay(data.lumpSum.finalValue, currency, rates);
  const lumpGainDisp = toDisplay(data.lumpSum.gain, currency, rates);
  const lumpPctDisp = fmtPct(data.lumpSum.pctReturn);

  // DCA
  const dcaUnits = Number(data.dca.units || 0).toFixed(8);
  const dcaEndDisp = toDisplay(data.dca.endPrice, currency, rates);
  const dcaFinalDisp = toDisplay(data.dca.finalValue, currency, rates);
  const dcaGainDisp = toDisplay(data.dca.gain, currency, rates);
  const dcaDailyDisp = toDisplay(data.dca.dailyInvestment, currency, rates);
  const dcaPctDisp = fmtPct(data.dca.pctReturn);

  // 3) Build cards
  mount.innerHTML = `
    <article class="result-card">
      <h3>LUMP SUM</h3>
      <dl>
        <div><dt>Contributed:</dt><dd>${investedDisp}</dd></div>
        <div><dt>Units:</dt><dd>${lumpUnits} ${sym}</dd></div>
        <div><dt>Start price:</dt><dd>${lumpStartDisp}</dd></div>
        <div><dt>End price:</dt><dd>${lumpEndDisp}</dd></div>
        <div><dt>Final Value:</dt><dd><strong>${lumpFinalDisp}</strong></dd></div>
        <div>
          <dt>Gain/Loss:</dt>
          <dd class="${data.lumpSum.gain >= 0 ? 'gain' : 'loss'}">
            ${lumpGainDisp} (${lumpPctDisp})
          </dd>
        </div>
      </dl>
    </article>

    <article class="result-card">
      <h3>DCA (Dollar-Cost Averaging)</h3>
      <dl>
        <div><dt>Contributed:</dt><dd>${investedDisp}</dd></div>
        <div><dt>Days:</dt><dd>${data.dca.days}</dd></div>
        <div><dt>Daily invest:</dt><dd>${dcaDailyDisp}</dd></div>
        <div><dt>Units:</dt><dd>${dcaUnits} ${sym}</dd></div>
        <div><dt>End price:</dt><dd>${dcaEndDisp}</dd></div>
        <div><dt>Final Value:</dt><dd><strong>${dcaFinalDisp}</strong></dd></div>
        <div>
          <dt>Gain/Loss:</dt>
          <dd class="${data.dca.gain >= 0 ? 'gain' : 'loss'}">
            ${dcaGainDisp} (${dcaPctDisp})
          </dd>
        </div>
      </dl>
    </article>
  `;

  // 4) Updated stamp (uses last price timestamp)
  if (stampEl) {
    const lastTs = prices.at(-1)?.[0] ?? Date.now();
    stampEl.textContent = `Returns — Last updated ${tsToUtcStamp(lastTs)}`;
  }

  // 5) Winner + crystal-clear summary
  if (summaryEl) {
    const days = Number.isFinite(periodDays) ? periodDays : (prices.length - 1);

    const lumpFinalUSD = data.lumpSum.finalValue; // USD-space
    const dcaFinalUSD = data.dca.finalValue;     // USD-space
    const diffUSD = dcaFinalUSD - lumpFinalUSD; // + => DCA better, - => Lump Sum better
    const EPS = 1e-8;

    const winner =
      Math.abs(diffUSD) <= EPS ? 'Tie' :
        diffUSD > 0 ? 'DCA' : 'Lump Sum';

    const investedPhrase = investedDisp;
    const dayPhrase = `${days} day${days === 1 ? '' : 's'}`;

    const lumpFinalStrong = toDisplay(lumpFinalUSD, currency, rates);
    const dcaFinalStrong = toDisplay(dcaFinalUSD, currency, rates);
    const diffDisp = toDisplay(Math.abs(diffUSD), currency, rates);

    let comparisonNote;
    if (Math.abs(diffUSD) <= EPS) {
      comparisonNote = `about the same as the lump sum result`;
    } else if (diffUSD > 0) {
      comparisonNote = `${diffDisp} more than the lump sum result`;
    } else {
      comparisonNote = `${diffDisp} less than the lump sum result`;
    }

    const line1 =
      `If you invested ${investedPhrase} in ${sym} ${dayPhrase} ago as a lump sum, today you’d have ${lumpFinalStrong}.`;
    const line2 =
      `If you split ${investedPhrase} into ${days} equal daily investments, today you’d have ${dcaFinalStrong} — ${comparisonNote}.`;

    summaryEl.innerHTML = `<strong>Winner: ${winner}</strong><br>${line1} ${line2}`;
  }
}
