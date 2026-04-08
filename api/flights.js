import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const offset = 0.36; 

    const url = `https://opensky-network.org/api/states/all?lamin=${parseFloat(lat)-offset}&lomin=${parseFloat(lon)-offset}&lamax=${parseFloat(lat)+offset}&lomax=${parseFloat(lon)+offset}`;

    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'AudioRadar-v2-User' }
        });
        const data = await response.json();

        if (!data.states) return res.status(200).json([]);

        const flights = data.states.map(f => ({
            icao24: f[0],
            callsign: f[1] ? f[1].trim() : "N/A",
            lat: f[6],
            lon: f[5],
            altitude: f[7] ? Math.round(f[7] * 3.28084) : 0
        }));

        res.status(200).json(flights);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}