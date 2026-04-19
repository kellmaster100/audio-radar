import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    // 40km radius (approx 25 miles)
    const url = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/40`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'AudioRadar-v3' }
        });
        const data = await response.json();

        if (!data.ac) return res.status(200).json([]);

        const flights = data.ac.map(f => ({
            icao24: f.hex || f.icao,
            callsign: f.flight ? f.flight.trim() : "Unknown",
            registration: f.r || "No Reg",
            type: f.t || "Unknown Type",
            lat: f.lat,
            lon: f.lon,
            altitude: f.alt_baro || 0,
            gs: Math.round(f.gs || 0), // Ground speed in knots
            vRate: f.baro_rate || 0, // Vertical rate (feet per minute)
            // Route data usually comes in as [Origin, Destination] or similar
            route: f.p_route || null 
        }));

        res.status(200).json(flights);
    } catch (error) {
        res.status(500).json({ error: "Data fetch failed", message: error.message });
    }
}