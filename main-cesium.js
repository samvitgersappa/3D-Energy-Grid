import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

// IMPORTANT: Paste your Cesium Ion access token here.
// 1. Go to https://cesium.com/ion/signup and create a free account.
// 2. Go to the "Access Tokens" tab.
// 3. Copy the "Default" token and paste it below.
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI1ZjE0YmM0MS03MDdkLTQyZmMtODFiMC00YjljZDcyMzdhYTEiLCJpZCI6MzYxNzI0LCJpYXQiOjE3NjM1Mzg0NTF9.gndeuPVI38HHOj7CgWhS5lCij_BwzL6SmSPkubXvP_4';

// Power plant locations in Bengaluru area
const bengaluruPlants = [
  // Hydro plants
  { name: 'Hesaraghatta Hydro', type: 'hydro', capacity: '45 MW', lat: 13.1328, lon: 77.4714 },
  { name: 'Thippagondanahalli Hydro', type: 'hydro', capacity: '38 MW', lat: 12.8675, lon: 77.3589 },
  
  // Nuclear plant
  { name: 'Bengaluru Nuclear Facility', type: 'nuclear', capacity: '500 MW', lat: 12.7342, lon: 77.3456 },
  
  // Solar plants
  { name: 'Electronic City Solar Park', type: 'solar', capacity: '150 MW', lat: 12.8456, lon: 77.6789 },
  { name: 'Whitefield Solar Farm', type: 'solar', capacity: '120 MW', lat: 12.9698, lon: 77.7499 },
  { name: 'Yelahanka Solar Plant', type: 'solar', capacity: '95 MW', lat: 13.1007, lon: 77.5963 },
  
  // Wind farms
  { name: 'Nandi Hills Wind Farm', type: 'wind', capacity: '200 MW', lat: 13.3704, lon: 77.6839 },
  { name: 'Devanahalli Wind Park', type: 'wind', capacity: '180 MW', lat: 13.2474, lon: 77.7081 },
  { name: 'Kolar Wind Facility', type: 'wind', capacity: '160 MW', lat: 13.1392, lon: 78.1299 }
];

// Initialize Cesium Viewer with 3D terrain (Requires valid Token)
const viewer = new Cesium.Viewer('cesiumContainer', {
  terrain: Cesium.Terrain.fromWorldTerrain({
    requestWaterMask: true,
    requestVertexNormals: true
  }),
  animation: true,       // Enable animation control
  timeline: true,        // Enable timeline
  baseLayerPicker: false,
  geocoder: false,
  homeButton: true,
  sceneModePicker: true,
  navigationHelpButton: false,
  selectionIndicator: true,
  infoBox: true,
  fullscreenButton: true,
  vrButton: false,
  shouldAnimate: true    // Start animation by default
});

// Configure Clock for 24h simulation
const start = Cesium.JulianDate.fromDate(new Date(2023, 6, 1, 0)); // Start at midnight
const stop = Cesium.JulianDate.addDays(start, 1, new Cesium.JulianDate());
viewer.clock.startTime = start.clone();
viewer.clock.stopTime = stop.clone();
viewer.clock.currentTime = start.clone();
viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; // Loop the day
viewer.clock.multiplier = 3600; // 1 second real time = 1 hour simulation time
viewer.timeline.zoomTo(start, stop);

// Add Cesium OSM Buildings for 3D cities
try {
  const buildingsTileset = await Cesium.createOsmBuildingsAsync();
  viewer.scene.primitives.add(buildingsTileset);
} catch (error) {
  console.error('Error loading 3D buildings:', error);
}

// Enable lighting for better 3D effect
viewer.scene.globe.enableLighting = true;
viewer.shadows = true; // Enable shadows for sun rotation effect

// Color scheme for plant types
const plantColors = {
  hydro: Cesium.Color.DEEPSKYBLUE,
  nuclear: Cesium.Color.ORANGE,
  solar: Cesium.Color.YELLOW,
  wind: Cesium.Color.CYAN
};

// Paths to the 3D models (GLB format required for Cesium)
// NOTE: Since OBJ conversion failed, we are using the available Thermal GLB models as placeholders.
// To use your specific models, please convert your OBJ files to GLB using https://blackthread.io/gltf-converter/
// and save them to these paths:
const plantModels = {
  hydro: 'models/energy-plants/Thermal/coal_power_station.glb', // Placeholder
  nuclear: 'models/energy-plants/Thermal/thermal_power_plant.glb', // Placeholder
  solar: 'models/energy-plants/Thermal/thermal_power_plant.glb', // Placeholder
  wind: 'models/energy-plants/Thermal/coal_power_station.glb' // Placeholder
};

// Simulation State (Global)
const gridState = {
  totalDemand: 0,
  totalGen: 0,
  renewablePct: 0,
  frequency: 50.0
};

// Add plant entities to the viewer
bengaluruPlants.forEach(plant => {
  const position = Cesium.Cartesian3.fromDegrees(plant.lon, plant.lat);
  const color = plantColors[plant.type] || Cesium.Color.WHITE;

  viewer.entities.add({
    name: `${plant.name} (${plant.capacity})`,
    position: position,
    description: `
      <h2>${plant.name}</h2>
      <p><strong>Type:</strong> ${plant.type.charAt(0).toUpperCase() + plant.type.slice(1)}</p>
      <p><strong>Capacity:</strong> ${plant.capacity}</p>
    `,
    model: {
      uri: plantModels[plant.type],
      scale: 1.0, // Reduced from 10.0 to 1.0 for realistic size
      color: color, // Tint the model with the plant type color
      colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
      colorBlendAmount: 0.5,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });
});

// Draw power lines (connections) between plants to simulate a grid
let powerGridEntity;
function drawPowerLines() {
  // Create a sequence of positions connecting the plants
  // We'll connect them in the order they appear in the list, and close the loop
  const positions = bengaluruPlants.map(plant => Cesium.Cartesian3.fromDegrees(plant.lon, plant.lat));
  
  // Close the loop by adding the first point at the end
  if (positions.length > 0) {
    positions.push(positions[0]);
  }

  powerGridEntity = viewer.entities.add({
    name: 'Power Grid Connections',
    polyline: {
      positions: positions,
      width: 3,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: new Cesium.CallbackProperty(() => {
          // Pulse glow based on total generation (0.1 to 0.5)
          const loadFactor = Math.min(1.0, (gridState.totalGen || 0) / 1500);
          return 0.1 + (loadFactor * 0.4);
        }, false),
        taperPower: 0.5,
        color: new Cesium.CallbackProperty(() => {
          // Red if unstable frequency, Cyan if stable
          if (gridState.frequency < 49.8 || gridState.frequency > 50.2) {
            return Cesium.Color.ORANGERED;
          }
          return Cesium.Color.CYAN;
        }, false),
      }),
      clampToGround: true // Follow the terrain
    }
  });
}

drawPowerLines();

// Fly the camera to Bengaluru
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(77.5946, 12.9716, 50000), // Bengaluru, 50km altitude
  orientation: {
    heading: Cesium.Math.toRadians(0),
    pitch: Cesium.Math.toRadians(-45),
    roll: 0
  },
  duration: 2 // seconds
});

// --- UI Functions ---

// Function to build the plant list in the UI
function buildPlantListUI() {
  const plantList = document.getElementById('plantList');
  plantList.innerHTML = ''; // Clear existing list

  const categories = {
    hydro: [],
    nuclear: [],
    solar: [],
    wind: []
  };

  // Group plants by type
  bengaluruPlants.forEach(plant => {
    categories[plant.type].push(plant);
  });

  // Create list items for each category
  for (const category in categories) {
    if (categories[category].length === 0) continue;

    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'plant-category';
    
    const categoryTitle = document.createElement('div');
    categoryTitle.className = 'category-title';
    categoryTitle.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} Power`;
    categoryDiv.appendChild(categoryTitle);

    categories[category].forEach(plant => {
      const item = document.createElement('div');
      item.className = 'plant-item';
      
      const nameDiv = document.createElement('div');
      nameDiv.className = 'plant-name';
      nameDiv.textContent = plant.name;
      item.appendChild(nameDiv);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'plant-info';
      
      const capacitySpan = document.createElement('span');
      capacitySpan.className = 'plant-capacity';
      capacitySpan.textContent = plant.capacity;
      infoDiv.appendChild(capacitySpan);
      
      item.appendChild(infoDiv);

      item.onclick = () => {
        const entity = viewer.entities.values.find(e => e.name === `${plant.name} (${plant.capacity})`);
        if (entity) {
          viewer.selectedEntity = entity; // Select the entity to open InfoBox
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(plant.lon, plant.lat, 5000), // Fly closer
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-35),
              roll: 0
            },
            duration: 1.5
          });
        }
      };
      categoryDiv.appendChild(item);
    });
    plantList.appendChild(categoryDiv);
  }
}

// Initial call to build the UI
buildPlantListUI();

// --- Draggable UI Logic ---
function makeElementDraggable(elementId, handleId) {
  const element = document.getElementById(elementId);
  const handle = document.querySelector(handleId);
  
  if (!element || !handle) return;

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  handle.style.cursor = 'grab';

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Get current position (computed style handles both 'left/top' and 'transform' if needed, 
    // but here we are using absolute positioning with right/top initially. 
    // We need to switch to left/top for dragging to work smoothly from any position)
    const rect = element.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;
    
    // Switch from 'right' positioning to 'left' to allow free movement
    element.style.right = 'auto';
    element.style.left = `${initialLeft}px`;
    element.style.top = `${initialTop}px`;
    element.style.bottom = 'auto';
    
    handle.style.cursor = 'grabbing';
    
    // Prevent text selection during drag
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    element.style.left = `${initialLeft + dx}px`;
    element.style.top = `${initialTop + dy}px`;
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      handle.style.cursor = 'grab';
    }
  });
}

// Initialize draggable card
makeElementDraggable('plantCard', '.card-header');
makeElementDraggable('gridMonitor', '.monitor-header'); // Make monitor draggable too

// --- Real-time Simulation Logic ---

// Helper to parse capacity string "45 MW" -> 45
function parseCapacity(capStr) {
  return parseFloat(capStr.split(' ')[0]);
}

// Update Simulation Loop (runs every frame)
viewer.clock.onTick.addEventListener((clock) => {
  const time = Cesium.JulianDate.toGregorianDate(clock.currentTime);
  const hour = time.hour + time.minute / 60; // 0.0 to 24.0

  // 1. Calculate Demand Curve (Simple double peak model)
  // Base load: 600MW, Morning Peak (9am): +300MW, Evening Peak (7pm): +400MW
  const baseLoad = 600;
  const morningPeak = 300 * Math.exp(-Math.pow(hour - 9, 2) / 4);
  const eveningPeak = 400 * Math.exp(-Math.pow(hour - 19, 2) / 4);
  const noise = (Math.random() - 0.5) * 20; // Random fluctuation
  gridState.totalDemand = Math.round(baseLoad + morningPeak + eveningPeak + noise);

  // 2. Calculate Generation per Plant
  let currentTotalGen = 0;
  let currentRenewableGen = 0;

  bengaluruPlants.forEach(plant => {
    const maxCap = parseCapacity(plant.capacity);
    let currentOutput = 0;

    if (plant.type === 'solar') {
      // Solar: Bell curve from 6am to 6pm
      if (hour > 6 && hour < 18) {
        const sunIntensity = Math.sin(((hour - 6) / 12) * Math.PI);
        currentOutput = maxCap * sunIntensity;
        // Add some cloud cover noise
        currentOutput *= (0.8 + Math.random() * 0.2); 
      }
    } else if (plant.type === 'wind') {
      // Wind: Higher at night/evening usually, random gusts
      const windIntensity = 0.5 + 0.3 * Math.sin(hour / 24 * Math.PI * 2) + (Math.random() * 0.2);
      currentOutput = maxCap * windIntensity;
    } else if (plant.type === 'hydro') {
      // Hydro: Peaking plant - fills the gap
      // Simple logic: Run at 50% base, ramp up if demand is high
      currentOutput = maxCap * 0.5; 
      if (gridState.totalDemand > 800) currentOutput = maxCap * 0.9; // Peak mode
    } else if (plant.type === 'nuclear') {
      // Nuclear: Base load, constant high output
      currentOutput = maxCap * 0.95; // Always running near full
    }

    currentTotalGen += currentOutput;
    if (['solar', 'wind', 'hydro'].includes(plant.type)) {
      currentRenewableGen += currentOutput;
    }

    // Update Plant UI (Optional: could update individual list items here)
  });

  // 3. Load Balancing / Frequency Simulation
  // If Gen < Demand, Frequency drops. If Gen > Demand, Frequency rises.
  const balance = currentTotalGen - gridState.totalDemand;
  // Simple P-controller for frequency
  gridState.frequency = 50.0 + (balance / 1000) * 0.5; 
  // Clamp frequency for realism
  gridState.frequency = Math.max(49.0, Math.min(51.0, gridState.frequency));

  gridState.totalGen = Math.round(currentTotalGen);
  gridState.renewablePct = Math.round((currentRenewableGen / currentTotalGen) * 100) || 0;

  // 4. Update Dashboard UI
  updateDashboard(hour);
});

function updateDashboard(hour) {
  // Clock
  const hh = Math.floor(hour).toString().padStart(2, '0');
  const mm = Math.floor((hour % 1) * 60).toString().padStart(2, '0');
  document.getElementById('clockDisplay').textContent = `${hh}:${mm}`;

  // Values
  document.getElementById('totalDemand').textContent = gridState.totalDemand;
  document.getElementById('totalGen').textContent = gridState.totalGen;
  document.getElementById('renewablePct').textContent = `${gridState.renewablePct}%`;
  document.getElementById('gridFreq').textContent = `${gridState.frequency.toFixed(2)} Hz`;

  // Bars (Assuming max capacity ~1500MW for scale)
  const maxScale = 1500;
  document.getElementById('demandBar').style.width = `${Math.min(100, (gridState.totalDemand / maxScale) * 100)}%`;
  document.getElementById('genBar').style.width = `${Math.min(100, (gridState.totalGen / maxScale) * 100)}%`;

  // Color coding frequency
  const freqElem = document.getElementById('gridFreq');
  if (gridState.frequency < 49.8 || gridState.frequency > 50.2) {
    freqElem.style.color = '#ff4f4f'; // Danger
  } else {
    freqElem.style.color = '#4caf50'; // Normal
  }
}

console.log('Cesium 3D map loaded with', bengaluruPlants.length, 'power plants');
