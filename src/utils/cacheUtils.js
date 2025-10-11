// src/utils/cacheUtils.js

function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "just now";
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

export function readPriceCacheEntry({ priceCacheKey, priceTTL, coinId, vsCurrency, days }) {
    try {
        const raw = localStorage.getItem(priceCacheKey);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        const key = `${coinId}|${vsCurrency}|${days}`;
        const entry = cache?.[key];
        if (!entry?.ts) return null;
        const age = Date.now() - entry.ts;
        return { ts: entry.ts, age, fresh: age < priceTTL };
    } catch {
        return null;
    }
}

export function readFxCacheEntry({ fxCacheKey, fxTTL }) {
    try {
        const raw = localStorage.getItem(fxCacheKey);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj?.ts) return null;
        const age = Date.now() - obj.ts;
        return { ts: obj.ts, age, fresh: age < fxTTL };
    } catch {
        return null;
    }
}

export function updateStampFromCaches({
    stampEl,
    priceCacheKey,
    priceTTL,
    fxCacheKey,
    fxTTL,
    coinId,
    vsCurrency = "usd",
    days
}) {
    if (!stampEl) return;

    const prices = readPriceCacheEntry({ priceCacheKey, priceTTL, coinId, vsCurrency, days });
    const fx = readFxCacheEntry({ fxCacheKey, fxTTL });

    const tsList = [prices?.ts, fx?.ts].filter(Boolean);
    if (tsList.length === 0) {
        stampEl.textContent = "Returns — Last updated";
        return;
    }
    const latestTs = Math.max(...tsList);
    const label =
        prices?.fresh && fx?.fresh ? "cached" :
            (prices?.fresh || fx?.fresh) ? "mixed" : "fresh";

    stampEl.textContent = `Returns — Last updated ${timeAgo(latestTs)} (${label})`;
}
