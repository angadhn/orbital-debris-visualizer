import OrbitPropagator from './orbitPropagator.js';

/**
 * Mock Data Fetcher
 * Generates sample debris data for testing without API dependencies
 */
class MockFetcher {
  constructor() {
    this.sampleTLEs = [
      {
        name: 'COSMOS 2251 DEB',
        line1: '1 22675U 93036AY  24123.45678901  .00012345  00000+0  12345-3 0  9999',
        line2: '2 22675  74.0123 123.4567 0012345 234.5678 125.4321 14.12345678901234',
      },
      {
        name: 'IRIDIUM 33 DEB',
        line1: '1 24946U 97051CZ  24123.45678901  .00012345  00000+0  12345-3 0  9999',
        line2: '2 24946  86.4012 234.5678 0012345 345.6789 014.3210 14.23456789012345',
      },
      {
        name: 'FENGYUN 1C DEB',
        line1: '1 28947U 06003AZ  24123.45678901  .00012345  00000+0  12345-3 0  9999',
        line2: '2 28947  98.5012 345.6789 0012345 456.7890 103.2109 14.34567890123456',
      },
    ];
  }

  /**
   * Generate sample debris data
   * @param {Object} options - Options
   * @returns {Promise<Array>} Debris objects
   */
  async fetchDebris(options = {}) {
    const { limit = 100 } = options;
    const debris = [];

    // Generate multiple debris objects with variations
    for (let i = 0; i < Math.min(limit, 1000); i++) {
      const baseTLE = this.sampleTLEs[i % this.sampleTLEs.length];
      
      // Create variations
      const noradId = 20000 + i;
      const epoch = new Date();
      epoch.setDate(epoch.getDate() - Math.random() * 30);
      
      // Modify TLE slightly for each object
      const line1 = baseTLE.line1.replace(/22675|24946|28947/, String(noradId).padStart(5, '0'));
      const line2 = baseTLE.line2.replace(/22675|24946|28947/, String(noradId).padStart(5, '0'));
      
      // Add random variations to orbital elements
      const inclination = 74 + Math.random() * 25; // 74-99 degrees
      const raan = Math.random() * 360;
      const eccentricity = Math.random() * 0.1;
      const argPerigee = Math.random() * 360;
      const meanAnomaly = Math.random() * 360;
      const meanMotion = 12 + Math.random() * 4; // 12-16 revs/day
      
      // Format TLE line 2 with variations
      const line2Modified = `2 ${String(noradId).padStart(5, '0')} ${inclination.toFixed(4).padStart(8, ' ')} ${raan.toFixed(4).padStart(8, ' ')} ${eccentricity.toFixed(7).substring(2).padStart(7, '0')} ${argPerigee.toFixed(4).padStart(8, ' ')} ${meanAnomaly.toFixed(4).padStart(8, ' ')} ${meanMotion.toFixed(8).padStart(11, ' ')}00000    0`;
      
      try {
        const satrec = OrbitPropagator.createSatrec(line1, line2Modified);
        
        debris.push({
          noradId,
          name: `${baseTLE.name} ${i + 1}`,
          orbitType: inclination < 2000 ? 'LEO' : 'MEO',
          inclination,
          eccentricity,
          raan,
          argPerigee,
          meanAnomaly,
          meanMotion,
          satrec,
          tle: {
            line1,
            line2: line2Modified,
          },
        });
      } catch (error) {
        // Skip invalid TLEs
        console.warn(`Failed to create debris object ${i}:`, error.message);
      }
    }

    return debris;
  }

  /**
   * Fetch debris with caching (mock version)
   * @param {Object} options - Options
   * @returns {Promise<Array>} Debris data
   */
  async fetchDebrisWithCache(options = {}) {
    return this.fetchDebris(options);
  }
}

export default MockFetcher;

