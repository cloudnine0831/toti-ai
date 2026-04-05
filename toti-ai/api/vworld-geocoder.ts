import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { address, type } = req.query;
  const apiKey = process.env.VITE_VWORLD_API_KEY || process.env.VWORLD_API_KEY;

  try {
    const response = await axios.get('https://api.vworld.kr/req/address', {
      params: {
        service: 'address',
        request: 'getcoord',
        version: '2.0',
        crs: 'EPSG:4326',
        address: address,
        refine: 'true',
        simple: 'false',
        format: 'json',
        type: type, // ROAD 또는 PARCEL
        key: apiKey
      }
    });
    res.status(200).json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
