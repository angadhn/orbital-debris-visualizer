# How to Find and Verify Envisat

## Envisat Information
- **NORAD ID**: 27386
- **Name**: ENVISAT
- **Type**: Payload (Satellite)
- **Status**: Non-operational (contact lost in 2012)

## Method 1: Search in Loaded Data

1. **Load debris data** with a high limit to include Envisat:
   - Set "Max Objects" to at least 30,000 (Envisat's NORAD ID is 27386)
   - Click "Load Debris Data"
   - Wait for data to load (may take 30-60 seconds)

2. **Search for Envisat**:
   - Type "Envisat" or "27386" in the search box
   - Click "Search"
   - Envisat will be highlighted in yellow

3. **Or use Quick Access**:
   - Click "Find Envisat (NORAD 27386)" button
   - The system will search and highlight it

## Method 2: Filter by Object Type

1. **Filter to Payloads only**:
   - Select "Payloads (Satellites)" in Object Type filter
   - Set Max Objects to 5000
   - Click "Load Debris Data"
   - This reduces clutter and makes it easier to find

2. **Search for Envisat** in the filtered results

## Method 3: Verify via API

Test directly via API:
```bash
curl 'http://localhost:3000/api/debris?search=Envisat&limit=10'
```

Or search by NORAD ID in loaded data:
```bash
curl 'http://localhost:3000/api/debris?search=27386&limit=10'
```

## Visual Verification

When Envisat is found and highlighted:
- **Color**: Cyan (highlighted)
- **Size**: Larger point (12px)
- **Label**: Should show "ENVISAT" or "ENVISAT (PAYLOAD)"
- **Camera**: Automatically flies to Envisat's position

## Expected Orbital Parameters

Envisat should have:
- **Orbit Type**: LEO (Low Earth Orbit)
- **Inclination**: ~98.5 degrees (sun-synchronous)
- **Altitude**: ~790 km
- **Object Type**: PAYLOAD

## Troubleshooting

If Envisat doesn't appear:
1. Make sure you've loaded enough objects (at least 30,000)
2. Try refreshing the data (click "Refresh Data")
3. Check browser console for errors
4. Verify Space-Track API is working: `curl http://localhost:3000/api/health`

