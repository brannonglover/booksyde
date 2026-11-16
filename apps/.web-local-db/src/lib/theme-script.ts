/** localStorage key for the reader's light/dark choice. */
export const THEME_STORAGE_KEY = "booksyde-theme";

/**
 * Runs in <head> before the page paints so a saved choice never flashes the
 * wrong theme. Keep it tiny and dependency-free.
 */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
