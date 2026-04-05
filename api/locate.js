export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const key = process.env.LOCATIONIQ_KEY;

    if (!key) {
        return res.status(500).json({ error: "LocationIQ Key is missing in Vercel settings" });
    }

    try {
        // We use the 'eu1' or 'us1' endpoint. Let's stick with us1 for Riverside.
        const url = `https://us1.locationiq.com/v1/reverse.php?key=${key}&lat=${lat}&lon=${lon}&format=json`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'AudioRadar-App'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ error: `LocationIQ error: ${errorText}` });
        }

        const data = await response.json();
        
        // LocationIQ returns 'address' object. We've added fallbacks for better reliability.
        const addr = data.address;
        const locationName = addr.road || addr.suburb || addr.neighbourhood || addr.city || "Unknown Area";

        res.status(200).json({ location: locationName });
    } catch (error) {
        res.status(500).json({ error: "Failed to connect to LocationIQ" });
    }
}