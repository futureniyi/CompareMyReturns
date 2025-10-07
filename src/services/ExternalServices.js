// ===============================
// ExternalServices.js
// ===============================

// ---- Price Cache Constants ----
const PRICE_CACHE_KEY = 'cmr_price_cache';
const PRICE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ---- Cache Utilities ----
function readPriceCache() {
    try {
        return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY) || '{}');
    } catch {
        return {};
    }
}

function writePriceCache(cache) {
    try {
        localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('[cmr] Failed to write price cache:', e);
    }
}

function cacheKey(coinId, vsCurrency, days) {
    return `${coinId}|${vsCurrency}|${days}`;
}

function getCachedPrices(coinId, vsCurrency, days) {
    const cache = readPriceCache();
    const entry = cache[cacheKey(coinId, vsCurrency, days)];
    if (!entry) return null;
    const fresh = Date.now() - entry.ts < PRICE_CACHE_TTL_MS;
    return fresh ? entry.data : null;
}

function setCachedPrices(coinId, vsCurrency, days, data) {
    const cache = readPriceCache();
    cache[cacheKey(coinId, vsCurrency, days)] = { data, ts: Date.now() };
    writePriceCache(cache);
}

// ---- Main API Function (with caching) ----
export async function fetchCoinGeckoDailyPrices({
    coinId = 'bitcoin',
    vsCurrency = 'usd',
    days = 30,
    interval = 'daily'
} = {}) {
    // 1️⃣ Try reading from cache
    const cached = getCachedPrices(coinId, vsCurrency, days);
    if (cached) {
        console.log(`[cmr] Using cached CoinGecko data for ${coinId} (${days}d, ${vsCurrency})`);
        return cached;
    }

    // 2️⃣ Otherwise, fetch fresh data
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart` +
        `?vs_currency=${encodeURIComponent(vsCurrency)}` +
        `&days=${encodeURIComponent(days)}` +
        `&interval=${encodeURIComponent(interval)}`;

    console.log(`[cmr] Fetching fresh CoinGecko prices for ${coinId} (${days}d, ${vsCurrency})`);
    const res = await fetch(url, { headers: { accept: 'application/json' } });

    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

    const data = await res.json(); // { prices: [[timestamp, price], ...] }

    // 3️⃣ Cache valid data
    if (data && (data.prices || data.total_volumes || data.market_caps)) {
        setCachedPrices(coinId, vsCurrency, days, data);
    }

    return data;
}

// ---- Period Map ----
export const PERIOD_OPTIONS = {
    '7d': 7,
    '30d': 30,
    '1y': 365
};

// ---- Optional Helper to Clear Cache ----
export function clearPriceCache() {
    localStorage.removeItem(PRICE_CACHE_KEY);
    console.log('[cmr] Price cache cleared');
}
