# 🚀 Deploy to Render (Free & Easy)

## Quick Deploy Steps:

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - Orbital Debris Visualizer"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy on Render

1. Go to [render.com](https://render.com) and sign up/login (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Select your repository
5. Configure:
   - **Name**: `orbital-debris-visualizer`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free

6. **Add Environment Variables** (click "Advanced"):
   ```
   NODE_ENV=production
   PORT=3000
   DATA_SOURCE=spacetrack
   SPACETRACK_USERNAME=your_email@example.com
   SPACETRACK_PASSWORD=your_password
   CESIUM_ION_TOKEN=your_cesium_token (optional)
   ```

7. Click **"Create Web Service"**
8. Wait ~5 minutes for deployment
9. Your app will be live at: `https://orbital-debris-visualizer.onrender.com`

## Alternative: Deploy to Railway (Also Free)

1. Go to [railway.app](https://railway.app) and sign up
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. Add environment variables (same as above)
5. Deploy automatically!

## Alternative: Deploy to Fly.io (Also Free)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch
fly launch

# Add secrets
fly secrets set SPACETRACK_USERNAME=your_email
fly secrets set SPACETRACK_PASSWORD=your_password
fly secrets set DATA_SOURCE=spacetrack
```

## Notes:
- Render free tier spins down after 15 min inactivity (first request may be slow)
- Railway free tier has 500 hours/month
- All services auto-deploy on git push!

