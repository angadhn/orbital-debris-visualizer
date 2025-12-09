import axios from 'axios';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import config from '../config/config.js';
import TLEParser from './tleParser.js';

/**
 * Data Fetcher for Space-Track.org API
 * Handles authentication, rate limiting, and caching
 */
class DataFetcher {
  constructor() {
    this.baseUrl = config.spaceTrack.baseUrl;
    this.username = config.spaceTrack.username;
    this.password = config.spaceTrack.password;
    this.cookie = null;
    this.lastAuthTime = null;
    this.authExpiry = 2 * 60 * 60 * 1000; // 2 hours
  }

  /**
   * Authenticate with Space-Track.org
   * @returns {Promise<string>} Session cookie
   */
  async authenticate() {
    // Check if we have a valid session
    if (this.cookie && this.lastAuthTime) {
      const elapsed = Date.now() - this.lastAuthTime;
      if (elapsed < this.authExpiry) {
        return this.cookie;
      }
    }

    if (!this.username || !this.password) {
      throw new Error('Space-Track credentials not configured. Set SPACETRACK_USERNAME and SPACETRACK_PASSWORD in .env');
    }

    try {
      // Space-Track expects form-urlencoded data
      const formData = `identity=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
      
      const response = await axios.post(
        `${this.baseUrl}/ajaxauth/login`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400, // Accept redirects
        }
      );

      // Check for successful authentication
      // Space-Track returns empty JSON string "{}" on success
      if (response.status === 200) {
        // Space-Track returns cookies in set-cookie header
        const cookies = response.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
          // Extract the cookie value (usually named 'chocolatechip')
          const cookieString = cookies[0];
          this.cookie = cookieString.split(';')[0];
          this.lastAuthTime = Date.now();
          console.log('Space-Track authentication successful');
          return this.cookie;
        }
        // Also check if response is empty or "{}" which indicates success
        if (!response.data || response.data === '' || response.data === '{}') {
          // Try to extract cookie from any set-cookie header
          const setCookie = response.headers['set-cookie'];
          if (setCookie) {
            this.cookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
            this.lastAuthTime = Date.now();
            console.log('Space-Track authentication successful (empty response)');
            return this.cookie;
          }
        }
      }

      // Check response data for error messages
      if (response.data && typeof response.data === 'string') {
        if (response.data.includes('error') || response.data.includes('failed')) {
          throw new Error(`Authentication failed: ${response.data}`);
        }
      }

      throw new Error('Authentication failed: No session cookie received');
    } catch (error) {
      if (error.response) {
        // HTTP error response
        const status = error.response.status;
        const data = error.response.data;
        if (status === 401 || status === 403) {
          throw new Error(`Space-Track authentication failed: Invalid username or password. Please verify your credentials at https://www.space-track.org`);
        }
        throw new Error(`Space-Track authentication error (HTTP ${status}): ${data || error.message}`);
      } else if (error.request) {
        throw new Error(`Space-Track authentication error: Could not connect to Space-Track.org. Check your internet connection.`);
      } else {
        throw new Error(`Space-Track authentication error: ${error.message}`);
      }
    }
  }

  /**
   * Make authenticated request to Space-Track API
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} API response
   */
  async request(endpoint, params = {}) {
    await this.authenticate();

    try {
      const response = await axios.get(`${this.baseUrl}${endpoint}`, {
        params,
        headers: {
          Cookie: this.cookie,
        },
        maxRedirects: 5,
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Re-authenticate and retry
        console.log('Session expired, re-authenticating...');
        this.cookie = null;
        await this.authenticate();
        return this.request(endpoint, params);
      }
      
      // Better error messages
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        console.error(`Space-Track API error (${status}):`, data);
        throw new Error(`Space-Track API error (HTTP ${status}): ${typeof data === 'string' ? data : JSON.stringify(data)}`);
      }
      
      throw error;
    }
  }

  /**
   * Fetch TLE data for all objects
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of TLE strings
   */
  async fetchAllTLEs(options = {}) {
    const {
      orderby = 'NORAD_CAT_ID',
      limit = 10000,
      format = 'tle',
      predicate = '',
      noradId = null, // Specific NORAD ID to fetch
    } = options;

    // If searching for specific NORAD ID, use predicate in query params
    if (noradId) {
      const endpoint = `/basicspacedata/query/class/tle_latest/format/tle`;
      const params = {
        predicate: `NORAD_CAT_ID=${noradId}`,
      };
      
      try {
        const data = await this.request(endpoint, params);
        if (typeof data === 'string') {
          return this.parseTLEString(data);
        }
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error(`Error fetching TLE for NORAD ${noradId}:`, error.message);
        // Try alternative format
        try {
          const altEndpoint = `/basicspacedata/query/class/tle_latest/format/tle/predicate/NORAD_CAT_ID=${noradId}`;
          const data = await this.request(altEndpoint, {});
          if (typeof data === 'string') {
            return this.parseTLEString(data);
          }
          return Array.isArray(data) ? data : [];
        } catch (error2) {
          throw error;
        }
      }
    }

    // Space-Track REST API - try simplest format first
    // Format: /basicspacedata/query/class/{class}/format/{format}/limit/{limit}
    let endpoint = '/basicspacedata/query/class/tle_latest/format/tle';
    
    // Add limit
    endpoint += `/limit/${limit}`;
    
    // Add orderby if specified
    if (orderby) {
      endpoint += `/orderby/${orderby}`;
    }
    
    // Build query string for predicate if provided
    const params = {};
    const predicateStr = predicate || 'DECAY_DATE is null';
    if (predicateStr) {
      // Try as query parameter
      params.predicate = predicateStr;
    }

    try {
      const data = await this.request(endpoint, params);
      
      if (typeof data === 'string') {
        return this.parseTLEString(data);
      }
      
      return Array.isArray(data) ? data : [];
    } catch (error) {
      // If that fails, try without predicate filter
      console.warn('First attempt failed, trying without predicate filter...');
      try {
        const simpleEndpoint = `/basicspacedata/query/class/tle_latest/format/tle/limit/${limit}`;
        const data = await this.request(simpleEndpoint, {});
        
        if (typeof data === 'string') {
          return this.parseTLEString(data);
        }
        
        return Array.isArray(data) ? data : [];
      } catch (error2) {
        console.error('Error fetching TLEs:', error2.message);
        throw error2;
      }
    }
  }

  /**
   * Fetch object metadata (type, size, etc.) from Space-Track
   * @param {Array} noradIds - Array of NORAD IDs
   * @returns {Promise<Map>} Map of NORAD ID to metadata
   */
  async fetchObjectMetadata(noradIds) {
    const metadataMap = new Map();
    
    // Fetch in batches to avoid overwhelming the API
    const batchSize = 100;
    for (let i = 0; i < noradIds.length; i += batchSize) {
      const batch = noradIds.slice(i, i + batchSize);
      const idsStr = batch.join(',');
      
      try {
        // Use gp (general perturbations) endpoint which includes object metadata
        const endpoint = `/basicspacedata/query/class/gp/format/json/predicate/NORAD_CAT_ID in (${idsStr})`;
        const data = await this.request(endpoint, {});
        
        if (Array.isArray(data)) {
          for (const obj of data) {
            metadataMap.set(parseInt(obj.NORAD_CAT_ID, 10), {
              objectType: obj.OBJECT_TYPE || 'UNKNOWN',
              objectName: obj.OBJECT_NAME || '',
              rcsSize: obj.RCS_SIZE || 'UNKNOWN',
              countryCode: obj.COUNTRY_CODE || '',
              launchDate: obj.LAUNCH_DATE || '',
            });
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch metadata for batch: ${error.message}`);
      }
    }
    
    return metadataMap;
  }

  /**
   * Fetch TLE data for debris objects only
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Array of parsed TLE objects
   */
  async fetchDebrisTLEs(options = {}) {
    const {
      objectTypes = [], // Filter by object types: PAYLOAD, ROCKET BODY, DEBRIS, etc.
      minRcsSize = null, // Filter by minimum RCS size
      maxRcsSize = null, // Filter by maximum RCS size
      includeMetadata = true, // Whether to fetch object metadata
      noradId = null, // Specific NORAD ID to fetch
      ...otherOptions
    } = options;

    // Build predicate for object type filtering (skip if fetching specific ID)
    let predicate = null;
    if (!noradId) {
      predicate = 'DECAY_DATE is null';
      if (objectTypes.length > 0) {
        const typeFilters = objectTypes.map(type => `OBJECT_TYPE='${type}'`).join(' or ');
        predicate += ` and (${typeFilters})`;
      }
    }

    const tles = await this.fetchAllTLEs({
      ...otherOptions,
      predicate: predicate || '',
      noradId: noradId || null,
    });

    // Parse TLEs and deduplicate by NORAD ID (keep latest TLE)
    const parsed = [];
    const noradIds = [];
    const seenIds = new Map(); // Track latest TLE for each NORAD ID
    
    for (let i = 0; i < tles.length; i += 3) {
      if (i + 2 < tles.length) {
        const name = tles[i].trim();
        const line1 = tles[i + 1];
        const line2 = tles[i + 2];
        
        try {
          const tleData = TLEParser.parse(line1, line2, name);
          const noradId = tleData.noradId;
          
          // If we've seen this NORAD ID, keep the one with the latest epoch
          if (seenIds.has(noradId)) {
            const existing = seenIds.get(noradId);
            // Compare epochs - keep the newer one
            if (tleData.epoch > existing.epoch) {
              // Replace with newer TLE
              const index = parsed.findIndex(p => p.noradId === noradId);
              if (index >= 0) {
                parsed[index] = {
                  ...tleData,
                  orbitType: TLEParser.getOrbitType(tleData),
                  rawName: name,
                  line1: line1,
                  line2: line2,
                };
                seenIds.set(noradId, tleData);
              }
            }
            // Otherwise skip this duplicate
          } else {
            // First time seeing this NORAD ID
            parsed.push({
              ...tleData,
              orbitType: TLEParser.getOrbitType(tleData),
              rawName: name,
              line1: line1,
              line2: line2,
            });
            noradIds.push(noradId);
            seenIds.set(noradId, tleData);
          }
        } catch (error) {
          console.warn(`Failed to parse TLE: ${error.message}`);
        }
      }
    }

    // Fetch metadata if requested
    if (includeMetadata && noradIds.length > 0) {
      try {
        const metadataMap = await this.fetchObjectMetadata(noradIds);
        
        // Merge metadata into parsed objects
        for (const obj of parsed) {
          const metadata = metadataMap.get(obj.noradId);
          if (metadata) {
            obj.objectType = metadata.objectType;
            // OBJECT_NAME from metadata takes priority
            obj.objectName = metadata.objectName;
            obj.rcsSize = metadata.rcsSize;
            obj.countryCode = metadata.countryCode;
            obj.launchDate = metadata.launchDate;
            
            // Use OBJECT_NAME for the name field too
            if (metadata.objectName && metadata.objectName !== `NORAD ${obj.noradId}`) {
              obj.name = metadata.objectName;
            }
          } else {
            // Default values if metadata not available
            obj.objectType = 'UNKNOWN';
            // Don't use rawName if it looks like TLE data - use NORAD ID instead
            const rawName = obj.rawName || '';
            // Check if rawName is TLE line 2 (starts with "2 " followed by numbers)
            if (rawName && !rawName.match(/^\d+\s+\d{5}U/) && !rawName.match(/^\d+\s+\d{5}\s+/) && rawName.trim().length > 0 && rawName.trim().length < 70) {
              // Only use if it's a reasonable length and doesn't look like TLE
              obj.objectName = rawName.trim();
            } else {
              obj.objectName = `NORAD ${obj.noradId}`;
            }
            obj.rcsSize = 'UNKNOWN';
          }
        }
      } catch (error) {
        console.warn('Failed to fetch metadata, using defaults:', error.message);
        // Add default metadata
        for (const obj of parsed) {
          obj.objectType = 'UNKNOWN';
          // Only use rawName if it looks like a proper name (not TLE line 2)
          const rawName = obj.rawName || '';
          if (rawName && !rawName.match(/^\d+\s+\d{5}U/) && rawName.trim().length > 0) {
            obj.objectName = rawName.trim();
          } else {
            obj.objectName = `NORAD ${obj.noradId}`;
          }
          obj.rcsSize = 'UNKNOWN';
        }
      }
    } else {
      // Add default metadata
      for (const obj of parsed) {
        obj.objectType = 'UNKNOWN';
        obj.objectName = obj.rawName || `NORAD ${obj.noradId}`;
        obj.rcsSize = 'UNKNOWN';
      }
    }

    // Filter by RCS size if specified
    let filtered = parsed;
    if (minRcsSize || maxRcsSize) {
      const rcsSizeOrder = {
        'LARGE': 4,
        'MEDIUM': 3,
        'SMALL': 2,
        'TINY': 1,
        'UNKNOWN': 0,
      };
      
      filtered = parsed.filter(obj => {
        const size = rcsSizeOrder[obj.rcsSize] || 0;
        if (minRcsSize && size < rcsSizeOrder[minRcsSize]) return false;
        if (maxRcsSize && size > rcsSizeOrder[maxRcsSize]) return false;
        return true;
      });
    }

    return filtered;
  }

  /**
   * Parse TLE string into array
   * @param {string} tleString - Raw TLE string
   * @returns {Array} Array of TLE lines
   */
  parseTLEString(tleString) {
    return tleString.trim().split('\n').filter(line => line.trim());
  }

  /**
   * Get cache file path
   * @param {string} key - Cache key
   * @returns {string} File path
   */
  getCachePath(key) {
    return join(config.cache.dir, `${key}.json`);
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
   * @returns {Promise<Array>} Debris TLE data
   */
  async fetchDebrisWithCache(options = {}) {
    const cacheKey = 'debris_tles';
    
    if (!options.forceRefresh && this.isCacheValid(cacheKey)) {
      console.log('Loading debris data from cache...');
      return this.loadCache(cacheKey);
    }

    console.log('Fetching debris data from Space-Track.org...');
    const data = await this.fetchDebrisTLEs(options);
    this.saveCache(cacheKey, data);
    return data;
  }
}

export default DataFetcher;

