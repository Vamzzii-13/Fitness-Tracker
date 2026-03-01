import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Trophy, Calendar, TrendingUp, Search } from 'lucide-react';
import { format } from 'date-fns';

interface PR {
  exerciseName: string;
  maxWeight: number;
  reps: number;
  date: string;
  workoutName: string;
  category: string;
}

const CATEGORIES = ['ALL', 'CHEST', 'BACK', 'SHOULDERS', 'LEGS', 'ARMS', 'CORE', 'CARDIO', 'OTHER'];

const getExerciseCategory = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes('bench') || n.includes('chest') || n.includes('fly') || n.includes('pec')) return 'CHEST';
  if (n.includes('row') || n.includes('pull') || n.includes('deadlift') || n.includes('lat') || n.includes('back')) return 'BACK';
  if (n.includes('press') && (n.includes('shoulder') || n.includes('overhead') || n.includes('arnold')) || n.includes('lateral') || n.includes('raise') || n.includes('shrug') || n.includes('face pull')) return 'SHOULDERS';
  if (n.includes('squat') || n.includes('leg') || n.includes('calf') || n.includes('lung') || n.includes('hamstring') || n.includes('quad')) return 'LEGS';
  if (n.includes('curl') || n.includes('tricep') || n.includes('bicep') || n.includes('skull') || n.includes('dip') || n.includes('extension')) return 'ARMS';
  if (n.includes('plank') || n.includes('abs') || n.includes('crunch') || n.includes('core') || n.includes('hanging')) return 'CORE';
  if (n.includes('treadmill') || n.includes('run') || n.includes('cardio') || n.includes('bike') || n.includes('rower')) return 'CARDIO';
  return 'OTHER';
};

export default function PersonalRecords({ user }: { user: User }) {
  const [prs, setPrs] = useState<PR[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  useEffect(() => {
    fetchPRs();
  }, [user]);

  const fetchPRs = async () => {
    setLoading(true);
    try {
      const workoutsQ = query(
        collection(db, 'workouts'),
        where('user_id', '==', user.uid),
        orderBy('date', 'desc')
      );
      const workoutsSnap = await getDocs(workoutsQ);
      const workoutMap = new Map(workoutsSnap.docs.map(doc => [doc.id, doc.data()]));

      const prMap = new Map<string, PR>();

      for (const workoutDoc of workoutsSnap.docs) {
        const exercisesQ = query(collection(db, 'exercises'), where('workout_id', '==', workoutDoc.id));
        const exercisesSnap = await getDocs(exercisesQ);

        for (const exerciseDoc of exercisesSnap.docs) {
          const exerciseData = exerciseDoc.data();
          const exerciseName = exerciseData.name.trim().toLowerCase();
          
          const setsQ = query(collection(db, 'sets'), where('exercise_id', '==', exerciseDoc.id));
          const setsSnap = await getDocs(setsQ);

          setsSnap.docs.forEach(setDoc => {
            const setData = setDoc.data();
            const weight = setData.weight || 0;
            const reps = setData.reps || 0;

            const existingPR = prMap.get(exerciseName);
            if (!existingPR || weight > existingPR.maxWeight || (weight === existingPR.maxWeight && reps > existingPR.reps)) {
              prMap.set(exerciseName, {
                exerciseName: exerciseData.name,
                maxWeight: weight,
                reps: reps,
                date: workoutDoc.data().date,
                workoutName: workoutDoc.data().name,
                category: getExerciseCategory(exerciseData.name)
              });
            }
          });
        }
      }

      const sortedPRs = Array.from(prMap.values()).sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
      setPrs(sortedPRs);
    } catch (error) {
      console.error("Error fetching PRs:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPRs = prs.filter(pr => {
    const matchesSearch = pr.exerciseName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || pr.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Trophy className="w-12 h-12 text-[#141414] animate-bounce opacity-20" />
        <div className="font-mono text-xs uppercase tracking-widest animate-pulse">Scanning Hall of Fame...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="border-l-4 border-[#141414] pl-6 py-2">
          <h2 className="font-serif italic text-4xl font-bold uppercase tracking-tight">Hall of Fame</h2>
          <p className="font-mono text-xs uppercase tracking-widest opacity-50 mt-1">Your All-Time Personal Records</p>
        </div>

        <div className="relative w-full md:w-72 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 group-focus-within:opacity-100 transition-opacity" />
          <input 
            type="text"
            placeholder="SEARCH EXERCISES..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-[#141414] pl-12 pr-4 py-3 font-mono text-[10px] uppercase tracking-widest focus:outline-none shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] focus:translate-x-[-2px] focus:translate-y-[-2px] focus:shadow-[6px_6px_0px_0px_rgba(20,20,20,1)] transition-all"
          />
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar border-b border-[#141414]/10">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-6 py-2 font-mono text-[9px] uppercase tracking-widest whitespace-nowrap transition-all border ${
              selectedCategory === cat 
                ? 'bg-[#141414] text-[#E4E3E0] border-[#141414]' 
                : 'bg-transparent text-[#141414] border-[#141414]/20 hover:border-[#141414]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* PR Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPRs.map((pr, i) => (
          <div 
            key={i} 
            className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_0px_rgba(20,20,20,1)] transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col gap-2">
                <div className="bg-[#141414] text-[#E4E3E0] p-2 w-fit">
                  <Trophy className="w-4 h-4" />
                </div>
                <span className="font-mono text-[8px] uppercase tracking-tighter opacity-40 bg-[#141414]/5 px-2 py-0.5 rounded-sm">
                  {pr.category}
                </span>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] uppercase opacity-40">Achieved</p>
                <p className="font-mono text-[10px] uppercase font-bold">{format(new Date(pr.date), 'MMM dd, yyyy')}</p>
              </div>
            </div>

            <h3 className="font-serif italic text-2xl font-bold mb-4 group-hover:text-[#141414] transition-colors">
              {pr.exerciseName}
            </h3>

            <div className="flex items-end gap-2 mb-6">
              <span className="text-5xl font-serif italic font-black leading-none">{pr.maxWeight}</span>
              <div className="flex flex-col pb-1">
                <span className="font-mono text-[10px] uppercase font-bold leading-none">KG</span>
                <span className="font-mono text-[10px] uppercase opacity-40 leading-none">x {pr.reps} REPS</span>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E4E3E0] flex items-center gap-2">
              <Calendar className="w-3 h-3 opacity-40" />
              <span className="font-mono text-[9px] uppercase tracking-wider opacity-60">
                Logged in: <span className="font-bold text-[#141414]">{pr.workoutName}</span>
              </span>
            </div>
          </div>
        ))}

        {filteredPRs.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-[#141414]/20">
            <p className="font-mono text-xs uppercase tracking-widest opacity-40">No records found matching your search.</p>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="bg-[#141414] text-[#E4E3E0] p-8 flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="text-center md:text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 mb-1">Total Records</p>
            <p className="text-4xl font-serif italic font-bold">{prs.length}</p>
          </div>
          <div className="w-px h-12 bg-[#E4E3E0]/20 hidden md:block"></div>
          <div className="text-center md:text-left">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 mb-1">Heavy Hitter</p>
            <p className="text-xl font-serif italic font-bold">
              {prs.length > 0 ? prs.reduce((prev, current) => (prev.maxWeight > current.maxWeight) ? prev : current).exerciseName : '---'}
            </p>
          </div>
        </div>
        <button 
          onClick={() => fetchPRs()}
          className="px-8 py-3 bg-[#E4E3E0] text-[#141414] font-mono text-[10px] uppercase tracking-widest font-bold hover:bg-white transition-colors flex items-center gap-2"
        >
          <TrendingUp className="w-4 h-4" />
          Refresh Stats
        </button>
      </div>
    </div>
  );
}
