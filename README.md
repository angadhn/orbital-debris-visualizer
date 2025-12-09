# Orbital Debris Visualization System

A comprehensive system for pulling orbital debris data, visualizing it in 3D space, and simulating collisions with debris generation. Built with Node.js backend and CesiumJS frontend.

## Features

- **Real-time Data**: Fetch and update orbital debris positions from Space-Track.org API
- **3D Visualization**: Interactive CesiumJS globe with debris rendering
- **Collision Detection**: Find close approaches between objects
- **Collision Simulation**: Model collisions and generate debris fragments using extensible models
- **Extensible Architecture**: Plugin system for custom collision models

## Prerequisites

- Node.js (v16 or higher) and npm
- Cesium Ion account (free token from https://cesium.com/ion/)
- **Optional**: Space-Track.org account (only needed if using Space-Track as data source)

## Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```bash
# Data Source Selection (discos, spacetrack, or keeptrack)
# DISCOS (ESA) is recommended - no authentication required!
DATA_SOURCE=discos

# Space-Track.org API Credentials (only needed if DATA_SOURCE=spacetrack)
SPACETRACK_USERNAME=your_username
SPACETRACK_PASSWORD=your_password

# Server Configuration
PORT=3000
NODE_ENV=development

# Data Cache Settings
CACHE_DIR=./data/cache
CACHE_TTL_HOURS=24
```

**Note**: The system defaults to **DISCOS (ESA)** which requires no authentication and provides comprehensive debris data aligned with ESA MASTER models. Space-Track credentials are only needed if you want to use that data source instead.

3. Update Cesium Ion token in `public/js/visualizer.js`:

```javascript
Cesium.Ion.defaultAccessToken = 'your_cesium_ion_token';
```

Or get a free token from https://cesium.com/ion/signup/

## Usage

1. Start the server:

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

2. Open your browser and navigate to:

```
http://localhost:3000
```

3. Click "Load Debris Data" to fetch and visualize orbital debris

## API Endpoints

### Debris Data

- `GET /api/debris` - List all debris objects
  - Query params: `limit`, `offset`, `orbitType`, `forceRefresh`
- `GET /api/debris/:id` - Get specific object details
- `GET /api/debris/:id/position` - Get current/future position
  - Query params: `time` (ISO string)
- `POST /api/debris/query` - Query by orbital parameters
  - Body: `{ minAltitude, maxAltitude, minInclination, maxInclination, orbitType, limit }`

### Collision Detection

- `POST /api/collisions/detect` - Find close approaches
  - Body: `{ objectIds: [id1, id2, ...], startTime, endTime, stepSeconds, threshold }`
- `POST /api/collisions/simulate` - Run collision simulation
  - Body: `{ objectId1, objectId2, collisionTime, modelName, propagateFragments, fragmentEndTime }`
- `GET /api/collisions/models` - List available collision models

## Project Structure

```
/
├── src/
│   ├── api/              # Data fetching and orbit propagation
│   │   ├── dataFetcher.js
│   │   ├── tleParser.js
│   │   └── orbitPropagator.js
│   ├── server/           # Express server and routes
│   │   ├── server.js
│   │   └── routes/
│   │       ├── debris.js
│   │       └── collisions.js
│   ├── models/           # Collision detection and simulation
│   │   ├── collisionDetector.js
│   │   ├── collisionSimulator.js
│   │   ├── models/
│   │   │   ├── baseCollisionModel.js
│   │   │   ├── nasaModel.js
│   │   │   └── customModel.js
│   │   └── registry.js
│   └── config/
│       └── config.js
├── public/               # Frontend files
│   ├── index.html
│   ├── js/
│   │   ├── visualizer.js
│   │   ├── collisionViewer.js
│   │   └── apiClient.js
│   └── css/
│       └── styles.css
├── data/
│   └── cache/           # Cached TLE data
└── package.json
```

## Collision Models

The system includes an extensible collision model architecture:

- **NASA Model**: NASA ORDEM-inspired model with power-law fragment distribution
- **Custom Model**: Template for user-defined collision physics

To add a custom model, extend `BaseCollisionModel` and register it:

```javascript
import { BaseCollisionModel } from './models/models/baseCollisionModel.js';
import { modelRegistry } from './models/registry.js';

class MyCustomModel extends BaseCollisionModel {
  simulate(object1, object2, collisionParams) {
    // Your collision physics
  }
  
  generateDebris(collisionResult) {
    // Your debris generation
  }
}

modelRegistry.registerModel('myModel', new MyCustomModel());
```

## Data Sources

The system supports multiple data sources, configurable via `DATA_SOURCE` environment variable:

1. **DISCOS (ESA)** - **Recommended** - Default data source
   - ESA's Database and Information System Characterising Objects in Space
   - Aligned with ESA MASTER model data
   - No authentication required
   - Comprehensive metadata and object information
   - Set `DATA_SOURCE=discos` (default)

2. **Space-Track.org** (NORAD/SSN)
   - Largest catalog (~20,000+ tracked objects)
   - Real-time TLE data
   - Requires free registration
   - Set `DATA_SOURCE=spacetrack` and provide credentials

3. **KeepTrack API**
   - Alternative source (free for non-commercial use)
   - Set `DATA_SOURCE=keeptrack`

## Notes

- TLE data is cached locally to reduce API calls
- The system filters objects heuristically to identify debris
- Collision detection uses configurable distance thresholds
- Fragment propagation is simplified; production systems would use numerical integration

## License

ISC
