// src/ui/populateAssets.js
export async function populateAssetOptions(selectEl, savedCode = "btc") {
    const makeFallback = () => ({
        assets: [
            { code: "btc", id: "bitcoin", name: "Bitcoin" },
            { code: "eth", id: "ethereum", name: "Ethereum" },
            { code: "sol", id: "solana", name: "Solana" },
            { code: "ada", id: "cardano", name: "Cardano" },
        ],
        getId: (code = "btc") => ({
            btc: "bitcoin", eth: "ethereum", ada: "cardano", sol: "solana"
        }[code?.toLowerCase()] || "bitcoin")
    });

    try {
        const res = await fetch("data/assets.json"); // note: no leading slash
        if (!res.ok) throw new Error("assets.json not found");
        const data = await res.json();
        const assets = Array.isArray(data.assets) ? data.assets : [];

        if (selectEl) {
            selectEl.innerHTML = "";
            for (const { code, name } of assets) {
                const opt = document.createElement("option");
                opt.value = code;
                opt.textContent = name;
                selectEl.appendChild(opt);
            }

            // Use savedCode if it exists in the list; otherwise default to btc
            const codes = new Set(assets.map(a => a.code));
            selectEl.value = codes.has((savedCode || "").toLowerCase()) ? savedCode : "btc";
        }

        const idByCode = Object.fromEntries(assets.map(a => [a.code, a.id]));
        return {
            assets,
            getId: (code = "btc") => idByCode[code.toLowerCase()] || "bitcoin"
        };
    } catch (err) {
        console.error("Error loading local assets.json:", err);
        return makeFallback();
    }
}
