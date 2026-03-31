import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import { API_BASE } from '../config/api';
import { cmToFeetInches, feetInchesToCm, formatFeetInches } from '../utils/units';

const API = API_BASE;

const CANCER_TYPES = [
  'Breast', 'Colorectal', 'Prostate', 'Lung', 'Skin (Melanoma)',
  'Bladder', 'Kidney', 'Uterine / Endometrial', 'Pancreatic',
  'Stomach / Gastric', 'Liver', 'Ovarian', 'Cervical',
  'Thyroid', 'Lymphoma', 'Leukemia', 'Other',
];
const CANCER_STAGES = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Remission', 'Not specified'];

interface ProfileData {
  id?: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
  google_id?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  height_cm?: number | null;
  cancer_type?: string | null;
  cancer_stage?: string | null;
  diagnosis_date?: string | null;
  phone?: string | null;
  created_at?: string | null;
}

function calcAge(birth: string | null) {
  if (!birth) return null;
  return Math.floor((Date.now() - new Date(birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}
function initials(name: string) {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
function toDateInput(iso?: string | null) {
  return iso ? iso.split('T')[0] : '';
}
function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ─── Inline editable field ────────────────────────────────────────────────────
function EditableField({
  label, name, value, displayValue, onChange, type = 'text',
  options, placeholder, editing,
}: {
  label: string; name: string; value: string; displayValue?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  type?: string; options?: string[]; placeholder?: string; editing: boolean;
}) {
  const inputCls = `w-full bg-transparent border-b-2 border-stone-300 text-stone-900 text-sm
    py-1 focus:outline-none focus:border-stone-900 transition-colors placeholder:text-stone-300`;

  const shown = displayValue ?? value;

  return (
    <div className="group">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
      {editing ? (
        options ? (
          <select name={name} value={value} onChange={onChange} className={inputCls}>
            <option value="">Select…</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={type} name={name} value={value} onChange={onChange}
            placeholder={placeholder || label} className={inputCls} />
        )
      ) : (
        <p className={`text-sm font-medium ${shown ? 'text-gray-900' : 'text-gray-300 italic'}`}>
          {shown || `No ${label.toLowerCase()} added`}
        </p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const token = localStorage.getItem('token');
  const hdrs  = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({
    name: '', gender: '', birth_date: '', height_feet: '', height_inches: '',
    cancer_type: '', cancer_stage: '', diagnosis_date: '', phone: '',
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [fitbitConnected, setFitbitConnected] = useState(false);

  const hydrate = useCallback((d: ProfileData) => {
    const height = cmToFeetInches(d.height_cm ?? null);
    setProfile(d);
    setForm({
      name:           d.name         ?? '',
      gender:         d.gender       ?? '',
      birth_date:     toDateInput(d.birth_date),
      height_feet:    height.feet != null ? String(height.feet) : '',
      height_inches:  height.inches != null ? String(height.inches) : '',
      cancer_type:    d.cancer_type  ?? '',
      cancer_stage:   d.cancer_stage ?? '',
      diagnosis_date: toDateInput(d.diagnosis_date),
      phone:          d.phone        ?? '',
    });
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/profile`, { headers: hdrs });
      const data = await res.json();
      if (data.success) hydrate(data.data as ProfileData);
      else throw new Error();
    } catch {
      const stored = JSON.parse(localStorage.getItem('user') || '{}') as ProfileData;
      if (stored.id) hydrate(stored);
      else setError('Could not load profile.');
    } finally { setLoading(false); }
  }, [hdrs, hydrate]);

  const fetchFitbitStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/fitbit/status`, { headers: hdrs });
      const data = await res.json();
      setFitbitConnected(Boolean(data.success && data.connected));
    } catch {
      setFitbitConnected(false);
    }
  }, [hdrs]);

  useEffect(() => {
    void fetchProfile();
    void fetchFitbitStatus();
  }, [fetchFitbitStatus, fetchProfile]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    setSaved(false);
  };

  const handleCancel = () => { setEditing(false); setError(null); if (profile) hydrate(profile); };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return; }
    const hasHeight = form.height_feet.trim() !== '' || form.height_inches.trim() !== '';
    const heightFeet = form.height_feet.trim() === '' ? 0 : Number(form.height_feet);
    const heightInches = form.height_inches.trim() === '' ? 0 : Number(form.height_inches);

    if (hasHeight) {
      if (Number.isNaN(heightFeet) || Number.isNaN(heightInches) || heightFeet < 0 || heightInches < 0 || heightInches >= 12) {
        setError('Enter height using valid feet and inches.');
        return;
      }
    }

    setSaving(true); setError(null);
    try {
      const res  = await fetch(`${API}/profile`, {
        method: 'PUT', headers: hdrs,
        body: JSON.stringify({
          name:           form.name.trim()  || null,
          gender:         form.gender       || null,
          birth_date:     form.birth_date   || null,
          height_cm:      hasHeight ? feetInchesToCm(heightFeet, heightInches) : null,
          cancer_type:    form.cancer_type  || null,
          cancer_stage:   form.cancer_stage || null,
          diagnosis_date: form.diagnosis_date || null,
          phone:          form.phone        || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      const stored = JSON.parse(localStorage.getItem('user') || '{}') as ProfileData;
      localStorage.setItem('user', JSON.stringify({ ...stored, ...data.data }));
      hydrate(data.data as ProfileData);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const age     = calcAge(form.birth_date || null);
  const overviewItems = [
    { label: 'Age', value: age !== null ? `${age} years` : null },
    { label: 'Height', value: profile?.height_cm ? formatFeetInches(profile.height_cm) : null },
    { label: 'Cancer Type', value: form.cancer_type || null },
    { label: 'Stage', value: form.cancer_stage || null },
    { label: 'Diagnosed', value: form.diagnosis_date ? formatDate(form.diagnosis_date) : null },
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="relative flex-shrink-0">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-stone-900 text-3xl font-semibold text-white shadow-sm ring-1 ring-stone-200">
                  {form.name ? initials(form.name) : '?'}
                </div>
                <span className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-white ${fitbitConnected ? 'bg-emerald-400' : 'bg-stone-300'}`} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">Profile</p>
                {editing ? (
                  <input
                    name="name"
                    value={form.name}
                    onChange={onChange}
                    placeholder="Your name"
                    className="mt-2 w-full max-w-md border-b-2 border-stone-300 bg-transparent pb-1 text-3xl font-semibold tracking-tight text-stone-950 outline-none focus:border-stone-900"
                  />
                ) : (
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
                    {form.name || 'Your Name'}
                  </h1>
                )}
                <p className="mt-2 text-sm text-stone-500">{profile?.email}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {age !== null && (
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">
                      {age} years old
                    </span>
                  )}
                  {form.gender && (
                    <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-medium capitalize text-sky-700">
                      {form.gender}
                    </span>
                  )}
                  {form.cancer_type && (
                    <span className="rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                      {form.cancer_type}
                    </span>
                  )}
                  {profile?.google_id && (
                    <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-600">
                      Google account
                    </span>
                  )}
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    fitbitConnected
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-stone-200 bg-stone-50 text-stone-500'
                  }`}>
                    {fitbitConnected ? 'Fitbit connected' : 'Fitbit not connected'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start">
              {!editing ? (
                <button
                  onClick={() => { setEditing(true); setError(null); }}
                  className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
                  </svg>
                  Edit profile
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancel}
                    className="rounded-2xl border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-2xl bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Status banners ─────────────────────────────────────────────── */}
        {error && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700">
            <span className="font-semibold">Error</span>
            <span>{error}</span>
          </div>
        )}
        {saved && (
          <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
            <span className="font-semibold">Saved</span>
            <span>Profile updated</span>
          </div>
        )}

        {/* ── Content grid ───────────────────────────────────────────────── */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.45fr_0.55fr]">

          <div className="space-y-6">
            <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Profile details</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">Personal and health information</h2>
                </div>
                <p className="max-w-xs text-sm text-stone-500">A single place to keep the core details that support the rest of your tracking.</p>
              </div>

              <div className="mb-8">
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">About you</p>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <EditableField label="Date of Birth" name="birth_date" value={form.birth_date}
                    displayValue={form.birth_date ? formatDate(form.birth_date) ?? '' : ''}
                    onChange={onChange} type="date" editing={editing} />
                  <EditableField label="Gender" name="gender" value={form.gender}
                    onChange={onChange} options={['male', 'female', 'non-binary', 'prefer not to say']}
                    editing={editing} />
                  <div className="group">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Height</p>
                    {editing ? (
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          min={0}
                          name="height_feet"
                          value={form.height_feet}
                          onChange={onChange}
                          placeholder="ft"
                          className="w-full bg-transparent border-b-2 border-stone-300 text-stone-900 text-sm py-1 focus:outline-none focus:border-stone-900 transition-colors placeholder:text-stone-300"
                        />
                        <input
                          type="number"
                          min={0}
                          max={11}
                          name="height_inches"
                          value={form.height_inches}
                          onChange={onChange}
                          placeholder="in"
                          className="w-full bg-transparent border-b-2 border-stone-300 text-stone-900 text-sm py-1 focus:outline-none focus:border-stone-900 transition-colors placeholder:text-stone-300"
                        />
                      </div>
                    ) : (
                      <p className={`text-sm font-medium ${profile?.height_cm ? 'text-gray-900' : 'text-gray-300 italic'}`}>
                        {profile?.height_cm ? formatFeetInches(profile.height_cm) : 'No height added'}
                      </p>
                    )}
                  </div>
                  <EditableField label="Phone" name="phone" value={form.phone}
                    onChange={onChange} type="tel" placeholder="+1 555 000 0000" editing={editing} />
                </div>
              </div>

              <div className="border-t border-stone-100 pt-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Health journey</p>
                    <h3 className="mt-2 text-lg font-semibold tracking-tight text-stone-950">Treatment history</h3>
                  </div>
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-500">
                    Optional
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <EditableField label="Cancer Type" name="cancer_type" value={form.cancer_type}
                    onChange={onChange} options={CANCER_TYPES} editing={editing} />
                  <EditableField label="Stage" name="cancer_stage" value={form.cancer_stage}
                    onChange={onChange} options={CANCER_STAGES} editing={editing} />
                  <div className="sm:col-span-2">
                    <EditableField label="Diagnosis Date" name="diagnosis_date" value={form.diagnosis_date}
                      displayValue={form.diagnosis_date ? formatDate(form.diagnosis_date) ?? '' : ''}
                      onChange={onChange} type="date" editing={editing} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Overview</p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-stone-950">Snapshot</h2>
              <div className="mt-6 space-y-4">
                {overviewItems.map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4 last:border-0 last:pb-0">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                      {label}
                    </span>
                    <span className={`text-right text-sm font-medium ${value ? 'text-stone-950' : 'text-stone-300'}`}>
                      {value ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-6 border-t border-stone-100 pt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">Account</p>
                <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700">
                      {profile?.google_id ? 'G' : 'E'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900">
                        {profile?.google_id ? 'Google sign-in' : 'Email & password'}
                      </p>
                      <p className="truncate text-xs text-stone-500">{profile?.email}</p>
                    </div>
                  </div>
                  {profile?.created_at && (
                    <div className="mt-4 border-t border-stone-200 pt-4 text-xs text-stone-500">
                      Member since {new Date(profile.created_at).toLocaleDateString('en-US', {
                        month: 'long', year: 'numeric',
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
