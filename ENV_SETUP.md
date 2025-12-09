# Environment Setup

Create a `.env` file in the project root with the following variables:

```bash
# Space-Track.org API Credentials
# Register at https://www.space-track.org/auth/create_account
SPACETRACK_USERNAME=your_username
SPACETRACK_PASSWORD=your_password

# Server Configuration
PORT=3000
NODE_ENV=development

# Data Cache Settings
CACHE_DIR=./data/cache
CACHE_TTL_HOURS=24
```

## Getting API Credentials

### Space-Track.org
1. Visit https://www.space-track.org/auth/create_account
2. Create a free account
3. Add your username and password to `.env`

### Cesium Ion Token
1. Visit https://cesium.com/ion/signup/
2. Sign up for a free account
3. Get your access token from the dashboard
4. Update `public/js/visualizer.js`:
   ```javascript
   Cesium.Ion.defaultAccessToken = 'your_token_here';
   ```
   Or set it as a global variable before initializing:
   ```html
   <script>
     window.CESIUM_ION_TOKEN = 'your_token_here';
   </script>
   ```

