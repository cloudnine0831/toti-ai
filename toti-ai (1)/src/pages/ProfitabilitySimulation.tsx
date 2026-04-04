import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Loader2, 
  MapPin, 
  TrendingUp, 
  DollarSign, 
  Calculator, 
  ArrowRight, 
  Info,
  CheckCircle2,
  BarChart3,
  Wallet,
  Building2,
  Calendar
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";

interface ProfitabilityResult {
  totalInvestment: number;
  expectedSales: number;
  netProfit: number;
  roi: number;
  paybackPeriod: number;
  constructionCost: number;
  landCost: number;
  otherCosts: number;
  monthlyRent?: number;
  yield?: number;
  yearlyCashFlow: { year: string; amount: number }[];
  costBreakdown: { name: string; value: number }[];
  description: string;
}

export default function ProfitabilitySimulation() {
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ProfitabilityResult | null>(null);
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
    await startSimulation(juso.roadAddr);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setShowSuggestions(false);
    await startSimulation(address);
  };

  const startSimulation = async (searchQuery: string) => {
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

      // 2. Get Land Data & Official Price
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

      if (landArea === 0) landArea = 200;

      // 3. AI Simulation with Gemini
      setIsAnalyzing(true);
      const ai = new GoogleGenAI({ apiKey: "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs" });
      
      const prompt = `
당신은 대한민국 부동산 투자 수익성 분석 전문가입니다. 다음 토지 정보를 바탕으로 '수익성 시뮬레이션 리포트'를 작성하세요.

[토지 정보]
- 소재지: ${searchQuery}
- 용도지역: ${zoning}
- 대지면적: ${landArea}㎡
- 공시지가: ${officialPrice.toLocaleString()}원/㎡

[요구사항]
1. 예상 토지 매입가(공시지가의 약 1.5~2.5배 추정), 공사비(평당 약 600~900만원), 기타 부대비용을 산출하세요.
2. 예상 분양가 또는 임대 수익을 추정하여 총 매출을 계산하세요.
3. 투자 수익률(ROI)과 투자 회수 기간(Payback Period)을 예측하세요.
4. 5개년 예상 현금 흐름을 시뮬레이션하세요.
5. 결과는 반드시 JSON 형식으로만 출력하세요.

[출력 JSON 스키마]
{
  "totalInvestment": number (원),
  "expectedSales": number (원),
  "netProfit": number (원),
  "roi": number (%),
  "paybackPeriod": number (년),
  "constructionCost": number (원),
  "landCost": number (원),
  "otherCosts": number (원),
  "monthlyRent": number (원, 선택사항),
  "yield": number (%, 선택사항),
  "yearlyCashFlow": [
    { "year": "1년차", "amount": number },
    { "year": "2년차", "amount": number },
    { "year": "3년차", "amount": number },
    { "year": "4년차", "amount": number },
    { "year": "5년차", "amount": number }
  ],
  "costBreakdown": [
    { "name": "토지매입비", "value": number },
    { "name": "공사비", "value": number },
    { "name": "기타비용", "value": number }
  ],
  "description": string (수익성 분석 총평)
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
              totalInvestment: { type: Type.NUMBER },
              expectedSales: { type: Type.NUMBER },
              netProfit: { type: Type.NUMBER },
              roi: { type: Type.NUMBER },
              paybackPeriod: { type: Type.NUMBER },
              constructionCost: { type: Type.NUMBER },
              landCost: { type: Type.NUMBER },
              otherCosts: { type: Type.NUMBER },
              monthlyRent: { type: Type.NUMBER },
              yield: { type: Type.NUMBER },
              yearlyCashFlow: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    year: { type: Type.STRING },
                    amount: { type: Type.NUMBER }
                  },
                  required: ["year", "amount"]
                }
              },
              costBreakdown: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    value: { type: Type.NUMBER }
                  },
                  required: ["name", "value"]
                }
              },
              description: { type: Type.STRING }
            },
            required: ["totalInvestment", "expectedSales", "netProfit", "roi", "paybackPeriod", "constructionCost", "landCost", "otherCosts", "yearlyCashFlow", "costBreakdown", "description"]
          }
        }
      });

      const resultData = JSON.parse(response.text);
      setResult(resultData);

      // Deduct credits
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.data();
        const isAdmin = userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com';
        
        if (!isAdmin) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { credits: increment(-20) });
          await addDoc(collection(db, 'creditHistory'), {
            uid: user.uid,
            type: 'usage',
            amount: -20,
            description: `수익성 시뮬레이션 (${searchQuery})`,
            timestamp: serverTimestamp()
          });
        }
      }

    } catch (err: any) {
      setError(err.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
      setIsAnalyzing(false);
    }
  };

  const formatPrice = (price: number) => {
    if (price >= 100000000) {
      return `${(price / 100000000).toFixed(1)}억원`;
    }
    if (price >= 10000) {
      return `${(price / 10000).toLocaleString()}만원`;
    }
    return `${price.toLocaleString()}원`;
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-10">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-4">
            수익성 분석 ①
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">수익성 시뮬레이션</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            예상 분양가, 공사비, 투자 회수 기간(ROI)을 예측하여 최적의 투자 기회를 제안합니다.
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
                placeholder="수익성을 분석할 주소를 입력하세요"
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
              {isSearching || isAnalyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Calculator className="w-6 h-6" />}
              수익성 분석 시작
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
            {/* Top Stats */}
            <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { label: "총 투자비", value: formatPrice(result.totalInvestment), icon: <Wallet className="w-5 h-5" />, color: "blue" },
                { label: "예상 매출", value: formatPrice(result.expectedSales), icon: <TrendingUp className="w-5 h-5" />, color: "emerald" },
                { label: "예상 순이익", value: formatPrice(result.netProfit), icon: <DollarSign className="w-5 h-5" />, color: "amber" },
                { label: "수익률 (ROI)", value: `${result.roi}%`, icon: <TrendingUp className="w-5 h-5" />, color: "indigo" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200"
                >
                  <div className={`w-10 h-10 bg-${stat.color}-100 rounded-xl flex items-center justify-center mb-4`}>
                    {React.cloneElement(stat.icon as React.ReactElement<{ className?: string }>, { className: `w-5 h-5 text-${stat.color}-600` })}
                  </div>
                  <div className="text-sm text-slate-500 font-medium mb-1">{stat.label}</div>
                  <div className="text-2xl font-black text-slate-900">{stat.value}</div>
                </motion.div>
              ))}
            </div>

            {/* Charts Section */}
            <div className="lg:col-span-8 space-y-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200"
              >
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-slate-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">연차별 예상 현금 흐름</h3>
                  </div>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.yearlyCashFlow}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(val) => `${val / 100000000}억`} />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: number) => [formatPrice(val), "예상 수익"]}
                      />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                        {result.yearlyCashFlow.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.amount > 0 ? '#3b82f6' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-10">
                  <Calculator className="w-48 h-48" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-2xl font-black mb-6 flex items-center gap-3">
                    <Info className="w-6 h-6 text-blue-400" />
                    AI 투자 분석 총평
                  </h3>
                  <p className="text-slate-300 leading-relaxed text-lg italic">
                    "{result.description}"
                  </p>
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3 mb-2">
                        <Calendar className="w-5 h-5 text-blue-400" />
                        <span className="font-bold">투자 회수 기간</span>
                      </div>
                      <div className="text-3xl font-black text-white">{result.paybackPeriod}년</div>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
                      <div className="flex items-center gap-3 mb-2">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <span className="font-bold">예상 연수익률</span>
                      </div>
                      <div className="text-3xl font-black text-white">{(result.roi / result.paybackPeriod).toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel: Cost Breakdown */}
            <div className="lg:col-span-4 space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200"
              >
                <h3 className="text-xl font-bold text-slate-900 mb-8">지출 구성 분석</h3>
                <div className="h-[250px] w-full mb-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={result.costBreakdown}
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {result.costBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: number) => formatPrice(val)}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-4">
                  {result.costBreakdown.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-sm font-bold text-slate-700">{item.name}</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{formatPrice(item.value)}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-6">수익성 극대화 전략</h3>
                <div className="space-y-4">
                  {[
                    "공사비 절감을 위한 모듈러 공법 검토",
                    "임대 수익 최적화를 위한 MD 구성",
                    "정부 지원금 및 세제 혜택 활용",
                    "분양 시점 조절을 통한 매출 극대화"
                  ].map((strategy, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-600 leading-relaxed">{strategy}</span>
                    </div>
                  ))}
                </div>
                <button className="w-full mt-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                  상세 컨설팅 신청
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
