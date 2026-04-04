import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  CreditCard, 
  Clock, 
  Plus, 
  Shield, 
  Search, 
  ChevronRight, 
  History,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  increment, 
  addDoc, 
  serverTimestamp, 
  orderBy, 
  where,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  credits: number;
  role: string;
  createdAt: any;
  lastLogin?: any;
}

interface CreditHistory {
  id: string;
  amount: number;
  description: string;
  timestamp: any;
  type: string;
}

export default function Admin() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [userHistory, setUserHistory] = useState<CreditHistory[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [creditAmount, setCreditAmount] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isSuperAdmin = auth.currentUser?.email === 'cloudnine0831@gmail.com';

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as UserProfile[];
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      setIsHistoryLoading(true);
      const q = query(
        collection(db, 'creditHistory'),
        where('uid', '==', selectedUser.uid),
        orderBy('timestamp', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const history = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CreditHistory[];
        setUserHistory(history);
        setIsHistoryLoading(false);
      }, (error) => {
        console.error("Error fetching user history:", error);
        setIsHistoryLoading(false);
      });

      return () => unsubscribe();
    } else {
      setUserHistory([]);
    }
  }, [selectedUser]);

  const handleGiveCredits = async () => {
    if (!selectedUser || isProcessing) return;
    
    setIsProcessing(true);
    setMessage(null);

    try {
      const userRef = doc(db, 'users', selectedUser.uid);
      await updateDoc(userRef, {
        credits: increment(creditAmount)
      });

      await addDoc(collection(db, 'creditHistory'), {
        uid: selectedUser.uid,
        amount: creditAmount,
        description: '관리자 크레딧 지급',
        type: 'admin_gift',
        timestamp: serverTimestamp(),
        adminUid: auth.currentUser?.uid
      });

      setMessage({ type: 'success', text: `${selectedUser.displayName || selectedUser.email}님에게 ${creditAmount} 크레딧을 지급했습니다.` });
    } catch (error) {
      console.error("Error giving credits:", error);
      setMessage({ type: 'error', text: '크레딧 지급 중 오류가 발생했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleAdmin = async (user: UserProfile) => {
    if (!isSuperAdmin || isProcessing) return;
    
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`${user.displayName || user.email}님의 권한을 ${newRole === 'admin' ? '관리자' : '일반 사용자'}로 변경하시겠습니까?`)) return;

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        role: newRole
      });
      setMessage({ type: 'success', text: '권한이 변경되었습니다.' });
    } catch (error) {
      console.error("Error toggling admin:", error);
      setMessage({ type: 'error', text: '권한 변경 중 오류가 발생했습니다.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (user.displayName && user.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="pt-32 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            관리자 대시보드
          </h1>
          <p className="text-slate-500 mt-1">사용자 관리 및 시스템 설정을 관리합니다.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text"
            placeholder="이메일 또는 이름 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 border border-slate-200 rounded-xl w-full md:w-64 focus:ring-2 focus:ring-blue-600 outline-none transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              가입 사용자 ({filteredUsers.length}명)
            </h2>
          </div>
          
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-6 py-4 font-semibold">사용자</th>
                  <th className="px-6 py-4 font-semibold">보유 크레딧</th>
                  <th className="px-6 py-4 font-semibold">권한</th>
                  <th className="px-6 py-4 font-semibold">가입일</th>
                  <th className="px-6 py-4 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((user) => (
                  <tr 
                    key={user.uid} 
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedUser?.uid === user.uid ? 'bg-blue-50/50' : ''}`}
                    onClick={() => setSelectedUser(user)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs">
                            {user.displayName?.[0] || user.email?.[0]}
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-800">{user.displayName || '이름 없음'}</span>
                          <span className="text-xs text-slate-400">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-blue-600">{user.credits.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${user.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-slate-400">
                        {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <ChevronRight className="w-5 h-5 text-slate-300 inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile User List */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredUsers.map((user) => (
              <div 
                key={user.uid}
                onClick={() => setSelectedUser(user)}
                className={`p-4 active:bg-slate-50 transition-colors ${selectedUser?.uid === user.uid ? 'bg-blue-50/50' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm">
                        {user.displayName?.[0] || user.email?.[0]}
                      </div>
                    )}
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-800">{user.displayName || '이름 없음'}</span>
                      <span className="text-xs text-slate-400">{user.email}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300" />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">보유 크레딧</span>
                    <span className="text-sm font-black text-blue-600">{user.credits.toLocaleString()}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">권한</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${user.role === 'admin' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                      {user.role}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Details & Actions */}
        <div className="space-y-6">
          {selectedUser ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
            >
              <div className="flex items-center gap-4 mb-6">
                {selectedUser.photoURL ? (
                  <img src={selectedUser.photoURL} alt="" className="w-16 h-16 rounded-2xl border border-slate-200" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-2xl">
                    {selectedUser.displayName?.[0] || selectedUser.email?.[0]}
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{selectedUser.displayName || '이름 없음'}</h3>
                  <p className="text-sm text-slate-500">{selectedUser.email}</p>
                </div>
              </div>

              {message && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {message.text}
                </div>
              )}

              <div className="space-y-6">
                {/* Credit Management */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">크레딧 지급</label>
                  <div className="flex gap-2">
                    <input 
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                      className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                    <button 
                      onClick={handleGiveCredits}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      지급
                    </button>
                  </div>
                </div>

                {/* Role Management */}
                {isSuperAdmin && selectedUser.email !== 'cloudnine0831@gmail.com' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">권한 설정</label>
                    <button 
                      onClick={() => handleToggleAdmin(selectedUser)}
                      disabled={isProcessing}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${selectedUser.role === 'admin' ? 'bg-amber-50 text-amber-600 border border-amber-100 hover:bg-amber-100' : 'bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100'}`}
                    >
                      <Shield className="w-4 h-4" />
                      {selectedUser.role === 'admin' ? '관리자 권한 해제' : '관리자로 임명'}
                    </button>
                  </div>
                )}

                {/* Recent History */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                    최근 이용 내역
                    <History className="w-3 h-3" />
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {isHistoryLoading ? (
                      <div className="py-8 flex justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-200" />
                      </div>
                    ) : userHistory.length > 0 ? (
                      userHistory.map(item => (
                        <div key={item.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-700 line-clamp-1">{item.description}</span>
                            <span className="text-[8px] text-slate-400">{item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : '-'}</span>
                          </div>
                          <span className={`text-xs font-black ${item.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                            {item.amount > 0 ? `+${item.amount}` : item.amount}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center py-8 text-xs text-slate-400">내역이 없습니다.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-12 text-center text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-10" />
              <p className="text-sm">사용자를 선택하여 상세 정보를 확인하고<br />크레딧을 지급하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
