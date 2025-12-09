/**
 * Debris Visualizer using CesiumJS
 */
class DebrisVisualizer {
    constructor(containerId) {
        this.containerId = containerId;
        this.viewer = null;
        this.entities = new Map();
        this.debrisData = [];
        this.maxObjects = 1000;
        this.showLabels = true;
        this.showTrails = false; // Don't show trails by default
        this.updateInterval = null;
        this.selectedEntity = null;
        this.orbitPaths = new Map();
        
        this.initCesium();
    }

    initCesium() {
        // Set Cesium Ion access token
        // Get a free token from https://cesium.com/ion/signup/
        // You can also set it via environment variable or config
        if (typeof window.CESIUM_ION_TOKEN !== 'undefined') {
            Cesium.Ion.defaultAccessToken = window.CESIUM_ION_TOKEN;
        } else {
            // Cesium Ion token
            Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI2YWQ1ZmZmZi01ZGM2LTQyNDktYTAzNi02NzE0YzE1MjY3OTEiLCJpZCI6MzY4MTIzLCJpYXQiOjE3NjUzMDMyNjV9.bOeEyeJAhTPrdyUYDKX5zwoVAJd8EJNOIu_GLkFct0A';
        }

        // Use EllipsoidTerrainProvider as fallback (works without Ion token)
        const terrainProvider = Cesium.createWorldTerrain ? 
            Cesium.createWorldTerrain() : 
            new Cesium.EllipsoidTerrainProvider();
        
        this.viewer = new Cesium.Viewer(this.containerId, {
            terrainProvider: terrainProvider,
            animation: true,
            timeline: true,
            vrButton: false,
            geocoder: false,
            homeButton: true,
            infoBox: true,
            sceneModePicker: true,
            baseLayerPicker: true,
            navigationHelpButton: true,
            fullscreenButton: true,
        });

        // Set up click handler for entities
        this.viewer.cesiumWidget.screenSpaceEventHandler.setInputAction((click) => {
            const pickedObject = this.viewer.scene.pick(click.position);
            if (Cesium.defined(pickedObject) && pickedObject.id) {
                this.onEntityClick(pickedObject.id);
            } else {
                // Clicked on empty space - deselect
                this.deselectEntity();
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
        
        // Add equator line
        this.addEquator();
        
        // Set initial camera position - Equator view
        // Center on equator: 0° longitude (Greenwich), 0° latitude (equator)
        this.viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(0, 0, 20000000), // Equator at prime meridian, zoomed out
            orientation: {
                heading: Cesium.Math.toRadians(0), // North up
                pitch: Cesium.Math.toRadians(-45), // 45° down for good equator view
                roll: 0.0
            }
        });

        // Update clock
        this.viewer.clock.onTick.addEventListener(() => {
            this.updatePositions();
        });
    }
    
    addEquator() {
        // Create equator line (latitude 0°)
        const positions = [];
        const steps = 360; // One point per degree
        
        for (let i = 0; i <= steps; i++) {
            const longitude = Cesium.Math.toRadians(i);
            const latitude = 0; // Equator
            positions.push(Cesium.Cartesian3.fromRadians(longitude, latitude));
        }
        
        // Add equator entity
        this.viewer.entities.add({
            id: 'equator',
            name: 'Equator',
            polyline: {
                positions: positions,
                width: 2,
                material: Cesium.Color.YELLOW.withAlpha(0.6),
                clampToGround: false,
                arcType: Cesium.ArcType.GEODESIC,
            },
        });
        
        // Add North Pole marker
        this.viewer.entities.add({
            id: 'north_pole',
            name: 'North Pole',
            position: Cesium.Cartesian3.fromDegrees(0, 90, 0),
            point: {
                pixelSize: 8,
                color: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
            },
            label: {
                text: 'N',
                font: '16px sans-serif',
                fillColor: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -15),
            },
        });
        
        // Add South Pole marker
        this.viewer.entities.add({
            id: 'south_pole',
            name: 'South Pole',
            position: Cesium.Cartesian3.fromDegrees(0, -90, 0),
            point: {
                pixelSize: 8,
                color: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 2,
            },
            label: {
                text: 'S',
                font: '16px sans-serif',
                fillColor: Cesium.Color.CYAN,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -15),
            },
        });
        
        // Add London marker for reference
        this.viewer.entities.add({
            id: 'london',
            name: 'London',
            position: Cesium.Cartesian3.fromDegrees(-0.1276, 51.5074, 0),
            point: {
                pixelSize: 6,
                color: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
            },
            label: {
                text: 'London',
                font: '12px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
            },
        });
    }

    async loadDebris(forceRefresh = false) {
        try {
            console.log('Loading debris data...');
            const api = new APIClient();
            
            // Get filter values
            const objectTypeSelect = document.getElementById('objectTypeFilter');
            const selectedTypes = objectTypeSelect ? Array.from(objectTypeSelect.selectedOptions).map(opt => opt.value) : [];
            const rcsSize = document.getElementById('rcsSizeFilter')?.value || '';
            const orbitType = document.getElementById('orbitTypeFilter')?.value || '';
            
            const response = await api.getDebris({
                limit: this.maxObjects,
                forceRefresh,
                objectTypes: selectedTypes.length > 0 ? selectedTypes.join(',') : undefined,
                minRcsSize: rcsSize || undefined,
                maxRcsSize: rcsSize || undefined,
                orbitType: orbitType || undefined,
            });

            console.log(`Received ${response.data?.length || 0} objects from API`);
            this.debrisData = response.data || [];
            
            if (this.debrisData.length === 0) {
                console.warn('No debris data received');
                document.getElementById('objectCount').textContent = 'No objects loaded';
                return;
            }
            
            this.renderDebris();
            
            // Update UI with filter info
            const filterInfo = [];
            if (selectedTypes.length > 0) filterInfo.push(`Types: ${selectedTypes.join(', ')}`);
            if (rcsSize) filterInfo.push(`Size: ${rcsSize}`);
            if (orbitType) filterInfo.push(`Orbit: ${orbitType}`);
            
            const filterText = filterInfo.length > 0 ? ` (${filterInfo.join(', ')})` : '';
            document.getElementById('objectCount').textContent = 
                `${this.debrisData.length} objects loaded${filterText} (${response.total || 0} total available)`;
            
            console.log(`Rendered ${this.entities.size} entities`);
        } catch (error) {
            console.error('Error loading debris:', error);
            alert(`Failed to load debris data: ${error.message}`);
        }
    }

    renderDebris() {
        console.log(`Rendering ${this.debrisData.length} debris objects...`);
        
        // Clear existing entities
        this.entities.forEach((entity, id) => {
            this.viewer.entities.remove(entity);
        });
        this.entities.clear();

        // Check if satellite.js is loaded
        if (typeof satellite === 'undefined') {
            console.error('satellite.js is not loaded! Check the script tag in index.html');
            alert('Error: satellite.js library not loaded. Please refresh the page.');
            return;
        }

        // Color map for orbit types
        const colorMap = {
            LEO: Cesium.Color.CYAN,
            MEO: Cesium.Color.YELLOW,
            GEO: Cesium.Color.GREEN,
            HEO: Cesium.Color.MAGENTA,
        };

        let renderedCount = 0;
        let errorCount = 0;

        // Render debris objects
        for (const debris of this.debrisData) {
            try {
                const color = colorMap[debris.orbitType] || Cesium.Color.WHITE;
                
                // Calculate initial position
                let initialPosition;
                let satrec = debris.satrec;
                
                // If no satrec but we have TLE lines, create satrec
                if (!satrec && debris.line1 && debris.line2) {
                    try {
                        if (satellite.twoline2satrec) {
                            satrec = satellite.twoline2satrec(debris.line1, debris.line2);
                            debris.satrec = satrec;
                        } else {
                            console.error('satellite.twoline2satrec not available');
                            errorCount++;
                            continue;
                        }
                    } catch (error) {
                        console.warn(`Failed to create satrec for ${debris.noradId}:`, error);
                        errorCount++;
                        continue;
                    }
                }
                
                if (!satrec) {
                    console.warn(`No satrec for ${debris.noradId}, skipping`);
                    errorCount++;
                    continue;
                }
                
                // Use satrec to propagate position
                try {
                    const date = new Date();
                    // Try different possible function names
                    let propagate = satellite.propagate || 
                                   (window.satellite && window.satellite.propagate);
                    
                    if (!propagate && satellite.default) {
                        propagate = satellite.default.propagate;
                    }
                    
                    if (!propagate) {
                        console.error('satellite.propagate not available');
                        errorCount++;
                        continue;
                    }
                    
                    const positionAndVelocity = propagate(satrec, date);
                    if (positionAndVelocity && positionAndVelocity.position && !positionAndVelocity.error) {
                        const pos = positionAndVelocity.position;
                        initialPosition = new Cesium.Cartesian3(pos.x * 1000, pos.y * 1000, pos.z * 1000);
                    } else {
                        console.warn(`Failed to propagate ${debris.noradId}:`, positionAndVelocity?.error);
                        errorCount++;
                        continue;
                    }
                } catch (error) {
                    console.warn(`Propagation error for ${debris.noradId}:`, error);
                    errorCount++;
                    continue;
                }

                // Create entity with calculated position
                this.createDebrisEntity(debris, initialPosition, color);
                renderedCount++;
            } catch (error) {
                console.warn(`Failed to render debris ${debris.noradId}:`, error);
                errorCount++;
            }
        }
        
        console.log(`Rendering complete: ${renderedCount} rendered, ${errorCount} skipped`);
        
        // Zoom to all entities if any were rendered
        if (renderedCount > 0) {
            this.viewer.zoomTo(this.viewer.entities);
        } else {
            console.warn('No entities were rendered! Check console for errors.');
        }
        
        // Update UI
        if (document.getElementById('objectCount')) {
            const currentText = document.getElementById('objectCount').textContent;
            document.getElementById('objectCount').textContent = 
                currentText.replace(/objects loaded/, `objects loaded (${renderedCount} visible)`);
        }
    }

    createDebrisEntity(debris, position, color) {
        // Check if entity already exists
        const entityId = `debris_${debris.noradId}`;
        if (this.entities.has(debris.noradId)) {
            // Update existing entity instead of creating duplicate
            const existingEntity = this.entities.get(debris.noradId);
            if (existingEntity.position) {
                existingEntity.position.setValue(position);
            }
            return existingEntity;
        }
        
        // Build label text with object info
        // Prioritize objectName from metadata, then name, avoid rawName (raw TLE line)
        let labelText = debris.objectName || 
                       (debris.name && debris.name !== debris.rawName ? debris.name : null) || 
                       `NORAD ${debris.noradId}`;
        
        // Clean up label - remove any TLE-like patterns
        if (labelText && labelText.match(/^\d+\s+\d{5}U/)) {
            // This looks like raw TLE line 2, use NORAD ID instead
            labelText = `NORAD ${debris.noradId}`;
        }
        
        const showObjectType = document.getElementById('showObjectType')?.checked;
        if (showObjectType && debris.objectType && debris.objectType !== 'UNKNOWN') {
            labelText += ` (${debris.objectType})`;
        }
        
        // Adjust point size based on object type
        let pointSize = 3;
        if (debris.objectType === 'PAYLOAD') pointSize = 5;
        else if (debris.objectType === 'ROCKET BODY') pointSize = 4;
        else if (debris.objectType === 'DEBRIS' || debris.objectType === 'FRAGMENT') pointSize = 2;
        
        // Adjust color based on object type
        let pointColor = color;
        if (debris.objectType === 'PAYLOAD') pointColor = Cesium.Color.GREEN;
        else if (debris.objectType === 'ROCKET BODY') pointColor = Cesium.Color.ORANGE;
        else if (debris.objectType === 'DEBRIS' || debris.objectType === 'FRAGMENT') pointColor = Cesium.Color.RED;
        
        const entity = this.viewer.entities.add({
            id: entityId,
            name: labelText,
            position: position,
            point: {
                pixelSize: pointSize,
                color: pointColor,
                outlineColor: Cesium.Color.WHITE,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.NONE,
            },
            label: this.showLabels ? {
                text: labelText,
                font: '12px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
            } : undefined,
            polyline: this.showTrails ? {
                positions: [position, position], // Will be updated
                width: 1,
                material: pointColor.withAlpha(0.5),
            } : undefined,
            properties: {
                noradId: debris.noradId,
                orbitType: debris.orbitType,
                objectType: debris.objectType,
                objectName: debris.objectName,
                rcsSize: debris.rcsSize,
                inclination: debris.inclination,
                eccentricity: debris.eccentricity,
                satrec: debris.satrec, // Store satrec for position updates
            },
        });

        this.entities.set(debris.noradId, entity);
        
        // Store debris data in entity for later use
        entity._debrisData = debris;
    }
    
    onEntityClick(entity) {
        // Get NORAD ID from entity
        const noradId = entity.properties?.noradId?.getValue();
        if (!noradId) return;
        
        // Deselect previous entity
        this.deselectEntity();
        
        // Select this entity
        this.selectedEntity = entity;
        
        // Highlight the entity
        if (entity.point) {
            entity._originalColor = entity.point.color.getValue();
            entity.point.color = Cesium.Color.CYAN;
            entity.point.pixelSize = 10;
        }
        
        // Show orbit path
        this.showOrbitPath(noradId, entity._debrisData);
        
        // Animate the entity along its orbit
        const animationSpeed = this.animateEntity(entity);
        
        // Zoom out to show orbit (don't zoom into object)
        this.zoomToOrbit(entity);
        
        // Show info panel with animation speed
        this.showEntityInfo(entity, animationSpeed);
    }
    
    zoomToOrbit(entity) {
        // Get the orbit path entity
        const noradId = entity.properties?.noradId?.getValue();
        const orbitEntity = this.orbitPaths.get(noradId);
        
        if (orbitEntity && orbitEntity.polyline) {
            // Fly to the orbit path (shows the whole orbit)
            this.viewer.flyTo(orbitEntity.polyline, {
                duration: 2.0,
                offset: new Cesium.HeadingPitchRange(
                    0, // Heading (north)
                    Cesium.Math.toRadians(-45), // Pitch (45 degrees down)
                    0 // Range (auto-calculate to fit)
                )
            });
        } else {
            // Fallback: zoom out from entity
            const position = entity.position.getValue();
            const cartographic = Cesium.Cartographic.fromCartesian(position);
            const height = Math.max(10000000, cartographic.height * 3); // Zoom out 3x or min 10,000km
            
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromRadians(
                    cartographic.longitude,
                    cartographic.latitude,
                    height
                ),
                orientation: {
                    heading: 0,
                    pitch: Cesium.Math.toRadians(-45),
                    roll: 0
                },
                duration: 2.0
            });
        }
    }
    
    animateEntity(entity) {
        const debris = entity._debrisData;
        if (!debris || (!debris.satrec && (!debris.line1 || !debris.line2))) {
            return 1;
        }
        
        // Get or create satrec
        let satrec = debris.satrec;
        if (!satrec && debris.line1 && debris.line2) {
            try {
                const twoline2satrec = satellite.twoline2satrec || 
                                     (satellite.default && satellite.default.twoline2satrec);
                if (twoline2satrec) {
                    satrec = twoline2satrec(debris.line1, debris.line2);
                } else {
                    return 1;
                }
            } catch (error) {
                console.error('Failed to create satrec for animation:', error);
                return 1;
            }
        }
        
        if (!satrec) return 1;
        
        // Store original position if not already animated
        if (!entity._isAnimated) {
            entity._originalPosition = entity.position.getValue();
            entity._isAnimated = true;
        }
        
        // Calculate orbital period
        const periodMinutes = 1440 / debris.meanMotion;
        const periodSeconds = periodMinutes * 60;
        
        // Speed up animation (1 orbit per 30 seconds instead of real-time)
        const animationSpeed = periodSeconds / 30; // Compress time
        const speedMultiplier = Math.round(animationSpeed); // Round for display
        
        // Set up time-dependent position using CallbackProperty
        entity.position = new Cesium.CallbackProperty((time, result) => {
            if (!time) {
                return entity._originalPosition || Cesium.Cartesian3.ZERO;
            }
            
            // Convert Cesium time to JavaScript Date
            const date = Cesium.JulianDate.toDate(time);
            
            // Calculate time offset for animation (speed up)
            const startTime = Cesium.JulianDate.toDate(this.viewer.clock.startTime);
            const elapsedSeconds = (date.getTime() - startTime.getTime()) / 1000;
            const animatedSeconds = elapsedSeconds * animationSpeed;
            const animatedDate = new Date(startTime.getTime() + animatedSeconds * 1000);
            
            try {
                const propagate = satellite.propagate || 
                                 (satellite.default && satellite.default.propagate);
                if (!propagate) {
                    return entity._originalPosition || Cesium.Cartesian3.ZERO;
                }
                
                const result_prop = propagate(satrec, animatedDate);
                if (result_prop && result_prop.position && !result_prop.error) {
                    const pos = result_prop.position;
                    if (isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)) {
                        return Cesium.Cartesian3.fromElements(
                            pos.x * 1000,
                            pos.y * 1000,
                            pos.z * 1000,
                            result
                        );
                    }
                }
            } catch (error) {
                // Fallback to original position
            }
            
            return entity._originalPosition || Cesium.Cartesian3.ZERO;
        }, false);
        
        // Set up animation time range (one orbit period)
        const now = Cesium.JulianDate.now();
        const startTime = Cesium.JulianDate.clone(now);
        const stopTime = Cesium.JulianDate.addSeconds(startTime, 30, new Cesium.JulianDate()); // 30 seconds for one orbit
        
        // Configure clock for animation
        this.viewer.clock.startTime = startTime.clone();
        this.viewer.clock.stopTime = stopTime.clone();
        this.viewer.clock.currentTime = startTime.clone();
        this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; // Loop the animation
        this.viewer.clock.multiplier = 1; // Normal speed (we handle speed in CallbackProperty)
        
        // Start animation
        this.viewer.clock.shouldAnimate = true;
    }
    
    deselectEntity() {
        if (this.selectedEntity) {
            // Stop animation and restore static position
            if (this.selectedEntity._isAnimated) {
                const originalPos = this.selectedEntity._originalPosition;
                if (originalPos) {
                    this.selectedEntity.position = originalPos;
                }
                this.selectedEntity._isAnimated = false;
            }
            
            // Restore original appearance
            if (this.selectedEntity.point && this.selectedEntity._originalColor) {
                this.selectedEntity.point.color = this.selectedEntity._originalColor;
                // Restore original size based on object type
                const debris = this.selectedEntity._debrisData;
                if (debris) {
                    let pointSize = 3;
                    if (debris.objectType === 'PAYLOAD') pointSize = 5;
                    else if (debris.objectType === 'ROCKET BODY') pointSize = 4;
                    else if (debris.objectType === 'DEBRIS' || debris.objectType === 'FRAGMENT') pointSize = 2;
                    this.selectedEntity.point.pixelSize = pointSize;
                }
            }
            this.selectedEntity = null;
        }
        
        // Stop animation
        this.viewer.clock.shouldAnimate = false;
        
        // Hide orbit paths
        this.hideOrbitPaths();
        
        // Hide info panel
        this.hideEntityInfo();
    }
    
    showOrbitPath(noradId, debris) {
        // Remove existing path if any
        this.hideOrbitPath(noradId);
        
        if (!debris || (!debris.satrec && (!debris.line1 || !debris.line2))) {
            console.warn('No TLE data available for orbit path');
            return;
        }
        
        // Get or create satrec
        let satrec = debris.satrec;
        if (!satrec && debris.line1 && debris.line2) {
            try {
                const twoline2satrec = satellite.twoline2satrec || 
                                     (satellite.default && satellite.default.twoline2satrec);
                if (twoline2satrec) {
                    satrec = twoline2satrec(debris.line1, debris.line2);
                } else {
                    console.error('Cannot create orbit path: satellite.js functions not available');
                    return;
                }
            } catch (error) {
                console.error('Failed to create satrec for orbit path:', error);
                return;
            }
        }
        
        if (!satrec) return;
        
        // Generate orbit path (one full orbit)
        const positions = [];
        const now = new Date();
        const periodMinutes = 1440 / debris.meanMotion; // Period in minutes
        const steps = 100; // Number of points in orbit
        
        for (let i = 0; i <= steps; i++) {
            const timeOffset = (i / steps) * periodMinutes * 60 * 1000; // Convert to milliseconds
            const time = new Date(now.getTime() + timeOffset);
            
            try {
                const propagate = satellite.propagate || 
                                 (satellite.default && satellite.default.propagate);
                if (!propagate) break;
                
                const result = propagate(satrec, time);
                if (result && result.position && !result.error) {
                    const pos = result.position;
                    if (isFinite(pos.x) && isFinite(pos.y) && isFinite(pos.z)) {
                        positions.push(new Cesium.Cartesian3(pos.x * 1000, pos.y * 1000, pos.z * 1000));
                    }
                }
            } catch (error) {
                // Skip invalid positions
                continue;
            }
        }
        
        if (positions.length < 2) {
            console.warn('Not enough positions for orbit path');
            return;
        }
        
        // Create orbit path entity
        const orbitEntity = this.viewer.entities.add({
            id: `orbit_${noradId}`,
            polyline: {
                positions: positions,
                width: 2,
                material: Cesium.Color.CYAN.withAlpha(0.6),
                clampToGround: false,
            },
        });
        
        this.orbitPaths.set(noradId, orbitEntity);
    }
    
    hideOrbitPath(noradId) {
        const path = this.orbitPaths.get(noradId);
        if (path) {
            this.viewer.entities.remove(path);
            this.orbitPaths.delete(noradId);
        }
    }
    
    hideOrbitPaths() {
        this.orbitPaths.forEach((path, noradId) => {
            this.viewer.entities.remove(path);
        });
        this.orbitPaths.clear();
    }
    
    showEntityInfo(entity, animationSpeed = null) {
        const debris = entity._debrisData;
        if (!debris) return;
        
        const infoDiv = document.getElementById('entityInfo');
        if (!infoDiv) return;
        
        const name = debris.objectName || debris.name || `NORAD ${debris.noradId}`;
        const periodMinutes = debris.meanMotion ? (1440 / debris.meanMotion) : null;
        
        let info = `
            <h4 style="margin-top: 0; color: #4CAF50;">${name}</h4>
            <p><strong>NORAD ID:</strong> ${debris.noradId}</p>
            <p><strong>Type:</strong> ${debris.objectType || 'UNKNOWN'}</p>
            <p><strong>Orbit:</strong> ${debris.orbitType || 'UNKNOWN'}</p>
            ${debris.inclination ? `<p><strong>Inclination:</strong> ${debris.inclination.toFixed(2)}°</p>` : ''}
            ${periodMinutes ? `<p><strong>Orbital Period:</strong> ${periodMinutes.toFixed(2)} min (${(periodMinutes / 60).toFixed(2)} hours)</p>` : ''}
        `;
        
        if (animationSpeed && animationSpeed > 1) {
            info += `<p style="margin-top: 8px; padding: 6px; background: rgba(76, 175, 80, 0.2); border-left: 3px solid #4CAF50; border-radius: 3px;">
                <strong style="color: #4CAF50;">⚡ Animation:</strong> ${animationSpeed.toLocaleString()}x speed<br>
                <small style="color: #ccc;">One orbit in 30 seconds</small>
            </p>`;
        }
        
        info += `<p style="margin-top: 10px; font-size: 11px; color: #999;"><em>Click elsewhere to deselect</em></p>`;
        
        infoDiv.innerHTML = info;
        infoDiv.style.display = 'block';
    }
    
    hideEntityInfo() {
        const infoDiv = document.getElementById('entityInfo');
        if (infoDiv) {
            infoDiv.style.display = 'none';
        }
    }

    updatePositions() {
        if (this.debrisData.length === 0) return;

        const currentTime = this.viewer.clock.currentTime;
        const date = Cesium.JulianDate.toDate(currentTime);

        // Update a subset of positions each frame to avoid performance issues
        const updateCount = Math.min(100, this.entities.size);
        let updated = 0;

        for (const [noradId, entity] of this.entities) {
            if (updated >= updateCount) break;
            
            // Skip animated entities (they update themselves via CallbackProperty)
            if (entity._isAnimated) {
                continue;
            }

            try {
                const satrec = entity.properties?.satrec?.getValue();
                let cartesian;

                if (satrec) {
                    // Use satrec directly if available
                    const positionAndVelocity = satellite.propagate(satrec, date);
                    if (positionAndVelocity.position) {
                        const pos = positionAndVelocity.position;
                        cartesian = new Cesium.Cartesian3(pos.x * 1000, pos.y * 1000, pos.z * 1000);
                    } else {
                        continue; // Skip if propagation fails
                    }
                } else {
                    // Fallback to API call
                    const api = new APIClient();
                    api.getDebrisPosition(noradId, date.toISOString())
                        .then(positionData => {
                            const pos = positionData.position;
                            const cart = new Cesium.Cartesian3(pos.x * 1000, pos.y * 1000, pos.z * 1000);
                            this.updateEntityPosition(entity, cart);
                        })
                        .catch(() => {
                            // Silently fail for individual updates
                        });
                    updated++;
                    continue;
                }

                this.updateEntityPosition(entity, cartesian);
                updated++;
            } catch (error) {
                // Skip failed updates
            }
        }
    }

    updateEntityPosition(entity, cartesian) {
        if (entity.position) {
            entity.position.setValue(cartesian);
        }

        // Update trail
        if (entity.polyline && this.showTrails) {
            const positions = entity.polyline.positions.getValue();
            if (positions.length > 100) {
                positions.shift(); // Limit trail length
            }
            positions.push(cartesian);
            entity.polyline.positions.setValue(positions);
        }
    }

    setShowLabels(show) {
        this.showLabels = show;
        this.entities.forEach(entity => {
            entity.label = show ? {
                text: entity.name,
                font: '12px sans-serif',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -10),
            } : undefined;
        });
    }

    setShowTrails(show) {
        this.showTrails = show;
        this.entities.forEach(entity => {
            if (show && !entity.polyline) {
                entity.polyline = {
                    positions: [entity.position.getValue()],
                    width: 1,
                    material: Cesium.Color.CYAN.withAlpha(0.5),
                };
            } else if (!show) {
                entity.polyline = undefined;
            }
        });
    }

    setMaxObjects(max) {
        this.maxObjects = max;
    }

    highlightObject(noradId, color = Cesium.Color.YELLOW) {
        const entity = this.entities.get(noradId);
        if (entity) {
            // Store original color
            if (!entity._originalColor) {
                entity._originalColor = entity.point.color.getValue();
                entity._originalSize = entity.point.pixelSize.getValue();
            }
            
            entity.point.color = color;
            entity.point.pixelSize = 12;
            entity.label.show = true; // Ensure label is visible
            
            // Fly to object
            this.viewer.flyTo(entity, {
                duration: 2.0,
            });
            
            return true;
        }
        return false;
    }
    
    clearHighlight(noradId) {
        const entity = this.entities.get(noradId);
        if (entity && entity._originalColor) {
            entity.point.color = entity._originalColor;
            entity.point.pixelSize = entity._originalSize;
            delete entity._originalColor;
            delete entity._originalSize;
        }
    }
    
    async searchAndHighlight(searchTerm) {
        try {
            // First try searching in already-loaded data (faster)
            const searchLower = searchTerm.toLowerCase();
            const foundInLoaded = [];
            
            for (const debris of this.debrisData) {
                const nameMatch = (debris.objectName || debris.name || '').toLowerCase().includes(searchLower);
                const idMatch = debris.noradId.toString().includes(searchTerm);
                
                if (nameMatch || idMatch) {
                    if (this.highlightObject(debris.noradId, Cesium.Color.YELLOW)) {
                        foundInLoaded.push({
                            noradId: debris.noradId,
                            name: debris.objectName || debris.name || `NORAD ${debris.noradId}`,
                            objectType: debris.objectType || 'UNKNOWN',
                        });
                    }
                }
            }
            
            if (foundInLoaded.length > 0) {
                // Clear previous highlights first
                this.entities.forEach((entity, id) => {
                    if (entity._originalColor && !foundInLoaded.find(f => f.noradId === id)) {
                        this.clearHighlight(id);
                    }
                });
                return foundInLoaded;
            }
            
            // If not found in loaded data, try API search
            const api = new APIClient();
            const response = await api.getDebris({
                limit: 100,
                search: searchTerm,
            });
            
            if (response.data && response.data.length > 0) {
                // Clear previous highlights
                this.entities.forEach((entity, id) => {
                    if (entity._originalColor) {
                        this.clearHighlight(id);
                    }
                });
                
                // Highlight found objects
                const found = [];
                for (const obj of response.data) {
                    if (this.highlightObject(obj.noradId, Cesium.Color.YELLOW)) {
                        found.push({
                            noradId: obj.noradId,
                            name: obj.objectName || obj.name || `NORAD ${obj.noradId}`,
                            objectType: obj.objectType || 'UNKNOWN',
                        });
                    } else {
                        // Object found but not yet rendered - add to found list anyway
                        found.push({
                            noradId: obj.noradId,
                            name: obj.objectName || obj.name || `NORAD ${obj.noradId}`,
                            objectType: obj.objectType || 'UNKNOWN',
                            note: 'Found in database but not yet loaded. Increase Max Objects and reload.',
                        });
                    }
                }
                
                return found;
            }
            return [];
        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    }

    clearHighlights() {
        this.entities.forEach(entity => {
            const orbitType = entity.properties.orbitType.getValue();
            const colorMap = {
                LEO: Cesium.Color.CYAN,
                MEO: Cesium.Color.YELLOW,
                GEO: Cesium.Color.GREEN,
                HEO: Cesium.Color.MAGENTA,
            };
            entity.point.color = colorMap[orbitType] || Cesium.Color.WHITE;
            entity.point.pixelSize = 3;
        });
    }

    addEntity(entityData) {
        return this.viewer.entities.add(entityData);
    }

    removeEntity(id) {
        const entity = this.entities.get(id);
        if (entity) {
            this.viewer.entities.remove(entity);
            this.entities.delete(id);
        }
    }

    getViewer() {
        return this.viewer;
    }
}

// Export for use in other scripts
window.DebrisVisualizer = DebrisVisualizer;

