import { startVite, launchChromium } from './lib/harness.mjs';
const host = await startVite(); const browser = await launchChromium();
try {
  for (const [name, dy, q] of [['arctic', 420, 'medium'], ['himalaya', 0, 'medium']]) {
    const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
    await page.goto(host.url + 'dev/globe.html?quality=' + q, { waitUntil: 'networkidle' });
    await page.waitForFunction('window.__globeReady && window.__globeMetrics', undefined, { timeout: 90000 });
    await page.evaluate(() => { document.getElementById('lab').style.display = 'none'; });
    await page.mouse.move(200, 300); await page.mouse.down();
    if (name === 'himalaya') { for (let i = 1; i <= 20; i++) await page.mouse.move(200 - i * 12, 300); }
    else { for (let i = 1; i <= 20; i++) await page.mouse.move(200, 300 + i * dy / 20); }
    await page.mouse.up(); await page.waitForTimeout(2500);
    await page.screenshot({ path: `/tmp/claude-0/-home-user-airway/fae3104d-252c-5bd9-a9a6-c84d1bb113eb/scratchpad/${name}.png` });
    await page.close();
  }
} finally { await browser.close(); await host.stop(); }
