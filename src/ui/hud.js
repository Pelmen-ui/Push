import * as THREE from 'three';
import { STATS } from '../../stats.js';

export const hudMethods = {
    notify(text, { kind = 'info', ttl = 3.5 } = {}) {
        const banner = document.getElementById('squad-order-banner');
        if (!banner) return;
        banner.textContent = text;
        banner.classList.toggle('active-assault', kind !== 'info');
    },

    flashCrosshairHit(isHeadshot) {
        const km = document.getElementById('kill-marker');
        if (km && km.className) return;
        const hm = document.getElementById('hit-marker');
        if (!hm) return;
        hm.className = isHeadshot ? 'hit-head' : 'hit-body';
        hm.style.opacity = '1';
        clearTimeout(this._hmTimer);
        this._hmTimer = setTimeout(() => {
            hm.style.opacity = '0';
        }, 140);
    },

    flashKillMarker(isHeadshot) {
        const hm = document.getElementById('hit-marker');
        if (hm) hm.style.opacity = '0';
        const km = document.getElementById('kill-marker');
        if (!km) return;
        clearTimeout(this._kmTimer);
        clearTimeout(this._kmFadeTimer);
        km.className = isHeadshot ? 'kill-head' : 'kill-body';
        km.style.opacity = '1';
        this._kmTimer = setTimeout(() => {
            km.style.opacity = '0';
            this._kmFadeTimer = setTimeout(() => {
                if (km.style.opacity === '0') km.className = '';
            }, 100);
        }, 360);
    },

    showKillBanner(victimName, weaponName, distMeters, isHeadshot, zoneLabel = '') {
        const kb = document.getElementById('kill-banner');
        if (!kb) return;
        const title = document.getElementById('kill-banner-title');
        const target = document.getElementById('kb-target');
        const wep = document.getElementById('kb-weapon');
        const dst = document.getElementById('kb-dist');
        const zone = document.getElementById('kb-zone');
        if (title) title.textContent = isHeadshot ? 'В ГОЛОВУ' : 'НЕЙТРАЛИЗОВАН';
        if (target) target.textContent = victimName || 'ВРАГ';
        if (wep) wep.textContent = (weaponName || 'ОРУЖИЕ').split(' (')[0];
        if (dst) dst.textContent = `${distMeters || 0}м`;
        if (zone) zone.textContent = isHeadshot ? '' : (zoneLabel || 'ТОРС');
        kb.className = isHeadshot ? 'active headshot' : 'active';
        clearTimeout(this._kbTimer);
        this._kbTimer = setTimeout(() => {
            kb.className = '';
        }, 2200);
    },

    pushKillFeed(killer, victim, zoneLabel, distMeters, weaponName) {
        if (killer === 'ВЫ') {
            this.showKillBanner(victim, weaponName, distMeters, zoneLabel === 'ГОЛОВА', zoneLabel);
        }
        const feed = document.getElementById('kill-feed');
        if (!feed) return;
        const row = document.createElement('div');
        row.className = 'kill-item';
        row.innerHTML = `<span class="k-atk">${killer}</span> <span class="k-wep">[${weaponName}, ${zoneLabel}]</span> <span class="k-vic">${victim}</span> <span class="k-dst">${distMeters}м</span>`;
        feed.prepend(row);
        while (feed.children.length > 6) {
            feed.removeChild(feed.lastChild);
        }
        setTimeout(() => {
            if (row.parentNode) row.parentNode.removeChild(row);
        }, 7500);
    },

    updateScoreHUD() {
        const kEl = document.getElementById('hud-kills');
        const hEl = document.getElementById('hud-headshots');
        if (kEl) kEl.textContent = String(this.killsCount);
        if (hEl) hEl.textContent = String(this.headshotsCount);
    },

    updateWeaponHUD() {
        const wNameEl = document.getElementById('hud-weapon-name');
        const wAmmoEl = document.getElementById('hud-ammo-count');
        const wStateEl = document.getElementById('hud-reload-state');

        if (this.playerVehicleState.vehicle && this.playerVehicleState.role === 'DRIVER') {
            const v = this.playerVehicleState.vehicle;
            if (wNameEl) wNameEl.textContent = 'СКОРОСТЬ';
            if (wAmmoEl) wAmmoEl.textContent = `${v.speedKmh} KM/H`;
            if (wStateEl) wStateEl.textContent = '';
            return;
        }

        const key = this.loadoutKeys[this.currentWeaponIdx];
        const wStat = STATS.WEAPONS[key];
        const wState = this.weaponStates[key];

        if (wNameEl) wNameEl.textContent = 'ПАТРОНЫ';
        if (wAmmoEl) {
            if (wState.mag > wStat.magCapacity) {
                wAmmoEl.textContent = `${wStat.magCapacity}+1 / ${wState.reserve}`;
            } else {
                wAmmoEl.textContent = `${wState.mag} / ${wState.reserve}`;
            }
        }
        if (wStateEl) wStateEl.textContent = '';
    },
};
