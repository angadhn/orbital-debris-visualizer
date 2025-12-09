# Space-Track API Troubleshooting

## Current Status

Your credentials are configured, but Space-Track API is returning errors. This could be due to:

1. **Account Not Fully Approved**: Space-Track accounts may need additional approval for API access
2. **API Format Changes**: Space-Track may have updated their API format
3. **Rate Limiting**: Too many requests

## Quick Fix: Use Mock Data

For now, you can use mock data which works immediately:

```bash
# In .env file, change:
DATA_SOURCE=mock
```

Then restart the server:
```bash
npm start
```

## Testing Space-Track Manually

You can test your credentials manually:

1. **Login via Browser**:
   - Go to https://www.space-track.org/auth/login
   - Login with your credentials
   - Verify you can access the site

2. **Check API Access**:
   - Once logged in, try accessing: https://www.space-track.org/basicspacedata/query/class/tle_latest/format/tle/limit/5
   - If this works in browser, the API should work programmatically

## Alternative: Celestrak

If Space-Track continues to have issues, you can use Celestrak's public TLE files:

- **All Active Satellites**: https://celestrak.org/NORAD/elements/stations.txt
- **Debris**: Various debris files available

We can add Celestrak support if needed.

## Next Steps

1. Verify your Space-Track account is fully approved
2. Check if you can access the API via browser when logged in
3. Contact Space-Track support if needed: admin@space-track.org

For now, mock data will work perfectly for testing and development!

