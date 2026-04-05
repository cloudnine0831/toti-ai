import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Clock, History, CreditCard, ShieldAlert, FileText, Map as MapIcon, TrendingUp, Building, Layers, BarChart3 } from 'lucide-react';
import { motion } from 'motion/react';

interface UsageHistory {
  id: string;
  amount: number;
  description: string;
  timestamp: any;
  type: string;
}

export default function MyLibrary() {
  const [history, setHistory] = useState<UsageHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'creditHistory'),
      where('uid', '==', auth.currentUser.uid),
      where('type', '==', 'usage'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UsageHistory[];
      setHistory(historyData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'creditHistory');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'risk_analysis': return <ShieldAlert className="w-5 h-5 text-red-500" />;
      case 'smart_land': return <MapIcon className="w-5 h-5 text-blue-500" />;
      case 'regulation': return <FileText className="w-5 h-5 text-amber-500" />;
      case 'profitability': return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'architectural': return <Building className="w-5 h-5 text-purple-500" />;
      case 'floor_composition': return <Layers className="w-5 h-5 text-indigo-500" />;
      case 'market_trends': return <BarChart3 className="w-5 h-5 text-cyan-500" />;
      case 'admin_gift': return <CreditCard className="w-5 h-5 text-blue-600" />;
      default: return <History className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <History className="w-8 h-8 text-blue-600" />
          최근 이용내역
        </h1>
        <p className="text-slate-500 mt-1">최근 50건의 서비스 이용 및 크레딧 변동 내역입니다.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="p-20 text-center text-slate-400">
            <History className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="text-lg font-medium">이용 내역이 없습니다.</p>
            <p className="text-sm mt-1">서비스를 이용하시면 여기에 내역이 표시됩니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((item) => (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={item.id} 
                className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                    {getIcon(item.type)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{item.description}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      {item.timestamp?.toDate ? item.timestamp.toDate().toLocaleString() : '처리 중...'}
                    </div>
                  </div>
                </div>
                <div className={`text-lg font-black ${item.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {item.amount > 0 ? `+${item.amount}` : item.amount}
                  <span className="text-xs ml-1 font-bold">크레딧</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
