import { motion, AnimatePresence } from 'motion/react';
import { Routes, Route, Link } from 'react-router-dom';
import { 
  Map, 
  TrendingUp, 
  Building, 
  FileText, 
  BarChart, 
  ShieldAlert, 
  Database, 
  Cpu, 
  FileOutput, 
  CheckCircle, 
  ArrowRight, 
  Menu, 
  X,
  PlayCircle,
  LogOut,
  Clock,
  History,
  Shield,
  BarChart3,
  Layers,
  Loader2
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, collection, query, where, orderBy, limit, updateDoc, addDoc } from 'firebase/firestore';
import Home from './pages/Home';
import SmartLandAnalysis from './pages/SmartLandAnalysis';
import ProfitabilitySimulation from './pages/ProfitabilitySimulation';
import ArchitecturalDesign from './pages/ArchitecturalDesign';
import FloorComposition from './pages/FloorComposition';
import MarketTrends from './pages/MarketTrends';
import RiskManagement from './pages/RiskManagement';
import ComprehensiveDiagnosis from './pages/ComprehensiveDiagnosis';
import RegulationAnalysis from './pages/RegulationAnalysis';
import MyInfo from './pages/MyInfo';
import MyLibrary from './pages/MyLibrary';
import Purchase from './pages/Purchase';
import ContactSales from './pages/ContactSales';
import Dashboard from './pages/Dashboard';
import Event from './pages/Event';
import Admin from './pages/Admin';

import ScrollToTop from './components/ScrollToTop';

const ProtectedRoute = ({ children, isAuthReady, user, setIsLoginMode, setIsLoginModalOpen }: { children: React.ReactNode, isAuthReady: boolean, user: User | null, setIsLoginMode: (mode: boolean) => void, setIsLoginModalOpen: (open: boolean) => void }) => {
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-slate-200 max-w-md w-full text-center"
        >
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <Shield className="w-12 h-12 text-blue-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">로그인이 필요합니다</h2>
          <p className="text-slate-600 mb-10 leading-relaxed">
            모든 분석 기능을 이용하시려면 로그인이 필요합니다.<br />
            지금 로그인하고 ToTi AI의 전문 서비스를 경험해보세요.
          </p>
          <button 
            onClick={() => { setIsLoginMode(true); setIsLoginModalOpen(true); }}
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-3 text-lg"
          >
            로그인 / 회원가입 <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Dropdown states
  const [isFeaturesDropdownOpen, setIsFeaturesDropdownOpen] = useState(false);
  const [isInfoDropdownOpen, setIsInfoDropdownOpen] = useState(false);
  const [isProfitabilityDropdownOpen, setIsProfitabilityDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isMobileFeaturesOpen, setIsMobileFeaturesOpen] = useState(false);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);
  const [isMobileProfitabilityOpen, setIsMobileProfitabilityOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [creditHistory, setCreditHistory] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          
          // Auto-upgrade super admin if needed
          if (user.email === 'cloudnine0831@gmail.com' && data.role !== 'admin') {
            updateDoc(doc(db, 'users', user.uid), {
              role: 'admin',
              credits: 999999
            }).catch(err => console.error("Failed to auto-upgrade super admin:", err));
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      });

      // Fetch credit history
      const historyQuery = query(
        collection(db, 'creditHistory'),
        where('uid', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
        const historyData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCreditHistory(historyData);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'creditHistory');
      });

      return () => {
        unsubscribe();
        unsubscribeHistory();
      };
    } else {
      setUserData(null);
      setCreditHistory([]);
    }
  }, [user]);

const handleGoogleLogin = async () => {
    try {
      setAuthError('');
      setIsLoading(true);
      console.log("Starting Google login with custom popup monitor...");

      // --- [수동 감지 로직 시작] ---
      let popupWindow: Window | null = null;
      const originalOpen = window.open;

      // 1. window.open 가로채서 팝업창 참조값 가져오기
      window.open = function (...args: any[]) {
        popupWindow = originalOpen.apply(window, args as any);
        window.open = originalOpen; // 즉시 복구
        return popupWindow;
      };

      let pollInterval: number | undefined = undefined;

      // 2. 팝업창이 닫히는지 0.1초마다 감시하는 약속
      const popupClosedPromise = new Promise<never>((_, reject) => {
        pollInterval = window.setInterval(() => {
          if (popupWindow?.closed) {
            if (pollInterval) window.clearInterval(pollInterval);
            reject({ code: 'auth/popup-closed-by-user' });
          }
        }, 100);
      });

      // 3. 실제 구글 로그인 시도
      const signInPromise = signInWithPopup(auth, googleProvider);

      // 4. 로그인 성공 vs 팝업 닫힘 중 먼저 일어나는 쪽을 채택
      const result = await Promise.race([signInPromise, popupClosedPromise]);
      
      // 인터벌 청소
      if (pollInterval) window.clearInterval(pollInterval);
      // --- [수동 감지 로직 끝] ---

      const loggedInUser = result.user;
      console.log("Google login success:", loggedInUser.email);
      
      // [기존 Firestore 로직 시작]
      const userRef = doc(db, 'users', loggedInUser.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.log("Creating new user profile...");
        const isSuperAdmin = loggedInUser.email === 'cloudnine0831@gmail.com';
        try {
          await setDoc(userRef, {
            uid: loggedInUser.uid,
            email: loggedInUser.email,
            displayName: loggedInUser.displayName,
            photoURL: loggedInUser.photoURL,
            createdAt: serverTimestamp(),
            role: isSuperAdmin ? 'admin' : 'user',
            credits: isSuperAdmin ? 999999 : 500
          });

          await addDoc(collection(db, 'creditHistory'), {
            uid: loggedInUser.uid,
            type: 'event',
            amount: isSuperAdmin ? 999999 : 500,
            description: '가입 축하 크레딧 지급',
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${loggedInUser.uid}`);
        }
      }
      
      setIsLoginModalOpen(false);
      // [기존 Firestore 로직 끝]

    } catch (error: any) {
      console.error("Google login error details:", error);
      let errorMessage = "구글 로그인에 실패했습니다.";
      
      // 에러 코드별 메시지 처리
      if (error.code === 'auth/unauthorized-domain') {
        errorMessage = "현재 도메인이 Firebase에 승인되지 않았습니다. Firebase 콘솔 설정을 확인해주세요.";
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage = "팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.";
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage = "로그인 창이 닫혔습니다. 다시 시도해주세요.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // Login
        await signInWithEmailAndPassword(auth, email, password);
        setIsLoginModalOpen(false);
      } else {
        // Sign up
        if (!name.trim()) {
          throw new Error("이름을 입력해주세요.");
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const newUser = result.user;

        // Update profile with name
        await updateProfile(newUser, { displayName: name });

        // Create user profile in Firestore
        const userRef = doc(db, 'users', newUser.uid);
        try {
          await setDoc(userRef, {
            uid: newUser.uid,
            email: newUser.email,
            displayName: name,
            photoURL: null,
            createdAt: serverTimestamp(),
            role: 'user',
            credits: 500
          });

          // Add welcome credits to history
          await addDoc(collection(db, 'creditHistory'), {
            uid: newUser.uid,
            type: 'event',
            amount: 500,
            description: '가입 축하 크레딧 지급',
            timestamp: serverTimestamp()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `users/${newUser.uid}`);
        }

        setIsLoginModalOpen(false);
      }
    } catch (error: any) {
      console.error("Authentication failed:", error);
      let errorMessage = "인증에 실패했습니다.";
      if (error.code === 'auth/email-already-in-use') errorMessage = "이미 사용 중인 이메일입니다.";
      else if (error.code === 'auth/invalid-credential') errorMessage = "이메일 또는 비밀번호가 올바르지 않습니다.";
      else if (error.code === 'auth/weak-password') errorMessage = "비밀번호는 6자리 이상이어야 합니다.";
      else if (error.message) errorMessage = error.message;
      
      setAuthError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setAuthError('');
  };

  // Reset form when modal closes or mode changes
  useEffect(() => {
    if (!isLoginModalOpen) {
      resetForm();
    }
  }, [isLoginModalOpen]);

  useEffect(() => {
    setAuthError('');
  }, [isLoginMode]);

  const landDiagnosisFeatures = [
    {
      title: '스마트 토지 분석',
      description: '지형, 방위, 도로 접면, 맹지 여부 등을 분석하고 AI 리포트를 제공합니다.',
      icon: <Map className="w-6 h-6 text-blue-600" />,
      path: '/smart-land-analysis'
    },
    {
      title: '규제 및 인허가 리포트',
      description: '용도지역, 건폐율/용적률, 행정 규제 및 예상 비용을 분석합니다.',
      icon: <FileText className="w-6 h-6 text-blue-600" />,
      path: '/regulation-report'
    },
    {
      title: '리스트 관리',
      description: '법적 검토 사항, 환경 평가 등 개발 제한 요소를 사전에 식별합니다.',
      icon: <ShieldAlert className="w-6 h-6 text-blue-600" />,
      path: '/risk-list'
    }
  ];

  const archSimulationFeatures = [
    {
      title: 'AI 건축 설계',
      description: '최적의 용적률을 적용한 3D 배치안을 자동으로 생성합니다.',
      icon: <Building className="w-6 h-6 text-blue-600" />,
      path: '/architectural-design'
    },
    {
      title: '층별/용도별 구성',
      description: '법적 기준 내에서 최대 효율을 내는 층수 및 면적을 제안합니다.',
      icon: <Layers className="w-6 h-6 text-blue-600" />,
      path: '/floor-composition'
    }
  ];

  const profitabilityFeatures = [
    {
      title: '수익성 시뮬레이션',
      description: '예상 분양가, 공사비, 투자 회수 기간(ROI)을 예측합니다.',
      icon: <TrendingUp className="w-6 h-6 text-blue-600" />,
      path: '/profitability-simulation'
    },
    {
      title: '시장 동향 및 가격',
      description: '지역별 실거래가 추이 및 주변 시세 기반 시장 인사이트를 제공합니다.',
      icon: <BarChart className="w-6 h-6 text-blue-600" />,
      path: '/market-trends'
    }
  ];

  const comprehensiveDiagnosisFeature = {
    title: '종합 진단',
    description: '토지 진단, 건축 시뮬레이션, 수익성 분석을 한 번에 확인합니다.',
    icon: <Cpu className="w-6 h-6 text-blue-600" />,
    path: '/comprehensive-diagnosis'
  };

  const steps = [
    {
      title: '데이터 입력',
      description: '분석하고자 하는 토지의 주소나 지번을 입력합니다.',
      icon: <Database className="w-8 h-8 text-blue-600" />
    },
    {
      title: 'AI 분석',
      description: '수백만 건의 데이터를 바탕으로 AI가 다각도로 분석을 진행합니다.',
      icon: <Cpu className="w-8 h-8 text-blue-600" />
    },
    {
      title: '리포트 생성',
      description: '분석 결과를 바탕으로 상세한 개발 타당성 리포트를 생성합니다.',
      icon: <FileOutput className="w-8 h-8 text-blue-600" />
    },
    {
      title: '의사결정 지원',
      description: '데이터에 기반한 객관적인 지표로 최적의 의사결정을 내립니다.',
      icon: <CheckCircle className="w-8 h-8 text-blue-600" />
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <ScrollToTop />
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-[999] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-4 lg:gap-8">
              <div className="flex-shrink-0 flex items-center gap-2">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <Building className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg lg:text-xl tracking-tight text-slate-900">ToTi AI</span>
                </Link>
              </div>

              <div className="hidden md:flex items-center space-x-3 lg:space-x-6">
                <Link to="/comprehensive-diagnosis" className="text-slate-600 hover:text-blue-600 transition-colors py-2 flex items-center gap-1 font-bold whitespace-nowrap text-xs lg:text-sm">
                  종합 진단
                </Link>

                <div 
                  className="relative group"
                  onMouseEnter={() => setIsFeaturesDropdownOpen(true)}
                  onMouseLeave={() => setIsFeaturesDropdownOpen(false)}
                >
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsFeaturesDropdownOpen(!isFeaturesDropdownOpen); }}
                    className="text-slate-600 hover:text-blue-600 transition-colors py-2 flex items-center gap-1 whitespace-nowrap text-xs lg:text-sm"
                  >
                    AI 토지진단
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isFeaturesDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 10, visibility: 'hidden' }}
                    animate={{ 
                      opacity: isFeaturesDropdownOpen ? 1 : 0, 
                      y: isFeaturesDropdownOpen ? 0 : 10,
                      visibility: isFeaturesDropdownOpen ? 'visible' : 'hidden'
                    }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-2 w-[400px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 flex flex-col gap-2 z-50"
                  >
                    {landDiagnosisFeatures.map((feature, idx) => (
                      <Link key={idx} to={feature.path} onClick={() => setIsFeaturesDropdownOpen(false)} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group/item">
                        <div className="mt-1 bg-blue-50 p-2 rounded-lg group-hover/item:bg-blue-100 transition-colors">
                          {React.cloneElement(feature.icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5 text-blue-600" })}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 mb-1 text-sm">{feature.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-2">{feature.description}</div>
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                </div>

                <div 
                  className="relative group"
                  onMouseEnter={() => setIsInfoDropdownOpen(true)}
                  onMouseLeave={() => setIsInfoDropdownOpen(false)}
                >
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsInfoDropdownOpen(!isInfoDropdownOpen); }}
                    className="text-slate-600 hover:text-blue-600 transition-colors py-2 flex items-center gap-1 whitespace-nowrap text-xs lg:text-sm"
                  >
                    건축 시뮬레이션
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isInfoDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 10, visibility: 'hidden' }}
                    animate={{ 
                      opacity: isInfoDropdownOpen ? 1 : 0, 
                      y: isInfoDropdownOpen ? 0 : 10,
                      visibility: isInfoDropdownOpen ? 'visible' : 'hidden'
                    }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-2 w-[300px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 flex flex-col gap-2 z-50"
                  >
                    {archSimulationFeatures.map((feature, idx) => (
                      <Link key={idx} to={feature.path} onClick={() => setIsInfoDropdownOpen(false)} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group/item">
                        <div className="mt-1 bg-blue-50 p-2 rounded-lg group-hover/item:bg-blue-100 transition-colors">
                          {React.cloneElement(feature.icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5 text-blue-600" })}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 mb-1 text-sm">{feature.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-2">{feature.description}</div>
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                </div>

                <div 
                  className="relative group"
                  onMouseEnter={() => setIsProfitabilityDropdownOpen(true)}
                  onMouseLeave={() => setIsProfitabilityDropdownOpen(false)}
                >
                  <button 
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsProfitabilityDropdownOpen(!isProfitabilityDropdownOpen); }}
                    className="text-slate-600 hover:text-blue-600 transition-colors py-2 flex items-center gap-1 whitespace-nowrap text-xs lg:text-sm"
                  >
                    수익성 분석
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isProfitabilityDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 10, visibility: 'hidden' }}
                    animate={{ 
                      opacity: isProfitabilityDropdownOpen ? 1 : 0, 
                      y: isProfitabilityDropdownOpen ? 0 : 10,
                      visibility: isProfitabilityDropdownOpen ? 'visible' : 'hidden'
                    }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-2 w-[300px] bg-white rounded-2xl shadow-xl border border-slate-100 p-4 flex flex-col gap-2 z-50"
                  >
                    {profitabilityFeatures.map((feature, idx) => (
                      <Link key={idx} to={feature.path} onClick={() => setIsProfitabilityDropdownOpen(false)} className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors group/item">
                        <div className="mt-1 bg-blue-50 p-2 rounded-lg group-hover/item:bg-blue-100 transition-colors">
                          {React.cloneElement(feature.icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5 text-blue-600" })}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 mb-1 text-sm">{feature.title}</div>
                          <div className="text-xs text-slate-500 line-clamp-2">{feature.description}</div>
                        </div>
                      </Link>
                    ))}
                  </motion.div>
                </div>
              </div>
            </div>
            
            <div className="hidden md:flex items-center space-x-4 lg:space-x-8">
              <Link to="/event" className="text-slate-600 hover:text-blue-600 transition-colors font-bold flex items-center gap-1 whitespace-nowrap text-xs lg:text-sm">
                <span className="text-amber-500">🎁</span> 이벤트
              </Link>
            <Link 
              to="/"
              onClick={(e) => {
                e.preventDefault();
                const section = document.getElementById('how-it-works');
                if (section) {
                  section.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.location.href = '/#how-it-works';
                }
              }}
              className="text-slate-600 hover:text-blue-600 transition-colors whitespace-nowrap text-xs lg:text-sm focus:outline-none font-bold"
              onMouseDown={(e) => e.currentTarget.blur()}
            >
              작동 방식
            </Link>
              <Link 
                to="/customer-center" 
                className="text-slate-600 hover:text-blue-600 transition-colors whitespace-nowrap text-xs lg:text-sm focus:outline-none"
                onMouseDown={(e) => e.currentTarget.blur()}
              >
                영업팀 문의하기
              </Link>
              
              {isAuthReady && user ? (
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <button 
                      onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                      onMouseDown={(e) => e.currentTarget.blur()}
                      className="flex items-center gap-2 hover:bg-slate-100 p-1 rounded-lg transition-colors focus:outline-none"
                    >
                      {user.photoURL ? (
                        <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                          {user.displayName?.[0] || user.email?.[0] || 'U'}
                        </div>
                      )}
                      <span className="text-sm font-medium text-slate-700">{user.displayName || '사용자'}님</span>
                      <svg className={`w-4 h-4 text-slate-500 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    
                    {isUserDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <div className="text-xs text-slate-500">보유 크레딧</div>
                          <div className="flex items-center justify-between mt-1">
                            <div className="font-bold text-blue-600">{userData?.credits || 0} 크레딧</div>
                            <button 
                              onClick={() => { setIsHistoryModalOpen(true); setIsUserDropdownOpen(false); }}
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold transition-colors"
                            >
                              내역
                            </button>
                          </div>
                        </div>
                        <Link to="/purchase" onClick={() => setIsUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">구매하기</Link>
                        <Link to="/my-info" onClick={() => setIsUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">내 정보</Link>
                        <Link to="/my-library" onClick={() => setIsUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">최근 이용내역</Link>
                        { (userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com') && (
                          <Link to="/admin" onClick={() => setIsUserDropdownOpen(false)} className="block px-4 py-2 text-sm text-blue-600 font-bold hover:bg-blue-50 border-t border-slate-100">관리</Link>
                        )}
                        <button 
                          onClick={() => { handleLogout(); setIsUserDropdownOpen(false); }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          로그아웃
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => { setIsLoginMode(true); setIsLoginModalOpen(true); }} 
                    className="text-slate-600 hover:text-blue-600 font-medium transition-colors whitespace-nowrap text-xs lg:text-sm"
                  >
                    로그인
                  </button>
                  <button 
                    onClick={() => { setIsLoginMode(false); setIsLoginModalOpen(true); }} 
                    className="bg-blue-600 text-white px-3 lg:px-5 py-2 rounded-full font-medium hover:bg-blue-700 transition-colors whitespace-nowrap text-xs lg:text-sm"
                  >
                    무료로 시작하기
                  </button>
                </>
              )}
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-slate-600">
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-b border-slate-200 px-4 pt-2 pb-4 space-y-1 absolute top-16 left-0 right-0 shadow-2xl overflow-hidden z-[999]"
            >
                <Link 
                  to="/comprehensive-diagnosis" 
                  onClick={() => setIsMenuOpen(false)} 
                  onMouseDown={(e) => e.currentTarget.blur()}
                  className="block px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md font-bold focus:outline-none"
                >
                  종합 진단
                </Link>

            {/* AI 토지진단 Mobile */}
            <div>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMobileFeaturesOpen(!isMobileFeaturesOpen); }}
                onMouseDown={(e) => e.currentTarget.blur()}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md font-medium focus:outline-none"
              >
                AI 토지진단
                <svg className={`w-4 h-4 transition-transform ${isMobileFeaturesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isMobileFeaturesOpen && (
                <div className="pl-4 pr-2 py-2 space-y-1 bg-slate-50/50 rounded-md mt-1 mb-2">
                  {landDiagnosisFeatures.map((feature, idx) => (
                    <Link key={idx} to={feature.path} onClick={() => setIsMenuOpen(false)} className="block py-2 px-3 rounded-md hover:bg-blue-50 transition-colors">
                      <div className="font-medium text-slate-800 text-sm">{feature.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{feature.description}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 건축 시뮬레이션 Mobile */}
            <div>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMobileInfoOpen(!isMobileInfoOpen); }}
                onMouseDown={(e) => e.currentTarget.blur()}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md font-medium focus:outline-none"
              >
                건축 시뮬레이션
                <svg className={`w-4 h-4 transition-transform ${isMobileInfoOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isMobileInfoOpen && (
                <div className="pl-4 pr-2 py-2 space-y-1 bg-slate-50/50 rounded-md mt-1 mb-2">
                  {archSimulationFeatures.map((feature, idx) => (
                    <Link key={idx} to={feature.path} onClick={() => setIsMenuOpen(false)} className="block py-2 px-3 rounded-md hover:bg-blue-50 transition-colors">
                      <div className="font-medium text-slate-800 text-sm">{feature.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{feature.description}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 수익성 분석 Mobile */}
            <div>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsMobileProfitabilityOpen(!isMobileProfitabilityOpen); }}
                onMouseDown={(e) => e.currentTarget.blur()}
                className="w-full flex items-center justify-between px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md font-medium focus:outline-none"
              >
                수익성 분석
                <svg className={`w-4 h-4 transition-transform ${isMobileProfitabilityOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {isMobileProfitabilityOpen && (
                <div className="pl-4 pr-2 py-2 space-y-1 bg-slate-50/50 rounded-md mt-1 mb-2">
                  {profitabilityFeatures.map((feature, idx) => (
                    <Link key={idx} to={feature.path} onClick={() => setIsMenuOpen(false)} className="block py-2 px-3 rounded-md hover:bg-blue-50 transition-colors">
                      <div className="font-medium text-slate-800 text-sm">{feature.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{feature.description}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link to="/event" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 text-blue-600 hover:bg-blue-50 rounded-md font-bold flex items-center gap-2">
              <span>🎁</span> 이벤트
            </Link>
            <Link 
              to="/"
              onClick={(e) => {
                e.preventDefault();
                setIsMenuOpen(false);
                const section = document.getElementById('how-it-works');
                if (section) {
                  section.scrollIntoView({ behavior: 'smooth' });
                } else {
                  window.location.href = '/#how-it-works';
                }
              }}
              className="block px-3 py-2 text-slate-600 hover:bg-slate-50 rounded-md font-medium focus:outline-none"
              onMouseDown={(e) => e.currentTarget.blur()}
            >
              작동 방식
            </Link>
            
            {isAuthReady && user ? (
              <div className="pt-4 pb-2 border-t border-slate-100 mt-2">
                <div className="flex items-center gap-3 px-3 mb-4">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                      {user.displayName?.[0] || user.email?.[0] || 'U'}
                    </div>
                  )}
                      <div>
                        <div className="font-medium text-slate-900">{user.displayName || '사용자'}</div>
                        <div className="text-sm text-slate-500">{user.email}</div>
                        <div className="flex flex-col gap-1 mt-2">
                          <div className="text-xs font-bold text-blue-600">{userData?.credits || 0} 크레딧 보유 중</div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => { setIsHistoryModalOpen(true); setIsMenuOpen(false); }}
                              className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold"
                            >
                              내역 보기
                            </button>
                            <Link 
                              to="/my-library" 
                              onClick={() => setIsMenuOpen(false)}
                              className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold"
                            >
                              최근 이용내역
                            </Link>
                          </div>
                        </div>
                      </div>
                </div>
                { (userData?.role === 'admin' || user.email === 'cloudnine0831@gmail.com') && (
                  <Link to="/admin" onClick={() => setIsMenuOpen(false)} className="block px-3 py-2 text-blue-600 font-bold hover:bg-blue-50 rounded-md flex items-center gap-2">
                    <Shield className="w-5 h-5" /> 관리자 페이지
                  </Link>
                )}
                <button 
                  onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-red-600 font-medium hover:bg-red-50 rounded-md flex items-center gap-2"
                >
                  <LogOut className="w-5 h-5" /> 로그아웃
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => { setIsLoginMode(true); setIsLoginModalOpen(true); setIsMenuOpen(false); }} 
                  className="w-full text-left px-3 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-md"
                >
                  로그인
                </button>
                <button 
                  onClick={() => { setIsLoginMode(false); setIsLoginModalOpen(true); setIsMenuOpen(false); }} 
                  className="w-full text-left px-3 py-2 text-blue-600 font-medium hover:bg-slate-50 rounded-md"
                >
                  무료로 시작하기
                </button>
              </>
            )}
          </motion.div>
        )}
        </AnimatePresence>
      </nav>

      {/* Main Content */}
      <main className="pt-16">
        <Routes>
          <Route path="/" element={
            <Home 
              setIsLoginMode={setIsLoginMode} 
              setIsLoginModalOpen={setIsLoginModalOpen} 
              landDiagnosisFeatures={landDiagnosisFeatures}
              archSimulationFeatures={archSimulationFeatures}
              profitabilityFeatures={profitabilityFeatures}
              comprehensiveDiagnosisFeature={comprehensiveDiagnosisFeature}
              user={user}
            />
          } />
          <Route path="/dashboard" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><Dashboard /></ProtectedRoute>} />
          <Route path="/smart-land-analysis" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><SmartLandAnalysis /></ProtectedRoute>} />
          <Route path="/regulation-report" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><RegulationAnalysis /></ProtectedRoute>} />
          <Route path="/risk-list" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><RiskManagement /></ProtectedRoute>} />
          <Route path="/architectural-design" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><ArchitecturalDesign /></ProtectedRoute>} />
          <Route path="/floor-composition" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><FloorComposition /></ProtectedRoute>} />
          <Route path="/profitability-simulation" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><ProfitabilitySimulation /></ProtectedRoute>} />
          <Route path="/market-trends" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><MarketTrends /></ProtectedRoute>} />
          <Route path="/comprehensive-diagnosis" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><ComprehensiveDiagnosis /></ProtectedRoute>} />
          <Route path="/my-info" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><MyInfo /></ProtectedRoute>} />
          <Route path="/my-library" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><MyLibrary /></ProtectedRoute>} />
          <Route path="/purchase" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><Purchase /></ProtectedRoute>} />
          <Route path="/customer-center" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><ContactSales /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}><Admin /></ProtectedRoute>} />
          <Route path="/event" element={
            <ProtectedRoute isAuthReady={isAuthReady} user={user} setIsLoginMode={setIsLoginMode} setIsLoginModalOpen={setIsLoginModalOpen}>
              <Event 
                user={user} 
                setIsLoginModalOpen={setIsLoginModalOpen} 
                setIsLoginMode={setIsLoginMode} 
              />
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-white tracking-tight">ToTi AI</span>
              </div>
              <p className="text-sm max-w-sm">
                AI 기술로 부동산 개발의 모든 과정을 혁신하는 프롭테크 플랫폼입니다.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">서비스</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/smart-land-analysis" onMouseDown={(e) => e.currentTarget.blur()} className="hover:text-white transition-colors focus:outline-none">스마트 토지 분석</Link></li>
                <li><Link to="/profitability-simulation" onMouseDown={(e) => e.currentTarget.blur()} className="hover:text-white transition-colors focus:outline-none">수익성 예측</Link></li>
                <li><Link to="/architectural-design" onMouseDown={(e) => e.currentTarget.blur()} className="hover:text-white transition-colors focus:outline-none">건축 시뮬레이션</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">회사</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" onMouseDown={(e) => e.currentTarget.blur()} className="hover:text-white transition-colors focus:outline-none">소개</Link></li>
                <li><Link to="/" onMouseDown={(e) => e.currentTarget.blur()} className="hover:text-white transition-colors focus:outline-none">블로그</Link></li>
                <li><Link to="/customer-center" onMouseDown={(e) => e.currentTarget.blur()} className="hover:text-white transition-colors focus:outline-none">문의하기</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-sm flex flex-col md:flex-row justify-between items-center">
            <p>&copy; 2026 ToTi AI. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <Link to="/" onMouseDown={(e) => e.currentTarget.blur()} className="hover:text-white transition-colors focus:outline-none">이용약관</Link>
              <Link to="/" onMouseDown={(e) => e.currentTarget.blur()} className="hover:text-white transition-colors focus:outline-none">개인정보처리방침</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Credit History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-xl">
                    <History className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">크레딧 이용 내역</h2>
                    <p className="text-[10px] text-slate-500 mt-0.5">최근 50건의 내역을 확인하실 수 있습니다.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors shadow-sm"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {creditHistory.length > 0 ? (
                  creditHistory.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">{item.description}</span>
                        <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : '처리 중...'}
                        </span>
                      </div>
                      <div className={`text-sm font-black ${item.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                        {item.amount > 0 ? `+${item.amount}` : item.amount} 크레딧
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <History className="w-12 h-12 mb-4 opacity-10" />
                    <p className="text-sm font-medium">이용 내역이 없습니다.</p>
                  </div>
                )}
              </div>
              
              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-600">현재 보유 크레딧</span>
                  <span className="text-lg font-black text-blue-600">{userData?.credits || 0} 크레딧</span>
                </div>
                <Link 
                  to="/purchase" 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center"
                >
                  크레딧 충전하러 가기
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login / Sign Up Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                {isLoginMode ? '로그인' : '무료로 시작하기'}
              </h3>
              <button 
                onClick={() => setIsLoginModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 font-medium py-3 rounded-lg hover:bg-slate-50 transition-colors mb-6 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Google로 계속하기
              </button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-500">또는 이메일로</span>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleEmailAuth}>
                {!isLoginMode && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                    <input 
                      type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                      placeholder="홍길동"
                      required={!isLoginMode}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                    placeholder="name@company.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                
                {authError && (
                  <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-100">
                    {authError}
                  </div>
                )}
                
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition-colors mt-6 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    isLoginMode ? '로그인' : '계정 만들기'
                  )}
                </button>
              </form>
              
              <div className="mt-6 text-center text-sm text-slate-600">
                {isLoginMode ? (
                  <p>
                    아직 계정이 없으신가요?{' '}
                    <button onClick={() => setIsLoginMode(false)} className="text-blue-600 font-semibold hover:underline">
                      무료로 가입하기
                    </button>
                  </p>
                ) : (
                  <p>
                    이미 계정이 있으신가요?{' '}
                    <button onClick={() => setIsLoginMode(true)} className="text-blue-600 font-semibold hover:underline">
                      로그인하기
                    </button>
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </div>
);
}
