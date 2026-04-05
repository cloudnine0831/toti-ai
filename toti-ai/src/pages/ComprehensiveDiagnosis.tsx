import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Loader2, 
  MapPin, 
  ShieldCheck, 
  Building2, 
  TrendingUp, 
  ArrowRight, 
  Info,
  CheckCircle2,
  FileText,
  Cpu,
  Zap,
  BarChart3,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface DiagnosisResult {
  address: string;
  zoning: string;
  landArea: number;
  officialPrice: number;
  summary: string;
  landDiagnosis: string;
  archSimulation: string;
  profitability: string;
  finalVerdict: string;
  score: number;
}

export default function ComprehensiveDiagnosis() {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'land' | 'arch' | 'profit'>('summary');
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
    await startDiagnosis(juso.roadAddr);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setShowSuggestions(false);
    await startDiagnosis(address);
  };

  const startDiagnosis = async (searchQuery: string) => {
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
      let officialPrice = 0;

      if (data.response?.status === 'OK' && data.response?.result?.featureCollection?.features) {
        const features = data.response.result.featureCollection.features;
        features.forEach((f: any) => {
          if (f.id.startsWith('LP_PA_CBND')) {
            landArea = parseFloat(f.properties.parea || "0");
            officialPrice = parseFloat(f.properties.pnilp || "0");
          }
          if (f.id.startsWith('AL_AL_D010')) zoning = f.properties.mnm || zoning;
        });
      }

      // 3. AI Comprehensive Diagnosis with Gemini
      setIsAnalyzing(true);
      const ai = new GoogleGenAI({ apiKey: "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs" });
      
      const prompt = `
당신은 대한민국 최고의 부동산 개발 컨설턴트입니다. 다음 토지 정보를 바탕으로 '종합 개발 진단 리포트'를 작성하세요.

[토지 정보]
- 소재지: ${searchQuery}
- 용도지역: ${zoning}
- 대지면적: ${landArea}㎡
- 공시지가: ${officialPrice.toLocaleString()}원/㎡

[요구사항]
1. **AI 토지진단**: 지형, 규제, 리스크를 종합 분석하세요.
2. **건축 시뮬레이션**: 최적의 건축 규모와 층별 구성을 제안하세요.
3. **수익성 분석**: 투자 가치와 수익률을 예측하세요.
4. **최종 결론**: 개발 여부에 대한 최종 판단과 종합 점수(100점 만점)를 산출하세요.
5. 결과는 반드시 JSON 형식으로만 출력하세요.

[출력 JSON 스키마]
{
  "address": string,
  "zoning": string,
  "landArea": number,
  "officialPrice": number,
  "summary": string (전체 진단 요약),
  "landDiagnosis": string (마크다운 형식의 토지 진단 상세),
  "archSimulation": string (마크다운 형식의 건축 시뮬레이션 상세),
  "profitability": string (마크다운 형식의 수익성 분석 상세),
  "finalVerdict": string (최종 투자 판단 및 조언),
  "score": number (0-100)
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
              address: { type: Type.STRING },
              zoning: { type: Type.STRING },
              landArea: { type: Type.NUMBER },
              officialPrice: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              landDiagnosis: { type: Type.STRING },
              archSimulation: { type: Type.STRING },
              profitability: { type: Type.STRING },
              finalVerdict: { type: Type.STRING },
              score: { type: Type.NUMBER }
            },
            required: ["address", "zoning", "landArea", "officialPrice", "summary", "landDiagnosis", "archSimulation", "profitability", "finalVerdict", "score"]
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
            await updateDoc(userRef, { credits: increment(-50) });
          }
          await addDoc(collection(db, 'creditHistory'), {
            uid: user.uid,
            type: 'usage',
            amount: -50,
            description: `종합 진단 리포트 (${searchQuery})`,
            timestamp: serverTimestamp()
          });
        } catch (error) {
          console.error("Failed to record credit history:", error);
        }
      }

    } catch (err: any) {
      setError(err.message || '진단 중 오류가 발생했습니다.');
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
            종합 진단 ④
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">종합 개발 진단 리포트</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            토지진단, 건축설계, 수익성 분석을 한 번에 수행하여 최적의 개발 방향과 최종 판단을 제공합니다.
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
                placeholder="종합 진단을 수행할 주소를 입력하세요"
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
              {isSearching || isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6" />}
              종합 진단 시작
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-20 h-20 animate-spin mb-8 text-blue-600" />
            <h3 className="text-2xl font-black text-slate-900 mb-2">종합 진단 리포트 생성 중...</h3>
            <p className="text-slate-500">토지, 건축, 수익성을 통합 분석하고 있습니다. 약 10~20초가 소요됩니다.</p>
          </div>
        )}

        {result && (
          <div className="space-y-8">
            {/* Summary Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                <Cpu className="w-64 h-64 text-blue-600" />
              </div>
              
              <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-black text-slate-900 tracking-tight">종합 진단 결과</h2>
                      <p className="text-slate-500 font-medium">{result.address}</p>
                    </div>
                  </div>
                  <p className="text-xl text-slate-700 leading-relaxed font-medium mb-8">
                    "{result.summary}"
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs text-slate-500 mb-1 font-bold">용도지역</div>
                      <div className="text-sm font-black text-slate-900">{result.zoning}</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs text-slate-500 mb-1 font-bold">대지면적</div>
                      <div className="text-sm font-black text-slate-900">{result.landArea}㎡</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs text-slate-500 mb-1 font-bold">공시지가</div>
                      <div className="text-sm font-black text-slate-900">{result.officialPrice.toLocaleString()}원</div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div className="text-xs text-slate-500 mb-1 font-bold">진단 일시</div>
                      <div className="text-sm font-black text-slate-900">{new Date().toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>
                
                <div className="lg:col-span-4 flex flex-col items-center justify-center">
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        className="text-slate-100"
                      />
                      <circle
                        cx="96"
                        cy="96"
                        r="88"
                        stroke="currentColor"
                        strokeWidth="12"
                        fill="transparent"
                        strokeDasharray={552.9}
                        strokeDashoffset={552.9 * (1 - result.score / 100)}
                        strokeLinecap="round"
                        className="text-blue-600 transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black text-slate-900">{result.score}</span>
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Score</span>
                    </div>
                  </div>
                  <div className="mt-6 px-6 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-bold">
                    개발 적합도: {result.score >= 80 ? '매우 높음' : result.score >= 60 ? '높음' : '보통'}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Tabs & Content */}
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-200 overflow-hidden min-h-[600px] flex flex-col">
              <div className="flex border-b border-slate-100 p-2 bg-slate-50/50">
                {[
                  { id: 'summary', label: '종합 판단', icon: <ShieldCheck className="w-4 h-4" /> },
                  { id: 'land', label: '토지 진단', icon: <MapPin className="w-4 h-4" /> },
                  { id: 'arch', label: '건축 설계', icon: <Building2 className="w-4 h-4" /> },
                  { id: 'profit', label: '수익성 분석', icon: <TrendingUp className="w-4 h-4" /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 py-4 px-6 rounded-2xl flex items-center justify-center gap-2 font-bold transition-all ${
                      activeTab === tab.id 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-10 flex-1 overflow-y-auto custom-scrollbar">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="prose prose-slate max-w-none 
                      prose-headings:text-slate-900 prose-headings:font-black prose-headings:tracking-tight
                      prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-6
                      prose-strong:text-blue-600 prose-strong:font-bold
                      prose-ul:list-disc prose-ul:ml-6 prose-li:text-slate-600
                      prose-hr:border-slate-100 prose-hr:my-10
                      prose-blockquote:border-l-4 prose-blockquote:border-slate-900 prose-blockquote:bg-slate-50 prose-blockquote:p-8 prose-blockquote:rounded-r-3xl"
                  >
                    {activeTab === 'summary' && (
                      <div>
                        <h3 className="text-2xl mb-6">최종 투자 판단 및 조언</h3>
                        <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 mb-10">
                          <p className="text-blue-900 text-lg font-medium leading-relaxed italic">
                            "{result.finalVerdict}"
                          </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="text-slate-900 font-bold mb-3 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-amber-500" />
                              핵심 강점
                            </h4>
                            <ul className="text-sm text-slate-600 space-y-2">
                              <li>우수한 입지 조건 및 접근성</li>
                              <li>용도지역 대비 높은 개발 가치</li>
                              <li>주변 시세 대비 경쟁력 있는 가격</li>
                            </ul>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="text-slate-900 font-bold mb-3 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              주요 리스크
                            </h4>
                            <ul className="text-sm text-slate-600 space-y-2">
                              <li>인허가 과정의 행정적 불확실성</li>
                              <li>공사비 상승에 따른 수익성 저하</li>
                              <li>주변 민원 발생 가능성</li>
                            </ul>
                          </div>
                          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <h4 className="text-slate-900 font-bold mb-3 flex items-center gap-2">
                              <ArrowRight className="w-4 h-4 text-blue-500" />
                              다음 단계 제안
                            </h4>
                            <ul className="text-sm text-slate-600 space-y-2">
                              <li>정밀 지반 조사 및 측량</li>
                              <li>상세 설계 도서 작성 및 가견적</li>
                              <li>금융 조달 계획(PF) 수립</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    {activeTab === 'land' && <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.landDiagnosis}</ReactMarkdown>}
                    {activeTab === 'arch' && <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.archSimulation}</ReactMarkdown>}
                    {activeTab === 'profit' && <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.profitability}</ReactMarkdown>}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    PDF 리포트 저장
                  </button>
                  <button className="px-6 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
                    동료와 공유하기
                  </button>
                </div>
                <button className="px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2">
                  전문가 유료 컨설팅 신청
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
