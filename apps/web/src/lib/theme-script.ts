/** localStorage key for the reader's light/dark choice. */
export const THEME_STORAGE_KEY = "booksyde-theme";

/**
 * Runs in <head> before the page paints so a saved choice never flashes the
 * wrong theme. Keep it tiny and dependency-free.
 */
export const themeInitScript = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

/** sessionStorage key for a forced season while previewing (`?season=thanksgiving`, `christmas` or `off`). */
export const SEASON_STORAGE_KEY = "booksyde-season";

/**
 * Sets <html data-season="thanksgiving"> through November and
 * data-season="christmas" through December, on the reader's own clock (see
 * seasonOn in @booksyde/theme), before first paint, so the seasonal touches
 * (`thanksgiving:` and `christmas:` in globals.css) never flash in.
 * `?season=thanksgiving`, `?season=christmas` or `?season=off` overrides the
 * calendar for the rest of the tab's visit; `?season=auto` goes back to it.
 */
export const seasonInitScript = `try{var s=new URLSearchParams(location.search).get("season"),k="${SEASON_STORAGE_KEY}";if(s==="christmas"||s==="thanksgiving"||s==="off")sessionStorage.setItem(k,s);else if(s==="auto")sessionStorage.removeItem(k);s=sessionStorage.getItem(k);var m=new Date().getMonth();if(s!=="christmas"&&s!=="thanksgiving")s=s==="off"?"":m===10?"thanksgiving":m===11?"christmas":"";if(s)document.documentElement.dataset.season=s}catch(e){}`;
