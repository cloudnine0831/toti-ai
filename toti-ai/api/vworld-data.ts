import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { data, attrFilter, geomFilter, buffer } = req.query;
  const apiKey = process.env.VWORLD_API_KEY || process.env.VITE_VWORLD_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "브이월드 키가 설정되지 않았습니다." });
  }

  try {
    const response = await axios.get('https://api.vworld.kr/req/data', {
      params: {
        service: 'data',
        request: 'getfeature',
        data: data,
        key: apiKey,
        domain: 'toti-ai.shop', // 브이월드에 등록한 메인 도메인
        attrFilter: attrFilter,
        geomFilter: geomFilter,
        buffer: buffer,
        size: 10, // 데이터를 조금만 요청해서 속도를 높입니다.
        format: 'json'
      },
      timeout: 8000, // 8초 안에 대답 없으면 끊기 (Vercel 타임아웃 방지)
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.toti-ai.shop'
      }
    });

    res.status(200).json(response.data);
  } catch (error: any) {
    // 상세한 에러 로그를 남깁니다.
    console.error("V-World API Error Detail:", error.response?.data || error.message);
    res.status(500).json({ 
      error: "브이월드 통신 실패", 
      message: error.message,
      detail: error.response?.data 
    });
  }
}
