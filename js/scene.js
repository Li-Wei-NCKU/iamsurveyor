/**
 * 3D Surveyor World Scene (Three.js)
 * Manages procedural terrain, survey benchmarks, instruments, targets, and UAV models.
 */
class SurveyScene {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.interactiveObjects = [];
        this.droneModel = null;
        this.propellers = [];
        this.levelStaffs = [];
        this.gcpMarkers = [];
        this.benchmarks = [];
        this.tripods = [];
        this.trees = [];
        this.floatingArrows = [];
        this.dynamicArrows = [];
        this.animTime = 0;

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.container.appendChild(this.renderer.domElement);

        // Sky & Fog
        this.scene.background = new THREE.Color(0x87ceeb);
        this.scene.fog = new THREE.FogExp2(0xcce0ff, 0.008);

        this.setupLighting();
        this.buildTerrain();
        this.buildEnvironmentProps();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfffaed, 1.2);
        sunLight.position.set(45, 80, 40);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 250;
        const d = 50;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        this.scene.add(sunLight);

        // Hemisphere light for natural ground reflection
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3d5e3a, 0.4);
        this.scene.add(hemiLight);
    }

    buildTerrain() {
        // High-res textured ground plane
        const terrainGeo = new THREE.PlaneGeometry(300, 300, 64, 64);
        terrainGeo.rotateX(-Math.PI / 2);

        // Flat central surveying working zone (within 55m of origin) to prevent instrument clipping
        const pos = terrainGeo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            if (Math.abs(x) < 55 && Math.abs(z) < 55) {
                // Keep all operational survey stations strictly flat at y = 0
                pos.setY(i, 0);
            } else {
                const y = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 1.5 + Math.sin(x * 0.02) * 2;
                pos.setY(i, y);
            }
        }
        terrainGeo.computeVertexNormals();

        // Create canvas texture for grass & dirt paths
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#4a7c36';
        ctx.fillRect(0, 0, 512, 512);
        // Noise & speckles
        for (let i = 0; i < 4000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#3d672d' : '#5b9144';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
        }
        // Soil / gravel patches
        ctx.fillStyle = 'rgba(140, 110, 75, 0.3)';
        ctx.beginPath();
        ctx.arc(256, 256, 120, 0, Math.PI * 2);
        ctx.fill();

        const groundTex = new THREE.CanvasTexture(canvas);
        groundTex.wrapS = THREE.RepeatWrapping;
        groundTex.wrapT = THREE.RepeatWrapping;
        groundTex.repeat.set(16, 16);

        const groundMat = new THREE.MeshStandardMaterial({
            map: groundTex,
            roughness: 0.85,
            metalness: 0.1
        });

        const ground = new THREE.Mesh(terrainGeo, groundMat);
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    buildEnvironmentProps() {
        // Survey monuments / control points
        this.createMonument(0, 0, 0, "CKSV (一等衛星控制點)");
        this.createMonument(10, 0, -10, "BM-01 (水準起點)");
        this.createMonument(22, 0, -28, "BM-02 (水準轉折點)");

        // Prominent reference landmark trees near GCP-01 (-10, -12) for field photography context
        this.createTree(-18, -20);
        this.createTree(-5, -23);
        this.createTree(-22, -10);

        // Surrounding trees and rocks
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 22 + Math.random() * 60;
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            this.createTree(x, z);
        }
    }

    createTree(x, z) {
        const group = new THREE.Group();
        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 2.5, 6);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25;
        trunk.castShadow = true;
        group.add(trunk);

        // Foliage
        const foliageGeo = new THREE.ConeGeometry(1.5, 3.5, 7);
        const foliageMat = new THREE.MeshStandardMaterial({ color: 0x2e6f40, roughness: 0.8 });
        const foliage = new THREE.Mesh(foliageGeo, foliageMat);
        foliage.position.y = 3.6;
        foliage.castShadow = true;
        group.add(foliage);

        group.position.set(x, 0, z);
        group.scale.setScalar(0.8 + Math.random() * 0.5);
        this.scene.add(group);
        this.trees.push(group);
        return group;
    }

    createMonument(x, y, z, labelText) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // Standard Permanent Concrete Benchmark Pillar (0.5 x 0.25 x 0.5m)
        const baseGeo = new THREE.BoxGeometry(0.5, 0.25, 0.5);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.125;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);

        // Brass survey pin/cross marker on top of monument
        const pinGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16);
        const pinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
        const pin = new THREE.Mesh(pinGeo, pinMat);
        pin.position.y = 0.26;
        group.add(pin);

        group.userData = {
            type: 'monument',
            label: labelText,
            name: labelText,
            x: x, y: y, z: z
        };

        this.scene.add(group);
        this.interactiveObjects.push(group);
        this.benchmarks.push(group);

        // Permanent floating arrow for control point visibility
        this.createFloatingHintArrow(x, z, labelText, 0xf59e0b, false);

        return group;
    }

    /**
     * Creates an active 2.4m ground setup zone ONLY at the specific station the player currently needs to go to.
     * @param {number} x X coordinate
     * @param {number} z Z coordinate
     * @param {string} labelText Station label
     * @param {boolean} isTemporaryStation If true (like Level 2 Auto-Level station), no concrete monument is built
     */
    createStationSetupZone(x, z, labelText, isTemporaryStation = false) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // 1. Large High-Visibility Ground Setup Platform (2.4m Station Zone)
        const padGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.03, 32);
        const padMat = new THREE.MeshStandardMaterial({ 
            color: 0x1e293b, 
            roughness: 0.6,
            metalness: 0.2
        });
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.y = 0.015;
        pad.receiveShadow = true;
        group.add(pad);

        // Yellow/Black hazard striped station boundary ring
        const borderGeo = new THREE.RingGeometry(1.14, 1.22, 32);
        borderGeo.rotateX(-Math.PI / 2);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.y = 0.032;
        group.add(border);

        // Tripod stance positioning guide circles on ground (3 yellow dots)
        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3;
            const dotGeo = new THREE.CircleGeometry(0.12, 16);
            dotGeo.rotateX(-Math.PI / 2);
            const dotMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide });
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.set(Math.cos(angle) * 0.65, 0.035, Math.sin(angle) * 0.65);
            group.add(dot);
        }

        // If this is a temporary station (like Leveling setup point), place only a ground station peg/cross (no concrete monument)
        if (isTemporaryStation) {
            const pegGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12);
            const pegMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8 });
            const peg = new THREE.Mesh(pegGeo, pegMat);
            peg.position.y = 0.04;
            group.add(peg);

            // Dynamic floating arrow for temporary station
            this.createFloatingHintArrow(x, z, labelText, 0x06b6d4, true);
        }

        group.userData = {
            type: 'monument',
            label: labelText,
            name: labelText,
            isTemporary: isTemporaryStation,
            x: x, y: 0, z: z
        };

        this.scene.add(group);
        this.interactiveObjects.push(group);
        if (!this.stationPads) this.stationPads = [];
        this.stationPads.push(group);

        return group;
    }

    createTripodWithInstrument(x, z, instrumentType = 'gnss') {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Tripod legs (Aluminum/Wood survey yellow)
        const legMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.3 });
        const jointMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.5 });

        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3;
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 1.4, 8), legMat);
            leg.position.set(Math.cos(angle) * 0.28, 0.65, Math.sin(angle) * 0.28);
            leg.rotation.z = Math.cos(angle) * 0.25;
            leg.rotation.x = -Math.sin(angle) * 0.25;
            leg.castShadow = true;
            group.add(leg);
        }

        // Tribrach (三腳基座)
        const tribrach = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 6), jointMat);
        tribrach.position.y = 1.35;
        tribrach.castShadow = true;
        group.add(tribrach);

        // Instrument head based on type
        if (instrumentType === 'gnss') {
            // GNSS receiver antenna (White/Green UFO style)
            const antennaGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.12, 24);
            const antennaMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
            const antenna = new THREE.Mesh(antennaGeo, antennaMat);
            antenna.position.y = 1.46;
            antenna.castShadow = true;
            group.add(antenna);

            // LED Status ring
            const ledGeo = new THREE.TorusGeometry(0.14, 0.015, 8, 24);
            const ledMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
            const led = new THREE.Mesh(ledGeo, ledMat);
            led.rotation.x = Math.PI / 2;
            led.position.y = 1.46;
            group.add(led);

            // Pole extension
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 12), jointMat);
            pole.position.y = 1.4;
            group.add(pole);

        } else if (instrumentType === 'level') {
            // Optical Auto-Level (Blue/Yellow casing with telescope barrel)
            const bodyGeo = new THREE.BoxGeometry(0.12, 0.1, 0.24);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 1.44;
            group.add(body);

            // Telescope Lens
            const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 16), jointMat);
            lens.rotation.x = Math.PI / 2;
            lens.position.y = 1.44;
            group.add(lens);

        } else if (instrumentType === 'totalstation') {
            // Total Station (Topcon/Leica style with handle & LCD)
            const bodyGeo = new THREE.BoxGeometry(0.16, 0.25, 0.16);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4 });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 1.52;
            group.add(body);

            // Telescope axle
            const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.24, 16), jointMat);
            scope.rotation.x = Math.PI / 2;
            scope.position.y = 1.55;
            group.add(scope);

            // Laser EDM emitter lens
            const laserEye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 8), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
            laserEye.position.set(0, 1.55, 0.12);
            group.add(laserEye);
        }

        group.userData = {
            type: 'instrument',
            instrumentType: instrumentType,
            isLeveled: false,
            isCentered: false,
            height: 1.52
        };

        this.scene.add(group);
        this.interactiveObjects.push(group);
        this.tripods.push(group);
        return group;
    }

    createLevelStaff(x, z, height = 3.0) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // 3m Telescopic Aluminum Level Rod
        const rodGeo = new THREE.BoxGeometry(0.10, height, 0.04);

        // Generate Ultra-Sharp High-Resolution E-pattern Texture (256x2048)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 2048;
        const ctx = canvas.getContext('2d');

        // Pure white rod surface
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 256, 2048);

        // Outer borders & Center vertical lane divider
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, 256, 2048);

        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(80, 0);
        ctx.lineTo(80, 2048);
        ctx.stroke();

        const totalDm = 30; // 3.0 meters = 30 decimeters
        const pxPerDm = 2048 / totalDm; // ~68.26 px per 10cm
        const pxPerCm = pxPerDm / 10;   // ~6.83 px per 1cm

        for (let dm = 0; dm < totalDm; dm++) {
            const meterIdx = Math.floor(dm / 10);
            // 1.x meter is vivid Red, 0.x & 2.x meters are pure Black
            const themeColor = (meterIdx % 2 === 1) ? '#dc2626' : '#0f172a';

            // Decimeter baseline on canvas (Canvas Y = 0 is top / 3.0m, Canvas Y = 2048 is bottom / 0.0m)
            const dmBottomY = 2048 - (dm * pxPerDm);
            const dmTopY = dmBottomY - pxPerDm;

            // 1. Left Lane: Large Decimeter Numbers (e.g. 01, 02, ..., 14, 15, ..., 29)
            ctx.fillStyle = themeColor;
            ctx.font = 'bold 36px "Consolas", "Roboto Mono", monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const dmLabel = dm.toString().padStart(2, '0');
            ctx.fillText(dmLabel, 40, (dmTopY + dmBottomY) / 2);

            // Decimeter divider line on left lane
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, dmBottomY);
            ctx.lineTo(80, dmBottomY);
            ctx.stroke();

            // Meter badge at each meter boundary
            if (dm % 10 === 0) {
                ctx.fillStyle = '#f59e0b';
                ctx.fillRect(4, dmBottomY - 24, 28, 22);
                ctx.fillStyle = '#000000';
                ctx.font = 'bold 16px sans-serif';
                ctx.fillText(`${meterIdx}m`, 18, dmBottomY - 13);
            }

            // 2. Right Lane: Standard Precision E-Pattern (10 cm blocks)
            ctx.fillStyle = themeColor;
            for (let k = 0; k < 10; k++) {
                const cmBottomY = dmBottomY - (k * pxPerCm);
                const cmTopY = cmBottomY - pxPerCm;
                const cmH = cmBottomY - cmTopY;

                if (k === 0) {
                    ctx.fillRect(80, cmTopY, 170, cmH);
                } else if (k === 1) {
                    ctx.fillRect(80, cmTopY, 50, cmH);
                } else if (k === 2) {
                    ctx.fillRect(80, cmTopY, 120, cmH);
                } else if (k === 3) {
                    ctx.fillRect(80, cmTopY, 50, cmH);
                } else if (k === 4) {
                    ctx.fillRect(80, cmTopY, 170, cmH);
                } else if (k === 5) {
                    ctx.fillRect(80, cmTopY, 170, cmH);
                } else if (k === 6) {
                    ctx.fillRect(190, cmTopY, 60, cmH);
                } else if (k === 7) {
                    ctx.fillRect(140, cmTopY, 110, cmH);
                } else if (k === 8) {
                    ctx.fillRect(190, cmTopY, 60, cmH);
                } else if (k === 9) {
                    ctx.fillRect(80, cmTopY, 170, cmH);
                }
            }
        }

        const staffTex = new THREE.CanvasTexture(canvas);
        staffTex.generateMipmaps = true;
        staffTex.minFilter = THREE.LinearMipmapLinearFilter;
        staffTex.magFilter = THREE.LinearFilter;
        staffTex.needsUpdate = true;

        const sideMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 });
        const faceMat = new THREE.MeshStandardMaterial({ map: staffTex, roughness: 0.3 });

        // Materials: +X, -X, +Y, -Y, +Z (Front), -Z (Back)
        const staffMat = [
            sideMat,
            sideMat,
            sideMat,
            sideMat,
            faceMat, // Front Face (+Z) with high-res E-pattern
            faceMat  // Back Face (-Z) with high-res E-pattern
        ];

        const rod = new THREE.Mesh(rodGeo, staffMat);
        rod.position.y = height / 2;
        rod.castShadow = true;
        group.add(rod);

        group.userData = {
            type: 'level_staff',
            rodHeight: 1.485, // true reading value
            tiltAngle: 0.03, // small tilt needs correcting by assistant
            isBubbleCentered: false
        };

        this.scene.add(group);
        this.interactiveObjects.push(group);
        this.levelStaffs.push(group);
        return group;
    }

    createPrismTarget(x, z) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Pole
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.8, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
        pole.position.y = 0.9;
        pole.castShadow = true;
        group.add(pole);

        // Prism housing (High-vis orange target plate with circular glass prism)
        const plateGeo = new THREE.BoxGeometry(0.24, 0.24, 0.02);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xf97316 });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.y = 1.8;
        group.add(plate);

        // Glass retroreflector
        const prismGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16);
        prismGeo.rotateX(Math.PI / 2);
        const prismMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, metalness: 0.9, roughness: 0.1 });
        const prism = new THREE.Mesh(prismGeo, prismMat);
        prism.position.set(0, 1.8, 0.02);
        group.add(prism);

        group.userData = {
            type: 'prism',
            name: 'Prism-Point-01',
            height: 1.8
        };

        this.scene.add(group);
        this.interactiveObjects.push(group);

        // Floating Arrow Hint above Prism
        this.createFloatingHintArrow(x, z, "稜鏡目標點 (Prism-01)", 0x06b6d4, true);

        return group;
    }

    createGCPTarget(x, z, label = "GCP-01", customCanvas = null) {
        // Remove previous temporary setup pad at this spot if exists
        if (this.stationPads) {
            const padIdx = this.stationPads.findIndex(p => Math.hypot(p.position.x - x, p.position.z - z) < 1.0);
            if (padIdx > -1) {
                const oldPad = this.stationPads[padIdx];
                this.scene.remove(oldPad);
                const intIdx = this.interactiveObjects.indexOf(oldPad);
                if (intIdx > -1) this.interactiveObjects.splice(intIdx, 1);
                this.stationPads.splice(padIdx, 1);
            }
        }

        const group = new THREE.Group();
        group.position.set(x, 0.02, z);

        // 1.2m x 1.2m Aerial Photo Target Plane (Ground plate)
        const size = 1.2;
        const targetGeo = new THREE.PlaneGeometry(size, size);
        targetGeo.rotateX(-Math.PI / 2);

        let tex;
        if (customCanvas) {
            tex = new THREE.CanvasTexture(customCanvas);
        } else {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, 256, 256);
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 128, 128);
            ctx.fillRect(128, 128, 128, 128);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(128, 0); ctx.lineTo(128, 256);
            ctx.moveTo(0, 128); ctx.lineTo(256, 128);
            ctx.stroke();
            tex = new THREE.CanvasTexture(canvas);
        }
        tex.needsUpdate = true;

        // Painted black and white layer with 100% genuine transparency directly over the grass
        const targetMat = new THREE.MeshStandardMaterial({ 
            map: tex, 
            roughness: 0.85,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.05
        });
        const mesh = new THREE.Mesh(targetGeo, targetMat);
        mesh.receiveShadow = true;
        group.add(mesh);

        // Center steel survey nail
        const nail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 }));
        nail.position.y = 0.025;
        group.add(nail);

        // Large invisible hitbox cylinder for easy crosshair raycasting
        const hitGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.5, 16);
        const hitMat = new THREE.MeshBasicMaterial({ visible: false });
        const hitbox = new THREE.Mesh(hitGeo, hitMat);
        hitbox.position.y = 0.25;
        group.add(hitbox);

        group.userData = {
            type: 'gcp',
            label: label,
            captured: false,
            x: x, y: 0, z: z
        };

        this.scene.add(group);
        this.interactiveObjects.push(group);
        this.gcpMarkers.push(group);

        // Floating Arrow Hint above GCP
        this.createFloatingHintArrow(x, z, `航測標誌 [${label}]`, 0xef4444, true);

        return group;
    }

    createFloatingHintArrow(x, z, labelText, color = 0xf59e0b, isDynamic = false) {
        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // 1. Downward Pointing Floating 3D Cone Arrow
        const coneGeo = new THREE.ConeGeometry(0.32, 0.7, 16);
        coneGeo.rotateX(Math.PI); // Point down towards the survey pin
        const arrowMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 0.75,
            roughness: 0.2,
            metalness: 0.4
        });
        const arrow = new THREE.Mesh(coneGeo, arrowMat);
        arrow.position.y = 3.2;
        group.add(arrow);

        // Small glowing orb on top of arrow
        const orb = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        orb.position.y = 3.65;
        group.add(orb);

        // 2. High-Visibility Floating 2D Canvas Billboard Badge
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 140;
        const ctx = canvas.getContext('2d');

        // Badge backdrop
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(8, 8, 496, 124, 20);
            ctx.fill();
            ctx.lineWidth = 6;
            ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
            ctx.stroke();
        } else {
            ctx.fillRect(8, 8, 496, 124);
        }

        // Text content
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`📍 ${labelText}`, 256, 70);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({
            map: texture,
            depthTest: false,
            transparent: true
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.y = 4.4;
        sprite.scale.set(3.4, 0.95, 1);
        group.add(sprite);

        // 3. Ground Pulse Ring
        const ringGeo = new THREE.RingGeometry(0.35, 0.5, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: color,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.05;
        group.add(ring);

        // 4. Vertical Beacon Light Beam
        const beamGeo = new THREE.CylinderGeometry(0.015, 0.015, 3.2, 8);
        const beamMat = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.35
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 1.6;
        group.add(beam);

        group.userData = {
            label: labelText,
            baseY: 3.2,
            offset: Math.random() * Math.PI * 2,
            arrowMesh: arrow,
            ringMesh: ring,
            spriteMesh: sprite,
            isDynamic: isDynamic
        };

        this.scene.add(group);
        this.floatingArrows.push(group);
        if (isDynamic) {
            this.dynamicArrows.push(group);
        }
        return group;
    }

    /**
     * Controls the visibility of 3D floating markers/arrows so ONLY the points needed for the current active task are shown.
     * @param {string[]|string|null} allowedKeywords Array of point label keywords to display (e.g. ['CKSV'], ['BM-01'], ['GCP-01']), or '*' to show all, or null/[] to hide all.
     */
    setVisibleFloatingPoints(allowedKeywords) {
        if (!this.floatingArrows) return;
        if (allowedKeywords === '*' || (Array.isArray(allowedKeywords) && allowedKeywords.includes('*'))) {
            this.floatingArrows.forEach(g => g.visible = true);
            return;
        }
        if (!allowedKeywords || (Array.isArray(allowedKeywords) && allowedKeywords.length === 0)) {
            this.floatingArrows.forEach(g => g.visible = false);
            return;
        }

        const keywords = Array.isArray(allowedKeywords) ? allowedKeywords : [allowedKeywords];
        this.floatingArrows.forEach(g => {
            const lbl = (g.userData && g.userData.label) ? g.userData.label : '';
            const isMatch = keywords.some(kw => lbl.toLowerCase().includes(kw.toLowerCase()));
            g.visible = isMatch;
        });
    }

    createUAVDrone() {
        const group = new THREE.Group();

        // Quadcopter Body (Matte grey engineering carbon-fiber)
        const bodyGeo = new THREE.BoxGeometry(0.5, 0.12, 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        group.add(body);

        // RTK GNSS Puck on top of drone
        const rtkGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 16);
        const rtkMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3 });
        const rtk = new THREE.Mesh(rtkGeo, rtkMat);
        rtk.position.y = 0.09;
        group.add(rtk);

        // 4 Motor Arms & Propellers
        this.propellers = [];
        const armOffsets = [
            [-0.35, 0.35],
            [0.35, 0.35],
            [-0.35, -0.35],
            [0.35, -0.35]
        ];

        armOffsets.forEach(([ax, az]) => {
            const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), bodyMat);
            arm.position.set(ax / 2, 0, az / 2);
            arm.rotation.z = Math.PI / 2;
            arm.rotation.y = Math.atan2(az, ax);
            group.add(arm);

            // Motor
            const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12), bodyMat);
            motor.position.set(ax, 0.03, az);
            group.add(motor);

            // Propeller blade
            const prop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.005, 0.03), new THREE.MeshStandardMaterial({ color: 0x111827 }));
            prop.position.set(ax, 0.065, az);
            group.add(prop);
            this.propellers.push(prop);
        });

        // 3-Axis Gimbal & 4K Photogrammetry Camera
        const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), new THREE.MeshStandardMaterial({ color: 0x111827 }));
        gimbal.position.set(0, -0.1, 0.15);
        group.add(gimbal);

        const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.8 }));
        lens.rotation.x = Math.PI / 2;
        lens.position.set(0, -0.1, 0.2);
        group.add(lens);

        group.position.set(0, 0.5, 0);
        this.scene.add(group);
        this.droneModel = group;
        return group;
    }

    updateDronePropellers(delta) {
        if (!this.propellers || this.propellers.length === 0) return;
        this.propellers.forEach((prop, i) => {
            prop.rotation.y += (i % 2 === 0 ? 1 : -1) * delta * 45;
        });
    }

    updateAnimations(delta) {
        this.animTime += delta;

        // Animate all floating hint arrows
        this.floatingArrows.forEach(g => {
            if (!g.userData) return;
            const newY = g.userData.baseY + Math.sin(this.animTime * 3.5 + g.userData.offset) * 0.25;
            if (g.userData.arrowMesh) {
                g.userData.arrowMesh.position.y = newY;
                g.userData.arrowMesh.rotation.y += delta * 2.2;
            }
            if (g.userData.spriteMesh) {
                g.userData.spriteMesh.position.y = newY + 1.15;
            }
            if (g.userData.ringMesh) {
                const scale = 1.0 + Math.sin(this.animTime * 4.0 + g.userData.offset) * 0.25;
                g.userData.ringMesh.scale.set(scale, scale, scale);
            }
        });
    }

    clearDynamicProps() {
        // Clear previous level tripods, staffs, markers, active station setup pads
        this.tripods.forEach(t => this.scene.remove(t));
        this.levelStaffs.forEach(s => this.scene.remove(s));
        this.gcpMarkers.forEach(g => this.scene.remove(g));
        if (this.stationPads) {
            this.stationPads.forEach(p => this.scene.remove(p));
            this.stationPads = [];
        }
        this.dynamicArrows.forEach(a => {
            this.scene.remove(a);
            const idx = this.floatingArrows.indexOf(a);
            if (idx > -1) this.floatingArrows.splice(idx, 1);
        });
        this.tripods = [];
        this.levelStaffs = [];
        this.gcpMarkers = [];
        this.dynamicArrows = [];
        this.interactiveObjects = [...this.benchmarks];
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.updateAnimations(0.016);
        this.renderer.render(this.scene, this.camera);
    }
}

window.SurveyScene = SurveyScene;
