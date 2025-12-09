import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../config/config.js';
import debrisRoutes from './routes/debris.js';
import collisionRoutes from './routes/collisions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../../public')));

// API Routes
app.use('/api/debris', debrisRoutes);
app.use('/api/collisions', collisionRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || config.server.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Orbital Debris Visualization Server running on port ${PORT}`);
  console.log(`Environment: ${config.server.env}`);
  console.log(`Data source: ${config.dataSource}`);
}).on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

export default app;

