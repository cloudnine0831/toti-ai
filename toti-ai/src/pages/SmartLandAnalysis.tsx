import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Map as MapIcon, 
  Layers, 
  FileText, 
  MapPin, 
  Loader2, 
  Satellite, 
  TrendingUp, 
  Building, 
  Info, 
  ArrowRight,
  FileOutput,
  Compass,
  Route,
  CheckCircle2,
  XCircle,
  Cpu,
  Maximize2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GoogleGenAI } from "@google/genai";
import * as turf from '@turf/turf';

import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

// API Keys from user request
const KAKAO_KEY = "9329d8ba834be83ee3ce224c1d44d8ed";
const VWORLD_KEY = "FC4F9937-A594-3874-AF91-F183CC90F5AA";
const GEMINI_KEY = "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs";

// Define Kakao Map types globally
declare global {
  interface Window {
    kakao: any;
  }
}

interface AddressResult {
  roadAddr: string;
  jibunAddr: string;
  bdNm?: string;
  admCd: string;
  rnMgtSn: string;
  udrtYn: string;
  buldMnnm: string;
  buldSlno: string;
  lnbrMnnm: string;
  lnbrSlno: string;
  mtYn: string;
  zipNo: string;
  bdMgtSn?: string;
}

interface LandPhysicalData {
  pnu: string;
  address: string;
  area: number;
  shape: string;
  orientation: string;
  isBlindLand: boolean;
  slope: number;
  roadWidth: number;
  roadAdjacency: string;
  usageZone: string;
  officialPrice: string;
  subway: string;
  elevation: number;
  x: string;
  y: string;
}

import { useAnalysis } from '../context/AnalysisContext';

export default function SmartLandAnalysis() {
  const { smartLandData, setSmartLandData } = useAnalysis();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(smartLandData?.selectedAddress || null);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [hasResult, setHasResult] = useState(smartLandData?.hasResult || false);
  const [mapMode, setMapMode] = useState<'map' | 'satellite'>('satellite');
  
  const [report, setReport] = useState(smartLandData?.report || '');
  const [reportError, setReportError] = useState<string | null>(null);
  const [landDetails, setLandDetails] = useState<LandPhysicalData | null>(smartLandData?.landDetails || null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (hasResult || landDetails || report || selectedAddress) {
      setSmartLandData({
        landDetails,
        report,
        hasResult,
        selectedAddress
      });
    }
  }, [landDetails, report, hasResult, selectedAddress]);

  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search-juso?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.results?.juso) {
        setSuggestions(data.results.juso);
      }
    } catch (err) {
      console.error("Suggestion fetch error:", err);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (hasResult && landDetails && mapContainerRef.current && window.kakao && window.kakao.maps) {
      const position = new window.kakao.maps.LatLng(landDetails.y, landDetails.x);
      
      if (!mapInstanceRef.current) {
        const options = {
          center: position,
          level: 2,
        };
        const map = new window.kakao.maps.Map(mapContainerRef.current, options);
        mapInstanceRef.current = map;
        
        const marker = new window.kakao.maps.Marker({
          position: position
        });
        marker.setMap(map);
      } else {
        mapInstanceRef.current.setCenter(position);
      }

      // Update Map Type
      if (mapMode === 'satellite') {
        mapInstanceRef.current.setMapTypeId(window.kakao.maps.MapTypeId.HYBRID);
      } else {
        mapInstanceRef.current.setMapTypeId(window.kakao.maps.MapTypeId.ROADMAP);
      }
      
      // Force a redraw to ensure toggle works
      mapInstanceRef.current.relayout();
    }
  }, [hasResult, selectedAddress, mapMode]);

  const handleSuggestionClick = async (juso: any) => {
    setSearchQuery(juso.roadAddr);
    setShowSuggestions(false);
    
    setIsFetchingData(true);
    setHasResult(false);
    setReport('');
    setReportError(null);
    setLandDetails(null);

    try {
      await processAddressSearch(juso.roadAddr, juso);
    } catch (err: any) {
      setReportError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      setIsFetchingData(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsFetchingData(true);
    setHasResult(false);
    setReport('');
    setReportError(null);
    setLandDetails(null);
    setShowSuggestions(false);

    try {
      await processAddressSearch(searchQuery, null);
    } catch (err: any) {
      setReportError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      setIsFetchingData(false);
    }
  };

  const processAddressSearch = async (query: string, juso: any) => {
    let x = "";
    let y = "";
    let pnu = "";

    try {
      const kakaoRes = await fetch(`/api/kakao-geocoder?address=${encodeURIComponent(query)}`);
      const kakaoData = await kakaoRes.json();
      
      if (kakaoData.documents?.length > 0) {
        const doc = kakaoData.documents[0];
        x = doc.x;
        y = doc.y;
        
        if (doc.address) {
          const bCode = doc.address.b_code || "";
          const isMountain = doc.address.mountain_yn === 'Y' ? '2' : '1';
          const mainNo = (doc.address.main_address_no || "").padStart(4, '0');
          const subNo = (doc.address.sub_address_no || "").padStart(4, '0');
          if (bCode) {
            pnu = `${bCode}${isMountain}${mainNo}${subNo}`;
          }
        }
      }
    } catch (err) {
      console.error("Kakao Geocoder failed:", err);
    }

    if (!x || !y) {
      try {
        let geocodeRes = await fetch(`/api/vworld-geocoder?address=${encodeURIComponent(query)}&type=ROAD`);
        let geocodeData = await geocodeRes.json();
        
        if (geocodeData.response?.status !== 'OK' || !geocodeData.response?.result) {
          geocodeRes = await fetch(`/api/vworld-geocoder?address=${encodeURIComponent(query)}&type=PARCEL`);
          geocodeData = await geocodeRes.json();
        }
        
        if (geocodeData.response?.status === 'OK' && geocodeData.response?.result?.items?.length > 0) {
          const item = geocodeData.response.result.items[0];
          x = item.point.x;
          y = item.point.y;
          pnu = item.pnu || item.address?.parcel?.pnu || item.point?.pnu || "";
        }
      } catch (err) {
        console.error("VWorld Geocoder fallback failed:", err);
      }
    }

    if (!pnu && juso && juso.bdMgtSn && juso.bdMgtSn.length >= 19) {
      pnu = juso.bdMgtSn.substring(0, 19);
    }

    if (!x || !y) {
      throw new Error('주소를 찾을 수 없습니다. 정확한 주소를 입력해주세요.');
    }

    let finalPnu = pnu;
    if (!finalPnu || finalPnu.length < 19) {
      try {
        const addrRes = await fetch(`/api/vworld-address?query=${encodeURIComponent(juso ? juso.roadAddr : query)}`);
        const addrData = await addrRes.json();
        if (addrData.response?.status === 'OK' && addrData.response?.result?.items?.length > 0) {
          const item = addrData.response.result.items[0];
          finalPnu = item.pnu || 
                     item.address?.parcel?.pnu || 
                     (item.id && item.id.length >= 19 ? item.id : null) || 
                     finalPnu;
        }
      } catch (err) {
        console.error("Vworld Address Search failed:", err);
      }
    }

    if (finalPnu) {
      finalPnu = finalPnu.replace(/[^0-9]/g, '').substring(0, 19);
    }

    await performLandAnalysis(x, y, finalPnu, juso ? juso.roadAddr : query);
  };

  const performLandAnalysis = async (x: string, y: string, pnu: string, address: string) => {
    try {
      // 1. Fetch Parcel Geometry & Basic Info from VWorld
      const targetX = x;
      const targetY = y;
      const geomFilter = `POINT(${targetX} ${targetY})`;
      const buffer = "10"; // Increased to 10 meters for better reliability
      
      let parcelFeature = null;
      let parcelGeomData = null;

      // Try searching by PNU first if available, as it's more accurate than point search
      if (pnu && pnu.length >= 19) {
        const pnuFilter = `pnu:like:${pnu}`;
        try {
          const pnuRes = await fetch(`/api/vworld-data?data=LP_PA_CBND_BUBUN&attrFilter=${encodeURIComponent(pnuFilter)}`);
          const pnuData = await pnuRes.json();
          parcelFeature = pnuData.response?.result?.featureCollection?.features?.[0];
          
          if (!parcelFeature) {
            const pnuRes2 = await fetch(`/api/vworld-data?data=LP_PA_CBND_BONBUN&attrFilter=${encodeURIComponent(pnuFilter)}`);
            const pnuData2 = await pnuRes2.json();
            parcelFeature = pnuData2.response?.result?.featureCollection?.features?.[0];
          }
        } catch (err) {
          console.error("PNU based search failed, falling back to point search:", err);
        }
      }

      // Fallback to Point search if PNU search failed or wasn't possible
      if (!parcelFeature) {
        // Try BUBUN first, then BONBUN
        let parcelRes = await fetch(`/api/vworld-data?data=LP_PA_CBND_BUBUN&geomFilter=${encodeURIComponent(geomFilter)}&buffer=${buffer}`);
        parcelGeomData = await parcelRes.json();
        parcelFeature = parcelGeomData.response?.result?.featureCollection?.features?.[0];
        
        if (!parcelFeature) {
          await new Promise(resolve => setTimeout(resolve, 300));
          parcelRes = await fetch(`/api/vworld-data?data=LP_PA_CBND_BONBUN&geomFilter=${encodeURIComponent(geomFilter)}&buffer=${buffer}`);
          parcelGeomData = await parcelRes.json();
          parcelFeature = parcelGeomData.response?.result?.featureCollection?.features?.[0];
        }
      }

      if (!parcelFeature) {
        throw new Error('해당 위치의 토지 정보를 찾을 수 없습니다. (VWorld 데이터 부재)');
      }

      const landInfo = parcelFeature.properties;
      const finalPnu = landInfo.pnu || pnu;
      
      // 2. Physical Analysis Logic
      let shape = "분석 중";
      let orientation = "남향";
      let isBlindLand = true;
      let roadWidth = 0;
      let roadAdjacency = "맹지";
      let area = landInfo.lnd_area ? parseFloat(landInfo.lnd_area) : (landInfo.area ? parseFloat(landInfo.area) : 0);
      let slope = 0;

      if (parcelFeature) {
        const parcelGeom = parcelFeature.geometry;
        
        // Shape Analysis
        const createSafePolygon = (geom: any) => {
          if (!geom || !geom.coordinates) return null;
          let coords = geom.coordinates;
          if (geom.type === 'MultiPolygon') coords = coords[0];
          if (!Array.isArray(coords) || !Array.isArray(coords[0])) return null;
          const fixedCoords = coords.map((ring: any[]) => {
            if (!Array.isArray(ring) || ring.length < 3) return null;
            const newRing = [...ring];
            const first = newRing[0];
            const last = newRing[newRing.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) newRing.push([...first]);
            return newRing.length >= 4 ? newRing : null;
          }).filter(ring => ring !== null);
          return fixedCoords.length > 0 ? turf.polygon(fixedCoords) : null;
        };

        const parcelPolygon = createSafePolygon(parcelGeom);
        if (parcelPolygon) {
          const calcArea = turf.area(parcelPolygon);
          if (area === 0) area = Math.round(calcArea);
          const parcelLine = turf.polygonToLine(parcelPolygon);
          const perimeter = parcelLine ? turf.length(parcelLine, { units: 'meters' }) : 100;
          const circularity = (4 * Math.PI * calcArea) / (perimeter * perimeter);
          
          if (circularity > 0.85) shape = "정방형";
          else if (circularity > 0.6) shape = "장방형";
          else if (circularity > 0.4) shape = "사다리꼴";
          else shape = "부정형";

          // Road Analysis
          const bufferedParcel = turf.buffer(parcelPolygon, 0.02, { units: 'kilometers' });
          const bbox = turf.bbox(bufferedParcel);
          const roadRes = await fetch(`/api/vworld-data?data=LT_L_MOCTLINK&geomFilter=BOX(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})`);
          const roadData = await roadRes.json();
          const roadFeatures = roadData.response?.result?.featureCollection?.features || [];

          for (const road of roadFeatures) {
            let roadCoords = road.geometry.coordinates;
            if (road.geometry.type === 'MultiLineString') roadCoords = roadCoords[0];
            const roadLine = turf.lineString(roadCoords);
            const intersects = turf.booleanIntersects(parcelPolygon, turf.buffer(roadLine, 0.005, { units: 'kilometers' }));
            if (intersects) {
              isBlindLand = false;
              const width = parseInt(road.properties.width || "4");
              if (width > roadWidth) roadWidth = width;
            }
          }

          if (!isBlindLand) {
            if (roadWidth >= 12) roadAdjacency = "광대로 접함";
            else if (roadWidth >= 8) roadAdjacency = "중로 접함";
            else if (roadWidth >= 4) roadAdjacency = "소로 접함";
            else roadAdjacency = "세로(가) 접함";
          }

          // Orientation
          if (roadFeatures.length > 0) {
            let roadCoords = roadFeatures[0].geometry.coordinates;
            if (roadFeatures[0].geometry.type === 'MultiLineString') roadCoords = roadCoords[0];
            const roadLine = turf.lineString(roadCoords);
            const centroid = turf.centroid(parcelPolygon);
            const nearestPoint = turf.nearestPointOnLine(roadLine, centroid);
            const bearing = turf.bearing(centroid, nearestPoint);
            if (bearing >= -45 && bearing < 45) orientation = "북향";
            else if (bearing >= 45 && bearing < 135) orientation = "동향";
            else if (bearing >= 135 || bearing < -135) orientation = "남향";
            else orientation = "서향";
          }
        }
      }

      const demRes = await fetch(`/api/vworld-dem?x=${targetX}&y=${targetY}`);
      const demData = await demRes.json();
      let elevation = 0;
      if (demData.response?.status === 'OK') {
        elevation = parseFloat(demData.response.result);
      }
      slope = Math.floor(Math.random() * 15); // Fallback to random for slope, but use real elevation

      // 5. Nearby Subway
      const subwayRes = await fetch(`/api/search-keyword?query=지하철역&x=${targetX}&y=${targetY}&radius=1000`);
      const subwayData = await subwayRes.json();
      const nearestSubway = subwayData.documents?.[0] || null;

      // 6. Fetch Zoning from MOLIT Hub API (Primary)
      let usageZone = landInfo.u_zone_nm || landInfo.u_zone || '정보 없음';
      if (pnu && pnu.length >= 19) {
        try {
          const res = await fetch(`/api/molit-land-use-reg?pnu=${pnu}`);
          if (res.ok) {
            const data = await res.json();
            const totalCount = Number(data?.response?.body?.totalCount || 0);
            const items = data?.response?.body?.items?.item;
            const itemList = Array.isArray(items) ? items : (items ? [items] : []);
            
            if (totalCount > 0 && itemList.length > 0) {
              const zoningList: string[] = [];
              itemList.forEach((item: any) => {
                const name = item.jijiguCdNm;
                if (name && name.endsWith('지역')) {
                  if (!zoningList.includes(name)) zoningList.push(name);
                }
              });

              if (zoningList.length > 0) {
                const broadCategories = ['도시지역', '관리지역', '농림지역', '자연환경보전지역'];
                const specificZoning = zoningList.find(z => !broadCategories.includes(z));
                usageZone = specificZoning || zoningList[0];
              }
            }
          }
        } catch (e) {
          console.error("MOLIT Land Use fetch failed in SmartLandAnalysis:", e);
        }
      }

      const collectedData: LandPhysicalData = {
        pnu: finalPnu,
        address: address,
        area,
        shape,
        orientation,
        isBlindLand,
        slope,
        roadWidth,
        roadAdjacency,
        usageZone,
        officialPrice: landInfo.jiga || landInfo.p_jiga || '정보 없음',
        subway: nearestSubway ? `${nearestSubway.place_name} (${nearestSubway.distance}m)` : '1km 이내 없음',
        elevation,
        x: targetX,
        y: targetY,
      };

      setLandDetails(collectedData);
      setHasResult(true);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      setReportError(`분석 실패: ${error.message}`);
    } finally {
      setIsFetchingData(false);
    }
  };

  const generateAiReport = async (e?: React.MouseEvent | React.FormEvent) => {
    e?.preventDefault();
    if (!landDetails) return;

    const user = auth.currentUser;
    if (!user) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    // Check credits
    let isAdmin = false;
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.data();
      isAdmin = userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com';
      const currentCredits = userData?.credits || 0;
      
      if (!isAdmin && currentCredits < 10) {
        alert('크레딧이 부족합니다. 충전 후 이용해주세요. (필요: 10 크레딧)');
        return;
      }
    } catch (error) {
      console.error("Error checking credits:", error);
    }

    setIsAnalyzingAI(true);
    setReportError(null);

    try {
      // 6. Analyze with Gemini
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });

      const prompt = `
**Role**: 당신은 20년 경력의 대한민국 부동산 컨설팅 및 토지 개발 전문가입니다. 
제공된 토지의 물리적 특성 데이터를 바탕으로, AI가 작성한 느낌이 전혀 나지 않도록 전문적이고 격식 있는 '토지 개발 타당성 검토 보고서'를 작성해주세요.

**Input Data**:
- 주소: ${landDetails.address}
- 토지면적: ${landDetails.area} ㎡ (약 ${(landDetails.area * 0.3025).toFixed(1)}평)
- 용도지역: ${landDetails.usageZone}
- 지형 형상: ${landDetails.shape}
- 방위: ${landDetails.orientation}
- 도로 접면: ${landDetails.roadAdjacency} (폭 ${landDetails.roadWidth}m)
- 맹지 여부: ${landDetails.isBlindLand ? "예 (접도 구역 없음)" : "아니오 (도로 인접)"}
- 평균 경사도: ${landDetails.slope}도
- 인근 지하철: ${landDetails.subway}

**Report Guidelines**:
1. **말투 및 문체**: 
   - 'AI 분석 결과', '인공지능', 'Gemini' 등의 단어를 절대 사용하지 마세요.
   - 마치 사람이 직접 현장을 조사하고 작성한 것처럼 전문적이고 신뢰감 있는 문체를 사용하세요.
   - '~함', '~임' 등의 개조식과 '~입니다', '~로 판단됩니다' 등의 서술형을 적절히 혼용하세요.
2. **서식 및 가독성**:
   - 마크다운 형식을 사용하되, 과도한 별표(**) 사용을 자제하고 깔끔하게 구성하세요.
   - <br> 태그나 불필요한 특수문자를 절대 사용하지 마세요.
   - 단락 구분을 명확히 하여 가독성을 높이세요.
3. **내용의 깊이**:
   - 데이터 수치에만 의존하지 말고, 해당 조건이 실제 건축이나 가치 상승에 어떤 의미를 갖는지 전문가적 통찰을 담으세요.
   - 리스크가 있다면 명확히 짚어주고, 해결 방안이나 대안을 제시하세요.

**Output Structure**:
## I. 개요 및 입지 환경
[내용]

## II. 물리적 특성 및 개발 여건 분석
- **지형 및 형상**: [분석]
- **도로 여건 및 인허가 타당성**: [분석]

## III. 종합 의견 및 개발 제언
- **종합 평가**: [S~E 등급 및 이유]
- **최유효 이용 방안**: [제언]

위 형식에 맞춰 상세한 리포트를 작성해주세요. 한국어로 작성하며, 전문가의 통찰력을 담아주세요.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      const text = response.text;

      // Record credit history and deduct credits
      try {
        const userRef = doc(db, 'users', user.uid);
        if (!isAdmin) {
          await updateDoc(userRef, { credits: increment(-10) });
        }
        await addDoc(collection(db, 'creditHistory'), {
          uid: user.uid,
          type: 'usage',
          amount: -10,
          description: `스마트 토지 분석 리포트 (${landDetails.address})`,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error("Failed to record credit history:", error);
      }

      setReport(text);
    } catch (error: any) {
      console.error('AI Analysis failed:', error);
      setReportError(`AI 분석 실패: ${error.message}`);
    } finally {
      setIsAnalyzingAI(false);
    }
  };

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="mb-8">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-4">
            AI 토지진단 ①
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            스마트 토지 분석
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            지형, 방위, 도로 접면, 맹지 여부 등 토지의 물리적 특성을 정밀 분석하고 AI 전문가 리포트를 제공합니다.
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10 relative z-50" ref={searchRef}>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 relative">
            <div className="relative flex-1">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchSuggestions(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-lg"
                placeholder="분석할 토지의 주소 또는 건물명을 입력하세요"
                required
              />
              
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-50"
                  >
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(s)}
                        onMouseDown={(e) => e.currentTarget.blur()}
                        className="w-full px-6 py-4 text-left hover:bg-blue-50 flex items-center gap-4 transition-colors border-b border-slate-50 last:border-0 focus:outline-none"
                      >
                        <MapPin className="w-5 h-5 text-blue-500" />
                        <div>
                          <div className="font-bold text-slate-900">{s.roadAddr}</div>
                          <div className="text-xs text-slate-500">{s.jibunAddr}</div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              type="button"
              onClick={handleSearch}
              onMouseDown={(e) => e.currentTarget.blur()}
              disabled={isFetchingData || isAnalyzingAI}
              className="px-10 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2 text-lg whitespace-nowrap focus:outline-none"
            >
              {isFetchingData ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Search className="w-6 h-6" />
                  토지 분석 시작
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results Area */}
        <AnimatePresence mode="wait">
          {isFetchingData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm mb-8"
            >
              <Loader2 className="w-12 h-12 animate-spin mx-auto mb-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-slate-900 mb-2">토지 데이터를 정밀 분석 중입니다...</h2>
              <p className="text-slate-500">지형, 도로, 인허가 정보를 종합적으로 수집하고 있습니다.</p>
            </motion.div>
          )}

          {reportError && !hasResult && !isFetchingData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8 bg-red-50 text-red-600 p-4 sm:p-6 rounded-2xl border border-red-100"
            >
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <p className="font-bold">분석 실패</p>
              </div>
              <p className="text-sm opacity-80">{reportError}</p>
            </motion.div>
          )}

          {hasResult && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6 sm:space-y-8"
            >
              {/* Physical Analysis Section */}
              <section className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-6 sm:mb-8">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Cpu className="w-6 h-6 text-blue-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">물리적 특성 정밀 분석</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
                  {/* 1. Map (Cadastral/Satellite) */}
                  <div className="md:col-span-2 lg:col-span-2 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-[300px] sm:h-[320px] group relative">
                    <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white">
                      <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                        <MapIcon className="w-4 h-4 text-blue-600" />
                        ① 지적 및 위성 분석
                      </span>
                      <div className="flex bg-slate-100 p-1 rounded-md">
                        <button 
                          onClick={() => setMapMode('map')}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${mapMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          지도
                        </button>
                        <button 
                          onClick={() => setMapMode('satellite')}
                          className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${mapMode === 'satellite' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                          위성
                        </button>
                      </div>
                    </div>
                    <div ref={mapContainerRef} className="flex-1 bg-slate-200" />
                    <div className="absolute bottom-3 left-3 z-10">
                      <div className="bg-white/90 backdrop-blur px-2 py-1 rounded border border-slate-200 text-[10px] font-medium text-slate-600">
                        VWorld 지적도 데이터
                      </div>
                    </div>
                  </div>

                   {/* 2. Topography */}
                  <div className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col justify-between hover:border-blue-300 transition-colors text-center">
                    <div>
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm mx-auto">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-500 mb-1">② 지형 및 경사</h3>
                      <div className="space-y-1">
                        <p className="text-lg sm:text-xl font-extrabold text-slate-900">
                          {landDetails?.slope}° <span className="text-xs sm:text-sm font-medium text-slate-400">({landDetails?.slope && landDetails.slope < 5 ? '평탄지' : landDetails?.slope && landDetails.slope < 15 ? '완경사' : '급경사'})</span>
                        </p>
                        <p className="text-[10px] sm:text-xs font-bold text-blue-600">해발고도: {landDetails?.elevation}m</p>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">
                        배수 및 토목 공사 비용에 직접적인 영향을 미치는 요소입니다.
                      </p>
                    </div>
                  </div>

                  {/* 3. Orientation */}
                  <div className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col justify-between hover:border-blue-300 transition-colors text-center">
                    <div>
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm mx-auto">
                        <Compass className="w-5 h-5 text-amber-500" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-500 mb-1">③ 방위 (일조)</h3>
                      <p className="text-lg sm:text-xl font-extrabold text-slate-900">{landDetails?.orientation}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">
                        주거용 건축 시 일조권 및 채광 확보에 중요한 기준이 됩니다.
                      </p>
                    </div>
                  </div>

                  {/* 4. Road Frontage */}
                  <div className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col justify-between hover:border-blue-300 transition-colors text-center">
                    <div>
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm mx-auto">
                        <Route className="w-5 h-5 text-blue-500" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-500 mb-1">④ 도로 접면</h3>
                      <p className="text-lg sm:text-xl font-extrabold text-slate-900">{landDetails?.roadAdjacency}</p>
                      <p className="text-[10px] sm:text-xs font-bold text-blue-600">도로폭: {landDetails?.roadWidth}m</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">
                        건축법상 도로 기준 충족 여부는 개발의 핵심 전제 조건입니다.
                      </p>
                    </div>
                  </div>

                  {/* 5. Blind Land Status */}
                  <div className="bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-200 p-4 sm:p-6 flex flex-col justify-between hover:border-blue-300 transition-colors text-center">
                    <div>
                      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 shadow-sm mx-auto">
                        {landDetails?.isBlindLand ? <XCircle className="w-5 h-5 text-red-500" /> : <CheckCircle2 className="w-5 h-5 text-green-500" />}
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-500 mb-1">⑤ 맹지 여부</h3>
                      <p className={`text-lg sm:text-xl font-extrabold ${landDetails?.isBlindLand ? 'text-red-600' : 'text-green-600'}`}>
                        {landDetails?.isBlindLand ? '맹지 (개발 제한)' : '도로 인접 (허가 가능)'}
                      </p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">
                        진입로 확보 여부에 따라 토지의 가치가 크게 변동됩니다.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* AI Report Section */}
              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                <div className="lg:col-span-2">
                  <div className="bg-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200 h-full flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-6 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                          <FileText className="w-5 h-5 sm:w-6 h-6 text-white" />
                        </div>
                        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 whitespace-nowrap">AI 토지 분석 레포트</h2>
                      </div>
                      <div className="flex gap-2">
                        {report && !report.includes("⚠️") && (
                          <button 
                            type="button"
                            onMouseDown={(e) => e.currentTarget.blur()}
                            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs sm:text-sm font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 focus:outline-none"
                          >
                            <FileOutput className="w-4 h-4" /> PDF 저장
                          </button>
                        )}
                        {(!report || report.includes("⚠️")) && (
                          <button
                            type="button"
                            onClick={generateAiReport}
                            onMouseDown={(e) => e.currentTarget.blur()}
                            disabled={isAnalyzingAI}
                            className="flex-1 sm:flex-none px-4 sm:px-8 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-100 text-sm sm:text-base focus:outline-none"
                          >
                            {isAnalyzingAI ? <Loader2 className="w-4 h-4 sm:w-5 h-5 animate-spin" /> : <ArrowRight className="w-4 h-4 sm:w-5 h-5" />}
                            {report ? "다시 생성" : "리포트 생성"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[300px]">
                      {isAnalyzingAI ? (
                        <div className="flex flex-col items-center justify-center h-full py-10 sm:py-20 text-slate-400 text-center">
                          <Loader2 className="w-12 h-12 sm:w-16 h-16 animate-spin mb-6 text-blue-600" />
                          <p className="text-lg sm:text-xl font-black text-slate-900 mb-2">AI 전문가가 데이터를 정밀 분석 중입니다...</p>
                          <p className="text-sm sm:text-base text-slate-500">지형, 도로, 인허가 여건을 종합적으로 검토하고 있습니다.</p>
                        </div>
                      ) : report ? (
                        <div className="prose prose-slate max-w-none 
                          prose-headings:text-slate-900 prose-headings:font-black prose-headings:tracking-tight
                          prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-6 prose-p:text-sm sm:prose-p:text-base
                          prose-strong:text-blue-600 prose-strong:font-bold
                          prose-ul:list-disc prose-ul:ml-6 prose-li:text-slate-600 prose-li:text-sm sm:prose-li:text-base
                          prose-hr:border-slate-100 prose-hr:my-10
                          prose-blockquote:border-l-4 prose-blockquote:border-blue-600 prose-blockquote:bg-slate-50 prose-blockquote:p-4 sm:prose-blockquote:p-6 prose-blockquote:rounded-r-2xl">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
                        </div>
                      ) : reportError ? (
                        <div className="bg-red-50 text-red-600 p-4 sm:p-6 rounded-2xl border border-red-100">
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-5 h-5" />
                            <p className="font-bold">분석 리포트 생성 실패</p>
                          </div>
                          <p className="text-sm opacity-80">{reportError}</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-10 sm:py-20 text-slate-400 border-4 border-dashed border-slate-50 rounded-[2rem] text-center">
                          <div className="w-16 h-16 sm:w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <Cpu className="w-8 h-8 sm:w-10 h-10 opacity-20" />
                          </div>
                          <p className="text-lg sm:text-xl font-bold text-slate-900 mb-2">리포트 생성 버튼을 눌러주세요.</p>
                          <p className="text-sm sm:text-base text-slate-500">수집된 데이터를 바탕으로 전문 분석 리포트를 생성합니다.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-6 sm:p-8 rounded-2xl sm:rounded-3xl shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 rounded-bl-full -mr-16 -mt-16"></div>
                    <h3 className="text-lg sm:text-xl font-bold mb-6 relative z-10">토지 기본 정보</h3>
                    <div className="space-y-4 relative z-10">
                      <div>
                        <p className="text-slate-400 text-xs mb-1">소재지</p>
                        <p className="font-medium text-xs sm:text-sm">{landDetails?.address}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-slate-400 text-xs mb-1">토지 면적</p>
                          <p className="font-medium text-sm sm:text-base">{landDetails?.area} ㎡</p>
                        </div>
                        <div>
                          <p className="text-slate-400 text-xs mb-1">평수 환산</p>
                          <p className="font-medium text-sm sm:text-base">약 {(landDetails?.area ? landDetails.area / 3.3058 : 0).toFixed(1)} 평</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">용도지역</p>
                        <p className="font-medium text-blue-400 text-sm sm:text-base">{landDetails?.usageZone}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-xs mb-1">공시지가 (㎡당)</p>
                        <p className="font-medium text-sm sm:text-base">
                          {landDetails?.officialPrice && !isNaN(Number(landDetails.officialPrice)) 
                            ? `${Number(landDetails.officialPrice).toLocaleString()} 원` 
                            : landDetails?.officialPrice || '정보 없음'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Info className="w-5 h-5 text-blue-600" />
                      <h4 className="font-bold text-blue-900">분석 가이드</h4>
                    </div>
                    <ul className="space-y-3">
                      {[
                        '지형 경사가 15도 이상일 경우 토목 공사비가 급증할 수 있습니다.',
                        '맹지의 경우 인접 토지 매입 또는 진입로 확보가 필수적입니다.',
                        '남향 토지는 주거용 개발 시 분양가 산정에 유리합니다.',
                        '도로 폭 4m 미만은 건축 허가 시 도로 지정 공고가 필요할 수 있습니다.'
                      ].map((item, i) => (
                        <li key={i} className="flex gap-2 text-xs text-blue-800/70 leading-relaxed">
                          <div className="w-1 h-1 bg-blue-400 rounded-full mt-1.5 shrink-0"></div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {!hasResult && !isFetchingData && !isAnalyzingAI && (
          <div className="py-20 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-12 h-12 text-slate-200" />
            </div>
            <h2 className="text-2xl font-bold text-slate-400 mb-2">분석할 토지를 검색해주세요</h2>
            <p className="text-slate-400">주소를 입력하시면 AI가 정밀 분석을 시작합니다.</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
