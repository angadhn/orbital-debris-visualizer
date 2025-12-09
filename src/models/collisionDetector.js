import OrbitPropagator from '../api/orbitPropagator.js';

/**
 * Collision Detector
 * Detects close approaches between orbital objects
 */
export class CollisionDetector {
  constructor(threshold = 1000) {
    this.threshold = threshold; // meters
  }

  /**
   * Calculate distance between two positions
   * @param {Object} pos1 - Position 1 {x, y, z}
   * @param {Object} pos2 - Position 2 {x, y, z}
   * @returns {number} Distance in meters
   */
  static distance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) * 1000; // Convert km to meters
  }

  /**
   * Find close approaches between two objects over a time range
   * @param {Object} satrec1 - Satellite record 1
   * @param {Object} satrec2 - Satellite record 2
   * @param {Date} startDate - Start time
   * @param {Date} endDate - End time
   * @param {number} stepSeconds - Time step in seconds
   * @returns {Array} Array of close approach events
   */
  findCloseApproaches(satrec1, satrec2, startDate, endDate, stepSeconds = 60) {
    const approaches = [];
    const current = new Date(startDate);
    let lastDistance = Infinity;

    while (current <= endDate) {
      try {
        const pos1 = OrbitPropagator.propagate(satrec1, new Date(current));
        const pos2 = OrbitPropagator.propagate(satrec2, new Date(current));
        
        const distance = CollisionDetector.distance(pos1.position, pos2.position);
        
        // Detect minimum distance (local minimum)
        if (distance < this.threshold) {
          const isMinimum = lastDistance > distance && 
            (current.getTime() + stepSeconds * 1000 > endDate.getTime() || 
             CollisionDetector.distance(
               OrbitPropagator.propagate(satrec1, new Date(current.getTime() + stepSeconds * 1000)).position,
               OrbitPropagator.propagate(satrec2, new Date(current.getTime() + stepSeconds * 1000)).position
             ) > distance);

          if (isMinimum) {
            approaches.push({
              time: new Date(current),
              distance: distance,
              position1: pos1.position,
              position2: pos2.position,
              velocity1: pos1.velocity,
              velocity2: pos2.velocity,
            });
          }
        }

        lastDistance = distance;
        current.setSeconds(current.getSeconds() + stepSeconds);
      } catch (error) {
        // Skip if propagation fails
        current.setSeconds(current.getSeconds() + stepSeconds);
      }
    }

    return approaches;
  }

  /**
   * Detect collisions between multiple objects
   * @param {Array} objects - Array of {noradId, satrec, name}
   * @param {Date} startDate - Start time
   * @param {Date} endDate - End time
   * @param {number} stepSeconds - Time step
   * @returns {Array} Array of collision events
   */
  detectCollisions(objects, startDate, endDate, stepSeconds = 60) {
    const collisions = [];

    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const approaches = this.findCloseApproaches(
          objects[i].satrec,
          objects[j].satrec,
          startDate,
          endDate,
          stepSeconds
        );

        for (const approach of approaches) {
          collisions.push({
            object1: {
              noradId: objects[i].noradId,
              name: objects[i].name,
            },
            object2: {
              noradId: objects[j].noradId,
              name: objects[j].name,
            },
            ...approach,
          });
        }
      }
    }

    return collisions.sort((a, b) => a.time - b.time);
  }

  /**
   * Calculate relative velocity between two objects
   * @param {Object} vel1 - Velocity 1 {x, y, z}
   * @param {Object} vel2 - Velocity 2 {x, y, z}
   * @returns {number} Relative velocity in m/s
   */
  static relativeVelocity(vel1, vel2) {
    const dvx = vel1.x - vel2.x;
    const dvy = vel1.y - vel2.y;
    const dvz = vel1.z - vel2.z;
    return Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz) * 1000; // Convert km/s to m/s
  }

  /**
   * Calculate collision probability (simplified)
   * @param {Object} approach - Close approach event
   * @param {number} radius1 - Object 1 radius (meters)
   * @param {number} radius2 - Object 2 radius (meters)
   * @returns {number} Collision probability (0-1)
   */
  static collisionProbability(approach, radius1 = 1, radius2 = 1) {
    const combinedRadius = radius1 + radius2;
    const relativeVel = CollisionDetector.relativeVelocity(
      approach.velocity1,
      approach.velocity2
    );

    if (approach.distance <= combinedRadius) {
      return 1.0; // Direct collision
    }

    // Simplified probability based on distance and relative velocity
    const missDistance = approach.distance - combinedRadius;
    const probability = Math.exp(-missDistance / (relativeVel * 0.1));
    
    return Math.min(probability, 1.0);
  }
}

