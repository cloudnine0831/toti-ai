import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { data, attrFilter, geomFilter, buffer } = req.query;
  const apiKey = process.env.VITE_VWORLD_API_KEY || process.env.VWORLD_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "V-World API Key is missing" });
  }

  try {
    const response = await axios.get('https://api.vworld.kr/req/data', {
      params: {
        service: 'data',
        request: 'getfeature',
        data: data, // 예: LP_PA_CBND_BUBUN
        key: apiKey,
        domain: 'www.toti-ai.shop', // 사용자님 도메인
        attrFilter: attrFilter,
        geomFilter: geomFilter,
        buffer: buffer,
        size: 100
      }
    });
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("V-World Data Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
}
