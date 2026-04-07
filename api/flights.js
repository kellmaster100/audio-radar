import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const clientID = process.env.OPENSKY_ID;
    const clientSecret = process.env.OPENSKY_SECRET;

    if (!lat || !lon) return res.status(400).json({ error: "Location required" });

    const offset = 0.4; // ~25 miles
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    try {
        console.log("AudioRadar: Requesting OAuth2 Token...");
        
        // This is the specific production URL for OpenSky's Keycloak Auth server
        const tokenResponse = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': clientID,
                'client_secret': clientSecret
            }),
            signal: AbortSignal.timeout(8000) // 8 seconds for the handshake
        });

        if (!tokenResponse.ok) {
            const errBody = await tokenResponse.text();
            console.error(`Auth Failed (${tokenResponse.status}): ${errBody}`);
            throw new Error("Authentication failed. Check your Vercel Environment Variables.");
        }

        const { access_token } = await tokenResponse.json();
        console.log("AudioRadar: Token acquired. Fetching aircraft states...");

        const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
        
        const response = await fetch(url, {
            headers: { 
                'Authorization': `Bearer ${access_token}`,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(10000) // 10 seconds for the data
        });

        if (!response.ok) throw new Error(`Data server responded with ${response.status}`);

        const data = await response.json();
        console.log(`AudioRadar: Success! Found ${data.states ? data.states.length : 0} aircraft.`);

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