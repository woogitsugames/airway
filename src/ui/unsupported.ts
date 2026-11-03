// [night-11h] R3g, D-118: the page shown instead of a blank sky when the WebGL 2 context cannot be created. Plain
// settings paper (same tokens as the settings and privacy pages), the device's renderer string for a support mail,
// no buttons: there is nothing to play on this device, and back/home leave the app as usual.
import { t } from '../i18n';
import './menu/menu.css';

export function mountUnsupported(host: HTMLElement, renderer: string): HTMLElement {
  host.replaceChildren();
  const root = document.createElement('section');
  root.className = 'airway-settings airway-unsupported';
  root.dataset.testid = 'gl-unsupported';
  const paper = document.createElement('div');
  paper.className = 'airway-settings__paper airway-privacy';
  const title = document.createElement('h1');
  title.className = 'airway-unsupported__title';
  title.textContent = t('gl.unsupported.title');
  const body = document.createElement('p');
  body.textContent = t('gl.unsupported.body');
  const gpu = document.createElement('p');
  gpu.className = 'airway-unsupported__gpu';
  gpu.dataset.testid = 'gl-unsupported-renderer';
  gpu.textContent = t('gl.unsupported.renderer', { renderer });
  const mail = document.createElement('p');
  mail.className = 'airway-setting__hint';
  mail.textContent = t('gl.unsupported.mail');
  paper.append(title, body, gpu, mail);
  root.append(paper);
  host.append(root);
  return root;
}
