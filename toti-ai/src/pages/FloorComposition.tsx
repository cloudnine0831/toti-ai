import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Loader2, 
  MapPin, 
  Layers, 
  Building2, 
  LayoutGrid, 
  ArrowRight, 
  Info,
  CheckCircle2,
  PieChart,
  Table as TableIcon
} from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";

interface FloorData {
  floor: string;
  use: string;
  area: number;
  efficiency: number;
  description: string;
}

interface CompositionResult {
  totalFloors: number;
  totalArea: number;
  averageEfficiency: number;
  floors: FloorData[];
  summary: string;
  legalCheck: string[];
}

export default function FloorComposition() {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompositionResult | null>(null);
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
    await startAnalysis(juso.roadAddr);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setShowSuggestions(false);
    await startAnalysis(address);
  };

  const startAnalysis = async (searchQuery: string) => {
    setIsSearching(true);
    setError('');
    setResult(null);

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

      if (landArea === 0) landArea = 200;

      // 3. AI Composition with Gemini
      setIsAnalyzing(true);
      const ai = new GoogleGenAI({ apiKey: "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs" });
      
      const prompt = `
당신은 대한민국 건축 기획 전문가입니다. 다음 토지 정보를 바탕으로 법적 기준 내에서 최대 효율을 내는 '층별/용도별 구성안'을 제안하세요.

[토지 정보]
- 소재지: ${searchQuery}
- 용도지역: ${zoning}
- 대지면적: ${landArea}㎡

[요구사항]
1. 해당 용도지역의 법적 건폐율과 용적률을 고려하여 층수를 결정하세요.
2. 각 층별로 가장 수익성이 높거나 효율적인 용도(상가, 사무실, 주거 등)를 배정하세요.
3. 층별 전용면적과 공용면적을 고려한 효율성(%)을 산출하세요.
4. 결과는 반드시 JSON 형식으로만 출력하세요.

[출력 JSON 스키마]
{
  "totalFloors": number,
  "totalArea": number,
  "averageEfficiency": number,
  "floors": [
    {
      "floor": string (예: "B1", "1F", "2F"),
      "use": string (예: "근린생활시설", "업무시설", "다세대주택"),
      "area": number (㎡),
      "efficiency": number (%),
      "description": string (해당 층 구성 이유)
    }
  ],
  "summary": string (전체 구성 전략 요약),
  "legalCheck": string[] (준수한 법적 기준 리스트)
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
              totalFloors: { type: Type.NUMBER },
              totalArea: { type: Type.NUMBER },
              averageEfficiency: { type: Type.NUMBER },
              floors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    floor: { type: Type.STRING },
                    use: { type: Type.STRING },
                    area: { type: Type.NUMBER },
                    efficiency: { type: Type.NUMBER },
                    description: { type: Type.STRING }
                  },
                  required: ["floor", "use", "area", "efficiency", "description"]
                }
              },
              summary: { type: Type.STRING },
              legalCheck: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["totalFloors", "totalArea", "averageEfficiency", "floors", "summary", "legalCheck"]
          }
        }
      });

      const resultData = JSON.parse(response.text);
      setResult(resultData);

      // Record credit history and deduct credits
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.data();
        const isAdmin = userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com';
        
        try {
          const userRef = doc(db, 'users', user.uid);
          if (!isAdmin) {
            await updateDoc(userRef, { credits: increment(-10) });
          }
          await addDoc(collection(db, 'creditHistory'), {
            uid: user.uid,
            type: 'usage',
            amount: -10,
            description: `MD 및 층별 구성 리포트 (${searchQuery})`,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          console.error("Failed to record credit history:", error);
        }
      }

    } catch (err: any) {
      setError(err.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
      setIsAnalyzing(false);
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
            건축 시뮬레이션 ②
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">층별/용도별 구성 제안</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            법적 기준 내에서 최대 효율을 내는 층수 및 면적 구성을 제안합니다. 각 층별 최적 용도와 전용 면적 비율을 분석합니다.
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
                placeholder="층별 구성을 분석할 주소를 입력하세요"
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
              disabled={isSearching || isAnalyzing || !address.trim()}
              className="px-10 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2 text-lg whitespace-nowrap"
            >
              {isSearching || isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <LayoutGrid className="w-6 h-6" />}
              구성 분석 시작
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Summary & Legal */}
            <div className="lg:col-span-4 space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <PieChart className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">전체 구성 요약</h3>
                </div>
                
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-end">
                    <span className="text-slate-500 text-sm font-medium">총 층수</span>
                    <span className="text-2xl font-black text-slate-900">{result.totalFloors}층</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-slate-500 text-sm font-medium">총 연면적</span>
                    <span className="text-2xl font-black text-slate-900">{result.totalArea.toLocaleString()}㎡</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <span className="text-slate-500 text-sm font-medium">평균 전용률</span>
                    <span className="text-2xl font-black text-blue-600">{result.averageEfficiency}%</span>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    법적 검토 완료
                  </h4>
                  <ul className="space-y-2">
                    {result.legalCheck.map((check, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-center gap-2">
                        <div className="w-1 h-1 bg-slate-300 rounded-full" />
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>

              <div className="bg-blue-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Building2 className="w-32 h-32" />
                </div>
                <h4 className="text-lg font-bold mb-4 relative z-10">전문가 코멘트</h4>
                <p className="text-blue-100 text-sm leading-relaxed relative z-10 italic">
                  "{result.summary}"
                </p>
              </div>
            </div>

            {/* Right: Floor Breakdown */}
            <div className="lg:col-span-8">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <TableIcon className="w-6 h-6 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">층별 세부 구성안</h3>
                  </div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Floor-by-Floor Breakdown</div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">층</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">권장 용도</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase text-right">면적(㎡)</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase text-right">전용률</th>
                        <th className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">비고</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.floors.map((floor, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-8 py-6 font-black text-slate-900">{floor.floor}</td>
                          <td className="px-8 py-6">
                            <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                              {floor.use}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right font-medium text-slate-600">{floor.area.toLocaleString()}</td>
                          <td className="px-8 py-6 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-600 rounded-full" 
                                  style={{ width: `${floor.efficiency}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-900">{floor.efficiency}%</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-xs text-slate-500 max-w-xs leading-relaxed">
                            {floor.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-sm text-slate-500">
                    * 본 제안은 수익성 극대화를 위한 AI 시뮬레이션 결과입니다.
                  </p>
                  <button className="flex items-center gap-2 text-blue-600 font-bold text-sm hover:gap-3 transition-all">
                    상세 설계 의뢰하기
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
