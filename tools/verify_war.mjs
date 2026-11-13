import { spawn } from 'child_process';
import { rmSync, mkdirSync, writeFileSync } from 'fs';

const userDir = 'C:\\Users\\Romas\\AppData\\Local\\Temp\\chrome_verify_war';
rmSync(userDir, { recursive: true, force: true });
mkdirSync(userDir, { recursive: true });

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9225',
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
            const res = await fetch('http://127.0.0.1:9225/json');
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

    // Capture start menu panel
    let shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('verify_menu_war.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved verify_menu_war.png');

    // Click faction RU
    await send('Runtime.evaluate', {
        expression: 'document.getElementById("btn-faction-ru").click();'
    });
    await new Promise(r => setTimeout(r, 1500));

    // Turn camera forward towards enemy line
    await send('Runtime.evaluate', {
        expression: `
            window.BATTLE_ENGINE.instance.playerCollider.start.set(0, 0, -25);
            window.BATTLE_ENGINE.instance.playerCollider.end.set(0, 1.75, -25);
            window.BATTLE_ENGINE.instance.cameraMount.position.set(0, 1.75, -25);
            window.BATTLE_ENGINE.instance.yaw = 0;
            window.BATTLE_ENGINE.instance.pitch = -0.05;
        `
    });
    await new Promise(r => setTimeout(r, 300));

    shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync('verify_no_green_trench.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved verify_no_green_trench.png');

} finally {
    chrome.kill();
}
