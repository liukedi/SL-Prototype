// Which test version is running: 'a' (baseline, the SL app as it is) or 'b' (redesign).
// Set by the entry page: a/index.html → <html data-variant="a">, b/index.html → "b".
// Everything specific to version B lives in js/b/ and css/b.css and is only loaded for 'b'.
export const VARIANT = document.documentElement.dataset.variant === 'b' ? 'b' : 'a';
export const isB = VARIANT === 'b';

// Study mode (?study): the page runs inside the experiment flow (study/index.html), which
// decides the version. The A | B switch is hidden so participants can't change version
// and don't see the versions' letters.
export const isStudy = new URLSearchParams(location.search).has('study');
if (isStudy) document.documentElement.dataset.study = '';
