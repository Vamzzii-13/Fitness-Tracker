import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { 
  Activity, 
  BarChart3, 
  Calendar, 
  Droplets, 
  Plus, 
  Users, 
  Utensils, 
  LogOut,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Dumbbell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { GoogleGenAI } from "@google/genai";

// Components
import Auth from './components/Auth';
import WorkoutLogger from './components/WorkoutLogger';
import DietLogger from './components/DietLogger';
import FriendsList from './components/FriendsList';
import AISuggestions from './components/AISuggestions';
import Analytics from './components/Analytics';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Activity className="w-12 h-12 text-[#141414]" />
          <p className="font-mono text-sm uppercase tracking-widest">Loading ForgeTrack...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'workouts', label: 'Workouts', icon: Dumbbell },
    { id: 'diet', label: 'Diet & Water', icon: Utensils },
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'ai', label: 'AI Coach', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <nav className="w-full md:w-64 bg-[#141414] text-[#E4E3E0] p-6 flex flex-col border-r border-[#141414]">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-[#E4E3E0] p-2 rounded-sm">
            <Activity className="w-6 h-6 text-[#141414]" />
          </div>
          <h1 className="text-xl font-bold tracking-tighter uppercase italic">ForgeTrack</h1>
        </div>

        <div className="flex-1 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all duration-200 group ${
                activeTab === tab.id 
                  ? 'bg-[#E4E3E0] text-[#141414]' 
                  : 'hover:bg-[#E4E3E0]/10 text-[#E4E3E0]/60 hover:text-[#E4E3E0]'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-[#141414]' : 'text-[#E4E3E0]/40 group-hover:text-[#E4E3E0]'}`} />
              <span className="font-mono text-xs uppercase tracking-wider font-bold">{tab.label}</span>
            </button>
          ))}
        </div>

        <button 
          onClick={() => supabase.auth.signOut()}
          className="mt-auto flex items-center gap-3 px-4 py-3 text-[#E4E3E0]/40 hover:text-red-400 transition-colors font-mono text-xs uppercase tracking-wider"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 md:p-10">
        <header className="mb-10 flex justify-between items-end border-b border-[#141414] pb-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-50 mb-1">
              {format(new Date(), 'EEEE, MMMM do')}
            </p>
            <h2 className="text-4xl font-serif italic font-bold">
              {tabs.find(t => t.id === activeTab)?.label}
            </h2>
          </div>
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase opacity-50">User Session</p>
              <p className="text-sm font-bold">{session.user.email}</p>
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <Dashboard session={session} />}
            {activeTab === 'workouts' && <WorkoutLogger session={session} />}
            {activeTab === 'diet' && <DietLogger session={session} />}
            {activeTab === 'friends' && <FriendsList session={session} />}
            {activeTab === 'analytics' && <Analytics session={session} />}
            {activeTab === 'ai' && <AISuggestions session={session} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Dashboard({ session }: { session: Session }) {
  const [stats, setStats] = useState({
    workoutsThisWeek: 0,
    waterToday: 0,
    caloriesToday: 0,
    progressiveOverload: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      // Fetch water today
      const { data: water } = await supabase
        .from('water_intake')
        .select('amount_ml')
        .eq('date', today);
      
      // Fetch calories today
      const { data: diet } = await supabase
        .from('diet_logs')
        .select('calories, meal_name')
        .eq('date', today);

      // Fetch workouts this week
      const startOfWk = format(startOfWeek(new Date()), 'yyyy-MM-dd');
      const { data: workouts } = await supabase
        .from('workouts')
        .select('id, name, date')
        .gte('date', startOfWk);

      setStats({
        workoutsThisWeek: workouts?.length || 0,
        waterToday: water?.reduce((acc, curr) => acc + curr.amount_ml, 0) || 0,
        caloriesToday: diet?.reduce((acc, curr) => acc + (curr.calories || 0), 0) || 0,
        progressiveOverload: 5.2 // Mock for now as it requires complex calculation
      });

      // Combine for recent activity
      const activity = [
        ...(workouts || []).map(w => ({ type: 'Workout', title: w.name, time: w.date, meta: 'Session logged' })),
        ...(diet || []).map(d => ({ type: 'Diet', title: d.meal_name, time: today, meta: `${d.calories} kcal` }))
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

      setRecentActivity(activity);
    };

    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Workouts (Week)', value: stats.workoutsThisWeek, icon: Dumbbell, unit: 'sessions' },
          { label: 'Water (Today)', value: stats.waterToday, icon: Droplets, unit: 'ml' },
          { label: 'Calories (Today)', value: stats.caloriesToday, icon: Utensils, unit: 'kcal' },
          { label: 'Progressive Overload', value: `+${stats.progressiveOverload}%`, icon: TrendingUp, unit: 'vs last week' },
        ].map((stat, i) => (
          <div key={i} className="bg-[#141414] text-[#E4E3E0] p-6 border border-[#141414] flex flex-col justify-between group hover:bg-[#E4E3E0] hover:text-[#141414] transition-all duration-300">
            <div className="flex justify-between items-start mb-4">
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-60 group-hover:opacity-100">{stat.label}</p>
              <stat.icon className="w-4 h-4 opacity-40 group-hover:opacity-100" />
            </div>
            <div>
              <p className="text-3xl font-serif italic font-bold leading-none mb-1">{stat.value}</p>
              <p className="font-mono text-[10px] uppercase opacity-40 group-hover:opacity-60">{stat.unit}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Progress Chart */}
        <div className="lg:col-span-2 bg-white p-8 border border-[#141414]">
          <div className="flex justify-between items-center mb-8">
            <h3 className="font-serif italic text-xl font-bold">Weekly Volume Trend</h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#141414] rounded-full"></div>
                <span className="font-mono text-[10px] uppercase">Weight (kg)</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockChartData}>
                <defs>
                  <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#141414" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#141414" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E3E0" />
                <XAxis 
                  dataKey="day" 
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
                  itemStyle={{ color: '#E4E3E0' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#141414" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorWeight)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-8 border border-[#141414]">
          <h3 className="font-serif italic text-xl font-bold mb-6">Recent Activity</h3>
          <div className="space-y-6">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex gap-4 group cursor-pointer">
                <div className="w-10 h-10 bg-[#E4E3E0] flex items-center justify-center border border-[#141414] group-hover:bg-[#141414] group-hover:text-[#E4E3E0] transition-colors">
                  {activity.type === 'Workout' && <Dumbbell className="w-4 h-4" />}
                  {activity.type === 'Diet' && <Utensils className="w-4 h-4" />}
                  {activity.type === 'Water' && <Droplets className="w-4 h-4" />}
                </div>
                <div className="flex-1 border-b border-[#E4E3E0] pb-4">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-bold uppercase tracking-tight">{activity.title}</h4>
                    <span className="font-mono text-[9px] uppercase opacity-40">{activity.time}</span>
                  </div>
                  <p className="font-mono text-[10px] uppercase opacity-60">{activity.meta}</p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="font-mono text-[10px] uppercase opacity-40 text-center py-10">No recent activity</p>
            )}
          </div>
          <button className="w-full mt-8 py-3 border border-[#141414] font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
            View All History
          </button>
        </div>
      </div>
    </div>
  );
}

const mockChartData = [
  { day: 'MON', weight: 2400 },
  { day: 'TUE', weight: 1800 },
  { day: 'WED', weight: 3200 },
  { day: 'THU', weight: 2100 },
  { day: 'FRI', weight: 4500 },
  { day: 'SAT', weight: 3800 },
  { day: 'SUN', weight: 0 },
];
