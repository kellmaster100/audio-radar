export default async function handler(req, res) {
    const { lat, lon } = req.query; // Get user location from the request
    const clientID = process.env.OPENSKY_ID;
    const clientSecret = process.env.OPENSKY_SECRET;

    if (!lat || !lon) {
        return res.status(400).json({ error: "Location coordinates required" });
    }

    // 1. Create a Bounding Box (~25 miles around you)
    const offset = 0.4; // Roughly 25-30 miles in lat/lon degrees
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    try {
        const auth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
        const response = await fetch(url, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const data = await response.json();

        if (!data.states) return res.status(200).json([]);

        // 2. Map and Calculate Distance
        const flights = data.states.map(f => {
            const fLat = f[6];
            const fLon = f[5];
            const dist = calculateDistance(lat, lon, fLat, fLon);
            return {
                icao24: f[0],
                callsign: f[1] ? f[1].trim() : "N/A",
                altitude: f[7] ? Math.round(f[7] * 3.28084) : 0,
                distance: dist.toFixed(1),
                lat: fLat,
                lon: fLon
            };
        });

        // 3. Sort by closest and take top 10
        const sorted = flights.sort((a, b) => a.distance - b.distance).slice(0, 10);

        res.status(200).json(sorted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Distance helper function
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}