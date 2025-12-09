import express from 'express';
import DataFetcher from '../../api/dataFetcher.js';
import DISCOSFetcher from '../../api/discosFetcher.js';
import MockFetcher from '../../api/mockFetcher.js';
import OrbitPropagator from '../../api/orbitPropagator.js';
import { CollisionDetector } from '../../models/collisionDetector.js';
import { modelRegistry } from '../../models/registry.js';
import config from '../../config/config.js';

const router = express.Router();

// Select data source based on configuration
let dataFetcher;
if (config.dataSource === 'discos') {
  dataFetcher = new DISCOSFetcher();
} else if (config.dataSource === 'mock') {
  dataFetcher = new MockFetcher();
} else {
  dataFetcher = new DataFetcher();
}
const detector = new CollisionDetector(config.simulation.collisionThreshold);

/**
 * POST /api/collisions/detect
 * Find close approaches between objects
 */
router.post('/detect', async (req, res) => {
  try {
    const {
      objectIds,
      startTime,
      endTime,
      stepSeconds = 60,
      threshold,
    } = req.body;

    if (!objectIds || objectIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 object IDs required' });
    }

    const startDate = startTime ? new Date(startTime) : new Date();
    const endDate = endTime ? new Date(endTime) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Fetch debris data
    const debris = await dataFetcher.fetchDebrisWithCache();
    
    // Find objects and create satrecs
    const objects = [];
    for (const id of objectIds) {
      const obj = debris.find(d => d.noradId === parseInt(id, 10));
      if (!obj) {
        return res.status(404).json({ error: `Object ${id} not found` });
      }
      
      // Handle both DISCOS (has satrec) and Space-Track (needs TLE parsing)
      let satrec;
      if (obj.satrec) {
        satrec = obj.satrec;
      } else if (obj.line1 && obj.line2) {
        satrec = OrbitPropagator.fromTLEData(obj);
      } else {
        return res.status(400).json({ error: `Object ${id} missing orbital data` });
      }
      
      objects.push({
        noradId: obj.noradId,
        name: obj.name,
        satrec,
      });
    }

    // Detect collisions
    const detectorInstance = threshold 
      ? new CollisionDetector(threshold) 
      : detector;
    
    const collisions = detectorInstance.detectCollisions(
      objects,
      startDate,
      endDate,
      stepSeconds
    );

    // Add collision probabilities
    const collisionsWithProb = collisions.map(collision => ({
      ...collision,
      probability: CollisionDetector.collisionProbability(collision, 1, 1),
    }));

    res.json({
      count: collisionsWithProb.length,
      timeRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      collisions: collisionsWithProb,
    });
  } catch (error) {
    console.error('Error detecting collisions:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/collisions/simulate
 * Run collision simulation
 */
router.post('/simulate', async (req, res) => {
  try {
    const {
      objectId1,
      objectId2,
      collisionTime,
      modelName = 'nasa',
      propagateFragments = false,
      fragmentEndTime,
      fragmentStepSeconds = 60,
    } = req.body;

    if (!objectId1 || !objectId2) {
      return res.status(400).json({ error: 'Both object IDs required' });
    }

    const collisionDate = collisionTime ? new Date(collisionTime) : new Date();

    // Fetch debris data
    const debris = await dataFetcher.fetchDebrisWithCache();
    
    // Find objects
    const obj1 = debris.find(d => d.noradId === parseInt(objectId1, 10));
    const obj2 = debris.find(d => d.noradId === parseInt(objectId2, 10));

    if (!obj1 || !obj2) {
      return res.status(404).json({ error: 'One or both objects not found' });
    }

    // Create satrecs - handle both DISCOS and Space-Track formats
    let satrec1, satrec2;
    if (obj1.satrec) {
      satrec1 = obj1.satrec;
    } else if (obj1.line1 && obj1.line2) {
      satrec1 = OrbitPropagator.fromTLEData(obj1);
    } else {
      return res.status(400).json({ error: 'Object 1 missing orbital data' });
    }

    if (obj2.satrec) {
      satrec2 = obj2.satrec;
    } else if (obj2.line1 && obj2.line2) {
      satrec2 = OrbitPropagator.fromTLEData(obj2);
    } else {
      return res.status(400).json({ error: 'Object 2 missing orbital data' });
    }

    const object1 = {
      noradId: obj1.noradId,
      name: obj1.name,
      satrec: satrec1,
      mass: obj1.attributes?.mass || 100, // Use DISCOS mass if available
    };

    const object2 = {
      noradId: obj2.noradId,
      name: obj2.name,
      satrec: satrec2,
      mass: obj2.attributes?.mass || 100,
    };

    // Run simulation
    const simulator = modelRegistry.getSimulator();
    const result = simulator.simulateCollision(
      object1,
      object2,
      collisionDate,
      modelName
    );

    // Optionally propagate fragments
    let fragmentTrajectories = null;
    if (propagateFragments && fragmentEndTime) {
      fragmentTrajectories = simulator.propagateFragments(
        result.fragments,
        collisionDate,
        new Date(fragmentEndTime),
        fragmentStepSeconds
      );
    }

    res.json({
      ...result,
      fragmentTrajectories,
    });
  } catch (error) {
    console.error('Error simulating collision:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/collisions/models
 * List available collision models
 */
router.get('/models', (req, res) => {
  try {
    const models = modelRegistry.getModels();
    res.json({ models });
  } catch (error) {
    console.error('Error listing models:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

