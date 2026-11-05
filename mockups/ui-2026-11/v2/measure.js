// Text width in the browser (fonts must be loaded before render()).
const ctx = document.createElement('canvas').getContext('2d');
export function tw(txt, size, fam, w = 400) { ctx.font = `${w} ${size}px "${fam}"`; return ctx.measureText(String(txt)).width; }
