// ------------------------------
// js/main.js  (CompareMyReturns)
// ------------------------------

// ---------- Imports ----------
import { populateAssetOptions } from '../src/ui/populateAssets.js';
import { fetchCoinGeckoDailyPrices, PERIOD_OPTIONS } from '../src/services/ExternalServices.js';
import { getUsdRates, ensureCurrencyOptions, saveCurrency } from '../src/services/FxService.js';
import { renderResultsCards } from '../src/ui/resultsView.js';
import { loadPartials } from './partials.js';
import { wireNav, initBranding } from '../src/utils/domUtils.js';
import { updateStampFromCaches } from '../src/utils/cacheUtils.js';

// ---------- LocalStorage keys ----------
const LS_ASSET = 'cmr_asset';
const LS_PERIOD = 'cmr_period';
const LS_CURRENCY = 'cmr_currency';
const LS_AMOUNT = 'cmr_amount';

// ---------- Cache keys / TTLs ----------
const PRICE_CACHE_KEY = 'cmr_price_cache';
const PRICE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2h
const FX_CACHE_KEY = 'cmr_fx_usd_all_v1';
const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// ---------- DOM ----------
const $ = (sel) => document.querySelector(sel);
const assetSelect = $('#asset');
const currencyEl = $('#currency');
const amountEl = $('#amount');
const periodRadios = document.querySelectorAll('input[name="period"]');
const stampEl = $('.stamp');
const resultsEl = $('#results');
const messageEl = $('#message');

// ---------- State ----------
let codeToCoinId = {};
let currentCoinId = 'bitcoin';
let lastPrices = null;
let lastRates = null;
let lastAssetCode = 'btc';
let lastInvestedUSD = 100;

// ---------- Preferences ----------
function wirePreferenceSavers() {
    if (assetSelect) {
        assetSelect.addEventListener('change', () => {
            localStorage.setItem(LS_ASSET, assetSelect.value);
            lastAssetCode = assetSelect.value || 'btc';
        });
    }

    if (currencyEl) {
        currencyEl.addEventListener('change', () => {
            const cur = (currencyEl.value || 'USD').toUpperCase();
            try { localStorage.setItem(LS_CURRENCY, cur); } catch { }
            saveCurrency(cur);
            instantRender(); // re-render cached data
        });
    }

    if (amountEl) {
        const saved = Number(localStorage.getItem(LS_AMOUNT));
        const initial = Number.isFinite(saved) && saved > 0 ? saved : 100;
        amountEl.value = String(initial);
        lastInvestedUSD = initial;

        amountEl.addEventListener('input', () => {
            const val = Number(amountEl.value);
            lastInvestedUSD = (Number.isFinite(val) && val > 0) ? val : 0;
        });
        amountEl.addEventListener('change', () => {
            const val = Number(amountEl.value);
            const clean = (Number.isFinite(val) && val > 0) ? val : 100;
            amountEl.value = String(clean);
            lastInvestedUSD = clean;
            try { localStorage.setItem(LS_AMOUNT, String(clean)); } catch { }
            instantRender();
        });
    }

    periodRadios.forEach(r => {
        r.addEventListener('change', () => {
            if (r.checked) localStorage.setItem(LS_PERIOD, r.value);
        });
    });
}

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

// ---------- Rendering ----------
function instantRender() {
    if (!resultsEl || !lastPrices || !lastRates) return;
    const cur = (currencyEl?.value || 'USD').toUpperCase();
    resultsEl.style.display = '';
    stampEl && (stampEl.style.display = '');
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

// ---------- Main "Compare" action ----------
async function runComparison() {
    messageEl && (messageEl.textContent = 'Calculating…');

    const days = getSelectedDays();
    currentCoinId = getSelectedCoinId();
    lastAssetCode = assetSelect?.value || 'btc';

    if (amountEl) {
        const val = Number(amountEl.value);
        lastInvestedUSD = (Number.isFinite(val) && val > 0) ? val : 100;
        amountEl.value = String(lastInvestedUSD);
        try { localStorage.setItem(LS_AMOUNT, String(lastInvestedUSD)); } catch { }
    }

    try {
        const rates = await getUsdRates();
        const data = await fetchCoinGeckoDailyPrices({
            coinId: currentCoinId,
            vsCurrency: 'usd',
            days,
            interval: 'daily'
        });

        lastRates = rates;
        lastPrices = data?.prices || null;

        resultsEl.style.display = '';
        stampEl.style.display = '';
        instantRender();

        updateStampFromCaches({
            stampEl,
            priceCacheKey: PRICE_CACHE_KEY,
            priceTTL: PRICE_CACHE_TTL_MS,
            fxCacheKey: FX_CACHE_KEY,
            fxTTL: FX_TTL_MS,
            coinId: currentCoinId,
            vsCurrency: 'usd',
            days
        });

        messageEl && (messageEl.textContent = '');
    } catch (err) {
        console.error(err);
        messageEl && (messageEl.textContent = 'Sorry, we could not fetch data. Please try again.');
    }
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
    // 1) Inject header/footer
    await loadPartials();

    // 2) Wire header + branding
    wireNav();
    initBranding('CompareMyReturns');

    // 3) Hide results until user acts
    if (resultsEl) resultsEl.style.display = 'none';
    if (stampEl) stampEl.style.display = 'none';

    // 4) Build assets & mapper
    codeToCoinId = await populateAssetOptions(assetSelect);

    // 5) Restore preferences
    restorePreferences();

    // 6) Ensure currency list
    try {
        const rates = await getUsdRates();
        await ensureCurrencyOptions(currencyEl, rates);
    } catch (e) {
        console.warn('[cmr] FX load failed:', e?.message || e);
    }

    // 7) Preference savers
    wirePreferenceSavers();

    // 8) Compute only on user action
    const form = $('#compare-form') || document.querySelector('form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            runComparison();
        });
    }
});



// // ------------------------------
// // js/main.js  (CompareMyReturns)
// // ------------------------------

// // ---------- Imports ----------
// import { populateAssetOptions } from '../src/ui/populateAssets.js';
// import { fetchCoinGeckoDailyPrices, PERIOD_OPTIONS } from '../src/services/ExternalServices.js';
// import { getUsdRates, ensureCurrencyOptions, saveCurrency } from '../src/services/FxService.js';
// import { renderResultsCards } from '../src/ui/resultsView.js';
// import { loadPartials } from './partials.js';   // ✅ NEW

// // ---------- LocalStorage keys ----------
// const LS_ASSET = 'cmr_asset';
// const LS_PERIOD = 'cmr_period';
// const LS_CURRENCY = 'cmr_currency';
// const LS_AMOUNT = 'cmr_amount';

// // ---------- Cache keys ----------
// const PRICE_CACHE_KEY = 'cmr_price_cache';
// const PRICE_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2h
// const FX_CACHE_KEY = 'cmr_fx_usd_all_v1';
// const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6h

// // ---------- DOM ----------
// const $ = (sel) => document.querySelector(sel);

// const assetSelect = $('#asset');
// const currencyEl = $('#currency');
// const amountEl = $('#amount');
// const periodRadios = document.querySelectorAll('input[name="period"]');
// const stampEl = $('.stamp');
// const resultsEl = $('#results');
// const messageEl = $('#message');

// // ---------- State ----------
// let codeToCoinId = {};
// let currentCoinId = 'bitcoin';
// let lastPrices = null;
// let lastRates = null;
// let lastAssetCode = 'btc';
// let lastInvestedUSD = 100;

// // ---------- Header & Branding ----------
// function wireNav() {
//     const navButton = $('#nav-button');
//     const navBar = $('#nav-bar');
//     if (!navButton || !navBar) return;

//     const toggle = () => {
//         const isOpen = navBar.classList.toggle('show');   // ✅ match CSS
//         navButton.classList.toggle('show', isOpen);       // button icon state
//         navButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
//     };

//     navButton.addEventListener('click', toggle);
//     navButton.addEventListener('keydown', (e) => {
//         if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
//     });
// }

// function initBranding() {
//     const yearEl = $('#currentyear');
//     const lastModEl = $('#lastModified');
//     const siteTitle = $('#site-title');
//     const siteOwner = $('#site-owner');

//     if (yearEl) yearEl.textContent = String(new Date().getFullYear());
//     if (lastModEl) lastModEl.textContent = document.lastModified;
//     if (siteTitle && !siteTitle.textContent.trim()) siteTitle.textContent = 'CompareMyReturns';
//     if (siteOwner && !siteOwner.textContent.trim())
//         siteOwner.textContent = siteTitle?.textContent?.trim() || 'CompareMyReturns';
// }

// // ---------- Utils ----------
// function timeAgo(ts) {
//     const diff = Date.now() - ts;
//     if (diff < 60_000) return 'just now';
//     const mins = Math.floor(diff / 60_000);
//     if (mins < 60) return `${mins}m ago`;
//     const hrs = Math.floor(mins / 60);
//     if (hrs < 24) return `${hrs}h ago`;
//     const days = Math.floor(hrs / 24);
//     return `${days}d ago`;
// }

// function readPriceCacheEntry(coinId, vsCurrency, days) {
//     try {
//         const raw = localStorage.getItem(PRICE_CACHE_KEY);
//         if (!raw) return null;
//         const cache = JSON.parse(raw);
//         const key = `${coinId}|${vsCurrency}|${days}`;
//         const entry = cache?.[key];
//         if (!entry?.ts) return null;
//         const age = Date.now() - entry.ts;
//         const fresh = age < PRICE_CACHE_TTL_MS;
//         return { ts: entry.ts, age, fresh };
//     } catch { return null; }
// }

// function readFxCacheEntry() {
//     try {
//         const raw = localStorage.getItem(FX_CACHE_KEY);
//         if (!raw) return null;
//         const obj = JSON.parse(raw);
//         if (!obj?.ts) return null;
//         const age = Date.now() - obj.ts;
//         const fresh = age < FX_TTL_MS;
//         return { ts: obj.ts, age, fresh };
//     } catch { return null; }
// }

// function updateStampFromCaches({ coinId, days }) {
//     if (!stampEl) return;
//     const prices = readPriceCacheEntry(coinId, 'usd', days);
//     const fx = readFxCacheEntry();
//     const tsList = [prices?.ts, fx?.ts].filter(Boolean);
//     if (tsList.length === 0) {
//         stampEl.textContent = 'Returns — Last updated';
//         return;
//     }
//     const latestTs = Math.max(...tsList);
//     const label =
//         prices?.fresh && fx?.fresh ? 'cached' :
//             (prices?.fresh || fx?.fresh) ? 'mixed' : 'fresh';
//     stampEl.textContent = `Returns — Last updated ${timeAgo(latestTs)} (${label})`;
// }

// // ---------- Preference handling ----------
// function wirePreferenceSavers() {
//     if (assetSelect) {
//         assetSelect.addEventListener('change', () => {
//             localStorage.setItem(LS_ASSET, assetSelect.value);
//             lastAssetCode = assetSelect.value || 'btc';
//         });
//     }

//     if (currencyEl) {
//         currencyEl.addEventListener('change', () => {
//             const cur = (currencyEl.value || 'USD').toUpperCase();
//             try { localStorage.setItem(LS_CURRENCY, cur); } catch { }
//             saveCurrency(cur);
//             instantRender(); // re-render cached data
//         });
//     }

//     if (amountEl) {
//         const saved = Number(localStorage.getItem(LS_AMOUNT));
//         const initial = Number.isFinite(saved) && saved > 0 ? saved : 100;
//         amountEl.value = String(initial);
//         lastInvestedUSD = initial;

//         amountEl.addEventListener('input', () => {
//             const val = Number(amountEl.value);
//             lastInvestedUSD = (Number.isFinite(val) && val > 0) ? val : 0;
//         });
//         amountEl.addEventListener('change', () => {
//             const val = Number(amountEl.value);
//             const clean = (Number.isFinite(val) && val > 0) ? val : 100;
//             amountEl.value = String(clean);
//             lastInvestedUSD = clean;
//             try { localStorage.setItem(LS_AMOUNT, String(clean)); } catch { }
//             instantRender();
//         });
//     }

//     periodRadios.forEach(r => {
//         r.addEventListener('change', () => {
//             if (r.checked) localStorage.setItem(LS_PERIOD, r.value);
//         });
//     });
// }

// function restorePreferences() {
//     const savedAsset = localStorage.getItem(LS_ASSET);
//     if (assetSelect && savedAsset && [...assetSelect.options].some(o => o.value === savedAsset)) {
//         assetSelect.value = savedAsset;
//         lastAssetCode = savedAsset;
//     }

//     const savedPeriod = localStorage.getItem(LS_PERIOD);
//     if (savedPeriod && PERIOD_OPTIONS[savedPeriod]) {
//         const radio = [...periodRadios].find(r => r.value === savedPeriod);
//         if (radio) radio.checked = true;
//     }

//     const savedCurrency = localStorage.getItem(LS_CURRENCY);
//     if (currencyEl && savedCurrency && [...currencyEl.options].some(o => o.value === savedCurrency)) {
//         currencyEl.value = savedCurrency;
//     }
// }

// function getSelectedPeriodCode() {
//     const checked = [...periodRadios].find(r => r.checked);
//     return (checked && checked.value) || '30d';
// }
// function getSelectedDays() {
//     return PERIOD_OPTIONS[getSelectedPeriodCode()] || 30;
// }
// function getSelectedCoinId() {
//     const code = assetSelect?.value || 'BTC';
//     return codeToCoinId[code] || 'bitcoin';
// }

// // ---------- Rendering ----------
// function instantRender() {
//     if (!resultsEl || !lastPrices || !lastRates) return;
//     const cur = (currencyEl?.value || 'USD').toUpperCase();
//     resultsEl.style.display = '';
//     stampEl && (stampEl.style.display = '');
//     renderResultsCards({
//         prices: lastPrices,
//         currency: cur,
//         rates: lastRates,
//         mount: resultsEl,
//         stampEl,
//         assetCode: lastAssetCode,
//         investedUSD: lastInvestedUSD
//     });
// }

// // ---------- Main "Compare" action ----------
// async function runComparison() {
//     messageEl && (messageEl.textContent = 'Calculating…');
//     const days = getSelectedDays();
//     currentCoinId = getSelectedCoinId();
//     lastAssetCode = assetSelect?.value || 'btc';

//     if (amountEl) {
//         const val = Number(amountEl.value);
//         lastInvestedUSD = (Number.isFinite(val) && val > 0) ? val : 100;
//         amountEl.value = String(lastInvestedUSD);
//         try { localStorage.setItem(LS_AMOUNT, String(lastInvestedUSD)); } catch { }
//     }

//     try {
//         const rates = await getUsdRates();
//         const data = await fetchCoinGeckoDailyPrices({
//             coinId: currentCoinId,
//             vsCurrency: 'usd',
//             days,
//             interval: 'daily'
//         });

//         lastRates = rates;
//         lastPrices = data?.prices || null;

//         resultsEl.style.display = '';
//         stampEl.style.display = '';
//         instantRender();
//         updateStampFromCaches({ coinId: currentCoinId, days });
//         messageEl && (messageEl.textContent = '');
//     } catch (err) {
//         console.error(err);
//         messageEl && (messageEl.textContent = 'Sorry, we could not fetch data. Please try again.');
//     }
// }

// // ---------- Init ----------
// document.addEventListener('DOMContentLoaded', async () => {
//     // 1️⃣ Inject header/footer first
//     await loadPartials();

//     // 2️⃣ Wire header + footer
//     wireNav();
//     initBranding();

//     // 3️⃣ Hide results until user acts
//     if (resultsEl) resultsEl.style.display = 'none';
//     if (stampEl) stampEl.style.display = 'none';

//     // 4️⃣ Build assets & mapper
//     codeToCoinId = await populateAssetOptions(assetSelect);

//     // 5️⃣ Restore preferences
//     restorePreferences();

//     // 6️⃣ Ensure currency list
//     try {
//         const rates = await getUsdRates();
//         await ensureCurrencyOptions(currencyEl, rates);
//     } catch (e) {
//         console.warn('[cmr] FX load failed:', e?.message || e);
//     }

//     // 7️⃣ Preference savers
//     wirePreferenceSavers();

//     // 8️⃣ Compare only on user action
//     const form = $('#compare-form') || document.querySelector('form');
//     if (form) {
//         form.addEventListener('submit', (e) => {
//             e.preventDefault();
//             runComparison();
//         });
//     }
// });
