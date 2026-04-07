import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const clientID = process.env.OPENSKY_ID;
    const clientSecret = process.env.OPENSKY_SECRET;

    // Log the incoming request details (but never log your full secret!)
    console.log(`Incoming request for Lat: ${lat}, Lon: ${lon}`);
    console.log(`Using OpenSky ID: ${clientID ? 'Configured' : 'MISSING'}`);

    if (!lat || !lon) {
        return res.status(400).json({ error: "Location coordinates required" });
    }

    const offset = 0.4; // Reduced to ~27 miles to match your 25-mile UI claim
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    try {
        // Use Buffer instead of btoa for Node.js compatibility
        const auth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'User-Agent': 'AudioRadar-Client/1.0' 
            },
            signal: AbortSignal.timeout(8000) // Slightly shorter timeout to finish before Vercel kills the function
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`OpenSky API Error: Status ${response.status} - ${errText}`);
            return res.status(response.status).json({ error: `OpenSky error ${response.status}`, details: errText });
        }

        const data = await response.json();
        console.log(`Successfully fetched ${data.states ? data.states.length : 0} aircraft.`);

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
        // This is the critical log that tells you if it was a timeout or a code crash
        console.error("CRITICAL FUNCTION ERROR:", error.message);
        res.status(500).json({ 
            error: "Function Crash", 
            message: error.message 
        });
    }
}

// ... calculateDistance function remains the same ...