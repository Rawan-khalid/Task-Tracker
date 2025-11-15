import React, { useState } from 'react';
import { supabase } from '../supabaseClient';

type AuthView = 'signIn' | 'signUp' | 'forgotPassword';

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [view, setView] = useState<AuthView>('signIn');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (view === 'signUp') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
        if (error) throw error;
        setMessage('Sign up successful! Please check your email for a confirmation link.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      let errorMessage = 'An unknown error occurred. Please try again.';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String((err as { message: unknown }).message);
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePasswordReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage('Password reset instructions have been sent to your email.');
    } catch (err) {
      let errorMessage = 'Failed to send password reset email.';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err && typeof err === 'object' && 'message' in err) {
        errorMessage = String((err as { message: unknown }).message);
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const switchView = (newView: AuthView) => {
    setView(newView);
    setError(null);
    setMessage(null);
    setName('');
    // No need to clear email/password as they might be useful
  }

  const renderMessages = () => (
    <>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative animate-fade-in" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}
      {message && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative animate-fade-in" role="alert">
          <span className="block sm:inline">{message}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="flex justify-center items-center h-full">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-lg shadow-md">
        {view === 'signIn' && (
          <>
            <div>
              <h1 className="text-3xl font-bold text-center text-slate-800">Welcome Back</h1>
              <p className="text-center text-slate-500 mt-2">Sign in to continue.</p>
            </div>
            {renderMessages()}
            <form className="space-y-4" onSubmit={handleAuth}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" required className="mt-1 w-full px-3 py-2 border border-slate-600 bg-slate-800 text-white placeholder-slate-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                <input id="password" name="password" type="password" autoComplete="current-password" required className="mt-1 w-full px-3 py-2 border border-slate-600 bg-slate-800 text-white placeholder-slate-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="flex items-center justify-end">
                <button type="button" onClick={() => switchView('forgotPassword')} className="text-sm font-medium text-blue-600 hover:text-blue-500">Forgot your password?</button>
              </div>
              <div>
                <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{loading ? 'Signing In...' : 'Sign In'}</button>
              </div>
            </form>
            <p className="text-sm text-center text-slate-500">Don't have an account? <button onClick={() => switchView('signUp')} className="font-medium text-blue-600 hover:text-blue-500">Sign Up</button></p>
          </>
        )}

        {view === 'signUp' && (
          <>
            <div>
              <h1 className="text-3xl font-bold text-center text-slate-800">Create an Account</h1>
              <p className="text-center text-slate-500 mt-2">Get started with your own task board.</p>
            </div>
            {renderMessages()}
            <form className="space-y-4" onSubmit={handleAuth}>
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700">Full Name</label>
                <input id="name" name="name" type="text" autoComplete="name" required className="mt-1 w-full px-3 py-2 border border-slate-600 bg-slate-800 text-white placeholder-slate-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" required className="mt-1 w-full px-3 py-2 border border-slate-600 bg-slate-800 text-white placeholder-slate-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                <input id="password" name="password" type="password" autoComplete="new-password" required className="mt-1 w-full px-3 py-2 border border-slate-600 bg-slate-800 text-white placeholder-slate-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{loading ? 'Creating Account...' : 'Sign Up'}</button>
              </div>
            </form>
            <p className="text-sm text-center text-slate-500">Already have an account? <button onClick={() => switchView('signIn')} className="font-medium text-blue-600 hover:text-blue-500">Sign In</button></p>
          </>
        )}

        {view === 'forgotPassword' && (
          <>
            <div>
              <h1 className="text-3xl font-bold text-center text-slate-800">Reset Password</h1>
              <p className="text-center text-slate-500 mt-2">Enter your email to receive reset instructions.</p>
            </div>
            {renderMessages()}
            <form className="space-y-4" onSubmit={handlePasswordReset}>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" required className="mt-1 w-full px-3 py-2 border border-slate-600 bg-slate-800 text-white placeholder-slate-400 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
              </div>
              <div>
                <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">{loading ? 'Sending...' : 'Send Instructions'}</button>
              </div>
            </form>
            <p className="text-sm text-center text-slate-500">Remember your password? <button onClick={() => switchView('signIn')} className="font-medium text-blue-600 hover:text-blue-500">Sign In</button></p>
          </>
        )}
      </div>
    </div>
  );
};