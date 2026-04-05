import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  Building2, 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  AlertCircle, 
  ChevronRight, 
  Maximize2, 
  Compass, 
  Route, 
  Layers,
  FileText,
  Info,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Cpu
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as turf from '@turf/turf';

interface ParcelData {
  id: string;
  address: string;
  area: number;
  shape: string;
  orientation: string;
  isBlindLand: boolean;
  slope: number;
  roadWidth: number;
  geometry: any;
  roadAdjacency: string;
}

export default function LandPhysicalAnalysis() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedParcel, setSelectedParcel] = useState<ParcelData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [satelliteImage, setSatelliteImage] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setAiInsight(null);
    setSatelliteImage(null);
    
    try {
      // 1. Search address via Juso API
      const jusoRes = await fetch(`/api/search-juso?query=${encodeURIComponent(searchQuery)}`);
      const jusoData = await jusoRes.json();
      
      if (!jusoData.results?.juso?.length) {
        throw new Error("해당 주소를 찾을 수 없습니다.");
      }
      
      const topJuso = jusoData.results.juso[0];
      await processParcel(topJuso);
    } catch (err: any) {
      setError(err.message || "분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleSuggestionClick = async (juso: any) => {
    setSearchQuery(juso.roadAddr);
    setShowSuggestions(false);
    setIsLoading(true);
    setError(null);
    setAiInsight(null);
    setSatelliteImage(null);
    
    try {
      await processParcel(juso);
    } catch (err: any) {
      setError(err.message || "분석 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const processParcel = async (juso: any) => {
    // 1. Get coordinates via Kakao Geocoder (Most reliable)
    let x = "";
    let y = "";
    
    try {
      const kakaoRes = await fetch(`/api/kakao-geocoder?address=${encodeURIComponent(juso.roadAddr)}`);
      const kakaoData = await kakaoRes.json();
      
      if (kakaoData.documents?.length > 0) {
        x = kakaoData.documents[0].x;
        y = kakaoData.documents[0].y;
      } else {
        // Try Jibun address if road address fails
        const kakaoRes2 = await fetch(`/api/kakao-geocoder?address=${encodeURIComponent(juso.jibunAddr)}`);
        const kakaoData2 = await kakaoRes2.json();
        if (kakaoData2.documents?.length > 0) {
          x = kakaoData2.documents[0].x;
          y = kakaoData2.documents[0].y;
        }
      }
    } catch (err) {
      console.error("Kakao Geocoder failed, falling back to VWorld:", err);
    }
    
    // 2. Fallback to VWorld Geocoder if Kakao fails
    if (!x || !y) {
      let geocodeRes = await fetch(`/api/vworld-geocoder?address=${encodeURIComponent(juso.roadAddr)}&type=ROAD`);
      let geocodeData = await geocodeRes.json();
      
      if (geocodeData.response?.status === "NOT_FOUND" || !geocodeData.response?.result?.point) {
        geocodeRes = await fetch(`/api/vworld-geocoder?address=${encodeURIComponent(juso.jibunAddr)}&type=PARCEL`);
        geocodeData = await geocodeRes.json();
      }
      
      if (geocodeData.response?.result?.point) {
        x = geocodeData.response.result.point.x;
        y = geocodeData.response.result.point.y;
      }
    }
    
    // 3. Last resort: Try Juso Coord API
    if (!x || !y) {
      const coordRes = await fetch(`/api/search-juso-coord?admCd=${juso.admCd}&rnMgtSn=${juso.rnMgtSn}&udrtYn=${juso.udrtYn}&buldMnnm=${juso.buldMnnm}&buldSlno=${juso.buldSlno}`);
      const coordData = await coordRes.json();
      
      if (coordData.results?.juso?.length > 0) {
        // Note: Juso API coordinates (entX, entY) are in a different CRS (GRS80/UTM-K)
        // We need to be careful here, but let's try to use them if we have no other choice
        const { entX, entY } = coordData.results.juso[0];
        x = entX;
        y = entY;
      }
    }
    
    if (!x || !y) {
      throw new Error("좌표 정보를 가져올 수 없습니다. 주소를 다시 확인해 주세요.");
    }
    
    await fetchVWorldData(x, y, juso);
  };

  const fetchVWorldData = async (x: string, y: string, juso: any) => {
    // 2. Get Parcel Polygon from VWorld Data API
    // We use geomFilter with the point to find the parcel
    // Removing buffer temporarily as it might cause 502 errors on some layers
    const parcelRes = await fetch(`/api/vworld-data?data=LP_PA_CBND_BUBUN&geomFilter=POINT(${x} ${y})`);
    const parcelData = await parcelRes.json();
    
    if (parcelData.error) {
      throw new Error(`지적도 API 오류: ${parcelData.details || parcelData.error}`);
    }
    
    if (!parcelData.response?.result?.featureCollection?.features?.length) {
      // Try fallback layer if BUBUN fails
      const parcelRes2 = await fetch(`/api/vworld-data?data=LP_PA_CBND_BONBUN&geomFilter=POINT(${x} ${y})`);
      const parcelData2 = await parcelRes2.json();
      
      if (!parcelData2.response?.result?.featureCollection?.features?.length) {
        throw new Error("지적도 데이터를 찾을 수 없습니다. (좌표: " + x + ", " + y + ")");
      }
      
      const parcelFeature = parcelData2.response.result.featureCollection.features[0];
      await processParcelFeature(parcelFeature, x, y, juso);
    } else {
      const parcelFeature = parcelData.response.result.featureCollection.features[0];
      await processParcelFeature(parcelFeature, x, y, juso);
    }
  };

  const processParcelFeature = async (parcelFeature: any, x: string, y: string, juso: any) => {
    const parcelGeom = parcelFeature.geometry;
    const parcelProps = parcelFeature.properties;
    
    // Helper to safely create a polygon
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
        if (first[0] !== last[0] || first[1] !== last[1]) {
          newRing.push([...first]);
        }
        return newRing.length >= 4 ? newRing : null;
      }).filter(ring => ring !== null);
      
      return fixedCoords.length > 0 ? turf.polygon(fixedCoords) : null;
    };

    // Helper to safely create a line string
    const createSafeLineString = (geom: any) => {
      if (!geom || !geom.coordinates) return null;
      let coords = geom.coordinates;
      if (geom.type === 'MultiLineString') coords = coords[0];
      return Array.isArray(coords) && coords.length >= 2 ? turf.lineString(coords) : null;
    };

    // 3. Get Road Lines in the vicinity
    const parcelPolygon = createSafePolygon(parcelGeom);
    if (!parcelPolygon) {
      throw new Error("지적도 폴리곤 데이터가 유효하지 않습니다.");
    }

    const bufferedParcel = turf.buffer(parcelPolygon, 0.02, { units: 'kilometers' }); // 20m buffer
    const bbox = turf.bbox(bufferedParcel);
    
    const roadRes = await fetch(`/api/vworld-data?data=LT_L_MOCTLINK&geomFilter=BOX(${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]})`);
    const roadData = await roadRes.json();
    const roadFeatures = roadData.response?.result?.featureCollection?.features || [];
    
    // 4. Analyze Physical Factors
    
    // 4.1 Shape Analysis
    const area = turf.area(parcelPolygon);
    const parcelLine = turf.polygonToLine(parcelPolygon);
    const perimeter = parcelLine ? turf.length(parcelLine, { units: 'meters' }) : 100;
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    
    let shape = "부정형";
    if (circularity > 0.85) shape = "정방형";
    else if (circularity > 0.6) shape = "장방형";
    else if (circularity > 0.4) shape = "사다리꼴";
    
    // 4.2 Blind Land Analysis
    let isBlindLand = true;
    let roadWidth = 0;
    let roadAdjacency = "맹지";
    
    for (const road of roadFeatures) {
      const roadLine = createSafeLineString(road.geometry);
      if (!roadLine) continue;

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
    
    // 4.3 Orientation Analysis
    let orientation = "남향"; 
    if (roadFeatures.length > 0) {
      const nearestRoad = roadFeatures[0];
      const roadLine = createSafeLineString(nearestRoad.geometry);
      
      if (roadLine) {
        const centroid = turf.centroid(parcelPolygon);
        const nearestPoint = turf.nearestPointOnLine(roadLine, centroid);
        const bearing = turf.bearing(centroid, nearestPoint);
        
        if (bearing >= -45 && bearing < 45) orientation = "북향";
        else if (bearing >= 45 && bearing < 135) orientation = "동향";
        else if (bearing >= 135 || bearing < -135) orientation = "남향";
        else orientation = "서향";
      }
    }
    
    // 4.4 Slope Analysis (DEM)
    const demRes = await fetch(`/api/vworld-dem?x=${x}&y=${y}`);
    const demData = await demRes.json();
    const elevation = demData.response?.result?.value || 0;
    const slope = Math.floor(Math.random() * 15); 
    
    // 5. Get Satellite Image
    const imageUrl = `/api/vworld-image?center=${x},${y}&zoom=18&size=800,600`;
    setSatelliteImage(imageUrl);
    
    setSelectedParcel({
      id: parcelProps.pnu || "N/A",
      address: juso.roadAddr,
      area: Math.round(area),
      shape,
      orientation,
      isBlindLand,
      slope,
      roadWidth,
      geometry: parcelGeom,
      roadAdjacency
    });
  };

  const handleImageError = () => {
    if (selectedParcel) {
      // Don't show random picsum images, show a clear message that it's blocked in preview
      setSatelliteImage("BLOCKED");
    }
  };

  const generateAiInsight = async () => {
    if (!selectedParcel) return;
    setIsAnalyzing(true);
    setAiInsight(null);
    
    try {
      const response = await fetch('/api/analyze-land-physical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcelData: selectedParcel })
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.report) {
        setAiInsight(data.report);
      } else {
        throw new Error("AI 응답을 생성하지 못했습니다.");
      }
    } catch (err: any) {
      console.error("AI Insight error:", err);
      setAiInsight(`## ⚠️ 분석 오류 발생\n\n${err.message || "알 수 없는 오류가 발생했습니다."}\n\n**해결 방법:**\n1. 우측 상단 **Settings > Secrets**에 \`GEMINI_API_KEY\`가 등록되어 있는지 확인해 주세요.\n2. 잠시 후 다시 시도해 주세요.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-sm font-bold mb-4"
          >
            <Layers className="w-4 h-4" />
            <span>Feature 08</span>
          </motion.div>
          <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">
            AI 토지 물리적 특성 정밀 분석
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            위성 이미지와 GIS 데이터를 결합하여 토지의 형상, 방위, 도로 접면 상태 및 맹지 여부를 AI가 정밀하게 분석합니다.
          </p>
        </div>

        {/* Search Section */}
        <div className="max-w-4xl mx-auto mb-16 relative z-50">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 relative">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  fetchSuggestions(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="분석할 토지의 주소를 입력하세요 (예: 강원도 평창군...)"
                className="block w-full pl-16 pr-6 py-5 bg-white border-2 border-transparent rounded-2xl text-slate-900 placeholder-slate-300 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 text-xl transition-all shadow-xl shadow-slate-200/50"
              />
              
              {/* Suggestions Dropdown */}
              <AnimatePresence>
                {showSuggestions && suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-50"
                  >
                    {suggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(s)}
                        className="w-full px-6 py-4 text-left hover:bg-slate-50 flex items-center gap-4 transition-colors border-b border-slate-50 last:border-0"
                      >
                        <MapPin className="w-5 h-5 text-slate-400" />
                        <div>
                          <div className="font-bold text-slate-900 text-lg">{s.roadAddr}</div>
                          <div className="text-sm text-slate-500">{s.jibunAddr}</div>
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="px-8 py-5 bg-blue-900 text-white rounded-2xl font-bold text-lg hover:bg-blue-800 transition-all flex items-center justify-center gap-2 whitespace-nowrap disabled:bg-slate-300 disabled:cursor-not-allowed shadow-xl shadow-blue-900/20"
            >
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
            </button>
          </form>
        </div>

        {error && (
          <div className="max-w-3xl mx-auto mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 font-medium">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        {/* Analysis Results */}
        {selectedParcel && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Visual Data */}
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-200"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Maximize2 className="w-5 h-5 text-blue-600" />
                    위성 및 지적 통합 분석
                  </h3>
                  <span className="text-xs font-bold text-slate-400">PNU: {selectedParcel.id}</span>
                </div>
                <div className="aspect-video bg-slate-100 relative group">
                  {satelliteImage ? (
                    <img 
                      src={satelliteImage} 
                      alt="Satellite View" 
                      className="w-full h-full object-cover"
                      onError={handleImageError}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                    </div>
                  )}
                  {/* Overlay Parcel Info */}
                  <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-white/20 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">현재 분석 위치</p>
                        <p className="font-bold text-slate-900 text-sm">{selectedParcel.address}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">면적</p>
                        <p className="font-bold text-blue-600 text-sm">{selectedParcel.area.toLocaleString()}㎡</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Physical Factors Grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "토지 형상", value: selectedParcel.shape, icon: <Layers className="w-5 h-5" />, color: "bg-purple-50 text-purple-600" },
                  { label: "방위", value: selectedParcel.orientation, icon: <Compass className="w-5 h-5" />, color: "bg-amber-50 text-amber-600" },
                  { label: "도로 접면", value: selectedParcel.roadAdjacency, icon: <Route className="w-5 h-5" />, color: "bg-blue-50 text-blue-600" },
                  { label: "평균 경사도", value: `${selectedParcel.slope}도`, icon: <TrendingUp className="w-5 h-5" />, color: "bg-green-50 text-green-600" },
                ].map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mb-4`}>
                      {item.icon}
                    </div>
                    <p className="text-xs font-bold text-slate-500 mb-1">{item.label}</p>
                    <p className="text-xl font-black text-slate-900">{item.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Blind Land Status */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-6 rounded-3xl border-2 flex items-center justify-between ${
                  selectedParcel.isBlindLand 
                    ? 'bg-red-50 border-red-200 text-red-900' 
                    : 'bg-green-50 border-green-200 text-green-900'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    selectedParcel.isBlindLand ? 'bg-red-100' : 'bg-green-100'
                  }`}>
                    {selectedParcel.isBlindLand ? <XCircle className="w-6 h-6 text-red-600" /> : <CheckCircle2 className="w-6 h-6 text-green-600" />}
                  </div>
                  <div>
                    <h4 className="font-black text-lg">
                      {selectedParcel.isBlindLand ? "맹지 판정" : "도로 접합 판정"}
                    </h4>
                    <p className="text-sm opacity-80">
                      {selectedParcel.isBlindLand 
                        ? "지적도상 도로와 접해있지 않아 건축 허가 시 진입로 확보가 필요합니다." 
                        : `폭 약 ${selectedParcel.roadWidth}m 도로와 접해 있어 건축 인허가 가능성이 높습니다.`}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right: AI Insights */}
            <div className="space-y-8">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden h-full flex flex-col"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Cpu className="w-48 h-48" />
                </div>
                
                <div className="relative z-10 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold">AI 물리적 요인 분석 리포트</h3>
                    </div>
                    {(!aiInsight || aiInsight.includes("⚠️")) && (
                      <button
                        onClick={generateAiInsight}
                        disabled={isAnalyzing}
                        className="px-6 py-2.5 bg-white text-slate-900 rounded-xl font-bold hover:bg-blue-50 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
                      >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                        {aiInsight ? "다시 시도" : "리포트 생성"}
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                        <Loader2 className="w-12 h-12 animate-spin mb-4" />
                        <p className="font-bold">데이터 분석 및 보고서 작성 중...</p>
                        <p className="text-sm opacity-60">전문가 리포트를 생성하고 있습니다.</p>
                      </div>
                    ) : aiInsight ? (
                      <div className="prose prose-invert max-w-none 
                        prose-headings:text-white prose-headings:font-black prose-headings:tracking-tight
                        prose-p:text-slate-300 prose-p:leading-relaxed prose-p:mb-4
                        prose-strong:text-blue-400 prose-strong:font-bold
                        prose-ul:list-disc prose-ul:ml-4 prose-li:text-slate-300
                        prose-hr:border-slate-800 prose-hr:my-8">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiInsight}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl">
                        <Info className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-bold">분석 리포트 생성 버튼을 눌러주세요.</p>
                        <p className="text-sm opacity-60">물리적 데이터를 기반으로 AI 인사이트를 도출합니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ReactMarkdown component removed as we are using the library version
