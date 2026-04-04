import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ContactSales() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    jobTitle: '',
    companyName: '',
    companySize: '',
    country: '대한민국',
    phone: '',
    reason: '',
    details: '',
    marketingConsent: true
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/contact-sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        alert('문의가 접수되었습니다. cloudnine0831@gmail.com으로 메일이 발송되었습니다.');
      } else {
        throw new Error('Failed to send inquiry');
      }
    } catch (error) {
      console.error("Contact sales error:", error);
      alert('문의 전송에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          
          {/* Left Column */}
          <div className="space-y-12">
            <div className="space-y-6">
              <h1 className="text-5xl font-bold text-slate-900 leading-tight">
                ToTi AI 영업팀에<br />문의하기
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
                ToTi AI 영업팀에 문의하여 ToTi AI에서 제공하는 기업 지원에 대해 알아보세요.
              </p>
            </div>

            <div className="space-y-6">
              <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                매일 수백만 명이 업무에 활용하는 ToTi AI
              </p>
              <div className="flex flex-wrap gap-8 items-center opacity-50 grayscale">
                <span className="text-2xl font-bold text-slate-900">GS</span>
                <span className="text-2xl font-bold text-slate-900">HYOSUNG</span>
                <span className="text-2xl font-bold text-slate-900">SENDBIRD</span>
                <span className="text-2xl font-bold text-slate-900">당근</span>
              </div>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-50 rounded-3xl p-10 space-y-8 border border-slate-100"
            >
              <div className="text-2xl font-bold text-slate-900">OpenAI</div>
              <blockquote className="text-xl text-slate-700 leading-relaxed font-medium italic">
                "직원들은 같은 팀 동료들과 공유할 지식을 저장하고 ToTi AI의 빠른 속도에 발맞출 수 있는 애플리케이션을 필요로 합니다. 이 모든 작업을 하나의 플랫폼에서 처리할 수 있는 강력한 애플리케이션이 있죠. 바로 ToTi AI입니다."
              </blockquote>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-200 rounded-full" />
                <div>
                  <div className="font-bold text-slate-900">Nick Erdenberger</div>
                  <div className="text-sm text-slate-500">GTM, OpenAI</div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column - Form */}
          <div className="bg-white rounded-3xl p-2 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">이름 *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="길동"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">성 *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="홍"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">업무용 이메일 *</label>
                  <input 
                    required
                    type="email" 
                    placeholder="email@company.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">직함 *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="예: 매니저"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({...formData, jobTitle: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">회사 이름 *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="가나다 주식회사"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                    value={formData.companyName}
                    onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">회사 규모 *</label>
                  <select 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none appearance-none bg-white"
                    value={formData.companySize}
                    onChange={(e) => setFormData({...formData, companySize: e.target.value})}
                  >
                    <option value="">선택 항목</option>
                    <option value="1-10">1-10명</option>
                    <option value="11-50">11-50명</option>
                    <option value="51-200">51-200명</option>
                    <option value="201-500">201-500명</option>
                    <option value="501+">501명 이상</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">국가나 지역 *</label>
                  <select 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none appearance-none bg-white"
                    value={formData.country}
                    onChange={(e) => setFormData({...formData, country: e.target.value})}
                  >
                    <option value="대한민국">대한민국</option>
                    <option value="미국">미국</option>
                    <option value="일본">일본</option>
                    <option value="중국">중국</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">전화번호 *</label>
                  <input 
                    required
                    type="tel" 
                    placeholder="(123) 456-7891"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">문의 이유 *</label>
                <select 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none appearance-none bg-white"
                  value={formData.reason}
                  onChange={(e) => setFormData({...formData, reason: e.target.value})}
                >
                  <option value="">선택 항목</option>
                  <option value="pricing">가격 문의</option>
                  <option value="demo">데모 요청</option>
                  <option value="partnership">파트너십</option>
                  <option value="other">기타</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">세부 정보를 제공해 주세요. *</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="ToTi AI를 어떻게 사용하고 싶으신지 적어주세요."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all outline-none resize-none"
                  value={formData.details}
                  onChange={(e) => setFormData({...formData, details: e.target.value})}
                />
              </div>

              <div className="flex items-start gap-3">
                <div 
                  className={`mt-1 w-5 h-5 rounded border flex items-center justify-center cursor-pointer transition-colors ${formData.marketingConsent ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}
                  onClick={() => setFormData({...formData, marketingConsent: !formData.marketingConsent})}
                >
                  {formData.marketingConsent && <Check className="w-3 h-3 text-white" />}
                </div>
                <label className="text-sm text-slate-600 leading-tight cursor-pointer" onClick={() => setFormData({...formData, marketingConsent: !formData.marketingConsent})}>
                  ToTi AI의 마케팅 메시지를 수신하는 데 동의합니다.
                </label>
              </div>

              <button 
                type="submit"
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
              >
                영업팀에 문의하기
              </button>

              <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                언제든지 마케팅 메시지를 수신 거부할 수 있습니다. ToTi AI의 웹사이트와 메시지는 ToTi AI 개인정보 보호정책의 적용을 받습니다.
              </p>

              <div className="pt-8 border-t border-slate-100 text-xs text-slate-500 text-center space-y-2">
                <p>기술이나 프로덕트 지원이 필요하면 <a href="mailto:support@totiai.com" className="text-blue-600 hover:underline">support@totiai.com</a> 주소로 이메일을 보내주시거나 <Link to="/" className="text-blue-600 hover:underline">도움말 센터</Link>를 방문해 주세요.</p>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
