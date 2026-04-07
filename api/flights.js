import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const clientID = process.env.OPENSKY_ID;
    const clientSecret = process.env.OPENSKY_SECRET;

    if (!lat || !lon) return res.status(400).json({ error: "Location missing" });

    const offset = 0.4;
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    try {
        console.log("Step 1: Requesting Token...");
        
        // We use Basic Auth to ASK for the Bearer Token - this is the standard OAuth2 'Machine-to-Machine' flow
        const authHeader = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
        
        const tokenResponse = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
            method: 'POST',
            headers: { 
                'Authorization': `Basic ${authHeader}`,
                'Content-Type': 'application/x-www-form-urlencoded' 
            },
            body: new URLSearchParams({ 'grant_type': 'client_credentials' })
            // No internal timeout here - let Vercel handle the limit
        });

        if (!tokenResponse.ok) {
            const errBody = await tokenResponse.text();
            throw new Error(`Token Exchange Failed: ${tokenResponse.status} - ${errBody}`);
        }

        const { access_token } = await tokenResponse.json();
        console.log("Step 2: Token Acquired. Fetching Data...");

        const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${access_token}` }
        });

        const data = await response.json();
        console.log(`Step 3: Success! Found ${data.states ? data.states.length : 0} aircraft.`);

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

        res.status(200).json(flights.sort((a, b) => a.distance - b.distance).slice(0, 10));

    } catch (error) {
        console.error("AudioRadar Error:", error.message);
        res.status(500).json({ error: "Connection error", message: error.message });
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}