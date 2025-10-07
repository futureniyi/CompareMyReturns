// src/ui/populateAssets.js
export async function populateAssetOptions(selectEl, savedCode = 'btc') {
    if (!selectEl) return (code) => 'bitcoin';

    try {
        const res = await fetch('data/assets.json'); // note: no leading slash
        if (!res.ok) throw new Error('assets.json not found');
        const data = await res.json();

        selectEl.innerHTML = '';
        for (const { code, name } of data.assets) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = name;
            selectEl.appendChild(opt);
        }

        // Use savedCode if it exists in the list; otherwise default to btc
        const codes = new Set(data.assets.map(a => a.code));
        selectEl.value = codes.has((savedCode || '').toLowerCase()) ? savedCode : 'btc';

        const idByCode = Object.fromEntries(data.assets.map(a => [a.code, a.id]));
        return (code = 'btc') => idByCode[code.toLowerCase()] || 'bitcoin';
    } catch (err) {
        console.error('Error loading local assets.json:', err);
        return (code) => ({
            btc: 'bitcoin', eth: 'ethereum', ada: 'cardano', sol: 'solana'
        }[code?.toLowerCase()] || 'bitcoin');
    }
}
