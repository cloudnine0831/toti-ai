import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import { User, Mail, Lock, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function MyInfo() {
  const [userData, setUserData] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      if (auth.currentUser) {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setDisplayName(data.displayName || '');
        }
      }
    };
    fetchUser();
  }, []);

  const handleUpdateInfo = async () => {
    if (!displayName.trim()) {
      setMessage({ type: 'error', text: '이름을 입력해주세요.' });
      return;
    }
    
    setIsLoading(true);
    try {
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { displayName });
        setMessage({ type: 'success', text: '정보가 성공적으로 수정되었습니다.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '정보 수정 중 오류가 발생했습니다.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!password || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: '모든 비밀번호 필드를 입력해주세요.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다.' });
      return;
    }

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: '비밀번호는 6자리 이상이어야 합니다.' });
      return;
    }

    setIsLoading(true);
    try {
      if (auth.currentUser && auth.currentUser.email) {
        const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
        await reauthenticateWithCredential(auth.currentUser, credential);
        await updatePassword(auth.currentUser, newPassword);
        setMessage({ type: 'success', text: '비밀번호가 성공적으로 변경되었습니다.' });
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      let errorMsg = '비밀번호 변경에 실패했습니다.';
      if (error.code === 'auth/wrong-password') errorMsg = '현재 비밀번호가 올바르지 않습니다.';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">내 정보 관리</h1>
          <p className="text-slate-500 mt-2">회원님의 개인정보와 계정 설정을 관리하세요.</p>
        </div>

        <AnimatePresence mode="wait">
          {message.text && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
                message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-sm font-medium">{message.text}</span>
              <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-current opacity-50 hover:opacity-100">
                <ShieldCheck className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-6">
          {/* Profile Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                기본 정보
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">이메일 계정</label>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 text-slate-500">
                    <Mail className="w-4 h-4" />
                    <span className="text-sm">{auth.currentUser?.email}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2">이메일 주소는 변경할 수 없습니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">이름</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="이름을 입력하세요"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleUpdateInfo}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '저장 중...' : '기본 정보 저장'}
                </button>
              </div>
            </div>
          </section>

          {/* Password Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Lock className="w-5 h-5 text-blue-600" />
                비밀번호 변경
              </h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">현재 비밀번호</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                      placeholder="현재 비밀번호를 입력하세요"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">새 비밀번호</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="새 비밀번호 (6자 이상)"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">비밀번호 확인</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                        placeholder="비밀번호를 다시 입력하세요"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleUpdatePassword}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors disabled:opacity-50"
                >
                  {isLoading ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          </section>

          {/* Account Status */}
          <section className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white rounded-lg shadow-sm">
                <ShieldCheck className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-blue-900">계정 보안 상태: 안전</h3>
                <p className="text-xs text-blue-700 mt-1">회원님의 계정은 안전하게 보호되고 있습니다. 주기적인 비밀번호 변경을 권장합니다.</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
