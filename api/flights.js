import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const clientID = process.env.OPENSKY_ID;
    const clientSecret = process.env.OPENSKY_SECRET;

    console.log(`Incoming request for Lat: ${lat}, Lon: ${lon}`);
    console.log(`Using OpenSky ID: ${clientID ? 'Configured' : 'MISSING'}`);

    if (!lat || !lon) {
        return res.status(400).json({ error: "Location coordinates required" });
    }

    const offset = 0.4; 
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
    const auth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');

    // Retry Logic: Try 3 times before giving up
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            console.log(`OpenSky Attempt ${attempt}...`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: { 
                    'Authorization': `Basic ${auth}`,
                    'Accept': 'application/json',
                    'User-Agent': 'AudioRadar-Client/1.0' 
                },
                // Shorter timeout per attempt to leave room for retries
                signal: AbortSignal.timeout(3000) 
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Status ${response.status}: ${errText}`);
            }

            const data = await response.json();
            console.log(`Success on attempt ${attempt}! Found ${data.states ? data.states.length : 0} planes.`);

            if (!data.states) return res.status(200).json([]);

            const flights = data.states.map(f => {
                const dist = calculateDistance(parseFloat(lat), parseFloat(lon), f[6], f[5]);
                return {
                    icao24: f[0],
                    callsign: f[1] ? f[1].trim() : "N/A",
                    altitude: f[7] ? Math.round(f[7] * 3.28084) : 0,
                    distance: dist.toFixed(1),
                    lat: f[6],
                    lon: f[5]
                };
            });

            return res.status(200).json(flights.sort((a, b) => a.distance - b.distance).slice(0, 10));

        } catch (error) {
            console.error(`Attempt ${attempt} failed: ${error.message}`);
            
            // If we've reached the last attempt, send the final error
            if (attempt === 3) {
                return res.status(500).json({ 
                    error: "All attempts timed out", 
                    message: "The OpenSky server is currently unresponsive. Please try again in a moment." 
                });
            }
            // Small pause before retrying
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}