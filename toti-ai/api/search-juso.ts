import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { query } = req.query;
  const confmKey = process.env.JUSO_API_KEY || "U01TX0FVVEgyMDI2MDQwMjE0NDY0NjExNzg0MTI=";
  const url = `https://business.juso.go.kr/addrlink/addrLinkApi.do?confmKey=${confmKey}&currentPage=1&countPerPage=10&keyword=${encodeURIComponent(query as string)}&resultType=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch juso data" });
  }
}
