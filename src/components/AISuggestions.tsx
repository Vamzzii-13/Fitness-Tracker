import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Sparkles, Brain, ArrowRight, RefreshCw } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

export default function AISuggestions({ session }: { session: Session }) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateSuggestion = async () => {
    setLoading(true);
    try {
      // 1. Fetch user data for context
      const { data: workouts } = await supabase
        .from('workouts')
        .select('*, exercises(*, sets(*))')
        .limit(5);
      
      const { data: diet } = await supabase
        .from('diet_logs')
        .select('*')
        .limit(10);

      const context = {
        workouts: workouts?.map(w => ({
          name: w.name,
          date: w.date,
          exercises: w.exercises.map((e: any) => ({
            name: e.name,
            total_volume: e.sets.reduce((acc: number, s: any) => acc + (s.weight * s.reps), 0)
          }))
        })),
        diet: diet?.map(d => ({
          meal: d.meal_name,
          cals: d.calories,
          protein: d.protein
        }))
      };

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are an elite fitness and nutrition coach. Based on the following user data, provide a concise, motivating, and highly actionable suggestion for their next week of training and diet. Focus on progressive overload and optimal recovery.
        
        User Data: ${JSON.stringify(context)}
        
        Format:
        - Training Tip (1 sentence)
        - Nutrition Adjustment (1 sentence)
        - Motivation Quote (1 short sentence)`,
      });

      setSuggestion(response.text || "Keep pushing your limits. Consistency is key.");
    } catch (err) {
      console.error(err);
      setSuggestion("Focus on increasing your compound lift volume by 2.5% next week. Ensure you're hitting 1.6g of protein per kg of body weight.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="bg-[#141414] text-[#E4E3E0] p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-10">
          <Brain className="w-64 h-64" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-yellow-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em]">Neural Performance Engine</span>
          </div>
          
          <h3 className="text-5xl font-serif italic font-bold mb-8 leading-tight">
            Get Your Personalized <br /> Performance Strategy.
          </h3>
          
          <p className="font-mono text-xs uppercase tracking-widest opacity-60 mb-12 max-w-lg leading-relaxed">
            Our AI analyzes your workout volume, progressive overload trends, and nutritional intake to forge the perfect path forward.
          </p>

          <button 
            onClick={generateSuggestion}
            disabled={loading}
            className="bg-[#E4E3E0] text-[#141414] px-10 py-5 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-white transition-all flex items-center gap-3 group"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {loading ? 'Analyzing Data...' : 'Generate Strategy'}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {suggestion && (
        <div className="bg-white border-2 border-[#141414] p-10 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {suggestion.split('\n').filter(s => s.trim()).map((part, i) => (
              <div key={i} className="space-y-4">
                <div className="w-8 h-8 bg-[#141414] text-[#E4E3E0] flex items-center justify-center font-mono text-xs">
                  0{i + 1}
                </div>
                <p className="font-serif italic text-lg leading-relaxed">
                  {part.replace(/^- /, '')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
