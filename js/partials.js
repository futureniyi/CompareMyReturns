// js/partials.js
async function inject(selector, url) {
    const host = document.querySelector(selector);
    if (!host) return;
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${url}`);
    host.innerHTML = await res.text();
}

export async function loadPartials() {
    // use relative paths so this works from any route (vite dev & build)
    await Promise.all([
        inject("#header-slot", "partials/header.html"),
        inject("#footer-slot", "partials/footer.html"),
    ]);
    document.dispatchEvent(new CustomEvent("partials:ready"));
}
