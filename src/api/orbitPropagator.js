import { propagate, twoline2satrec } from 'satellite.js';
import TLEParser from './tleParser.js';

/**
 * Orbit Propagator
 * Uses satellite.js SGP4/SDP4 algorithms to propagate orbits
 */
class OrbitPropagator {
  /**
   * Create a satellite record from TLE
   * @param {string} line1 - First TLE line
   * @param {string} line2 - Second TLE line
   * @returns {Object} Satellite record
   */
  static createSatrec(line1, line2) {
    return twoline2satrec(line1, line2);
  }

  /**
   * Propagate orbit to a specific time
   * @param {Object} satrec - Satellite record from createSatrec
   * @param {Date} date - Target date/time
   * @returns {Object} Position and velocity in ECI coordinates
   */
  static propagate(satrec, date) {
    const positionAndVelocity = propagate(satrec, date);
    
    if (positionAndVelocity.error) {
      throw new Error(`Propagation error: ${positionAndVelocity.error}`);
    }

    return {
      position: {
        x: positionAndVelocity.position.x,
        y: positionAndVelocity.position.y,
        z: positionAndVelocity.position.z,
      },
      velocity: {
        x: positionAndVelocity.velocity.x,
        y: positionAndVelocity.velocity.y,
        z: positionAndVelocity.velocity.z,
      },
      date: date,
    };
  }

  /**
   * Get current position
   * @param {Object} satrec - Satellite record
   * @returns {Object} Current position and velocity
   */
  static getCurrentPosition(satrec) {
    return this.propagate(satrec, new Date());
  }

  /**
   * Get position at multiple time points
   * @param {Object} satrec - Satellite record
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {number} stepSeconds - Time step in seconds
   * @returns {Array} Array of position/velocity objects
   */
  static propagateRange(satrec, startDate, endDate, stepSeconds = 60) {
    const positions = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      try {
        const pos = this.propagate(satrec, new Date(current));
        positions.push(pos);
      } catch (error) {
        console.warn(`Propagation failed at ${current}: ${error.message}`);
      }
      current.setSeconds(current.getSeconds() + stepSeconds);
    }

    return positions;
  }

  /**
   * Calculate orbital parameters from position/velocity
   * @param {Object} position - Position vector {x, y, z}
   * @param {Object} velocity - Velocity vector {x, y, z}
   * @returns {Object} Orbital parameters
   */
  static calculateOrbitalParams(position, velocity) {
    const GM = 398600.4418; // km^3/s^2
    const r = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
    const v = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);
    
    // Specific angular momentum
    const hx = position.y * velocity.z - position.z * velocity.y;
    const hy = position.z * velocity.x - position.x * velocity.z;
    const hz = position.x * velocity.y - position.y * velocity.x;
    const h = Math.sqrt(hx ** 2 + hy ** 2 + hz ** 2);
    
    // Semi-major axis
    const a = 1 / (2 / r - v ** 2 / GM);
    
    // Eccentricity
    const e = Math.sqrt(1 - h ** 2 / (GM * a));
    
    // Period
    const period = 2 * Math.PI * Math.sqrt(a ** 3 / GM);
    
    // Altitude
    const earthRadius = 6378.137; // km
    const altitude = r - earthRadius;
    
    return {
      semiMajorAxis: a,
      eccentricity: e,
      period: period,
      altitude: altitude,
      inclination: Math.acos(hz / h) * (180 / Math.PI),
    };
  }

  /**
   * Create satrec from parsed TLE data
   * @param {Object} tleData - Parsed TLE data from TLEParser
   * @returns {Object} Satellite record
   */
  static fromTLEData(tleData) {
    return this.createSatrec(tleData.line1, tleData.line2);
  }
}

export default OrbitPropagator;

