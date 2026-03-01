import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Users, UserPlus, Check, Search, TrendingUp, Trophy, Footprints, X, Activity, Flame, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, subDays, isWithinInterval } from 'date-fns';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, limit, orderBy } from 'firebase/firestore';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

export default function FriendsList({ user }: { user: User }) {
  const [friends, setFriends] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'friends' | 'global'>('friends');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userStats, setUserStats] = useState<any>(null);
  const [myStats, setMyStats] = useState<any>(null);

  useEffect(() => {
    fetchFriends();
    fetchAllUsers();
    fetchMyStats();
  }, [user]);

  const fetchMyStats = async () => {
    const stats = await fetchUserStats(user.uid);
    setMyStats(stats);
  };

  const fetchUserStats = async (uid: string) => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const todayStr = format(now, 'yyyy-MM-dd');
    
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, i);
      return format(d, 'yyyy-MM-dd');
    }).reverse();

    const historyMap = new Map(last7Days.map(date => [date, {
      date: format(new Date(date), 'MMM dd'),
      fullDate: date,
      volume: 0,
      caloriesIntake: 0,
      caloriesBurnt: 0,
      steps: 0
    }]));

    // Fetch Workouts
    const wQ = query(collection(db, 'workouts'), where('user_id', '==', uid));
    const wSnap = await getDocs(wQ);
    
    let weeklyVolume = 0;
    let weeklyCaloriesBurnt = 0;
    let todayCaloriesBurnt = 0;
    let workoutCount = 0;

    for (const wDoc of wSnap.docs) {
      const wData = wDoc.data();
      const wDate = new Date(wData.date);
      
      let workoutVolume = 0;
      // Fetch Exercises for volume
      const exQ = query(collection(db, 'exercises'), where('workout_id', '==', wDoc.id));
      const exSnap = await getDocs(exQ);
      for (const exDoc of exSnap.docs) {
        const setQ = query(collection(db, 'sets'), where('exercise_id', '==', exDoc.id));
        const setSnap = await getDocs(setQ);
        workoutVolume += setSnap.docs.reduce((acc, d) => acc + (d.data().weight * d.data().reps), 0);
      }

      if (isWithinInterval(wDate, { start: weekStart, end: weekEnd })) {
        weeklyCaloriesBurnt += wData.calories_burnt || 0;
        workoutCount++;
        weeklyVolume += workoutVolume;
      }

      if (wData.date === todayStr) {
        todayCaloriesBurnt += wData.calories_burnt || 0;
      }

      if (historyMap.has(wData.date)) {
        const h = historyMap.get(wData.date)!;
        h.volume += workoutVolume;
        h.caloriesBurnt += wData.calories_burnt || 0;
      }
    }

    // Fetch Diet
    const dQ = query(collection(db, 'diet_logs'), where('user_id', '==', uid));
    const dSnap = await getDocs(dQ);
    let weeklyCaloriesIntake = 0;
    let todayCaloriesIntake = 0;

    for (const dDoc of dSnap.docs) {
      const dData = dDoc.data();
      const dDate = new Date(dData.date);
      if (isWithinInterval(dDate, { start: weekStart, end: weekEnd })) {
        weeklyCaloriesIntake += dData.calories || 0;
      }
      if (dData.date === todayStr) {
        todayCaloriesIntake += dData.calories || 0;
      }
      if (historyMap.has(dData.date)) {
        const h = historyMap.get(dData.date)!;
        h.caloriesIntake += dData.calories || 0;
      }
    }

    // Fetch Steps
    const sQ = query(collection(db, 'steps'), where('user_id', '==', uid));
    const sSnap = await getDocs(sQ);
    let weeklySteps = 0;
    let todaySteps = 0;

    for (const sDoc of sSnap.docs) {
      const sData = sDoc.data();
      const sDate = new Date(sData.date);
      if (isWithinInterval(sDate, { start: weekStart, end: weekEnd })) {
        weeklySteps += sData.count || 0;
      }
      if (sData.date === todayStr) {
        todaySteps = sData.count || 0;
      }
      if (historyMap.has(sData.date)) {
        const h = historyMap.get(sData.date)!;
        h.steps += sData.count || 0;
      }
    }

    return {
      weeklyVolume,
      weeklyCaloriesBurnt,
      weeklyCaloriesIntake,
      weeklySteps,
      todayCaloriesBurnt,
      todayCaloriesIntake,
      todaySteps,
      workoutCount,
      history: Array.from(historyMap.values())
    };
  };

  const handleUserClick = async (profile: any) => {
    setSelectedUser(profile);
    setUserStats(null);
    const stats = await fetchUserStats(profile.uid);
    setUserStats(stats);
  };

  const fetchAllUsers = async () => {
    const q = query(collection(db, 'profiles'), limit(50));
    const snap = await getDocs(q);
    const users = snap.docs.map(d => d.data()).filter(d => d.uid !== user.uid);
    setAllUsers(users);
  };

  const fetchFriends = async () => {
    // Fetch accepted friendships where user is initiator
    const q1 = query(
      collection(db, 'friendships'),
      where('user_id', '==', user.uid),
      where('status', '==', 'accepted')
    );
    
    // Fetch accepted friendships where user is recipient
    const q2 = query(
      collection(db, 'friendships'),
      where('friend_id', '==', user.uid),
      where('status', '==', 'accepted')
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    
    const allFriendshipDocs = [...snap1.docs, ...snap2.docs];
    
    const friendsData = await Promise.all(allFriendshipDocs.map(async (fDoc) => {
      const data = fDoc.data();
      const friendId = data.user_id === user.uid ? data.friend_id : data.user_id;
      const pSnap = await getDocs(query(collection(db, 'profiles'), where('uid', '==', friendId)));
      
      // Fetch friend's steps today
      const today = format(new Date(), 'yyyy-MM-dd');
      const sSnap = await getDocs(query(
        collection(db, 'steps'), 
        where('user_id', '==', friendId),
        where('date', '==', today),
        limit(1)
      ));
      const steps = sSnap.empty ? 0 : sSnap.docs[0].data().count;

      return { id: fDoc.id, ...data, profile: pSnap.docs[0]?.data(), steps };
    }));

    // Fetch pending requests where user is recipient
    const pq = query(
      collection(db, 'friendships'),
      where('friend_id', '==', user.uid),
      where('status', '==', 'pending')
    );
    const pSnap = await getDocs(pq);
    const pendingData = await Promise.all(pSnap.docs.map(async (fDoc) => {
      const pSnap = await getDocs(query(collection(db, 'profiles'), where('uid', '==', fDoc.data().user_id)));
      return { id: fDoc.id, ...fDoc.data(), profile: pSnap.docs[0]?.data() };
    }));

    setFriends(friendsData);
    setPendingRequests(pendingData);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    const q = query(
      collection(db, 'profiles'),
      where('username', '>=', searchQuery),
      where('username', '<=', searchQuery + '\uf8ff'),
      limit(5)
    );
    const snap = await getDocs(q);
    setSearchResults(snap.docs.map(d => d.data()).filter(d => d.uid !== user.uid));
    setLoading(false);
  };

  const sendRequest = async (friendId: string) => {
    await addDoc(collection(db, 'friendships'), {
      user_id: user.uid,
      friend_id: friendId,
      status: 'pending',
      created_at: new Date().toISOString()
    });
    alert('Request sent!');
    setSearchResults([]);
    setSearchQuery('');
  };

  const acceptRequest = async (requestId: string) => {
    const ref = doc(db, 'friendships', requestId);
    await updateDoc(ref, { status: 'accepted' });
    fetchFriends();
  };

  const leaderboardData = viewMode === 'friends' ? friends : allUsers;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <h3 className="font-serif italic text-2xl font-bold mb-6">Community</h3>
          <form onSubmit={handleSearch} className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <input 
              type="text" 
              placeholder="Search athletes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#E4E3E0]/30 border border-[#141414] px-10 py-3 font-mono text-xs focus:outline-none"
            />
          </form>

          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {(searchResults.length > 0 ? searchResults : allUsers).map((u) => (
              <div key={u.uid} className="flex justify-between items-center bg-[#E4E3E0]/20 p-4 border border-[#141414]/10">
                <div>
                  <p className="font-bold uppercase tracking-tight text-xs">{u.username}</p>
                  <p className="font-mono text-[8px] opacity-40 uppercase">Member since 2024</p>
                </div>
                <button 
                  onClick={() => sendRequest(u.uid)}
                  className="bg-[#141414] text-[#E4E3E0] p-2 hover:bg-[#E4E3E0] hover:text-[#141414] border border-[#141414] transition-all"
                  title="Add Friend"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {pendingRequests.length > 0 && (
          <div className="bg-white border border-[#141414] p-8">
            <h3 className="font-serif italic text-xl font-bold mb-6">Pending Requests</h3>
            <div className="space-y-4">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex justify-between items-center bg-yellow-50 p-4 border border-yellow-200">
                  <span className="font-bold uppercase tracking-tight text-xs">{req.profile?.username}</span>
                  <button 
                    onClick={() => acceptRequest(req.id)}
                    className="bg-green-500 text-white p-2 hover:bg-green-600 transition-all"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <h3 className="font-serif italic text-2xl font-bold">Leaderboard</h3>
            <div className="flex bg-[#141414]/5 p-1 border border-[#141414]">
              <button 
                onClick={() => setViewMode('friends')}
                className={`px-4 py-1 font-mono text-[10px] uppercase tracking-widest transition-all ${viewMode === 'friends' ? 'bg-[#141414] text-[#E4E3E0]' : 'opacity-40 hover:opacity-100'}`}
              >
                Friends
              </button>
              <button 
                onClick={() => setViewMode('global')}
                className={`px-4 py-1 font-mono text-[10px] uppercase tracking-widest transition-all ${viewMode === 'global' ? 'bg-[#141414] text-[#E4E3E0]' : 'opacity-40 hover:opacity-100'}`}
              >
                Global
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {leaderboardData.map((item, i) => {
              const profile = viewMode === 'friends' ? item.profile : item;
              const steps = viewMode === 'friends' ? item.steps : 0; // Global steps would require more complex fetching
              
              return (
                <div 
                  key={item.uid || item.id} 
                  onClick={() => handleUserClick(profile)}
                  className="flex items-center gap-6 bg-[#141414]/5 p-6 border border-[#141414] group hover:bg-[#141414] hover:text-[#E4E3E0] transition-all cursor-pointer"
                >
                  <div className="text-2xl font-serif italic font-bold opacity-20 group-hover:opacity-100">0{i + 1}</div>
                  <div className="flex-1">
                    <h4 className="font-bold uppercase tracking-widest">{profile?.username}</h4>
                  </div>
                  <div className="flex gap-10">
                    <div className="text-right">
                      <p className="font-mono text-[9px] uppercase opacity-40">Steps</p>
                      <p className="font-bold flex items-center gap-1 justify-end">
                        <Footprints className="w-3 h-3 text-indigo-500" />
                        {steps?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[9px] uppercase opacity-40">Streak</p>
                      <p className="font-bold flex items-center gap-1 justify-end">
                        <Trophy className="w-3 h-3 text-yellow-500" />
                        {Math.floor(Math.random() * 15)}d
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {leaderboardData.length === 0 && (
              <div className="py-10 text-center border border-dashed border-[#141414]/20">
                <p className="font-mono text-[10px] uppercase opacity-40">No athletes found in this category.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#141414]/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#E4E3E0] border-2 border-[#141414] w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
            >
              <div className="sticky top-0 bg-[#141414] text-[#E4E3E0] p-6 flex justify-between items-center z-10">
                <div>
                  <h2 className="font-serif italic text-3xl font-bold">{selectedUser.username}</h2>
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">Athlete Profile & Performance</p>
                </div>
                <button 
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-8 space-y-10">
                {!userStats ? (
                  <div className="py-20 text-center">
                    <Activity className="w-12 h-12 mx-auto mb-4 animate-pulse opacity-20" />
                    <p className="font-mono text-[10px] uppercase tracking-widest opacity-40">Analyzing performance data...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <StatCard 
                        label="Today's Steps" 
                        value={userStats.todaySteps.toLocaleString()} 
                        icon={<Footprints className="w-4 h-4" />}
                        comparison={myStats ? userStats.todaySteps - myStats.todaySteps : 0}
                      />
                      <StatCard 
                        label="Today's Burn" 
                        value={`${userStats.todayCaloriesBurnt} kcal`} 
                        icon={<Flame className="w-4 h-4" />}
                        comparison={myStats ? userStats.todayCaloriesBurnt - myStats.todayCaloriesBurnt : 0}
                      />
                      <StatCard 
                        label="Weekly Volume" 
                        value={`${userStats.weeklyVolume.toLocaleString()} kg`} 
                        icon={<TrendingUp className="w-4 h-4" />}
                        comparison={myStats ? userStats.weeklyVolume - myStats.weeklyVolume : 0}
                      />
                      <StatCard 
                        label="Weekly Intake" 
                        value={`${userStats.weeklyCaloriesIntake.toLocaleString()} kcal`} 
                        icon={<Activity className="w-4 h-4" />}
                        comparison={myStats ? userStats.weeklyCaloriesIntake - myStats.weeklyCaloriesIntake : 0}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <ChartCard 
                        title="Volume Comparison" 
                        icon={<TrendingUp className="w-4 h-4" />}
                        data={myStats?.history.map((h: any, i: number) => ({
                          date: h.date,
                          you: h.volume,
                          friend: userStats.history[i]?.volume || 0
                        }))}
                        dataKeyFriend="friend"
                        dataKeyYou="you"
                        friendName={selectedUser.username}
                        colorFriend="#f97316"
                        unit="kg"
                      />

                      <ChartCard 
                        title="Intake Comparison" 
                        icon={<Activity className="w-4 h-4" />}
                        data={myStats?.history.map((h: any, i: number) => ({
                          date: h.date,
                          you: h.caloriesIntake,
                          friend: userStats.history[i]?.caloriesIntake || 0
                        }))}
                        dataKeyFriend="friend"
                        dataKeyYou="you"
                        friendName={selectedUser.username}
                        colorFriend="#10b981"
                        unit="kcal"
                      />

                      <ChartCard 
                        title="Steps Comparison" 
                        icon={<Footprints className="w-4 h-4" />}
                        data={myStats?.history.map((h: any, i: number) => ({
                          date: h.date,
                          you: h.steps,
                          friend: userStats.history[i]?.steps || 0
                        }))}
                        dataKeyFriend="friend"
                        dataKeyYou="you"
                        friendName={selectedUser.username}
                        colorFriend="#6366f1"
                        unit="steps"
                      />

                      <ChartCard 
                        title="Burn Comparison" 
                        icon={<Flame className="w-4 h-4" />}
                        data={myStats?.history.map((h: any, i: number) => ({
                          date: h.date,
                          you: h.caloriesBurnt,
                          friend: userStats.history[i]?.caloriesBurnt || 0
                        }))}
                        dataKeyFriend="friend"
                        dataKeyYou="you"
                        friendName={selectedUser.username}
                        colorFriend="#ef4444"
                        unit="kcal"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-6">
                        <h4 className="font-serif italic text-xl font-bold border-b border-[#141414]/10 pb-2">Weekly Breakdown</h4>
                        <div className="space-y-4">
                          <ProgressBar label="Steps Progress" current={userStats.weeklySteps} target={70000} unit="steps" />
                          <ProgressBar label="Workout Consistency" current={userStats.workoutCount} target={5} unit="sessions" />
                          <ProgressBar label="Volume Target" current={userStats.weeklyVolume} target={50000} unit="kg" />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="font-serif italic text-xl font-bold border-b border-[#141414]/10 pb-2">Performance vs You</h4>
                        <div className="bg-[#141414] text-[#E4E3E0] p-6 space-y-6">
                          <ComparisonRow 
                            label="Weekly Volume" 
                            friendVal={userStats.weeklyVolume} 
                            myVal={myStats?.weeklyVolume || 0} 
                            unit="kg"
                          />
                          <ComparisonRow 
                            label="Weekly Steps" 
                            friendVal={userStats.weeklySteps} 
                            myVal={myStats?.weeklySteps || 0} 
                            unit=""
                          />
                          <ComparisonRow 
                            label="Calorie Intake" 
                            friendVal={userStats.weeklyCaloriesIntake} 
                            myVal={myStats?.weeklyCaloriesIntake || 0} 
                            unit="kcal"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon, comparison }: { label: string, value: string, icon: React.ReactNode, comparison: number }) {
  return (
    <div className="bg-white border border-[#141414] p-6 space-y-2">
      <div className="flex justify-between items-start">
        <div className="p-2 bg-[#141414]/5 rounded-lg">{icon}</div>
        {comparison !== 0 && (
          <div className={`flex items-center text-[10px] font-bold ${comparison > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {comparison > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(comparison).toLocaleString()}
          </div>
        )}
      </div>
      <div>
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-40">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function ProgressBar({ label, current, target, unit }: { label: string, current: number, target: number, unit: string }) {
  const percent = Math.min(Math.round((current / target) * 100), 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-widest">
        <span>{label}</span>
        <span>{current.toLocaleString()} / {target.toLocaleString()} {unit}</span>
      </div>
      <div className="h-2 bg-[#141414]/10 border border-[#141414]/5 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className="h-full bg-[#141414]"
        />
      </div>
    </div>
  );
}

function ComparisonRow({ label, friendVal, myVal, unit }: { label: string, friendVal: number, myVal: number, unit: string }) {
  const diff = friendVal - myVal;
  return (
    <div className="flex justify-between items-center border-b border-white/10 pb-4 last:border-0 last:pb-0">
      <div className="space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">{label}</p>
        <p className="text-sm font-bold">{friendVal.toLocaleString()} {unit}</p>
      </div>
      <div className="text-right">
        <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">Difference</p>
        <p className={`text-sm font-bold ${diff > 0 ? 'text-green-400' : 'text-red-400'}`}>
          {diff > 0 ? '+' : ''}{diff.toLocaleString()} {unit}
        </p>
      </div>
    </div>
  );
}

function ChartCard({ title, icon, data, dataKeyFriend, dataKeyYou, friendName, colorFriend, unit }: any) {
  return (
    <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
      <div className="flex justify-between items-center mb-6">
        <h4 className="font-serif italic text-lg font-bold">{title}</h4>
        <div className="opacity-40">{icon}</div>
      </div>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#14141410" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10, fontFamily: 'monospace' }} 
              axisLine={{ stroke: '#141414', strokeWidth: 1 }}
            />
            <YAxis 
              tick={{ fontSize: 10, fontFamily: 'monospace' }} 
              axisLine={{ stroke: '#141414', strokeWidth: 1 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#141414', 
                border: '2px solid #141414', 
                color: '#E4E3E0', 
                fontFamily: 'monospace', 
                fontSize: '10px',
                boxShadow: '4px 4px 0px 0px rgba(20,20,20,0.2)'
              }}
              itemStyle={{ color: '#E4E3E0' }}
              cursor={{ stroke: '#141414', strokeWidth: 1, strokeDasharray: '5 5' }}
            />
            <Legend 
              verticalAlign="top" 
              height={36} 
              iconType="square" 
              wrapperStyle={{ 
                fontSize: '10px', 
                fontFamily: 'monospace', 
                textTransform: 'uppercase',
                letterSpacing: '0.1em'
              }} 
            />
            <Line 
              type="stepAfter" 
              dataKey={dataKeyYou} 
              stroke="#141414" 
              strokeWidth={3} 
              dot={{ r: 0 }} 
              activeDot={{ r: 6, strokeWidth: 0, fill: '#141414' }} 
              name="You" 
            />
            <Line 
              type="stepAfter" 
              dataKey={dataKeyFriend} 
              stroke={colorFriend} 
              strokeWidth={3} 
              dot={{ r: 0 }} 
              activeDot={{ r: 6, strokeWidth: 0, fill: colorFriend }} 
              name={friendName} 
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-[#141414]/5 flex justify-between items-center">
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-40">Unit: {unit}</p>
        <p className="font-mono text-[9px] uppercase tracking-widest opacity-40">Last 7 Days</p>
      </div>
    </div>
  );
}
