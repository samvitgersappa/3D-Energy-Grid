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
  animation: false,
  timeline: false,
  baseLayerPicker: false,  // We'll use default satellite imagery
  geocoder: false,
  homeButton: true,
  sceneModePicker: true,
  navigationHelpButton: false,
  selectionIndicator: true,
  infoBox: true,
  fullscreenButton: true,
  vrButton: false
});

// Add Cesium OSM Buildings for 3D cities
try {
  const buildingsTileset = await Cesium.createOsmBuildingsAsync();
  viewer.scene.primitives.add(buildingsTileset);
} catch (error) {
  console.error('Error loading 3D buildings:', error);
}

// Enable lighting for better 3D effect
viewer.scene.globe.enableLighting = true;

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
      scale: 10.0, // Adjust this for realistic size (1.0 = true size if model is in meters)
      color: color, // Tint the model with the plant type color
      colorBlendMode: Cesium.ColorBlendMode.HIGHLIGHT,
      colorBlendAmount: 0.5,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
    }
  });
});

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
    const categoryDiv = document.createElement('div');
    categoryDiv.className = 'plant-category';
    
    const categoryTitle = document.createElement('h3');
    categoryTitle.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} Plants`;
    categoryDiv.appendChild(categoryTitle);

    const ul = document.createElement('ul');
    categories[category].forEach(plant => {
      const li = document.createElement('li');
      li.textContent = `${plant.name} (${plant.capacity})`;
      li.onclick = () => {
        const entity = viewer.entities.values.find(e => e.name === `${plant.name} (${plant.capacity})`);
        if (entity) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(plant.lon, plant.lat, 10000), // Fly closer
            orientation: {
              heading: Cesium.Math.toRadians(0),
              pitch: Cesium.Math.toRadians(-35),
              roll: 0
            },
            duration: 1.5
          });
        }
      };
      ul.appendChild(li);
    });
    categoryDiv.appendChild(ul);
    plantList.appendChild(categoryDiv);
  }
}

// Initial call to build the UI
buildPlantListUI();

console.log('Cesium 3D map loaded with', bengaluruPlants.length, 'power plants');
