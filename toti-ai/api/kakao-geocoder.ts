import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { address } = req.query;
  // Vercel Settings -> Environment Variables에 등록된 키를 사용합니다.
  const apiKey = process.env.VITE_KAKAO_API_KEY || process.env.KAKAO_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Kakao API Key is missing in Vercel settings" });
  }

  try {
    const response = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
      params: { query: address },
      headers: { Authorization: `KakaoAK ${apiKey}` }
    });
    res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Kakao Geocoder Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
}
