// ------------------------------
// js/main.js  (CompareMyReturns)
// ------------------------------

// ---------- Imports ----------
import { populateAssetOptions } from '../src/ui/populateAssets.js';
import { fetchCoinGeckoDailyPrices, PERIOD_OPTIONS } from '../src/services/ExternalServices.js';
import {
    getUsdRates,
    ensureCurrencyOptions,
    saveCurrency,
    toUSD,
    fromUSD,
    toDisplay, // used by resultsView
} from '../src/services/FxService.js';
import { renderResultsCards } from '../src/ui/resultsView.js';
import { loadPartials } from './partials.js';
import { wireNav, initBranding } from '../src/utils/domUtils.js';
import { updateStampFromCaches } from '../src/utils/cacheUtils.js';

// ---------- LocalStorage keys ----------
const LS_ASSET = 'cmr_asset';
const LS_PERIOD = 'cmr_period';
const LS_CURRENCY = 'cmr_currency';
const LS_AMOUNT_LOCAL = 'cmr_amount_local'; // amount typed by user in selected currency
const LS_AMOUNT_LEGACY = 'cmr_amount';       // legacy: USD amount (read-only migration)

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
const amountUnitEl = $('#amount-unit');
const periodRadios = document.querySelectorAll('input[name="period"]');
const stampEl = $('.stamp');
const resultsEl = $('#results');
const messageEl = $('#message');
const summaryEl = $('#summary');


// ---------- State ----------
let codeToCoinId = {};
let currentCoinId = 'bitcoin';
let lastPrices = null;
let lastRates = null;

// Amount model:
// - amountLocal: number shown in the input (in current currency)
// - investedUSD: canonical USD amount used for all calculations
let amountLocal = 1;
let investedUSD = 1;

// Also track the selected asset code for rendering labels/descriptions
let lastAssetCode = 'btc';

// ---------- Preferences ----------
function restorePreferences() {
    // Asset
    const savedAsset = localStorage.getItem(LS_ASSET);
    if (assetSelect && savedAsset && [...assetSelect.options].some(o => o.value === savedAsset)) {
        assetSelect.value = savedAsset;
        lastAssetCode = savedAsset;
    }

    // Period
    const savedPeriod = localStorage.getItem(LS_PERIOD);
    if (savedPeriod && PERIOD_OPTIONS[savedPeriod]) {
        const radio = [...periodRadios].find(r => r.value === savedPeriod);
        if (radio) radio.checked = true;
    }

    // Currency (default USD)
    const savedCurrency = (localStorage.getItem(LS_CURRENCY) || 'USD').toUpperCase();
    if (currencyEl && [...currencyEl.options].some(o => o.value === savedCurrency)) {
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
    const code = (assetSelect?.value || 'btc').toLowerCase();
    return (typeof codeToCoinId === 'function')
        ? codeToCoinId(code)                // ✅ call the mapper function
        : (codeToCoinId?.[code] || 'bitcoin');
}


// ---------- Amount & unit handling ----------
function updateAmountUnit() {
    if (!amountUnitEl || !currencyEl) return;
    const cur = (currencyEl.value || 'USD').toUpperCase();
    amountUnitEl.textContent = cur;
}

// Converts canonical USD -> local and paints input.
// Used ONLY during legacy migration (one-time repaint).
function refreshAmountUiFromUSD() {
    if (!amountEl || !currencyEl || !lastRates) return;
    const cur = (currencyEl.value || 'USD').toUpperCase();
    const local = fromUSD(investedUSD, cur, lastRates);
    amountLocal = Math.max(1, Math.round(local * 100) / 100); // 2dp
    amountEl.value = String(amountLocal);
}

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
            saveCurrency(cur);
            localStorage.setItem(LS_CURRENCY, cur);

            // Update only the unit label. Do NOT repaint the input.
            updateAmountUnit();

            // Keep user's number as-is; just recompute investedUSD from that number.
            if (amountEl) {
                const val = Number(amountEl.value);
                amountLocal = Math.max(1, Math.round((Number.isFinite(val) ? val : 1) * 100) / 100);
                amountEl.value = String(amountLocal);
                investedUSD = toUSD(amountLocal, cur, lastRates || {});
                try { localStorage.setItem(LS_AMOUNT_LOCAL, String(amountLocal)); } catch { }
            }

            // Update cards in the new currency
            instantRender();
        });
    }

    if (amountEl) {
        amountEl.addEventListener('input', () => {
            const cur = (currencyEl.value || 'USD').toUpperCase();
            const val = Number(amountEl.value);
            amountLocal = Number.isFinite(val) && val > 0 ? val : 0;
            investedUSD = toUSD(amountLocal, cur, lastRates || {});
        });

        amountEl.addEventListener('change', () => {
            const cur = (currencyEl.value || 'USD').toUpperCase();
            const val = Number(amountEl.value);
            amountLocal = Math.max(1, Math.round((Number.isFinite(val) ? val : 1) * 100) / 100);
            amountEl.value = String(amountLocal);
            investedUSD = toUSD(amountLocal, cur, lastRates || {});
            try { localStorage.setItem(LS_AMOUNT_LOCAL, String(amountLocal)); } catch { }
            instantRender();
        });
    }

    periodRadios.forEach(r => {
        r.addEventListener('change', () => {
            if (r.checked) localStorage.setItem(LS_PERIOD, r.value);
        });
    });
}

// Initialize amount from storage & rates with the new model:
// - Prefer saved local amount (cmr_amount_local) if present.
// - Else, migrate legacy USD (cmr_amount) and repaint local from USD ONCE.
// - Else, default to 1 in current currency, and derive USD from rates.
function initAmountFromStorage() {
    const cur = (currencyEl?.value || 'USD').toUpperCase();

    // 1) Preferred: saved local amount
    const savedLocal = Number(localStorage.getItem(LS_AMOUNT_LOCAL));
    if (Number.isFinite(savedLocal) && savedLocal > 0) {
        amountLocal = savedLocal;
        investedUSD = toUSD(amountLocal, cur, lastRates || {});
        amountEl && (amountEl.value = String(amountLocal));
        return;
    }

    // 2) Migration path: legacy saved USD (one-time repaint to local)
    const legacyUsd = Number(localStorage.getItem(LS_AMOUNT_LEGACY));
    if (Number.isFinite(legacyUsd) && legacyUsd > 0) {
        investedUSD = legacyUsd;
        refreshAmountUiFromUSD(); // migration only
        return;
    }

    // 3) Default: 1 in current currency (no repaint from USD)
    amountLocal = 1;
    amountEl && (amountEl.value = '1');
    investedUSD = toUSD(amountLocal, cur, lastRates || {});
}

// ---------- Rendering ----------
function instantRender() {
    if (!resultsEl || !lastPrices || !lastRates) return;
    const cur = (currencyEl?.value || 'USD').toUpperCase();
    resultsEl.style.display = '';
    if (stampEl) stampEl.style.display = '';
    renderResultsCards({
        prices: lastPrices,
        currency: cur,
        rates: lastRates,
        mount: resultsEl,
        stampEl,
        summaryEl,
        assetCode: lastAssetCode,
        investedUSD,
        periodDays: getSelectedDays()
    });
}

// ---------- Main "Compare" action ----------
async function runComparison() {
    if (messageEl) messageEl.textContent = 'Calculating…';

    const days = getSelectedDays();
    currentCoinId = getSelectedCoinId();
    lastAssetCode = assetSelect?.value || 'btc';

    // Sync investedUSD with current visible local amount
    if (amountEl) {
        const cur = (currencyEl.value || 'USD').toUpperCase();
        const val = Number(amountEl.value);
        amountLocal = Number.isFinite(val) && val > 0 ? val : 1;
        amountEl.value = String(amountLocal);
        investedUSD = toUSD(amountLocal, cur, lastRates || {});
        try { localStorage.setItem(LS_AMOUNT_LOCAL, String(amountLocal)); } catch { }
    }

    try {
        // Keep FX in state
        const rates = await getUsdRates();
        lastRates = rates;

        // Fetch price series in canonical USD
        const data = await fetchCoinGeckoDailyPrices({
            coinId: currentCoinId,
            vsCurrency: 'usd',
            days,
            interval: 'daily'
        });

        lastPrices = data?.prices || null;

        if (resultsEl) resultsEl.style.display = '';
        if (stampEl) stampEl.style.display = '';
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

        if (messageEl) messageEl.textContent = '';
    } catch (err) {
        console.error(err);
        if (messageEl) messageEl.textContent = 'Sorry, we could not fetch data. Please try again.';
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

    // 4) Build asset options & mapper
    codeToCoinId = await populateAssetOptions(assetSelect);

    // 5) Restore currency/period/asset BEFORE ensuring currency options
    restorePreferences();

    // 6) Load FX and populate currency options; keep rates in state
    try {
        const rates = await getUsdRates();
        lastRates = rates;
        await ensureCurrencyOptions(currencyEl, rates);
    } catch (e) {
        console.warn('[cmr] FX load failed:', e?.message || e);
    }

    // 7) Update amount unit now that currency options exist
    updateAmountUnit();

    // 8) Initialize amount model from storage (no USD repaint unless legacy)
    initAmountFromStorage();

    // 9) Preference savers (asset, currency, amount, period)
    wirePreferenceSavers();

    // 10) Compute only on user action
    const form = $('#compare-form') || document.querySelector('form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            runComparison();
        });
    }
});
