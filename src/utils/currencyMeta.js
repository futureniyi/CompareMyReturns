// Minimal map: currency -> primary region(s). Add more as you need.
// For multi-country unions we give a synthetic region ("EU" for EUR) or a list.
const CURRENCY_TO_REGIONS = {
    USD: ['US'],
    NGN: ['NG'],
    EUR: ['EU'],        // Eurozone (special-case name)
    GBP: ['GB'],
    JPY: ['JP'],
    CNY: ['CN'],
    INR: ['IN'],
    CAD: ['CA'],
    AUD: ['AU'],
    NZD: ['NZ'],
    ZAR: ['ZA'],
    KES: ['KE'],
    GHS: ['GH'],
    CHF: ['CH'],
    SEK: ['SE'],
    NOK: ['NO'],
    DKK: ['DK'],
    PLN: ['PL'],
    TRY: ['TR'],
    AED: ['AE'],
    SAR: ['SA'],
    EGP: ['EG'],
    MAD: ['MA'],
    XOF: ['SN', 'CI', 'BJ', 'BF', 'NE', 'TG', 'GW', 'ML'], // West African CFA franc
    XAF: ['CM', 'CF', 'CG', 'GA', 'GQ', 'TD']            // Central African CFA franc
};

// Optional locale hints help some symbols (e.g., ₦ for NGN) look right.
function likelyLocaleForCurrency(code) {
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

// Fallback symbols if Intl can’t give one (older browsers/fonts)
const SYMBOL_FALLBACK = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', NGN: '₦', KES: 'KSh', ZAR: 'R'
};

// Cache to avoid re-doing Intl work
const SYMBOL_CACHE = new Map();

export function getCurrencySymbol(code = 'USD') {
    const cur = code.toUpperCase();
    if (SYMBOL_CACHE.has(cur)) return SYMBOL_CACHE.get(cur);

    const locale = likelyLocaleForCurrency(cur);
    let symbol = null;

    // Try narrow symbol, then full symbol
    for (const display of ['narrowSymbol', 'symbol']) {
        try {
            const parts = new Intl.NumberFormat(locale, { style: 'currency', currency: cur, currencyDisplay: display })
                .formatToParts(1);
            symbol = parts.find(p => p.type === 'currency')?.value;
            if (symbol && symbol !== cur) break;
        } catch { /* try next */ }
    }
    if (!symbol || symbol === cur) symbol = SYMBOL_FALLBACK[cur] || cur;

    SYMBOL_CACHE.set(cur, symbol);
    return symbol;
}

export function getCurrencyName(code = 'USD', locale) {
    try {
        const dn = new Intl.DisplayNames([locale || navigator.language], { type: 'currency' });
        return dn.of(code) || code;
    } catch {
        return code;
    }
}

export function getRegionName(code = 'US', locale) {
    if (code === 'EU') return 'Eurozone'; // friendly label for EUR
    try {
        const dn = new Intl.DisplayNames([locale || navigator.language], { type: 'region' });
        return dn.of(code) || code;
    } catch {
        return code;
    }
}

export function flagEmojiFromRegion(region2) {
    if (!region2 || region2.length !== 2) return '';     // no emoji for EU
    const A = 0x1F1E6; // Regional Indicator Symbol Letter A
    const codePoints = [...region2.toUpperCase()].map(c => A + (c.charCodeAt(0) - 65));
    return String.fromCodePoint(...codePoints);
}

// Returns a rich meta object for UI rendering.
export function getCurrencyMeta(currencyCode, { locale } = {}) {
    const code = currencyCode?.toUpperCase() || 'USD';
    const symbol = getCurrencySymbol(code);
    const name = getCurrencyName(code, locale);

    const regions = CURRENCY_TO_REGIONS[code] || []; // could be empty for obscure codes
    const primaryRegion = regions[0] || null;
    const regionLabel = primaryRegion ? getRegionName(primaryRegion, locale) : null;
    const flag = primaryRegion && primaryRegion !== 'EU' ? flagEmojiFromRegion(primaryRegion) : '';

    return { code, symbol, name, regions, primaryRegion, regionLabel, flag };
}
