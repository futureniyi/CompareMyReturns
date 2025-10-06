// Populate the <select id="asset"> dropdown from /data/assets.json
export async function populateAssetOptions(selectEl) {
    if (!selectEl) return (code) => 'bitcoin';

    try {
        const res = await fetch('/data/assets.json');
        if (!res.ok) throw new Error('assets.json not found');
        const data = await res.json();

        selectEl.innerHTML = '';
        for (const { code, name } of data.assets) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = name;
            selectEl.appendChild(opt);
        }

        // Default to Bitcoin
        selectEl.value = 'btc';

        // Build a helper map for code → CoinGecko ID
        const idByCode = Object.fromEntries(data.assets.map(a => [a.code, a.id]));
        return (code = 'btc') => idByCode[code.toLowerCase()] || 'bitcoin';
    } catch (err) {
        console.error('Error loading local assets.json:', err);

        // Simple inline fallback if fetch fails
        return (code) => ({
            btc: 'bitcoin',
            eth: 'ethereum',
            ada: 'cardano',
            sol: 'solana'
        }[code?.toLowerCase()] || 'bitcoin');
    }
}
