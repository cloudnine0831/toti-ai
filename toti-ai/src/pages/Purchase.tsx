import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, Zap, Star, ShieldCheck, Crown, Loader2, CheckCircle2, X } from 'lucide-react';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';

export default function Purchase() {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<{name: string, credits: number} | null>(null);

  const handlePurchase = async (pkg: any) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      alert('로그인이 필요한 서비스입니다.');
      return;
    }

    try {
      setIsPurchasing(true);
      
      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Fetch all users to give credits to everyone as requested
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);

      usersSnap.docs.forEach((userDoc) => {
        const userRef = doc(db, 'users', userDoc.id);
        batch.update(userRef, {
          credits: increment(pkg.credits)
        });

        // Add to history for each user
        const historyRef = doc(collection(db, 'creditHistory'));
        batch.set(historyRef, {
          uid: userDoc.id,
          type: 'purchase_all',
          amount: pkg.credits,
          description: `전체 유저 크레딧 지급 (${pkg.displayName})`,
          timestamp: serverTimestamp(),
          purchasedBy: currentUser.uid // Track who triggered it
        });
      });

      await batch.commit();

      setPurchaseSuccess({ name: pkg.displayName, credits: pkg.credits });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users/all');
    } finally {
      setIsPurchasing(false);
    }
  };

  const packages = [
    { 
      id: 'starter',
      name: 'Starter',
      displayName: '스타터',
      credits: 50, 
      price: 5000, 
      originalPrice: 5000, 
      description: '가볍게 시작하는 AI 분석',
      icon: <Zap className="w-6 h-6 text-blue-500" />,
      features: [
        '모든 AI 분석 기능 이용',
        '기본 분석 리포트 생성',
        '표준 고객 지원',
        '14일간 유효'
      ]
    },
    { 
      id: 'professional',
      name: 'Professional',
      displayName: '프로페셔널',
      credits: 120, 
      price: 10000, 
      originalPrice: 12000, 
      description: '본격적인 개발 검토를 위한 선택',
      icon: <Star className="w-6 h-6 text-amber-500" />,
      popular: true,
      features: [
        '스타터의 모든 기능 포함',
        '상세 수익성 예측 리포트',
        '우선 순위 AI 분석',
        '30일간 유효',
        '보너스 2,000원 상당 할인'
      ]
    },
    { 
      id: 'enterprise',
      name: 'Enterprise',
      displayName: '엔터프라이즈',
      credits: 700, 
      price: 50000, 
      originalPrice: 70000, 
      description: '대규모 프로젝트 및 전문가용',
      icon: <Crown className="w-6 h-6 text-indigo-600" />,
      bestValue: true,
      features: [
        '프로페셔널의 모든 기능 포함',
        '무제한 리포트 보관',
        '1:1 전문가 상담 지원',
        '영구 크레딧 유지',
        '최대 29% 압도적 할인율'
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight"
          >
            성공적인 투자를 위한 <span className="text-blue-600">크레딧 플랜</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 max-w-2xl mx-auto"
          >
            당신의 비즈니스 규모에 맞는 최적의 플랜을 선택하세요. <br className="hidden md:block" />
            데이터 기반의 정확한 분석이 성공을 보장합니다.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
          {packages.map((pkg, index) => {
            const discount = pkg.originalPrice > pkg.price ? Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100) : 0;
            
            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className={`relative bg-white rounded-3xl shadow-xl border-2 overflow-hidden flex flex-col h-full ${
                  pkg.popular ? 'border-blue-600 scale-105 z-10' : 'border-transparent'
                }`}
              >
                {pkg.popular && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white px-6 py-1 rounded-bl-2xl text-sm font-bold tracking-wider">
                    MOST POPULAR
                  </div>
                )}
                {pkg.bestValue && (
                  <div className="absolute top-0 right-0 bg-indigo-600 text-white px-6 py-1 rounded-bl-2xl text-sm font-bold tracking-wider">
                    BEST VALUE
                  </div>
                )}

                <div className="p-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-3 rounded-2xl ${pkg.popular ? 'bg-blue-50' : 'bg-slate-50'}`}>
                      {pkg.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">{pkg.name}</h3>
                      <h2 className="text-2xl font-bold text-slate-900">{pkg.displayName}</h2>
                    </div>
                  </div>
                  
                  <p className="text-slate-500 mb-8 text-sm leading-relaxed">{pkg.description}</p>
                  
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black text-slate-900">{pkg.credits}</span>
                      <span className="text-xl font-bold text-slate-500">크레딧</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl font-bold text-blue-600">{pkg.price.toLocaleString()}원</span>
                      {discount > 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-400 line-through">{pkg.originalPrice.toLocaleString()}원</span>
                          <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">-{discount}%</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 mb-10">
                    {pkg.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-3">
                        <div className="mt-1 bg-blue-50 rounded-full p-0.5">
                          <Check className="w-3.5 h-3.5 text-blue-600" />
                        </div>
                        <span className="text-sm text-slate-600 font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button 
                    onClick={() => handlePurchase(pkg)}
                    disabled={isPurchasing}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2 ${
                      pkg.popular 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-600/20' 
                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isPurchasing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        처리 중...
                      </>
                    ) : '지금 구매하기'}
                  </button>
                </div>
                
                <div className="mt-auto p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-400 font-medium tracking-tight">안전한 보안 결제 시스템 적용</span>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-20 text-center">
          <p className="text-slate-500 text-sm">
            대량 구매 또는 기업용 커스텀 플랜이 필요하신가요? 
            <button className="ml-2 text-blue-600 font-bold hover:underline">영업팀에 문의하기</button>
          </p>
        </div>
      </div>

      {/* Purchase Success Modal */}
      <AnimatePresence>
        {purchaseSuccess && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">구매 완료!</h2>
              <p className="text-slate-600 mb-6">
                <span className="font-bold text-blue-600">{purchaseSuccess.name}</span> 플랜 구매가 완료되었습니다.<br />
                <span className="font-bold text-slate-900">{purchaseSuccess.credits} 크레딧</span>이 충전되었습니다.
              </p>
              <button 
                onClick={() => setPurchaseSuccess(null)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors"
              >
                확인
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
