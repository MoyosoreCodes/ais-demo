// S01 — farmer self-registration. Creates a linked Client + User, validates the
// password at the boundary, and offers a simulated SeyID pre-fill.
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../app/auth';
import { ReqBadge } from '../../components/ReqBadge';
import { useToast } from '../../components/Toast';
import { Field, SimBadge } from '../../components/ui';
import { nowIso } from '../../lib/format';
import { nextClientId, uid } from '../../lib/ids';
import { makeNotification } from '../../lib/sim';
import { useStore } from '../../lib/store';
import { type Client, type District, DISTRICTS, type User } from '../../lib/types';
import { AuthShell } from './AuthShell';

const strongPassword = (p: string): boolean =>
  p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);

export function Register() {
  const { db, upsert } = useStore();
  const { login } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nin, setNin] = useState('999-');
  const [phone, setPhone] = useState('+248 2 000 0');
  const [email, setEmail] = useState('');
  const [district, setDistrict] = useState<District>('Anse Boileau');
  const [password, setPassword] = useState('');
  const [seyid, setSeyid] = useState(false);
  const [error, setError] = useState('');

  const useSeyid = () => {
    setSeyid(true);
    setFirstName('Marie-Ange');
    setLastName('Hoareau');
    setNin('999-0412-1-1-07');
    setEmail('marieange.h@example.sc');
    push('SeyID profile retrieved (simulated)', 'success');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName) return setError('Name is required.');
    if (!/^999-/.test(nin)) return setError('Demo NINs must start with 999-.');
    if (!strongPassword(password))
      return setError('Password must be 8+ characters with upper, lower and a number.');

    const clientId = nextClientId(db.clients);
    const client: Client = {
      id: clientId,
      nin,
      firstName,
      lastName,
      gender: 'F',
      dob: '1990-01-01',
      phone,
      email,
      address: district,
      district,
      stakeholderType: 'farmer',
      seyidVerified: seyid,
      status: 'active',
      source: 'self_service',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      history: [
        {
          at: nowIso(),
          by: seyid ? 'Self-service (SeyID)' : 'Self-service',
          field: 'record',
          from: '',
          to: 'created via online self-registration',
        },
      ],
    };
    const user: User = {
      id: uid('USR'),
      username: email || `${firstName.toLowerCase()}@demo`,
      name: `${firstName} ${lastName}`,
      role: 'farmer',
      active: true,
      phone,
      clientId,
      password,
      twoFactor: true,
    };
    upsert('clients', client);
    upsert('users', user);
    upsert(
      'notifications',
      makeNotification({
        channel: 'sms',
        to: phone,
        clientId,
        subject: 'Welcome to AIS',
        body: `Your farmer account ${clientId} has been created.`,
        template: 'welcome',
        event: 'client.registered',
      }),
    );
    push('Account created — signing you in', 'success');
    const signed = login(user.username, password);
    if (signed) navigate('/portal');
  };

  return (
    <AuthShell
      title="Farmer self-registration"
      subtitle="Create your Agriculture Information System account"
    >
      <form onSubmit={submit} className="space-y-4">
        <button type="button" onClick={useSeyid} className="btn-secondary w-full">
          <span className="flex items-center gap-2">
            Pre-fill with SeyID <SimBadge /> <ReqBadge id={['i.8', 'ii.3']} />
          </span>
        </button>
        {seyid && (
          <p className="rounded bg-primary-50 px-3 py-1.5 text-xs text-primary-700">
            Identity verified via SeyID (simulated).
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="First name" required>
            <input
              className="input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Last name" required>
            <input
              className="input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>
        <Field label="National ID (NIN)" hint="Fictional demo NIN — must start with 999-">
          <input className="input font-mono" value={nin} onChange={(e) => setNin(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone">
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="District">
            <select
              className="input"
              value={district}
              onChange={(e) => setDistrict(e.target.value as District)}
            >
              {DISTRICTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Email">
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            placeholder="At least 8 chars, upper, lower, number"
          />
        </div>

        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <button type="submit" className="btn-primary w-full">
          Create account
        </button>
        <p className="text-center text-sm text-slate-500">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-primary-700 hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
