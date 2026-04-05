import React from 'react';
import { motion } from 'motion/react';
import { 
  Map, 
  TrendingUp, 
  Building, 
  FileText, 
  BarChart, 
  ShieldAlert,
  Layers
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const mainFeatures = [
    {
      title: '스마트 토지 분석',
      description: '위성 이미지와 GIS 데이터를 AI로 분석하여 토지의 개발 잠재력을 정확하게 평가합니다.',
      icon: <Map className="w-8 h-8 text-blue-600" />,
      path: '/smart-land-analysis'
    },
    {
      title: '수익성 예측',
      description: '과거 거래 데이터와 시장 트렌드를 학습한 AI가 예상 수익률과 투자 회수 기간을 산출합니다.',
      icon: <TrendingUp className="w-8 h-8 text-blue-600" />,
      path: '/profitability-prediction'
    },
    {
      title: '건축 시뮬레이션',
      description: '용도지역, 건폐율, 용적률을 고려한 최적의 건축 설계안을 자동으로 생성합니다.',
      icon: <Building className="w-8 h-8 text-blue-600" />,
      path: '/architectural-simulation'
    },
    {
      title: '인허가 자동화',
      description: '필요한 인허가 절차를 파악하고 예상 소요 기간 및 비용을 자동으로 산정합니다.',
      icon: <FileText className="w-8 h-8 text-blue-600" />,
      path: '/permit-automation'
    }
  ];

  const individualFeatures = [
    {
      title: '공법 및 행정 규제',
      description: '용도지역, 건폐율, 용적률 및 각종 행정 규제 데이터를 분석하여 개발 가능 여부를 진단합니다.',
      icon: <FileText className="w-8 h-8 text-slate-600" />,
      path: '/regulation-analysis'
    },
    {
      title: '시장 인사이트',
      description: '실시간 부동산 시장 동향과 지역별 투자 기회를 데이터 기반으로 분석합니다.',
      icon: <BarChart className="w-8 h-8 text-slate-600" />,
      path: '/market-insights'
    },
    {
      title: '리스크 관리',
      description: '법적 검토, 환경 평가 등 개발 리스크를 사전에 식별하고 대응 방안을 제시합니다.',
      icon: <ShieldAlert className="w-8 h-8 text-slate-600" />,
      path: '/risk-management'
    },
    {
      title: '실거래가 분석',
      description: '국토교통부 실거래 데이터를 기반으로 주변 시세와 변동률을 정밀 분석합니다.',
      icon: <BarChart className="w-8 h-8 text-slate-600" />,
      path: '/actual-price-analysis'
    },
    {
      title: '물리적 특성 분석',
      description: '토지의 형상, 방위, 도로 접면 상태 및 맹지 여부를 AI가 정밀하게 분석합니다.',
      icon: <Layers className="w-8 h-8 text-slate-600" />,
      path: '/land-physical-analysis'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold text-slate-900 mb-4"
          >
            AI로 혁신하는 부동산 개발
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600 max-w-3xl mx-auto"
          >
            복잡하고 불확실했던 부동산 개발 과정을 AI 기술로 투명하고 정확하게 만듭니다.
          </motion.p>
        </div>

        {/* Main Features Section */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl font-bold text-slate-800">핵심 종합 분석 서비스</h2>
            <div className="h-px bg-slate-200 flex-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {mainFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, translateY: -5 }}
                onClick={() => navigate(feature.path)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all group"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Individual Analysis Section */}
        <div>
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl font-bold text-slate-500">개별 데이터 분석 서비스</h2>
            <div className="h-px bg-slate-200 flex-1" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {individualFeatures.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: (index + 4) * 0.1 }}
                whileHover={{ scale: 1.02, translateY: -5 }}
                onClick={() => navigate(feature.path)}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all group opacity-80 hover:opacity-100"
              >
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-slate-100 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
