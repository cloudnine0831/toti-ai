import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ShieldAlert, 
  AlertTriangle, 
  FileWarning, 
  Loader2, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Cpu, 
  ArrowRight,
  ClipboardCheck,
  Leaf
} from 'lucide-react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface RiskData {
  address: string;
  pnu: string;
  zoning: string;
  districts: string[];
  restrictions: string[];
  violBldYn: string;
  useAprDay: string;
  grndFlr: number;
  ugrndFlr: number;
  vworldGrndFlr: number;
  vworldUgrndFlr: number;
  officialPrice: string;
  area: string;
  isBlindLand: boolean;
}

interface RiskAnalysisResult {
  score: number;
  legal: { status: 'safe' | 'caution' | 'danger'; comment: string; solution: string };
  physical: { status: 'safe' | 'caution' | 'danger'; comment: string; solution: string };
  regulatory: { status: 'safe' | 'caution' | 'danger'; comment: string; solution: string };
}

import { useAnalysis } from '../context/AnalysisContext';

export default function RiskManagement() {
  const { riskData: liftedData, setRiskData: setLiftedData } = useAnalysis();
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [riskData, setRiskData] = useState<RiskData | null>(liftedData?.data || null);
  const [aiInsight, setAiInsight] = useState(liftedData?.insight || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (riskData || aiInsight) {
      setLiftedData({
        data: riskData,
        insight: aiInsight
      });
    }
  }, [riskData, aiInsight]);

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
    
    setIsSearching(true);
    setError('');
    setRiskData(null);
    setAiInsight('');
    
    try {
      await processAddressSearch(juso.roadAddr, juso);
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      setIsSearching(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!address.trim()) return;

    setIsSearching(true);
    setError('');
    setRiskData(null);
    setAiInsight('');
    setShowSuggestions(false);

    try {
      await processAddressSearch(address, null);
    } catch (err: any) {
      setError(err.message || '데이터를 불러오는 중 오류가 발생했습니다.');
      setIsSearching(false);
    }
  };

  const processAddressSearch = async (searchQuery: string, juso: any) => {
    let x = "";
    let y = "";
    let pnu = "";

    try {
      const kakaoRes = await fetch(`/api/kakao-geocoder?address=${encodeURIComponent(searchQuery)}`);
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
        let geocodeRes = await fetch(`/api/vworld-geocoder?address=${encodeURIComponent(searchQuery)}&type=ROAD`);
        let geocodeData = await geocodeRes.json();
        
        if (geocodeData.response?.status !== 'OK' || !geocodeData.response?.result) {
          geocodeRes = await fetch(`/api/vworld-geocoder?address=${encodeURIComponent(searchQuery)}&type=PARCEL`);
          geocodeData = await geocodeRes.json();
        }
        
        if (geocodeData.response?.status === 'OK' && geocodeData.response?.result?.items?.length > 0) {
          const item = geocodeData.response.result.items[0];
          x = item.point.x;
          y = item.point.y;
          pnu = item.point.pnu || item.pnu || "";
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

    await processGeocodeResult(x, y, pnu, juso ? juso.roadAddr : searchQuery);
  };

  const processGeocodeResult = async (x: string, y: string, pnu: string, displayAddress: string) => {
    try {
      let zoning = "정보 없음";
      let districts: string[] = [];
      let restrictions: string[] = [];
      let violBldYn = "0";
      let useAprDay = "";
      let grndFlr = 0;
      let ugrndFlr = 0;
      let vworldGrndFlr = 0;
      let vworldUgrndFlr = 0;
      let officialPrice = "0";
      let area = "0";
      let isBlindLand = false;

      // 1. MOLIT Building Data
      if (pnu && pnu.length >= 19) {
        try {
          const res = await fetch(`/api/molit-building-reg?pnu=${pnu}`);
          if (res.ok) {
            const data = await res.json();
            const item = data?.response?.body?.items?.item;
            const bld = Array.isArray(item) ? item[0] : item;
            if (bld) {
              violBldYn = bld.violBldYn || "0";
              useAprDay = bld.useAprDay || "";
              grndFlr = Number(bld.grndFlr || 0);
              ugrndFlr = Number(bld.ugrndFlr || 0);
              area = bld.platArea || area;
            }
          }
        } catch (e) { console.error("MOLIT Bld fetch error:", e); }
      }

      // 2. MOLIT Land Use Data
      if (pnu && pnu.length >= 19) {
        try {
          const res = await fetch(`/api/molit-land-use-reg?pnu=${pnu}`);
          if (res.ok) {
            const data = await res.json();
            const items = data?.response?.body?.items?.item;
            const itemList = Array.isArray(items) ? items : (items ? [items] : []);
            const zoningList: string[] = [];
            itemList.forEach((item: any) => {
              const name = item.jijiguCdNm;
              if (name) {
                if (name.endsWith('지역')) {
                  if (!zoningList.includes(name)) zoningList.push(name);
                } else {
                  if (!districts.includes(name)) districts.push(name);
                }
              }
              if (item.etcJijigu && item.etcJijigu !== "정보 없음") {
                if (!restrictions.includes(item.etcJijigu)) restrictions.push(item.etcJijigu);
              }
            });
            if (zoningList.length > 0) {
              const broadCategories = ['도시지역', '관리지역', '농림지역', '자연환경보전지역'];
              const specificZoning = zoningList.find(z => !broadCategories.includes(z));
              zoning = specificZoning || zoningList[0];
            }
          }
        } catch (e) { console.error("MOLIT Land fetch error:", e); }
      }

      // 3. VWorld Data (Physical & Price)
      try {
        const res = await fetch(`/api/vworld-data?data=LP_PA_CBND_BUBUN&attrFilter=pnu:=:${pnu}`);
        if (res.ok) {
          const data = await res.json();
          if (data.response?.status === 'OK' && data.response?.result?.featureCollection?.features) {
            const props = data.response.result.featureCollection.features[0].properties;
            officialPrice = props.jiga || "0";
            if (area === "0") area = props.parea || props.area || "0";
          }
        }
      } catch (e) { console.error("VWorld Parcel fetch error:", e); }

      try {
        const res = await fetch(`/api/vworld-data?data=LT_C_BLDGINFO&geomFilter=POINT(${x} ${y})&buffer=0.0001`);
        if (res.ok) {
          const data = await res.json();
          if (data.response?.status === 'OK' && data.response?.result?.featureCollection?.features) {
            const props = data.response.result.featureCollection.features[0].properties;
            vworldGrndFlr = Number(props.grnd_flr || 0);
            vworldUgrndFlr = Number(props.ugrnd_flr || 0);
          }
        }
      } catch (e) { console.error("VWorld Bld fetch error:", e); }

      // 4. Blind Land Check
      try {
        const res = await fetch(`/api/vworld-data?data=LP_PA_CBND_BUBUN&geomFilter=POINT(${x} ${y})&buffer=10`);
        if (res.ok) {
          const data = await res.json();
          const features = data.response?.result?.featureCollection?.features || [];
          isBlindLand = features.length <= 1; // Simplistic check
        }
      } catch (e) { console.error("Blind land check error:", e); }

      setRiskData({
        address: displayAddress,
        pnu: pnu || "PNU 정보 없음",
        zoning,
        districts: [...new Set(districts)].filter(d => d !== zoning),
        restrictions: [...new Set(restrictions)].filter(r => r !== zoning),
        violBldYn,
        useAprDay,
        grndFlr,
        ugrndFlr,
        vworldGrndFlr,
        vworldUgrndFlr,
        officialPrice,
        area,
        isBlindLand
      });

    } catch (err: any) {
      setError('리스크 정보를 가져오는데 실패했습니다: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const calculateRisk = (data: RiskData): RiskAnalysisResult => {
    let score = 100;
    const result: RiskAnalysisResult = {
      score: 100,
      legal: { status: 'safe', comment: '🟢 안전 (위반건축물 기록 없음)', solution: '특이사항 없음' },
      physical: { status: 'safe', comment: '🟢 현황 일치 (공적 장부와 실측 데이터 일치)', solution: '특이사항 없음' },
      regulatory: { status: 'safe', comment: '🟢 개발 가능 (중대 규제 미발견)', solution: '특이사항 없음' }
    };

    // 1. Legal Risk
    if (data.violBldYn === '1') {
      score -= 30;
      result.legal = { 
        status: 'danger', 
        comment: '🔴 위험 (위반건축물 등재됨)', 
        solution: '이행강제금 및 원상복구 리스크가 존재하므로 매수 전 반드시 시정 여부를 확인하십시오.' 
      };
    } else {
      if (data.useAprDay) {
        const year = Number(data.useAprDay.substring(0, 4));
        const currentYear = new Date().getFullYear();
        if (currentYear - year < 1) {
          score += 5;
          result.legal.comment = '🟢 신축 프리미엄 (하자보수 보증기간 확인 권장)';
        } else if (currentYear - year >= 30) {
          score -= 10;
          result.legal = {
            status: 'caution',
            comment: '🟡 노후 건물 (재건축 리스크 및 유지관리비 상승 주의)',
            solution: '장기수선충당금 적립 현황 및 건물 안전진단 결과를 검토하십시오.'
          };
        }
      }
    }

    // 2. Physical Risk
    if (data.grndFlr !== data.vworldGrndFlr || data.ugrndFlr !== data.vworldUgrndFlr) {
      score -= 20;
      result.physical = {
        status: 'caution',
        comment: '🟡 불법 증축 가능성 (공적 장부와 현황 데이터 불일치)',
        solution: '현장 실사를 통해 실제 층수와 대장상 층수를 대조하고, 무단 증축 여부를 구청에 문의하십시오.'
      };
    }

    // 3. Regulatory Risk
    const criticalKeywords = ['개발제한구역', '상수원보호구역', '비오톱'];
    const foundKeywords = [...data.districts, ...data.restrictions].filter(r => 
      criticalKeywords.some(k => r.includes(k))
    );

    if (foundKeywords.length > 0) {
      score -= 40;
      result.regulatory = {
        status: 'danger',
        comment: `🔴 개발 불가능 구역 포함 (${foundKeywords.join(', ')})`,
        solution: '해당 구역은 법적 근거에 따라 개발이 엄격히 제한됩니다. 지자체 조례를 통해 예외 조항이 있는지 확인하십시오.'
      };
    } else if (data.isBlindLand) {
      score -= 15;
      result.regulatory = {
        status: 'caution',
        comment: '🟡 맹지 리스크 (도로 접면 미확인)',
        solution: '인접 토지 매입 또는 진입로 확보 가능성을 검토하십시오.'
      };
    }

    result.score = Math.max(0, Math.min(100, score));
    return result;
  };

  const riskAnalysis = riskData ? calculateRisk(riskData) : null;

  const generateAiInsight = async () => {
    if (!riskData) return;
    
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

    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs" });
      
      const prompt = `
당신은 대한민국 부동산 개발 리스크 관리 전문가입니다. 다음 데이터를 바탕으로 '부동산 리스크 정밀 진단 리포트'를 작성하세요.

[부동산 데이터]
- 소재지: ${riskData.address}
- 용도지역: ${riskData.zoning}
- 용도지구: ${riskData.districts.join(', ') || '해당사항 없음'}
- 기타 규제: ${riskData.restrictions.join(', ') || '해당사항 없음'}
- 위반건축물 여부: ${riskData.violBldYn === '1' ? '🔴 위험 (위반건축물 등재됨)' : '🟢 안전 (기록 없음)'}
- 사용승인일: ${riskData.useAprDay || '정보 없음'}
- 층수 정보: [공적장부] 지상 ${riskData.grndFlr}층/지하 ${riskData.ugrndFlr}층 vs [현황데이터] 지상 ${riskData.vworldGrndFlr}층/지하 ${riskData.vworldUgrndFlr}층
- 공시지가: ${Number(riskData.officialPrice).toLocaleString()}원/m²
- 면적: ${riskData.area}m² (약 ${(Number(riskData.area) / 3.3058).toFixed(1)}평)

[분석 요구사항]
1. **법적/행정 리스크**: 위반건축물 여부 및 노후도(사용승인일 기준)를 분석하여 이행강제금, 원상복구, 재건축 리스크를 진단하세요.
2. **물리적 리스크**: 공적 장부와 현황 데이터의 층수 불일치를 분석하여 불법 증축 가능성을 진단하세요.
3. **규제/환경 리스크**: 용도지역 및 기타 규제(그린벨트, 상수원보호구역, 비오톱 등)를 분석하여 개발 가능 여부를 진단하세요.
4. **종합 대응 전략**: 식별된 리스크를 해결하기 위한 구체적인 법적/행정적 대응 방안을 제시하세요.

[출력 형식]
전문적인 부동산 진단 보고서 형식을 갖춘 마크다운으로 작성하세요. 한국어로 작성하며, 경고 및 주의 사항을 명확히 표시하세요.

## 1. 리스크 종합 진단 결과
- **종합 위험도**: [낮음/보통/높음/매우높음]
- **핵심 진단**: [한줄평]

## 2. 항목별 정밀 분석
### 2.1 법적 및 행정적 리스크
- [내용]
### 2.2 물리적 및 현황 리스크
- [내용]
### 2.3 토지 이용 및 규제 리스크
- [내용]

## 3. 전문가 제언 및 대응 전략
- [내용]
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

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
          description: `리스크 관리 리포트 (${riskData.address})`,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error("Failed to record credit history:", error);
      }

      setAiInsight(response.text);
    } catch (err: any) {
      setAiInsight(`⚠️ **분석 오류 발생**\n\n${err.message}\n\n서버 설정(API 키 등)을 확인해주세요.`);
    } finally {
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
            AI 토지진단 ③
          </span>
          <h1 className="text-2xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">리스크 관리 (리스크 진단)</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            법적 검토 사항, 환경 평가 등 개발 제한 요소를 사전에 식별하고 AI 전문가 리포트를 통해 대응 방안을 제시합니다.
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
                placeholder="리스크를 진단할 주소를 입력하세요"
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
              disabled={isSearching || !address.trim()}
              className="px-6 md:px-10 py-3 md:py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2 text-base md:text-lg whitespace-nowrap focus:outline-none"
            >
              {isSearching ? <Loader2 className="w-6 h-6 animate-spin" /> : <ShieldAlert className="w-6 h-6" />}
              리스크 진단 시작
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {riskData && riskAnalysis && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Top: Risk Score Header */}
            <div className="lg:col-span-12">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center border-8 ${
                    riskAnalysis.score >= 80 ? 'border-green-500 text-green-600' :
                    riskAnalysis.score >= 50 ? 'border-amber-500 text-amber-600' :
                    'border-red-500 text-red-600'
                  }`}>
                    <span className="text-3xl font-black">{riskAnalysis.score}</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 mb-1">종합 위험 점수</h2>
                    <p className="text-slate-500 font-medium">
                      {riskAnalysis.score >= 80 ? '🟢 안전: 개발 및 투자 가치가 높은 부지입니다.' :
                       riskAnalysis.score >= 50 ? '🟡 주의: 일부 리스크 요인이 식별되었습니다.' :
                       '🔴 위험: 중대한 개발 제한 요소가 존재합니다.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap md:flex-nowrap gap-4 w-full md:w-auto">
                  <div className="flex-1 md:flex-none text-center px-4 md:px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-1 uppercase">토지 면적</p>
                    <p className="text-sm md:text-base font-black text-slate-900">
                      {riskData.area}m² <span className="text-[10px] md:text-xs text-slate-500 block md:inline">(약 {(Number(riskData.area) / 3.3058).toFixed(1)}평)</span>
                    </p>
                  </div>
                  <div className="flex-1 md:flex-none text-center px-4 md:px-6 py-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] md:text-xs text-slate-400 font-bold mb-1 uppercase">공시지가</p>
                    <p className="text-sm md:text-base font-black text-slate-900">
                      {Number(riskData.officialPrice).toLocaleString()}원/m²
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Left: Detailed Analysis */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 flex-1"
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <ClipboardCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">상세 분석 항목</h3>
                </div>

                <div className="space-y-8">
                  {/* 1. Legal Risk */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Scale className="w-4 h-4 text-blue-500" />
                        법적 하부 리스크
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        riskAnalysis.legal.status === 'safe' ? 'bg-green-100 text-green-700' :
                        riskAnalysis.legal.status === 'caution' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {riskAnalysis.legal.status}
                      </span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <p className="text-xs font-bold text-slate-900">[한줄평]</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{riskAnalysis.legal.comment}</p>
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-blue-600 mb-1">[대응 방안]</p>
                        <p className="text-[10px] text-slate-500 leading-tight">{riskAnalysis.legal.solution}</p>
                      </div>
                    </div>
                  </div>

                  {/* 2. Physical Risk */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <ShieldAlert className="w-4 h-4 text-emerald-500" />
                        물리적 리스크
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        riskAnalysis.physical.status === 'safe' ? 'bg-green-100 text-green-700' :
                        riskAnalysis.physical.status === 'caution' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {riskAnalysis.physical.status}
                      </span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <p className="text-xs font-bold text-slate-900">[한줄평]</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{riskAnalysis.physical.comment}</p>
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-blue-600 mb-1">[대응 방안]</p>
                        <p className="text-[10px] text-slate-500 leading-tight">{riskAnalysis.physical.solution}</p>
                      </div>
                    </div>
                  </div>

                  {/* 3. Regulatory Risk */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <FileWarning className="w-4 h-4 text-amber-500" />
                        규제 리스크
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        riskAnalysis.regulatory.status === 'safe' ? 'bg-green-100 text-green-700' :
                        riskAnalysis.regulatory.status === 'caution' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {riskAnalysis.regulatory.status}
                      </span>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                      <p className="text-xs font-bold text-slate-900">[한줄평]</p>
                      <p className="text-xs text-slate-600 leading-relaxed">{riskAnalysis.regulatory.comment}</p>
                      <div className="pt-2 border-t border-slate-200">
                        <p className="text-[10px] font-bold text-blue-600 mb-1">[대응 방안]</p>
                        <p className="text-[10px] text-slate-500 leading-tight">{riskAnalysis.regulatory.solution}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right: AI Insights */}
            <div className="lg:col-span-8 h-full">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-3xl p-8 shadow-xl border border-slate-200 h-full flex flex-col relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                  <ShieldAlert className="w-64 h-64 text-red-600" />
                </div>
                
                <div className="relative z-10 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
                        <Cpu className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">전문가 진단 리포트</h3>
                        <p className="text-sm text-slate-500 font-medium">종합 분석 및 대응 전략</p>
                      </div>
                    </div>
                    {(!aiInsight || aiInsight.includes("⚠️")) && (
                      <button
                        type="button"
                        onClick={generateAiInsight}
                        onMouseDown={(e) => e.currentTarget.blur()}
                        disabled={isAnalyzing}
                        className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg focus:outline-none"
                      >
                        {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                        {aiInsight ? "다시 진단" : "리포트 생성"}
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                        <Loader2 className="w-16 h-16 animate-spin mb-6 text-slate-900" />
                        <p className="text-xl font-black text-slate-900 mb-2">리스크 정밀 분석 중...</p>
                        <p className="text-slate-500">수집된 모든 데이터를 종합하여 진단하고 있습니다.</p>
                      </div>
                    ) : aiInsight ? (
                      <div className="prose prose-slate max-w-none 
                        prose-headings:text-slate-900 prose-headings:font-black prose-headings:tracking-tight
                        prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-6
                        prose-strong:text-red-600 prose-strong:font-bold
                        prose-ul:list-disc prose-ul:ml-6 prose-li:text-slate-600
                        prose-hr:border-slate-100 prose-hr:my-10
                        prose-blockquote:border-l-4 prose-blockquote:border-slate-900 prose-blockquote:bg-slate-50 prose-blockquote:p-6 prose-blockquote:rounded-r-2xl">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiInsight}</ReactMarkdown>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 border-4 border-dashed border-slate-50 rounded-[2rem]">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                          <Cpu className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="text-xl font-bold text-slate-900 mb-2">진단 리포트 생성 버튼을 눌러주세요.</p>
                        <p className="text-slate-500">수집된 데이터를 바탕으로 전문 리스크 리포트를 생성합니다.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Helper icons not imported
function Scale({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/></svg>
  );
}
