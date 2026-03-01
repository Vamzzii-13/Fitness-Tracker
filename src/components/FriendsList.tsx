import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Users, UserPlus, Check, X, Search, TrendingUp, Trophy } from 'lucide-react';
import { Profile, Friendship } from '../types';

export default function FriendsList({ session }: { session: Session }) {
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    // Fetch accepted friends
    const { data: accepted } = await supabase
      .from('friendships')
      .select(`
        *,
        friend_profile:profiles!friend_id(*)
      `)
      .eq('user_id', session.user.id)
      .eq('status', 'accepted');

    // Fetch pending requests
    const { data: pending } = await supabase
      .from('friendships')
      .select(`
        *,
        friend_profile:profiles!user_id(*)
      `)
      .eq('friend_id', session.user.id)
      .eq('status', 'pending');

    if (accepted) setFriends(accepted);
    if (pending) setPendingRequests(pending);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${searchQuery}%`)
      .neq('id', session.user.id)
      .limit(5);

    if (data) setSearchResults(data);
    setLoading(false);
  };

  const sendRequest = async (friendId: string) => {
    const { error } = await supabase
      .from('friendships')
      .insert({
        user_id: session.user.id,
        friend_id: friendId,
        status: 'pending'
      });
    
    if (!error) {
      alert('Request sent!');
      setSearchResults([]);
      setSearchQuery('');
    }
  };

  const acceptRequest = async (requestId: string) => {
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', requestId);
    
    if (!error) fetchFriends();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      {/* Search & Requests */}
      <div className="lg:col-span-1 space-y-8">
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <h3 className="font-serif italic text-2xl font-bold mb-6">Find Athletes</h3>
          <form onSubmit={handleSearch} className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
            <input 
              type="text" 
              placeholder="Search username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#E4E3E0]/30 border border-[#141414] px-10 py-3 font-mono text-xs focus:outline-none"
            />
          </form>

          <div className="space-y-4">
            {searchResults.map((user) => (
              <div key={user.id} className="flex justify-between items-center bg-[#E4E3E0]/20 p-4 border border-[#141414]/10">
                <div>
                  <p className="font-bold uppercase tracking-tight text-xs">{user.username}</p>
                  <p className="font-mono text-[9px] opacity-40">{user.full_name}</p>
                </div>
                <button 
                  onClick={() => sendRequest(user.id)}
                  className="bg-[#141414] text-[#E4E3E0] p-2 hover:bg-[#E4E3E0] hover:text-[#141414] border border-[#141414] transition-all"
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
                  <span className="font-bold uppercase tracking-tight text-xs">{req.friend_profile?.username}</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => acceptRequest(req.id)}
                      className="bg-green-500 text-white p-2 hover:bg-green-600 transition-all"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button className="bg-red-500 text-white p-2 hover:bg-red-600 transition-all">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Friends List & Comparison */}
      <div className="lg:col-span-2 space-y-8">
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <h3 className="font-serif italic text-2xl font-bold mb-8">Leaderboard</h3>
          <div className="space-y-4">
            {friends.map((friend, i) => (
              <div key={friend.id} className="flex items-center gap-6 bg-[#141414]/5 p-6 border border-[#141414] group hover:bg-[#141414] hover:text-[#E4E3E0] transition-all">
                <div className="text-2xl font-serif italic font-bold opacity-20 group-hover:opacity-100">0{i + 1}</div>
                <div className="flex-1">
                  <h4 className="font-bold uppercase tracking-widest">{friend.friend_profile?.username}</h4>
                  <p className="font-mono text-[9px] uppercase opacity-40">Elite Athlete</p>
                </div>
                <div className="flex gap-10">
                  <div className="text-right">
                    <p className="font-mono text-[9px] uppercase opacity-40">Volume</p>
                    <p className="font-bold">12,450kg</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[9px] uppercase opacity-40">Streak</p>
                    <p className="font-bold flex items-center gap-1 justify-end">
                      <Trophy className="w-3 h-3 text-yellow-500" />
                      12d
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {friends.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-[#141414]/20">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">No friends yet. Compete to grow.</p>
              </div>
            )}
          </div>
        </div>

        {/* Comparison Chart Placeholder */}
        <div className="bg-[#141414] text-[#E4E3E0] p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-serif italic text-xl font-bold">Progressive Overload Comparison</h3>
            <TrendingUp className="w-6 h-6 opacity-40" />
          </div>
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-8">Weekly volume growth vs friends</p>
          <div className="h-40 flex items-end gap-4">
            {[60, 80, 45, 90, 30].map((h, i) => (
              <div key={i} className="flex-1 bg-[#E4E3E0]/10 relative group">
                <div 
                  className="absolute bottom-0 left-0 right-0 bg-[#E4E3E0] transition-all duration-1000" 
                  style={{ height: `${h}%` }}
                ></div>
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono text-[9px] opacity-0 group-hover:opacity-100 transition-opacity">
                  +{h/10}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
