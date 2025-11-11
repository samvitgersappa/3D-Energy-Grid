import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // fallback sky blue until Sky is ready

// Camera setup
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(10, 8, 12);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

// XR Buttons (will gracefully disable if not supported)
document.body.appendChild(VRButton.createButton(renderer));
document.body.appendChild(ARButton.createButton(renderer));

// PMREM generator for environment maps
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();

// Sky and lighting
const sky = new Sky();
sky.scale.setScalar(450000);
scene.add(sky);

const sun = new THREE.Vector3();
const skyUniforms = sky.material.uniforms;
skyUniforms[ 'turbidity' ].value = 10;
skyUniforms[ 'rayleigh' ].value = 2;
skyUniforms[ 'mieCoefficient' ].value = 0.005;
skyUniforms[ 'mieDirectionalG' ].value = 0.8;

// Set sun position (elevation/azimuth in degrees)
const elevationDeg = 55;  // height of sun in the sky
const azimuthDeg = 135;   // compass direction (0=N, 90=E)
const phi = THREE.MathUtils.degToRad(90 - elevationDeg);
const theta = THREE.MathUtils.degToRad(azimuthDeg);
sun.setFromSphericalCoords(1, phi, theta);
skyUniforms[ 'sunPosition' ].value.copy(sun);

// Environment from sky
const envRT = pmrem.fromScene(sky);
scene.environment = envRT.texture;

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x667755, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.copy(sun).multiplyScalar(300);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 1000;
dirLight.shadow.camera.left = -200;
dirLight.shadow.camera.right = 200;
dirLight.shadow.camera.top = 200;
dirLight.shadow.camera.bottom = -200;
scene.add(dirLight);

// Procedural terrain parameters
const TERRAIN_SIZE = 300;
const TERRAIN_SEGMENTS = 256;
const WATER_LEVEL = -2.0;

// Height function using ImprovedNoise
const noise = new ImprovedNoise();
const seed = Math.random() * 1000;
const heightAt = (x, z) => {
  // Normalize to [0, 1] domain for noise
  const nx = (x / TERRAIN_SIZE + 0.5);
  const nz = (z / TERRAIN_SIZE + 0.5);
  let e = 0;
  let amp = 1;
  let freq = 1.5;
  // Fractal Brownian Motion
  for (let o = 0; o < 5; o++) {
    e += amp * noise.noise(nx * freq + seed, nz * freq + seed, 0);
    amp *= 0.5;
    freq *= 2.0;
  }
  // Shape: mountains near edges, flatter center
  const dx = (x / (TERRAIN_SIZE * 0.5));
  const dz = (z / (TERRAIN_SIZE * 0.5));
  const edge = Math.min(1, Math.sqrt(dx*dx + dz*dz));
  const mountainMask = THREE.MathUtils.smoothstep(edge, 0.3, 1.0);
  const baseHeight = e * 12 * mountainMask + (e * 2 * (1 - mountainMask));
  // Lake basin in the center
  const r = Math.sqrt((x*x + z*z)) / (TERRAIN_SIZE * 0.5);
  const lake = THREE.MathUtils.clamp(1.0 - r * 1.2, 0, 1);
  const lakeBasin = -6 * Math.pow(lake, 2.0);
  return baseHeight + lakeBasin;
};

// Build terrain geometry with vertex colors
const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
terrainGeo.rotateX(-Math.PI / 2);

const pos = terrainGeo.attributes.position;
const colors = [];
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const z = pos.getZ(i);
  const y = heightAt(x, z);
  pos.setY(i, y);

  // Color by height (sand/grass/rock/snow)
  let c;
  if (y < WATER_LEVEL + 0.3) c = new THREE.Color(0xd2b48c); // sand
  else if (y < 2) c = new THREE.Color(0x6b8e23); // olive/grass lowland
  else if (y < 8) c = new THREE.Color(0x556b2f); // darker grass
  else if (y < 14) c = new THREE.Color(0x8b7d7b); // rocky
  else c = new THREE.Color(0xf0f8ff); // snowy caps
  colors.push(c.r, c.g, c.b);
}
terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0.0 });
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
terrain.castShadow = false;
scene.add(terrain);

// Simple water plane (static reflective surface)
const waterGeom = new THREE.CircleGeometry(55, 128);
const waterMat = new THREE.MeshPhysicalMaterial({
  color: 0x3a88b5,
  roughness: 0.15,
  metalness: 0.0,
  transmission: 0.0,
  thickness: 0.0,
  clearcoat: 0.6,
  clearcoatRoughness: 0.2,
  envMapIntensity: 1.0
});
const water = new THREE.Mesh(waterGeom, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = WATER_LEVEL;
water.receiveShadow = true;
scene.add(water);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 2, 0);

// Pointer lock first-person controls (WASD)
const fpControls = new PointerLockControls(camera, renderer.domElement);
// No need to add a separate controls object in r180; controls modify camera directly

fpControls.addEventListener('lock', () => { controls.enabled = false; });
fpControls.addEventListener('unlock', () => { controls.enabled = true; });

// Click to enter pointer lock (ignore clicks on XR buttons)
document.addEventListener('click', (e) => {
  const target = e.target;
  if (target && (target.id === 'VRButton' || target.id === 'ARButton')) return;
  if (!fpControls.isLocked) fpControls.lock();
});

const move = { forward: false, back: false, left: false, right: false };
const EYE_HEIGHT = 1.7;
const WALK_SPEED = 18; // units/sec
const direction = new THREE.Vector3();

function onKeyDown(e) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': move.forward = true; break;
    case 'KeyS': case 'ArrowDown': move.back = true; break;
    case 'KeyA': case 'ArrowLeft': move.left = true; break;
    case 'KeyD': case 'ArrowRight': move.right = true; break;
  }
}
function onKeyUp(e) {
  switch (e.code) {
    case 'KeyW': case 'ArrowUp': move.forward = false; break;
    case 'KeyS': case 'ArrowDown': move.back = false; break;
    case 'KeyA': case 'ArrowLeft': move.left = false; break;
    case 'KeyD': case 'ArrowRight': move.right = false; break;
  }
}
document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Helper: sample terrain height at arbitrary (x,z) using barycentric lookup
// We'll do a simple nearest-vertex sampling for placement convenience
function sampleTerrainHeight(x, z) {
  const half = TERRAIN_SIZE / 2;
  const gx = THREE.MathUtils.clamp(Math.round((x + half) / TERRAIN_SIZE * TERRAIN_SEGMENTS), 0, TERRAIN_SEGMENTS);
  const gz = THREE.MathUtils.clamp(Math.round((z + half) / TERRAIN_SIZE * TERRAIN_SEGMENTS), 0, TERRAIN_SEGMENTS);
  const idx = gz * (TERRAIN_SEGMENTS + 1) + gx;
  return pos.getY(idx);
}

// Helper: approximate surface normal by sampling around point
function sampleTerrainNormal(x, z) {
  const eps = 0.5;
  const hL = sampleTerrainHeight(x - eps, z);
  const hR = sampleTerrainHeight(x + eps, z);
  const hD = sampleTerrainHeight(x, z - eps);
  const hU = sampleTerrainHeight(x, z + eps);
  const n = new THREE.Vector3(hL - hR, 2.0, hD - hU).normalize();
  return n;
}

// Simple cloud system using canvas-generated soft sprites
function createCloudTexture(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(size/2, size/2, size*0.2, size/2, size/2, size*0.5);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0,0,size,size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const cloudTexture = createCloudTexture();
const clouds = [];
const CLOUD_ALTITUDE = 120;
for (let i = 0; i < 40; i++) {
  const spriteMat = new THREE.SpriteMaterial({ map: cloudTexture, transparent: true, opacity: 0.65, depthWrite: false });
  const sprite = new THREE.Sprite(spriteMat);
  const r = 160 * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  sprite.position.set(Math.cos(a) * r, CLOUD_ALTITUDE + (Math.random() * 10 - 5), Math.sin(a) * r);
  const s = 40 + Math.random() * 60;
  sprite.scale.set(s, s * 0.6, 1);
  sprite.userData = { speedX: (Math.random() * 0.04 + 0.01) * (Math.random() < 0.5 ? -1 : 1), speedZ: (Math.random() * 0.02 + 0.005) };
  clouds.push(sprite);
  scene.add(sprite);
}

// Grass (instanced simple blades)
const grassCount = 3000;
const grassGeom = new THREE.PlaneGeometry(0.12, 0.6, 1, 3);
grassGeom.translate(0, 0.3, 0);
const grassMat = new THREE.MeshStandardMaterial({ color: 0x3d7d2b, side: THREE.DoubleSide, roughness: 1.0 });
const grass = new THREE.InstancedMesh(grassGeom, grassMat, grassCount);
grass.castShadow = true;
grass.receiveShadow = false;

const dummy = new THREE.Object3D();
let gi = 0;
for (let i = 0; i < grassCount * 4 && gi < grassCount; i++) {
  const r = 50 * Math.sqrt(Math.random());
  const a = Math.random() * Math.PI * 2;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  const y = sampleTerrainHeight(x, z);
  if (y <= WATER_LEVEL + 0.2 || y > 6) continue; // avoid water and high altitudes
  const n = sampleTerrainNormal(x, z);
  if (n.y < 0.8) continue; // avoid steep slopes
  dummy.position.set(x, y + 0.02, z);
  dummy.rotation.y = Math.random() * Math.PI * 2;
  const s = 0.7 + Math.random() * 0.6;
  dummy.scale.setScalar(s);
  dummy.updateMatrix();
  grass.setMatrixAt(gi++, dummy.matrix);
}
grass.instanceMatrix.needsUpdate = true;
scene.add(grass);

// Load GLB models with auto-scaling and terrain-conforming placement
const loader = new GLTFLoader();

function placeModel(gltf, options) {
  const { targetSize, positionHint } = options;
  const model = gltf.scene;

  // Compute bounding box and scale
  const bbox = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const currentMax = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / currentMax;
  model.scale.setScalar(scale);

  // Recompute bbox after scale for placement
  const bbox2 = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  bbox2.getCenter(center);
  // Align base to y=0 and center on XZ so it sits on terrain without sinking
  model.position.sub(new THREE.Vector3(center.x, bbox2.min.y, center.z));

  const x = positionHint.x;
  const z = positionHint.z;
  const y = sampleTerrainHeight(x, z);
  model.position.add(new THREE.Vector3(x, y, z));

  model.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  scene.add(model);
}

loader.load(
  './models/thermal_power_plant.glb',
  (gltf) => {
    // Move plant to solid land and further increase its size
    placeModel(gltf, { targetSize: 80, positionHint: { x: -90, z: 60 } });
  },
  (xhr) => console.log(`thermal_power_plant.glb ${(xhr.loaded / xhr.total * 100).toFixed(1)}% loaded`),
  (error) => console.error('Error loading thermal plant:', error)
);

loader.load(
  './models/hydro_power_dam.glb',
  (gltf) => {
    // Place near water edge
    placeModel(gltf, { targetSize: 45, positionHint: { x: 15, z: -25 } });
  },
  (xhr) => console.log(`hydro_power_dam.glb ${(xhr.loaded / xhr.total * 100).toFixed(1)}% loaded`),
  (error) => console.error('Error loading dam:', error)
);

// Animation loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // WASD movement when pointer is locked
  if (fpControls.isLocked) {
    direction.set(0, 0, 0);
    if (move.forward) direction.z -= 1;
    if (move.back) direction.z += 1;
    if (move.left) direction.x -= 1;
    if (move.right) direction.x += 1;
    if (direction.lengthSq() > 0) direction.normalize();

    fpControls.moveRight(direction.x * WALK_SPEED * delta);
    fpControls.moveForward(direction.z * WALK_SPEED * delta);

    // Keep camera at walking height above terrain
    const groundY = sampleTerrainHeight(camera.position.x, camera.position.z);
    camera.position.y = groundY + EYE_HEIGHT;
  } else {
    controls.update();
  }
  // Drift clouds slowly and wrap around
  for (const c of clouds) {
    c.position.x += c.userData.speedX;
    c.position.z += c.userData.speedZ;
    const lim = TERRAIN_SIZE * 0.6;
    if (c.position.x > lim) c.position.x = -lim;
    if (c.position.x < -lim) c.position.x = lim;
    if (c.position.z > lim) c.position.z = -lim;
    if (c.position.z < -lim) c.position.z = lim;
  }
  renderer.render(scene, camera);
}
animate();

// Handle resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
