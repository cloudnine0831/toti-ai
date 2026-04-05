import React, { useState, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import { Gift, AlertCircle, CheckCircle2 } from 'lucide-react';
import { User } from 'firebase/auth';
import { doc, updateDoc, increment, collection, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface EventProps {
  user: User | null;
  setIsLoginModalOpen: (open: boolean) => void;
  setIsLoginMode: (mode: boolean) => void;
}

const PRIZES = [
  { amount: 3, color: '#FFFFFF', weight: 40, label: '3 크레딧' },
  { amount: 5, color: '#E0F2FE', weight: 25, label: '5 크레딧' },
  { amount: 7, color: '#FFFFFF', weight: 15, label: '7 크레딧' },
  { amount: 10, color: '#E0F2FE', weight: 10, label: '10 크레딧' },
  { amount: 15, color: '#FFFFFF', weight: 7, label: '15 크레딧' },
  { amount: 30, color: '#E0F2FE', weight: 3, label: '30 크레딧' },
];

export default function Event({ user, setIsLoginModalOpen, setIsLoginMode }: EventProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [showLoginConfirm, setShowLoginConfirm] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const controls = useAnimation();
  const wheelRef = useRef<HTMLDivElement>(null);

  const handleSpinClick = async () => {
    if (!user) {
      setShowLoginConfirm(true);
      return;
    }
    if (isSpinning) return;

    // Check daily limit for non-admins
    const isSuperAdmin = user.email === 'cloudnine0831@gmail.com';
    
    try {
      const userSnap = await getDoc(doc(db, 'users', user.uid));
      const userData = userSnap.data();
      const isAdmin = userData?.role === 'admin' || isSuperAdmin;
      
      if (!isAdmin) {
        const lastSpin = userData?.lastSpin?.toDate();
        if (lastSpin) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (lastSpin >= today) {
            alert('룰렛은 하루에 한 번만 참여 가능합니다. 내일 다시 도전해주세요!');
            return;
          }
        }
      }
      
      startSpin(isAdmin);
    } catch (error) {
      console.error("Error checking spin limit:", error);
      startSpin(false); // Fallback to normal behavior
    }
  };

  const startSpin = async (isAdmin: boolean) => {
    setIsSpinning(true);
    setResult(null);
    setIsSuccess(false);

    // Calculate prize based on weights
    const totalWeight = PRIZES.reduce((acc, p) => acc + p.weight, 0);
    let random = Math.random() * totalWeight;
    let prizeIndex = 0;
    for (let i = 0; i < PRIZES.length; i++) {
      if (random < PRIZES[i].weight) {
        prizeIndex = i;
        break;
      }
      random -= PRIZES[i].weight;
    }

    const prize = PRIZES[prizeIndex];
    const segmentAngle = 360 / PRIZES.length;
    const targetRotation = 360 * 5 - (prizeIndex * segmentAngle + segmentAngle / 2);

    await controls.start({
      rotate: targetRotation,
      transition: { duration: 4, ease: [0.13, 0, 0, 1] }
    });

    setIsSpinning(false);
    setResult(prize.amount);

    // Update credits in Firestore
    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const updates: any = {
          credits: increment(prize.amount)
        };
        
        if (!isAdmin) {
          updates.lastSpin = serverTimestamp();
        }

        await updateDoc(userRef, updates);

        // Add to history
        await addDoc(collection(db, 'creditHistory'), {
          uid: user.uid,
          type: 'event',
          amount: prize.amount,
          description: '룰렛 이벤트 당첨',
          timestamp: serverTimestamp()
        });

        setIsSuccess(true);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0085FF] pt-24 pb-20 px-4 flex flex-col items-center overflow-hidden">
      {/* Header Section */}
      <div className="text-center mb-12 relative">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-block bg-white/20 backdrop-blur-md border border-white/30 rounded-full px-6 py-2 mb-6"
        >
          <span className="text-white font-bold flex items-center gap-2">
            <span className="text-xl">💠</span> 하루에 한번! <span className="text-xl">💠</span>
          </span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter drop-shadow-[0_4px_0_rgba(0,0,0,0.1)]"
        >
          행운의<br />출석 룰렛
        </motion.h1>

        <div className="bg-black text-white px-6 py-1 rounded-full inline-block font-bold text-sm mb-6">
          EVENT 01
        </div>

        <p className="text-white text-xl md:text-2xl font-bold leading-tight">
          매일 100% 당첨 출석 룰렛<br />
          행운의 크레딧을 받아보세요!
        </p>

        {/* Decorative elements */}
        <div className="absolute -top-10 -left-20 text-white/20 text-6xl rotate-12">✳️</div>
        <div className="absolute top-20 -right-20 text-white/20 text-6xl -rotate-12">✳️</div>
      </div>

      {/* Roulette Wheel Section */}
      <div className="relative w-full max-w-[480px] aspect-square mb-12 px-4 group">
        {/* Outer Glow */}
        <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-3xl animate-pulse" />
        
        {/* Wheel Container */}
        <div className="relative w-full h-full rounded-full border-[16px] border-[#222] shadow-[0_0_80px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(255,255,255,0.1)] bg-[#222] overflow-hidden p-1">
          <motion.div 
            ref={wheelRef}
            animate={controls}
            className="w-full h-full rounded-full overflow-hidden"
            style={{ transformOrigin: 'center center' }}
          >
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-2xl">
              {PRIZES.map((prize, index) => {
                const angle = 360 / PRIZES.length;
                const startAngle = index * angle;
                const endAngle = (index + 1) * angle;
                
                // Convert polar to cartesian for the arc
                const x1 = 50 + 50 * Math.cos((Math.PI * (startAngle - 90)) / 180);
                const y1 = 50 + 50 * Math.sin((Math.PI * (startAngle - 90)) / 180);
                const x2 = 50 + 50 * Math.cos((Math.PI * (endAngle - 90)) / 180);
                const y2 = 50 + 50 * Math.sin((Math.PI * (endAngle - 90)) / 180);
                
                const pathData = `M 50 50 L ${x1} ${y1} A 50 50 0 0 1 ${x2} ${y2} Z`;
                
                return (
                  <g key={index} className="transition-opacity hover:opacity-90">
                    <path d={pathData} fill={prize.color} stroke="#222" strokeWidth="0.5" />
                    <g transform={`rotate(${startAngle + angle / 2} 50 50)`}>
                      {/* Text Background for better contrast */}
                      <circle cx="50" cy="24" r="10" fill="white" fillOpacity="0.8" />
                      
                      <text 
                        x="50" 
                        y="23" 
                        textAnchor="middle" 
                        fontSize="8"
                        fontWeight="900"
                        fill="#0f172a"
                      >
                        {prize.amount}
                      </text>
                      <text 
                        x="50" 
                        y="33" 
                        textAnchor="middle" 
                        fontSize="3.5"
                        fontWeight="800"
                        fill="#475569"
                        letterSpacing="-0.05em"
                      >
                        CREDIT
                      </text>
                    </g>
                  </g>
                );
              })}
              
              {/* Center decoration */}
              <circle cx="50" cy="50" r="4" fill="#222" />
              <circle cx="50" cy="50" r="2" fill="white/20" />
            </svg>
          </motion.div>

          {/* Decorative Outer Lights (Dots) */}
          {[...Array(24)].map((_, i) => (
            <div 
              key={i}
              className={`absolute w-1.5 h-1.5 rounded-full transition-colors duration-500 ${i % 2 === 0 ? 'bg-yellow-300 shadow-[0_0_8px_#fde047]' : 'bg-white/30'}`}
              style={{ 
                top: '50%', 
                left: '50%', 
                transform: `rotate(${i * 15}deg) translate(0, -215px)` 
              }}
            />
          ))}
        </div>

        {/* Pointer (Top) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[30%] z-40">
          <motion.div
            animate={isSpinning ? { rotate: [0, -10, 10, -10, 0] } : {}}
            transition={{ repeat: Infinity, duration: 0.2 }}
          >
            <svg width="50" height="60" viewBox="0 0 50 60" className="drop-shadow-2xl">
              <defs>
                <linearGradient id="pointerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#b91c1c" />
                </linearGradient>
              </defs>
              <path d="M 25 60 L 0 0 L 50 0 Z" fill="url(#pointerGrad)" stroke="white" strokeWidth="3" />
              <circle cx="25" cy="15" r="6" fill="white" />
              <circle cx="25" cy="15" r="3" fill="#ef4444" />
            </svg>
          </motion.div>
        </div>

        {/* Center Button */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50">
          <button 
            onClick={handleSpinClick}
            disabled={isSpinning}
            className="relative w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 border-[8px] border-white shadow-[0_10px_40px_rgba(37,99,235,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-90 disabled:scale-100 group overflow-hidden"
          >
            {/* Button Shine */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            <div className="text-center relative z-10">
              <div className="text-white font-black text-2xl md:text-3xl tracking-tighter drop-shadow-lg">SPIN</div>
              <div className="text-white/70 text-[10px] md:text-xs font-bold tracking-widest">GO!</div>
            </div>
            
            {/* Pulse effect when idle */}
            {!isSpinning && (
              <div className="absolute inset-[-12px] border-2 border-white/40 rounded-full animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* Probability Info */}
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-6 max-w-md w-full">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5" /> 당첨 확률 안내
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {PRIZES.map((p, i) => (
            <div key={i} className="flex justify-between items-center text-white/80 text-sm">
              <span>{p.amount} 크레딧</span>
              <span className="font-bold text-white">{p.weight}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Login Confirmation Modal */}
      {showLoginConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
          >
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">로그인 후 참여 가능합니다</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">
              룰렛 이벤트는 회원 전용 서비스입니다.<br />
              로그인하고 행운의 크레딧을 받아보세요!
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowLoginConfirm(false)}
                className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                취소
              </button>
              <button 
                onClick={() => {
                  setShowLoginConfirm(false);
                  setIsLoginMode(true);
                  setIsLoginModalOpen(true);
                }}
                className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
              >
                확인
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Win Modal */}
      {result !== null && !isSpinning && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
          >
            {/* Confetti effect placeholder */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ y: -20, x: Math.random() * 300 - 150, opacity: 1 }}
                  animate={{ y: 400, opacity: 0 }}
                  transition={{ duration: 2, delay: Math.random() * 0.5 }}
                  className="absolute w-2 h-2 rounded-full"
                  style={{ backgroundColor: ['#FFD700', '#FF6347', '#00BFFF', '#32CD32'][i % 4] }}
                />
              ))}
            </div>

            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">축하합니다!</h3>
            <div className="text-4xl font-black text-blue-600 mb-4">
              {result} 크레딧 당첨
            </div>
            <p className="text-slate-500 mb-8">
              {isSuccess ? '적립금이 즉시 지급되었습니다.' : '적립금 지급 중 오류가 발생했습니다.'}
            </p>
            <button 
              onClick={() => setResult(null)}
              className="w-full py-4 rounded-xl font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-xl"
            >
              확인
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
