export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const clientID = process.env.OPENSKY_ID;
    const clientSecret = process.env.OPENSKY_SECRET;

    if (!lat || !lon) {
        return res.status(400).json({ error: "Location coordinates required" });
    }

    // Increased offset to 1.5 (~100 miles) to ensure we find planes
    const offset = 1.5; 
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    try {
        const auth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
        
        const response = await fetch(url, {
            method: 'GET',
            headers: { 
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
                'User-Agent': 'AudioRadar-Client/1.0' 
            }
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(response.status).json({ error: `OpenSky returned ${response.status}`, details: errText });
        }

        const data = await response.json();

        if (!data.states) {
            return res.status(200).json([]);
        }

        const flights = data.states.map(f => {
            const fLat = f[6];
            const fLon = f[5];
            const dist = calculateDistance(parseFloat(lat), parseFloat(lon), fLat, fLon);
            return {
                icao24: f[0],
                callsign: f[1] ? f[1].trim() : "N/A",
                altitude: f[7] ? Math.round(f[7] * 3.28084) : 0,
                distance: dist.toFixed(1),
                lat: fLat,
                lon: fLon
            };
        });

        const sorted = flights.sort((a, b) => a.distance - b.distance).slice(0, 10);
        res.status(200).json(sorted);

    } catch (error) {
        // This will now tell us if it's a DNS issue, Timeout, etc.
        res.status(500).json({ error: "Fetch operation failed", message: error.message });
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}