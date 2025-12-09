/**
 * API Client for backend communication
 */
class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        };

        try {
            const response = await fetch(url, config);
            if (!response.ok) {
                const error = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(error.error || `HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    async getDebris(options = {}) {
        const params = new URLSearchParams();
        if (options.limit) params.append('limit', options.limit);
        if (options.offset) params.append('offset', options.offset);
        if (options.orbitType) params.append('orbitType', options.orbitType);
        if (options.objectTypes) params.append('objectTypes', options.objectTypes);
        if (options.objectType) params.append('objectType', options.objectType);
        if (options.minRcsSize) params.append('minRcsSize', options.minRcsSize);
        if (options.maxRcsSize) params.append('maxRcsSize', options.maxRcsSize);
        if (options.search) params.append('search', options.search);
        if (options.noradId) params.append('noradId', options.noradId);
        if (options.forceRefresh) params.append('forceRefresh', 'true');

        const query = params.toString();
        return this.request(`/api/debris${query ? '?' + query : ''}`);
    }

    async getDebrisObject(id) {
        return this.request(`/api/debris/${id}`);
    }

    async getDebrisPosition(id, time = null) {
        const params = time ? `?time=${time}` : '';
        return this.request(`/api/debris/${id}/position${params}`);
    }

    async queryDebris(queryParams) {
        return this.request('/api/debris/query', {
            method: 'POST',
            body: JSON.stringify(queryParams),
        });
    }

    async detectCollisions(objectIds, startTime, endTime, stepSeconds = 60, threshold = null) {
        return this.request('/api/collisions/detect', {
            method: 'POST',
            body: JSON.stringify({
                objectIds,
                startTime: startTime?.toISOString(),
                endTime: endTime?.toISOString(),
                stepSeconds,
                threshold,
            }),
        });
    }

    async simulateCollision(objectId1, objectId2, collisionTime, modelName = 'nasa', propagateFragments = false) {
        return this.request('/api/collisions/simulate', {
            method: 'POST',
            body: JSON.stringify({
                objectId1,
                objectId2,
                collisionTime: collisionTime?.toISOString(),
                modelName,
                propagateFragments,
            }),
        });
    }

    async getCollisionModels() {
        return this.request('/api/collisions/models');
    }
}

// Export for use in other scripts
window.APIClient = APIClient;

