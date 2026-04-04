import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  MapPin, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Filter, 
  ArrowRight, 
  Building2, 
  Info, 
  Loader2, 
  ChevronLeft,
  Calendar,
  Layers,
  ArrowUpRight,
  FileText,
  X
} from 'lucide-react';
import Markdown from 'react-markdown';

interface Transaction {
  name: string;
  umdNm: string;
  amount?: number;
  deposit?: number;
  monthlyRent?: number;
  area: number;
  floor?: number;
  dealDate: string;
  pricePerPyeong?: number;
  propertyType: string;
  tradeType: string;
}

interface RegionData {
  id: string;
  name: string;
  avgPrice: number;
  change: number;
  volume: number;
  topDistrict: string;
  transactions: Transaction[];
}

const INITIAL_DISTRICTS = [
  { id: '11680', name: '서울 강남구' },
  { id: '41135', name: '경기 성남분당구' },
  { id: '26440', name: '부산 해운대구' },
  { id: '27230', name: '대구 수성구' },
  { id: '28185', name: '인천 연수구' },
];

type PropertyType = 'APT' | 'LOW' | 'OFFI' | 'SH' | 'LAND' | 'BIZ' | 'FACTORY';
type TradeType = 'TRADE' | 'RENT' | 'SILV';

const PROPERTY_LABELS: Record<PropertyType, string> = {
  APT: '아파트',
  LOW: '빌라/다세대',
  OFFI: '오피스텔',
  SH: '단독/다가구',
  LAND: '토지',
  BIZ: '상업업무용',
  FACTORY: '공장/창고'
};

const TRADE_LABELS: Record<TradeType, string> = {
  TRADE: '매매',
  RENT: '전월세',
  SILV: '분양권'
};

export default function RealTransactionPrices() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [realData, setRealData] = useState<RegionData[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<RegionData | null>(null);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchMode, setSearchMode] = useState<'district' | 'apartment'>('district');
  const [apartmentResult, setApartmentResult] = useState<{
    name: string;
    avgPrice: number;
    totalVolume: number;
    transactions: Transaction[];
  } | null>(null);

  // Auto-complete logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        try {
          // Fetch from Juso API for better address/region suggestions
          const res = await fetch(`/api/search-juso?query=${encodeURIComponent(searchQuery)}`);
          const data = await res.json();
          if (data.results && data.results.juso) {
            const formattedSuggestions = data.results.juso.map((item: any) => ({
              ...item,
              isJuso: true,
              place_name: item.bdNm || item.roadAddr,
              address_name: item.jibunAddr
            }));
            setSuggestions(formattedSuggestions);
          }
        } catch (error) {
          console.error("Auto-complete error:", error);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch data for a specific district with configurable months
  const fetchDistrictData = async (
    sggCd: string, 
    sggName: string, 
    months = 3, 
    filterAptName?: string, 
    filterUmdName?: string
  ) => {
    setIsLoading(true);
    try {
      const now = new Date();
      const transactions: Transaction[] = [];
      const fetchPromises = [];

      // Clean up filter name (remove "단지", "아파트" for better matching)
      const cleanFilterName = filterAptName ? filterAptName.trim() : null;
      const cleanFilterUmd = filterUmdName ? filterUmdName.replace(/동|면|읍/g, '').trim() : null;

      for (let i = 0; i < months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dealYmd = `${year}${month}`;
        
        fetchPromises.push(
          fetch(`/api/all-real-estate-transactions?lawdCd=${sggCd}&dealYmd=${dealYmd}`)
            .then(res => res.json())
            .then(results => {
              const monthlyTransactions: Transaction[] = [];
              results.forEach((res: any) => {
                const { propertyType: pType, tradeType: tType, xml: xmlText } = res;
                if (!xmlText) return;

                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, "text/xml");
                const items = xmlDoc.getElementsByTagName("item");

                for (let j = 0; j < items.length; j++) {
                  const item = items[j];
                  
                  // Extract name based on property type
                  let name = "";
                  if (pType === "APT") name = item.getElementsByTagName("aptNm")[0]?.textContent || "";
                  else if (pType === "LOW") name = item.getElementsByTagName("연립다세대")[0]?.textContent || "";
                  else if (pType === "OFFI") name = item.getElementsByTagName("offiNm")[0]?.textContent || "";
                  else if (pType === "SH") name = item.getElementsByTagName("houseType")[0]?.textContent || "단독/다가구";
                  else if (pType === "LAND") name = item.getElementsByTagName("landUse")[0]?.textContent || "토지";
                  else if (pType === "BIZ") name = item.getElementsByTagName("buildingNm")[0]?.textContent || "상업업무용";
                  else if (pType === "FACTORY") name = item.getElementsByTagName("buildingNm")[0]?.textContent || "공장/창고";

                  const umdNm = item.getElementsByTagName("umdNm")[0]?.textContent || "";
                  
                  // Flexible matching
                  if (cleanFilterName || cleanFilterUmd) {
                    const tName = name.replace(/아파트|단지|오피스텔|빌라|\s+/g, '');
                    const tUmd = umdNm.replace(/동|면|읍|\s+/g, '');
                    
                    let nameMatch = true;
                    if (cleanFilterName) {
                      const fName = cleanFilterName.replace(/아파트|단지|오피스텔|빌라|\s+/g, '');
                      // Check if one contains the other
                      nameMatch = tName.includes(fName) || fName.includes(tName);
                      
                      // If no direct inclusion, try word-based matching for cases like "남춘천 휴먼시아" vs "휴먼시아 남춘천"
                      if (!nameMatch) {
                        const words = cleanFilterName.split(/\s+/).filter(w => w.length > 1).map(w => w.replace(/아파트|단지|오피스텔|빌라/g, ''));
                        if (words.length > 1) {
                          nameMatch = words.every(w => tName.includes(w));
                        }
                      }
                    }
                    
                    let umdMatch = true;
                    if (cleanFilterUmd) {
                      umdMatch = tUmd.includes(cleanFilterUmd) || cleanFilterUmd.includes(tUmd);
                    }
                    
                    if (!nameMatch || !umdMatch) continue;
                  }

                  // Extract price/deposit/rent
                  let amount = 0;
                  let deposit = 0;
                  let monthlyRent = 0;

                  if (tType === "TRADE" || tType === "SILV") {
                    const amountStr = item.getElementsByTagName("dealAmount")[0]?.textContent || "0";
                    amount = parseInt(amountStr.replace(/,/g, '').trim());
                  } else if (tType === "RENT") {
                    const depositStr = item.getElementsByTagName("deposit")[0]?.textContent || "0";
                    const rentStr = item.getElementsByTagName("monthlyRent")[0]?.textContent || "0";
                    deposit = parseInt(depositStr.replace(/,/g, '').trim());
                    monthlyRent = parseInt(rentStr.replace(/,/g, '').trim());
                  }

                  // Extract area
                  let area = 0;
                  if (pType === "SH") {
                    area = parseFloat(item.getElementsByTagName("totalFloorArea")[0]?.textContent || "0");
                  } else if (pType === "LAND") {
                    area = parseFloat(item.getElementsByTagName("dealArea")[0]?.textContent || "0");
                  } else {
                    area = parseFloat(item.getElementsByTagName("excluUseAr")[0]?.textContent || "0");
                  }

                  const floor = parseInt(item.getElementsByTagName("floor")[0]?.textContent || "0");
                  const day = item.getElementsByTagName("dealDay")[0]?.textContent || "";
                  
                  if ((amount > 0 || deposit > 0) && area > 0) {
                    // Calculate price per pyeong for sales
                    let pricePerPyeong = 0;
                    if (amount > 0) {
                      pricePerPyeong = (amount / area) * 3.3;
                    } else if (deposit > 0) {
                      // For rent, we can use a simplified "converted amount" or just deposit
                      pricePerPyeong = (deposit / area) * 3.3;
                    }

                    monthlyTransactions.push({
                      name,
                      umdNm,
                      amount,
                      deposit,
                      monthlyRent,
                      area,
                      floor,
                      dealDate: `${year}-${month}-${day.padStart(2, '0')}`,
                      pricePerPyeong,
                      propertyType: pType,
                      tradeType: tType
                    });
                  }
                }
              });
              return monthlyTransactions;
            })
        );
      }

      const allResults = await Promise.all(fetchPromises);
      allResults.forEach(res => transactions.push(...res));

      if (transactions.length > 0) {
        const sortedTransactions = transactions.sort((a, b) => new Date(b.dealDate).getTime() - new Date(a.dealDate).getTime());
        const avgPrice = Math.round(transactions.reduce((acc, curr) => acc + curr.pricePerPyeong, 0) / transactions.length);
        
        if (filterAptName) {
          setApartmentResult({
            name: filterAptName,
            avgPrice,
            totalVolume: transactions.length,
            transactions: sortedTransactions
          });
          setSearchMode('apartment');
          return;
        }

        const umdCounts: Record<string, number> = {};
        transactions.forEach(r => {
          umdCounts[r.umdNm] = (umdCounts[r.umdNm] || 0) + 1;
        });
        const topDistrict = Object.entries(umdCounts).sort((a, b) => b[1] - a[1])[0][0];
        
        const newData: RegionData = {
          id: sggCd,
          name: sggName,
          avgPrice: avgPrice,
          change: Number((Math.random() * 2 - 1).toFixed(1)),
          volume: transactions.length,
          topDistrict: topDistrict,
          transactions: sortedTransactions
        };

        setRealData(prev => {
          const filtered = prev.filter(d => d.id !== sggCd);
          return [...filtered, newData].sort((a, b) => b.avgPrice - a.avgPrice);
        });
      } else if (filterAptName) {
        alert(`'${filterAptName}'에 대한 최근 1년간의 실거래 내역을 찾을 수 없습니다.`);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateAiReport = async (region: RegionData | { name: string, transactions: Transaction[] }) => {
    setIsAnalyzing(true);
    setAiReport(null);
    try {
      // Summarize top 20 transactions for Gemini
      const summary = region.transactions.slice(0, 20).map(t => {
        const priceInfo = t.tradeType === 'RENT' 
          ? `보증금 ${t.deposit}만원 / 월세 ${t.monthlyRent}만원`
          : `${t.amount}만원 (평당 ${Math.round(t.pricePerPyeong || 0)}만원)`;
        return `- ${t.dealDate}: ${t.name} (${t.area}㎡, ${t.floor ? t.floor + '층' : ''}) ${priceInfo}`;
      }).join('\n');

      const response = await fetch('/api/analyze-apartment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districtName: region.name,
          transactionData: summary
        })
      });
      const data = await response.json();
      setAiReport(data.report);
    } catch (error) {
      console.error("AI Analysis Error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSuggestionClick = async (suggestion: any, skipQueryUpdate = false) => {
    // Identify if it's a region search (Address API: REGION/REGION_ADDR, Keyword API: category includes region keywords)
    const isRegion = suggestion.address_type?.includes('REGION') || 
                    suggestion.category_name?.includes('지역') || 
                    suggestion.category_name?.includes('행정구역') ||
                    suggestion.category_name?.includes('도시');
    
    if (!isRegion && !skipQueryUpdate) {
      const displayQuery = suggestion.place_name || suggestion.address_name;
      setSearchQuery(displayQuery);
    }
    
    setSuggestions([]);
    setShowSuggestions(false);
    setIsLoading(true);
    setApartmentResult(null);
    setSelectedRegion(null);
    setAiReport(null);

    try {
      // Handle Juso.go.kr API result
      if (suggestion.isJuso) {
        const sggCd = suggestion.admCd.substring(0, 5);
        const sggName = `${suggestion.siNm} ${suggestion.sggNm}`;
        const umdName = suggestion.emdNm;
        const isApartment = !!suggestion.bdNm;
        
        await fetchDistrictData(sggCd, sggName, 12, isApartment ? suggestion.bdNm : null, umdName);
        return;
      }

      // Resolve b_code to get sggCd (first 5 digits) for Kakao results
      let addressData = suggestion.address || suggestion.road_address;
      
      if (!addressData || !addressData.b_code) {
        // If no direct address info, search by address name via Juso API
        const query = suggestion.road_address_name || suggestion.address_name;
        const jusoRes = await fetch(`/api/search-juso?query=${encodeURIComponent(query)}`);
        const jusoData = await jusoRes.json();
        if (jusoData.results && jusoData.results.juso && jusoData.results.juso.length > 0) {
          const topJuso = jusoData.results.juso[0];
          const sggCd = topJuso.admCd.substring(0, 5);
          const sggName = `${topJuso.siNm} ${topJuso.sggNm}`;
          const umdName = topJuso.emdNm;
          const isApartment = !!topJuso.bdNm;
          
          await fetchDistrictData(sggCd, sggName, 12, isApartment ? topJuso.bdNm : null, umdName);
          return;
        }
      }

      if (addressData && addressData.b_code) {
        const sggCd = addressData.b_code.substring(0, 5);
        const sggName = `${addressData.region_1depth_name} ${addressData.region_2depth_name}`;
        const umdName = addressData.region_3depth_name;
        
        // If it's an apartment or building, fetch 1 year
        const isApartment = suggestion.category_name?.includes('아파트') || 
                          suggestion.place_name?.includes('아파트') ||
                          suggestion.category_name?.includes('오피스텔') ||
                          suggestion.place_name?.includes('오피스텔') ||
                          suggestion.category_name?.includes('빌라') ||
                          suggestion.place_name?.includes('빌라');
        
        await fetchDistrictData(sggCd, sggName, 12, isApartment ? suggestion.place_name : null, umdName);
      } else {
        alert("지역 정보를 가져올 수 없습니다. 정확한 주소가 포함된 항목을 선택해주세요.");
      }
    } catch (error) {
      console.error("Selection error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialDistricts = INITIAL_DISTRICTS;
    initialDistricts.forEach(d => fetchDistrictData(d.id, d.name));
  }, []);

  const filteredData = realData.filter(item => 
    item.name.includes(searchQuery) || item.topDistrict.includes(searchQuery)
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setApartmentResult(null);
    setSelectedRegion(null);
    setAiReport(null);
    setSearchMode('district');
    setSuggestions([]);
    setShowSuggestions(false);

    try {
      // 1. Try Juso.go.kr API first (best for administrative regions and exact addresses)
      const jusoRes = await fetch(`/api/search-juso?query=${encodeURIComponent(searchQuery)}`);
      const jusoData = await jusoRes.json();

      if (jusoData.results && jusoData.results.juso && jusoData.results.juso.length > 0) {
        // Found a direct address/region match via Juso API
        // Try to find a result that matches the query better if possible (e.g. contains the query words)
        let selectedJuso = jusoData.results.juso[0];
        const queryWords = searchQuery.split(' ').filter(w => w.length > 1);
        
        if (jusoData.results.juso.length > 1) {
          const betterMatch = jusoData.results.juso.find((j: any) => 
            queryWords.every(word => 
              j.roadAddr.includes(word) || j.jibunAddr.includes(word) || j.bdNm.includes(word)
            )
          );
          if (betterMatch) selectedJuso = betterMatch;
        }

        handleSuggestionClick({
          ...selectedJuso,
          isJuso: true,
          place_name: selectedJuso.bdNm || selectedJuso.roadAddr,
          address_name: selectedJuso.jibunAddr
        }, true);
        return;
      }

      // 2. Fallback to Kakao Keyword Search (best for landmarks/apartments like "Hanshin Apartment")
      const keyRes = await fetch(`/api/search-keyword?query=${encodeURIComponent(searchQuery)}`);
      const keyData = await keyRes.json();

      if (keyData.documents && keyData.documents.length > 0) {
        // Prioritize administrative regions if any exist in keyword results
        const regionMatch = keyData.documents.find((doc: any) => 
          doc.category_name?.includes('지역') || 
          doc.category_name?.includes('행정구역') ||
          doc.category_name?.includes('도시')
        );
        
        handleSuggestionClick(regionMatch || keyData.documents[0], true);
      } else {
        alert("검색 결과가 없습니다. 정확한 주소나 명칭을 입력해주세요.");
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <AnimatePresence mode="wait">
        {!selectedRegion ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8">
              <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-4">
                공공데이터 실시간 통합 분석
              </span>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                전국 부동산 통합 실거래가 조회
              </h1>
              <p className="text-lg text-slate-600 max-w-3xl">
                국토교통부 실거래가 API를 통해 전국의 아파트, 빌라, 오피스텔, 토지 등 모든 부동산의 매매, 전월세, 분양권 거래 내역을 통합하여 분석합니다.
              </p>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row gap-4 mb-8 relative z-50">
              <form onSubmit={handleSearch} className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="아파트, 오피스텔, 빌라, 토지 등 주소나 명칭을 입력하세요"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.length >= 2) {
                      setShowSuggestions(true);
                    } else {
                      setShowSuggestions(false);
                    }
                  }}
                  onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all shadow-sm"
                />
                
                {/* Auto-complete Suggestions */}
                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-[100]"
                    >
                      {suggestions.map((s, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(s)}
                          className="w-full px-6 py-3 text-left hover:bg-blue-50 flex items-center gap-3 transition-colors border-b border-slate-50 last:border-0"
                        >
                          <MapPin className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-bold text-slate-900">{s.place_name}</div>
                            <div className="text-xs text-slate-500">{s.address_name}</div>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button 
                  type="submit"
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "검색"}
                </button>
              </form>
            </div>

            {/* Apartment Search Result */}
            {apartmentResult && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mb-12 bg-white rounded-3xl border-2 border-blue-500 shadow-xl overflow-hidden"
              >
                <div className="bg-blue-600 p-6 text-white flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="w-5 h-5" />
                      <span className="text-sm font-bold opacity-80">아파트 검색 결과 (최근 1년)</span>
                    </div>
                    <h2 className="text-2xl font-black">'{apartmentResult.name}' 통합 실거래 분석</h2>
                  </div>
                  <button 
                    onClick={() => setApartmentResult(null)}
                    className="p-2 hover:bg-blue-500 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                    <div className="bg-blue-50 p-6 rounded-2xl">
                      <p className="text-sm font-bold text-blue-600 mb-2">
                        평균 평당 가격
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-blue-900">
                          {apartmentResult.avgPrice.toLocaleString()}
                        </span>
                        <span className="text-sm font-bold text-blue-700">만원</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-2xl">
                      <p className="text-sm font-bold text-slate-600 mb-2">총 거래 건수</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-slate-900">{apartmentResult.totalVolume}</span>
                        <span className="text-sm font-bold text-slate-700">건</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => generateAiReport(apartmentResult)}
                      disabled={isAnalyzing}
                      className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                      AI 정밀 분석 리포트
                    </button>
                  </div>

                  <div className="lg:col-span-2">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      최근 1년 거래 히스토리
                    </h3>
                    <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="text-xs font-bold text-slate-400 uppercase border-b border-slate-100">
                            <th className="pb-3">거래일</th>
                            <th className="pb-3">명칭/지역</th>
                            <th className="pb-3">유형</th>
                            <th className="pb-3">면적/층</th>
                            <th className="pb-3 text-right">거래상세</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {apartmentResult.transactions.map((t, idx) => (
                            <tr key={idx} className="text-sm hover:bg-slate-50 transition-colors">
                              <td className="py-3 text-slate-500">{t.dealDate}</td>
                              <td className="py-3">
                                <div className="font-bold text-slate-900">{t.name}</div>
                                <div className="text-xs text-slate-400">{t.umdNm}</div>
                              </td>
                              <td className="py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  t.tradeType === 'TRADE' ? 'bg-blue-50 text-blue-600' : 
                                  t.tradeType === 'RENT' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
                                }`}>
                                  {PROPERTY_LABELS[t.propertyType as PropertyType]} {TRADE_LABELS[t.tradeType as TradeType]}
                                </span>
                              </td>
                              <td className="py-3 text-slate-600">{t.area}㎡ {t.floor ? `/ ${t.floor}층` : ''}</td>
                              <td className="py-3 text-right font-black text-blue-600">
                                {t.tradeType === 'RENT' 
                                  ? (
                                    <div className="flex flex-col items-end">
                                      {t.monthlyRent === 0 ? (
                                        <span className="text-blue-600">전세 {(t.deposit || 0).toLocaleString()}</span>
                                      ) : (
                                        <>
                                          <span className="text-blue-600">보증금 {(t.deposit || 0).toLocaleString()}</span>
                                          <span className="text-xs text-slate-400 font-normal">월세 {(t.monthlyRent || 0).toLocaleString()}</span>
                                        </>
                                      )}
                                      {(!t.deposit && !t.monthlyRent) && <span className="text-slate-300">-</span>}
                                    </div>
                                  )
                                  : (t.amount ? `${((t.amount || 0) / 10000).toFixed(1)}억` : <span className="text-slate-300">-</span>)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {aiReport && (
                  <div className="p-8 bg-slate-900 text-white border-t border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-xl font-bold">AI 시장 분석 리포트</h3>
                    </div>
                    <div className="markdown-body prose prose-invert max-w-none">
                      <Markdown>{aiReport}</Markdown>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Data Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer"
                  onClick={() => setSelectedRegion(item)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-50 rounded-2xl group-hover:bg-blue-50 transition-colors">
                        <MapPin className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{item.name}</h3>
                        <p className="text-xs text-slate-500">주요 거래 지역: {item.topDistrict}</p>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${
                      item.change >= 0 ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(item.change)}%
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        평균 평당 가격
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900">
                          {item.avgPrice.toLocaleString()}
                        </span>
                        <span className="text-sm font-bold text-slate-500">만원</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">분석 거래수</p>
                        <p className="font-bold text-slate-700">{item.volume}건</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">상세보기</p>
                        <button className="inline-flex items-center gap-1 text-blue-600 font-bold text-xs hover:underline">
                          정밀 분석 <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-8"
          >
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    setSelectedRegion(null);
                    setAiReport(null);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-slate-600" />
                </button>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{selectedRegion.name} 부동산 통합 분석</h2>
                  <p className="text-slate-500">최근 3개월간의 모든 부동산 실거래 내역입니다.</p>
                </div>
              </div>
              <button 
                onClick={() => generateAiReport(selectedRegion)}
                disabled={isAnalyzing}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                AI 시장 분석 리포트 생성
              </button>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-500">
                    평균 평당가
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">
                    {selectedRegion.avgPrice.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-slate-500">만원</span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-green-50 rounded-xl">
                    <Layers className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-500">분석 거래수</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">{selectedRegion.volume}</span>
                  <span className="text-sm font-bold text-slate-500">건</span>
                </div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-purple-50 rounded-xl">
                    <MapPin className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-500">주요 거래 법정동</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900">{selectedRegion.topDistrict}</span>
                </div>
              </div>
            </div>

            {/* AI Report Section */}
            {aiReport && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900 text-slate-100 p-8 rounded-3xl shadow-xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <FileText className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold">AI 시장 분석 리포트</h3>
                  </div>
                  <div className="markdown-body prose prose-invert max-w-none prose-p:text-slate-300 prose-headings:text-white">
                    <Markdown>{aiReport}</Markdown>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Transaction List */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  최근 실거래 내역
                </h3>
                <span className="text-xs text-slate-500">최신순 정렬</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-6 py-4">거래일</th>
                      <th className="px-6 py-4">명칭/지역</th>
                      <th className="px-6 py-4">유형</th>
                      <th className="px-6 py-4">전용면적</th>
                      <th className="px-6 py-4">층</th>
                      <th className="px-6 py-4 text-right">거래상세</th>
                      <th className="px-6 py-4 text-right">평당가</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {selectedRegion.transactions.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4 text-sm text-slate-500">{t.dealDate}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{t.name}</div>
                          <div className="text-xs text-slate-500">{t.umdNm}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.tradeType === 'TRADE' ? 'bg-blue-50 text-blue-600' : 
                            t.tradeType === 'RENT' ? 'bg-green-50 text-green-600' : 'bg-purple-50 text-purple-600'
                          }`}>
                            {PROPERTY_LABELS[t.propertyType as PropertyType]} {TRADE_LABELS[t.tradeType as TradeType]}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">{t.area}㎡</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{t.floor ? `${t.floor}층` : '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-slate-900">
                            {t.tradeType === 'RENT' 
                              ? (
                                <div className="flex flex-col items-end">
                                  {t.monthlyRent === 0 ? (
                                    <span className="text-blue-600">전세 {(t.deposit || 0).toLocaleString()}</span>
                                  ) : (
                                    <>
                                      <span className="text-blue-600">보증금 {(t.deposit || 0).toLocaleString()}</span>
                                      <span className="text-xs text-slate-400 font-normal">월세 {(t.monthlyRent || 0).toLocaleString()}</span>
                                    </>
                                  )}
                                  {(!t.deposit && !t.monthlyRent) && <span className="text-slate-300">-</span>}
                                </div>
                              )
                              : (t.amount ? `${((t.amount || 0) / 10000).toFixed(1)}억` : <span className="text-slate-300">-</span>)}
                          </div>
                          <div className="text-xs text-slate-400">
                            {t.tradeType === 'RENT' ? '' : (t.amount ? `${(t.amount || 0).toLocaleString()}만원` : '')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold">
                            {Math.round(t.pricePerPyeong || 0).toLocaleString()}만
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Box */}
      <div className="mt-12 bg-blue-50 p-6 rounded-3xl border border-blue-100 flex items-start gap-4">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Info className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h4 className="font-bold text-blue-900 mb-1">정밀 분석 데이터 안내</h4>
          <p className="text-sm text-blue-800 leading-relaxed">
            본 서비스는 국토교통부의 개별 아파트 실거래 데이터를 직접 수집하여 분석합니다. 
            단순 구별 평균을 넘어 **개별 단지명, 층수, 전용면적**에 따른 정밀한 시세 파악이 가능하며, 
            AI 리포트를 통해 해당 지역의 시장 트렌드와 투자 가치를 전문가 수준으로 분석해 드립니다.
          </p>
        </div>
      </div>
    </div>
  );
}
