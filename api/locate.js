import fetch from 'node-fetch';

export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const key = process.env.LOCATIONIQ_KEY;

    if (!key) {
        return res.status(500).json({ error: "LocationIQ Key missing" });
    }

    try {
        const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'AudioRadar-v3',
                'Referer': 'https://audio-radar.vercel.app/'
            }
        });

        const data = await response.json();
        const addr = data.address || {};
        
        // Priority list for a natural "Over [Place]" announcement
        const displayLocation = addr.road || addr.neighbourhood || addr.suburb || addr.city || addr.county || "Unknown Area";

        res.status(200).json({ location: displayLocation });
    } catch (err) {
        res.status(500).json({ error: "Locate failed", message: err.message });
    }
}