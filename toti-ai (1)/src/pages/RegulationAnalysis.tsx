import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  FileText, 
  Loader2, 
  AlertCircle, 
  Info, 
  Cpu, 
  CheckCircle2, 
  Scale, 
  Calculator,
  ArrowRight,
  ShieldCheck,
  Map as MapIcon,
  Satellite,
  TrendingUp,
  Compass,
  Route,
  XCircle,
  FileOutput
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as turf from '@turf/turf';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

declare global {
  interface Window {
    kakao: any;
  }
}

interface RegulationData {
  address: string;
  pnu: string;
  zoning: string;
  districts: string[];
  restrictions: string[];
  officialPrice: string;
  area: string;
  landUsePlan: string;
  landUseReg: string;
  buildingReg: string;
  coverageRatio: string; // 건폐율
  floorAreaRatio: string; // 용적률
  farmlandCharge: string;
  x: string;
  y: string;
}

import { useAnalysis } from '../context/AnalysisContext';

export default function RegulationAnalysis() {
  const { regulationData: liftedData, setRegulationData: setLiftedData } = useAnalysis();
  const [address, setAddress] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const [regulationData, setRegulationData] = useState<RegulationData | null>(liftedData?.data || null);
  const [aiInsight, setAiInsight] = useState(liftedData?.insight || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mapMode, setMapMode] = useState<'map' | 'satellite'>('satellite');
  const searchRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (regulationData || aiInsight) {
      setLiftedData({
        data: regulationData,
        insight: aiInsight
      });
    }
  }, [regulationData, aiInsight]);

  useEffect(() => {
    if (regulationData && mapContainerRef.current && window.kakao && window.kakao.maps) {
      const { x, y } = regulationData;
      const position = new window.kakao.maps.LatLng(y, x);
      
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

      if (mapMode === 'satellite') {
        mapInstanceRef.current.setMapTypeId(window.kakao.maps.MapTypeId.HYBRID);
      } else {
        mapInstanceRef.current.setMapTypeId(window.kakao.maps.MapTypeId.ROADMAP);
      }
      
      mapInstanceRef.current.relayout();
    }
  }, [regulationData, mapMode]);

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
    setRegulationData(null);
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
    setRegulationData(null);
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
          pnu = item.pnu || item.address?.parcel?.pnu || item.point?.pnu || "";
        }
      } catch (err) {
        console.error("VWorld Geocoder fallback failed:", err);
      }
    }

    if (!pnu && juso && juso.bdMgtSn && juso.bdMgtSn.length >= 19) {
      pnu = juso.bdMgtSn.substring(0, 19);
    }

    // Debug log for PNU
    console.log("Initial PNU extracted:", pnu);

    if (!x || !y) {
      throw new Error('주소를 찾을 수 없습니다. 정확한 주소를 입력해주세요.');
    }

    // 1. Ensure PNU is obtained first and is 19 digits
    let finalPnu = pnu;
    if (!finalPnu || finalPnu.length < 19) {
      try {
        const addrRes = await fetch(`/api/vworld-address?query=${encodeURIComponent(juso ? juso.roadAddr : searchQuery)}`);
        const addrData = await addrRes.json();
        if (addrData.response?.status === 'OK' && addrData.response?.result?.items?.length > 0) {
          const item = addrData.response.result.items[0];
          // Try multiple paths for PNU in Vworld response
          finalPnu = item.pnu || 
                     item.address?.parcel?.pnu || 
                     (item.id && item.id.length >= 19 ? item.id : null) || 
                     finalPnu;
        }
      } catch (err) {
        console.error("Vworld Address Search failed:", err);
      }
    }

    // Final PNU validation/cleanup
    if (finalPnu) {
      finalPnu = finalPnu.replace(/[^0-9]/g, '').substring(0, 19);
    }

    console.log("Final PNU for data fetching:", finalPnu);
    await processGeocodeResult(x, y, finalPnu, juso ? juso.roadAddr : searchQuery);
  };

  const processGeocodeResult = async (x: string, y: string, pnu: string, displayAddress: string) => {
    try {
      let zoning = "확인 불가";
      let districts: string[] = [];
      let restrictions: string[] = [];
      let officialPrice = "0";
      let area = "0";
      let coverageRatio = "지자체 조례 확인 필요";
      let floorAreaRatio = "지자체 조례 확인 필요";
      let landUsePlan = "";
      let landUseReg = "";
      let buildingReg = "";

      // 1. Fetch data from MOLIT (Primary) and VWorld (Backup)
      console.log(`Fetching regulation data for PNU: ${pnu}, Coord: ${x}, ${y}`);
      try {
        // 1.1 Fetch Building Data (MOLIT Primary - getBrTitleInfo)
        let molitBuildingSuccess = false;
        if (pnu && pnu.length >= 19) {
          try {
            const res = await fetch(`/api/molit-building-reg?pnu=${pnu}`);
            if (res.ok) {
              const data = await res.json();
              const totalCount = Number(data?.response?.body?.totalCount || 0);
              const items = data?.response?.body?.items?.item;
              const item = Array.isArray(items) ? items[0] : items;
              
              if (totalCount > 0 && item) {
                area = item.platArea || area;
                if (item.bcRat && item.bcRat !== "0") coverageRatio = `${item.bcRat}%`;
                if (item.vlRat && item.vlRat !== "0") floorAreaRatio = `${item.vlRat}%`;
                buildingReg = `건폐율: ${item.bcRat || '0'}%, 용적률: ${item.vlRat || '0'}%, 구조: ${item.strctCdNm || '정보 없음'}, 용도: ${item.mainPurpsCdNm || '정보 없음'}`;
                molitBuildingSuccess = true;
              }
            }
          } catch (e) {
            console.error("MOLIT Building Reg Hub fetch failed:", e);
          }
        }

        // 1.2 Fetch Land Use Data (MOLIT Primary - getBrJijiguInfo)
        let molitLandUseSuccess = false;
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
                  const etc = item.etcJijigu;
                  
                  if (name) {
                    if (name.endsWith('지역')) {
                      if (!zoningList.includes(name)) zoningList.push(name);
                    } else {
                      if (!districts.includes(name)) districts.push(name);
                    }
                  }
                  
                  if (etc && etc !== "정보 없음") {
                    if (!restrictions.includes(etc)) restrictions.push(etc);
                  }
                });

                // Refine Zoning: Prioritize specific names over broad ones
                if (zoningList.length > 0) {
                  const broadCategories = ['도시지역', '관리지역', '농림지역', '자연환경보전지역'];
                  const specificZoning = zoningList.find(z => !broadCategories.includes(z));
                  zoning = specificZoning || zoningList[0];
                }

                // Filter out zoning from districts and restrictions to avoid duplication
                if (zoning) {
                  districts = districts.filter(d => d !== zoning);
                  restrictions = restrictions.filter(r => r !== zoning);
                }

                molitLandUseSuccess = true;
              }
            }
          } catch (e) {
            console.error("MOLIT Land Use Reg Hub fetch failed:", e);
          }
        }

        // 2. Fallback to VWorld if MOLIT failed or returned no data (totalCount 0)
        
        // 2.1 VWorld Area & Official Price Fallback
        if (pnu && pnu.length >= 19) {
          try {
            // Try LP_PA_CBND_BUBUN first
            const res = await fetch(`/api/vworld-data?data=LP_PA_CBND_BUBUN&attrFilter=pnu:=:${pnu}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.response?.status === 'OK' && data.response?.result?.featureCollection?.features) {
                data.response.result.featureCollection.features.forEach((f: any) => {
                  const props = f.properties;
                  if (!molitBuildingSuccess) {
                    area = props.parea || props.lndpcl_ar || props.area || area;
                  }
                  // Extract official price (jiga)
                  if (props.jiga && props.jiga !== "0") {
                    officialPrice = props.jiga;
                  }
                });
              } else if (!molitBuildingSuccess) {
                // If no result and MOLIT failed, try LT_C_BLDGINFO for area
                const resBld = await fetch(`/api/vworld-data?data=LT_C_BLDGINFO&geomFilter=POINT(${x} ${y})&buffer=0.0001`);
                if (resBld.ok) {
                  const dataBld = await resBld.json();
                  if (dataBld?.response?.status === 'OK' && dataBld.response?.result?.featureCollection?.features) {
                    dataBld.response.result.featureCollection.features.forEach((f: any) => {
                      const props = f.properties;
                      area = props.platarea || props.parea || area;
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error("VWorld Area/Price fallback failed:", e);
          }
        }

        // 2.2 VWorld Building Info Fallback (Current Status)
        if (!molitBuildingSuccess) {
          try {
            const res = await fetch(`/api/vworld-data?data=LT_C_BLDGINFO&geomFilter=POINT(${x} ${y})&buffer=0.0001`);
            if (res.ok) {
              const data = await res.json();
              if (data?.response?.status === 'OK' && data.response?.result?.featureCollection?.features) {
                data.response.result.featureCollection.features.forEach((f: any) => {
                  const props = f.properties;
                  const bc = props.bc_rat || props.bcrat || props.bc_ratio || props.bc_rate || props.bcRat;
                  const vl = props.vl_rat || props.vlrat || props.vl_ratio || props.vl_rate || props.vlRat;
                  if (bc && bc !== "0") coverageRatio = `${bc}% (현황)`;
                  if (vl && vl !== "0") floorAreaRatio = `${vl}% (현황)`;
                  buildingReg = `건폐율: ${bc || '0'}%, 용적률: ${vl || '0'}%, 구조: ${props.strct_cd_nm || '정보 없음'}, 용도: ${props.main_purps_cd_nm || '정보 없음'}`;
                });
              }
            }
          } catch (e) {
            console.error("VWorld Building Info fallback failed:", e);
          }
        }

        // 2.3 VWorld Land Use Fallback
        if (!molitLandUseSuccess && pnu && pnu.length >= 19) {
          try {
            const res = await fetch(`/api/vworld-land-use-attr?pnu=${pnu}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.landUseAttrs?.field) {
                const items = Array.isArray(data.landUseAttrs.field) ? data.landUseAttrs.field : [data.landUseAttrs.field];
                const zoningList: string[] = [];
                items.forEach((item: any) => {
                  const name = item.prposAreaDstrcCodeNm;
                  if (!name) return;

                  if (name.endsWith('지역')) {
                    if (!zoningList.includes(name)) zoningList.push(name);
                  } else if (name.endsWith('지구')) {
                    if (!districts.includes(name)) districts.push(name);
                  } else {
                    if (!restrictions.includes(name)) restrictions.push(name);
                  }

                  // Extract official price (pnilp) as fallback if jiga not found
                  if ((!officialPrice || officialPrice === "0") && item.pnilp && item.pnilp !== "0") {
                    officialPrice = item.pnilp;
                  }
                });

                // Refine Zoning: Prioritize specific names over broad ones
                if (zoningList.length > 0) {
                  const broadCategories = ['도시지역', '관리지역', '농림지역', '자연환경보전지역'];
                  const specificZoning = zoningList.find(z => !broadCategories.includes(z));
                  zoning = specificZoning || zoningList[0];
                }

                // Filter out zoning from districts and restrictions to avoid duplication
                if (zoning) {
                  districts = districts.filter(d => d !== zoning);
                  restrictions = restrictions.filter(r => r !== zoning);
                }
              }
            }
          } catch (e) {
            console.error("VWorld Land Use fallback failed:", e);
          }
        }

        // Prepare data for AI
        landUsePlan = `용도지역: ${zoning || '정보 없음'}, 용도지구: ${districts.join(', ') || '해당사항 없음'}`;
        landUseReg = `기타 제한구역: ${restrictions.join(', ') || '해당사항 없음'}`;

        const areaNum = parseFloat(area);
        const priceNum = parseFloat(officialPrice.replace(/,/g, ''));
        const pyeongVal = !isNaN(areaNum) ? (areaNum / 3.3058).toFixed(1) : "0";

        // Farmland Preservation Charge Calculation: min(officialPrice * 0.3, 50000) * area
        let farmlandCharge = 0;
        if (!isNaN(priceNum) && !isNaN(areaNum)) {
          farmlandCharge = Math.min(priceNum * 0.3, 50000) * areaNum;
        }

        setRegulationData({
          address: displayAddress,
          pnu: pnu || "PNU 정보 없음",
          zoning: zoning || "정보 없음",
          districts: districts.length > 0 ? districts : ["해당사항 없음"],
          restrictions: restrictions.length > 0 ? restrictions : ["해당사항 없음"],
          officialPrice: !isNaN(priceNum) && priceNum !== 0 ? `${priceNum.toLocaleString()}원/㎡` : "정보 없음",
          area: area !== "0" ? `${area}㎡` : "정보 없음",
          landUsePlan,
          landUseReg,
          buildingReg,
          coverageRatio: coverageRatio === "지자체 조례 확인 필요" ? "정보 없음" : coverageRatio,
          floorAreaRatio: floorAreaRatio === "지자체 조례 확인 필요" ? "정보 없음" : floorAreaRatio,
          farmlandCharge: farmlandCharge > 0 ? `${Math.round(farmlandCharge).toLocaleString()}원` : "대상 아님/정보 없음",
          x,
          y
        });
      } catch (err) {
        console.error("Data fetch failed:", err);
      } finally {
        setIsSearching(false);
      }
    } catch (err: any) {
      setError('규제 정보를 가져오는데 실패했습니다: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const generateAiInsight = async () => {
    if (!regulationData) return;
    
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
      const response = await fetch('/api/analyze-regulation-comprehensive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: regulationData.address,
          pnu: regulationData.pnu,
          landUsePlan: regulationData.landUsePlan,
          landUseReg: regulationData.landUseReg,
          buildingReg: regulationData.buildingReg,
          officialPrice: regulationData.officialPrice,
          area: regulationData.area
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '분석 중 오류가 발생했습니다.');
      }

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
          description: `규제 및 인허가 리포트 (${regulationData.address})`,
          timestamp: serverTimestamp()
        });
      } catch (error) {
        console.error("Failed to record credit history:", error);
      }

      setAiInsight(data.report);
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
            AI 토지진단 ②
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">규제 및 인허가 리포트</h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            용도지역, 건폐율/용적률, 행정 규제를 분석하고 예상 인허가 항목 및 비용에 대한 AI 전문가 리포트를 제공합니다.
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
                placeholder="분석할 주소를 입력하세요 (예: 서울특별시 강남구 역삼동 825-1)"
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
              className="px-10 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:bg-slate-300 flex items-center justify-center gap-2 text-lg whitespace-nowrap focus:outline-none"
            >
              {isSearching ? <Loader2 className="w-6 h-6 animate-spin" /> : <Search className="w-6 h-6" />}
              규제 분석 시작
            </button>
          </form>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {regulationData && (
          <div className="space-y-8">
            {/* ① 지적 및 위성 분석 (Map Section) */}
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <MapIcon className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">① 지적 및 위성 분석</h2>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden flex flex-col h-[300px] relative">
                  <div className="absolute top-4 right-4 z-10 flex bg-white/90 backdrop-blur p-1 rounded-lg shadow-lg border border-slate-200">
                    <button 
                      onClick={() => setMapMode('map')}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${mapMode === 'map' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      지도
                    </button>
                    <button 
                      onClick={() => setMapMode('satellite')}
                      className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${mapMode === 'satellite' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      위성
                    </button>
                  </div>
                  <div ref={mapContainerRef} className="flex-1" />
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Data Sections */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 flex-1"
                >
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Scale className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">규제 및 인허가 데이터</h3>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">대상지 정보</div>
                      <div className="font-bold text-slate-900 text-lg leading-tight mb-1">{regulationData.address}</div>
                      <div className="text-[10px] font-mono text-blue-500 mb-1 bg-blue-50 px-2 py-0.5 rounded inline-block">PNU: {regulationData.pnu}</div>
                      <div className="text-sm text-slate-400">면적: {regulationData.area} (약 {!isNaN(parseFloat(regulationData.area)) ? (parseFloat(regulationData.area) / 3.3058).toFixed(1) : "0"}평)</div>
                    </div>

                    <div className="p-5 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">② 용도지역</div>
                      <div className="text-2xl font-black text-slate-900">{regulationData.zoning}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">③ 건폐율</div>
                        <div className="text-lg font-black text-slate-900">{regulationData.coverageRatio}</div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">③ 용적률</div>
                        <div className="text-lg font-black text-slate-900">{regulationData.floorAreaRatio}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">④ 행정규제 및 기타 제한</div>
                        <div className="px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold leading-relaxed">
                          {[...regulationData.districts, ...regulationData.restrictions].filter(x => x !== "해당사항 없음").length > 0 
                            ? [...regulationData.districts, ...regulationData.restrictions].filter(x => x !== "해당사항 없음").join(', ') 
                            : "해당사항 없음"}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <div className="bg-slate-900 rounded-2xl p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <Calculator className="w-5 h-5 text-blue-400" />
                    <span className="font-bold">⑤ 예상 인허가 비용 (AI 추산)</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">공시지가</span>
                      <span className="font-bold">
                        {regulationData.officialPrice}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 text-sm">농지보전부담금</span>
                      <span className="text-blue-400 font-bold">{regulationData.farmlandCharge}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-2">
                      * 실제 비용은 전용 면적 및 지목에 따라 상이하며, AI 리포트에서 상세 내역을 확인하실 수 있습니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Report */}
              <div className="lg:col-span-8 h-full">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-200 h-full flex flex-col relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                    <ShieldCheck className="w-64 h-64 text-blue-600" />
                  </div>
                  
                  <div className="relative z-10 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-900 tracking-tight">규제 및 인허가 리포트</h3>
                          <p className="text-sm text-slate-500 font-medium">AI 전문가 정밀 진단 결과</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {aiInsight && !aiInsight.includes("⚠️") && (
                          <button 
                            type="button"
                            onMouseDown={(e) => e.currentTarget.blur()}
                            className="p-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors focus:outline-none"
                          >
                            <FileOutput className="w-5 h-5" />
                          </button>
                        )}
                        {(!aiInsight || aiInsight.includes("⚠️")) && (
                          <button
                            type="button"
                            onClick={generateAiInsight}
                            onMouseDown={(e) => e.currentTarget.blur()}
                            disabled={isAnalyzing}
                            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-100 focus:outline-none"
                          >
                            {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                            {aiInsight ? "다시 생성" : "리포트 생성"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      {isAnalyzing ? (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
                          <Loader2 className="w-16 h-16 animate-spin mb-6 text-blue-600" />
                          <p className="text-xl font-black text-slate-900 mb-2">행정 규제 및 인허가 타당성 분석 중...</p>
                          <p className="text-slate-500">건폐율, 용적률 및 예상 비용을 산출하고 있습니다.</p>
                        </div>
                      ) : aiInsight ? (
                        <div className="prose prose-slate max-w-none 
                          prose-headings:text-slate-900 prose-headings:font-black prose-headings:tracking-tight
                          prose-p:text-slate-600 prose-p:leading-relaxed prose-p:mb-6
                          prose-strong:text-blue-600 prose-strong:font-bold
                          prose-ul:list-disc prose-ul:ml-6 prose-li:text-slate-600
                          prose-hr:border-slate-100 prose-hr:my-10
                          prose-blockquote:border-l-4 prose-blockquote:border-blue-600 prose-blockquote:bg-blue-50 prose-blockquote:p-6 prose-blockquote:rounded-r-2xl">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiInsight}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400 border-4 border-dashed border-slate-50 rounded-[2rem]">
                          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                            <Cpu className="w-10 h-10 opacity-20" />
                          </div>
                          <p className="text-xl font-bold text-slate-900 mb-2">분석 리포트 생성 버튼을 눌러주세요.</p>
                          <p className="text-slate-500">토지이용계획 데이터를 기반으로 AI 인허가 리포트를 생성합니다.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
