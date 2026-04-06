import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const clientID = process.env.OPENSKY_ID;
    const clientSecret = process.env.OPENSKY_SECRET;

    if (!lat || !lon) {
        return res.status(400).json({ error: "Location coordinates required" });
    }

    const offset = 1.5; 
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    try {
        // We are replacing Buffer with btoa, which is safer for modern Vercel functions
        const auth = btoa(`${clientID}:${clientSecret}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'User-Agent': 'AudioRadar-Client/1.0' 
            },
            // Added a longer timeout to help with the "ETIMEDOUT" issues
            signal: AbortSignal.timeout(15000) 
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({ error: `OpenSky error ${response.status}`, details: errText });
        }

        const data = await response.json();
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
        res.status(500).json({ 
            error: "Function Crash", 
            message: error.message,
            tip: "Check if OpenSky is down or if credentials are correct in Vercel settings" 
        });
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