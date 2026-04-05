export default async function handler(req, res) {
    const { lat, lon } = req.query;
    const key = process.env.LOCATIONIQ_KEY;

    try {
        const response = await fetch(`https://us1.locationiq.com/v1/reverse?key=${key}&lat=${lat}&lon=${lon}&format=json`);
        const data = await response.json();
        // Return just the neighborhood or road for brevity
        const address = data.address.neighbourhood || data.address.road || data.address.suburb || "Unknown area";
        res.status(200).json({ location: address });
    } catch (error) {
        res.status(500).json({ error: "Location lookup failed" });
    }
}