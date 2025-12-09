import { BaseCollisionModel } from './baseCollisionModel.js';

/**
 * NASA ORDEM-inspired Collision Model
 * Simplified model based on NASA's Orbital Debris Engineering Model principles
 */
export class NASACollisionModel extends BaseCollisionModel {
  constructor() {
    super('NASA Model');
    this.fragmentsPerKg = 0.1; // Fragments per kg of total mass
    this.minFragmentMass = 0.001; // kg
    this.maxFragmentMass = 10; // kg
  }

  /**
   * Simulate collision using NASA-inspired model
   * @param {Object} object1 - First object
   * @param {Object} object2 - Second object
   * @param {Object} collisionParams - Additional parameters
   * @returns {Object} Collision result
   */
  simulate(object1, object2, collisionParams = {}) {
    const mass1 = object1.mass || 100; // kg (default)
    const mass2 = object2.mass || 100; // kg (default)
    const totalMass = mass1 + mass2;

    // Calculate relative velocity
    const dvx = object1.velocity.x - object2.velocity.x;
    const dvy = object1.velocity.y - object2.velocity.y;
    const dvz = object1.velocity.z - object2.velocity.z;
    const relativeVelocity = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz) * 1000; // m/s

    // Calculate collision energy
    const reducedMass = (mass1 * mass2) / (mass1 + mass2);
    const collisionEnergy = 0.5 * reducedMass * relativeVelocity * relativeVelocity; // Joules

    // Calculate center of mass position
    const comX = (mass1 * object1.position.x + mass2 * object2.position.x) / totalMass;
    const comY = (mass1 * object1.position.y + mass2 * object2.position.y) / totalMass;
    const comZ = (mass1 * object1.position.z + mass2 * object2.position.z) / totalMass;

    // Calculate collision axis (normalized relative velocity)
    const axisLength = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
    const collisionAxis = {
      x: dvx / axisLength,
      y: dvy / axisLength,
      z: dvz / axisLength,
    };

    // Estimate fragment count (NASA model: ~0.1 fragments per kg)
    const fragmentCount = Math.max(10, Math.floor(totalMass * this.fragmentsPerKg));

    return {
      collisionTime: collisionParams.time || new Date(),
      collisionPosition: { x: comX, y: comY, z: comZ },
      collisionAxis,
      totalMass,
      relativeVelocity,
      collisionEnergy,
      fragmentCount,
      object1: { mass: mass1, velocity: object1.velocity, position: object1.position },
      object2: { mass: mass2, velocity: object2.velocity, position: object2.position },
    };
  }

  /**
   * Generate debris fragments using NASA model
   * @param {Object} collisionResult - Result from simulate()
   * @returns {Array} Array of debris fragments
   */
  generateDebris(collisionResult) {
    const fragments = [];
    const { fragmentCount, collisionPosition, collisionAxis, collisionEnergy, totalMass } = collisionResult;

    // Calculate fragment mass distribution (power law: N(m) ~ m^-1.6)
    const fragmentMasses = this.calculateFragmentMassDistribution(fragmentCount, totalMass);

    // Calculate fragment velocities
    const fragmentVelocities = this.calculateFragmentVelocities(collisionEnergy, fragmentCount);

    // Calculate fragment directions
    const fragmentDirections = this.calculateFragmentDirections(fragmentCount, collisionAxis);

    // Generate fragments
    for (let i = 0; i < fragmentCount; i++) {
      const mass = fragmentMasses[i];
      const velocityMag = fragmentVelocities[i];
      const direction = fragmentDirections[i];

      // Fragment velocity = center of mass velocity + fragment relative velocity
      const comVelocity = {
        x: (collisionResult.object1.mass * collisionResult.object1.velocity.x +
            collisionResult.object2.mass * collisionResult.object2.velocity.x) / totalMass,
        y: (collisionResult.object1.mass * collisionResult.object1.velocity.y +
            collisionResult.object2.mass * collisionResult.object2.velocity.y) / totalMass,
        z: (collisionResult.object1.mass * collisionResult.object1.velocity.z +
            collisionResult.object2.mass * collisionResult.object2.velocity.z) / totalMass,
      };

      const fragmentVelocity = {
        x: comVelocity.x + direction.x * velocityMag / 1000, // Convert m/s to km/s
        y: comVelocity.y + direction.y * velocityMag / 1000,
        z: comVelocity.z + direction.z * velocityMag / 1000,
      };

      // Fragment position (slightly offset from collision point)
      const offset = (Math.random() - 0.5) * 0.01; // Small random offset
      const fragmentPosition = {
        x: collisionPosition.x + direction.x * offset,
        y: collisionPosition.y + direction.y * offset,
        z: collisionPosition.z + direction.z * offset,
      };

      fragments.push({
        id: `fragment_${i}`,
        mass,
        position: fragmentPosition,
        velocity: fragmentVelocity,
        direction,
        size: this.estimateSize(mass),
      });
    }

    return fragments;
  }

  /**
   * Calculate fragment mass distribution using power law
   * @param {number} count - Number of fragments
   * @param {number} totalMass - Total mass
   * @returns {Array} Array of fragment masses
   */
  calculateFragmentMassDistribution(count, totalMass) {
    const masses = [];
    const alpha = 1.6; // Power law exponent (NASA model)
    
    // Generate masses using power law distribution
    let remainingMass = totalMass;
    
    for (let i = 0; i < count - 1; i++) {
      const u = Math.random();
      const mass = Math.pow(
        Math.pow(this.minFragmentMass, 1 - alpha) +
        u * (Math.pow(this.maxFragmentMass, 1 - alpha) - Math.pow(this.minFragmentMass, 1 - alpha)),
        1 / (1 - alpha)
      );
      
      const actualMass = Math.min(mass, remainingMass * 0.5); // Don't use more than half remaining
      masses.push(actualMass);
      remainingMass -= actualMass;
    }
    
    // Last fragment gets remaining mass
    masses.push(Math.max(remainingMass, this.minFragmentMass));
    
    return masses;
  }

  /**
   * Estimate fragment size from mass
   * @param {number} mass - Mass in kg
   * @returns {number} Size in meters (diameter)
   */
  estimateSize(mass) {
    // Assume density of 2700 kg/m^3 (aluminum-like)
    const density = 2700;
    const volume = mass / density;
    const radius = Math.pow(3 * volume / (4 * Math.PI), 1/3);
    return radius * 2; // diameter
  }
}

