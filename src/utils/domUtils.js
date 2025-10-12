// src/utils/domUtils.js

// Toggle mobile nav using the "show" class (matches your CSS)
export function wireNav() {
    const navButton = document.querySelector("#nav-button");
    const navBar = document.querySelector("#nav-bar");
    if (!navButton || !navBar) return;

    const toggle = () => {
        const isOpen = navBar.classList.toggle("show");
        navButton.classList.toggle("show", isOpen);
        navButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
    };

    navButton.addEventListener("click", toggle);
    navButton.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
}

function normalizePath(path) {
    if (typeof path !== "string" || !path.length) return "/";
    try {
        const url = new URL(path, window.location.origin);
        path = url.pathname;
    } catch {
        // ignore malformed URLs and treat as root
    }
    path = path.replace(/\/index\.html$/i, "/");
    if (path !== "/" && path.endsWith("/")) path = path.slice(0, -1);
    return path || "/";
}

export function markCurrentNav() {
    const navBar = document.querySelector("#nav-bar");
    if (!navBar) return;

    const items = navBar.querySelectorAll("li");
    items.forEach((item) => item.classList.remove("current"));
    navBar.querySelectorAll("[aria-current=\"page\"]").forEach((el) => el.removeAttribute("aria-current"));

    const pagePath = normalizePath(window.location.pathname);
    let bestMatch = null;

    for (const link of navBar.querySelectorAll("a[href]")) {
        const linkPath = normalizePath(link.getAttribute("href"));
        if (linkPath === pagePath) {
            bestMatch = link;
            break;
        }
        if (!bestMatch && pagePath.startsWith(linkPath) && linkPath !== "/") {
            bestMatch = link;
        }
    }

    if (bestMatch) {
        bestMatch.setAttribute("aria-current", "page");
        const li = bestMatch.closest("li");
        if (li) li.classList.add("current");
    }
}

// Stamp year, last modified, and fallback titles
export function initBranding(defaultName = "CompareMyReturns") {
    const yearEl = document.querySelector("#currentyear");
    const lastModEl = document.querySelector("#lastModified");
    const siteTitle = document.querySelector("#site-title");
    const siteOwner = document.querySelector("#site-owner");

    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    if (lastModEl) lastModEl.textContent = document.lastModified;
    if (siteTitle && !siteTitle.textContent.trim()) siteTitle.textContent = defaultName;
    if (siteOwner && !siteOwner.textContent.trim())
        siteOwner.textContent = siteTitle?.textContent?.trim() || defaultName;
}
