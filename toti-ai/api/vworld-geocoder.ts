import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { address, type } = req.query;
  const key = process.env.VITE_VWORLD_API_KEY || "FC4F9937-A594-3874-AF91-F183CC90F5AA";
  const domain = req.headers.host || 'toti-ai.shop';
  
  let cleanAddress = (address as string || "").split(',')[0].split('(')[0].trim();
  const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326&address=${encodeURIComponent(cleanAddress)}&refine=true&simple=false&type=${type || 'ROAD'}&key=${key}&domain=${domain}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: "VWorld connection failed" });
  }
}
