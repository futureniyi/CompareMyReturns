// src/services/FxService.js

// ==============================
// FX source & caching
// ==============================
const FX_API = 'https://open.er-api.com/v6/latest/USD';
const FX_CACHE_KEY = 'cmr_fx_usd_all_v1';
const FX_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function now() { return Date.now(); }

function readFxCacheEntry() {
    try {
        const raw = localStorage.getItem(FX_CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj?.rates || !obj?.ts) return null;
        const age = now() - obj.ts;
        return { rates: obj.rates, ts: obj.ts, age, fresh: age < FX_TTL_MS };
    } catch {
        return null;
    }
}

function writeFxCache(rates) {
    try {
        localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rates, ts: now() }));
    } catch { }
}

async function backgroundRefresh() {
    try {
        const res = await fetch(FX_API, { cache: 'no-store' });
        if (!res.ok) throw new Error(`FX ${res.status}`);
        const json = await res.json();
        const rates = json?.rates || {};
        if (Object.keys(rates).length) writeFxCache(rates);
    } catch { }
}

/** Get USD→all rates with caching */
export async function getUsdRates() {
    const entry = readFxCacheEntry();
    if (entry?.fresh) return entry.rates;
    if (entry) {
        backgroundRefresh();
        return entry.rates;
    }
    const res = await fetch(FX_API, { cache: 'no-store' });
    if (!res.ok) throw new Error(`FX ${res.status}`);
    const json = await res.json();
    const rates = json?.rates || {};
    if (!Object.keys(rates).length) throw new Error('No FX rates');
    writeFxCache(rates);
    return rates;
}

export function clearFxCache() {
    localStorage.removeItem(FX_CACHE_KEY);
}

// ==============================
/* Currency formatting & symbols */
// ==============================
function numberFormatterFor(code) {
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
        return `${code} ${(Number(amount) || 0).toFixed(2)}`;
    }
}

function likelyLocaleFor(code) {
    switch (code) {
        case 'USD': return 'en-US';
        case 'EUR': return 'de-DE';
        case 'GBP': return 'en-GB';
        case 'JPY': return 'ja-JP';
        case 'CNY': return 'zh-CN';
        case 'INR': return 'en-IN';
        case 'NGN': return 'en-NG';
        case 'KES': return 'sw-KE';
        case 'ZAR': return 'en-ZA';
        default: return undefined;
    }
}

const SYMBOL_FALLBACK = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', NGN: '₦', KES: 'KSh', ZAR: 'R'
};

const SYMBOL_CACHE = new Map();

/** Robust currency symbol via Intl (+ fallbacks + cache) */
export function getCurrencySymbol(code = 'USD') {
    const cur = (code || 'USD').toUpperCase();
    if (SYMBOL_CACHE.has(cur)) return SYMBOL_CACHE.get(cur);

    const locale = likelyLocaleFor(cur);
    let sym = null;
    for (const display of ['narrowSymbol', 'symbol']) {
        try {
            const parts = new Intl.NumberFormat(locale, {
                style: 'currency',
                currency: cur,
                currencyDisplay: display
            }).formatToParts(1);
            sym = parts.find(p => p.type === 'currency')?.value;
            if (sym && sym !== cur) break;
        } catch { }
    }
    if (!sym || sym === cur) sym = SYMBOL_FALLBACK[cur] || cur;

    SYMBOL_CACHE.set(cur, sym);
    return sym;
}

// ==============================
// Country/region helpers
// ==============================

// Union / multi-country currency names (NO single-country flag)
const UNION_CURRENCY_NAMES = {
    XAF: 'Central African CFA franc', // CEMAC
    XOF: 'West African CFA franc',    // UEMOA
    XCD: 'East Caribbean dollar',
    XPF: 'CFP franc'
};

// Primary region(s) per currency. For unions we normally choose a representative,
// BUT per requirement we must NOT do that for XAF/XOF/XCD/XPF (use union name, no flag).
const CURRENCY_TO_REGION = {
    USD: ['US'], NGN: ['NG'], EUR: ['EU'], GBP: ['GB'], JPY: ['JP'], CNY: ['CN'], INR: ['IN'],
    CAD: ['CA'], AUD: ['AU'], NZD: ['NZ'], ZAR: ['ZA'], KES: ['KE'], GHS: ['GH'], BRL: ['BR'],
    MXN: ['MX'], CHF: ['CH'], SEK: ['SE'], NOK: ['NO'], DKK: ['DK'], PLN: ['PL'], TRY: ['TR'],
    AED: ['AE'], SAR: ['SA'], EGP: ['EG'], MAD: ['MA'],
    AFN: ['AF'], ALL: ['AL'], AMD: ['AM'], ANG: ['CW'], AOA: ['AO'], ARS: ['AR'], AWG: ['AW'], AZN: ['AZ'],
    BAM: ['BA'], BBD: ['BB'], BDT: ['BD'], BGN: ['BG'], BHD: ['BH'], BIF: ['BI'], BMD: ['BM'], BND: ['BN'],
    BOB: ['BO'], BSD: ['BS'], BTN: ['BT'], BWP: ['BW'], BYN: ['BY'], BZD: ['BZ'], CDF: ['CD'], CLP: ['CL'],
    COP: ['CO'], CRC: ['CR'], CUP: ['CU'], CVE: ['CV'], CZK: ['CZ'], DJF: ['DJ'], DOP: ['DO'],
    DZD: ['DZ'], ETB: ['ET'], FJD: ['FJ'], GMD: ['GM'], GNF: ['GN'], GTQ: ['GT'], HKD: ['HK'], HNL: ['HN'],
    HRK: ['HR'], HTG: ['HT'], HUF: ['HU'], IDR: ['ID'], ILS: ['IL'], ISK: ['IS'], JMD: ['JM'], JOD: ['JO'],
    KHR: ['KH'], KGS: ['KG'], KMF: ['KM'], KRW: ['KR'], KWD: ['KW'], KYD: ['KY'], KZT: ['KZ'], LAK: ['LA'],
    LBP: ['LB'], LKR: ['LK'], LRD: ['LR'], LSL: ['LS'], MDL: ['MD'], MGA: ['MG'], MKD: ['MK'], MMK: ['MM'],
    MNT: ['MN'], MOP: ['MO'], MUR: ['MU'], MVR: ['MV'], MWK: ['MW'], MYR: ['MY'], MZN: ['MZ'], NAD: ['NA'],
    NIO: ['NI'], NPR: ['NP'], OMR: ['OM'], PAB: ['PA'], PEN: ['PE'], PGK: ['PG'], PHP: ['PH'], PKR: ['PK'],
    PYG: ['PY'], QAR: ['QA'], RON: ['RO'], RSD: ['RS'], RUB: ['RU'], RWF: ['RW'], SBD: ['SB'], SCR: ['SC'],
    SDG: ['SD'], SGD: ['SG'], SLL: ['SL'], SOS: ['SO'], SRD: ['SR'], STN: ['ST'], SVC: ['SV'], SYP: ['SY'],
    SZL: ['SZ'], THB: ['TH'], TJS: ['TJ'], TMT: ['TM'], TND: ['TN'], TOP: ['TO'], TTD: ['TT'], TWD: ['TW'],
    TZS: ['TZ'], UAH: ['UA'], UGX: ['UG'], UYU: ['UY'], UZS: ['UZ'], VES: ['VE'], VND: ['VN'], VUV: ['VU'],
    WST: ['WS'], /* XAF handled as union */ /* XOF handled as union */
    XAF: [], XOF: [], XPF: [], XCD: [], // ← override: union label, no flag
    YER: ['YE'], ZMW: ['ZM'], ZWL: ['ZW']
};

// Extra mappings for special/territory/union/non-flag cases
Object.assign(CURRENCY_TO_REGION, {
    // Crown dependencies & territories
    GGP: ['GG'], // Guernsey
    JEP: ['JE'], // Jersey
    IMP: ['IM'], // Isle of Man
    FOK: ['FO'], // Faroe Islands
    KID: ['KI'], // Kiribati (planned code)
    TVD: ['TV'], // Tuvalu Dollar (uses AUD)
    SHP: ['SH'], // St. Helena Pound
    SLE: ['SL'], // Sierra Leone (new leone)

    // Non-flag entities (no region → no flag)
    XDR: [], // IMF SDR
    XAG: [], // Silver
    XAU: [], // Gold
    XPT: [], // Platinum
    XPD: []  // Palladium
});

function regionName(regionCode, locale) {
    if (regionCode === 'EU') return 'Eurozone';
    try {
        const dn = new Intl.DisplayNames([locale || navigator.language], { type: 'region' });
        return dn.of(regionCode) || regionCode;
    } catch { return regionCode; }
}

function flagEmojiFromRegion(region2) {
    if (!region2 || region2.length !== 2) return '';
    const A = 0x1F1E6;
    const codePoints = [...region2.toUpperCase()].map(c => A + (c.charCodeAt(0) - 65));
    return String.fromCodePoint(...codePoints);
}

/** Friendly label for dropdown:
 *  - "🇳🇬 Nigeria (NGN)" for single-country currencies
 *  - "Central African CFA franc (XAF)" / "West African CFA franc (XOF)" (no flag)
 *  - "Eurozone (EUR)" (special EU label)
 */
export function getCurrencyDisplayLabel(code, locale) {
    const cur = (code || 'USD').toUpperCase();

    // 0) Union/multi-country currencies we must not map to a single country
    if (UNION_CURRENCY_NAMES[cur]) {
        return `${UNION_CURRENCY_NAMES[cur]} (${cur})`;
    }

    // 1) Region-backed → flag + country name
    const regions = CURRENCY_TO_REGION[cur];
    if (regions) {
        if (regions.length > 0) {
            const primary = regions[0];
            const flag = flagEmojiFromRegion(primary);
            const name = regionName(primary, locale);
            return `${flag ? flag + ' ' : ''}${name} (${cur})`;
        }
        // regions exists but empty array (non-flag or special union) → fall through to currency name
    }

    // 2) Currency localized name via Intl.DisplayNames
    try {
        const dn = new Intl.DisplayNames([locale || navigator.language], { type: 'currency' });
        const currencyName = dn.of(cur);
        if (currencyName && currencyName !== cur) {
            return `${currencyName.charAt(0).toUpperCase() + currencyName.slice(1)} (${cur})`;
        }
    } catch { }

    // 3) Last resort: descriptive names for special "X" codes
    if (cur.startsWith('X')) {
        const special = {
            XDR: 'IMF Special Drawing Rights',
            XAG: 'Silver',
            XAU: 'Gold',
            XPT: 'Platinum',
            XPD: 'Palladium'
        };
        if (special[cur]) return `${special[cur]} (${cur})`;
    }

    return cur;
}

// ==============================
// Dropdown builder
// ==============================
/** Populate <select> with labels like "🇳🇬 Nigeria (NGN)" or "Central African CFA franc (XAF)" */
export async function ensureCurrencyOptions(selectEl, rates) {
    if (!selectEl) return;

    const current = (selectEl.value || localStorage.getItem('cmr_currency') || 'USD').toUpperCase();

    const codes = Object.keys(rates || {}).filter(Boolean);
    if (!codes.includes('USD')) codes.push('USD');

    codes.sort((a, b) => {
        if (a === 'USD') return -1;
        if (b === 'USD') return 1;
        return a.localeCompare(b);
    });

    const frag = document.createDocumentFragment();
    for (const code of codes) {
        const opt = document.createElement('option');
        const label = getCurrencyDisplayLabel(code);
        const sym = getCurrencySymbol(code);
        opt.value = code;
        opt.textContent = label;
        opt.dataset.symbol = sym;     // used for amount prefix if desired
        opt.setAttribute('aria-label', label);
        opt.title = code;
        frag.appendChild(opt);
    }

    selectEl.innerHTML = '';
    selectEl.appendChild(frag);
    selectEl.value = codes.includes(current) ? current : 'USD';
}

export function saveCurrency(cur) {
    try { localStorage.setItem('cmr_currency', (cur || 'USD').toUpperCase()); } catch { }
}

// ==============================
// Conversions
// ==============================
/** USD → Local (using USD→CUR) */
export function fromUSD(amountUSD, currency, rates) {
    const cur = (currency || 'USD').toUpperCase();
    if (cur === 'USD') return Number(amountUSD || 0);
    const rate = Number(rates?.[cur]);
    return Number(amountUSD || 0) * (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

/** Local → USD (USD = local / (USD→CUR)) */
export function toUSD(amountLocal, currency, rates) {
    const cur = (currency || 'USD').toUpperCase();
    if (cur === 'USD') return Number(amountLocal || 0);
    const rate = Number(rates?.[cur]);
    return Number(amountLocal || 0) / (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

/** Format a USD amount for display in selected currency */
export function toDisplay(amountUSD, currency, rates) {
    const cur = (currency || 'USD').toUpperCase();
    if (cur === 'USD') return fmtCurrency(amountUSD, 'USD');
    const value = fromUSD(amountUSD, cur, rates);
    return fmtCurrency(value, cur);
}
