import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai"; // GoogleGenAI에서 수정

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const { address, transactionData } = req.body;
  // Vercel 환경변수에 등록한 키를 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Gemini API Key is not set in Vercel" });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    // 모델 명칭을 최신 안정화 버전으로 설정
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `당신은 대한민국 부동산 전문가입니다. '${address}' 인근의 토지 실거래 데이터를 바탕으로 투자 분석 리포트를 마크다운 형식으로 작성해주세요.\n\n데이터:\n${transactionData}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return res.status(200).json({ report: response.text() });
  } catch (error: any) {
    console.error("AI Analysis Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
