// src/utils/domUtils.js

// Toggle mobile nav using the "show" class (matches your CSS)
export function wireNav() {
    const navButton = document.querySelector('#nav-button');
    const navBar = document.querySelector('#nav-bar');
    if (!navButton || !navBar) return;

    const toggle = () => {
        const isOpen = navBar.classList.toggle('show');
        navButton.classList.toggle('show', isOpen);
        navButton.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    navButton.addEventListener('click', toggle);
    navButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
}

// Stamp year, last modified, and fallback titles
export function initBranding(defaultName = 'CompareMyReturns') {
    const yearEl = document.querySelector('#currentyear');
    const lastModEl = document.querySelector('#lastModified');
    const siteTitle = document.querySelector('#site-title');
    const siteOwner = document.querySelector('#site-owner');

    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
    if (lastModEl) lastModEl.textContent = document.lastModified;
    if (siteTitle && !siteTitle.textContent.trim()) siteTitle.textContent = defaultName;
    if (siteOwner && !siteOwner.textContent.trim())
        siteOwner.textContent = siteTitle?.textContent?.trim() || defaultName;
}
