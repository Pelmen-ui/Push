import { spawn } from 'child_process';
import { rmSync, mkdirSync, writeFileSync } from 'fs';

const userDir = 'C:\\Users\\Romas\\AppData\\Local\\Temp\\chrome_audio_verify';
rmSync(userDir, { recursive: true, force: true });
mkdirSync(userDir, { recursive: true });

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9224',
    '--user-data-dir=' + userDir,
    '--headless=new',
    '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,720',
    'http://127.0.0.1:8086/index.html'
]);

try {
    let page = null;
    for (let i = 0; i < 30; i++) {
        try {
            const res = await fetch('http://127.0.0.1:9224/json');
            const list = await res.json();
            page = list.find(t => t.type === 'page');
            if (page) break;
        } catch {}
        await new Promise(r => setTimeout(r, 200));
    }
    if (!page) {
        console.error('Could not find chrome page');
        process.exit(1);
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
        await new Promise(r => setTimeout(r, 250));
    }

    await send('Runtime.evaluate', {
        expression: `
            const btn = document.getElementById('btn-faction-ru');
            if (btn) btn.click();
        `
    });
    await new Promise(r => setTimeout(r, 1500));

    const check = await send('Runtime.evaluate', {
        expression: `
            (async () => {
                const eng = window.BATTLE_ENGINE?.instance;
                if (!eng) return { ok: false, error: 'no instance' };
                const sound = eng.sound;
                if (!sound) return { ok: false, error: 'no sound' };
                if (sound.ctx && sound.ctx.state === 'suspended') await sound.ctx.resume();
                if (!sound._audioLoaded) await sound.loadAudioSamples();
                const bufferKeys = Object.keys(sound.buffers);

                sound.playGunshot(0, false, 'ak12');
                sound.playGunshot(0, false, 'm4a1');
                sound.playGunshot(0, true, 'rpg7');
                sound.playExplosion(20);
                sound.playHitMarker(false);
                sound.playHitMarker(true);

                const hm = document.getElementById('hit-marker');
                eng.flashCrosshairHit(false);
                const hmStyleBody = hm ? { opacity: hm.style.opacity, className: hm.className } : null;

                eng.flashCrosshairHit(true);
                const hmStyleHead = hm ? { opacity: hm.style.opacity, className: hm.className } : null;

                return {
                    ok: true,
                    bufferKeys,
                    audioLoaded: sound._audioLoaded,
                    activeVoices: sound.activeVoices,
                    ctxState: sound.ctx?.state,
                    hmStyleBody,
                    hmStyleHead
                };
            })()
        `,
        awaitPromise: true,
        returnByValue: true
    });

    console.log('Verification check result:', JSON.stringify(check?.result?.value, null, 2));

    const shot = await send('Page.captureScreenshot', { format: 'png' });
    if (shot && shot.data) {
        writeFileSync('C:\\Users\\Romas\\.gemini\\antigravity\\brain\\4bd9bdee-3c15-4e9b-a774-8c4c47f07f02\\verify_audio_hitmarker.png', Buffer.from(shot.data, 'base64'));
    }
} finally {
    chrome.kill('SIGKILL');
}
