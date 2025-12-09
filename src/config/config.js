import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const config = {
  // Data Source Selection
  // Options: 'mock' (no API needed), 'spacetrack' (requires free account), 'discos', 'keeptrack'
  dataSource: process.env.DATA_SOURCE || 'mock',
  
  // DISCOS API (ESA) - Recommended, no auth required
  discos: {
    baseUrl: 'https://discosweb.esoc.esa.int',
    apiUrl: 'https://discosweb.esoc.esa.int/api',
  },

  // Space-Track API (NORAD/SSN) - Requires free registration
  spaceTrack: {
    username: process.env.SPACETRACK_USERNAME || '',
    password: process.env.SPACETRACK_PASSWORD || '',
    baseUrl: 'https://www.space-track.org',
  },
  
  // KeepTrack API - Alternative source
  keepTrack: {
    baseUrl: 'https://api.keeptrack.space',
  },

  // Server Configuration
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    env: process.env.NODE_ENV || 'development',
  },

  // Data Cache Settings
  cache: {
    dir: process.env.CACHE_DIR || join(__dirname, '../../data/cache'),
    ttlHours: parseInt(process.env.CACHE_TTL_HOURS || '24', 10),
  },

  // Simulation Parameters
  simulation: {
    defaultTimeStep: 60, // seconds
    collisionThreshold: 1000, // meters - minimum distance for collision detection
    debrisGenerationMultiplier: 100, // number of fragments per collision
  },

  // Visualization Settings
  visualization: {
    maxObjects: 10000, // maximum objects to render at once
    updateInterval: 1000, // milliseconds between position updates
  },
};

// Ensure cache directory exists
if (!existsSync(config.cache.dir)) {
  mkdirSync(config.cache.dir, { recursive: true });
}

export default config;

