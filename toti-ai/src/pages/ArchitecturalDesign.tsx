import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Loader2, 
  MapPin, 
  Building2, 
  Layers, 
  Maximize, 
  Box, 
  ArrowRight, 
  Info,
  RotateCcw,
  MousePointer2
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";

// 3D Building Component
function BuildingModel({ width, length, height, floors }: { width: number, length: number, height: number, floors: number }) {
  return (
    <group position={[0, height / 2, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, length]} />
        <meshStandardMaterial color="#3b82f6" opacity={0.7} transparent />
      </mesh>
      {/* Floor lines */}
      {Array.from({ length: floors }).map((_, i) => (
        <mesh key={i} position={[0, -height / 2 + (i + 1) * (height / floors), 0]}>
          <boxGeometry args={[width + 0.05, 0.02, length + 0.05]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
      <mesh position={[0, -height / 2, 0]}>
        <boxGeometry args={[width + 0.1, 0.05, length + 0.1]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
    </group>
  );
}

interface DesignResult {
  landArea: number;
  zoning: string;
  maxFar: number; // Floor Area Ratio (%)
  maxBcr: number; // Building Coverage Ratio (%)
  suggestedBcr: number;
  suggestedFar: number;
  buildingWidth: number;
  buildingLength: number;
  buildingHeight: number;
  floors: number;
  totalFloorArea: number;
  footprintArea: number;
  description: string;
}

export default function ArchitecturalDesign() {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isDesigning, setIsDesigning] = useState(false);
  const [error, setError] = useState('');
  const [design, setDesign] = useState<DesignResult | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    setAddress(juso.roadAddr);
    setShowSuggestions(false);
    await startDesign(juso.roadAddr);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setShowSuggestions(false);
    await startDesign(address);
  };

  const startDesign = async (searchQuery: string) => {
    setIsSearching(true);
    setError('');
    setDesign(null);

    try {
      // 1. Geocode
      const kakaoRes = await fetch(`/api/kakao-geocoder?address=${encodeURIComponent(searchQuery)}`);
      const kakaoData = await kakaoRes.json();
      
      let x = "", y = "", pnu = "";
      if (kakaoData.documents?.length > 0) {
        const doc = kakaoData.documents[0];
        x = doc.x;
        y = doc.y;
        if (doc.address) {
          const bCode = doc.address.b_code || "";
          const isMountain = doc.address.mountain_yn === 'Y' ? '2' : '1';
          const mainNo = (doc.address.main_address_no || "").padStart(4, '0');
          const subNo = (doc.address.sub_address_no || "").padStart(4, '0');
          pnu = `${bCode}${isMountain}${mainNo}${subNo}`;
        }
      }

      if (!x || !y) throw new Error('주소를 찾을 수 없습니다.');

      // 2. Get Land Data
      const dataRes = await fetch(`/api/vworld-data?data=LP_PA_CBND_BU_AL,AL_AL_D010&geomFilter=POINT(${x} ${y})&buffer=10`);
      const data = await dataRes.json();
      
      let landArea = 0;
      let zoning = "일반주거지역";

      if (data.response?.status === 'OK' && data.response?.result?.featureCollection?.features) {
        const features = data.response.result.featureCollection.features;
        features.forEach((f: any) => {
          if (f.id.startsWith('LP_PA_CBND')) landArea = parseFloat(f.properties.parea || "0");
          if (f.id.startsWith('AL_AL_D010')) zoning = f.properties.mnm || zoning;
        });
      }

      if (landArea === 0) landArea = 200; // Default fallback

      // 3. AI Design with Gemini
      setIsDesigning(true);
      const ai = new GoogleGenAI({ apiKey: "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs" });
      
      const prompt = `
당신은 대한민국 건축 설계 전문가입니다. 다음 토지 정보를 바탕으로 최적의 용적률을 적용한 3D 배치안 데이터를 생성하세요.

[토지 정보]
- 소재지: ${searchQuery}
- 용도지역: ${zoning}
- 대지면적: ${landArea}㎡

[요구사항]
1. 해당 용도지역의 법적 건폐율(BCR)과 용적률(FAR) 상한선을 추정하세요.
2. 법적 기준 내에서 최대 효율을 내는 건축물 배치안을 제안하세요.
3. 결과는 반드시 JSON 형식으로만 출력하세요.

[출력 JSON 스키마]
{
  "landArea": number,
  "zoning": string,
  "maxFar": number,
  "maxBcr": number,
  "suggestedBcr": number,
  "suggestedFar": number,
  "buildingWidth": number (미터 단위, 대지 형태를 고려한 건물 가로),
  "buildingLength": number (미터 단위, 대지 형태를 고려한 건물 세로),
  "buildingHeight": number (미터 단위, 층고 3m 기준),
  "floors": number,
  "totalFloorArea": number,
  "footprintArea": number,
  "description": string (설계 의도 및 법적 근거 요약)
}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              landArea: { type: Type.NUMBER },
              zoning: { type: Type.STRING },
              maxFar: { type: Type.NUMBER },
              maxBcr: { type: Type.NUMBER },
              suggestedBcr: { type: Type.NUMBER },
              suggestedFar: { type: Type.NUMBER },
              buildingWidth: { type: Type.NUMBER },
              buildingLength: { type: Type.NUMBER },
              buildingHeight: { type: Type.NUMBER },
              floors: { type: Type.NUMBER },
              totalFloorArea: { type: Type.NUMBER },
              footprintArea: { type: Type.NUMBER },
              description: { type: Type.STRING }
            },
            required: ["landArea", "zoning", "maxFar", "maxBcr", "suggestedBcr", "suggestedFar", "buildingWidth", "buildingLength", "buildingHeight", "floors", "totalFloorArea", "footprintArea", "description"]
          }
        }
      });

      const result = JSON.parse(response.text);
      setDesign(result);

      // Deduct credits
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.data();
        const isAdmin = userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com';
        
        if (!isAdmin) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { credits: increment(-15) });
          await addDoc(collection(db, 'creditHistory'), {
            uid: user.uid,
            type: 'usage',
            amount: -15,
            description: `AI 건축 설계 (${searchQuery})`,
            timestamp: serverTimestamp()
          });
        }
      }

    } catch (err: any) {
      setError(err.message || '설계 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
      setIsDesigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-10">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-4">
            건축 시뮬레이션 ①
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">AI 건축 설계 (3D 배치)</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            최적의 용적률을 적용한 3D 배치안을 자동으로 생성합니다. 대지의 위치를 입력하면 법적 기준을 검토하여 시뮬레이션합니다.
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10 relative z-50" ref={searchRef}>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  fetchSuggestions(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="건축 설계를 진행할 주소를 입력하세요"
                className="w-full pl-14 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all text-lg"
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
                        className="w-full px-6 py-4 text-left hover:bg-blue-50 flex items-center gap-4 transition-colors border-b border-slate-50 last:border-0"
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
              type="submit"
              disabled={isSearching || isDesigning || !address.trim()}
              className="px-10 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2 text-lg whitespace-nowrap"
            >
              {isSearching || isDesigning ? <Loader2 className="w-6 h-6 animate-spin" /> : <Building2 className="w-6 h-6" />}
              AI 설계 시작
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {design && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[700px]">
            {/* Left: 3D Viewer */}
            <div className="lg:col-span-8 bg-slate-900 rounded-[2.5rem] overflow-hidden relative shadow-2xl border border-slate-800">
              <div className="absolute top-6 left-6 z-10 flex flex-col gap-2">
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-2 text-white text-sm font-medium">
                  <Box className="w-4 h-4" />
                  3D 시뮬레이션 뷰
                </div>
                <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-full text-white/60 text-xs flex items-center gap-2">
                  <MousePointer2 className="w-3 h-3" />
                  마우스로 회전 및 확대 가능
                </div>
              </div>
              
              <Canvas shadows>
                <PerspectiveCamera makeDefault position={[20, 20, 20]} fov={50} />
                <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
                
                <ambientLight intensity={0.5} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
                <pointLight position={[-10, -10, -10]} intensity={0.5} />
                
                <Suspense fallback={null}>
                  <BuildingModel 
                    width={design.buildingWidth} 
                    length={design.buildingLength} 
                    height={design.buildingHeight} 
                    floors={design.floors} 
                  />
                  <Grid 
                    infiniteGrid 
                    fadeDistance={50} 
                    fadeStrength={5} 
                    sectionSize={10} 
                    sectionColor="#334155" 
                    cellColor="#1e293b" 
                  />
                  <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={40} blur={2} far={4.5} />
                  <Environment preset="city" />
                </Suspense>
              </Canvas>

              <div className="absolute bottom-6 right-6 z-10">
                <button 
                  onClick={() => startDesign(address)}
                  className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all border border-white/20"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Right: Info Panel */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex-1 overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Layers className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">설계 분석 데이터</h3>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs text-slate-500 mb-1">대지면적</div>
                      <div className="text-lg font-black text-slate-900">{design.landArea}㎡</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs text-slate-500 mb-1">용도지역</div>
                      <div className="text-sm font-bold text-slate-900 truncate">{design.zoning}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="flex items-center gap-3">
                        <Maximize className="w-5 h-5 text-blue-600" />
                        <span className="font-bold text-blue-900">건폐율</span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-blue-900">{design.suggestedBcr}%</div>
                        <div className="text-[10px] text-blue-600">법적 상한: {design.maxBcr}%</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <div className="flex items-center gap-3">
                        <Layers className="w-5 h-5 text-indigo-600" />
                        <span className="font-bold text-indigo-900">용적률</span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-black text-indigo-900">{design.suggestedFar}%</div>
                        <div className="text-[10px] text-indigo-600">법적 상한: {design.maxFar}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-900 mb-3">건축 규모 제안</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-slate-500">층수</span>
                        <span className="font-bold text-slate-900">지상 {design.floors}층</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-slate-500">높이</span>
                        <span className="font-bold text-slate-900">{design.buildingHeight}m</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-slate-500">건축면적</span>
                        <span className="font-bold text-slate-900">{design.footprintArea}㎡</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-50">
                        <span className="text-slate-500">연면적</span>
                        <span className="font-bold text-slate-900">{design.totalFloorArea}㎡</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6">
                    <h4 className="text-sm font-bold text-slate-900 mb-2">AI 설계 의도</h4>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl italic">
                      "{design.description}"
                    </p>
                  </div>
                </div>
              </motion.div>

              <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg">
                설계 도서 다운로드 (PDF)
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
