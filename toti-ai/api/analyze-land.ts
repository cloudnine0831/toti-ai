import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/generative-ai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const { address, transactionData } = req.body;
  const apiKey = process.env.GEMINI_API_KEY || "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs";

  try {
    const genAI = new GoogleGenAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // 안정적인 모델명 사용

    const prompt = `다음은 '${address}' 인근 토지 실거래가 데이터입니다. 이를 바탕으로 전문가의 시선에서 투자 분석 리포트를 마크다운 형식으로 작성해주세요.\n\n데이터:\n${transactionData}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return res.status(200).json({ report: response.text() });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
