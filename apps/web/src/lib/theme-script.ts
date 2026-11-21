/** localStorage key for the reader's light/dark choice. */
export const THEME_STORAGE_KEY = "booksyde-theme";

/**
 * Runs in <head> before the page paints so a saved choice never flashes the
 * wrong theme. Keep it tiny and dependency-free.
 */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** sessionStorage key for a forced season while previewing (`?season=christmas` or `?season=off`). */
export const SEASON_STORAGE_KEY = "booksyde-season";

/**
 * Sets <html data-season="christmas"> through December on the reader's own
 * clock (see seasonOn in @booksyde/theme), before first paint, so the seasonal
 * touches (`christmas:` in globals.css) never flash in. `?season=christmas` or
 * `?season=off` overrides the calendar for the rest of the tab's visit.
 */
export const seasonInitScript = `try{var s=new URLSearchParams(location.search).get("season");if(s==="christmas"||s==="off")sessionStorage.setItem("${SEASON_STORAGE_KEY}",s);else if(s==="auto")sessionStorage.removeItem("${SEASON_STORAGE_KEY}");s=sessionStorage.getItem("${SEASON_STORAGE_KEY}");if(s==="christmas"||(s!=="off"&&new Date().getMonth()===11))document.documentElement.dataset.season="christmas"}catch(e){}`;
