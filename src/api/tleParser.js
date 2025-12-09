/**
 * TLE (Two-Line Element) Parser
 * Parses NORAD TLE format and extracts orbital elements
 */

class TLEParser {
  /**
   * Parse TLE lines into structured data
   * @param {string} line1 - First line of TLE
   * @param {string} line2 - Second line of TLE
   * @param {string} name - Object name (optional)
   * @returns {Object} Parsed TLE data
   */
  static parse(line1, line2, name = '') {
    if (!line1 || !line2) {
      throw new Error('Both TLE lines are required');
    }

    // Validate TLE format
    if (line1[0] !== '1' || line2[0] !== '2') {
      throw new Error('Invalid TLE format: line 1 must start with 1, line 2 must start with 2');
    }

    return {
      name: name.trim(),
      noradId: parseInt(line2.substring(2, 7).trim(), 10),
      classification: line1[7],
      epoch: this.parseEpoch(line1.substring(18, 32)),
      meanMotion: parseFloat(line2.substring(52, 63)),
      eccentricity: parseFloat('0.' + line2.substring(26, 33).trim()),
      inclination: parseFloat(line2.substring(8, 16)),
      raan: parseFloat(line2.substring(17, 25)), // Right Ascension of Ascending Node
      argPerigee: parseFloat(line2.substring(34, 42)), // Argument of Perigee
      meanAnomaly: parseFloat(line2.substring(43, 51)),
      revNumber: parseInt(line2.substring(63, 68).trim(), 10),
      bstar: this.parseBstar(line1.substring(53, 61)),
      line1: line1.trim(),
      line2: line2.trim(),
    };
  }

  /**
   * Parse epoch from TLE format (YYDDD.DDDDDDDD)
   * @param {string} epochStr - Epoch string
   * @returns {Date} Epoch date
   */
  static parseEpoch(epochStr) {
    const year = parseInt(epochStr.substring(0, 2), 10);
    const dayOfYear = parseFloat(epochStr.substring(2));
    
    // Handle 2-digit year (assume 2000-2099)
    const fullYear = year < 57 ? 2000 + year : 1900 + year;
    
    const date = new Date(fullYear, 0, 1);
    date.setDate(date.getDate() + dayOfYear - 1);
    
    return date;
  }

  /**
   * Parse B* drag coefficient
   * @param {string} bstarStr - B* string (0.12345-4 format)
   * @returns {number} B* value
   */
  static parseBstar(bstarStr) {
    const sign = bstarStr[0] === '-' ? -1 : 1;
    const mantissa = parseFloat('0.' + bstarStr.substring(1, 6));
    const exponent = parseInt(bstarStr.substring(6, 8), 10);
    return sign * mantissa * Math.pow(10, exponent);
  }

  /**
   * Determine orbit type from TLE data
   * @param {Object} tleData - Parsed TLE data
   * @returns {string} Orbit type (LEO, MEO, GEO, etc.)
   */
  static getOrbitType(tleData) {
    const period = (24 * 60 * 60) / tleData.meanMotion; // seconds
    const altitude = Math.pow((398600.4418 * Math.pow(period / (2 * Math.PI), 2)), 1/3) - 6378.137; // km

    if (altitude < 2000) return 'LEO';
    if (altitude < 35786) return 'MEO';
    if (altitude < 36000) return 'GEO';
    return 'HEO';
  }

  /**
   * Check if object is likely debris (heuristic)
   * @param {Object} tleData - Parsed TLE data
   * @returns {boolean} True if likely debris
   */
  static isDebris(tleData) {
    // Classification 'U' = unclassified, but we need more heuristics
    // Objects with high B* (drag) or certain orbit characteristics
    return Math.abs(tleData.bstar) > 0.0001 || tleData.classification === 'U';
  }
}

export default TLEParser;

