import { BaseCollisionModel } from './models/baseCollisionModel.js';
import { NASACollisionModel } from './models/nasaModel.js';
import OrbitPropagator from '../api/orbitPropagator.js';

/**
 * Collision Simulator
 * Orchestrates collision simulation using different models
 */
export class CollisionSimulator {
  constructor() {
    this.models = new Map();
    this.defaultModel = 'nasa';
    
    // Register default models
    this.registerModel('nasa', new NASACollisionModel());
  }

  /**
   * Register a collision model
   * @param {string} name - Model name
   * @param {BaseCollisionModel} model - Model instance
   */
  registerModel(name, model) {
    if (!(model instanceof BaseCollisionModel)) {
      throw new Error('Model must extend BaseCollisionModel');
    }
    this.models.set(name, model);
  }

  /**
   * Get a collision model
   * @param {string} name - Model name
   * @returns {BaseCollisionModel} Model instance
   */
  getModel(name) {
    const model = this.models.get(name || this.defaultModel);
    if (!model) {
      throw new Error(`Model '${name}' not found`);
    }
    return model;
  }

  /**
   * Simulate a collision between two objects
   * @param {Object} object1 - First object {noradId, satrec, name, mass}
   * @param {Object} object2 - Second object {noradId, satrec, name, mass}
   * @param {Date} collisionTime - Time of collision
   * @param {string} modelName - Model to use
   * @returns {Object} Simulation result
   */
  simulateCollision(object1, object2, collisionTime, modelName = null) {
    const model = this.getModel(modelName);

    // Get positions and velocities at collision time
    const pos1 = OrbitPropagator.propagate(object1.satrec, collisionTime);
    const pos2 = OrbitPropagator.propagate(object2.satrec, collisionTime);

    // Prepare objects for collision model
    const obj1 = {
      mass: object1.mass || 100,
      position: pos1.position,
      velocity: pos1.velocity,
    };

    const obj2 = {
      mass: object2.mass || 100,
      position: pos2.position,
      velocity: pos2.velocity,
    };

    // Run collision simulation
    const collisionResult = model.simulate(obj1, obj2, { time: collisionTime });

    // Generate debris fragments
    const fragments = model.generateDebris(collisionResult);

    return {
      collision: {
        time: collisionTime,
        object1: {
          noradId: object1.noradId,
          name: object1.name,
        },
        object2: {
          noradId: object2.noradId,
          name: object2.name,
        },
        ...collisionResult,
      },
      fragments,
      model: model.name,
    };
  }

  /**
   * Propagate debris fragments forward in time
   * @param {Array} fragments - Debris fragments
   * @param {Date} startTime - Start time
   * @param {Date} endTime - End time
   * @param {number} stepSeconds - Time step
   * @returns {Array} Fragment trajectories
   */
  propagateFragments(fragments, startTime, endTime, stepSeconds = 60) {
    // Note: This is a simplified propagation
    // In reality, fragments would need TLE generation or numerical integration
    const trajectories = [];

    for (const fragment of fragments) {
      const trajectory = [];
      const current = new Date(startTime);

      while (current <= endTime) {
        // Simple linear propagation (not accurate for orbits)
        // In production, you'd need to convert to orbital elements or use numerical integration
        const elapsed = (current - startTime) / 1000; // seconds
        
        trajectory.push({
          time: new Date(current),
          position: {
            x: fragment.position.x + fragment.velocity.x * elapsed,
            y: fragment.position.y + fragment.velocity.y * elapsed,
            z: fragment.position.z + fragment.velocity.z * elapsed,
          },
          velocity: fragment.velocity,
        });

        current.setSeconds(current.getSeconds() + stepSeconds);
      }

      trajectories.push({
        fragment,
        trajectory,
      });
    }

    return trajectories;
  }

  /**
   * List available models
   * @returns {Array} Array of model names
   */
  listModels() {
    return Array.from(this.models.keys());
  }
}

