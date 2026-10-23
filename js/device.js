// Desktop phone mockup: the app is laid out on a fixed iPhone 15 Pro screen (393×852 pt)
// and the whole device is scaled to fit the browser window's height, below the A | B switch.

const MARGIN = 20; // px of page space kept beside and below the phone
const TOP = 60; // px reserved above the phone for the A | B version switch

let scale = 1;

// Current device scale. Pointer deltas in page px ÷ scale = screen pt.
export const getScale = () => scale;

export function fitDevice(device, onScale) {
  const fit = () => {
    const availH = window.innerHeight - TOP - MARGIN;
    scale = Math.min(availH / device.offsetHeight, (window.innerWidth - 2 * MARGIN) / device.offsetWidth);
    device.style.setProperty('--device-scale', scale);
    device.style.setProperty('--device-center-y', `${TOP + availH / 2}px`);
    onScale?.(scale);
  };
  window.addEventListener('resize', fit);
  fit();
  return fit;
}
