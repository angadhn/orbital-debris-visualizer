# Getting Real Orbital Debris Data

## Option 1: Space-Track.org (Recommended for Real Data)

Space-Track.org provides the largest catalog of tracked space objects (~20,000+ objects) from NORAD's Space Surveillance Network.

### Steps to Get Space-Track Credentials:

1. **Register for Free Account**
   - Visit: https://www.space-track.org/auth/create_account
   - Fill out the registration form (it's free!)
   - You'll need to provide:
     - Email address
     - Name
     - Organization (can be personal/educational)
     - Purpose of use

2. **Wait for Approval**
   - Space-Track typically approves accounts within 24-48 hours
   - You'll receive an email when approved

3. **Set Credentials in .env File**
   ```bash
   # Edit your .env file
   DATA_SOURCE=spacetrack
   SPACETRACK_USERNAME=your_username_here
   SPACETRACK_PASSWORD=your_password_here
   ```

4. **Restart Server**
   ```bash
   # Stop the server (Ctrl+C) and restart
   npm start
   ```

## Option 2: DISCOS (ESA) - Requires API Key

DISCOS is ESA's database but requires API authentication. To use it:

1. **Register at DISCOSweb**
   - Visit: https://discosweb.esoc.esa.int/
   - Create an account
   - Request API access

2. **Get API Token**
   - Once approved, get your API token from the dashboard

3. **Update Code**
   - You'll need to modify `src/api/discosFetcher.js` to include authentication headers
   - Add token to config: `DISCOS_API_TOKEN=your_token`

## Option 3: KeepTrack API (Alternative)

KeepTrack provides a free API for non-commercial use:

1. **Visit KeepTrack API**
   - https://www.keeptrack.space/api
   - No registration required for basic use
   - Free for private/non-commercial use

2. **Update Code**
   - Modify `src/api/dataFetcher.js` or create `keeptrackFetcher.js`
   - Set `DATA_SOURCE=keeptrack` in `.env`

## Current Setup (Mock Data)

Right now, the system is using **mock data** by default, which:
- ✅ Works immediately (no API keys needed)
- ✅ Generates 100 sample debris objects
- ✅ Perfect for testing and development
- ❌ Not real-time data
- ❌ Limited to sample objects

## Quick Start with Space-Track

Once you have Space-Track credentials:

1. **Update .env file:**
   ```bash
   DATA_SOURCE=spacetrack
   SPACETRACK_USERNAME=your_username
   SPACETRACK_PASSWORD=your_password
   ```

2. **Restart server:**
   ```bash
   npm start
   ```

3. **Load real data:**
   - Click "Load Debris Data" in the web interface
   - The system will fetch real debris from Space-Track.org
   - First load may take 30-60 seconds (downloading ~20,000 objects)

## Rate Limits

- **Space-Track**: ~10 requests/minute (be respectful!)
- **DISCOS**: Varies by account type
- **KeepTrack**: Check their terms of service

## Troubleshooting

If you get authentication errors:
- Double-check username/password in `.env`
- Make sure there are no extra spaces
- Verify your Space-Track account is approved
- Check server logs for specific error messages

