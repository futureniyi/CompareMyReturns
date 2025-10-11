// src/calc/returns.js

/**
 * Calculate Lump Sum vs DCA returns in USD-space.
 * @param {Array<[number, number]>} prices - [timestampMs, priceUSD], inclusive of start and end
 * @param {number} invested - total USD invested
 *
 * Notes:
 * - Many price APIs (e.g., CoinGecko) return an inclusive series: start ... end.
 *   That means an N-day window yields N+1 price points.
 * - For DCA, we want exactly one contribution per day in the window.
 *   Therefore, we invest on the first N points and use the last point ONLY for valuation.
 */
export function calculateReturns(prices, invested = 100) {
    if (!Array.isArray(prices) || prices.length === 0) {
        throw new Error("No price data to calculate returns.");
    }

    // Guard: if we have only one price, treat as a degenerate window.
    const totalPoints = prices.length;
    const startPrice = prices[0][1];                 // USD
    const endPrice = prices[totalPoints - 1][1];   // USD

    // Number of investment events (days):
    // For an inclusive series of length P, there are (P - 1) daily intervals.
    const dcaDays = Math.max(1, totalPoints - 1);

    // ----- Lump Sum -----
    const lumpUnits = invested / startPrice;
    const lumpFinal = lumpUnits * endPrice;    // USD
    const lumpGain = lumpFinal - invested;    // USD
    const lumpPct = (lumpGain / invested) * 100;

    // ----- DCA -----
    // Invest once per day across the window (excluding the final valuation point).
    const dailyInvestment = invested / dcaDays;

    let dcaUnits = 0;
    // Invest on indices [0 .. totalPoints-2], value at index totalPoints-1
    for (let i = 0; i < totalPoints - 1; i++) {
        const price = prices[i][1];
        if (price > 0 && Number.isFinite(price)) {
            dcaUnits += dailyInvestment / price;
        }
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
            days: dcaDays,
            dailyInvestment,
            endPrice,
            units: dcaUnits,
            finalValue: dcaFinal,
            gain: dcaGain,
            pctReturn: dcaPct
        }
    };
}
