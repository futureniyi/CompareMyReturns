// ------------------------------
// main.js  (CompareMyReturns)
// ------------------------------

// ---------- Imports ----------
import { populateAssetOptions } from '../src/ui/populateAssets.js';
import { fetchCoinGeckoDailyPrices, PERIOD_OPTIONS } from '../src/services/ExternalServices.js';
import { getUsdRates, ensureCurrencyOptions, saveCurrency } from '../src/services/FxService.js';
import { renderResultsCards } from '../src/ui/resultsView.js';

// ---------- LocalStorage keys ----------
const LS_ASSET = 'cmr_asset';
const LS_PERIOD = 'cmr_period';
const LS_CURRENCY = 'cmr_currency';

// Match your cache keys/constants from services:
const PRICE_CACHE_KEY = 'cmr_price_cache';
const PRICE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2h (mirror ExternalServices)
const FX_CACHE_KEY = 'cmr_fx_usd_all_v1';
const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6h (mirror FxService)

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);

const assetSelect = $('#asset');
const currencyEl = $('#currency');
const periodRadios = document.querySelectorAll('input[name="period"]');
const compareBtn = $('#compare') || $('#compareBtn') || $('button[type="submit"]'); // flexible
const stampEl = $('.stamp');

const resultsEl = $('#results');   // optional
const messageEl = $('#message');   // optional

// ---------- State ----------
let codeToCoinId = {}; // built from populateAssetOptions
let currentCoinId = 'bitcoin';
let lastPrices = null; // [[ts, price], ...] from CoinGecko
let lastRates = null;  // USD->CUR map
let lastAssetCode = 'btc';
let lastInvestedUSD = 100; // adjust if you add an input

// ---------- Utils ----------
function timeAgo(ts) {
    const diff = Date.now() - ts;
    if (diff < 60_000) return 'just now';
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// Read specific price cache entry
function readPriceCacheEntry(coinId, vsCurrency, days) {
    try {
        const raw = localStorage.getItem(PRICE_CACHE_KEY);
        if (!raw) return null;
        const cache = JSON.parse(raw);
        const key = `${coinId}|${vsCurrency}|${days}`;
        const entry = cache?.[key];
        if (!entry?.ts) return null;
        const age = Date.now() - entry.ts;
        const fresh = age < PRICE_CACHE_TTL_MS;
        return { ts: entry.ts, age, fresh };
    } catch {
        return null;
    }
}

// Read FX cache entry (whole map)
function readFxCacheEntry() {
    try {
        const raw = localStorage.getItem(FX_CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj?.ts) return null;
        const age = Date.now() - obj.ts;
        const fresh = age < FX_TTL_MS;
        return { ts: obj.ts, age, fresh };
    } catch {
        return null;
    }
}

// Decide stamp from both caches
function updateStampFromCaches({ coinId, days }) {
    if (!stampEl) return;

    const prices = readPriceCacheEntry(coinId, 'usd', days);
    const fx = readFxCacheEntry();

    // Choose the newest timestamp available
    const tsList = [prices?.ts, fx?.ts].filter(Boolean);
    if (tsList.length === 0) {
        stampEl.textContent = 'Returns — Last updated just now';
        return;
    }
    const latestTs = Math.max(...tsList);
    const label =
        prices?.fresh && fx?.fresh ? 'cached' :
            (prices?.fresh || fx?.fresh) ? 'mixed' : 'fresh';

    stampEl.textContent = `Returns — Last updated ${timeAgo(latestTs)} (${label})`;
}

// Save simple preferences immediately on change (no API calls here)
function wirePreferenceSavers() {
    if (assetSelect) {
        assetSelect.addEventListener('change', () => {
            localStorage.setItem(LS_ASSET, assetSelect.value);
            lastAssetCode = assetSelect.value || 'btc';
        });
    }

    if (currencyEl) {
        currencyEl.addEventListener('change', () => {
            const cur = currencyEl.value;
            // persist selection
            try { localStorage.setItem(LS_CURRENCY, cur); } catch { }
            // also keep your existing helper
            saveCurrency(cur);

            // 🔁 Re-render instantly using cached data (no refetch)
            if (lastPrices && lastRates && resultsEl) {
                renderResultsCards({
                    prices: lastPrices,
                    currency: cur || 'USD',
                    rates: lastRates,
                    mount: resultsEl,
                    stampEl,
                    assetCode: lastAssetCode || 'btc',
                    investedUSD: lastInvestedUSD
                });
            }
        });
    }

    periodRadios.forEach(r => {
        r.addEventListener('change', () => {
            if (r.checked) localStorage.setItem(LS_PERIOD, r.value);
        });
    });
}

// Restore preferences into the UI
function restorePreferences() {
    const savedAsset = localStorage.getItem(LS_ASSET);
    if (assetSelect && savedAsset && [...assetSelect.options].some(o => o.value === savedAsset)) {
        assetSelect.value = savedAsset;
        lastAssetCode = savedAsset;
    }

    const savedPeriod = localStorage.getItem(LS_PERIOD);
    if (savedPeriod && PERIOD_OPTIONS[savedPeriod]) {
        const radio = [...periodRadios].find(r => r.value === savedPeriod);
        if (radio) radio.checked = true;
    }

    const savedCurrency = localStorage.getItem(LS_CURRENCY);
    if (currencyEl && savedCurrency && [...currencyEl.options].some(o => o.value === savedCurrency)) {
        currencyEl.value = savedCurrency;
    }
}

function getSelectedPeriodCode() {
    const checked = [...periodRadios].find(r => r.checked);
    return (checked && checked.value) || '30d';
}

function getSelectedDays() {
    return PERIOD_OPTIONS[getSelectedPeriodCode()] || 30;
}

function getSelectedCoinId() {
    const code = assetSelect?.value || 'BTC';
    return codeToCoinId[code] || 'bitcoin';
}

// ---------- Main "Compare" action ----------
async function runComparison() {
    // Light UI feedback (optional)
    messageEl && (messageEl.textContent = 'Calculating…');

    const days = getSelectedDays();
    currentCoinId = getSelectedCoinId();
    lastAssetCode = assetSelect?.value || 'btc';

    try {
        // 1) Fetch FX rates (cached or fresh, handled inside service)
        const rates = await getUsdRates();

        // 2) Fetch price data (cached or fresh, handled inside service)
        const data = await fetchCoinGeckoDailyPrices({
            coinId: currentCoinId,
            vsCurrency: 'usd',
            days,
            interval: 'daily'
        });

        // 3) Save state for instant re-renders on currency change
        lastRates = rates;
        lastPrices = data?.prices || null;

        // 4) Render results now with the currently selected currency
        if (resultsEl && lastPrices && lastRates) {
            const cur = (currencyEl?.value || 'USD').toUpperCase();
            renderResultsCards({
                prices: lastPrices,
                currency: cur,
                rates: lastRates,
                mount: resultsEl,
                stampEl,
                assetCode: lastAssetCode,
                investedUSD: lastInvestedUSD
            });
        }

        // 5) Update stamp based on caches
        updateStampFromCaches({ coinId: currentCoinId, days });

        messageEl && (messageEl.textContent = '');
    } catch (err) {
        console.error(err);
        messageEl && (messageEl.textContent = 'Sorry, we could not fetch data. Please try again.');
    }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
    // Build asset list & get mapper (code -> coinId)
    codeToCoinId = await populateAssetOptions(assetSelect);

    // Restore preferences (asset/period may rely on populated lists)
    restorePreferences();

    // Ensure currency list using cached-or-fresh FX rates
    try {
        const rates = await getUsdRates();
        await ensureCurrencyOptions(currencyEl, rates);
    } catch (e) {
        console.warn('[cmr] FX load failed:', e?.message || e);
    }

    // Compute initial stamp from caches (before any compare)
    updateStampFromCaches({ coinId: getSelectedCoinId(), days: getSelectedDays() });

    // Wire up preference savers (includes instant re-render on currency change)
    wirePreferenceSavers();

    // Only compute on user action to minimize API calls
    if (compareBtn) {
        compareBtn.addEventListener('click', (e) => {
            if (e && typeof e.preventDefault === 'function') e.preventDefault();
            runComparison();
        });
    }

    // Also support form submit (your form id is #compare-form)
    const form = $('#compare-form') || document.querySelector('form');
    if (form && !compareBtn) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            runComparison();
        });
    }
});
