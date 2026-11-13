import * as THREE from 'three';
import { STATS } from '../../stats.js';

let _fpvNoiseCanvas = null;
let _fpvNoiseCtx = null;
let _fpvNoiseImg = null;
let _fpvNoiseData = null;
let _fpvNoiseTime = 0;

function updateFpvNoise(canvas, dt) {
    if (!canvas) return;
    if (_fpvNoiseCanvas !== canvas) {
        _fpvNoiseCanvas = canvas;
        canvas.width = 320;
        canvas.height = 180;
        _fpvNoiseCtx = canvas.getContext('2d');
        _fpvNoiseImg = _fpvNoiseCtx.createImageData(320, 180);
        _fpvNoiseData = new Uint32Array(_fpvNoiseImg.data.buffer);
    }
    _fpvNoiseTime += dt;
    const buf = _fpvNoiseData;
    const w = 320;
    const h = 180;

    const bandPos1 = Math.floor(((_fpvNoiseTime * 110) % (h + 40)) - 20);
    const bandPos2 = Math.floor(((_fpvNoiseTime * 170) % (h + 60)) - 30);

    for (let y = 0; y < h; y++) {
        const inBand1 = Math.abs(y - bandPos1) < 7;
        const inBand2 = Math.abs(y - bandPos2) < 4;
        const rowOffset = y * w;
        for (let x = 0; x < w; x++) {
            const r = Math.random();
            let v = 0;
            if (inBand1) {
                if (r > 0.4) v = Math.floor(Math.random() * 200);
            } else if (inBand2) {
                if (r > 0.5) v = Math.floor(Math.random() * 240);
            } else {
                if (r > 0.82) v = Math.floor(Math.random() * 110);
            }
            if (v > 0) {
                buf[rowOffset + x] = (v << 24) | (v << 16) | (v << 8) | v;
            } else {
                buf[rowOffset + x] = 0;
            }
        }
    }
    _fpvNoiseCtx.putImageData(_fpvNoiseImg, 0, 0);
}

function clearFpvNoise() {
    if (_fpvNoiseCtx && _fpvNoiseCanvas) {
        _fpvNoiseCtx.clearRect(0, 0, _fpvNoiseCanvas.width, _fpvNoiseCanvas.height);
    }
}

export const droneMethods = {
    spawnAutonomousDrones() {
        const droneConfigs = [
            { key: 'drone_fpv',    type: 'KAMIKAZE', faction: 'RU', span: 0.62, y: 15, radius: 26, speed: 14.0 },
            { key: 'drone_lancet', type: 'LANCET',   faction: 'RU', span: 1.45, y: 24, radius: 34, speed: 18.5 },
            { key: 'drone_mavic',  type: 'RECON',    faction: 'UA', span: 0.50, y: 19, radius: 20, speed: 7.5 }
        ];

        for (let i = 0; i < droneConfigs.length; i++) {
            const cfg = droneConfigs[i];
            const mesh = this.instantiateStaticModel(cfg.key, cfg.span);
            const angle = (i / droneConfigs.length) * Math.PI * 2;
            mesh.position.set(Math.cos(angle) * cfg.radius, cfg.y, Math.sin(angle) * cfg.radius);
            this.scene.add(mesh);

            const navLight = new THREE.PointLight(cfg.faction === 'RU' ? 0xff2222 : 0x2277ff, 1.4, 8.0);
            navLight.position.set(0, -0.1, 0);
            mesh.add(navLight);

            this.drones.push({
                mesh,
                config: cfg,
                angle,
                diveTarget: null,
                diveTimer: 14.0 + Math.random() * 12.0,
                isDiving: false,
                hp: cfg.type === 'LANCET' ? 45 : 25,
                maxHp: cfg.type === 'LANCET' ? 45 : 25,
                dead: false,
                destroyed: false
            });
        }
    },

    togglePlayerFpvDrone(type = 'KAMIKAZE') {
        if (this.fpvMode.active) {
            this.exitPlayerFpvDrone();
            return;
        }
        if (this.playerVehicleState.vehicle) {
            this.exitCurrentVehicle();
        }
        this.fpvMode.active = true;
        this.fpvMode.droneType = type;
        this.viewmodelRoot.visible = false;
        this.fpvMode.position.copy(this.cameraMount.position).add(new THREE.Vector3(0, 2.5, -1.5));
        this.fpvMode.velocity.set(0, 5.5, -12.0);
        this.fpvMode.yaw = this.yaw;
        this.fpvMode.pitch = -0.08;
        this.fpvMode.roll = 0;
        this.fpvMode.battery = 100;

        if (this.fpvMode.droneMesh) {
            this.scene.remove(this.fpvMode.droneMesh);
        }
        const modelKey = type === 'LANCET' ? 'drone_lancet' : 'drone_fpv';
        const span = type === 'LANCET' ? 1.35 : 0.58;
        this.fpvMode.droneMesh = this.instantiateStaticModel(modelKey, span);
        this.scene.add(this.fpvMode.droneMesh);

        if (!this.fpvMode.motorAudio) {
            this.fpvMode.motorAudio = this.sound.createDroneMotorNode();
        }
        if (this.fpvMode.motorAudio && this.fpvMode.motorAudio.gain) {
            this.fpvMode.motorAudio.gain.gain.value = 0.16;
        }

        const fpvHud = document.getElementById('fpv-osd');
        if (fpvHud) fpvHud.style.display = 'block';
        const rw = document.getElementById('bottom-right-weapon');
        if (rw) rw.style.display = 'none';
        const hp = document.getElementById('health-panel');
        if (hp) hp.style.display = 'none';
    },

    exitPlayerFpvDrone() {
        this.fpvMode.active = false;
        this.viewmodelRoot.visible = (this.playerVehicleState.role !== 'DRIVER');
        if (this.fpvMode.droneMesh) this.fpvMode.droneMesh.visible = false;
        if (this.fpvMode.motorAudio && this.fpvMode.motorAudio.gain) this.fpvMode.motorAudio.gain.gain.value = 0.0;
        const fpvHud = document.getElementById('fpv-osd');
        if (fpvHud) fpvHud.style.display = 'none';
        const rw = document.getElementById('bottom-right-weapon');
        if (rw) rw.style.display = 'block';
        const hp = document.getElementById('health-panel');
        if (hp) hp.style.display = 'flex';
        clearFpvNoise();
    },

    detonatePlayerFpvDrone() {
        if (!this.fpvMode.active) return;
        const blastPos = this.fpvMode.position.clone();
        const label = this.fpvMode.droneType === 'LANCET' ? 'БПЛА «ЛАНЦЕТ-3»' : 'FPV-ДРОН ПГ-7ВЛ';
        this.exitPlayerFpvDrone();
        this.triggerHighExplosiveBlast(blastPos, STATS.FPV.blastRadius, STATS.FPV.blastForce, STATS.FPV.damage, label);
    },

    updatePlayerFpvFlight(dt) {
        const fpv = this.fpvMode;
        const forward = new THREE.Vector3(
            -Math.sin(fpv.yaw) * Math.cos(fpv.pitch),
            Math.sin(fpv.pitch),
            -Math.cos(fpv.yaw) * Math.cos(fpv.pitch)
        ).normalize();
        const right = new THREE.Vector3(Math.cos(fpv.yaw), 0, -Math.sin(fpv.yaw));

        let thrust = 18.0;
        if (this.keys['KeyW']) thrust = STATS.FPV.thrustAccel;
        else if (this.keys['KeyS']) thrust = 4.0;

        fpv.velocity.addScaledVector(forward, thrust * dt);
        if (this.keys['KeyD']) fpv.velocity.addScaledVector(right, 18.0 * dt);
        if (this.keys['KeyA']) fpv.velocity.addScaledVector(right, -18.0 * dt);
        if (this.keys['Space']) fpv.velocity.y += 15.0 * dt;
        if (this.keys['KeyC']) fpv.velocity.y -= 15.0 * dt;

        fpv.velocity.y -= 9.8 * dt;
        fpv.velocity.multiplyScalar(Math.exp(-STATS.FPV.drag * dt));
        if (fpv.velocity.length() > STATS.FPV.maxSpeed) {
            fpv.velocity.setLength(STATS.FPV.maxSpeed);
        }

        fpv.position.addScaledVector(fpv.velocity, dt);
        fpv.roll = THREE.MathUtils.lerp(fpv.roll, 0, Math.min(1.0, dt * 4.5));

        if (fpv.droneMesh) {
            fpv.droneMesh.position.copy(fpv.position);
            fpv.droneMesh.rotation.set(fpv.pitch, fpv.yaw, fpv.roll, 'YXZ');
        }

        this.cameraMount.position.copy(fpv.position).addScaledVector(forward, 0.28);
        const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), fpv.yaw);
        const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), fpv.pitch);
        const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), fpv.roll);
        this.camera.quaternion.copy(qYaw).multiply(qPitch).multiply(qRoll);

        if (fpv.motorAudio) {
            const spdRatio = fpv.velocity.length() / STATS.FPV.maxSpeed;
            const isThrusting = Boolean(this.keys && (this.keys['KeyW'] || this.keys['ShiftLeft'] || this.keys['Space']));
            const targetRate = 0.88 + spdRatio * 0.65 + (isThrusting ? 0.18 : 0.0);
            const targetFreq = 360 + spdRatio * 520 + (isThrusting ? 80 : 0);
            if (fpv.motorAudio.setPitch) {
                fpv.motorAudio.setPitch(targetRate, targetFreq);
            } else if (fpv.motorAudio.osc) {
                fpv.motorAudio.osc.frequency.value = targetFreq;
            }
            if (fpv.motorAudio.gain && this.sound?.ctx) {
                const targetVol = isThrusting ? 0.22 : 0.14;
                fpv.motorAudio.gain.gain.setTargetAtTime(targetVol, this.sound.ctx.currentTime, 0.04);
            }
        }

        updateFpvNoise(document.getElementById('fpv-noise-canvas'), dt);
        fpv.battery = Math.max(0, fpv.battery - dt * 2.2);

        if (fpv.position.y <= 0.35 || fpv.battery <= 0) {
            this.detonatePlayerFpvDrone();
            return;
        }

        for (const u of this.units) {
            if (!u.isDead && u.root.position.distanceTo(fpv.position) < 1.5) {
                this.detonatePlayerFpvDrone();
                return;
            }
        }
        for (const v of this.ragdollPhysics.vehicles) {
            if (!v.destroyed && v.chassisPos.distanceTo(fpv.position) < 3.5) {
                this.detonatePlayerFpvDrone();
                return;
            }
        }
    },

    damageDrone(d, dmg, p = null) {
        if (!d || d.dead || d.destroyed) return;
        d.hp = (d.hp !== undefined ? d.hp : 20) - dmg;
        const shooterName = (p && (p.shooter || p.attacker)) || 'ВЫ';
        const weaponName = (p && p.ammo && p.ammo.name) || (p && p.weapon && p.weapon.name) || 'ОГОНЬ';
        const isPlayerShooter = !p || p.isPlayer || shooterName === 'ВЫ';

        if (isPlayerShooter) {
            if (typeof this.sound?.playHitMarker === 'function') {
                this.sound.playHitMarker(false);
            }
            if (typeof this.flashCrosshairHit === 'function') {
                this.flashCrosshairHit(false);
            }
        }

        if (d.hp <= 0) {
            d.dead = true;
            d.destroyed = true;
            const blastPos = d.mesh ? d.mesh.position.clone() : new THREE.Vector3();

            if (typeof this.triggerHighExplosiveBlast === 'function') {
                this.triggerHighExplosiveBlast(blastPos, 3.5, 18.0, 50, 'ДРОН СБИТ');
            }
            if (typeof this.spawnImpactParticles === 'function') {
                this.spawnImpactParticles(blastPos, new THREE.Vector3(0, 1, 0), 0xff4411, 24);
                this.spawnImpactParticles(blastPos, new THREE.Vector3(0, 1, 0), 0x222222, 28);
            }

            if (typeof this.pushKillFeed === 'function') {
                const dName = (d.config && (d.config.type === 'LANCET' ? 'ЛАНЦЕТ-3' : d.config.type === 'RECON' ? 'MAVIC 3' : 'FPV-ДРОН')) || 'БПЛА';
                this.pushKillFeed(shooterName, dName, 'СБИТ В ВОЗДУХЕ', 0, weaponName);
            }

            if (d.mesh) {
                d.isCrashing = true;
                d.crashVel = new THREE.Vector3(
                    (Math.random() - 0.5) * 6.0,
                    1.5 + Math.random() * 2.5,
                    (Math.random() - 0.5) * 6.0
                );
                d.crashRotVel = new THREE.Vector3(
                    12.0 + Math.random() * 10.0,
                    15.0 + Math.random() * 12.0,
                    8.0 + Math.random() * 8.0
                );
            }
        } else {
            if (d.mesh && typeof this.spawnImpactParticles === 'function') {
                this.spawnImpactParticles(d.mesh.position, new THREE.Vector3(0, 1, 0), 0xffaa22, 10);
            }
        }
    },

    updateAutonomousDrones(dt) {
        for (let i = this.drones.length - 1; i >= 0; i--) {
            const d = this.drones[i];
            if (d.isCrashing) {
                d.crashVel.y -= 24.0 * dt;
                d.mesh.position.addScaledVector(d.crashVel, dt);
                d.mesh.rotation.x += d.crashRotVel.x * dt;
                d.mesh.rotation.y += d.crashRotVel.y * dt;
                d.mesh.rotation.z += d.crashRotVel.z * dt;

                if (Math.random() < 0.4 && typeof this.spawnImpactParticles === 'function') {
                    this.spawnImpactParticles(d.mesh.position, new THREE.Vector3(0, 0.5, 0), 0x333333, 3);
                }

                if (d.mesh.position.y <= 0.4) {
                    if (typeof this.triggerHighExplosiveBlast === 'function') {
                        this.triggerHighExplosiveBlast(d.mesh.position, 4.0, 25.0, 60, 'ПАДЕНИЕ ОБЛОМКОВ');
                    }
                    if (d.mesh.parent) d.mesh.parent.remove(d.mesh);
                    this.drones.splice(i, 1);
                }
                continue;
            }
            if (d.dead || d.destroyed) {
                if (d.mesh && d.mesh.parent) d.mesh.parent.remove(d.mesh);
                this.drones.splice(i, 1);
                continue;
            }
            if (!d.isDiving) {
                d.angle += (d.config.speed / d.config.radius) * dt;
                d.mesh.position.set(
                    Math.cos(d.angle) * d.config.radius,
                    d.config.y + Math.sin(d.angle * 3.0) * 1.2,
                    Math.sin(d.angle) * d.config.radius
                );
                d.mesh.rotation.y = -d.angle;

                if (d.config.type !== 'RECON') {
                    d.diveTimer -= dt;
                    if (d.diveTimer <= 0) {
                        const enemies = this.units.filter((u) => !u.isDead && u.faction !== d.config.faction);
                        if (enemies.length > 0) {
                            d.diveTarget = enemies[Math.floor(Math.random() * enemies.length)].root.position.clone();
                            d.isDiving = true;
                        } else {
                            d.diveTimer = 10.0;
                        }
                    }
                }
            } else if (d.diveTarget) {
                const dir = d.diveTarget.clone().sub(d.mesh.position);
                const dist = dir.length();
                if (dist < 1.2) {
                    this.triggerHighExplosiveBlast(
                        d.diveTarget,
                        9.0,
                        55.0,
                        220,
                        d.config.type === 'LANCET' ? 'БПЛА «Ланцет-3»' : 'FPV Камикадзе'
                    );
                    d.isDiving = false;
                    d.diveTimer = 15.0 + Math.random() * 10.0;
                } else {
                    dir.normalize();
                    d.mesh.position.addScaledVector(dir, 26.0 * dt);
                    d.mesh.lookAt(d.diveTarget);
                }
            }
        }
    },
};
