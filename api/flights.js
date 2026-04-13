import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    // ADSB.lol uses a radius in kilometers. 40km is roughly 25 miles.
    const url = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/40`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'AudioRadar-v2' }
        });
        const data = await response.json();

        // ADSB.lol returns an array called 'ac' for aircraft
        if (!data.ac) return res.status(200).json([]);

        const flights = data.ac.map(f => ({
            icao24: f.icao,
            callsign: f.flight ? f.flight.trim() : "N/A",
            lat: f.lat,
            lon: f.lon,
            altitude: f.alt_baro || 0 // Uses barometric altitude
        }));

        res.status(200).json(flights);
    } catch (error) {
        res.status(500).json({ error: "Data fetch failed", message: error.message });
    }
}