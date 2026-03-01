import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Plus, Trash2, Save, Dumbbell, Clock, Flame, ChevronRight, ChevronLeft, Trophy } from 'lucide-react';
import { format, getDay, addDays, startOfWeek } from 'date-fns';
import { collection, addDoc, query, where, getDocs, doc, writeBatch, deleteDoc, updateDoc, orderBy } from 'firebase/firestore';

const WORKOUT_SCHEDULE = [
  { id: 'chest_tricep', name: 'Chest and Tricep', exercises: ['Bench Press', 'Incline DB Press', 'Tricep Pushdowns', 'Skullcrushers', 'Dips'] },
  { id: 'back_bicep', name: 'Back and Bicep', exercises: ['Deadlift', 'Pull Ups', 'Barbell Rows', 'Hammer Curls', 'Lat Pulldowns'] },
  { id: 'shoulder_traps', name: 'Shoulder and Traps', exercises: ['Overhead Press', 'Lateral Raises', 'Face Pulls', 'Shrugs', 'Arnold Press'] },
  { id: 'abs_legs', name: 'Abs and Legs', exercises: ['Squats', 'Leg Press', 'Leg Curls', 'Plank', 'Hanging Leg Raises'] },
  { id: 'treadmill', name: 'Treadmill Cardio', exercises: ['Treadmill Run'] },
];

export default function WorkoutLogger({ user }: { user: User }) {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [prs, setPrs] = useState<Record<string, number>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newWorkout, setNewWorkout] = useState({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    duration: 60,
    exercises: [] as any[],
    incline: 0,
    pace: 0
  });

  useEffect(() => {
    fetchWorkouts();
    fetchPRs();
    suggestWorkoutForDate(newWorkout.date);
  }, [user]);

  const fetchPRs = async () => {
    try {
      const workoutsQ = query(
        collection(db, 'workouts'),
        where('user_id', '==', user.uid)
      );
      const workoutsSnap = await getDocs(workoutsQ);
      
      const prMap: Record<string, number> = {};

      for (const workoutDoc of workoutsSnap.docs) {
        const exercisesQ = query(collection(db, 'exercises'), where('workout_id', '==', workoutDoc.id));
        const exercisesSnap = await getDocs(exercisesQ);

        for (const exerciseDoc of exercisesSnap.docs) {
          const exerciseName = exerciseDoc.data().name.trim().toLowerCase();
          const setsQ = query(collection(db, 'sets'), where('exercise_id', '==', exerciseDoc.id));
          const setsSnap = await getDocs(setsQ);

          setsSnap.docs.forEach(setDoc => {
            const weight = setDoc.data().weight || 0;
            if (!prMap[exerciseName] || weight > prMap[exerciseName]) {
              prMap[exerciseName] = weight;
            }
          });
        }
      }
      setPrs(prMap);
    } catch (error) {
      console.error("Error fetching PRs:", error);
    }
  };

  const UNIQUE_WORKOUT_TYPES = Array.from(new Set(WORKOUT_SCHEDULE.map(s => s.name)));

  const handleWorkoutTypeChange = (typeName: string) => {
    const scheduleEntry = WORKOUT_SCHEDULE.find(s => s.name === typeName);
    if (scheduleEntry) {
      setNewWorkout(prev => ({
        ...prev,
        name: typeName,
        exercises: scheduleEntry.exercises.map(ex => ({
          name: ex,
          notes: '',
          sets: [{ reps: 10, weight: 20 }]
        }))
      }));
    } else {
      setNewWorkout(prev => ({ ...prev, name: typeName }));
    }
  };

  const suggestWorkoutForDate = (dateStr: string) => {
    const date = new Date(dateStr);
    let dayNum = getDay(date);
    if (dayNum === 0) dayNum = 7; 
    
    let typeToSuggest = '';
    if (dayNum === 1 || dayNum === 4) typeToSuggest = 'Chest and Tricep';
    else if (dayNum === 2 || dayNum === 5) typeToSuggest = 'Back and Bicep';
    else if (dayNum === 3 || dayNum === 6) typeToSuggest = 'Shoulder and Traps';
    else if (dayNum === 7) typeToSuggest = 'Abs and Legs';

    if (typeToSuggest) {
      handleWorkoutTypeChange(typeToSuggest);
    }
  };

  const fetchWorkouts = async () => {
    const q = query(
      collection(db, 'workouts'),
      where('user_id', '==', user.uid)
    );
    
    const snap = await getDocs(q);
    const sortedDocs = [...snap.docs].sort((a, b) => b.data().date.localeCompare(a.data().date));
    
    const workoutsData = await Promise.all(sortedDocs.map(async (workoutDoc) => {
      const exQuery = query(collection(db, 'exercises'), where('workout_id', '==', workoutDoc.id));
      const exSnap = await getDocs(exQuery);
      
      const exercises = await Promise.all(exSnap.docs.map(async (exDoc) => {
        const setQuery = query(collection(db, 'sets'), where('exercise_id', '==', exDoc.id));
        const setSnap = await getDocs(setQuery);
        const sortedSets = [...setSnap.docs].sort((a, b) => (a.data().set_order || 0) - (b.data().set_order || 0));
        return {
          id: exDoc.id,
          ...exDoc.data(),
          sets: sortedSets.map(d => ({ id: d.id, ...d.data() }))
        };
      }));

      return {
        id: workoutDoc.id,
        ...workoutDoc.data(),
        exercises
      };
    }));

    setWorkouts(workoutsData);
  };

  const calculateCalories = (workout: any) => {
    if (workout.name === 'Treadmill Cardio') {
      // Cardio formula: duration * pace * (1 + incline/100) * factor
      const pace = workout.pace || 5;
      const incline = workout.incline || 0;
      const duration = workout.duration || 30;
      // Rough estimate: 0.1 kcal per kg per minute at 5km/h. 
      // We'll use a simplified version: duration * pace * (1 + incline * 0.1)
      return Math.round(duration * pace * (1 + incline * 0.05));
    }
    // Strength formula: volume * 0.02 + duration * 4
    const volume = workout.exercises.reduce((acc: number, ex: any) => 
      acc + ex.sets.reduce((sAcc: number, s: any) => sAcc + (s.weight * s.reps), 0), 0);
    return Math.round(volume * 0.02 + (workout.duration || 60) * 4);
  };

  const handleSaveWorkout = async () => {
    try {
      const batch = writeBatch(db);
      const calories = calculateCalories(newWorkout);
      
      let workoutRef;
      if (editingId) {
        workoutRef = doc(db, 'workouts', editingId);
        // For simplicity in this demo, we delete old exercises/sets and re-add
        // In a real app, you'd diff them
      } else {
        workoutRef = doc(collection(db, 'workouts'));
      }

      batch.set(workoutRef, {
        user_id: user.uid,
        name: newWorkout.name || 'Untitled Workout',
        date: newWorkout.date,
        duration: newWorkout.duration,
        calories_burnt: calories,
        incline: newWorkout.name === 'Treadmill Cardio' ? newWorkout.incline : null,
        pace: newWorkout.name === 'Treadmill Cardio' ? newWorkout.pace : null,
        created_at: new Date().toISOString()
      });

      // Clear existing exercises if editing
      if (editingId) {
        const exQ = query(collection(db, 'exercises'), where('workout_id', '==', editingId));
        const exSnap = await getDocs(exQ);
        for (const exDoc of exSnap.docs) {
          const setQ = query(collection(db, 'sets'), where('exercise_id', '==', exDoc.id));
          const setSnap = await getDocs(setQ);
          setSnap.docs.forEach(s => batch.delete(s.ref));
          batch.delete(exDoc.ref);
        }
      }

      for (const ex of newWorkout.exercises) {
        const exRef = doc(collection(db, 'exercises'));
        batch.set(exRef, {
          workout_id: workoutRef.id,
          name: ex.name,
          notes: ex.notes || ''
        });

        for (let i = 0; i < ex.sets.length; i++) {
          const setRef = doc(collection(db, 'sets'));
          batch.set(setRef, {
            exercise_id: exRef.id,
            reps: ex.sets[i].reps,
            weight: ex.sets[i].weight,
            set_order: i + 1
          });
        }
      }

      await batch.commit();
      setIsAdding(false);
      setEditingId(null);
      setNewWorkout({ name: '', date: format(new Date(), 'yyyy-MM-dd'), duration: 60, exercises: [], incline: 0, pace: 0 });
      fetchWorkouts();
    } catch (err) {
      console.error(err);
      alert('Error saving workout');
    }
  };

  const handleDeleteWorkout = async (id: string) => {
    if (!confirm('Delete this workout?')) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'workouts', id));
      
      const exQ = query(collection(db, 'exercises'), where('workout_id', '==', id));
      const exSnap = await getDocs(exQ);
      for (const exDoc of exSnap.docs) {
        const setQ = query(collection(db, 'sets'), where('exercise_id', '==', exDoc.id));
        const setSnap = await getDocs(setQ);
        setSnap.docs.forEach(s => batch.delete(s.ref));
        batch.delete(exDoc.ref);
      }
      
      await batch.commit();
      fetchWorkouts();
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (workout: any) => {
    setEditingId(workout.id);
    setNewWorkout({
      name: workout.name,
      date: workout.date,
      duration: workout.duration || 60,
      incline: workout.incline || 0,
      pace: workout.pace || 0,
      exercises: workout.exercises.map((ex: any) => ({
        name: ex.name,
        notes: ex.notes || '',
        sets: ex.sets.map((s: any) => ({ reps: s.reps, weight: s.weight }))
      }))
    });
    setIsAdding(true);
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
        <div className="bg-white border border-[#141414] p-4 md:p-8 space-y-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Workout Type</label>
              <select 
                value={newWorkout.name}
                onChange={(e) => handleWorkoutTypeChange(e.target.value)}
                className="w-full border-b border-[#141414] py-2 font-serif italic text-xl focus:outline-none bg-transparent appearance-none cursor-pointer"
              >
                <option value="" disabled>Select Workout...</option>
                {UNIQUE_WORKOUT_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
                <option value="Custom">Custom Workout</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Date</label>
              <input 
                type="date" 
                value={newWorkout.date}
                onChange={(e) => {
                  setNewWorkout({...newWorkout, date: e.target.value});
                  suggestWorkoutForDate(e.target.value);
                }}
                className="w-full border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Duration (min)</label>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 opacity-40" />
                <input 
                  type="number" 
                  value={newWorkout.duration}
                  onChange={(e) => setNewWorkout({...newWorkout, duration: parseInt(e.target.value)})}
                  className="w-full border-b border-[#141414] py-2 font-mono text-sm focus:outline-none"
                />
              </div>
            </div>
          </div>

          {newWorkout.name === 'Treadmill Cardio' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#141414]/5 p-6 border border-[#141414]/10">
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Incline (Angle %)</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={newWorkout.incline}
                  onChange={(e) => setNewWorkout({...newWorkout, incline: parseFloat(e.target.value)})}
                  className="w-full border-b border-[#141414] py-2 font-mono text-sm focus:outline-none bg-transparent"
                  placeholder="e.g. 2.5"
                />
              </div>
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Pace (km/h)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={newWorkout.pace}
                  onChange={(e) => setNewWorkout({...newWorkout, pace: parseFloat(e.target.value)})}
                  className="w-full border-b border-[#141414] py-2 font-mono text-sm focus:outline-none bg-transparent"
                  placeholder="e.g. 8.5"
                />
              </div>
            </div>
          )}

          {newWorkout.name !== 'Treadmill Cardio' && (
            <div className="space-y-6">
              {newWorkout.exercises.map((ex, exIdx) => (
                <div key={exIdx} className="bg-[#E4E3E0]/30 p-4 md:p-6 border border-[#141414]/10">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                      <input 
                        type="text" 
                        placeholder="Exercise Name"
                        value={ex.name}
                        onChange={(e) => {
                          const updated = [...newWorkout.exercises];
                          updated[exIdx].name = e.target.value;
                          setNewWorkout({...newWorkout, exercises: updated});
                        }}
                        className="bg-transparent border-b border-[#141414] py-1 font-bold uppercase tracking-tight focus:outline-none flex-1 mr-4"
                      />
                      <input 
                        type="text" 
                        placeholder="Add notes..."
                        value={ex.notes}
                        onChange={(e) => {
                          const updated = [...newWorkout.exercises];
                          updated[exIdx].notes = e.target.value;
                          setNewWorkout({...newWorkout, exercises: updated});
                        }}
                        className="bg-transparent border-b border-[#141414]/20 py-1 font-mono text-[9px] uppercase tracking-widest focus:outline-none flex-1 mr-4 opacity-60 focus:opacity-100"
                      />
                      {prs[ex.name.trim().toLowerCase()] && (
                        <div className="flex items-center gap-2 bg-[#141414] text-[#E4E3E0] px-3 py-1 font-mono text-[9px] uppercase tracking-widest whitespace-nowrap">
                          <Trophy className="w-3 h-3" />
                          <span>PR: {prs[ex.name.trim().toLowerCase()]}kg</span>
                        </div>
                      )}
                      <button 
                        onClick={() => {
                          const updated = [...newWorkout.exercises];
                          updated.splice(exIdx, 1);
                          setNewWorkout({...newWorkout, exercises: updated});
                        }}
                        className="text-red-500 hover:text-red-700 ml-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-4 gap-2 font-mono text-[8px] md:text-[9px] uppercase opacity-40 mb-2">
                      <span>Set</span>
                      <span>Weight</span>
                      <span>Reps</span>
                      <span></span>
                    </div>
                    {ex.sets.map((set: any, setIdx: number) => (
                      <div key={setIdx} className="grid grid-cols-4 gap-2 items-center">
                        <span className="font-mono text-xs">{setIdx + 1}</span>
                        <input 
                          type="number" 
                          value={set.weight}
                          onChange={(e) => {
                            const updated = [...newWorkout.exercises];
                            updated[exIdx].sets[setIdx].weight = parseFloat(e.target.value);
                            setNewWorkout({...newWorkout, exercises: updated});
                          }}
                          className={`bg-white border border-[#141414] p-2 font-mono text-xs focus:outline-none w-full ${
                            set.weight > (prs[ex.name.trim().toLowerCase()] || 0) ? 'bg-yellow-50 border-yellow-500' : ''
                          }`}
                        />
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            value={set.reps}
                            onChange={(e) => {
                              const updated = [...newWorkout.exercises];
                              updated[exIdx].sets[setIdx].reps = parseInt(e.target.value);
                              setNewWorkout({...newWorkout, exercises: updated});
                            }}
                            className="bg-white border border-[#141414] p-2 font-mono text-xs focus:outline-none w-full"
                          />
                          {set.weight > (prs[ex.name.trim().toLowerCase()] || 0) && set.weight > 0 && (
                            <span className="text-[8px] font-bold text-yellow-600 uppercase animate-pulse">PR!</span>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            const updated = [...newWorkout.exercises];
                            updated[exIdx].sets.splice(setIdx, 1);
                            setNewWorkout({...newWorkout, exercises: updated});
                          }}
                          className="text-red-400 hover:text-red-600 flex justify-center"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button 
                      onClick={() => {
                        const updated = [...newWorkout.exercises];
                        const lastSet = updated[exIdx].sets[updated[exIdx].sets.length - 1] || { reps: 10, weight: 20 };
                        updated[exIdx].sets.push({ ...lastSet });
                        setNewWorkout({ ...newWorkout, exercises: updated });
                      }}
                      className="w-full py-2 border border-dashed border-[#141414]/30 font-mono text-[9px] uppercase hover:bg-[#141414]/5 transition-colors mt-2"
                    >
                      + Add Set
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-4 pt-6">
            {newWorkout.name !== 'Treadmill Cardio' && (
              <button 
                onClick={() => {
                  setNewWorkout({
                    ...newWorkout,
                    exercises: [...newWorkout.exercises, { name: '', notes: '', sets: [{ reps: 10, weight: 20 }] }]
                  });
                }}
                className="flex-1 py-4 border border-[#141414] font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414]/5 transition-all"
              >
                + Add Exercise
              </button>
            )}
            <button 
              onClick={handleSaveWorkout}
              className="flex-1 bg-[#141414] text-[#E4E3E0] py-4 font-mono text-[10px] uppercase tracking-widest hover:bg-[#141414]/90 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {editingId ? 'Update Workout' : 'Save Workout'}
            </button>
            <button 
              onClick={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
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
            <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between md:items-center bg-[#141414]/5 group-hover:bg-[#141414] group-hover:text-[#E4E3E0] transition-all gap-4">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-widest opacity-60 mb-1">{format(new Date(workout.date), 'MMMM do, yyyy')}</p>
                <h4 className="text-xl font-serif italic font-bold">{workout.name}</h4>
                {workout.name === 'Treadmill Cardio' && (
                  <div className="flex gap-4 mt-2 font-mono text-[10px] uppercase opacity-60">
                    <span>Incline: {workout.incline}%</span>
                    <span>Pace: {workout.pace} km/h</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between md:justify-end gap-4 md:gap-8">
                <div className="text-center md:text-right">
                  <p className="font-mono text-[9px] uppercase opacity-40">Burned</p>
                  <div className="flex items-center gap-1 font-bold">
                    <Flame className="w-3 h-3 text-orange-500" />
                    <span>{workout.calories_burnt || 0} kcal</span>
                  </div>
                </div>
                <div className="text-center md:text-right">
                  <p className="font-mono text-[9px] uppercase opacity-40">Duration</p>
                  <div className="flex items-center gap-1 font-bold">
                    <Clock className="w-3 h-3" />
                    <span>{workout.duration || 60}m</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => startEdit(workout)}
                    className="p-2 border border-[#141414] hover:bg-white hover:text-[#141414] transition-colors"
                  >
                    <Plus className="w-3 h-3 rotate-45" />
                  </button>
                  <button 
                    onClick={() => handleDeleteWorkout(workout.id)}
                    className="p-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {workout.exercises?.map((ex: any) => (
                <div key={ex.id} className="space-y-2">
                  <div className="flex justify-between items-center border-b border-[#E4E3E0] pb-1">
                    <div className="flex flex-col">
                      <h5 className="font-bold uppercase tracking-tight text-xs">{ex.name}</h5>
                      {ex.notes && (
                        <p className="font-mono text-[8px] uppercase opacity-40 italic mt-0.5">
                          Note: {ex.notes}
                        </p>
                      )}
                    </div>
                    {prs[ex.name.trim().toLowerCase()] && (
                      <div className="flex items-center gap-1 font-mono text-[8px] uppercase opacity-40">
                        <Trophy className="w-2 h-2" />
                        <span>Best: {prs[ex.name.trim().toLowerCase()]}kg</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {ex.sets?.map((set: any, i: number) => {
                      const isPR = set.weight >= (prs[ex.name.trim().toLowerCase()] || 0) && set.weight > 0;
                      return (
                        <div key={set.id} className={`flex justify-between font-mono text-[10px] ${isPR ? 'text-[#141414] font-bold' : 'opacity-60'}`}>
                          <div className="flex items-center gap-1">
                            <span>Set {i + 1}</span>
                            {isPR && <Trophy className="w-2 h-2 text-yellow-600" />}
                          </div>
                          <span>{set.weight}kg x {set.reps}</span>
                        </div>
                      );
                    })}
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
