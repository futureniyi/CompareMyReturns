// Fetch daily price data from CoinGecko API
export async function fetchCoinGeckoDailyPrices({
    coinId = 'bitcoin',
    vsCurrency = 'usd',
    days = 30,
    interval = 'daily'
} = {}) {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart` +
        `?vs_currency=${encodeURIComponent(vsCurrency)}` +
        `&days=${encodeURIComponent(days)}` +
        `&interval=${encodeURIComponent(interval)}`;

    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    return res.json(); // returns { prices: [[timestamp, price], ...] }
}
