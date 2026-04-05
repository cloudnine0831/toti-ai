import React from 'react';
import { motion } from 'motion/react';
import { Building, PlayCircle, ArrowRight, Database, Cpu, FileOutput, CheckCircle } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { User } from 'firebase/auth';

interface HomeProps {
  setIsLoginMode: (mode: boolean) => void;
  setIsLoginModalOpen: (open: boolean) => void;
  landDiagnosisFeatures: any[];
  archSimulationFeatures: any[];
  profitabilityFeatures: any[];
  comprehensiveDiagnosisFeature: any;
  user: User | null;
}

export default function Home({ 
  setIsLoginMode, 
  setIsLoginModalOpen, 
  landDiagnosisFeatures, 
  archSimulationFeatures, 
  profitabilityFeatures,
  comprehensiveDiagnosisFeature,
  user 
}: HomeProps) {
  const navigate = useNavigate();
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

  const renderFeatureCard = (feature: any, index: number, isLarge = false) => {
    const CardContent = (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className={`p-8 rounded-3xl bg-white border-2 border-slate-100 hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-500/10 transition-all group relative overflow-hidden h-full ${isLarge ? 'md:col-span-2' : ''}`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
        <div className="relative z-10">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-blue-600 transition-all">
            {React.cloneElement(feature.icon as React.ReactElement<{ className?: string }>, { className: "w-8 h-8 text-blue-600 group-hover:text-white transition-colors" })}
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-4">{feature.title}</h3>
          <p className="text-slate-600 leading-relaxed text-lg">
            {feature.description}
          </p>
        </div>
      </motion.div>
    );

    if (user) {
      return (
        <Link 
          key={index} 
          to={feature.path} 
          className={`block focus:outline-none ${isLarge ? 'md:col-span-2' : ''}`}
          onMouseDown={(e) => e.currentTarget.blur()}
        >
          {CardContent}
        </Link>
      );
    }

    return (
      <div 
        key={index}
        onClick={() => {
          setIsLoginMode(true);
          setIsLoginModalOpen(true);
        }}
        className={`cursor-pointer focus:outline-none ${isLarge ? 'md:col-span-2' : ''}`}
      >
        {CardContent}
      </div>
    );
  };

  return (
    <>
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold mb-6">
              AI 부동산 분석 플랫폼
            </span>
            <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-8 leading-tight">
              부동산 개발의 <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">새로운 패러다임</span>
            </h1>
            <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
              AI 기술로 토지 분석부터 수익성 예측까지, 부동산 개발의 모든 과정을 혁신합니다. 데이터에 기반한 확실한 의사결정을 지금 경험해보세요.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <button 
                  onClick={() => {
                    const featuresSection = document.getElementById('features');
                    if (featuresSection) {
                      featuresSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }} 
                  onMouseDown={(e) => e.currentTarget.blur()}
                  className="w-full sm:w-auto px-12 py-4 bg-blue-600 text-white rounded-full font-bold text-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 focus:outline-none"
                >
                  시작하기 <ArrowRight className="w-6 h-6" />
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => { setIsLoginMode(false); setIsLoginModalOpen(true); }} 
                    onMouseDown={(e) => e.currentTarget.blur()}
                    className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white rounded-full font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 focus:outline-none"
                  >
                    무료로 시작하기 <ArrowRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* Hero Image/Dashboard Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-20 relative mx-auto max-w-5xl"
        >
          <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="h-12 bg-slate-100 border-b border-slate-200 flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-amber-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50">
              <div className="col-span-2 space-y-6">
                <div className="h-64 bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between shadow-sm">
                  <div className="flex justify-between items-center">
                    <div className="h-4 w-32 bg-slate-200 rounded"></div>
                    <div className="h-8 w-24 bg-blue-100 rounded-full"></div>
                  </div>
                  <div className="flex items-end gap-4 h-32">
                    {[40, 70, 45, 90, 65, 85, 100].map((h, i) => (
                      <div key={i} className="w-full bg-blue-500 rounded-t-md" style={{ height: `${h}%` }}></div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="h-32 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <div className="h-4 w-24 bg-slate-200 rounded mb-4"></div>
                    <div className="h-8 w-32 bg-slate-800 rounded"></div>
                  </div>
                  <div className="h-32 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <div className="h-4 w-24 bg-slate-200 rounded mb-4"></div>
                    <div className="h-8 w-32 bg-blue-600 rounded"></div>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="h-full bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                  <div className="h-4 w-32 bg-slate-200 rounded mb-8"></div>
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100"></div>
                        <div className="flex-1">
                          <div className="h-3 w-full bg-slate-200 rounded mb-2"></div>
                          <div className="h-2 w-2/3 bg-slate-100 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">AI로 혁신하는 부동산 개발</h2>
            <p className="text-lg text-slate-600">
              복잡하고 불확실했던 부동산 개발 과정을 AI 기술로 투명하고 정확하게 만듭니다.
            </p>
          </div>

          {/* 종합 진단 */}
          <div className="mb-20">
            <div className="flex items-center gap-4 mb-8">
              <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">① 종합 진단</h3>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 gap-8">
              {renderFeatureCard(comprehensiveDiagnosisFeature, 0, true)}
            </div>
          </div>

          {/* AI 토지진단 */}
          <div className="mb-20">
            <div className="flex items-center gap-4 mb-8">
              <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">② AI 토지진단</h3>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {landDiagnosisFeatures.map((feature, index) => renderFeatureCard(feature, index))}
            </div>
          </div>

          {/* 건축 시뮬레이션 */}
          <div className="mb-20">
            <div className="flex items-center gap-4 mb-8">
              <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">③ 건축 시뮬레이션</h3>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {archSimulationFeatures.map((feature, index) => renderFeatureCard(feature, index))}
            </div>
          </div>

          {/* 수익성 분석 */}
          <div>
            <div className="flex items-center gap-4 mb-8">
              <h3 className="text-2xl font-bold text-slate-900 whitespace-nowrap">④ 수익성 분석</h3>
              <div className="h-px bg-slate-200 flex-1"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {profitabilityFeatures.map((feature, index) => renderFeatureCard(feature, index))}
            </div>
          </div>
        </div>
      </section>


      {/* How it works Section */}
      <section id="how-it-works" className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">어떻게 작동하나요?</h2>
            <p className="text-lg text-slate-400">
              단 4단계만으로 복잡한 부동산 분석이 완료됩니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
            {/* Connecting line for desktop */}
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-slate-800"></div>

            {steps.map((step, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative text-center"
              >
                <div className="w-24 h-24 mx-auto bg-slate-800 rounded-full flex items-center justify-center mb-6 relative z-10 border-4 border-slate-900">
                  {step.icon}
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">고객들의 이야기</h2>
            <p className="text-lg text-slate-600">
              이미 많은 기업들이 ToTi AI와 함께 혁신을 만들어가고 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                quote: "수주일이 걸리던 사업 타당성 분석을 단 몇 시간 만에 끝낼 수 있게 되었습니다. 데이터의 정확도도 놀랍습니다.",
                author: "김건축",
                role: "A건설 개발본부장"
              },
              {
                quote: "다양한 건축 시뮬레이션을 통해 최적의 수익 모델을 찾을 수 있었습니다. 투자 유치에도 큰 도움이 되었습니다.",
                author: "이투자",
                role: "B자산운용 대표"
              },
              {
                quote: "복잡한 인허가 리스크를 사전에 파악하고 대비할 수 있어 프로젝트 지연을 막을 수 있었습니다.",
                author: "박개발",
                role: "C디벨로퍼 이사"
              }
            ].map((testimonial, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100"
              >
                <div className="flex gap-1 mb-6">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-slate-700 mb-6 italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-500">
                    {testimonial.author[0]}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{testimonial.author}</div>
                    <div className="text-sm text-slate-500">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-blue-600 text-white relative overflow-hidden">
        {/* Abstract background shapes */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">지금 바로 AI로 부동산 분석을 시작하세요</h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            데이터에 기반한 확실한 의사결정으로 성공적인 부동산 개발을 이끌어보세요.
          </p>
          {user ? (
            <button 
              onClick={() => {
                const featuresSection = document.getElementById('features');
                if (featuresSection) {
                  featuresSection.scrollIntoView({ behavior: 'smooth' });
                }
              }} 
              onMouseDown={(e) => e.currentTarget.blur()}
              className="px-12 py-4 bg-white text-blue-600 rounded-full font-bold text-xl hover:bg-blue-50 transition-colors shadow-xl flex items-center gap-2 mx-auto focus:outline-none"
            >
              시작하기 <ArrowRight className="w-6 h-6" />
            </button>
          ) : (
            <button 
              onClick={() => { setIsLoginMode(false); setIsLoginModalOpen(true); }} 
              onMouseDown={(e) => e.currentTarget.blur()}
              className="px-8 py-4 bg-white text-blue-600 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-xl flex items-center gap-2 mx-auto focus:outline-none"
            >
              무료로 시작하기 <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </section>
    </>
  );
}
