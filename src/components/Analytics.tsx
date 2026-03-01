import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { TrendingUp, Activity, Target } from 'lucide-react';

export default function Analytics({ session }: { session: Session }) {
  const [workoutData, setWorkoutData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    const { data: workouts } = await supabase
      .from('workouts')
      .select(`
        *,
        exercises (
          *,
          sets (*)
        )
      `)
      .order('date', { ascending: true });

    if (workouts) {
      const processed = workouts.map(w => ({
        date: format(new Date(w.date), 'MMM dd'),
        volume: w.exercises.reduce((acc: number, ex: any) => 
          acc + ex.sets.reduce((sAcc: number, s: any) => sAcc + (s.weight * s.reps), 0)
        , 0),
        sets: w.exercises.reduce((acc: number, ex: any) => acc + ex.sets.length, 0)
      }));
      setWorkoutData(processed);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Weekly Volume */}
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
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#141414' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#141414' }}
                />
                <Tooltip 
                  cursor={{ fill: '#E4E3E0', opacity: 0.5 }}
                  contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontFamily: 'monospace', fontSize: '10px' }}
                />
                <Bar dataKey="volume" fill="#141414" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Set Intensity */}
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
                <defs>
                  <linearGradient id="colorSets" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#141414' }}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#141414' }}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#141414', border: 'none', color: '#E4E3E0', fontFamily: 'monospace', fontSize: '10px' }}
                />
                <Area type="monotone" dataKey="sets" stroke="#141414" fillOpacity={1} fill="url(#colorSets)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Progress Table */}
      <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
        <h3 className="font-serif italic text-2xl font-bold mb-8">Progressive Overload Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#141414]">
                <th className="py-4 font-mono text-[10px] uppercase tracking-widest opacity-40">Date</th>
                <th className="py-4 font-mono text-[10px] uppercase tracking-widest opacity-40">Workout</th>
                <th className="py-4 font-mono text-[10px] uppercase tracking-widest opacity-40">Total Volume</th>
                <th className="py-4 font-mono text-[10px] uppercase tracking-widest opacity-40">Intensity Score</th>
                <th className="py-4 font-mono text-[10px] uppercase tracking-widest opacity-40">Status</th>
              </tr>
            </thead>
            <tbody>
              {workoutData.slice().reverse().map((data, i) => (
                <tr key={i} className="border-b border-[#E4E3E0] hover:bg-[#E4E3E0]/30 transition-colors group">
                  <td className="py-4 font-mono text-xs">{data.date}</td>
                  <td className="py-4 font-bold uppercase tracking-tight text-xs">Session {workoutData.length - i}</td>
                  <td className="py-4 font-mono text-xs">{data.volume.toLocaleString()} kg</td>
                  <td className="py-4 font-mono text-xs">{(data.volume / (data.sets || 1)).toFixed(1)} kg/set</td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-green-500' : 'bg-[#141414]'}`}></div>
                      <span className="font-mono text-[9px] uppercase tracking-widest">
                        {i === 0 ? 'Peak Performance' : 'Consistent'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
