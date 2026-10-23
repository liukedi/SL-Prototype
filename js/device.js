// Desktop phone mockup: the app is laid out on a fixed iPhone 15 Pro screen (393×852 pt)
// and the whole device is scaled to fit the browser window's height.

const MARGIN = 20; // px of page space kept above and below the phone

let scale = 1;

// Current device scale. Pointer deltas in page px ÷ scale = screen pt.
export const getScale = () => scale;

export function fitDevice(device, onScale) {
  const fit = () => {
    scale = Math.min(
      (window.innerHeight - 2 * MARGIN) / device.offsetHeight,
      (window.innerWidth - 2 * MARGIN) / device.offsetWidth
    );
    device.style.setProperty('--device-scale', scale);
    onScale?.(scale);
  };
  window.addEventListener('resize', fit);
  fit();
  return fit;
}
