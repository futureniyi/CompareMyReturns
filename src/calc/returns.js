// src/calc/returns.js

/**
 * Calculate Lump Sum vs DCA returns in USD-space.
 * @param {Array<[number, number]>} prices - [timestampMs, priceUSD]
 * @param {number} invested - total USD invested
 */
export function calculateReturns(prices, invested = 100) {
    if (!Array.isArray(prices) || prices.length === 0) {
        throw new Error('No price data to calculate returns.');
    }

    const startPrice = prices[0][1];      // USD
    const endPrice = prices[prices.length - 1][1]; // USD
    const days = prices.length;

    // ----- Lump Sum -----
    const lumpUnits = invested / startPrice;
    const lumpFinal = lumpUnits * endPrice;    // USD
    const lumpGain = lumpFinal - invested;    // USD
    const lumpPct = (lumpGain / invested) * 100;

    // ----- DCA -----
    const dailyInvestment = invested / days;
    let dcaUnits = 0;
    for (const [, price] of prices) {
        dcaUnits += dailyInvestment / price;     // buy each day
    }
    const dcaFinal = dcaUnits * endPrice;      // USD
    const dcaGain = dcaFinal - invested;      // USD
    const dcaPct = (dcaGain / invested) * 100;

    return {
        invested,
        lumpSum: {
            startPrice, endPrice, units: lumpUnits,
            finalValue: lumpFinal, gain: lumpGain, pctReturn: lumpPct
        },
        dca: {
            days, dailyInvestment, endPrice, units: dcaUnits,
            finalValue: dcaFinal, gain: dcaGain, pctReturn: dcaPct
        }
    };
}
