import { useState, type FormEvent } from 'react';
import { ArrowRight, Building2, Lock, Mail, Moon, Sun, User } from 'lucide-react';
import { api } from '../lib/api';
import { signInWithGoogle } from '../lib/googleWorkspace';
import type { BotId, UserProfile } from '../shared/types';
import CuteRobotAvatar from './CuteRobotAvatar';
import GoogleSignInButton from './GoogleSignInButton';

interface AuthScreenProps {
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onAuthenticated: (user: UserProfile) => void;
}

export default function AuthScreen({
  theme,
  onToggleTheme,
  onAuthenticated,
}: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await api.login(email, password);
        onAuthenticated(res.user);
      } else {
        const res = await api.register({ name, companyName, email, password });
        onAuthenticated(res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.enterDemo();
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start demo workspace.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const googleAuth = await signInWithGoogle();
      const res = await api.loginWithFirebase(googleAuth.idToken);
      onAuthenticated(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google Sign-In did not complete.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <span className="font-display text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
          ROBOT OFFICE AI
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 max-w-6xl w-full mx-auto px-6 py-10 gap-10 items-center">
        {/* Left Editorial Overview */}
        <section className="lg:col-span-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-sky-200 dark:border-slate-700 bg-[#DDF1FF] flex items-center justify-center shrink-0">
              <img
                src="/assets/aistudio/download_4ef706e2.png"
                alt="Robot Office AI cute assistant mascot"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-mono text-blue-600 dark:text-blue-400 tracking-wide">
                Executive AI Operations Platform
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Interactive 2D Smart Office · 5 Cute AI Specialists
              </p>
            </div>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
            Your Five AI Employees. Your One Smart Office.
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
            Step into your interactive 2D virtual office headquarters as CEO. Delegate tasks to
            Alex, triage P1–P5 mail with Emma, run web-grounded research with Max, protect your
            calendar with Sophie, and ship executive content with Charlie.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {(
              [
                ['alex', 'Alex', 'The Decisive Strategist · Exec Ops', '#2563EB'],
                ['emma', 'Emma', 'The Diplomatic Gatekeeper · Mail', '#7C3AED'],
                ['max', 'Max', 'The Curious Fact-Hunter · Research', '#0EA5E9'],
                ['sophie', 'Sophie', 'The Zen Timekeeper · Calendar', '#EC4899'],
                ['charlie', 'Charlie', 'The Playful Storyteller · Content', '#F59E0B'],
              ] as Array<[BotId, string, string, string]>
            ).map(([botId, botName, role, color]) => (
              <div
                key={botName}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <div className="w-11 h-11 rounded-xl bg-sky-50 dark:bg-slate-800 border border-sky-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                  <CuteRobotAvatar
                    botId={botId}
                    accentHex={color}
                    status="idle"
                    size={38}
                    showShadow={false}
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-display text-sm font-semibold truncate">{botName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Sign-In / Registration Card */}
        <section className="lg:col-span-6">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === 'login'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                CEO Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                  mode === 'register'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Register Company
              </button>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-sm text-red-700 dark:text-red-300"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label
                      htmlFor="ceo-name"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      CEO Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="ceo-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jordan Blake"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="company-name"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Virtual Company Name
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="company-name"
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Apex Ventures AI"
                        className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="ceo-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="ceo-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ceo@company.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ceo-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="ceo-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <span>
                  {submitting
                    ? 'Authenticating...'
                    : mode === 'login'
                      ? 'Sign In to Office'
                      : 'Create CEO Account'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400">or launch instantly</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>

            <div className="space-y-3">
              <GoogleSignInButton
                onClick={handleGoogleSignIn}
                disabled={submitting}
                label="Sign in with Google"
              />
              <button
                type="button"
                onClick={handleDemo}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium text-slate-900 dark:text-slate-100 transition-colors"
              >
                Enter Demo CEO Workspace
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
