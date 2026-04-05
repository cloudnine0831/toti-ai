import type { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.VWORLD_API_KEY || process.env.VITE_VWORLD_API_KEY;

  try {
    // 가장 단순한 요청으로 테스트해봅니다.
    const response = await axios.get('https://api.vworld.kr/req/data', {
      params: {
        service: 'data',
        request: 'getfeature',
        data: 'LP_PA_CBND_BUBUN',
        key: apiKey,
        domain: 'toti-ai.shop', // ★ 브이월드 센터에 등록된 '대표 도메인'과 100% 일치해야 함
        attrFilter: 'pnu:like:5111012000108640000',
        size: 1,
        format: 'json'
      },
      headers: {
        // 브이월드가 가장 중요하게 체크하는 부분입니다.
        'Referer': 'https://toti-ai.shop' 
      },
      timeout: 10000 // 10초 대기
    });

    return res.status(200).json(response.data);
  } catch (error: any) {
    // 여기서 에러를 더 자세히 봅니다.
    const errorMsg = error.response?.data || error.message;
    console.error("V-World Diagnostic Error:", errorMsg);
    return res.status(500).json({ error: "연결 실패", detail: errorMsg });
  }
}
