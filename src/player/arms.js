import * as THREE from 'three';
import { STATS } from '../../stats.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _S = new THREE.Vector3();
const _E = new THREE.Vector3();
const _W = new THREE.Vector3();
const _T = new THREE.Vector3();
const _d = new THREE.Vector3();
const _pv = new THREE.Vector3();
const _Ek = new THREE.Vector3();
const _gripWorld = new THREE.Vector3();
const _guardWorld = new THREE.Vector3();
const _wristTgt = new THREE.Vector3();
const _poleR = new THREE.Vector3();
const _poleL = new THREE.Vector3();
const _knuckleDirR = new THREE.Vector3();
const _knuckleDirL = new THREE.Vector3();
const _palmWorldR = new THREE.Vector3();
const _palmWorldL = new THREE.Vector3();
const _vSide = new THREE.Vector3();
const _palmOrtho = new THREE.Vector3();
const _basisM4 = new THREE.Matrix4();
const _basisQuat = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _qCurl = new THREE.Quaternion();
const _eul = new THREE.Euler();
const _scale = new THREE.Vector3();

const DEG = Math.PI / 180;
const DEADZONE_RAD = 2.2 * DEG;
const DEADZONE_ADS_RAD = 0.55 * DEG;
const DEADZONE_RETURN = 5.5;
const IK_EPSILON = 1e-6;

const SIGHT_FOV_MULT = {
    ak12: 0.86,
    m4a1: 0.86,
    ak74m: 0.88,
    rpg7: 0.72
};

const WEAPON_SOCKETS = {
    ak12: {
        grip: [-0.006, 0.056, 0.114],
        gripDir: [-0.08, -0.20, -0.97],
        palmR: [-0.94, 0.14, 0.31],
        handguard: [-0.008, 0.086, -0.135],
        guardDir: [0.42, -0.06, -0.90],
        palmL: [0.36, 0.91, -0.18],
        magGrab: [-0.010, 0.032, 0.006],
        boltGrab: [0.016, 0.125, 0.015]
    },
    m4a1: {
        grip: [0.002, 0.054, 0.112],
        gripDir: [-0.08, -0.20, -0.97],
        palmR: [-0.94, 0.14, 0.31],
        handguard: [-0.002, 0.090, -0.138],
        guardDir: [0.42, -0.06, -0.90],
        palmL: [0.36, 0.91, -0.18],
        magGrab: [-0.002, 0.032, -0.008],
        boltGrab: [0.000, 0.138, 0.110]
    },
    ak74m: {
        grip: [-0.010, 0.060, 0.120],
        gripDir: [-0.08, -0.20, -0.97],
        palmR: [-0.94, 0.14, 0.31],
        handguard: [-0.012, 0.090, -0.125],
        guardDir: [0.42, -0.06, -0.90],
        palmL: [0.36, 0.91, -0.18],
        magGrab: [-0.012, 0.034, 0.008],
        boltGrab: [0.018, 0.134, 0.015]
    },
    rpg7: {
        grip: [0.112, 0.046, 0.068],
        gripDir: [-0.08, -0.20, -0.97],
        palmR: [-0.94, 0.14, 0.31],
        handguard: [0.112, 0.022, -0.072],
        guardDir: [0.08, -0.20, -0.97],
        palmL: [0.94, 0.14, 0.31],
        magGrab: [0.112, 0.075, -0.36],
        boltGrab: [0.112, 0.022, -0.072]
    }
};

function worldPos(bone, out) {
    bone.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(bone.matrixWorld);
}

function worldQuat(bone, out) {
    bone.updateWorldMatrix(true, false);
    bone.matrixWorld.decompose(_v1, out, _scale);
    return out;
}

function setWorldQuat(bone, qw) {
    const parent = bone.parent;
    if (!parent) return;
    parent.updateWorldMatrix(true, false);
    parent.matrixWorld.decompose(_v1, _qp, _scale);
    bone.quaternion.copy(_qp.invert()).multiply(qw);
    bone.updateMatrixWorld(true);
}

function aimBone(bone, child, target) {
    worldPos(bone, _v1);
    worldPos(child, _v2);
    _v3.subVectors(_v2, _v1).normalize();
    _d.subVectors(target, _v1);
    if (_d.lengthSq() < 1e-10) return;
    _d.normalize();
    _qs.setFromUnitVectors(_v3, _d);
    worldQuat(bone, _qw);
    _qw.premultiply(_qs);
    setWorldQuat(bone, _qw);
}

export function solveTwoBoneIK(upper, lower, hand, targetPos, poleVec) {
    if (!upper || !lower || !hand) return 0;
    worldPos(upper, _S);
    worldPos(lower, _E);
    worldPos(hand, _W);
    const l1 = _S.distanceTo(_E);
    const l2 = _E.distanceTo(_W);
    if (l1 < IK_EPSILON || l2 < IK_EPSILON) return 0;
    _d.subVectors(targetPos, _S);
    const dist = _d.length();
    if (dist < IK_EPSILON) return 0;
    const dc = Math.min((l1 + l2) * 0.998, Math.max(Math.abs(l1 - l2) + 0.008, dist));
    _d.multiplyScalar(1 / dist);
    _T.copy(_S).addScaledVector(_d, dc);
    const along = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc);
    const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    _pv.copy(poleVec);
    _pv.addScaledVector(_d, -_pv.dot(_d));
    if (_pv.lengthSq() < IK_EPSILON) _pv.set(0, -1, 0).addScaledVector(_d, _d.y);
    _pv.normalize();
    _Ek.copy(_S).addScaledVector(_d, along).addScaledVector(_pv, h);
    aimBone(upper, lower, _Ek);
    aimBone(lower, hand, _T);
    return Math.max(0, dist - dc);
}

function orientHandBasis(hand, knuckleDir, palmNormal) {
    if (!hand) return;
    _vSide.crossVectors(knuckleDir, palmNormal);
    if (_vSide.lengthSq() < 1e-8) {
        _vSide.set(1, 0, 0);
    } else {
        _vSide.normalize();
    }
    _palmOrtho.crossVectors(_vSide, knuckleDir).normalize();
    _basisM4.makeBasis(_vSide, knuckleDir, _palmOrtho);
    _basisQuat.setFromRotationMatrix(_basisM4);
    setWorldQuat(hand, _basisQuat);
}

function storeFingerRestQuats(hand) {
    if (!hand || typeof hand.traverse !== 'function') return;
    hand.traverse((b) => {
        if (!b.isBone || b === hand) return;
        b.userData.restQuat = b.quaternion.clone();
    });
}

function curlFingers(hand, gripCurl, isLeft, isRpg, triggerSqueeze = 0) {
    if (!hand || typeof hand.traverse !== 'function') return;
    hand.traverse((b) => {
        if (!b.isBone || b === hand) return;
        const n = b.name || '';
        if (n.includes('4')) return;
        if (b.userData.restQuat) {
            b.quaternion.copy(b.userData.restQuat);
        }
        let rx = 0;
        let ry = 0;
        let rz = 0;
        if (n.includes('Middle') || n.includes('Ring') || n.includes('Pinky')) {
            const mult = n.includes('1') ? 1.15 : (n.includes('2') ? 1.32 : 1.05);
            rx = gripCurl * mult;
        } else if (n.includes('Index')) {
            if (!isLeft) {
                if (n.includes('1')) {
                    rx = 0.18 + triggerSqueeze * 0.15;
                } else if (n.includes('2')) {
                    rx = gripCurl * 1.18 + triggerSqueeze * 0.22;
                } else {
                    rx = gripCurl * 1.22 + triggerSqueeze * 0.20;
                }
            } else {
                const mult = n.includes('1') ? 1.10 : (n.includes('2') ? 1.28 : 1.02);
                rx = gripCurl * mult;
            }
        } else if (n.includes('Thumb')) {
            if (n.includes('1')) {
                rx = gripCurl * (isLeft ? 0.58 : 0.65);
                rz = (isLeft ? -0.36 : 0.32) * gripCurl;
            } else {
                rx = gripCurl * (isLeft ? 0.68 : 0.72);
            }
        }
        if (rx !== 0 || ry !== 0 || rz !== 0) {
            _eul.set(rx, ry, rz, 'XYZ');
            _qCurl.setFromEuler(_eul);
            b.quaternion.multiply(_qCurl);
        }
    });
    hand.updateMatrixWorld(true);
}

export function createArms(engine) {
    let armGroup = null;
    let armModel = null;
    let shoulderL = null;
    let elbowL = null;
    let wristL = null;
    let shoulderR = null;
    let elbowR = null;
    let wristR = null;
    const restUpperR = new THREE.Quaternion();
    const restLowerR = new THREE.Quaternion();
    const restHandR = new THREE.Quaternion();
    const restUpperL = new THREE.Quaternion();
    const restLowerL = new THREE.Quaternion();
    const restHandL = new THREE.Quaternion();
    let builtFaction = null;
    let armsReady = false;

    let deadzoneYaw = 0;
    let deadzonePitch = 0;
    let aimBlend = 0;
    let sprintBlend = 0;

    let reloadPhase = 0;
    let reloadTimer = 0;
    let reloadTotal = 0;
    let boltClicked = false;
    let magUnseated = false;
    let switchPhase = 0;
    let switchTimer = 0;
    let magCheckTimer = 0;
    let jamClearTimer = 0;
    let recoilElbowKick = 0;
    let recoilWristPitch = 0;
    let boltBlowback = 0;

    let leftHandMode = 'GUARD';
    const leftHandTargetLocal = new THREE.Vector3();
    const leftKnuckleLocal = new THREE.Vector3();
    const leftPalmLocal = new THREE.Vector3();
    const weaponAnimPos = new THREE.Vector3();
    const weaponAnimRot = new THREE.Euler();
    let propWarheadMesh = null;

    function filterArmTrianglesOnly(root) {
        if (!root || typeof root.traverse !== 'function') return;
        root.traverse((o) => {
            if (!o.isMesh && !o.isSkinnedMesh) return;
            o.frustumCulled = false;
            o.castShadow = false;
            o.receiveShadow = false;
            o.renderOrder = 80;

            const n = o.name || '';
            if (n.includes('LOD') || n.startsWith('Armband_') || n.startsWith('Object_9.')) {
                o.visible = false;
                return;
            }

            if (!o.isSkinnedMesh || !o.skeleton || !o.geometry) {
                o.visible = false;
                return;
            }

            const bones = o.skeleton.bones;
            const isArmBone = new Uint8Array(bones.length);
            for (let i = 0; i < bones.length; i++) {
                const bn = bones[i]?.name || '';
                if ((bn.includes('Arm') || bn.includes('Hand')) && !bn.includes('Shoulder')) {
                    isArmBone[i] = 1;
                }
            }

            const srcGeom = o.geometry;
            const skinIdx = srcGeom.attributes.skinIndex;
            const skinW = srcGeom.attributes.skinWeight;
            const idxAttr = srcGeom.index;
            if (!skinIdx || !skinW || !idxAttr) {
                o.visible = false;
                return;
            }

            const vertCount = skinIdx.count;
            const armW = new Float32Array(vertCount);
            for (let v = 0; v < vertCount; v++) {
                let w = 0;
                const j0 = skinIdx.getX(v);
                const j1 = skinIdx.getY(v);
                const j2 = skinIdx.getZ(v);
                const j3 = skinIdx.getW(v);
                if (isArmBone[j0]) w += skinW.getX(v);
                if (isArmBone[j1]) w += skinW.getY(v);
                if (isArmBone[j2]) w += skinW.getZ(v);
                if (isArmBone[j3]) w += skinW.getW(v);
                armW[v] = w;
            }

            const keptIndices = [];
            const triCount = idxAttr.count;
            for (let i = 0; i < triCount; i += 3) {
                const a = idxAttr.getX(i);
                const b = idxAttr.getX(i + 1);
                const c = idxAttr.getX(i + 2);
                if (armW[a] >= 0.35 && armW[b] >= 0.35 && armW[c] >= 0.35) {
                    keptIndices.push(a, b, c);
                }
            }

            if (keptIndices.length === 0) {
                o.visible = false;
                return;
            }

            const clonedGeom = srcGeom.clone();
            clonedGeom.setIndex(keptIndices);

            let rHandIdx = -1;
            let rIdx2 = -1;
            let rIdx3 = -1;
            let rMid1 = -1;
            for (let i = 0; i < bones.length; i++) {
                const bn = bones[i]?.name || '';
                if (bn.includes('RightHand_')) rHandIdx = i;
                else if (bn.includes('RightHandIndex2')) rIdx2 = i;
                else if (bn.includes('RightHandIndex3')) rIdx3 = i;
                else if (bn.includes('RightHandMiddle1')) rMid1 = i;
            }

            const posAttr = clonedGeom.attributes.position;
            const boneInverses = o.skeleton.boneInverses;
            if (rHandIdx >= 0 && rIdx2 >= 0 && rIdx3 >= 0 && rMid1 >= 0 && posAttr && boneInverses && boneInverses[rHandIdx]) {
                const cSkinIdx = clonedGeom.attributes.skinIndex.clone();
                const cSkinW = clonedGeom.attributes.skinWeight.clone();
                const ibmR = boneInverses[rHandIdx];
                for (let v = 0; v < vertCount; v++) {
                    const j0 = cSkinIdx.getX(v);
                    const j1 = cSkinIdx.getY(v);
                    const b0 = bones[j0]?.name || '';
                    const b1 = bones[j1]?.name || '';
                    if (!b0.includes('RightHand') && !b1.includes('RightHand')) continue;
                    if (b0.includes('Thumb') || b1.includes('Thumb')) continue;
                    _v1.fromBufferAttribute(posAttr, v).applyMatrix4(ibmR);
                    if (_v1.x < 2.4 && _v1.y > 12.0) {
                        if (_v1.y <= 18.8) {
                            const t = Math.min(1, Math.max(0, (_v1.y - 12.0) / 3.2));
                            cSkinIdx.setXYZW(v, rIdx2, rHandIdx, 0, 0);
                            cSkinW.setXYZW(v, t, 1 - t, 0, 0);
                        } else {
                            const t = Math.min(1, Math.max(0, (_v1.y - 18.8) / 2.8));
                            cSkinIdx.setXYZW(v, rIdx3, rIdx2, 0, 0);
                            cSkinW.setXYZW(v, t, 1 - t, 0, 0);
                        }
                    }
                }
                clonedGeom.setAttribute('skinIndex', cSkinIdx);
                clonedGeom.setAttribute('skinWeight', cSkinW);
            }

            o.geometry = clonedGeom;
            o.visible = true;
        });
    }

    function buildArmsFromModel(modelKey) {
        let inst = null;
        if (engine.assets && typeof engine.assets.instantiateSkinned === 'function') {
            inst = engine.assets.instantiateSkinned(modelKey, 1.02);
        } else if (typeof engine.instantiateSkinnedModel === 'function') {
            inst = engine.instantiateSkinnedModel(modelKey, 1.02);
        }
        const root = inst && inst.model ? inst.model : inst;
        if (!root || typeof root.traverse !== 'function') return null;
        filterArmTrianglesOnly(root);
        return root;
    }

    function ensurePropWarhead() {
        if (propWarheadMesh) return;
        const wState = engine.weaponStates['rpg7'];
        if (!wState || !wState.meshGroup) return;
        const g = new THREE.Group();
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(0.044, 0.22, 12),
            new THREE.MeshStandardMaterial({ color: 0x4b5738, roughness: 0.62, metalness: 0.28 })
        );
        cone.rotation.x = -Math.PI * 0.5;
        const body = new THREE.Mesh(
            new THREE.ConeGeometry(0.044, 0.14, 12),
            new THREE.MeshStandardMaterial({ color: 0x434f32, roughness: 0.65, metalness: 0.25 })
        );
        body.rotation.x = Math.PI * 0.5;
        body.position.z = 0.18;
        const tail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.016, 0.016, 0.26, 8),
            new THREE.MeshStandardMaterial({ color: 0x3b442c, roughness: 0.7, metalness: 0.25 })
        );
        tail.rotation.x = Math.PI * 0.5;
        tail.position.z = 0.32;
        g.add(cone);
        g.add(body);
        g.add(tail);
        g.visible = false;
        wState.meshGroup.add(g);
        propWarheadMesh = g;
    }

    function initArms() {
        const faction = engine.playerFaction || 'RU';
        if (armsReady && builtFaction === faction) return;

        if (armGroup && armGroup.parent) {
            armGroup.parent.remove(armGroup);
        }

        const modelKey = faction === 'RU' ? 'soldier_ru' : 'soldier_ua';
        armModel = buildArmsFromModel(modelKey);
        if (!armModel) return;

        armGroup = new THREE.Group();
        armGroup.name = 'fp_arms_rig';
        armModel.rotation.y = Math.PI;
        armModel.position.set(0, 0, 0);
        armGroup.add(armModel);

        shoulderR = null; elbowR = null; wristR = null;
        shoulderL = null; elbowL = null; wristL = null;
        const isFinger = (n) => n.includes('Index') || n.includes('Thumb') || n.includes('Middle') || n.includes('Ring') || n.includes('Pinky');

        armModel.traverse((o) => {
            if (!o.isBone) return;
            const n = o.name || '';
            if (n.includes('RightArm') && !n.includes('Fore') && !shoulderR) shoulderR = o;
            else if (n.includes('RightForeArm') && !elbowR) elbowR = o;
            else if (n.includes('RightHand') && !isFinger(n) && !wristR) wristR = o;
            else if (n.includes('LeftArm') && !n.includes('Fore') && !shoulderL) shoulderL = o;
            else if (n.includes('LeftForeArm') && !elbowL) elbowL = o;
            else if (n.includes('LeftHand') && !isFinger(n) && !wristL) wristL = o;
        });

        armGroup.updateMatrixWorld(true);
        if (shoulderR && shoulderL) {
            shoulderR.getWorldPosition(_v1);
            shoulderL.getWorldPosition(_v2);
            armGroup.worldToLocal(_v1);
            armGroup.worldToLocal(_v2);
            _v3.addVectors(_v1, _v2).multiplyScalar(0.5);
            armModel.position.sub(_v3);
            armGroup.updateMatrixWorld(true);
        }

        engine.camera.add(armGroup);
        armGroup.position.set(0.015, -0.21, -0.04);

        if (shoulderR && elbowR && wristR) {
            restUpperR.copy(shoulderR.quaternion);
            restLowerR.copy(elbowR.quaternion);
            restHandR.copy(wristR.quaternion);
            storeFingerRestQuats(wristR);
        }
        if (shoulderL && elbowL && wristL) {
            restUpperL.copy(shoulderL.quaternion);
            restLowerL.copy(elbowL.quaternion);
            restHandL.copy(wristL.quaternion);
            storeFingerRestQuats(wristL);
        }

        ensurePropWarhead();

        builtFaction = faction;
        armsReady = Boolean(shoulderR && elbowR && wristR);
    }

    function updateDeadzone(dt) {
        if (!engine.isStarted) return;
        const limit = engine.isAiming ? DEADZONE_ADS_RAD : DEADZONE_RAD;
        deadzoneYaw = Math.max(-limit, Math.min(limit, deadzoneYaw));
        deadzonePitch = Math.max(-limit, Math.min(limit, deadzonePitch));
        const decay = Math.exp(-DEADZONE_RETURN * dt);
        deadzoneYaw *= decay;
        deadzonePitch *= decay;
        recoilElbowKick *= Math.exp(-14.0 * dt);
        recoilWristPitch *= Math.exp(-16.0 * dt);
        boltBlowback *= Math.exp(-28.0 * dt);
    }

    function consumeLookDelta(yawDelta, pitchDelta) {
        const limit = engine.isAiming ? DEADZONE_ADS_RAD : DEADZONE_RAD;
        const nextYaw = deadzoneYaw + yawDelta * 0.48;
        const nextPitch = deadzonePitch + pitchDelta * 0.48;
        deadzoneYaw = Math.max(-limit, Math.min(limit, nextYaw));
        deadzonePitch = Math.max(-limit, Math.min(limit, nextPitch));
        const bodyShare = engine.isAiming ? 0.94 : 0.78;
        const overflowYaw = nextYaw - deadzoneYaw;
        const overflowPitch = nextPitch - deadzonePitch;
        return {
            bodyYaw: yawDelta * bodyShare + overflowYaw,
            bodyPitch: pitchDelta * bodyShare + overflowPitch
        };
    }

    function resetWeaponSubParts(wState) {
        if (!wState) return;
        if (wState.magPivot && wState.magRestPos) {
            wState.magPivot.position.copy(wState.magRestPos);
            wState.magPivot.rotation.set(0, 0, 0);
            wState.magPivot.visible = true;
        }
        if (wState.boltPivot && wState.boltRestPos) {
            wState.boltPivot.position.copy(wState.boltRestPos);
            wState.boltPivot.position.z += boltBlowback * 0.055;
            wState.boltPivot.rotation.set(0, 0, 0);
        }
    }

    function updateReloadAndHandling(dt) {
        const key = engine.loadoutKeys[engine.currentWeaponIdx];
        const wState = engine.weaponStates[key];
        const sock = WEAPON_SOCKETS[key] || WEAPON_SOCKETS.ak12;

        weaponAnimPos.set(0, 0, 0);
        weaponAnimRot.set(0, 0, 0);
        leftHandMode = 'GUARD';
        leftHandTargetLocal.fromArray(sock.handguard);
        leftKnuckleLocal.fromArray(sock.guardDir);
        leftPalmLocal.fromArray(sock.palmL);

        if (propWarheadMesh) propWarheadMesh.visible = false;
        resetWeaponSubParts(wState);

        const breath = Math.sin(engine.time * 2.1);
        const breath2 = Math.cos(engine.time * 1.35);
        const idleScale = 1.0 - aimBlend * 0.75;
        weaponAnimPos.y += breath * 0.0025 * idleScale;
        weaponAnimPos.x += breath2 * 0.0016 * idleScale;
        weaponAnimRot.z += breath2 * 0.005 * idleScale;

        const targetSprint = (engine.isSprinting && !engine.isAiming && !(wState && wState.reloading) && magCheckTimer <= 0 && jamClearTimer <= 0 && switchPhase === 0) ? 1.0 : 0.0;
        sprintBlend += (targetSprint - sprintBlend) * Math.min(1.0, dt * 8.5);
        if (sprintBlend > 0.001) {
            const swing = Math.sin(engine.bobTimer);
            weaponAnimPos.x -= 0.042 * sprintBlend + swing * 0.016 * sprintBlend;
            weaponAnimPos.y -= 0.028 * sprintBlend + Math.abs(swing) * 0.014 * sprintBlend;
            weaponAnimPos.z += 0.022 * sprintBlend;
            weaponAnimRot.x += 0.22 * sprintBlend;
            weaponAnimRot.y += 0.38 * sprintBlend + swing * 0.05 * sprintBlend;
            weaponAnimRot.z -= 0.16 * sprintBlend;
        }

        if (jamClearTimer > 0) {
            jamClearTimer = Math.max(0, jamClearTimer - dt);
            const p = 1.0 - jamClearTimer / 0.65;
            const rack = Math.sin(p * Math.PI);
            weaponAnimRot.z -= rack * 0.32;
            weaponAnimRot.x += rack * 0.12;
            weaponAnimPos.z += rack * 0.032;
            leftHandMode = 'BOLT';
            const pullZ = p > 0.3 && p < 0.75 ? Math.sin(((p - 0.3) / 0.45) * Math.PI) * 0.062 : 0;
            if (wState && wState.boltPivot && wState.boltRestPos) {
                wState.boltPivot.position.z = wState.boltRestPos.z + pullZ;
            }
            leftHandTargetLocal.set(
                sock.boltGrab[0] * rack + sock.handguard[0] * (1 - rack),
                sock.boltGrab[1] * rack + sock.handguard[1] * (1 - rack),
                (sock.boltGrab[2] + pullZ) * rack + sock.handguard[2] * (1 - rack)
            );
            leftKnuckleLocal.set(
                sock.guardDir[0] + (0.65 - sock.guardDir[0]) * rack,
                sock.guardDir[1] + (-0.25 - sock.guardDir[1]) * rack,
                sock.guardDir[2] + (-0.72 - sock.guardDir[2]) * rack
            ).normalize();
            leftPalmLocal.set(
                sock.palmL[0] + (0.35 - sock.palmL[0]) * rack,
                sock.palmL[1] + (-0.75 - sock.palmL[1]) * rack,
                sock.palmL[2] + (0.55 - sock.palmL[2]) * rack
            ).normalize();
            return;
        }

        if (magCheckTimer > 0) {
            magCheckTimer = Math.max(0, magCheckTimer - dt);
            const p = 1.0 - magCheckTimer / 1.05;
            const env = Math.sin(p * Math.PI);
            weaponAnimRot.z += env * 0.38;
            weaponAnimRot.x += env * 0.16;
            weaponAnimPos.y += env * 0.024;
            weaponAnimPos.x -= env * 0.016;

            const pull = p > 0.22 && p < 0.78 ? Math.sin(((p - 0.22) / 0.56) * Math.PI) : 0;
            if (wState && wState.magPivot && wState.magRestPos) {
                wState.magPivot.position.set(
                    wState.magRestPos.x,
                    wState.magRestPos.y - pull * 0.042,
                    wState.magRestPos.z + pull * 0.010
                );
                wState.magPivot.rotation.x = -pull * 0.20;
            }
            leftHandMode = 'MAG';
            leftHandTargetLocal.set(
                sock.magGrab[0] * env + sock.handguard[0] * (1 - env),
                (sock.magGrab[1] - pull * 0.042) * env + sock.handguard[1] * (1 - env),
                (sock.magGrab[2] + pull * 0.010) * env + sock.handguard[2] * (1 - env)
            );
            leftKnuckleLocal.set(
                sock.guardDir[0] + (0.78 - sock.guardDir[0]) * env,
                sock.guardDir[1] + (-0.12 - sock.guardDir[1]) * env,
                sock.guardDir[2] + (-0.61 - sock.guardDir[2]) * env
            ).normalize();
            leftPalmLocal.set(
                sock.palmL[0] + (0.55 - sock.palmL[0]) * env,
                sock.palmL[1] + (0.20 - sock.palmL[1]) * env,
                sock.palmL[2] + (0.80 - sock.palmL[2]) * env
            ).normalize();
            return;
        }

        if (!wState || !wState.reloading) {
            reloadPhase = 0;
            reloadTimer = 0;
            boltClicked = false;
            magUnseated = false;
            return;
        }

        if (reloadPhase === 0) {
            reloadPhase = wState.reloadState === 'DRY_RELOAD' ? 2 : 1;
            reloadTotal = Math.max(0.1, wState.reloadTotal);
            reloadTimer = 0;
            boltClicked = false;
            magUnseated = false;
        }

        reloadTimer += dt;
        const p = Math.min(1, reloadTimer / reloadTotal);

        if (key === 'rpg7') {
            const env = Math.sin(p * Math.PI);
            weaponAnimRot.x -= env * 0.22;
            weaponAnimRot.z += env * 0.18;
            weaponAnimPos.y -= env * 0.038;
            leftHandMode = 'MAG';
            if (p < 0.25) {
                const k = p / 0.25;
                leftHandTargetLocal.set(
                    sock.handguard[0] - 0.04 * k,
                    sock.handguard[1] - 0.16 * k,
                    sock.handguard[2] - 0.10 * k
                );
            } else if (p < 0.82) {
                const k = (p - 0.25) / 0.57;
                const ease = k * k * (3 - 2 * k);
                const warheadZ = -0.58 + ease * 0.22;
                if (propWarheadMesh) {
                    propWarheadMesh.visible = true;
                    propWarheadMesh.position.set(0.112, 0.095, warheadZ);
                }
                leftHandTargetLocal.set(0.112, 0.072, warheadZ + 0.05);
                leftKnuckleLocal.set(0.70, -0.15, -0.69).normalize();
                leftPalmLocal.set(0.45, 0.82, 0.35).normalize();
                if (k > 0.78 && !boltClicked) {
                    boltClicked = true;
                    engine.sound?.playReloadClick?.(620);
                    engine.posSpring?.applyImpulse?.(0, -0.35, 0.55);
                }
            } else {
                const k = (p - 0.82) / 0.18;
                const ease = k * k * (3 - 2 * k);
                leftHandTargetLocal.set(
                    0.112,
                    0.072 * (1 - ease) + sock.handguard[1] * ease,
                    -0.30 * (1 - ease) + sock.handguard[2] * ease
                );
            }
            return;
        }

        const magSwapEnd = reloadPhase === 2 ? 0.66 : 1.0;

        if (p < magSwapEnd) {
            const sub = p / magSwapEnd;
            const env = Math.sin(sub * Math.PI);
            weaponAnimRot.z -= env * 0.24;
            weaponAnimRot.x += env * 0.22;
            weaponAnimRot.y += env * 0.10;
            weaponAnimPos.y += env * 0.046;
            weaponAnimPos.x -= env * 0.024;
            weaponAnimPos.z -= env * 0.018;

            leftHandMode = 'MAG';
            let magDropY = 0;
            let magShiftZ = 0;
            let magTiltX = 0;
            let handBlend = 1.0;

            if (sub < 0.20) {
                const k = sub / 0.20;
                handBlend = k * k * (3 - 2 * k);
            } else if (sub < 0.50) {
                const k = (sub - 0.20) / 0.30;
                const ease = Math.sin(k * Math.PI * 0.5);
                magDropY = -0.115 * ease;
                magShiftZ = -0.028 * Math.sin(k * Math.PI);
                magTiltX = 0.32 * ease;
                if (k > 0.15 && !magUnseated) {
                    magUnseated = true;
                    engine.sound?.playReloadClick?.(510);
                    engine.posSpring?.applyImpulse?.(0.15, -0.55, 0.25);
                }
            } else if (sub < 0.82) {
                const k = (sub - 0.50) / 0.32;
                const rem = 1.0 - k * k * (3 - 2 * k);
                magDropY = -0.115 * rem;
                magShiftZ = -0.024 * Math.sin(rem * Math.PI);
                magTiltX = 0.28 * rem;
                if (k > 0.78 && !boltClicked && reloadPhase === 1) {
                    boltClicked = true;
                    engine.sound?.playReloadClick?.(640);
                    engine.posSpring?.applyImpulse?.(-0.15, 0.65, -0.30);
                }
            } else {
                const k = (sub - 0.82) / 0.18;
                handBlend = 1.0 - k * k * (3 - 2 * k);
            }

            if (wState.magPivot && wState.magRestPos) {
                wState.magPivot.position.set(
                    wState.magRestPos.x,
                    wState.magRestPos.y + magDropY,
                    wState.magRestPos.z + magShiftZ
                );
                wState.magPivot.rotation.set(magTiltX, 0, 0);
            }

            const magTargetX = sock.magGrab[0];
            const magTargetY = sock.magGrab[1] + magDropY;
            const magTargetZ = sock.magGrab[2] + magShiftZ;

            leftHandTargetLocal.set(
                sock.handguard[0] + (magTargetX - sock.handguard[0]) * handBlend,
                sock.handguard[1] + (magTargetY - sock.handguard[1]) * handBlend,
                sock.handguard[2] + (magTargetZ - sock.handguard[2]) * handBlend
            );
            leftKnuckleLocal.set(
                sock.guardDir[0] + (0.38 - sock.guardDir[0]) * handBlend,
                sock.guardDir[1] + (-0.08 - sock.guardDir[1]) * handBlend,
                sock.guardDir[2] + (-0.92 - sock.guardDir[2]) * handBlend
            ).normalize();
            leftPalmLocal.set(
                sock.palmL[0] + (0.78 - sock.palmL[0]) * handBlend,
                sock.palmL[1] + (0.58 - sock.palmL[1]) * handBlend,
                sock.palmL[2] + (0.22 - sock.palmL[2]) * handBlend
            ).normalize();
        } else {
            const boltP = (p - magSwapEnd) / (1.0 - magSwapEnd);
            const env = Math.sin(boltP * Math.PI);
            weaponAnimRot.z += env * 0.34;
            weaponAnimRot.x += env * 0.10;
            weaponAnimPos.z += env * 0.024;
            weaponAnimPos.y -= env * 0.016;
            weaponAnimPos.x -= env * 0.022;

            leftHandMode = 'BOLT';
            const pull = boltP > 0.20 && boltP < 0.78 ? Math.sin(((boltP - 0.20) / 0.58) * Math.PI) : 0;
            const pullZ = pull * 0.065;

            if (wState.boltPivot && wState.boltRestPos) {
                wState.boltPivot.position.z = wState.boltRestPos.z + pullZ;
            }
            if (boltP > 0.52 && !boltClicked) {
                boltClicked = true;
                engine.sound?.playReloadClick?.(710);
                engine.posSpring?.applyImpulse?.(0.18, -0.45, 0.75);
                engine.rotSpring?.applyImpulse?.(0.9, -0.3, -0.8);
            }

            leftHandTargetLocal.set(
                sock.handguard[0] + ((sock.boltGrab[0] + 0.012) - sock.handguard[0]) * env,
                sock.handguard[1] + ((sock.boltGrab[1] - 0.022) - sock.handguard[1]) * env,
                sock.handguard[2] + ((sock.boltGrab[2] + pullZ) - sock.handguard[2]) * env
            );
            leftKnuckleLocal.set(
                sock.guardDir[0] + (0.35 - sock.guardDir[0]) * env,
                sock.guardDir[1] + (0.12 - sock.guardDir[1]) * env,
                sock.guardDir[2] + (-0.92 - sock.guardDir[2]) * env
            ).normalize();
            leftPalmLocal.set(
                sock.palmL[0] + (-0.25 - sock.palmL[0]) * env,
                sock.palmL[1] + (0.94 - sock.palmL[1]) * env,
                sock.palmL[2] + (0.22 - sock.palmL[2]) * env
            ).normalize();
        }
    }

    function updateWeaponSwitch(dt) {
        if (switchPhase === 0) return;
        switchTimer += dt;
        const total = 0.42;
        const progress = Math.min(1, switchTimer / total);

        if (progress < 0.5) {
            const down = Math.sin(progress * Math.PI);
            weaponAnimPos.y -= down * 0.18;
            weaponAnimRot.x -= down * 0.32;
            weaponAnimRot.z += down * 0.16;
        } else {
            const up = Math.sin((progress - 0.5) * Math.PI);
            weaponAnimPos.y -= (1 - up) * 0.12;
            weaponAnimRot.x -= (1 - up) * 0.18;
        }

        if (progress >= 1.0) {
            switchPhase = 0;
            switchTimer = 0;
        }
    }

    function updateIK() {
        if (!armsReady) initArms();
        if (!armsReady || !shoulderR || !elbowR || !wristR) return;

        const key = engine.loadoutKeys[engine.currentWeaponIdx];
        const wState = engine.weaponStates[key];
        if (!wState || !wState.meshGroup) return;

        const sock = WEAPON_SOCKETS[key] || WEAPON_SOCKETS.ak12;

        const s = aimBlend * aimBlend * (3.0 - 2.0 * aimBlend);
        armGroup.position.set(
            0.088 * (1 - s) + 0.005 * s,
            -0.275 * (1 - s) - 0.255 * s,
            -0.225 * (1 - s) - 0.165 * s
        );
        armGroup.rotation.set(0, -0.44 * (1 - s * 0.35), 0);

        shoulderR.quaternion.copy(restUpperR);
        elbowR.quaternion.copy(restLowerR);
        wristR.quaternion.copy(restHandR);
        if (shoulderL && elbowL && wristL) {
            shoulderL.quaternion.copy(restUpperL);
            elbowL.quaternion.copy(restLowerL);
            wristL.quaternion.copy(restHandL);
        }
        armGroup.updateWorldMatrix(true, true);
        wState.meshGroup.updateWorldMatrix(true, false);

        _gripWorld.set(
            sock.grip[0],
            sock.grip[1] - recoilWristPitch * 0.014,
            sock.grip[2] + recoilElbowKick * 0.022
        ).applyMatrix4(wState.meshGroup.matrixWorld);

        _knuckleDirR.set(
            sock.gripDir[0],
            sock.gripDir[1] + recoilWristPitch * 0.12,
            sock.gripDir[2]
        ).transformDirection(wState.meshGroup.matrixWorld).normalize();

        _palmWorldR.set(sock.palmR[0], sock.palmR[1], sock.palmR[2])
            .transformDirection(wState.meshGroup.matrixWorld).normalize();

        _wristTgt.copy(_gripWorld)
            .addScaledVector(_knuckleDirR, -0.064)
            .addScaledVector(_palmWorldR, -0.024);

        _poleR.set(0.26, -0.46 - recoilElbowKick * 0.10, 0.02)
            .applyQuaternion(engine.camera.quaternion);
        solveTwoBoneIK(shoulderR, elbowR, wristR, _wristTgt, _poleR);
        orientHandBasis(wristR, _knuckleDirR, _palmWorldR);
        curlFingers(wristR, 1.25, false, key === 'rpg7', Math.min(1, recoilWristPitch * 2.5));

        if (shoulderL && elbowL && wristL) {
            _guardWorld.copy(leftHandTargetLocal)
                .applyMatrix4(wState.meshGroup.matrixWorld);

            _knuckleDirL.copy(leftKnuckleLocal)
                .transformDirection(wState.meshGroup.matrixWorld).normalize();

            _palmWorldL.copy(leftPalmLocal)
                .transformDirection(wState.meshGroup.matrixWorld).normalize();

            _wristTgt.copy(_guardWorld)
                .addScaledVector(_knuckleDirL, -0.060)
                .addScaledVector(_palmWorldL, -0.025);

            _poleL.set(-0.28, -0.46 - recoilElbowKick * 0.08, -0.04)
                .applyQuaternion(engine.camera.quaternion);
            solveTwoBoneIK(shoulderL, elbowL, wristL, _wristTgt, _poleL);
            orientHandBasis(wristL, _knuckleDirL, _palmWorldL);

            const leftCurl = leftHandMode === 'BOLT' ? 0.95 : (leftHandMode === 'MAG' ? 1.15 : (key === 'rpg7' ? 1.25 : 1.20));
            curlFingers(wristL, leftCurl, true, key === 'rpg7', 0);
        }
    }

    function updateAimFov(dt) {
        const key = engine.loadoutKeys[engine.currentWeaponIdx];
        const targetBlend = (engine.isAiming && !engine.weaponStates[key]?.reloading && switchPhase === 0) ? 1.0 : 0.0;
        aimBlend += (targetBlend - aimBlend) * Math.min(1.0, dt * 9.5);
        const smoothAim = aimBlend * aimBlend * (3.0 - 2.0 * aimBlend);

        const fovMult = SIGHT_FOV_MULT[key] || 0.88;
        const targetFov = engine.baseFov * (1.0 + (fovMult - 1.0) * smoothAim);
        if (Math.abs(engine.camera.fov - targetFov) > 0.01) {
            engine.camera.fov = targetFov;
            engine.camera.updateProjectionMatrix();
        }
    }

    const mod = {
        name: 'arms',

        install() {
            engine.events.on('game:started', () => {
                initArms();
            });

            engine.events.on('shot', (ev) => {
                if (!ev || !ev.isPlayer) return;
                const key = engine.loadoutKeys[engine.currentWeaponIdx];
                const wStat = STATS.WEAPONS[key];
                if (!wStat) return;
                const adsMult = engine.isAiming ? 0.55 : 1.0;
                recoilElbowKick = Math.min(1.0, recoilElbowKick + wStat.recoilKickBack * 12.0 * adsMult);
                recoilWristPitch = Math.min(1.0, recoilWristPitch + wStat.recoilPitch * 8.0 * adsMult);
                boltBlowback = 1.0;
            });
        },

        onStart() {
            initArms();
        },

        update(dt) {
            if (engine.fpvMode && engine.fpvMode.active) {
                if (armGroup) armGroup.visible = false;
                return;
            }
            if (engine.playerVehicleState && engine.playerVehicleState.vehicle && engine.playerVehicleState.role === 'DRIVER') {
                if (armGroup) armGroup.visible = false;
                return;
            }
            if (armGroup) armGroup.visible = true;

            updateDeadzone(dt);
            updateReloadAndHandling(dt);
            updateWeaponSwitch(dt);

            engine.viewmodelRoot.position.add(weaponAnimPos);
            engine.viewmodelRoot.rotation.x += weaponAnimRot.x + deadzonePitch;
            engine.viewmodelRoot.rotation.y += weaponAnimRot.y + deadzoneYaw;
            engine.viewmodelRoot.rotation.z += weaponAnimRot.z;
            engine.viewmodelRoot.updateMatrixWorld(true);

            updateIK();
            updateAimFov(dt);
        },

        getAimRay(outOrigin, outDir) {
            engine.camera.getWorldPosition(outOrigin);
            outDir.set(0, 0, -1).applyQuaternion(engine.camera.quaternion);
            const pitchOff = deadzonePitch + engine.rotSpring.position.x * 0.35;
            const yawOff = deadzoneYaw + engine.rotSpring.position.y * 0.35;
            if (Math.abs(yawOff) > 1e-4 || Math.abs(pitchOff) > 1e-4) {
                _eul.set(pitchOff, yawOff, 0, 'YXZ');
                _q2.setFromEuler(_eul);
                outDir.applyQuaternion(_q2);
            }
            outDir.normalize();
        },

        applyMouseDeadzone(dx, dy) {
            const sens = (engine.isAiming ? 0.0013 * engine.settings.get('adsSensitivity') : 0.0021) * engine.settings.get('mouseSensitivity');
            return consumeLookDelta(-dx * sens, -dy * sens);
        },

        triggerSwitch() {
            switchPhase = 1;
            switchTimer = 0;
        },

        triggerMagCheck() {
            magCheckTimer = 1.05;
        },

        triggerJamClear() {
            jamClearTimer = 0.65;
        },

        get deadzoneYaw() { return deadzoneYaw; },
        get deadzonePitch() { return deadzonePitch; },
        get aimBlend() { return aimBlend; }
    };

    return mod;
}
