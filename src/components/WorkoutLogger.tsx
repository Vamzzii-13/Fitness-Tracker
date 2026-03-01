import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';
import { Plus, Trash2, Save, Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import { Workout, Exercise, WorkoutSet } from '../types';
import { format } from 'date-fns';

export default function WorkoutLogger({ session }: { session: Session }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newWorkout, setNewWorkout] = useState({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    exercises: [] as any[]
  });

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select(`
        *,
        exercises (
          *,
          sets (*)
        )
      `)
      .order('date', { ascending: false });
    
    if (data) setWorkouts(data);
  };

  const addExercise = () => {
    setNewWorkout({
      ...newWorkout,
      exercises: [
        ...newWorkout.exercises,
        { name: '', sets: [{ reps: 0, weight: 0 }] }
      ]
    });
  };

  const addSet = (exerciseIndex: number) => {
    const updatedExercises = [...newWorkout.exercises];
    updatedExercises[exerciseIndex].sets.push({ reps: 0, weight: 0 });
    setNewWorkout({ ...newWorkout, exercises: updatedExercises });
  };

  const handleSaveWorkout = async () => {
    try {
      // 1. Save Workout
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          user_id: session.user.id,
          name: newWorkout.name || 'Untitled Workout',
          date: newWorkout.date
        })
        .select()
        .single();

      if (workoutError) throw workoutError;

      // 2. Save Exercises & Sets
      for (const ex of newWorkout.exercises) {
        const { data: exData, error: exError } = await supabase
          .from('exercises')
          .insert({
            workout_id: workoutData.id,
            name: ex.name
          })
          .select()
          .single();

        if (exError) throw exError;

        const setsToInsert = ex.sets.map((s: any, i: number) => ({
          exercise_id: exData.id,
          reps: s.reps,
          weight: s.weight,
          set_order: i + 1
        }));

        const { error: setsError } = await supabase
          .from('sets')
          .insert(setsToInsert);

        if (setsError) throw setsError;
      }

      setIsAdding(false);
      setNewWorkout({ name: '', date: format(new Date(), 'yyyy-MM-dd'), exercises: [] });
      fetchWorkouts();
    } catch (err) {
      console.error(err);
      alert('Error saving workout');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="font-serif italic text-2xl font-bold">Workout History</h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-[#141414] text-[#E4E3E0] px-6 py-3 font-mono text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#E4E3E0] hover:text-[#141414] border border-[#141414] transition-all"
        >
          <Plus className="w-4 h-4" />
          Log New Workout
        </button>
      </div>

      {isAdding && (
        <div className="bg-white border border-[#141414] p-8 space-y-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Workout Name</label>
              <input 
                type="text" 
                placeholder="Push Day, Leg Day..."
                value={newWorkout.name}
                onChange={(e) => setNewWorkout({...newWorkout, name: e.target.value})}
                className="w-full border-b border-[#141414] py-2 font-serif italic text-xl focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Date</label>
              <input 
                type="date" 
                value={newWorkout.date}
                onChange={(e) => setNewWorkout({...newWorkout, date: e.target.value})}
                className="w-full border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-8">
            {newWorkout.exercises.map((ex, exIdx) => (
              <div key={exIdx} className="bg-[#E4E3E0]/30 p-6 border border-[#141414]/10">
                <div className="flex justify-between items-center mb-4">
                  <input 
                    type="text" 
                    placeholder="Exercise Name (e.g. Bench Press)"
                    value={ex.name}
                    onChange={(e) => {
                      const updated = [...newWorkout.exercises];
                      updated[exIdx].name = e.target.value;
                      setNewWorkout({...newWorkout, exercises: updated});
                    }}
                    className="bg-transparent border-b border-[#141414] py-1 font-bold uppercase tracking-tight focus:outline-none"
                  />
                  <button 
                    onClick={() => {
                      const updated = [...newWorkout.exercises];
                      updated.splice(exIdx, 1);
                      setNewWorkout({...newWorkout, exercises: updated});
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-4 gap-4 font-mono text-[9px] uppercase opacity-40 mb-2">
                    <span>Set</span>
                    <span>Weight (kg)</span>
                    <span>Reps</span>
                    <span></span>
                  </div>
                  {ex.sets.map((set: any, setIdx: number) => (
                    <div key={setIdx} className="grid grid-cols-4 gap-4 items-center">
                      <span className="font-mono text-xs">{setIdx + 1}</span>
                      <input 
                        type="number" 
                        value={set.weight}
                        onChange={(e) => {
                          const updated = [...newWorkout.exercises];
                          updated[exIdx].sets[setIdx].weight = parseFloat(e.target.value);
                          setNewWorkout({...newWorkout, exercises: updated});
                        }}
                        className="bg-white border border-[#141414] p-2 font-mono text-xs focus:outline-none"
                      />
                      <input 
                        type="number" 
                        value={set.reps}
                        onChange={(e) => {
                          const updated = [...newWorkout.exercises];
                          updated[exIdx].sets[setIdx].reps = parseInt(e.target.value);
                          setNewWorkout({...newWorkout, exercises: updated});
                        }}
                        className="bg-white border border-[#141414] p-2 font-mono text-xs focus:outline-none"
                      />
                      <button 
                        onClick={() => {
                          const updated = [...newWorkout.exercises];
                          updated[exIdx].sets.splice(setIdx, 1);
                          setNewWorkout({...newWorkout, exercises: updated});
                        }}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => addSet(exIdx)}
                    className="w-full py-2 border border-dashed border-[#141414]/30 font-mono text-[9px] uppercase hover:bg-[#141414]/5 transition-colors mt-2"
                  >
                    + Add Set
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4 pt-6">
            <button 
              onClick={addExercise}
              className="flex-1 py-4 border border-[#141414] font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414]/5 transition-all"
            >
              + Add Exercise
            </button>
            <button 
              onClick={handleSaveWorkout}
              className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414]/90 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Workout
            </button>
            <button 
              onClick={() => setIsAdding(false)}
              className="px-8 py-4 border border-red-500 text-red-500 font-mono text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {workouts.map((workout) => (
          <div key={workout.id} className="bg-white border border-[#141414] overflow-hidden group">
            <div className="p-6 flex justify-between items-center bg-[#141414]/5 group-hover:bg-[#141414] group-hover:text-[#E4E3E0] transition-all">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest opacity-60 mb-1">{format(new Date(workout.date), 'MMMM do, yyyy')}</p>
                <h4 className="text-xl font-serif italic font-bold">{workout.name}</h4>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="font-mono text-[9px] uppercase opacity-40">Exercises</p>
                  <p className="font-bold">{workout.exercises?.length || 0}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[9px] uppercase opacity-40">Total Volume</p>
                  <p className="font-bold">
                    {workout.exercises?.reduce((acc, ex) => 
                      acc + (ex.sets?.reduce((sAcc, s) => sAcc + (s.weight * s.reps), 0) || 0)
                    , 0).toLocaleString()} kg
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workout.exercises?.map((ex) => (
                <div key={ex.id} className="space-y-2">
                  <h5 className="font-bold uppercase tracking-tight text-xs border-b border-[#E4E3E0] pb-1">{ex.name}</h5>
                  <div className="space-y-1">
                    {ex.sets?.map((set, i) => (
                      <div key={set.id} className="flex justify-between font-mono text-[10px] opacity-60">
                        <span>Set {i + 1}</span>
                        <span>{set.weight}kg x {set.reps}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {workouts.length === 0 && !isAdding && (
          <div className="py-20 text-center border-2 border-dashed border-[#141414]/20">
            <Dumbbell className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-40">No workouts logged yet. Start your journey.</p>
          </div>
        )}
      </div>
    </div>
  );
}
