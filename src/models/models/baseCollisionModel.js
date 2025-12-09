/**
 * Base Collision Model
 * Abstract base class for collision simulation models
 */
export class BaseCollisionModel {
  constructor(name = 'BaseModel') {
    this.name = name;
  }

  /**
   * Simulate a collision between two objects
   * @param {Object} object1 - First object {mass, velocity, position}
   * @param {Object} object2 - Second object {mass, velocity, position}
   * @param {Object} collisionParams - Additional collision parameters
   * @returns {Object} Collision result with debris fragments
   */
  simulate(object1, object2, collisionParams = {}) {
    throw new Error('simulate() must be implemented by subclass');
  }

  /**
   * Generate debris fragments from collision
   * @param {Object} collisionResult - Result from simulate()
   * @returns {Array} Array of debris fragments
   */
  generateDebris(collisionResult) {
    throw new Error('generateDebris() must be implemented by subclass');
  }

  /**
   * Calculate fragment velocity distribution
   * @param {number} totalEnergy - Total collision energy
   * @param {number} fragmentCount - Number of fragments
   * @returns {Array} Array of velocity magnitudes
   */
  calculateFragmentVelocities(totalEnergy, fragmentCount) {
    // Default: uniform distribution
    const avgEnergy = totalEnergy / fragmentCount;
    const velocities = [];
    
    for (let i = 0; i < fragmentCount; i++) {
      // Random velocity based on energy distribution
      const energy = avgEnergy * (0.5 + Math.random());
      const velocity = Math.sqrt(2 * energy / 0.001); // Assume 1kg fragments
      velocities.push(velocity);
    }
    
    return velocities;
  }

  /**
   * Calculate fragment directions
   * @param {number} count - Number of fragments
   * @param {Object} collisionAxis - Collision axis vector
   * @returns {Array} Array of direction vectors
   */
  calculateFragmentDirections(count, collisionAxis) {
    const directions = [];
    
    for (let i = 0; i < count; i++) {
      // Random direction with some bias along collision axis
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      
      directions.push({ x, y, z });
    }
    
    return directions;
  }
}

