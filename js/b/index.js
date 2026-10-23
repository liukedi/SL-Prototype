// Version B (redesign) entry point. Called from js/ui.js only when VARIANT is 'b',
// after the shared app is set up. Version A never loads this file.
//
// `app` gives access to the shared parts:
//   app.map         – { map (MapLibre), flyToUser, focusStop, clearStop }
//   app.sheet       – bottom sheet { snapTo, refresh, snap }
//   app.searchPanel – stop search { open(mode), close, isOpen }
//   app.travel      – Travel tab
//   app.openStop(stop), app.closeStop()
export function initVariantB(app) {
  // Version B styles (css/b.css), only for this version.
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/b.css';
  document.head.appendChild(link);

  // Design changes for version B go here (in this folder).
  void app;
}
