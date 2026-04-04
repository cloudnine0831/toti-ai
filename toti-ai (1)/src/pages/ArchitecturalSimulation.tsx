import React, { useState, useEffect, useRef, Suspense } from 'react';
import { motion } from 'motion/react';
import { Search, Building, Box, Download, Loader2, MapPin, Info, TrendingUp, Ruler, Car, Sun, Layout } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid, Center, Text, Environment, ContactShadows } from '@react-three/drei';
import { GoogleGenAI } from "@google/genai";

// API Keys from user request
const KAKAO_KEY = "9329d8ba834be83ee3ce224c1d44d8ed";
const GEMINI_KEY = "AIzaSyCLJ9Zny_lCtBIlPHiqmV65lDzKZWofLxs";

interface AddressResult {
  address_name: string;
  b_code: string;
  x: string;
  y: string;
  address?: {
    main_address_no: string;
    sub_address_no: string;
    mountain_yn: string;
  };
  road_address?: {
    building_name: string;
    zone_no: string;
  };
  type?: string;
  raw_address?: string;
}

interface SimulationResult {
  maxFloorArea: number;
  maxTotalFloorArea: number;
  floors: number;
  parkingSpaces: number;
  dimensions: {
    width: number;
    depth: number;
    height: number;
  };
  usageZone: string;
  coverageRatio: number;
  floorAreaRatio: number;
  landArea: number;
}

function BuildingMass({ dimensions }: { dimensions: SimulationResult['dimensions'] }) {
  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      
      {/* Building Mass */}
      <mesh position={[0, dimensions.height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial color="#3b82f6" opacity={0.8} transparent />
      </mesh>
      
      {/* Wireframe for better visibility */}
      <mesh position={[0, dimensions.height / 2, 0]}>
        <boxGeometry args={[dimensions.width + 0.1, dimensions.height + 0.1, dimensions.depth + 0.1]} />
        <meshBasicMaterial color="#1d4ed8" wireframe />
      </mesh>
    </group>
  );
}

export default function ArchitecturalSimulation() {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<AddressResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search for Kakao Local API
  useEffect(() => {
    const fetchAddresses = async () => {
      if (searchQuery.length < 2) {
        setSuggestions([]);
        setSearchError(null);
        return;
      }
      try {
        // Use Juso.go.kr API for better address/region search
        const jusoRes = await fetch(`/api/search-juso?query=${encodeURIComponent(searchQuery)}`);
        const jusoData = await jusoRes.json();

        if (jusoData.results && jusoData.results.juso) {
          const suggestions = jusoData.results.juso.map((item: any) => ({
            ...item,
            isJuso: true,
            address_name: item.roadAddr,
            place_name: item.bdNm || item.roadAddr,
            b_code: item.admCd.substring(0, 5)
          }));
          setSuggestions(suggestions.slice(0, 8));
        }
        setSearchError(null);
      } catch (error) {
        console.error('Failed to fetch addresses:', error);
        setSearchError('네트워크 오류가 발생했습니다.');
      }
    };

    const timeoutId = setTimeout(fetchAddresses, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = async (addr: any) => {
    setSearchQuery(addr.address_name);
    setShowSuggestions(false);
    
    if (addr.isJuso) {
      setIsFetchingData(true);
      try {
        // Fetch coordinates for Juso result
        const coordRes = await fetch(`/api/search-juso-coord?admCd=${addr.admCd}&rnMgtSn=${addr.rnMgtSn}&udrtYn=${addr.udrtYn}&buldMnnm=${addr.buldMnnm}&buldSlno=${addr.buldSlno}`);
        const coordData = await coordRes.json();
        
        if (coordData.results && coordData.results.juso && coordData.results.juso.length > 0) {
          const coord = coordData.results.juso[0];
          setSelectedAddress({
            address_name: addr.address_name,
            b_code: addr.b_code,
            x: coord.entX,
            y: coord.entY,
            address: {
              main_address_no: addr.lnbrMnnm,
              sub_address_no: addr.lnbrSlno,
              mountain_yn: addr.mtYn === '1' ? 'Y' : 'N'
            },
            road_address: {
              building_name: addr.bdNm,
              zone_no: addr.zipNo
            }
          });
        }
      } catch (e) {
        console.error('Failed to fetch Juso coordinates:', e);
      } finally {
        setIsFetchingData(false);
      }
    } else if (addr.type === 'keyword') {
      setIsFetchingData(true);
      try {
        // Use Juso API to get full address details for keyword results
        const jusoRes = await fetch(`/api/search-juso?query=${encodeURIComponent(addr.raw_address)}`);
        const jusoData = await jusoRes.json();
        if (jusoData.results && jusoData.results.juso && jusoData.results.juso.length > 0) {
          const topJuso = jusoData.results.juso[0];
          // Fetch coordinates for this Juso result
          const coordRes = await fetch(`/api/search-juso-coord?admCd=${topJuso.admCd}&rnMgtSn=${topJuso.rnMgtSn}&udrtYn=${topJuso.udrtYn}&buldMnnm=${topJuso.buldMnnm}&buldSlno=${topJuso.buldSlno}`);
          const coordData = await coordRes.json();
          
          if (coordData.results && coordData.results.juso && coordData.results.juso.length > 0) {
            const coord = coordData.results.juso[0];
            setSelectedAddress({
              address_name: addr.address_name,
              b_code: topJuso.admCd.substring(0, 5),
              x: coord.entX,
              y: coord.entY,
              address: {
                main_address_no: topJuso.lnbrMnnm,
                sub_address_no: topJuso.lnbrSlno,
                mountain_yn: topJuso.mtYn === '1' ? 'Y' : 'N'
              },
              road_address: {
                building_name: topJuso.bdNm,
                zone_no: topJuso.zipNo
              }
            });
          }
        } else {
          setSelectedAddress(addr);
        }
      } catch (e) {
        setSelectedAddress(addr);
      } finally {
        setIsFetchingData(false);
      }
    } else {
      setSelectedAddress(addr);
    }
  };

  const getPNU = (addr: AddressResult) => {
    if (!addr.address) return null;
    const bCode = addr.b_code;
    const landType = addr.address.mountain_yn === 'Y' ? '2' : '1';
    const mainNo = addr.address.main_address_no.padStart(4, '0');
    const subNo = addr.address.sub_address_no.padStart(4, '0');
    return `${bCode}${landType}${mainNo}${subNo}`;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAddress) return;
    
    const user = auth.currentUser;
    if (!user) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    setIsSimulating(true);
    setSimulationResult(null);

    try {
      // 1. Check credits
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.data();
      const isAdmin = userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com';
      const currentCredits = userData?.credits || 0;

      if (!isAdmin && currentCredits < 15) {
        alert('크레딧이 부족합니다. 충전 후 이용해주세요. (필요: 15 크레딧)');
        setIsSimulating(false);
        return;
      }

      // 2. Fetch Data
      const pnu = getPNU(selectedAddress);
      if (!pnu) throw new Error('PNU 코드를 생성할 수 없습니다.');

      const vworldRes = await fetch(`/api/vworld-data?data=LP_PA_CBND_BU_INFO&attrFilter=pnu:like:${pnu}`);
      const vworldData = await vworldRes.json();
      
      let landInfo = null;
      if (vworldData.response?.status === 'OK' && vworldData.response.result.featureCollection.features.length > 0) {
        landInfo = vworldData.response.result.featureCollection.features[0].properties;
      }

      const landArea = parseFloat(landInfo?.lnd_area || '0');
      const usageZone = landInfo?.u_zone_nm || '정보 없음';

      // 3. AI Simulation with Gemini
      const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
      const prompt = `
        **Role**: 당신은 대한민국 건축 법규 전문가 및 설계사입니다.
        **Input**:
        - 주소: ${selectedAddress.address_name}
        - 대지면적: ${landArea} ㎡
        - 용도지역: ${usageZone}

        **Task**:
        위 데이터를 바탕으로 해당 필지에 건축 가능한 최대 규모를 시뮬레이션하세요.
        대한민국 국토계획법 및 조례를 기준으로 건폐율과 용적률 상한선을 추정하고, 다음 수치들을 JSON 형식으로만 답변하세요.
        
        **JSON Schema**:
        {
          "maxFloorArea": number (건축면적, ㎡),
          "maxTotalFloorArea": number (연면적, ㎡),
          "floors": number (지상 층수),
          "parkingSpaces": number (법정 주차대수),
          "dimensions": {
            "width": number (가로 길이, m),
            "depth": number (세로 길이, m),
            "height": number (총 높이, m)
          },
          "coverageRatio": number (건폐율, %),
          "floorAreaRatio": number (용적률, %)
        }
        
        *참고: 가로/세로 길이는 대지 모양을 정방형으로 가정하여 건축면적에 맞게 산출하세요. 높이는 층당 3.5m로 계산하세요.*
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const result = JSON.parse(response.text);
      setSimulationResult({
        ...result,
        usageZone,
        landArea
      });

      // 4. Deduct credits
      if (!isAdmin) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { credits: increment(-15) });
        await addDoc(collection(db, 'creditHistory'), {
          uid: user.uid,
          type: 'usage',
          amount: -15,
          description: `건축 시뮬레이션 (${selectedAddress.address_name})`,
          timestamp: serverTimestamp()
        });
      }
    } catch (error: any) {
      console.error('Simulation failed:', error);
      alert(`시뮬레이션 실패: ${error.message}`);
    } finally {
      setIsSimulating(false);
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
            핵심 기능
          </span>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            건축 시뮬레이션
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            용도지역, 건폐율, 용적률을 고려한 최적의 건축 설계안을 자동으로 생성합니다. 대상 토지의 주소나 지번을 입력해주세요.
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10 relative" ref={searchRef}>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 relative">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                  if (selectedAddress && e.target.value !== selectedAddress.address_name) {
                    setSelectedAddress(null);
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
                className="block w-full pl-11 pr-4 py-4 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg transition-all"
                placeholder="분석할 토지의 주소 또는 건물명을 입력하세요"
                required
              />
              
              {showSuggestions && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {searchError ? (
                    <div className="px-4 py-4 text-red-500 text-center text-sm">{searchError}</div>
                  ) : suggestions.length > 0 ? (
                    <ul className="max-h-60 overflow-y-auto">
                      {suggestions.map((suggestion, idx) => (
                        <li 
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="px-4 py-3 hover:bg-slate-50 cursor-pointer flex items-center gap-3 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          {suggestion.type === 'keyword' ? <Building className="w-4 h-4 text-blue-400" /> : <MapPin className="w-4 h-4 text-slate-400" />}
                          <span className="text-slate-700">{suggestion.address_name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-4 text-slate-500 text-center text-sm">검색 결과가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isSimulating || isFetchingData || !selectedAddress}
              className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isSimulating || isFetchingData ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  시뮬레이션 중...
                </>
              ) : (
                '시뮬레이션 시작'
              )}
            </button>
          </form>
          {selectedAddress && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100"
            >
              <Info className="w-4 h-4" />
              <span>토지 분석은 필지(지번) 단위로 진행됩니다. 아파트의 경우 해당 단지 전체 필지에 대한 분석이 수행됩니다.</span>
            </motion.div>
          )}
        </div>

        {/* Results Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 rounded-2xl border border-slate-800 h-[600px] flex flex-col overflow-hidden shadow-2xl relative">
            <div className="absolute top-4 left-4 z-10 flex gap-2">
              <div className="bg-slate-800/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 flex items-center gap-2">
                <Box className="w-3.5 h-3.5" /> 3D Mass Model
              </div>
            </div>
            
            <div className="flex-1 w-full bg-slate-950">
              {simulationResult ? (
                <Canvas shadows>
                  <Suspense fallback={null}>
                    <PerspectiveCamera makeDefault position={[20, 20, 20]} fov={50} />
                    <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2.1} />
                    
                    <ambientLight intensity={0.5} />
                    <directionalLight
                      position={[10, 20, 10]}
                      intensity={1.5}
                      castShadow
                      shadow-mapSize={[1024, 1024]}
                    />
                    
                    <Center top>
                      <BuildingMass dimensions={simulationResult.dimensions} />
                    </Center>
                    
                    <Grid
                      infiniteGrid
                      fadeDistance={50}
                      fadeStrength={5}
                      cellSize={1}
                      sectionSize={5}
                      sectionColor="#334155"
                      cellColor="#1e293b"
                    />
                    
                    <ContactShadows
                      position={[0, 0, 0]}
                      opacity={0.4}
                      scale={40}
                      blur={2}
                      far={4.5}
                    />
                    
                    <Environment preset="city" />
                  </Suspense>
                </Canvas>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-slate-600">
                    <Box className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>검색을 완료하면 3D 건축 매스 모델이 여기에 표시됩니다.</p>
                  </div>
                </div>
              )}
            </div>
            
            {simulationResult && (
              <div className="absolute bottom-4 left-4 right-4 grid grid-cols-3 gap-4">
                <div className="bg-slate-800/80 backdrop-blur p-3 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">가로 (Width)</p>
                  <p className="text-lg font-bold text-white">{simulationResult.dimensions.width}m</p>
                </div>
                <div className="bg-slate-800/80 backdrop-blur p-3 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">세로 (Depth)</p>
                  <p className="text-lg font-bold text-white">{simulationResult.dimensions.depth}m</p>
                </div>
                <div className="bg-slate-800/80 backdrop-blur p-3 rounded-xl border border-slate-700">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">높이 (Height)</p>
                  <p className="text-lg font-bold text-white">{simulationResult.dimensions.height}m</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                <Building className="w-5 h-5 text-blue-600" />
                설계 검토 리포트
              </h3>
              
              {simulationResult ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <Layout className="w-3 h-3" /> 건폐율
                      </p>
                      <p className="text-lg font-bold text-slate-900">{simulationResult.coverageRatio}%</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> 용적률
                      </p>
                      <p className="text-lg font-bold text-slate-900">{simulationResult.floorAreaRatio}%</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600 flex items-center gap-2"><Ruler className="w-4 h-4 text-slate-400" /> 최대 건축 면적</span>
                      <span className="font-semibold text-slate-900">{simulationResult.maxFloorArea.toLocaleString()} ㎡</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600 flex items-center gap-2"><Layout className="w-4 h-4 text-slate-400" /> 최대 연면적</span>
                      <span className="font-semibold text-slate-900">{simulationResult.maxTotalFloorArea.toLocaleString()} ㎡</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600 flex items-center gap-2"><Building className="w-4 h-4 text-slate-400" /> 지상 층수</span>
                      <span className="font-semibold text-slate-900">{simulationResult.floors}층</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-sm text-slate-600 flex items-center gap-2"><Car className="w-4 h-4 text-slate-400" /> 법정 주차대수</span>
                      <span className="font-semibold text-slate-900">{simulationResult.parkingSpaces}대</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <h4 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1">
                      <Sun className="w-4 h-4" /> 법규 검토 의견
                    </h4>
                    <p className="text-xs text-blue-800 leading-relaxed">
                      해당 필지는 {simulationResult.usageZone}으로, 일조권 사선 제한(북측 대지 경계선) 및 대지 안의 공지 규정이 적용됩니다. 
                      산출된 매스는 법적 상한선을 기준으로 한 최대 규모이며, 실제 설계 시 가감될 수 있습니다.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400">
                  <Info className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">주소를 입력하고 시뮬레이션을 시작하면<br/>상세 리포트가 생성됩니다.</p>
                </div>
              )}
            </div>
            
            <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 text-white">
              <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-400" />
                데이터 내보내기
              </h3>
              <p className="text-slate-400 text-xs mb-4">
                생성된 3D 매스 모델 데이터와 상세 법규 검토 내역을 PDF/DXF 파일로 저장할 수 있습니다.
              </p>
              <button 
                disabled={!simulationResult}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed shadow-md"
              >
                리포트 다운로드
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
