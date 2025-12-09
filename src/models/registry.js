import { CollisionSimulator } from './collisionSimulator.js';

/**
 * Model Registry
 * Manages collision model registration and selection
 */
export class ModelRegistry {
  constructor() {
    this.simulator = new CollisionSimulator();
  }

  /**
   * Register a custom collision model
   * @param {string} name - Model name
   * @param {BaseCollisionModel} model - Model instance
   */
  registerModel(name, model) {
    this.simulator.registerModel(name, model);
  }

  /**
   * Get simulator instance
   * @returns {CollisionSimulator} Simulator instance
   */
  getSimulator() {
    return this.simulator;
  }

  /**
   * Get available models
   * @returns {Array} Array of model info
   */
  getModels() {
    return this.simulator.listModels().map(name => ({
      name,
      description: this.getModelDescription(name),
    }));
  }

  /**
   * Get model description
   * @param {string} name - Model name
   * @returns {string} Description
   */
  getModelDescription(name) {
    const descriptions = {
      nasa: 'NASA ORDEM-inspired model with power-law fragment distribution',
      custom: 'Custom model template for user-defined physics',
    };
    return descriptions[name] || 'Unknown model';
  }
}

// Export singleton instance
export const modelRegistry = new ModelRegistry();

