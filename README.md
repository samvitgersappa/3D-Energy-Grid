# CombinedEL 3D Energy Landscape

This project renders a realistic energy landscape with a thermal power plant, a hydro dam, procedural terrain, grass, water, and a physical sky using Three.js and Vite.

## Features
- Procedural terrain (vertex-colored biomes: sand/grass/rock/snow)
- Instanced grass for performance
- Reflective water lake
- Physical sky lighting and environment reflections
- Auto-scaled GLB models placed onto terrain
- Soft shadows and tone-mapped renderer

## Run

```bash
npm install
npm run dev
```
Then open the printed local URL in your browser.

## Build & Preview
```bash
npm run build
npm run preview
```

## Models
Place your `.glb` files in `public/models`. The app auto-scales loaded models to a target size and positions them on the terrain.

## Notes
- Terrain size: 300 units. Water level: -2.0 units.
- You can tune grass density, water size, and model target sizes inside `main.js`.
