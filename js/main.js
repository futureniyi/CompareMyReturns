import { populateAssetOptions } from '../src/ui/populateAssets.js';
import { fetchCoinGeckoDailyPrices } from '../src/services/ExternalServices.js';

console.log('CompareMyReturns app loaded!');

// Step 1: populate the asset dropdown dynamically
const assetSelect = document.querySelector('#asset');
const mapCodeToId = await populateAssetOptions(assetSelect);

// Step 2: Fetch daily prices for the selected asset
(async () => {
    try {
        const code = assetSelect?.value || 'btc';
        const coinId = mapCodeToId(code);

        console.log(`Fetching 30-day prices for ${coinId}...`);
        const data = await fetchCoinGeckoDailyPrices({
            coinId,
            vsCurrency: 'usd',
            days: 30,
            interval: 'daily'
        });

        console.log('[CoinGecko] Data:', data);
        console.assert(Array.isArray(data.prices), 'Expected prices array in data');
    } catch (err) {
        console.error('CoinGecko fetch failed:', err);
    }
})();


// ---------- Small DOM helper ----------
const $ = (sel) => document.querySelector(sel);

// ---------- Elements ----------
// const form = $('#compare-form');
// const assetEl = $('#asset');
// const currencyEl = $('#currency');
// const resultsEl = $('#results');
// const messageEl = $('#message');     // summary + returns go here
// const statusEl = $('#status');      // optional status text
// const fetchBtn = $('#fetchBtn');    // optional manual refresh button

// Header / Nav
const navButton = $('#nav-button');
const navBar = $('#nav-bar');
const titleEl = $('#site-title');
const ownerEl = $('#site-owner');
const currentyear = $('#currentyear');
const lastModified = $('#lastModified');

// ---------- App constants ----------
const SITE_NAME = 'CompareMyReturns';

console.log('CompareMyReturns app loaded!');

// ---------- Header / Footer wiring ----------
if (navButton && navBar) {
    navButton.addEventListener('click', () => {
        navButton.classList.toggle('show');
        navBar.classList.toggle('show');
    });
}
if (titleEl) titleEl.textContent = SITE_NAME;
if (ownerEl) ownerEl.textContent = SITE_NAME;
if (currentyear) currentyear.innerHTML = `<span class="highlight">${new Date().getFullYear()}</span>`;
if (lastModified) lastModified.textContent = `Last Modification: ${document.lastModified}`;

