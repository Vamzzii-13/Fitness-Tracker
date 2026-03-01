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
  Area
} from 'recharts';
import { format } from 'date-fns';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { TrendingUp, Activity, Flame } from 'lucide-react';

export default function Analytics({ user }: { user: User }) {
  const [workoutData, setWorkoutData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    const q = query(
      collection(db, 'workouts'),
      where('user_id', '==', user.uid)
    );
    const snap = await getDocs(q);
    const sortedDocs = [...snap.docs].sort((a, b) => a.data().date.localeCompare(b.data().date));
    
    const processed = await Promise.all(sortedDocs.map(async (wDoc) => {
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
        volume: totalVolume,
        sets: totalSets,
        calories: wDoc.data().calories_burnt || 0
      };
    }));

    setWorkoutData(processed);
  };

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="font-serif italic text-2xl font-bold mb-1">Workout Volume</h3>
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">Total weight lifted per session (kg)</p>
            </div>
            <TrendingUp className="w-6 h-6 opacity-40" />
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workoutData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip />
                <Bar dataKey="volume" fill="#141414" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

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

        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] lg:col-span-2">
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
    </div>
  );
}
