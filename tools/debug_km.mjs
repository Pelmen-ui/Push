import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--remote-debugging-port=9227',
    '--user-data-dir=C:\\Users\\Romas\\AppData\\Local\\Temp\\chrome_debug_km',
    '--headless=new',
    'http://127.0.0.1:8086/index.html'
]);

setTimeout(async () => {
    try {
        const list = await (await fetch('http://127.0.0.1:9227/json')).json();
        const page = list.find(t => t.type === 'page');
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        ws.onopen = () => {
            ws.send(JSON.stringify({
                id: 1,
                method: 'Runtime.evaluate',
                params: {
                    expression: `(async () => {
                        const eng = window.BATTLE_ENGINE?.instance;
                        document.getElementById('btn-faction-ru')?.click();
                        await new Promise(r => setTimeout(r, 1200));

                        eng.flashKillMarker(true);
                        eng.showKillBanner('Боец ВСУ', 'АК-12 (5.45x39)', 42, true, 'ГОЛОВА');
                        await new Promise(r => setTimeout(r, 100));

                        const km = document.getElementById('kill-marker');
                        return {
                            kmOpacity: window.getComputedStyle(km).opacity,
                            kmDisplay: window.getComputedStyle(km).display,
                            kmClass: km.className
                        };
                    })()`,
                    awaitPromise: true,
                    returnByValue: true
                }
            }));
        };
        ws.onmessage = async (e) => {
            console.log('KM Debug:', JSON.parse(e.data).result?.result?.value);
            ws.send(JSON.stringify({ id: 2, method: 'Page.captureScreenshot', params: { format: 'png' } }));
            ws.onmessage = (e2) => {
                const res = JSON.parse(e2.data);
                if (res.result?.data) {
                    writeFileSync('C:\\Users\\Romas\\.gemini\\antigravity\\brain\\4bd9bdee-3c15-4e9b-a774-8c4c47f07f02\\verify_skull_capture.png', Buffer.from(res.result.data, 'base64'));
                    console.log('Screenshot saved to verify_skull_capture.png');
                }
                chrome.kill('SIGKILL');
                process.exit(0);
            };
        };
    } catch (e) {
        console.error(e);
        chrome.kill('SIGKILL');
        process.exit(1);
    }
}, 1500);
