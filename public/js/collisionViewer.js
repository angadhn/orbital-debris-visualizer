/**
 * Collision Viewer
 * Handles collision detection and simulation visualization
 */
class CollisionViewer {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.collisionEntities = new Map();
        this.fragmentEntities = new Map();
        this.api = new APIClient();
    }

    async detectCollisions(objectIds, timeRangeHours = 24) {
        try {
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + timeRangeHours * 60 * 60 * 1000);

            const results = await this.api.detectCollisions(objectIds, startTime, endTime);
            
            // Display results
            const resultsDiv = document.getElementById('collisionResults');
            resultsDiv.innerHTML = `<h4>Found ${results.count} close approaches</h4>`;
            
            if (results.collisions.length > 0) {
                results.collisions.slice(0, 10).forEach(collision => {
                    const item = document.createElement('div');
                    item.className = 'collision-item';
                    item.innerHTML = `
                        <strong>${collision.object1.name || collision.object1.noradId}</strong> ↔ 
                        <strong>${collision.object2.name || collision.object2.noradId}</strong><br>
                        Time: ${new Date(collision.time).toLocaleString()}<br>
                        Distance: ${(collision.distance / 1000).toFixed(2)} km<br>
                        Probability: ${(collision.probability * 100).toFixed(2)}%
                    `;
                    resultsDiv.appendChild(item);
                });

                // Visualize collisions
                this.visualizeCollisions(results.collisions);
            } else {
                resultsDiv.innerHTML += '<p>No collisions detected in the specified time range.</p>';
            }
        } catch (error) {
            console.error('Error detecting collisions:', error);
            document.getElementById('collisionResults').innerHTML = 
                `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }

    visualizeCollisions(collisions) {
        // Clear previous collision highlights
        this.clearCollisionHighlights();

        // Highlight colliding objects
        collisions.forEach(collision => {
            this.visualizer.highlightObject(collision.object1.noradId, Cesium.Color.ORANGE);
            this.visualizer.highlightObject(collision.object2.noradId, Cesium.Color.RED);

            // Draw connection line
            const pos1 = new Cesium.Cartesian3(
                collision.position1.x * 1000,
                collision.position1.y * 1000,
                collision.position1.z * 1000
            );
            const pos2 = new Cesium.Cartesian3(
                collision.position2.x * 1000,
                collision.position2.y * 1000,
                collision.position2.z * 1000
            );

            const entity = this.visualizer.addEntity({
                polyline: {
                    positions: [pos1, pos2],
                    width: 2,
                    material: Cesium.Color.RED.withAlpha(0.7),
                },
            });

            this.collisionEntities.set(`collision_${collision.object1.noradId}_${collision.object2.noradId}`, entity);
        });
    }

    async simulateCollision(objectId1, objectId2, modelName = 'nasa') {
        try {
            const collisionTime = new Date();
            const results = await this.api.simulateCollision(
                objectId1,
                objectId2,
                collisionTime,
                modelName,
                true
            );

            // Display results
            const resultsDiv = document.getElementById('simulationResults');
            resultsDiv.innerHTML = `
                <h4>Collision Simulation Results</h4>
                <p><strong>Model:</strong> ${results.model}</p>
                <p><strong>Fragments Generated:</strong> ${results.fragments.length}</p>
                <p><strong>Collision Energy:</strong> ${(results.collision.collisionEnergy / 1e6).toFixed(2)} MJ</p>
                <p><strong>Relative Velocity:</strong> ${(results.collision.relativeVelocity / 1000).toFixed(2)} km/s</p>
            `;

            // Visualize collision and debris
            this.visualizeCollision(results.collision);
            this.visualizeDebrisCloud(results.fragments, results.collision.collisionPosition);
        } catch (error) {
            console.error('Error simulating collision:', error);
            document.getElementById('simulationResults').innerHTML = 
                `<p style="color: red;">Error: ${error.message}</p>`;
        }
    }

    visualizeCollision(collision) {
        // Highlight colliding objects
        this.visualizer.highlightObject(collision.object1.noradId, Cesium.Color.ORANGE);
        this.visualizer.highlightObject(collision.object2.noradId, Cesium.Color.RED);

        // Mark collision point
        const collisionPos = new Cesium.Cartesian3(
            collision.collisionPosition.x * 1000,
            collision.collisionPosition.y * 1000,
            collision.collisionPosition.z * 1000
        );

        const entity = this.visualizer.addEntity({
            position: collisionPos,
            point: {
                pixelSize: 15,
                color: Cesium.Color.RED,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
            },
            label: {
                text: 'COLLISION',
                font: '16px sans-serif',
                fillColor: Cesium.Color.RED,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            },
        });

        this.collisionEntities.set('collision_point', entity);
    }

    visualizeDebrisCloud(fragments, centerPosition) {
        // Clear previous fragments
        this.clearDebrisCloud();

        const center = new Cesium.Cartesian3(
            centerPosition.x * 1000,
            centerPosition.y * 1000,
            centerPosition.z * 1000
        );

        // Visualize fragments (sample for performance)
        const sampleSize = Math.min(100, fragments.length);
        const sampled = fragments.slice(0, sampleSize);

        sampled.forEach((fragment, index) => {
            const pos = new Cesium.Cartesian3(
                fragment.position.x * 1000,
                fragment.position.y * 1000,
                fragment.position.z * 1000
            );

            // Size based on fragment mass
            const size = Math.max(2, Math.min(8, fragment.mass * 10));

            const entity = this.visualizer.addEntity({
                id: `fragment_${index}`,
                position: pos,
                point: {
                    pixelSize: size,
                    color: Cesium.Color.YELLOW.withAlpha(0.7),
                    outlineColor: Cesium.Color.ORANGE,
                    outlineWidth: 1,
                },
            });

            this.fragmentEntities.set(`fragment_${index}`, entity);
        });

        // Draw explosion effect (sphere)
        const explosionEntity = this.visualizer.addEntity({
            position: center,
            ellipsoid: {
                radii: new Cesium.Cartesian3(50000, 50000, 50000),
                material: Cesium.Color.RED.withAlpha(0.2),
                outline: true,
                outlineColor: Cesium.Color.RED,
            },
        });

        this.fragmentEntities.set('explosion', explosionEntity);
    }

    clearCollisionHighlights() {
        this.collisionEntities.forEach(entity => {
            this.visualizer.getViewer().entities.remove(entity);
        });
        this.collisionEntities.clear();
        this.visualizer.clearHighlights();
    }

    clearDebrisCloud() {
        this.fragmentEntities.forEach(entity => {
            this.visualizer.getViewer().entities.remove(entity);
        });
        this.fragmentEntities.clear();
    }

    clearAll() {
        this.clearCollisionHighlights();
        this.clearDebrisCloud();
    }
}

// Export for use in other scripts
window.CollisionViewer = CollisionViewer;

