import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import axios from "axios";
import https from "https";
import http from "http";

dotenv.config();

const app = express();
const PORT = 3000;

console.log("Server starting. GEMINI_API_KEY is:", process.env.GEMINI_API_KEY ? "SET" : "NOT SET");

app.use(express.json());

// API Routes

app.get("/api/test-env", (req, res) => {
  res.json({
    geminiKeySet: !!process.env.GEMINI_API_KEY,
    geminiKeyLength: process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0
  });
});

// 1.1 Kakao Keyword Search Proxy (for Subway)
app.get("/api/search-keyword", async (req, res) => {
  const { query } = req.query;
  const kakaoKey = process.env.VITE_KAKAO_API_KEY || "9329d8ba834be83ee3ce224c1d44d8ed";
  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query as string)}&size=10`,
      {
        headers: {
          Authorization: `KakaoAK ${kakaoKey}`,
        },
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Kakao Keyword Error:", error);
    res.status(500).json({ error: "Failed to fetch keyword data" });
  }
});

// 1.1.1 Kakao Geocoder Proxy (for Coordinates)
app.get("/api/kakao-geocoder", async (req, res) => {
  const { address } = req.query;
  const kakaoKey = process.env.VITE_KAKAO_API_KEY || "9329d8ba834be83ee3ce224c1d44d8ed";
  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address as string)}`,
      {
        headers: {
          Authorization: `KakaoAK ${kakaoKey}`,
        },
      }
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Kakao Geocoder Error:", error);
    res.status(500).json({ error: "Failed to fetch geocode data" });
  }
});

// 1.2 Juso.go.kr API Proxy (Road Name Address Search)
app.get("/api/search-juso", async (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  const confmKey = process.env.JUSO_API_KEY || "U01TX0FVVEgyMDI2MDQwMjE0NDY0NjExNzg0MTI=";
  const url = `https://business.juso.go.kr/addrlink/addrLinkApi.do?confmKey=${confmKey}&currentPage=1&countPerPage=10&keyword=${encodeURIComponent(query as string)}&resultType=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Juso API Error:", error);
    res.status(500).json({ error: "Failed to fetch juso data" });
  }
});

// 1.3 Juso.go.kr API Proxy (Coordinate Search)
app.get("/api/search-juso-coord", async (req, res) => {
  const { admCd, rnMgtSn, udrtYn, buldMnnm, buldSlno } = req.query;
  
  const confmKey = process.env.JUSO_API_KEY || "U01TX0FVVEgyMDI2MDQwMjE0NDY0NjExNzg0MTI=";
  const url = `https://business.juso.go.kr/addrlink/addrCoordApi.do?confmKey=${confmKey}&admCd=${admCd}&rnMgtSn=${rnMgtSn}&udrtYn=${udrtYn}&buldMnnm=${buldMnnm}&buldSlno=${buldSlno}&resultType=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Juso Coord API Error:", error);
    res.status(500).json({ error: "Failed to fetch juso coordinate data" });
  }
});

// 2. VWorld API Proxies
const getVWorldHeaders = (req: express.Request) => {
  const domain = getVWorldDomain(req);
  const referer = req.headers.referer || `http://${domain}`;
  
  return {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Referer': referer,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Connection': 'close' // Important to prevent socket hang up with some gov proxies
  };
};

// Create an HTTPS agent that is more forgiving with legacy servers
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: false, // Set to false to avoid persistent connection issues leading to hang ups
  timeout: 30000
});

const httpAgent = new http.Agent({
  keepAlive: false,
  timeout: 30000
});

// Helper for fetch with retry (using axios to bypass Node 18+ undici SocketErrors)
async function fetchWithRetry(url: string, options: any, retries = 3) {
  let lastError: any = null;
  
  for (let i = 0; i <= retries; i++) {
    // Alternate between HTTPS and HTTP on retries if needed
    const currentUrl = (i % 2 === 1 && url.startsWith('https://')) ? url.replace('https://', 'http://') : url;
    
    try {
      const axiosOptions: any = {
        method: options.method || 'GET',
        url: currentUrl,
        headers: options.headers || {},
        timeout: 10000, // 10 seconds per attempt
        httpsAgent: httpsAgent,
        httpAgent: httpAgent,
        responseType: url.includes('image') ? 'arraybuffer' : 'text',
        validateStatus: () => true
      };

      if (i > 0) {
        console.log(`VWorld Fetch attempt ${i + 1} for ${currentUrl}...`);
      }

      const response = await axios(axiosOptions);
      
      // If we get a 502, 503, or 504, it's a server error, we should retry
      if ([502, 503, 504].includes(response.status) && i < retries) {
        throw new Error(`VWorld Server Error: ${response.status}`);
      }

      // Mimic fetch response
      return {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        arrayBuffer: async () => response.data
      };
    } catch (err: any) {
      lastError = err;
      console.error(`VWorld Attempt ${i + 1} failed for ${currentUrl}: ${err.message}`);
      
      if (i < retries) {
        // Jittered backoff
        const delay = 1000 * (i + 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Fetch failed after retries");
}

// Helper to get clean domain for VWorld (stripping protocol)
const getVWorldDomain = (req: express.Request) => {
  // Use the actual request origin or hostname instead of hardcoding localhost
  const origin = req.headers.origin || req.headers.referer;
  if (origin) {
    try {
      const url = new URL(origin);
      return url.hostname;
    } catch (e) {
      // ignore invalid URLs
    }
  }
  return req.hostname || 'localhost';
};

app.get("/api/vworld-data", async (req, res) => {
  const { data, attrFilter, buffer, geomFilter, geometry } = req.query;
  const key = process.env.VITE_VWORLD_API_KEY || "FC4F9937-A594-3874-AF91-F183CC90F5AA";
  const domain = getVWorldDomain(req);
  
  // Reverting to https as http is causing 502 Bad Gateway on VWorld's side
  // Adding crs=EPSG:4326 to ensure coordinates are interpreted correctly
  // IMPORTANT: Use encodeURIComponent for all query parameters to avoid 502 errors
  let url = `https://api.vworld.kr/req/data?service=data&request=GetFeature&data=${encodeURIComponent(data as string)}&key=${encodeURIComponent(key)}&domain=${encodeURIComponent(domain)}&crs=EPSG:4326&format=json`;
  if (attrFilter) url += `&attrFilter=${encodeURIComponent(attrFilter as string)}`;
  if (buffer) url += `&buffer=${encodeURIComponent(buffer as string)}`;
  if (geomFilter) url += `&geomFilter=${encodeURIComponent(geomFilter as string)}`;
  if (geometry) url += `&geometry=${encodeURIComponent(geometry as string)}`;

  try {
    console.log(`VWorld Data API Request URL: ${url}`);
    const response = await fetchWithRetry(url, { headers: getVWorldHeaders(req) });
    const text = await response.text();
    
    try {
      const result = JSON.parse(text);
      if (result.response?.status === "NOT_FOUND") {
        console.warn(`VWorld Data API: No data found for ${data} with filter ${attrFilter || geomFilter}`);
      } else if (result.response?.status === "ERROR") {
        console.error(`VWorld Data API Business Error for ${data}:`, result.response.error);
      }
      res.json(result);
    } catch (e) {
      console.error("VWorld Data API non-JSON response:", text.substring(0, 500));
      res.status(500).json({ 
        error: "VWorld Data API returned invalid response", 
        details: text.substring(0, 200)
      });
    }
  } catch (error) {
    console.error("VWorld Data API Error:", error);
    res.status(500).json({ error: "Failed to fetch VWorld data" });
  }
});

// 2.1 VWorld DEM API Proxy (Elevation)
app.get("/api/vworld-dem", async (req, res) => {
  const { x, y } = req.query;
  const key = "FC4F9937-A594-3874-AF91-F183CC90F5AA";
  
  const url = `https://api.vworld.kr/req/dem?service=dem&request=GetDEM&key=${key}&x=${x}&y=${y}`;

  try {
    const response = await fetchWithRetry(url, { headers: getVWorldHeaders(req) });
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      res.json(result);
    } catch (e) {
      console.error("VWorld DEM API non-JSON response:", text.substring(0, 200));
      res.status(500).json({ error: "Invalid response from VWorld DEM API" });
    }
  } catch (error) {
    console.error("VWorld DEM API Error:", error);
    res.status(500).json({ error: "Failed to fetch VWorld DEM data" });
  }
});

// 2.2 VWorld Image API Proxy (Satellite)
app.get("/api/vworld-image", async (req, res) => {
  const { center, zoom, size } = req.query;
  const key = process.env.VITE_VWORLD_API_KEY || "FC4F9937-A594-3874-AF91-F183CC90F5AA";
  const domain = getVWorldDomain(req);
  
  // Try HTTPS first, then fallback to HTTP if needed in fetchWithRetry
  const url = `https://api.vworld.kr/req/image?service=image&request=getstaticmap&key=${key}&center=${center}&zoom=${zoom}&size=${size}&basemap=SATELLITE&domain=${encodeURIComponent(domain)}`;

  try {
    const headers = getVWorldHeaders(req);
    const response = await fetchWithRetry(url, { headers });
    
    if (!response.ok) {
      console.warn(`VWorld Image API failed with status ${response.status}. Trying HTTP fallback...`);
      const httpUrl = url.replace('https://', 'http://');
      const httpResponse = await fetchWithRetry(httpUrl, { headers });
      if (!httpResponse.ok) throw new Error(`Failed to fetch image: ${httpResponse.status}`);
      
      const buffer = await httpResponse.arrayBuffer();
      res.set("Content-Type", "image/png");
      return res.send(Buffer.from(buffer));
    }

    const buffer = await response.arrayBuffer();
    res.set("Content-Type", "image/png");
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error("VWorld Image API Error:", error);
    // Return a 1x1 transparent PNG instead of 500 to prevent broken image icons if possible
    const transparentPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    res.set("Content-Type", "image/png");
    res.send(transparentPng);
  }
});

// 2.3 VWorld Geocoder API Proxy
app.get("/api/vworld-geocoder", async (req, res) => {
  let { address, type } = req.query;
  const key = process.env.VITE_VWORLD_API_KEY || "FC4F9937-A594-3874-AF91-F183CC90F5AA";
  const domain = getVWorldDomain(req);
  
  // Clean address: Remove details like floor, room number, or parentheses for better geocoding
  let cleanAddress = (address as string || "").split(',')[0].split('(')[0].trim();
  
  const url = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326&address=${encodeURIComponent(cleanAddress)}&refine=true&simple=false&type=${type || 'ROAD'}&key=${encodeURIComponent(key)}&domain=${encodeURIComponent(domain)}`;

  try {
    console.log(`VWorld Geocoder Request: ${cleanAddress} (${type}) from domain: ${domain}`);
    const response = await fetchWithRetry(url, { headers: getVWorldHeaders(req) });
    const text = await response.text();
    
    try {
      const data = JSON.parse(text);
      if (data.response?.status === "ERROR") {
        console.error("VWorld Geocoder API Business Error:", data.response.error);
      }
      res.json(data);
    } catch (parseError) {
      console.error("VWorld Geocoder non-JSON response:", text.substring(0, 500));
      res.status(500).json({ 
        error: "VWorld returned non-JSON response", 
        status: response.status,
        domain_used: domain,
        details: text.includes("Unauthorized") ? "API Key or Domain mismatch. Please check VWorld Center settings." : "Unknown server error"
      });
    }
  } catch (error) {
    console.error("VWorld Geocoder Fetch Error:", error);
    res.status(500).json({ error: "Failed to connect to VWorld Geocoder" });
  }
});

// 3. MOLIT API Proxy (Land Transactions)
app.get("/api/land-transactions", async (req, res) => {
  const { lawdCd, dealYmd } = req.query;
  if (!lawdCd || !dealYmd) {
    return res.status(400).json({ error: "lawdCd and dealYmd are required" });
  }

  const serviceKey = "6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7";
  const url = `https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade?serviceKey=${serviceKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&pageNo=1&numOfRows=100`;

  try {
    const response = await fetch(url);
    const xmlText = await response.text();
    res.send(xmlText);
  } catch (error) {
    console.error("MOLIT API Error:", error);
    res.status(500).json({ error: "Failed to fetch transaction data" });
  }
});

// 3.1 MOLIT API Proxy (Unified Real Estate Transactions)
const ALL_REAL_ESTATE_TYPES: { propertyType: string, tradeType: string, apiPath: string, apiMethod: string }[] = [
  { propertyType: "APT", tradeType: "TRADE", apiPath: "RTMSDataSvcAptTradeDev", apiMethod: "getRTMSDataSvcAptTradeDev" },
  { propertyType: "APT", tradeType: "RENT", apiPath: "RTMSDataSvcAptRent", apiMethod: "getRTMSDataSvcAptRent" },
  { propertyType: "APT", tradeType: "SILV", apiPath: "RTMSDataSvcSilvTrade", apiMethod: "getRTMSDataSvcSilvTrade" },
  { propertyType: "LOW", tradeType: "TRADE", apiPath: "RTMSDataSvcLowTrade", apiMethod: "getRTMSDataSvcLowTrade" },
  { propertyType: "LOW", tradeType: "RENT", apiPath: "RTMSDataSvcLowRent", apiMethod: "getRTMSDataSvcLowRent" },
  { propertyType: "OFFI", tradeType: "TRADE", apiPath: "RTMSDataSvcOffiTrade", apiMethod: "getRTMSDataSvcOffiTrade" },
  { propertyType: "OFFI", tradeType: "RENT", apiPath: "RTMSDataSvcOffiRent", apiMethod: "getRTMSDataSvcOffiRent" },
  { propertyType: "SH", tradeType: "TRADE", apiPath: "RTMSDataSvcSHTrade", apiMethod: "getRTMSDataSvcSHTrade" },
  { propertyType: "SH", tradeType: "RENT", apiPath: "RTMSDataSvcSHRent", apiMethod: "getRTMSDataSvcSHRent" },
  { propertyType: "LAND", tradeType: "TRADE", apiPath: "RTMSDataSvcLandTrade", apiMethod: "getRTMSDataSvcLandTrade" },
  { propertyType: "BIZ", tradeType: "TRADE", apiPath: "RTMSDataSvcBizTrade", apiMethod: "getRTMSDataSvcBizTrade" },
  { propertyType: "FACTORY", tradeType: "TRADE", apiPath: "RTMSDataSvcInduTrade", apiMethod: "getRTMSDataSvcInduTrade" },
];

app.get("/api/all-real-estate-transactions", async (req, res) => {
  const { lawdCd, dealYmd } = req.query;
  if (!lawdCd || !dealYmd) {
    return res.status(400).json({ error: "lawdCd and dealYmd are required" });
  }

  const serviceKey = "6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7";
  
  try {
    const fetchPromises = ALL_REAL_ESTATE_TYPES.map(async (type) => {
      const url = `http://apis.data.go.kr/1613000/${type.apiPath}/${type.apiMethod}?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}`;
      try {
        const response = await fetch(url);
        const xmlText = await response.text();
        return {
          propertyType: type.propertyType,
          tradeType: type.tradeType,
          xml: xmlText
        };
      } catch (err) {
        console.error(`Error fetching ${type.propertyType} ${type.tradeType}:`, err);
        return {
          propertyType: type.propertyType,
          tradeType: type.tradeType,
          xml: ""
        };
      }
    });

    const results = await Promise.all(fetchPromises);
    res.json(results);
  } catch (error) {
    console.error("MOLIT All API Error:", error);
    res.status(500).json({ error: "Failed to fetch all real estate transaction data" });
  }
});

app.get("/api/real-estate-transactions", async (req, res) => {
  const { propertyType, tradeType, lawdCd, dealYmd } = req.query;
  if (!propertyType || !tradeType || !lawdCd || !dealYmd) {
    return res.status(400).json({ error: "propertyType, tradeType, lawdCd, and dealYmd are required" });
  }

  const serviceKey = "6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7";
  
  let apiPath = "";
  let apiMethod = "";

  switch (propertyType) {
    case "APT":
      if (tradeType === "TRADE") {
        apiPath = "RTMSDataSvcAptTradeDev";
        apiMethod = "getRTMSDataSvcAptTradeDev";
      } else if (tradeType === "RENT") {
        apiPath = "RTMSDataSvcAptRent";
        apiMethod = "getRTMSDataSvcAptRent";
      } else if (tradeType === "SILV") {
        apiPath = "RTMSDataSvcSilvTrade";
        apiMethod = "getRTMSDataSvcSilvTrade";
      }
      break;
    case "LOW": // 연립다세대
      if (tradeType === "TRADE") {
        apiPath = "RTMSDataSvcLowTrade";
        apiMethod = "getRTMSDataSvcLowTrade";
      } else if (tradeType === "RENT") {
        apiPath = "RTMSDataSvcLowRent";
        apiMethod = "getRTMSDataSvcLowRent";
      }
      break;
    case "OFFI": // 오피스텔
      if (tradeType === "TRADE") {
        apiPath = "RTMSDataSvcOffiTrade";
        apiMethod = "getRTMSDataSvcOffiTrade";
      } else if (tradeType === "RENT") {
        apiPath = "RTMSDataSvcOffiRent";
        apiMethod = "getRTMSDataSvcOffiRent";
      }
      break;
    case "SH": // 단독다가구
      if (tradeType === "TRADE") {
        apiPath = "RTMSDataSvcSHTrade";
        apiMethod = "getRTMSDataSvcSHTrade";
      } else if (tradeType === "RENT") {
        apiPath = "RTMSDataSvcSHRent";
        apiMethod = "getRTMSDataSvcSHRent";
      }
      break;
    case "LAND":
      apiPath = "RTMSDataSvcLandTrade";
      apiMethod = "getRTMSDataSvcLandTrade";
      break;
    case "BIZ": // 상업업무용
      apiPath = "RTMSDataSvcBizTrade";
      apiMethod = "getRTMSDataSvcBizTrade";
      break;
    case "FACTORY": // 공장창고
      apiPath = "RTMSDataSvcInduTrade";
      apiMethod = "getRTMSDataSvcInduTrade";
      break;
  }

  if (!apiPath) {
    return res.status(400).json({ error: "Invalid propertyType or tradeType combination" });
  }

  const url = `http://apis.data.go.kr/1613000/${apiPath}/${apiMethod}?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}`;

  try {
    const response = await fetch(url);
    const xmlText = await response.text();
    res.send(xmlText);
  } catch (error) {
    console.error("MOLIT Unified API Error:", error);
    res.status(500).json({ error: "Failed to fetch real estate transaction data" });
  }
});

// 3.2 MOLIT API Proxy (Apartment Transactions - Legacy Support)
app.get("/api/apt-transactions", async (req, res) => {
  const { lawdCd, dealYmd } = req.query;
  const url = `http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7&pageNo=1&numOfRows=1000&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}`;
  try {
    const response = await fetch(url);
    const xmlText = await response.text();
    res.send(xmlText);
  } catch (error) {
    console.error("MOLIT API Error:", error);
    res.status(500).json({ error: "Failed to fetch transaction data" });
  }
});

// 3.3 Legal District Code Proxy
app.get("/api/legal-district-code", async (req, res) => {
  const { locatadd_nm } = req.query;
  const serviceKey = "6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7";
  const url = `http://apis.data.go.kr/1741000/StanReginCd/getStanReginCdList?serviceKey=${serviceKey}&pageNo=1&numOfRows=100&type=json&locatadd_nm=${encodeURIComponent(locatadd_nm as string)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Legal District Code API Error:", error);
    res.status(500).json({ error: "Failed to fetch legal district code" });
  }
});

// 3. Gemini API (Land Analysis)
app.post("/api/analyze-land", async (req, res) => {
  const { address, transactionData } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs" });
    
    const prompt = `
    다음은 '${address}' 인근의 최근 토지 실거래가 데이터(XML 형식)입니다.
    이 데이터를 바탕으로 다음 항목들을 포함하는 '스마트 토지 분석 리포트'를 작성해주세요.
    
    1. 평균 거래가 산출 (데이터가 있을 경우 평당(3.3㎡) 평균 가격 계산)
    2. 개발 잠재력 평가 (지형, 위치, 최근 거래 동향 기반 추정)
    3. 적정 매입가 산정 및 투자 조언
    
    데이터:
    ${transactionData}
    
    만약 데이터가 부족하거나 없더라도, 주소('${address}')를 기반으로 일반적인 부동산 입지 분석과 예상되는 개발 잠재력을 전문가의 시선으로 작성해주세요.
    결과는 HTML 형식을 제외하고 마크다운 형식으로 깔끔하게 정리해주세요.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Gemini API Error:", error.message || error);
    res.status(500).json({ error: `Failed to analyze data: ${error.message || 'Unknown error'}` });
  }
});

// 3.4 Gemini API (Land Physical Analysis)
app.post("/api/analyze-land-physical", async (req, res) => {
  const { parcelData } = req.body;
  
  if (!parcelData) {
    return res.status(400).json({ error: "Parcel data is required" });
  }

  try {
    // Hardcoded key for local convenience as requested
    const apiKey = "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs";
    
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
    당신은 20년 경력의 대한민국 부동산 컨설팅 및 토지 개발 전문가입니다. 
    다음 토지의 물리적 특성 데이터를 바탕으로, AI가 작성한 티가 나지 않도록 전문적이고 격식 있는 '토지 개발 타당성 검토 보고서'를 작성해주세요.
    
    [토지 기초 데이터]
    - 소재지: ${parcelData.address}
    - 면적: ${parcelData.area}㎡ (약 ${(parcelData.area * 0.3025).toFixed(1)}평)
    - 형상: ${parcelData.shape}
    - 방위: ${parcelData.orientation}
    - 도로 접면: ${parcelData.roadAdjacency} (폭 ${parcelData.roadWidth}m)
    - 맹지 여부: ${parcelData.isBlindLand ? "예 (접도 구역 없음)" : "아니오 (도로 인접)"}
    - 평균 경사도: ${parcelData.slope}도
    
    [보고서 작성 가이드라인]
    1. 문체: '~함', '~임' 등의 개조식과 '~입니다' 등의 서술형을 적절히 혼용하여 전문 보고서 느낌을 줄 것.
    2. 구조: 
       - I. 개요 및 입지 환경
       - II. 물리적 특성 분석 (형상, 고저, 방위 등)
       - III. 도로 여건 및 인허가 검토
       - IV. 종합 의견 및 개발 제언
    3. 내용: 데이터 수치에만 의존하지 말고, 해당 조건이 실제 건축이나 가치 상승에 어떤 의미를 갖는지 전문가적 통찰을 담을 것.
    4. 금지: 'AI 분석 결과', '인공지능', 'Gemini', '제미나이' 등의 단어 사용 절대 금지. 사람이 직접 조사하고 작성한 것처럼 구성할 것.
    5. 서식: 마크다운 형식을 사용하되, **과도한 별표(*)나 볼드체(**) 사용을 지양**하고, <br> 태그 등 HTML 태그를 절대 사용하지 말 것. 깔끔한 텍스트 위주로 구성할 것.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Gemini Physical Analysis Error:", error.message || error);
    res.status(500).json({ error: `AI 분석 실패: ${error.message || '알 수 없는 오류'}` });
  }
});

// 4. Contact Sales API
app.post("/api/contact-sales", async (req, res) => {
  const formData = req.body;
  
  console.log("--- New Sales Inquiry ---");
  console.log("To: cloudnine0831@gmail.com");
  console.log("Data:", JSON.stringify(formData, null, 2));
  console.log("--------------------------");

  // In a real production app, you would use a service like Nodemailer, SendGrid, or Mailgun here.
  // Example with Nodemailer (requires SMTP setup):
  /*
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'your-email@gmail.com',
      pass: 'your-app-password'
    }
  });
  
  await transporter.sendMail({
    from: '"ToTi AI Sales" <sales@totiai.com>',
    to: "cloudnine0831@gmail.com",
    subject: `New Sales Inquiry from ${formData.firstName} ${formData.lastName}`,
    text: JSON.stringify(formData, null, 2)
  });
  */

  res.json({ success: true, message: "Inquiry received and logged." });
});

// 2.4 Vworld Address Search API (for PNU)
app.get("/api/vworld-address", async (req, res) => {
  const { query, type } = req.query;
  const key = process.env.VITE_VWORLD_API_KEY || "FC4F9937-A594-3874-AF91-F183CC90F5AA";
  const domain = getVWorldDomain(req);
  
  const url = `https://api.vworld.kr/req/address?service=address&request=getaddress&version=2.0&crs=epsg:4326&address=${encodeURIComponent(query as string)}&type=${type || 'ROAD'}&key=${encodeURIComponent(key)}&domain=${encodeURIComponent(domain)}`;

  try {
    const response = await fetchWithRetry(url, { headers: getVWorldHeaders(req) });
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Vworld Address API Error:", error);
    res.status(500).json({ error: "Failed to fetch Vworld address data" });
  }
});

// 2.5 Vworld Land Use Attr API
app.get("/api/vworld-land-use-attr", async (req, res) => {
  const { pnu } = req.query;
  const key = process.env.VITE_VWORLD_API_KEY || "FC4F9937-A594-3874-AF91-F183CC90F5AA";
  
  const url = `https://api.vworld.kr/ned/data/getLandUseAttr?pnu=${pnu}&key=${key}&format=json`;

  try {
    const response = await fetchWithRetry(url, { headers: getVWorldHeaders(req) });
    const text = await response.text();
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Vworld Land Use Attr API Error:", error);
    res.status(500).json({ error: "Failed to fetch Vworld land use attribute data" });
  }
});

// 3.5 MOLIT Building Register API (BldRgstHubService)
app.get("/api/molit-building-reg", async (req, res) => {
  const { pnu } = req.query;
  const rawKey = process.env.MOLIT_API_KEY || "6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7";
  const pnuStr = pnu?.toString().trim() || "";
  
  if (pnuStr.length < 19) {
    return res.status(400).json({ error: "Invalid PNU length" });
  }

  const sigunguCd = pnuStr.substring(0, 5);
  const bjdongCd = pnuStr.substring(5, 10);
  const landGbn = pnuStr.substring(10, 11);
  const platGbCd = landGbn === '1' ? '0' : '1';
  const bun = pnuStr.substring(11, 15);
  const ji = pnuStr.substring(15, 19);

  // getBrTitleInfo for Area, Coverage Ratio, Floor Area Ratio
  const url = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo?serviceKey=${rawKey}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&platGbCd=${platGbCd}&bun=${bun}&ji=${ji}&_type=json&numOfRows=10&pageNo=1`;

  try {
    console.log(`MOLIT Building Reg Hub Request: sigunguCd=${sigunguCd}, bjdongCd=${bjdongCd}, platGbCd=${platGbCd}, bun=${bun}, ji=${ji}`);
    const response = await axios.get(url, { timeout: 15000 });
    res.json(response.data);
  } catch (error: any) {
    console.error("MOLIT Building Register Hub API Error:", error.message);
    res.status(500).json({ error: "MOLIT API Error" });
  }
});

// 3.6 MOLIT Land Use Regulation API (BldRgstHubService - getBrJijiguInfo)
app.get("/api/molit-land-use-reg", async (req, res) => {
  const { pnu } = req.query;
  const rawKey = process.env.MOLIT_API_KEY || "6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7";
  const pnuStr = pnu?.toString().trim() || "";
  
  if (pnuStr.length < 19) {
    return res.status(400).json({ error: "Invalid PNU length" });
  }

  const sigunguCd = pnuStr.substring(0, 5);
  const bjdongCd = pnuStr.substring(5, 10);
  const landGbn = pnuStr.substring(10, 11);
  const platGbCd = landGbn === '1' ? '0' : '1';
  const bun = pnuStr.substring(11, 15);
  const ji = pnuStr.substring(15, 19);

  // getBrJijiguInfo for Zoning and Regulations
  const url = `https://apis.data.go.kr/1613000/BldRgstHubService/getBrJijiguInfo?serviceKey=${rawKey}&sigunguCd=${sigunguCd}&bjdongCd=${bjdongCd}&platGbCd=${platGbCd}&bun=${bun}&ji=${ji}&_type=json&numOfRows=10&pageNo=1`;

  try {
    console.log(`MOLIT Land Use Regulation Hub Request: pnu=${pnuStr}`);
    const response = await axios.get(url, { timeout: 15000 });
    res.json(response.data);
  } catch (error: any) {
    console.error("MOLIT Land Use Regulation Hub API Error:", error.message);
    res.status(500).json({ error: "MOLIT API Error" });
  }
});

// 3.9 Gemini API (Comprehensive Regulation Analysis)
app.post("/api/analyze-regulation-comprehensive", async (req, res) => {
  const { address, pnu, landUsePlan, landUseReg, buildingReg, officialPrice, area } = req.body;
  
  try {
    const apiKey = "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs";
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `
    당신은 20년 경력의 대한민국 부동산 공법, 인허가 및 토지 개발 전문가입니다.
    제공된 공공데이터(VWorld)를 분석하여 '토지 규제 및 인허가 정밀 분석 보고서'를 작성해주세요.
    
    [대상 토지 정보]
    - 주소: ${address}
    - PNU: ${pnu}
    - 면적: ${area}㎡
    
    [수집된 공공데이터 (VWorld 분석 결과)]
    - 용도지역 및 규제 정보: ${landUsePlan || '데이터 없음 (해당 사항 없음)'}
    - 건축물 현황: ${buildingReg || '데이터 없음 (해당 사항 없음)'}
    - 개별공시지가 추정: ${officialPrice || '정보 없음'}
    
    [보고서 작성 지침]
    - 제공된 데이터는 VWorld를 통해 수집된 최신 공간정보입니다.
    - 만약 특정 데이터가 '데이터 없음' 또는 '해당 사항 없음'으로 표시되어 있다면, 이는 해당 토지에 특별한 추가 규제나 건축물이 없음을 의미하므로 이를 긍정적으로 해석하여 보고서에 반영하십시오.
    - 특히 용도지역 외에 추가적인 용도지구/구역 데이터가 없다면 "추가적인 용도지구 및 용도구역의 제한이 없는 깨끗한 필지"임을 강조하십시오.
    
    [보고서 포함 항목]
    1. 지적 및 입지 분석: 토지의 현재 상태와 입지적 장단점.
    2. 용도지역 및 건축 제한: 해당 용도지역(예: 제2종 일반주거지역)에서의 법정 건폐율/용적률 상한선(국토계획법 및 일반적 지자체 조례 기준).
    3. 행정 규제 리스크: 문화재, 군사시설, 상수원 보호구역 등 개발을 제한하는 법적 요소 정밀 진단.
    4. 예상 인허가 및 비용: 
       - 농지보전부담금 (공시지가의 30% 기준, 최대 5만원/㎡)
       - 대체산림자원조성비 (산지일 경우)
       - 기타 개발행위허가 및 건축허가 관련 행정 비용 추산.
    5. 종합 개발 제언: 해당 토지의 최적 개발 용도와 투자 가치 판단.
    
    [작성 가이드라인]
    - 전문 용어를 적절히 사용하되, 일반인도 이해할 수 있도록 쉽게 풀어서 설명할 것.
    - AI가 작성한 느낌이 나지 않도록 격식 있고 신뢰감 있는 문체를 사용할 것.
    - 마크다운 형식을 사용하여 가독성 있게 구성할 것.
    - 'Gemini', 'AI' 등의 단어 언급 금지.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: prompt,
    });

    res.json({ report: response.text });
  } catch (error: any) {
    console.error("Gemini Comprehensive Regulation Analysis Error:", error.message || error);
    res.status(500).json({ error: `AI 분석 실패: ${error.message || '알 수 없는 오류'}` });
  }
});

// 3.10 MOLIT Apartment Transaction API (getRTMSDataSvcAptTradeDev)
app.get("/api/molit-apt-trade", async (req, res) => {
  const { lawdCd, dealYmd } = req.query;
  if (!lawdCd || !dealYmd) {
    return res.status(400).json({ error: "lawdCd and dealYmd are required" });
  }

  const serviceKey = "6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7";
  // Added &numOfRows=10000 and &_type=json as per user request
  const url = `http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${serviceKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=10000&_type=json`;

  try {
    console.log(`MOLIT Apt Trade Request: lawdCd=${lawdCd}, dealYmd=${dealYmd}`);
    const response = await axios.get(url, { timeout: 30000 });
    res.json(response.data);
  } catch (error: any) {
    console.error("MOLIT Apt Trade API Error:", error.message);
    res.status(500).json({ error: "Failed to fetch apartment transaction data" });
  }
});

// 3.11 Generic MOLIT API Proxy for all real estate types
app.get("/api/molit-generic", async (req, res) => {
  const { apiPath, apiMethod, lawdCd, dealYmd } = req.query;
  if (!apiPath || !apiMethod || !lawdCd || !dealYmd) {
    return res.status(400).json({ error: "apiPath, apiMethod, lawdCd, and dealYmd are required" });
  }

  const serviceKey = "6a7b98571a836b1a2ee20d7f970d895c8c6a26baed631f9abc5c97cac52f31a7";
  const url = `http://apis.data.go.kr/1613000/${apiPath}/${apiMethod}?serviceKey=${serviceKey}&LAWD_CD=${lawdCd}&DEAL_YMD=${dealYmd}&numOfRows=10000&_type=json`;

  try {
    console.log(`MOLIT Generic Request: ${apiPath}/${apiMethod} for ${lawdCd} at ${dealYmd}`);
    const response = await axios.get(url, { timeout: 30000 });
    res.json(response.data);
  } catch (error: any) {
    console.error(`MOLIT Generic API Error (${apiPath}):`, error.message);
    res.status(500).json({ error: `Failed to fetch ${apiPath} data` });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
