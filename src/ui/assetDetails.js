// src/ui/assetDetails.js
const numberFormatter = new Intl.NumberFormat('en-US');

function formatMaxSupply(value, supplyType) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return numberFormatter.format(value);
    }
    if (typeof supplyType === 'string' && supplyType.toLowerCase() === 'capped') {
        return 'Fixed Cap';
    }
    return 'Unlimited';
}

function appendMetaRow(dl, term, detail) {
    if (detail === undefined || detail === null || detail === '') return;
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = detail;
    dl.append(dt, dd);
}

function buildLinks(asset) {
    const links = [];
    if (asset.website) {
        const website = document.createElement('a');
        website.href = asset.website;
        website.target = '_blank';
        website.rel = 'noopener noreferrer';
        website.textContent = 'Website';
        links.push(website);
    }

    if (asset.explorer) {
        const explorer = document.createElement('a');
        explorer.href = asset.explorer;
        explorer.target = '_blank';
        explorer.rel = 'noopener noreferrer';
        explorer.textContent = 'Explorer';
        links.push(explorer);
    }
    return links;
}

function createCard(asset) {
    const card = document.createElement('article');
    card.className = 'asset-card';
    card.dataset.assetCode = asset.code || '';

    const header = document.createElement('header');
    header.className = 'asset-card__header';
    if (asset.logo) {
        const img = document.createElement('img');
        img.className = 'asset-card__logo';
        img.src = asset.logo;
        img.alt = `${asset.name || asset.code} logo`;
        img.loading = 'lazy';
        header.appendChild(img);
    }

    const titleWrap = document.createElement('div');
    titleWrap.className = 'asset-card__title';

    const title = document.createElement('h3');
    title.className = 'asset-card__name';
    title.textContent = asset.name || asset.id || (asset.code || '').toUpperCase();

    const subtitle = document.createElement('p');
    subtitle.className = 'asset-card__meta';
    const symbol = asset.symbol ? asset.symbol.toUpperCase() : '';
    const parts = [];
    if (symbol) parts.push(symbol);
    if (asset.category) parts.push(asset.category);
    subtitle.textContent = parts.join(' • ');

    titleWrap.append(title);
    if (subtitle.textContent) {
        titleWrap.append(subtitle);
    }

    header.append(titleWrap);
    card.append(header);

    if (asset.description) {
        const desc = document.createElement('p');
        desc.className = 'asset-card__description';
        desc.textContent = asset.description;
        card.append(desc);
    }

    const dl = document.createElement('dl');
    dl.className = 'asset-card__details';
    appendMetaRow(dl, 'Launch Year', asset.launchYear);
    appendMetaRow(dl, 'Consensus', asset.consensus);
    appendMetaRow(dl, 'Supply Type', asset.supplyType);
    appendMetaRow(dl, 'Max Supply', formatMaxSupply(asset.maxSupply, asset.supplyType));
    if (asset.category) appendMetaRow(dl, 'Category', asset.category);
    if (asset.code) appendMetaRow(dl, 'Code', asset.code.toUpperCase());
    if (asset.id) appendMetaRow(dl, 'CoinGecko ID', asset.id);
    card.append(dl);

    const links = buildLinks(asset);
    if (links.length) {
        const linkBar = document.createElement('div');
        linkBar.className = 'asset-card__links';
        for (const link of links) {
            linkBar.append(link);
        }
        card.append(linkBar);
    }

    return card;
}

export function renderAssetDetails({ mount, assets = [] } = {}) {
    if (!mount) return;

    mount.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'asset-grid';

    if (!Array.isArray(assets) || assets.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'asset-grid__empty';
        empty.textContent = 'Asset details are not available right now.';
        grid.append(empty);
        mount.append(grid);
        return;
    }

    const sorted = [...assets].sort((a, b) => {
        const nameA = (a.name || a.id || '').toLowerCase();
        const nameB = (b.name || b.id || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });

    for (const asset of sorted) {
        grid.append(createCard(asset));
    }

    mount.append(grid);
}
