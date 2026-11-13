import { spawn } from 'child_process';
import { rmSync, mkdirSync, writeFileSync } from 'fs';

const userDir = 'C:\\Users\\Romas\\AppData\\Local\\Temp\\chrome_verify';
rmSync(userDir, { recursive: true, force: true });
mkdirSync(userDir, { recursive: true });

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9223',
    '--user-data-dir=' + userDir,
    '--headless=new',
    '--disable-gpu',
    '--mute-audio',
    '--window-size=1280,720',
    'http://127.0.0.1:8086/index.html'
]);

try {
    let page = null;
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch('http://127.0.0.1:9223/json');
            const list = await res.json();
            page = list.find(t => t.type === 'page');
            if (page) break;
        } catch {}
        await new Promise(r => setTimeout(r, 200));
    }
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let msgId = 1;
    function send(method, params = {}) {
        return new Promise(resolve => {
            const id = msgId++;
            const handler = (event) => {
                const data = JSON.parse(event.data);
                if (data.id === id) {
                    ws.removeEventListener('message', handler);
                    resolve(data.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id, method, params }));
        });
    }
    await new Promise(r => ws.onopen = r);

    for (let i = 0; i < 40; i++) {
        const evalRes = await send('Runtime.evaluate', {
            expression: 'Boolean(window.BATTLE_ENGINE && window.BATTLE_ENGINE.ready && window.BATTLE_ENGINE.instance)',
            returnByValue: true
        });
        if (evalRes?.result?.value) break;
        await new Promise(r => setTimeout(r, 500));
    }

    await send('Runtime.evaluate', {
        expression: 'document.getElementById("btn-faction-ru").click();'
    });
    await new Promise(r => setTimeout(r, 1500));

    let shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('verify_hud_clean.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved verify_hud_clean.png');

    await send('Runtime.evaluate', {
        expression: 'window.BATTLE_ENGINE.instance.togglePlayerFpvDrone("KAMIKAZE");'
    });
    await new Promise(r => setTimeout(r, 500));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('verify_drone_fpv.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved verify_drone_fpv.png');

    const domCheck = await send('Runtime.evaluate', {
        expression: `({
            vehiclePromptDisplay: window.getComputedStyle(document.getElementById('vehicle-interact-prompt')).display,
            killFeedDisplay: window.getComputedStyle(document.getElementById('kill-feed')).display,
            topTelemetryDisplay: window.getComputedStyle(document.getElementById('top-left-telemetry')).display,
            crosshairDisplay: window.getComputedStyle(document.getElementById('crosshair')).display,
            fpvOsdDisplay: window.getComputedStyle(document.getElementById('fpv-osd')).display,
            fpvReticleExists: Boolean(document.querySelector('.fpv-reticle')),
            fpvNoiseCanvasExists: Boolean(document.getElementById('fpv-noise-canvas')),
            fpvTopBarExists: Boolean(document.querySelector('.fpv-top-bar'))
        })`,
        returnByValue: true
    });
    console.log('DOM Check:', JSON.stringify(domCheck.result.value, null, 2));

    await send('Runtime.evaluate', {
        expression: 'window.BATTLE_ENGINE.instance.exitPlayerFpvDrone();'
    });
    await new Promise(r => setTimeout(r, 400));
    const shotBack = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('verify_hud_return.png', Buffer.from(shotBack.data, 'base64'));
    console.log('Saved verify_hud_return.png');

} finally {
    chrome.kill();
}
