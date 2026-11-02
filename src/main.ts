// Bootstrap the empty Diorama sky scene until the production renderer arrives.
import './ui/fonts.css';
import './ui/base.css';
import { getLanguage, t } from './i18n';
import { mountEmptyScene } from './render/scene';

const mount = document.getElementById('app');
if (!mount) throw new Error('Missing #app mount point');
document.documentElement.lang = getLanguage();
document.title = t('app.title');

// [task-06] Temporary standalone airport fixture; it does not replace the playable game.
if (new URLSearchParams(location.search).get('dev') === 'airports') {
  void import('./render/models/airports-demo').then(({ mountAirportsDemo }) => mountAirportsDemo(mount))
    .catch((error: unknown) => console.error('Airport demo unavailable', error));
} else {
try {
  const view = mountEmptyScene(mount);
  view.canvas.setAttribute('aria-label', t('canvas.label'));
} catch (cause) {
  console.error('WebGL is unavailable; using a flat sky canvas.', cause);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t('canvas.label'));
  canvas.width = Math.max(1, mount.clientWidth);
  canvas.height = Math.max(1, mount.clientHeight);
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#8CC3D8';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  mount.appendChild(canvas);
}

}
