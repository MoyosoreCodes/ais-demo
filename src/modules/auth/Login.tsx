// S01 — sign-in. Username/password with password policy + lockout counter,
// simulated 2FA step, simulated SeyID login, and quick demo sign-in chips.
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../app/auth';
import { ReqBadge } from '../../components/ReqBadge';
import { useToast } from '../../components/Toast';
import { Field, Modal, SimBadge } from '../../components/ui';
import { landingPath } from '../../lib/rbac';
import { DEMO_OTP } from '../../lib/sim';
import { useStore } from '../../lib/store';
import { ROLE_LABELS, type User } from '../../lib/types';
import { AuthShell } from './AuthShell';

const QUICK_ROLES = [
  'admin',
  'agriculture_officer',
  'lab_staff',
  'field_officer',
  'supervisor',
  'farmer',
] as const;

export function Login() {
  const { db } = useStore();
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phase, setPhase] = useState<'credentials' | '2fa'>('credentials');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [fails, setFails] = useState(0);
  const [locked, setLocked] = useState(false);
  const [seyidOpen, setSeyidOpen] = useState(false);
  const [seyidOtp, setSeyidOtp] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  const complete = (u: User) => {
    const signed = login(u.username, u.password);
    if (signed) navigate(landingPath(signed.role));
  };

  const submitCredentials = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const u = db.users.find(
      (x) => x.username.toLowerCase() === username.trim().toLowerCase() && x.active,
    );
    if (!u || u.password !== password) {
      const n = fails + 1;
      setFails(n);
      if (n >= 5) {
        setLocked(true);
        setError('Account locked after 5 failed attempts. Try again later or reset your password.');
      } else {
        setError(
          `Invalid credentials.${n >= 3 ? ` ${5 - n} attempt(s) left before lockout.` : ''}`,
        );
      }
      return;
    }
    setError('');
    setFails(0);
    if (u.twoFactor) {
      setPhase('2fa');
      return;
    }
    complete(u);
  };

  const submit2fa = (e: FormEvent) => {
    e.preventDefault();
    const u = db.users.find((x) => x.username.toLowerCase() === username.trim().toLowerCase());
    if (!u) return;
    if (otp !== DEMO_OTP) {
      setError('Incorrect verification code.');
      return;
    }
    complete(u);
  };

  const quickSignIn = (role: string) => {
    const u = db.users.find((x) => x.role === role && x.active);
    if (u) complete(u);
  };

  const seyidLogin = (e: FormEvent) => {
    e.preventDefault();
    if (seyidOtp !== DEMO_OTP) {
      setError('Incorrect SeyID code.');
      return;
    }
    const farmer = db.users.find((x) => x.role === 'farmer' && x.active);
    setSeyidOpen(false);
    if (farmer) complete(farmer);
  };

  return (
    <AuthShell title="Sign in" subtitle="Access the Agriculture Information System">
      {phase === 'credentials' ? (
        <form onSubmit={submitCredentials} className="space-y-4">
          <Field label="Username / email">
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="officer@demo"
              autoComplete="username"
            />
          </Field>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <ReqBadge id="i.1" />
            </div>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Demo2026!"
              autoComplete="current-password"
            />
            <p className="mt-1 text-xs text-slate-400">
              Minimum 8 characters with upper, lower and a number. Encrypted at rest (salted hash).
            </p>
          </div>

          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={locked}>
            Sign in
          </button>

          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="inline-flex items-center gap-1 text-primary-700 hover:underline"
            >
              Forgot password? <ReqBadge id="i.6" />
            </button>
            <span className="text-slate-400">Sessions time out after 15 min (simulated)</span>
          </div>

          <div className="relative py-2 text-center">
            <span className="relative z-10 bg-slate-50 px-2 text-xs text-slate-400">or</span>
            <span className="absolute inset-x-0 top-1/2 border-t border-slate-200" />
          </div>

          <button
            type="button"
            onClick={() => {
              setError('');
              setSeyidOpen(true);
            }}
            className="btn-secondary w-full"
          >
            <span className="flex items-center gap-2">
              Continue with SeyID <SimBadge /> <ReqBadge id="i.8" />
            </span>
          </button>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-400">Quick demo sign-in</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => quickSignIn(r)}
                  className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-primary-400 hover:text-primary-700"
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-sm text-slate-500">
            New farmer?{' '}
            <Link
              to="/register"
              className="inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"
            >
              Self-register <ReqBadge id="i.4" />
            </Link>
          </p>
        </form>
      ) : (
        <form onSubmit={submit2fa} className="space-y-4">
          <div className="rounded-md bg-primary-50 px-3 py-2 text-sm text-primary-800">
            Two-factor authentication <SimBadge /> — enter the 6-digit code sent to your phone. For
            this demo the code is <strong className="font-mono">{DEMO_OTP}</strong>.
          </div>
          <Field label="Verification code">
            <input
              className="input font-mono tracking-widest"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="______"
              maxLength={6}
            />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            Verify &amp; continue
          </button>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => {
              setPhase('credentials');
              setOtp('');
              setError('');
            }}
          >
            Back
          </button>
        </form>
      )}

      <Modal
        open={seyidOpen}
        onClose={() => setSeyidOpen(false)}
        title="SeyID verification (simulated)"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setSeyidOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary" onClick={seyidLogin}>
              Verify
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          SeyID would verify the citizen against their NIN and return a signed profile. Here it is
          simulated: NIN <span className="font-mono">999-0412-1-1-07</span> · Marie-Ange Hoareau.
        </p>
        <div className="mt-3">
          <Field label="One-time code" hint={`Demo code: ${DEMO_OTP}`}>
            <input
              className="input font-mono tracking-widest"
              value={seyidOtp}
              onChange={(e) => setSeyidOtp(e.target.value)}
              placeholder="______"
              maxLength={6}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset password (simulated)"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setResetOpen(false)}>
              Close
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setResetOpen(false);
                push('Password reset link sent by email + SMS (simulated)', 'sms');
              }}
            >
              Send reset link
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-500">
          A reset link and one-time code would be delivered by email and SMS. Account recovery is
          also available to administrators from the S11 console.
        </p>
      </Modal>
    </AuthShell>
  );
}
