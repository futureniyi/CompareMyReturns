// // src/services/FxService.js

// Free endpoint — base USD, full currency list
const FX_API = 'https://open.er-api.com/v6/latest/USD';
const FX_CACHE_KEY = 'cmr_fx_usd_all_v1';
const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// ==============================
// Cache helpers
// ==============================
function now() { return Date.now(); }

function readFxCacheEntry() {
    try {
        const raw = localStorage.getItem(FX_CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj?.rates || !obj?.ts) return null;
        const age = now() - obj.ts;
        return {
            rates: obj.rates,
            ts: obj.ts,
            age,
            fresh: age < FX_TTL_MS
        };
    } catch {
        return null;
    }
}

function writeFxCache(rates) {
    try {
        const payload = { rates, ts: now() };
        localStorage.setItem(FX_CACHE_KEY, JSON.stringify(payload));
    } catch { /* ignore quota errors */ }
}

// Fire & forget refresh if stale
async function backgroundRefresh() {
    try {
        const res = await fetch(FX_API, { cache: 'no-store' });
        if (!res.ok) throw new Error(`FX ${res.status}`);
        const json = await res.json();
        // open.er-api returns { result: "success", base_code: "USD", rates: {...} }
        const rates = json?.rates || {};
        if (Object.keys(rates).length) writeFxCache(rates);
        // Optional: console.log('[cmr][fx] Background refresh complete.');
    } catch (err) {
        // Optional: console.warn('[cmr][fx] Background refresh failed:', err?.message || err);
    }
}

// ==============================
// Fetch all rates (USD → everything)
// Behavior:
// - If cache is fresh: return it immediately (no network).
// - If cache exists but stale: return it immediately and kick off a background refresh.
// - If no cache: fetch from network, cache, and return.
// ==============================
export async function getUsdRates() {
    const entry = readFxCacheEntry();

    if (entry?.fresh) {
        return entry.rates; // use fresh cache
    }

    if (entry && !entry.fresh) {
        // Return stale (still useful) and refresh in background
        // noawait
        backgroundRefresh();
        return entry.rates;
    }

    // No cache → fetch
    const res = await fetch(FX_API, { cache: 'no-store' });
    if (!res.ok) throw new Error(`FX ${res.status}`);
    const json = await res.json();
    const rates = json?.rates || {};
    if (!Object.keys(rates).length) throw new Error('No FX rates');

    writeFxCache(rates);
    return rates;
}

// ==============================
// Currency select helpers
// ==============================
export async function ensureCurrencyOptions(selectEl, rates) {
    if (!selectEl) return;
    const current = (selectEl.value || 'USD').toUpperCase();

    // Build options (stable sort: USD first, then A–Z)
    const symbols = Object.keys(rates || {}).filter(Boolean);
    if (!symbols.includes('USD')) symbols.push('USD');

    symbols.sort((a, b) => {
        if (a === 'USD') return -1;
        if (b === 'USD') return 1;
        return a.localeCompare(b);
    });

    const frag = document.createDocumentFragment();
    for (const code of symbols) {
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        frag.appendChild(opt);
    }

    selectEl.innerHTML = '';
    selectEl.appendChild(frag);

    // Keep previous selection if available, else default USD
    const wanted = symbols.includes(current) ? current : 'USD';
    selectEl.value = wanted;
}

export function saveCurrency(cur) {
    try { localStorage.setItem('cmr_currency', (cur || 'USD').toUpperCase()); } catch { }
}

// ==============================
// Formatting and conversions
// ==============================
function numberFormatterFor(code) {
    // Try to map common codes to locales; fallback to generic.
    // Not perfect, but avoids forcing a giant map.
    const locale =
        code === 'USD' ? 'en-US' :
            code === 'EUR' ? 'de-DE' :
                code === 'GBP' ? 'en-GB' :
                    code === 'JPY' ? 'ja-JP' :
                        code === 'NGN' ? 'en-NG' :
                            undefined;
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code });
}

export function fmtCurrency(amount, code = 'USD') {
    try {
        const fmt = numberFormatterFor(code);
        return fmt.format(Number(amount) || 0);
    } catch {
        // Fallback: basic format
        return `${code} ${(Number(amount) || 0).toFixed(2)}`;
    }
}

/**
 * Convert a USD amount to the user’s currency using USD→CUR rates.
 * @param {number} amountUSD
 * @param {string} currency
 * @param {Record<string, number>} rates  - object keyed by currency code (e.g., NGN: 1600)
 * @returns {number} local currency amount
 */
export function fromUSD(amountUSD, currency, rates) {
    const cur = (currency || 'USD').toUpperCase();
    if (cur === 'USD') return Number(amountUSD || 0);
    const rate = Number(rates?.[cur]);
    return Number(amountUSD || 0) * (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

/**
 * Convert a local amount to USD using USD→CUR rates.
 * @param {number} amountLocal
 * @param {string} currency
 * @param {Record<string, number>} rates  - object keyed by currency code (e.g., NGN: 1600)
 * @returns {number} USD amount
 *
 * USD = local / (USD→CUR rate)
 */
export function toUSD(amountLocal, currency, rates) {
    const cur = (currency || 'USD').toUpperCase();
    if (cur === 'USD') return Number(amountLocal || 0);
    const rate = Number(rates?.[cur]);
    return Number(amountLocal || 0) / (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

/**
 * Format a USD amount for display in the user's currency.
 * (Keeps your current display behavior.)
 */
export function toDisplay(amountUSD, currency, rates) {
    const cur = (currency || 'USD').toUpperCase();
    if (cur === 'USD') return fmtCurrency(amountUSD, 'USD');
    const value = fromUSD(amountUSD, cur, rates);
    return fmtCurrency(value, cur);
}

// ==============================
// Optional: manual cache clear
// ==============================
export function clearFxCache() {
    localStorage.removeItem(FX_CACHE_KEY);
    // Optional: console.log('[cmr][fx] FX cache cleared.');
}


// // Free endpoint — base USD, full currency list
// const FX_API = 'https://open.er-api.com/v6/latest/USD';
// const FX_CACHE_KEY = 'cmr_fx_usd_all_v1';
// const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

// // ===== Cache helpers =====
// function now() { return Date.now(); }

// function readFxCacheEntry() {
//     try {
//         const raw = localStorage.getItem(FX_CACHE_KEY);
//         if (!raw) return null;
//         const obj = JSON.parse(raw);
//         if (!obj?.rates || !obj?.ts) return null;
//         const age = now() - obj.ts;
//         const fresh = age < FX_TTL_MS;
//         return { rates: obj.rates, ts: obj.ts, fresh, age };
//     } catch {
//         return null;
//     }
// }

// function writeFxCache(rates) {
//     try {
//         localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates, ts: now() }));
//     } catch (e) {
//         console.warn('[cmr][fx] Failed to write FX cache:', e);
//     }
// }

// // Non-blocking revalidation: refresh cache in background
// async function revalidateFxCache() {
//     try {
//         console.log('[cmr][fx] Cache is stale — refreshing in background…');
//         const res = await fetch(FX_API, { headers: { accept: 'application/json' } });
//         if (!res.ok) throw new Error('FX fetch failed: ' + res.status);
//         const data = await res.json();
//         const rates = data?.rates;
//         if (!rates || typeof rates !== 'object') throw new Error('Invalid FX rates response');
//         writeFxCache(rates);
//         console.log('[cmr][fx] Background refresh complete.');
//     } catch (err) {
//         console.warn('[cmr][fx] Background refresh failed:', err?.message || err);
//     }
// }

// // ===== Fetch all rates (USD → everything) =====
// // Behavior:
// // - If cache is fresh: return it immediately (no network), log "using cache".
// // - If cache exists but stale: return it immediately and kick off a background refresh.
// // - If no cache: fetch from network, cache, and return.
// export async function getUsdRates() {
//     const entry = readFxCacheEntry();

//     if (entry?.fresh) {
//         console.log(`[cmr][fx] Using cached FX rates (age ${(entry.age / 1000 / 60).toFixed(1)} min).`);
//         return entry.rates;
//     }

//     if (entry && !entry.fresh) {
//         // Stale-while-revalidate: serve stale, refresh in background
//         console.warn('[cmr][fx] Using stale FX rates; will refresh in background.');
//         // Fire-and-forget
//         revalidateFxCache();
//         return entry.rates;
//     }

//     // No cache: fetch fresh
//     console.log('[cmr][fx] No FX cache — fetching fresh rates…');
//     const res = await fetch(FX_API, { headers: { accept: 'application/json' } });
//     if (!res.ok) throw new Error('FX fetch failed: ' + res.status);
//     const data = await res.json();
//     const rates = data?.rates;
//     if (!rates || typeof rates !== 'object') throw new Error('Invalid FX rates response');
//     writeFxCache(rates);
//     console.log('[cmr][fx] Fresh FX rates fetched and cached.');
//     return rates;
// }

// // ===== Populate all currencies in <select> =====
// export async function ensureCurrencyOptions(selectEl, rates) {
//     if (!selectEl) return;
//     const codes = Object.keys(rates || {}).filter(Boolean).sort();

//     // Always keep USD first
//     const idx = codes.indexOf('USD');
//     if (idx > -1) codes.splice(idx, 1);
//     codes.unshift('USD');

//     // Build options
//     const frag = document.createDocumentFragment();
//     for (const code of codes) {
//         const opt = document.createElement('option');
//         opt.value = code;
//         opt.textContent = code;
//         frag.appendChild(opt);
//     }

//     selectEl.innerHTML = '';
//     selectEl.appendChild(frag);

//     // Restore last used or default to USD
//     const last = localStorage.getItem('cmr_currency') || 'USD';
//     if ([...selectEl.options].some(o => o.value === last)) {
//         selectEl.value = last;
//     } else {
//         selectEl.value = 'USD';
//     }
// }

// // ===== Save selection =====
// export function saveCurrency(code) {
//     try { localStorage.setItem('cmr_currency', (code || 'USD').toUpperCase()); } catch { }
// }

// // ===== Convert & format =====
// export function fmtCurrency(num, code) {
//     try {
//         return new Intl.NumberFormat(undefined, {
//             style: 'currency',
//             currency: code,
//             maximumFractionDigits: 2
//         }).format(num);
//     } catch {
//         return `${code} ${Number(num ?? 0).toFixed(2)}`;
//     }
// }

// export function toDisplay(amountUSD, currency, rates) {
//     const cur = (currency || 'USD').toUpperCase();
//     if (cur === 'USD') return fmtCurrency(amountUSD, 'USD');
//     const rate = rates?.[cur];
//     const value = Number.isFinite(rate) ? amountUSD * rate : amountUSD;
//     return fmtCurrency(value, cur);
// }

// // ===== Optional: manual cache clear for testing =====
// export function clearFxCache() {
//     localStorage.removeItem(FX_CACHE_KEY);
//     console.log('[cmr][fx] FX cache cleared.');
// }
