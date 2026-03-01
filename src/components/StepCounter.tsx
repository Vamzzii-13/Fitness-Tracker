import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { User } from 'firebase/auth';
import { Footprints, AlertCircle, CheckCircle2 } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, limit } from 'firebase/firestore';
import { format } from 'date-fns';

export default function StepCounter({ user }: { user: User }) {
  const [steps, setSteps] = useState(0);
  const [permissionStatus, setPermissionStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [isTracking, setIsTracking] = useState(false);
  const lastUpdate = useRef<number>(0);
  const accelData = useRef<{ x: number, y: number, z: number }[]>([]);
  const stepCountRef = useRef(0);
  const lastStepTime = useRef(0);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchTodaySteps();
  }, [user]);

  const fetchTodaySteps = async () => {
    const q = query(
      collection(db, 'steps'),
      where('user_id', '==', user.uid),
      where('date', '==', today),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const data = snap.docs[0].data();
      setSteps(data.count);
      stepCountRef.current = data.count;
    }
  };

  const saveSteps = async (newCount: number) => {
    const q = query(
      collection(db, 'steps'),
      where('user_id', '==', user.uid),
      where('date', '==', today),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(db, 'steps'), {
        user_id: user.uid,
        date: today,
        count: newCount,
        updated_at: new Date().toISOString()
      });
    } else {
      const stepDoc = snap.docs[0];
      await updateDoc(doc(db, 'steps', stepDoc.id), {
        count: newCount,
        updated_at: new Date().toISOString()
      });
    }
  };

  const requestPermission = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const response = await (DeviceMotionEvent as any).requestPermission();
        setPermissionStatus(response);
        if (response === 'granted') {
          startTracking();
        }
      } catch (e) {
        console.error('Permission request failed', e);
        setPermissionStatus('denied');
      }
    } else {
      // Non-iOS or older iOS
      setPermissionStatus('granted');
      startTracking();
    }
  };

  const startTracking = () => {
    if (isTracking) return;
    setIsTracking(true);
    window.addEventListener('devicemotion', handleMotion);
  };

  const stopTracking = () => {
    setIsTracking(false);
    window.removeEventListener('devicemotion', handleMotion);
  };

  const handleMotion = (event: DeviceMotionEvent) => {
    const accel = event.accelerationIncludingGravity;
    if (!accel) return;

    const x = accel.x || 0;
    const y = accel.y || 0;
    const z = accel.z || 0;

    // Magnitude of acceleration
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    
    // Simple step detection: look for peaks above a threshold
    // Threshold of 12 m/s^2 is a common starting point (gravity is ~9.8)
    const threshold = 12.5;
    const now = Date.now();

    if (magnitude > threshold && now - lastStepTime.current > 300) {
      stepCountRef.current += 1;
      lastStepTime.current = now;
      setSteps(stepCountRef.current);
      
      // Save to DB every 10 steps or every 30 seconds
      if (stepCountRef.current % 10 === 0 || now - lastUpdate.current > 30000) {
        saveSteps(stepCountRef.current);
        lastUpdate.current = now;
      }
    }
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, []);

  return (
    <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-[#141414] p-2 rounded-sm">
            <Footprints className="w-5 h-5 text-[#E4E3E0]" />
          </div>
          <h3 className="font-serif italic text-xl font-bold">Step Tracker</h3>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase opacity-40">Today</p>
          <p className="text-2xl font-bold tracking-tighter">{steps.toLocaleString()}</p>
        </div>
      </div>

      {permissionStatus === 'default' && (
        <button
          onClick={requestPermission}
          className="w-full bg-[#141414] text-[#E4E3E0] py-4 font-mono text-xs uppercase tracking-widest hover:bg-[#E4E3E0] hover:text-[#141414] border border-[#141414] transition-all flex items-center justify-center gap-2"
        >
          Enable Step Tracking
        </button>
      )}

      {permissionStatus === 'denied' && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-4 border border-red-200">
          <AlertCircle className="w-4 h-4" />
          <p className="font-mono text-[10px] uppercase">Permission Denied. Enable in settings.</p>
        </div>
      )}

      {permissionStatus === 'granted' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 border border-green-200">
            <CheckCircle2 className="w-4 h-4" />
            <p className="font-mono text-[10px] uppercase">Tracking Active</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#E4E3E0]/20 p-4 border border-[#141414]/10">
              <p className="font-mono text-[9px] uppercase opacity-40">Distance</p>
              <p className="font-bold">{(steps * 0.0007).toFixed(2)} km</p>
            </div>
            <div className="bg-[#E4E3E0]/20 p-4 border border-[#141414]/10">
              <p className="font-mono text-[9px] uppercase opacity-40">Calories</p>
              <p className="font-bold">{(steps * 0.04).toFixed(0)} kcal</p>
            </div>
          </div>

          <button
            onClick={isTracking ? stopTracking : startTracking}
            className={`w-full py-2 font-mono text-[10px] uppercase tracking-widest border border-[#141414] transition-all ${
              isTracking 
                ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            {isTracking ? 'Pause Tracking' : 'Resume Tracking'}
          </button>
        </div>
      )}

      <p className="mt-6 font-mono text-[9px] uppercase opacity-40 leading-relaxed">
        Keep the app open and your phone in your pocket for the most accurate step count.
      </p>
    </div>
  );
}
