// api/flights.js
export default async function handler(req, res) {
  // Use environment variables set in Vercel dashboard
  const clientID = process.env.OPENSKY_ID;
  const clientSecret = process.env.OPENSKY_SECRET;

  // Riverside, CA coordinates for the bounding box
  // Lamin: 33.7, Lomin: -117.6, Lamax: 34.1, Lomax: -117.2
  const url = `https://opensky-network.org/api/states/all?lamin=33.7&lomin=-117.6&lamax=34.1&lomax=-117.2`;

  try {
    const auth = Buffer.from(`${clientID}:${clientSecret}`).toString('base64');
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new Error(`OpenSky API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Return the data to your frontend
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}