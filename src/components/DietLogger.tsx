import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Droplets, Utensils, Plus, Trash2, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { WaterIntake, DietLog } from '../types';

export default function DietLogger({ session }: { session: Session }) {
  const [waterIntake, setWaterIntake] = useState<WaterIntake[]>([]);
  const [dietLogs, setDietLogs] = useState<DietLog[]>([]);
  const [waterAmount, setWaterAmount] = useState(250);
  const [newMeal, setNewMeal] = useState({
    meal_name: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0
  });

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: waterData } = await supabase
      .from('water_intake')
      .select('*')
      .eq('date', today);
    
    const { data: dietData } = await supabase
      .from('diet_logs')
      .select('*')
      .eq('date', today);

    if (waterData) setWaterIntake(waterData);
    if (dietData) setDietLogs(dietData);
  };

  const logWater = async () => {
    const { error } = await supabase
      .from('water_intake')
      .insert({
        user_id: session.user.id,
        amount_ml: waterAmount,
        date: format(new Date(), 'yyyy-MM-dd')
      });
    
    if (!error) fetchLogs();
  };

  const logMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('diet_logs')
      .insert({
        user_id: session.user.id,
        ...newMeal,
        date: format(new Date(), 'yyyy-MM-dd')
      });
    
    if (!error) {
      setNewMeal({ meal_name: '', calories: 0, protein: 0, carbs: 0, fats: 0 });
      fetchLogs();
    }
  };

  const totalWater = waterIntake.reduce((acc, curr) => acc + curr.amount_ml, 0);
  const totalCalories = dietLogs.reduce((acc, curr) => acc + (curr.calories || 0), 0);
  const totalProtein = dietLogs.reduce((acc, curr) => acc + (curr.protein || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* Water Tracking */}
      <div className="space-y-8">
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="font-serif italic text-2xl font-bold mb-1">Hydration</h3>
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">Daily Goal: 3000ml</p>
            </div>
            <Droplets className="w-8 h-8 text-blue-500" />
          </div>

          <div className="flex items-end gap-4 mb-8">
            <div className="text-5xl font-serif italic font-bold">{totalWater}</div>
            <div className="font-mono text-sm uppercase opacity-40 mb-2">ml total</div>
          </div>

          <div className="w-full bg-[#E4E3E0] h-4 border border-[#141414] mb-8 overflow-hidden">
            <div 
              className="bg-blue-500 h-full transition-all duration-500" 
              style={{ width: `${Math.min((totalWater / 3000) * 100, 100)}%` }}
            ></div>
          </div>

          <div className="flex gap-4">
            <select 
              value={waterAmount}
              onChange={(e) => setWaterAmount(parseInt(e.target.value))}
              className="flex-1 bg-[#E4E3E0]/30 border border-[#141414] px-4 py-3 font-mono text-xs focus:outline-none"
            >
              <option value={250}>250ml (Glass)</option>
              <option value={500}>500ml (Bottle)</option>
              <option value={750}>750ml (Large Bottle)</option>
              <option value={1000}>1000ml (Liter)</option>
            </select>
            <button 
              onClick={logWater}
              className="bg-[#141414] text-[#E4E3E0] px-8 py-3 font-mono text-[10px] uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] border border-[#141414] transition-all"
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40">Today's Logs</h4>
          {waterIntake.map((log) => (
            <div key={log.id} className="flex justify-between items-center bg-white border border-[#141414] p-4">
              <div className="flex items-center gap-3">
                <Droplets className="w-4 h-4 text-blue-400" />
                <span className="font-bold">{log.amount_ml}ml</span>
              </div>
              <span className="font-mono text-[9px] uppercase opacity-40">
                {format(new Date(), 'HH:mm')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Diet Tracking */}
      <div className="space-y-8">
        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="flex justify-between items-start mb-8">
            <div>
              <h3 className="font-serif italic text-2xl font-bold mb-1">Nutrition</h3>
              <p className="font-mono text-[10px] uppercase tracking-widest opacity-50">Fuel your performance</p>
            </div>
            <Utensils className="w-8 h-8 text-emerald-500" />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-[#141414] text-[#E4E3E0] p-4">
              <p className="font-mono text-[9px] uppercase opacity-60 mb-1">Calories</p>
              <p className="text-2xl font-serif italic font-bold">{totalCalories} <span className="text-[10px] font-mono uppercase opacity-40">kcal</span></p>
            </div>
            <div className="bg-[#141414] text-[#E4E3E0] p-4">
              <p className="font-mono text-[9px] uppercase opacity-60 mb-1">Protein</p>
              <p className="text-2xl font-serif italic font-bold">{totalProtein} <span className="text-[10px] font-mono uppercase opacity-40">g</span></p>
            </div>
          </div>

          <form onSubmit={logMeal} className="space-y-4">
            <input 
              type="text" 
              placeholder="Meal Name (e.g. Chicken & Rice)"
              required
              value={newMeal.meal_name}
              onChange={(e) => setNewMeal({...newMeal, meal_name: e.target.value})}
              className="w-full bg-[#E4E3E0]/30 border border-[#141414] px-4 py-3 font-mono text-xs focus:outline-none"
            />
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="number" 
                placeholder="Calories"
                value={newMeal.calories || ''}
                onChange={(e) => setNewMeal({...newMeal, calories: parseInt(e.target.value)})}
                className="bg-[#E4E3E0]/30 border border-[#141414] px-4 py-3 font-mono text-xs focus:outline-none"
              />
              <input 
                type="number" 
                placeholder="Protein (g)"
                value={newMeal.protein || ''}
                onChange={(e) => setNewMeal({...newMeal, protein: parseInt(e.target.value)})}
                className="bg-[#E4E3E0]/30 border border-[#141414] px-4 py-3 font-mono text-xs focus:outline-none"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-[#141414] text-[#E4E3E0] py-4 font-mono text-[10px] uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] border border-[#141414] transition-all"
            >
              Log Meal
            </button>
          </form>
        </div>

        <div className="space-y-4">
          <h4 className="font-mono text-[10px] uppercase tracking-widest opacity-40">Today's Meals</h4>
          {dietLogs.map((log) => (
            <div key={log.id} className="bg-white border border-[#141414] p-4 group">
              <div className="flex justify-between items-start mb-2">
                <h5 className="font-bold uppercase tracking-tight">{log.meal_name}</h5>
                <span className="font-mono text-[9px] uppercase opacity-40">{log.calories} kcal</span>
              </div>
              <div className="flex gap-4 font-mono text-[9px] uppercase opacity-60">
                <span>P: {log.protein}g</span>
                <span>C: {log.carbs}g</span>
                <span>F: {log.fats}g</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
