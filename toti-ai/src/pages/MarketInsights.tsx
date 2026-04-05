import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Search, BarChart, TrendingUp, MapPin, Loader2 } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, updateDoc, increment, addDoc, collection, serverTimestamp } from 'firebase/firestore';

export default function MarketInsights() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    setIsAnalyzing(true);

    try {
      // 1. Check credits
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.data();
      const isAdmin = userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com';
      const currentCredits = userData?.credits || 0;

      if (!isAdmin && currentCredits < 5) {
        alert('크레딧이 부족합니다. 충전 후 이용해주세요. (필요: 5 크레딧)');
        setIsAnalyzing(false);
        return;
      }

      // 2. Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 3. Deduct credits
      if (!isAdmin) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          credits: increment(-5)
        });

        await addDoc(collection(db, 'creditHistory'), {
          uid: user.uid,
          type: 'usage',
          amount: -5,
          description: `시장 인사이트 (${searchQuery})`,
          timestamp: serverTimestamp()
        });
      }

      alert(isAdmin ? '분석이 완료되었습니다. (관리자 무료)' : '분석이 완료되었습니다. (5 크레딧 차감)');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsAnalyzing(false);
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
            시장 인사이트
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl">
            실시간 부동산 시장 동향과 지역별 투자 기회를 데이터 기반으로 분석합니다. 관심 있는 지역이나 키워드를 입력해주세요.
          </p>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-10">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-11 pr-4 py-4 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent text-lg transition-all"
                placeholder="예: 서울특별시 용산구 한남동"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isAnalyzing}
              className="px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 whitespace-nowrap disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  분석 중...
                </>
              ) : (
                '시장 분석하기'
              )}
            </button>
          </form>
        </div>

        {/* Placeholder for results */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-100 rounded-2xl border border-slate-200 h-[500px] flex items-center justify-center">
            <div className="text-center text-slate-500">
              <BarChart className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>검색을 완료하면 지역별 거래 동향과 가격 변화 그래프가 여기에 표시됩니다.</p>
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                주요 지표
              </h3>
              <ul className="space-y-3 text-slate-600">
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> 최근 1년 실거래가 추이</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> 거래량 및 매물 증감률</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> 인구 이동 및 세대수 변화</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> 상권 매출 및 유동인구 분석</li>
                <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> 개발 호재 및 교통망 확충 계획</li>
              </ul>
            </div>
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
              <h3 className="font-bold text-lg mb-2 text-blue-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                지역 투자 매력도
              </h3>
              <p className="text-blue-800 text-sm mb-4">
                AI가 종합적으로 평가한 해당 지역의 투자 매력도 점수와 리포트를 제공합니다.
              </p>
              <button disabled className="w-full py-2.5 bg-white text-blue-600 font-medium rounded-lg border border-blue-200 opacity-50 cursor-not-allowed">
                인사이트 리포트 다운로드
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
