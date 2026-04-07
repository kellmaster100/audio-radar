import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;

    if (!lat || !lon) return res.status(400).json({ error: "Location missing" });

    // Use a slightly smaller area (0.25 offset is ~17 miles)
    // This is more reliable for anonymous requests
    const offset = 0.25; 
    const lamin = parseFloat(lat) - offset;
    const lomin = parseFloat(lon) - offset;
    const lamax = parseFloat(lat) + offset;
    const lomax = parseFloat(lon) + offset;

    const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`;

    try {
        console.log("AudioRadar: Fetching public data for Riverside area...");

        const response = await fetch(url, {
            method: 'GET',
            headers: { 
                'Accept': 'application/json',
                'User-Agent': 'AudioRadar-Public-Client/1.0'
            },
            // Give it plenty of time (10 seconds)
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`OpenSky Server Busy (Status ${response.status})`);
        }

        const data = await response.json();
        
        if (!data.states || data.states.length === 0) {
            console.log("AudioRadar: No planes found in the current 17-mile box.");
            return res.status(200).json([]);
        }

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

        console.log(`AudioRadar: Success! Found ${flights.length} planes.`);
        res.status(200).json(flights.sort((a, b) => a.distance - b.distance).slice(0, 10));

    } catch (error) {
        console.error("AudioRadar Log:", error.message);
        res.status(500).json({ error: "Search failed", message: "The aircraft data server is currently unreachable. Please wait 10 seconds and try again." });
    }
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Radius of Earth in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}