import axios from 'axios';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import config from '../config/config.js';
import OrbitPropagator from './orbitPropagator.js';

/**
 * DISCOS Data Fetcher (ESA)
 * Fetches orbital debris data from ESA's DISCOS database
 * No authentication required for public API
 */
class DISCOSFetcher {
  constructor() {
    this.baseUrl = config.discos.apiUrl;
    this.cacheDir = config.cache.dir;
  }

  /**
   * Fetch space objects from DISCOS API
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of space objects
   */
  async fetchObjects(options = {}) {
    const {
      limit = 1000,
      page = 1,
      objectType = 'debris', // 'debris', 'payload', 'rocket body', etc.
    } = options;

    try {
      // DISCOS API uses REST endpoints
      // Filter for debris objects
      const params = {
        'page[size]': Math.min(limit, 100), // DISCOS pagination limit
        'page[number]': page,
        'filter[objectType]': objectType,
        'sort': 'noradId',
      };

      const response = await axios.get(`${this.baseUrl}/objects`, {
        params,
        headers: {
          'Accept': 'application/json',
        },
      });

      return response.data.data || [];
    } catch (error) {
      console.error('DISCOS API error:', error.message);
      throw new Error(`DISCOS API error: ${error.message}`);
    }
  }

  /**
   * Fetch TLE data for objects from DISCOS
   * DISCOS provides orbital data in different formats
   * @param {Array} objectIds - Array of DISCOS object IDs
   * @returns {Promise<Array>} Array of objects with TLE data
   */
  async fetchTLEs(objectIds) {
    const tles = [];
    
    for (const objectId of objectIds) {
      try {
        // DISCOS provides orbital data via objects/{id}/orbits endpoint
        const response = await axios.get(`${this.baseUrl}/objects/${objectId}/orbits`, {
          headers: {
            'Accept': 'application/json',
          },
        });

        const orbits = response.data.data || [];
        if (orbits.length > 0) {
          // Get latest orbit data
          const latestOrbit = orbits[0];
          if (latestOrbit.attributes?.tle) {
            tles.push({
              objectId,
              tle: latestOrbit.attributes.tle,
              ...latestOrbit.attributes,
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch TLE for object ${objectId}:`, error.message);
      }
    }

    return tles;
  }

  /**
   * Fetch debris objects with orbital data
   * @param {Object} options - Fetch options
   * @returns {Promise<Array>} Debris objects with TLE data
   */
  async fetchDebris(options = {}) {
    try {
      // Fetch objects marked as debris
      const objects = await this.fetchObjects({
        ...options,
        objectType: 'debris',
      });

      // Extract object IDs
      const objectIds = objects.map(obj => obj.id);

      // Fetch TLE data for these objects
      const tles = await this.fetchTLEs(objectIds);

      // Combine object metadata with TLE data
      const debris = objects.map(obj => {
        const tleData = tles.find(t => t.objectId === obj.id);
        
        if (!tleData || !tleData.tle) {
          return null; // Skip objects without TLE
        }

        // Parse TLE if it's in string format
        const tleLines = tleData.tle.split('\n').filter(line => line.trim());
        if (tleLines.length < 2) {
          return null;
        }

        // Use OrbitPropagator to create satrec
        let satrec;
        try {
          satrec = OrbitPropagator.createSatrec(tleLines[0], tleLines[1]);
        } catch (error) {
          console.warn(`Failed to create satrec for ${obj.id}:`, error.message);
          return null;
        }

        // Extract NORAD ID from TLE or object attributes
        const noradId = obj.attributes?.noradId || 
                        (tleLines[1] ? parseInt(tleLines[1].substring(2, 7).trim(), 10) : null);

        return {
          noradId,
          discosId: obj.id,
          name: obj.attributes?.name || `DISCOS ${obj.id}`,
          objectType: obj.attributes?.objectType || 'debris',
          satrec,
          tle: {
            line1: tleLines[0],
            line2: tleLines[1],
          },
          attributes: obj.attributes,
        };
      }).filter(obj => obj !== null);

      return debris;
    } catch (error) {
      console.error('Error fetching debris from DISCOS:', error);
      throw error;
    }
  }

  /**
   * Get cache file path
   * @param {string} key - Cache key
   * @returns {string} File path
   */
  getCachePath(key) {
    return join(this.cacheDir, `${key}.json`);
  }

  /**
   * Check if cache is valid
   * @param {string} key - Cache key
   * @returns {boolean} True if cache exists and is valid
   */
  isCacheValid(key) {
    const cachePath = this.getCachePath(key);
    if (!existsSync(cachePath)) {
      return false;
    }

    try {
      const data = JSON.parse(readFileSync(cachePath, 'utf-8'));
      const age = Date.now() - data.timestamp;
      const maxAge = config.cache.ttlHours * 60 * 60 * 1000;
      return age < maxAge;
    } catch {
      return false;
    }
  }

  /**
   * Load from cache
   * @param {string} key - Cache key
   * @returns {Object|null} Cached data or null
   */
  loadCache(key) {
    const cachePath = this.getCachePath(key);
    if (!existsSync(cachePath)) {
      return null;
    }

    try {
      const data = JSON.parse(readFileSync(cachePath, 'utf-8'));
      return data.data;
    } catch {
      return null;
    }
  }

  /**
   * Save to cache
   * @param {string} key - Cache key
   * @param {Object} data - Data to cache
   */
  saveCache(key, data) {
    const cachePath = this.getCachePath(key);
    const cacheData = {
      timestamp: Date.now(),
      data,
    };
    writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
  }

  /**
   * Fetch debris with caching
   * @param {Object} options - Fetch options
   * @returns {Promise<Array>} Debris data
   */
  async fetchDebrisWithCache(options = {}) {
    const cacheKey = 'discos_debris';
    
    if (!options.forceRefresh && this.isCacheValid(cacheKey)) {
      console.log('Loading debris data from DISCOS cache...');
      return this.loadCache(cacheKey);
    }

    console.log('Fetching debris data from DISCOS (ESA)...');
    const data = await this.fetchDebris(options);
    this.saveCache(cacheKey, data);
    return data;
  }
}

export default DISCOSFetcher;

