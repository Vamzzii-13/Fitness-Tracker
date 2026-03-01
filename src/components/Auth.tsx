import React, { useState } from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Activity, Mail, Lock, User, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Update profile
        await updateProfile(user, { displayName: username });
        
        // Create user document in Firestore
        await setDoc(doc(db, 'profiles', user.uid), {
          uid: user.uid,
          username,
          email,
          createdAt: new Date().toISOString()
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if profile exists, if not create it
      const profileRef = doc(db, 'profiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      
      if (!profileSnap.exists()) {
        await setDoc(profileRef, {
          uid: user.uid,
          username: user.displayName || user.email?.split('@')[0] || 'Athlete',
          email: user.email,
          avatar_url: user.photoURL,
          createdAt: new Date().toISOString()
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border-2 border-[#141414] p-10 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="bg-[#141414] p-3 rounded-sm mb-4">
            <Activity className="w-8 h-8 text-[#E4E3E0]" />
          </div>
          <h1 className="text-3xl font-serif italic font-bold uppercase tracking-tighter">ForgeTrack</h1>
          <p className="font-mono text-[10px] uppercase tracking-widest opacity-50 mt-2">
            {isSignUp ? 'Create your athlete profile' : 'Welcome back, athlete'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          {isSignUp && (
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#E4E3E0]/30 border border-[#141414] px-10 py-3 font-mono text-sm focus:outline-none focus:bg-white transition-colors"
                  placeholder="IRON_LIFT_99"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#E4E3E0]/30 border border-[#141414] px-10 py-3 font-mono text-sm focus:outline-none focus:bg-white transition-colors"
                placeholder="athlete@forgetrack.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-widest opacity-60">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#E4E3E0]/30 border border-[#141414] px-10 py-3 font-mono text-sm focus:outline-none focus:bg-white transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 p-4 border border-red-200">
              <p className="font-mono text-[10px] text-red-500 uppercase tracking-tight font-bold">
                Error: {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#141414] text-[#E4E3E0] py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-[#E4E3E0] hover:text-[#141414] border border-[#141414] transition-all flex items-center justify-center gap-2 group"
          >
            {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#E4E3E0]"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono">
              <span className="bg-white px-4 text-[#141414]/40">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white text-[#141414] py-4 font-mono text-xs uppercase tracking-[0.2em] font-bold hover:bg-[#141414] hover:text-[#E4E3E0] border border-[#141414] transition-all flex items-center justify-center gap-2 group"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-[#E4E3E0] text-center">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="font-mono text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </motion.div>

      <div className="mt-12 max-w-2xl text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] opacity-30 mb-4">Firebase Setup Required</p>
        <div className="bg-[#141414] text-[#E4E3E0] p-6 rounded-sm text-left">
          <p className="text-xs font-mono opacity-80 mb-4">
            1. Create a Firebase project at console.firebase.google.com<br/>
            2. Enable Authentication (Email/Password & Google)<br/>
            3. Enable Firestore Database<br/>
            4. Add your Firebase config to .env
          </p>
        </div>
      </div>
    </div>
  );
}
