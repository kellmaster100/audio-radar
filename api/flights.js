import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const clientID = process.env.OPENSKY_ID;
    const clientSecret = process.env.OPENSKY_SECRET;

    if (!lat || !lon) {
        return res.status(400).json({ error: "Location required" });
    }

    console.log(`Starting AudioRadar scan for Lat: ${lat}, Lon: ${lon}`);

    const offset = 0.4; // Approx 25 miles
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    try {
        // --- STEP 1: GET OAUTH2 TOKEN ---
        // This is the new "Handshake" required since 2025/2026
        console.log("Exchanging credentials for Access Token...");
        
        const tokenResponse = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'grant_type': 'client_credentials',
                'client_id': clientID,
                'client_secret': clientSecret
            }),
            signal: AbortSignal.timeout(6000)
        });

        if (!tokenResponse.ok) {
            const errText = await tokenResponse.text();
            throw new Error(`Auth failed: ${tokenResponse.status}. Check your Vercel Environment Variables.`);
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;
        console.log("Access Token received. Requesting flight data...");

        // --- STEP 2: FETCH FLIGHTS WITH TOKEN ---
        const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(8000)
        });

        if (!response.ok) {
            throw new Error(`OpenSky Data Error: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Success! Found ${data.states ? data.states.length : 0} aircraft.`);

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
        console.error("CRITICAL ERROR:", error.message);
        res.status(500).json({ 
            error: "Connection failed", 
            message: error.message,
            tip: "This usually means the OpenSky token server is slow. Try again in 10 seconds."
        });
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}