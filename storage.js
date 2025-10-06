// LocalStorage helpers (Window interface API). :contentReference[oaicite:1]{index=1}
export const setLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
export const getLS = (k, fallback = null) => {
    try { return JSON.parse(localStorage.getItem(k)) ?? fallback; }
    catch { return fallback; }
};
export const setStr = (k, v) => localStorage.setItem(k, v);
export const getStr = (k, fallback = '') => localStorage.getItem(k) ?? fallback;
