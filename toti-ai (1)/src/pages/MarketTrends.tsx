import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Loader2, 
  MapPin, 
  TrendingUp, 
  BarChart3, 
  ArrowRight, 
  Info,
  Building2,
  Activity,
  Target,
  Calendar,
  Coins,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area
} from 'recharts';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';

interface Transaction {
  name: string;
  dealAmount: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  excluUseAr: string;
  umdNm: string;
  floor: string;
  buildYear: string;
  price: number;
  pyeongPrice: number;
  date: string;
  type: string; // Trade or Rent
}

interface PropertyType {
  id: string;
  label: string;
  apiPath: string;
  apiMethod: string;
  nameField: string;
}

const PROPERTY_TYPES: PropertyType[] = [
  { id: 'AUTO', label: '종합(자동분석)', apiPath: '', apiMethod: '', nameField: '' },
  { id: 'APT_TRADE', label: '아파트 매매', apiPath: 'RTMSDataSvcAptTradeDev', apiMethod: 'getRTMSDataSvcAptTradeDev', nameField: 'aptNm' },
  { id: 'APT_RENT', label: '아파트 전월세', apiPath: 'RTMSDataSvcAptRent', apiMethod: 'getRTMSDataSvcAptRent', nameField: 'aptNm' },
  { id: 'APT_RIGHT', label: '아파트 분양권', apiPath: 'RTMSDataSvcSilvTrade', apiMethod: 'getRTMSDataSvcSilvTrade', nameField: 'aptNm' },
  { id: 'OFFI_TRADE', label: '오피스텔 매매', apiPath: 'RTMSDataSvcOffiTrade', apiMethod: 'getRTMSDataSvcOffiTrade', nameField: 'offiNm' },
  { id: 'OFFI_RENT', label: '오피스텔 전월세', apiPath: 'RTMSDataSvcOffiRent', apiMethod: 'getRTMSDataSvcOffiRent', nameField: 'offiNm' },
  { id: 'RH_TRADE', label: '연립다세대 매매', apiPath: 'RTMSDataSvcRHTrade', apiMethod: 'getRTMSDataSvcRHTrade', nameField: 'mhouseNm' },
  { id: 'RH_RENT', label: '연립다세대 전월세', apiPath: 'RTMSDataSvcRHRent', apiMethod: 'getRTMSDataSvcRHRent', nameField: 'mhouseNm' },
  { id: 'SH_TRADE', label: '단독/다가구 매매', apiPath: 'RTMSDataSvcSHTrade', apiMethod: 'getRTMSDataSvcSHTrade', nameField: '' },
  { id: 'NRG_TRADE', label: '상업업무용 매매', apiPath: 'RTMSDataSvcNrgTrade', apiMethod: 'getRTMSDataSvcNrgTrade', nameField: 'buildingNm' },
  { id: 'LAND_TRADE', label: '토지 매매', apiPath: 'RTMSDataSvcLandTrade', apiMethod: 'getRTMSDataSvcLandTrade', nameField: '' },
  { id: 'INDU_TRADE', label: '공장/창고 매매', apiPath: 'RTMSDataSvcInduTrade', apiMethod: 'getRTMSDataSvcInduTrade', nameField: 'buildingNm' },
];

interface MarketStats {
  averagePrice: number;
  maxPrice: number;
  avgPyeongPrice: number;
  transactionCount: number;
  priceHistory: { month: string; price: number; count: number }[];
  recentTransactions: Transaction[];
  targetAptName: string;
  targetDongName: string;
  isDongLevel: boolean;
  detectedLabel: string;
}

export default function MarketTrends() {
  const [address, setAddress] = useState('');
  const [selectedType, setSelectedType] = useState(PROPERTY_TYPES[0]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<MarketStats | null>(null);
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
    setStats(null);
    setProgress(0);

    try {
      let selectedApi = selectedType;
      
      // 1. Geocode to get b_code and coordinates
      const kakaoRes = await fetch(`/api/kakao-geocoder?address=${encodeURIComponent(searchQuery)}`);
      const kakaoData = await kakaoRes.json();
      
      if (!kakaoData.documents || kakaoData.documents.length === 0) {
        throw new Error('주소를 찾을 수 없습니다.');
      }

      const docData = kakaoData.documents[0];
      const bCode = docData.address?.b_code || docData.road_address?.region_code || "";
      const umdNm = docData.address?.region_3depth_name || docData.road_address?.region_3depth_name || "";
      
      // 1.5 Automatic Type Detection if 'AUTO' is selected
      if (selectedApi.id === 'AUTO') {
        const bName = docData.road_address?.building_name || docData.address?.building_name || "";
        
        // Try to get more info from Keyword Search if it's a specific building
        let category = "";
        try {
          // Try with searchQuery first
          let keywordRes = await fetch(`/api/search-keyword?query=${encodeURIComponent(searchQuery)}`);
          let keywordData = await keywordRes.json();
          
          // If no results, try with building name
          if ((!keywordData.documents || keywordData.documents.length === 0) && bName) {
            keywordRes = await fetch(`/api/search-keyword?query=${encodeURIComponent(bName)}`);
            keywordData = await keywordRes.json();
          }

          if (keywordData.documents && keywordData.documents.length > 0) {
            category = keywordData.documents[0].category_name || "";
          }
        } catch (err) {
          console.error("Keyword search error:", err);
        }

        const fullText = (searchQuery + bName + category).replace(/\s/g, '');
        const isRent = /전세|월세|임대|렌트/.test(fullText);

        // Priority detection
        if (/오피스텔/.test(fullText)) {
          selectedApi = isRent ? PROPERTY_TYPES[5] : PROPERTY_TYPES[4];
        } else if (/빌라|다세대|연립|맨션/.test(fullText)) {
          selectedApi = isRent ? PROPERTY_TYPES[7] : PROPERTY_TYPES[6];
        } else if (/상가|빌딩|근생|업무|상업/.test(fullText)) {
          selectedApi = PROPERTY_TYPES[9];
        } else if (/토지|대지|임야|전|답|과수원/.test(fullText)) {
          selectedApi = PROPERTY_TYPES[10];
        } else if (/공장|창고/.test(fullText)) {
          selectedApi = PROPERTY_TYPES[11];
        } else if (/단독|다가구/.test(fullText)) {
          selectedApi = PROPERTY_TYPES[8];
        } else if (/분양권/.test(fullText)) {
          selectedApi = PROPERTY_TYPES[3];
        } else {
          // Default logic: If it's a known apartment or has no specific keyword, default to Apartment
          selectedApi = isRent ? PROPERTY_TYPES[2] : PROPERTY_TYPES[1];
        }
      }

      // Helper for normalization (Fixes '샾' vs '샵', spaces, etc.)
      const normalize = (str: string) => {
        if (!str) return "";
        return str.replace(/\s/g, '')
                  .replace(/샾/g, '샵')
                  .replace(/아파트|단지|마을|빌라/g, '')
                  .replace(/[()]/g, '')
                  .trim();
      };

      // 1. Try to get building name from Geocoder API first
      let aptKeyword = docData.road_address?.building_name || docData.address?.building_name || "";
      
      // 2. If not found or too short, try to extract from the full search query string
      // Especially handle cases like "... (후평동, 춘천더샾아파트)"
      if (!aptKeyword || aptKeyword.length < 2) {
        const bracketMatch = searchQuery.match(/\(([^)]+)\)/);
        if (bracketMatch) {
          const insideBrackets = bracketMatch[1].split(',').map(s => s.trim());
          // Find the part that's likely an apartment name (not a dong name)
          const potentialApt = insideBrackets.find(s => !s.endsWith('동') && !s.endsWith('리'));
          if (potentialApt) aptKeyword = potentialApt;
        }
      }

      if (!aptKeyword) {
        const addressParts = searchQuery.split(' ').filter(p => p.trim());
        for (let i = addressParts.length - 1; i >= 0; i--) {
          const part = addressParts[i];
          if (part.endsWith('동') || part.endsWith('리') || part.endsWith('가')) continue;
          if (part.includes('아파트') || part.includes('단지') || part.includes('마을') || part.includes('빌라')) {
            aptKeyword = part;
            break;
          }
          if (i === addressParts.length - 1 && isNaN(parseInt(part))) {
            aptKeyword = part;
            break;
          }
        }
      }

      const cleanAptKeyword = normalize(aptKeyword);
      const normalizedUmdNm = umdNm.replace(/동$/, '');

      if (!bCode || bCode.length < 5) {
        throw new Error('법정동 코드를 가져올 수 없습니다.');
      }

      const lawdCd = bCode.substring(0, 5);
      const bjdongCd = bCode.substring(5, 10);

      // 2. Fetch 12 months of data (2025.04 ~ 2026.03)
      const months = [];
      for (let year = 2025; year <= 2026; year++) {
        const startMonth = (year === 2025) ? 4 : 1;
        const endMonth = (year === 2025) ? 12 : 3;
        for (let month = startMonth; month <= endMonth; month++) {
          months.push(`${year}${month.toString().padStart(2, '0')}`);
        }
      }

      let allTransactions: Transaction[] = [];
      
      for (let i = 0; i < months.length; i++) {
        const dealYmd = months[i];
        try {
          const res = await fetch(`/api/molit-generic?apiPath=${selectedApi.apiPath}&apiMethod=${selectedApi.apiMethod}&lawdCd=${lawdCd}&dealYmd=${dealYmd}`);
          const data = await res.json();
          
          const items = data.response?.body?.items?.item;
          if (items) {
            const itemList = Array.isArray(items) ? items : [items];
            const processed = itemList.map((item: any) => {
              // Helper to safely parse price strings or numbers
              const parsePriceVal = (val: any) => {
                if (val === undefined || val === null) return 0;
                return parseInt(String(val).replace(/,/g, "").trim()) || 0;
              };

              // Handle different price fields (dealAmount for trade, deposit/monthlyRent for rent)
              let price = 0;
              let displayAmount = "";
              
              if (selectedApi.id.includes('RENT')) {
                const deposit = parsePriceVal(item.deposit || item.dealAmount || "0");
                const monthly = parsePriceVal(item.monthlyRent || "0");
                price = (deposit * 10000) + (monthly * 10000 * 100); // Simple conversion for stats
                displayAmount = monthly > 0 ? `보 ${item.deposit || item.dealAmount}/${item.monthlyRent}` : `전 ${item.deposit || item.dealAmount}`;
              } else {
                price = parsePriceVal(item.dealAmount || "0") * 10000;
                displayAmount = String(item.dealAmount || "0");
              }

              const area = parseFloat(item.excluUseAr || item.plArea || "1");
              const pyeongPrice = (price / area) * 3.3;
              const name = item[selectedApi.nameField] || item.umdNm || "정보없음";

              return {
                name,
                dealAmount: displayAmount,
                dealYear: item.dealYear,
                dealMonth: item.dealMonth,
                dealDay: item.dealDay,
                excluUseAr: item.excluUseAr || item.plArea || "0",
                umdNm: item.umdNm,
                floor: item.floor || "-",
                buildYear: item.buildYear || "-",
                price,
                pyeongPrice,
                date: `${item.dealYear}.${item.dealMonth.toString().padStart(2, '0')}.${item.dealDay.toString().padStart(2, '0')}`,
                type: selectedApi.id.includes('RENT') ? '임대' : '매매'
              };
            });
            allTransactions = [...allTransactions, ...processed];
          }
        } catch (err) {
          console.error(`Error fetching data for ${dealYmd}:`, err);
        }
        setProgress(Math.round(((i + 1) / months.length) * 100));
      }

      if (allTransactions.length === 0) {
        throw new Error('해당 지역의 거래 데이터가 없습니다.');
      }

      // 3. Filtering
      // First try: specific apartment in the dong
      // Use a more robust check for apartment name
      let filtered = allTransactions.filter(t => {
        const tUmdNm = t.umdNm.trim().replace(/동$/, '');
        const tAptNm = t.name.replace(/\s/g, '').replace(/샾/g, '샵');
        
        const dongMatch = tUmdNm === normalizedUmdNm;
        const aptMatch = cleanAptKeyword ? tAptNm.includes(cleanAptKeyword) : true;
        return dongMatch && aptMatch;
      });

      let isDongLevel = false;
      if (filtered.length === 0 && cleanAptKeyword) {
        // Fallback: all apartments in the dong
        filtered = allTransactions.filter(t => 
          t.umdNm.trim().replace(/동$/, '') === normalizedUmdNm
        );
        isDongLevel = true;
      }

      if (filtered.length === 0) {
        // Final fallback: all transactions in the district (sigungu)
        filtered = allTransactions;
        isDongLevel = true;
      }

      // 4. Calculate Stats
      const totalTransactions = filtered.length;
      const totalPrice = filtered.reduce((sum, t) => sum + t.price, 0);
      const averagePrice = totalPrice / totalTransactions;
      const maxPrice = Math.max(...filtered.map(t => t.price));
      const avgPyeongPrice = filtered.reduce((sum, t) => sum + t.pyeongPrice, 0) / totalTransactions;

      // Group for chart
      const historyMap: { [key: string]: { sum: number; count: number } } = {};
      months.forEach(m => {
        historyMap[m] = { sum: 0, count: 0 };
      });

      filtered.forEach(t => {
        const key = `${t.dealYear}${t.dealMonth.toString().padStart(2, '0')}`;
        if (historyMap[key]) {
          historyMap[key].sum += t.price;
          historyMap[key].count += 1;
        }
      });

      const priceHistory = months.map(m => {
        const data = historyMap[m];
        return {
          month: `${m.substring(2, 4)}.${m.substring(4, 6)}`,
          price: data.count > 0 ? Math.round(data.sum / data.count) : 0,
          count: data.count
        };
      });

      // Sort recent transactions
      const recentTransactions = [...filtered].sort((a, b) => {
        const dateA = `${a.dealYear}${a.dealMonth.toString().padStart(2, '0')}${a.dealDay.toString().padStart(2, '0')}`;
        const dateB = `${b.dealYear}${b.dealMonth.toString().padStart(2, '0')}${b.dealDay.toString().padStart(2, '0')}`;
        return dateB.localeCompare(dateA);
      }).slice(0, 50);

      setStats({
        averagePrice,
        maxPrice,
        avgPyeongPrice,
        transactionCount: totalTransactions,
        priceHistory,
        recentTransactions,
        targetAptName: cleanAptKeyword || '전체',
        targetDongName: umdNm,
        isDongLevel,
        detectedLabel: selectedApi.label
      });

      // Deduct credits
      const user = auth.currentUser;
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const userData = userSnap.data();
        const isAdmin = userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com';
        
        if (!isAdmin) {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, { credits: increment(-10) });
          await addDoc(collection(db, 'creditHistory'), {
            uid: user.uid,
            type: 'usage',
            amount: -10,
            description: `실거래가 정밀 분석 (${searchQuery})`,
            timestamp: serverTimestamp()
          });
        }
      }

    } catch (err: any) {
      setError(err.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const formatPrice = (price: number) => {
    const eok = Math.floor(price / 100000000);
    const man = Math.floor((price % 100000000) / 10000);
    
    if (eok > 0) {
      return `${eok}억 ${man > 0 ? man.toLocaleString() + '만' : ''}원`;
    }
    return `${man.toLocaleString()}만원`;
  };

  return (
    <div className="min-h-screen bg-slate-50 pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-10">
          <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-4">
            수익성 분석 ②
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">시장 동향 및 가격 분석</h1>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-lg text-slate-600 max-w-3xl">
              국토교통부 실거래가 API를 통한 최근 1년 정밀 시세 분석 및 시장 동향 리포트입니다.
            </p>
            {stats && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-full shadow-lg shadow-blue-200"
              >
                분석 유형: {stats.detectedLabel}
              </motion.span>
            )}
          </div>
        </div>

        {/* Property Type Selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {PROPERTY_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                selectedType.id === type.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:bg-blue-50'
              }`}
            >
              {type.label}
            </button>
          ))}
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
                placeholder="아파트명 또는 주소를 입력하세요 (예: 후평동 한신)"
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
              disabled={isSearching || !address.trim()}
              className="px-10 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2 text-lg whitespace-nowrap"
            >
              {isSearching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Activity className="w-6 h-6" />}
              실거래가 조회
            </button>
          </form>
          
          {isSearching && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>데이터 수집 중...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-blue-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {stats && (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-500">최근 1년 평균 {selectedType.id.includes('RENT') ? '보증금' : '가'}</span>
                </div>
                <div className="text-2xl font-black text-slate-900">{formatPrice(stats.averagePrice)}</div>
                <div className="mt-2 text-xs text-slate-400">
                  {stats.isDongLevel ? `${stats.targetDongName} 전체 기준` : `${stats.targetAptName} 기준`}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                    <ArrowUpRight className="w-6 h-6 text-amber-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-500">최근 1년 최고 {selectedType.id.includes('RENT') ? '보증금' : '가'}</span>
                </div>
                <div className="text-2xl font-black text-slate-900">{formatPrice(stats.maxPrice)}</div>
                <div className="mt-2 text-xs text-slate-400">실거래 신고가 기준</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                    <Coins className="w-6 h-6 text-emerald-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-500">평당 단가 (3.3㎡)</span>
                </div>
                <div className="text-2xl font-black text-slate-900">{formatPrice(stats.avgPyeongPrice)}</div>
                <div className="mt-2 text-xs text-slate-400">전용면적 대비 평균</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-purple-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-500">최근 1년 거래 건수</span>
                </div>
                <div className="text-2xl font-black text-slate-900">{stats.transactionCount}건</div>
                <div className="mt-2 text-xs text-slate-400">2025.04 ~ 2026.03</div>
              </motion.div>
            </div>

            {/* Chart Section */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">최근 1년 시세 추이</h3>
                    <p className="text-sm text-slate-500">월별 평균 거래가 변동 현황</p>
                  </div>
                </div>
                {stats.isDongLevel && (
                  <div className="px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-xs font-bold flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    특정 아파트 거래 없음: {stats.targetDongName} 전체 데이터 표시 중
                  </div>
                )}
              </div>
              
              {/* Fixed height container for chart */}
              <div className="w-full" style={{ height: '400px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.priceHistory}>
                    <defs>
                      <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="month" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 12 }} 
                      tickFormatter={(val) => `${(val / 100000000).toFixed(1)}억`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [formatPrice(val), "평균 거래가"]}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="price" 
                      stroke="#3b82f6" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorPrice)" 
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* List Section */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-slate-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">최근 실거래 내역 (50건)</h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-8 py-4 text-sm font-bold text-slate-500">거래일</th>
                      <th className="px-8 py-4 text-sm font-bold text-slate-500">명칭</th>
                      <th className="px-8 py-4 text-sm font-bold text-slate-500">면적</th>
                      <th className="px-8 py-4 text-sm font-bold text-slate-500">층</th>
                      <th className="px-8 py-4 text-sm font-bold text-slate-500">금액</th>
                      <th className="px-8 py-4 text-sm font-bold text-slate-500">평당가</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.recentTransactions.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5 text-sm text-slate-600 font-medium">{t.date}</td>
                        <td className="px-8 py-5 text-sm font-bold text-slate-900">{t.name}</td>
                        <td className="px-8 py-5 text-sm text-slate-600">{t.excluUseAr}㎡</td>
                        <td className="px-8 py-5 text-sm text-slate-600">{t.floor}층</td>
                        <td className="px-8 py-5 text-sm font-black text-blue-600">{t.dealAmount}</td>
                        <td className="px-8 py-5 text-sm text-slate-500">{formatPrice(t.pyeongPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
