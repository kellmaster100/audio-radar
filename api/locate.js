export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const key = process.env.LOCATIONIQ_KEY;

    // Safety check for the key
    if (!key) {
        return res.status(500).json({ error: "Vercel Environment Variable 'LOCATIONIQ_KEY' is missing." });
    }

    try {
        // Updated to the most stable .php endpoint
        const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                // Adding a User-Agent helps prevent "Bot" detection blocks
                'User-Agent': 'AudioRadar-Flight-Tracker'
            }
        });

        if (!response.ok) {
            const errorBody = await response.text();
            return res.status(response.status).json({ 
                error: `LocationIQ returned status ${response.status}`,
                details: errorBody 
            });
        }

        const data = await response.json();
        
        // Extract the most readable part of the address
        const addr = data.address || {};
        const displayLocation = addr.road || addr.neighbourhood || addr.suburb || addr.city || "Unknown Area";

        res.status(200).json({ location: displayLocation });
    } catch (err) {
        res.status(500).json({ error: "Network or Server Error", message: err.message });
    }
}