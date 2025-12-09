import express from 'express';
import DataFetcher from '../../api/dataFetcher.js';
import DISCOSFetcher from '../../api/discosFetcher.js';
import MockFetcher from '../../api/mockFetcher.js';
import OrbitPropagator from '../../api/orbitPropagator.js';
import config from '../../config/config.js';

const router = express.Router();

// Select data source based on configuration
let dataFetcher;
if (config.dataSource === 'discos') {
  dataFetcher = new DISCOSFetcher();
  console.log('Using DISCOS (ESA) as data source');
} else if (config.dataSource === 'mock') {
  dataFetcher = new MockFetcher();
  console.log('Using Mock data source (for testing)');
} else {
  dataFetcher = new DataFetcher();
  console.log('Using Space-Track.org as data source');
}

// Cache for debris data
let debrisCache = null;
let cacheTimestamp = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Load or refresh debris cache
 */
async function getDebrisData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && debrisCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_TTL) {
    return debrisCache;
  }

  debrisCache = await dataFetcher.fetchDebrisWithCache({ forceRefresh });
  cacheTimestamp = now;
  return debrisCache;
}

/**
 * GET /api/debris
 * List all debris objects with filtering
 */
router.get('/', async (req, res) => {
  try {
    const { 
      limit = 500, 
      offset = 0, 
      orbitType, 
      objectType, 
      objectTypes,
      minRcsSize,
      maxRcsSize,
      search,
      noradId,
      forceRefresh 
    } = req.query;
    
    // Parse object types filter
    let objectTypesArray = [];
    if (objectTypes) {
      objectTypesArray = objectTypes.split(',').map(t => t.trim().toUpperCase());
    } else if (objectType) {
      objectTypesArray = [objectType.toUpperCase()];
    }

    // If searching by specific NORAD ID, fetch directly from Space-Track
    if (noradId) {
      const id = parseInt(noradId, 10);
      try {
        console.log(`Fetching specific NORAD ID: ${id}`);
        // Fetch directly for this specific ID (bypass cache)
        const specificDebris = await dataFetcher.fetchDebrisTLEs({
          noradId: id,
          includeMetadata: true,
          forceRefresh: true,
        });
        
        console.log(`Found ${specificDebris.length} objects for NORAD ${id}`);
        
        if (specificDebris.length > 0) {
          return res.json({
            total: 1,
            count: 1,
            offset: 0,
            limit: 1,
            filters: {
              orbitType: orbitType || null,
              objectTypes: objectTypesArray.length > 0 ? objectTypesArray : null,
              minRcsSize: minRcsSize || null,
              maxRcsSize: maxRcsSize || null,
              noradId: id,
            },
            data: specificDebris,
          });
        } else {
          return res.json({
            total: 0,
            count: 0,
            offset: 0,
            limit: 1,
            filters: { noradId: id },
            data: [],
            message: `NORAD ID ${id} not found in Space-Track database.`,
          });
        }
      } catch (error) {
        console.error(`Error fetching NORAD ${id}:`, error.message);
        return res.status(500).json({
          error: `Failed to fetch NORAD ${id}: ${error.message}`,
          noradId: id,
        });
      }
    }

    // Normal fetch for multiple objects
    let fetchLimit = parseInt(limit) + parseInt(offset);
    
    // Fetch debris with filters
    const debris = await dataFetcher.fetchDebrisWithCache({
      forceRefresh: forceRefresh === 'true',
      limit: fetchLimit,
      objectTypes: objectTypesArray.length > 0 ? objectTypesArray : undefined,
      minRcsSize: minRcsSize || undefined,
      maxRcsSize: maxRcsSize || undefined,
      includeMetadata: true,
    });

    let filtered = debris;
    
    // Filter by NORAD ID if specified (do this first for efficiency)
    if (noradId) {
      const id = parseInt(noradId, 10);
      filtered = filtered.filter(d => d.noradId === id);
      // If found specific ID, return it immediately
      if (filtered.length > 0) {
        return res.json({
          total: 1,
          count: 1,
          offset: 0,
          limit: 1,
          filters: {
            orbitType: orbitType || null,
            objectTypes: objectTypesArray.length > 0 ? objectTypesArray : null,
            minRcsSize: minRcsSize || null,
            maxRcsSize: maxRcsSize || null,
            noradId: id,
          },
          data: filtered.slice(0, 1),
        });
      } else {
        // Not found in current dataset
        return res.json({
          total: 0,
          count: 0,
          offset: 0,
          limit: 1,
          filters: {
            noradId: id,
          },
          data: [],
          message: `NORAD ID ${id} not found in current dataset. Try increasing the limit or refreshing data.`,
        });
      }
    }
    
    // Filter by search term (name or NORAD ID)
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(d => {
        const nameMatch = (d.objectName || d.name || '').toLowerCase().includes(searchLower);
        const idMatch = d.noradId.toString().includes(search);
        return nameMatch || idMatch;
      });
    }
    
    // Filter by orbit type
    if (orbitType) {
      filtered = filtered.filter(d => d.orbitType === orbitType.toUpperCase());
    }

    const total = filtered.length;
    const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      total,
      count: paginated.length,
      offset: parseInt(offset),
      limit: parseInt(limit),
      filters: {
        orbitType: orbitType || null,
        objectTypes: objectTypesArray.length > 0 ? objectTypesArray : null,
        minRcsSize: minRcsSize || null,
        maxRcsSize: maxRcsSize || null,
      },
      data: paginated,
    });
  } catch (error) {
    console.error('Error fetching debris:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debris/:id
 * Get specific object details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const debris = await getDebrisData();
    
    const object = debris.find(d => d.noradId === parseInt(id, 10));
    
    if (!object) {
      return res.status(404).json({ error: 'Object not found' });
    }

    res.json(object);
  } catch (error) {
    console.error('Error fetching debris object:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/debris/:id/position
 * Get current or future position
 */
router.get('/:id/position', async (req, res) => {
  try {
    const { id } = req.params;
    const { time } = req.query;
    
    const debris = await getDebrisData();
    const object = debris.find(d => d.noradId === parseInt(id, 10));
    
    if (!object) {
      return res.status(404).json({ error: 'Object not found' });
    }

    const targetDate = time ? new Date(time) : new Date();
    
    // Handle both DISCOS (has satrec) and Space-Track (needs TLE parsing)
    let satrec;
    if (object.satrec) {
      satrec = object.satrec;
    } else if (object.line1 && object.line2) {
      satrec = OrbitPropagator.fromTLEData(object);
    } else {
      return res.status(400).json({ error: 'Object missing orbital data' });
    }
    
    const position = OrbitPropagator.propagate(satrec, targetDate);
    
    const orbitalParams = OrbitPropagator.calculateOrbitalParams(
      position.position,
      position.velocity
    );

    res.json({
      noradId: object.noradId,
      name: object.name,
      time: targetDate.toISOString(),
      position: position.position,
      velocity: position.velocity,
      orbitalParams,
    });
  } catch (error) {
    console.error('Error calculating position:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/debris/query
 * Query debris by orbital parameters
 */
router.post('/query', async (req, res) => {
  try {
    const {
      minAltitude,
      maxAltitude,
      minInclination,
      maxInclination,
      orbitType,
      limit = 1000,
    } = req.body;

    const debris = await getDebrisData();
    let filtered = debris;

    if (orbitType) {
      filtered = filtered.filter(d => d.orbitType === orbitType.toUpperCase());
    }

    // Filter by altitude (requires propagation, so we'll use TLE data as approximation)
    if (minAltitude !== undefined || maxAltitude !== undefined) {
      filtered = filtered.filter(d => {
        // Approximate altitude from mean motion
        const period = (24 * 60 * 60) / d.meanMotion;
        const altitude = Math.pow((398600.4418 * Math.pow(period / (2 * Math.PI), 2)), 1/3) - 6378.137;
        
        if (minAltitude !== undefined && altitude < minAltitude) return false;
        if (maxAltitude !== undefined && altitude > maxAltitude) return false;
        return true;
      });
    }

    if (minInclination !== undefined || maxInclination !== undefined) {
      filtered = filtered.filter(d => {
        if (minInclination !== undefined && d.inclination < minInclination) return false;
        if (maxInclination !== undefined && d.inclination > maxInclination) return false;
        return true;
      });
    }

    const result = filtered.slice(0, parseInt(limit));

    res.json({
      total: filtered.length,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error('Error querying debris:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

