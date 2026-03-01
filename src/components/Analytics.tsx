import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { TrendingUp, Activity, Flame, Scale, Utensils } from 'lucide-react';

export default function Analytics({ user }: { user: User }) {
  const [workoutData, setWorkoutData] = useState<any[]>([]);
  const [progressData, setProgressData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // 1. Fetch Workout Data (Session based)
      const q = query(
        collection(db, 'workouts'),
        where('user_id', '==', user.uid)
      );
      const snap = await getDocs(q);
      const sortedDocs = [...snap.docs].sort((a, b) => a.data().date.localeCompare(b.data().date));
      
      const sessionData = await Promise.all(sortedDocs.map(async (wDoc) => {
        const exQ = query(collection(db, 'exercises'), where('workout_id', '==', wDoc.id));
        const exSnap = await getDocs(exQ);
        
        let totalVolume = 0;
        let totalSets = 0;
        
        for (const exDoc of exSnap.docs) {
          const setQ = query(collection(db, 'sets'), where('exercise_id', '==', exDoc.id));
          const setSnap = await getDocs(setQ);
          totalSets += setSnap.docs.length;
          totalVolume += setSnap.docs.reduce((acc, d) => acc + (d.data().weight * d.data().reps), 0);
        }

        return {
          date: format(new Date(wDoc.data().date), 'MMM dd'),
          fullDate: wDoc.data().date,
          volume: totalVolume,
          sets: totalSets,
          calories: wDoc.data().calories_burnt || 0
        };
      }));

      setWorkoutData(sessionData);

      // 2. Fetch Progress Data (Daily based for last 30 days)
      const now = new Date();
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const d = subDays(now, i);
        return format(d, 'yyyy-MM-dd');
      }).reverse();

      const dailyMap = new Map(last30Days.map(date => [date, {
        date: format(new Date(date), 'MMM dd'),
        fullDate: date,
        weight: null as number | null,
        volume: 0,
        intake: 0
      }]));

      // Fetch Weight Logs
      const weightQ = query(collection(db, 'weight_logs'), where('user_id', '==', user.uid));
      const weightSnap = await getDocs(weightQ);
      weightSnap.docs.forEach(doc => {
        const data = doc.data();
        if (dailyMap.has(data.date)) {
          dailyMap.get(data.date)!.weight = data.weight;
        }
      });

      // Fill in missing weights (carry forward)
      let lastWeight: number | null = null;
      // We might need to fetch the weight just before the 30 day window to start correctly
      const prevWeightQ = query(
        collection(db, 'weight_logs'), 
        where('user_id', '==', user.uid),
        where('date', '<', last30Days[0]),
        orderBy('date', 'desc'),
        limit(1)
      );
      const prevWeightSnap = await getDocs(prevWeightQ);
      if (!prevWeightSnap.empty) {
        lastWeight = prevWeightSnap.docs[0].data().weight;
      }

      last30Days.forEach(date => {
        const day = dailyMap.get(date)!;
        if (day.weight === null) {
          day.weight = lastWeight;
        } else {
          lastWeight = day.weight;
        }
      });

      // Fetch Diet Logs
      const dietQ = query(collection(db, 'diet_logs'), where('user_id', '==', user.uid));
      const dietSnap = await getDocs(dietQ);
      dietSnap.docs.forEach(doc => {
        const data = doc.data();
        if (dailyMap.has(data.date)) {
          dailyMap.get(data.date)!.intake += data.calories || 0;
        }
      });

      // Add Volume to daily map
      sessionData.forEach(session => {
        if (dailyMap.has(session.fullDate)) {
          dailyMap.get(session.fullDate)!.volume += session.volume;
        }
      });

      setProgressData(Array.from(dailyMap.values()));
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="font-mono text-sm animate-pulse">ANALYZING PERFORMANCE DATA...</div>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* Progress Over Time Section */}
      <section className="space-y-8">
        <div className="border-l-4 border-[#141414] pl-6 py-2">
          <h2 className="font-serif italic text-4xl font-bold uppercase tracking-tight">Progress Over Time</h2>
          <p className="font-mono text-xs uppercase tracking-widest opacity-50 mt-1">30-Day Performance Trends</p>
        </div>

        <div className="grid grid-cols-1 gap-10">
          {/* Weight Progress */}
          <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-serif italic text-2xl font-bold mb-1">Body Weight</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">Morning weight trend (kg)</p>
              </div>
              <Scale className="w-6 h-6 opacity-40" />
            </div>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis 
                    domain={['dataMin - 2', 'dataMax + 2']} 
                    tick={{ fontSize: 10, fontFamily: 'monospace' }} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontFamily: 'monospace', fontSize: '10px' }}
                    itemStyle={{ color: '#E4E3E0' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="weight" 
                    stroke="#141414" 
                    strokeWidth={3} 
                    dot={{ r: 0 }} 
                    activeDot={{ r: 6, fill: '#141414', strokeWidth: 0 }} 
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Volume Progress */}
            <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="font-serif italic text-2xl font-bold mb-1">Daily Volume</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">Total weight lifted per day (kg)</p>
                </div>
                <TrendingUp className="w-6 h-6 opacity-40" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontFamily: 'monospace', fontSize: '10px' }}
                    />
                    <Area type="stepAfter" dataKey="volume" stroke="#141414" fill="#141414" fillOpacity={0.1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Calorie Intake Progress */}
            <div className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="font-serif italic text-2xl font-bold mb-1">Calorie Intake</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">Daily nutritional intake (kcal)</p>
                </div>
                <Utensils className="w-6 h-6 opacity-40" />
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontFamily: 'monospace', fontSize: '10px' }}
                    />
                    <Line type="monotone" dataKey="intake" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Session Breakdown Section */}
      <section className="space-y-8">
        <div className="border-l-4 border-[#141414] pl-6 py-2">
          <h2 className="font-serif italic text-4xl font-bold uppercase tracking-tight">Session Breakdown</h2>
          <p className="font-mono text-xs uppercase tracking-widest opacity-50 mt-1">Individual Workout Analysis</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-serif italic text-2xl font-bold mb-1">Training Density</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">Total sets performed per session</p>
              </div>
              <Activity className="w-6 h-6 opacity-40" />
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={workoutData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="sets" stroke="#141414" fill="#141414" fillOpacity={0.1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-serif italic text-2xl font-bold mb-1">Energy Expenditure</h3>
                <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">Estimated calories burnt per session (kcal)</p>
              </div>
              <Flame className="w-6 h-6 text-orange-500 opacity-40" />
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={workoutData}>
                  <defs>
                    <linearGradient id="colorCal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="calories" stroke="#f97316" fill="url(#colorCal)" fillOpacity={1} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
