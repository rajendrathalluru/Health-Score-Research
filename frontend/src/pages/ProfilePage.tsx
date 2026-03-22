import { useState, useEffect } from 'react';
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
  const inputCls = `w-full bg-transparent border-b-2 border-blue-400 text-gray-900 text-sm
    py-1 focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300`;

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
  const hdrs  = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const [profile, setProfile] = useState<any>(null);
  const [form, setForm] = useState({
    name: '', gender: '', birth_date: '', height_feet: '', height_inches: '',
    cancer_type: '', cancer_stage: '', diagnosis_date: '', phone: '',
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [fitbitConnected, setFitbitConnected] = useState(false);

  useEffect(() => {
    void fetchProfile();
    void fetchFitbitStatus();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/profile`, { headers: hdrs });
      const data = await res.json();
      if (data.success) hydrate(data.data);
      else throw new Error();
    } catch {
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      if (stored.id) hydrate(stored);
      else setError('Could not load profile.');
    } finally { setLoading(false); }
  };

  const fetchFitbitStatus = async () => {
    try {
      const res = await fetch(`${API}/fitbit/status`, { headers: hdrs });
      const data = await res.json();
      setFitbitConnected(Boolean(data.success && data.connected));
    } catch {
      setFitbitConnected(false);
    }
  };

  const hydrate = (d: any) => {
    const height = cmToFeetInches(d.height_cm);
    setProfile(d);
    setAvatarFailed(false);
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
  };

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
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, ...data.data }));
      hydrate(data.data);
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    } finally { setSaving(false); }
  };

  const age     = calcAge(form.birth_date || null);
  const avatarUrl = profile?.avatar_url;

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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">

        {/* ── Top: avatar + name + edit button ─────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-lg ring-4 ring-white">
              {avatarUrl ? (
                avatarUrl && !avatarFailed ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="w-full h-full object-cover"
                    onError={() => setAvatarFailed(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-stone-900
                                  flex items-center justify-center text-white text-2xl font-bold">
                    {form.name ? initials(form.name) : '?'}
                  </div>
                )
              ) : (
                <div className="w-full h-full bg-stone-900
                                flex items-center justify-center text-white text-2xl font-bold">
                  {form.name ? initials(form.name) : '?'}
                </div>
              )}
            </div>
            {/* Online dot */}
            <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-400
                             rounded-full border-2 border-white shadow-sm" />
          </div>

          {/* Name + subtitle */}
          <div className="flex-1">
            {editing ? (
              <input
                name="name" value={form.name} onChange={onChange}
                placeholder="Your name"
                className="text-2xl sm:text-3xl font-bold text-gray-900 bg-transparent
                           border-b-2 border-blue-400 focus:outline-none focus:border-blue-600
                           w-full max-w-sm transition-colors"
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {form.name || 'Your Name'}
              </h1>
            )}
            <p className="text-gray-500 text-sm mt-1">{profile?.email}</p>

            {/* Soft tags */}
            <div className="flex flex-wrap gap-2 mt-3">
              {age !== null && (
                <span className="text-xs bg-violet-50 text-violet-700 px-3 py-1 rounded-full font-medium">
                  {age} years old
                </span>
              )}
              {form.gender && (
                <span className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium capitalize">
                  {form.gender}
                </span>
              )}
              {form.cancer_type && (
                <span className="text-xs bg-rose-50 text-rose-600 px-3 py-1 rounded-full font-medium">
                  🎗️ {form.cancer_type}
                </span>
              )}
              {profile?.google_id && (
                <span className="text-xs bg-gray-50 text-gray-500 px-3 py-1 rounded-full font-medium border border-gray-100">
                  Google
                </span>
              )}
              <span className={`text-xs px-3 py-1 rounded-full font-medium border ${
                fitbitConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-gray-50 text-gray-500 border-gray-100'
              }`}>
                {fitbitConnected ? 'Fitbit Connected' : 'Fitbit Not Connected'}
              </span>
            </div>
          </div>

          {/* Edit / Save / Cancel actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {!editing ? (
              <button
                onClick={() => { setEditing(true); setError(null); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200
                           bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold
                           shadow-sm transition-all hover:shadow-md"
              >
                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 5.793 3 14.172V17h2.828l8.38-8.379-2.83-2.828Z" />
                </svg>
                Edit Profile
              </button>
            ) : (
              <>
                <button onClick={handleCancel}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm
                             font-medium hover:bg-gray-50 transition-all">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm
                             font-semibold shadow-sm transition-all disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Status banners ─────────────────────────────────────────────── */}
        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm
                          rounded-2xl px-5 py-3 flex items-center gap-2">
            <span>⚠️</span>{error}
          </div>
        )}
        {saved && (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm
                          rounded-2xl px-5 py-3 flex items-center gap-2">
            <span>✅</span> Profile updated
          </div>
        )}

        {/* ── Content grid ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Left — main info (3/5) */}
          <div className="lg:col-span-3 space-y-6">

            {/* About you */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
              <h2 className="text-base font-semibold text-gray-800">About You</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <EditableField label="Date of Birth" name="birth_date" value={form.birth_date}
                  displayValue={form.birth_date ? formatDate(form.birth_date) ?? '' : ''}
                  onChange={onChange} type="date" editing={editing} />
                <EditableField label="Gender" name="gender" value={form.gender}
                  onChange={onChange} options={['male', 'female', 'non-binary', 'prefer not to say']}
                  editing={editing} />
                <div className="group">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Height</p>
                  {editing ? (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={0}
                        name="height_feet"
                        value={form.height_feet}
                        onChange={onChange}
                        placeholder="ft"
                        className="w-full bg-transparent border-b-2 border-blue-400 text-gray-900 text-sm py-1 focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300"
                      />
                      <input
                        type="number"
                        min={0}
                        max={11}
                        name="height_inches"
                        value={form.height_inches}
                        onChange={onChange}
                        placeholder="in"
                        className="w-full bg-transparent border-b-2 border-blue-400 text-gray-900 text-sm py-1 focus:outline-none focus:border-blue-600 transition-colors placeholder:text-gray-300"
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

            {/* Health journey */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-800">Health Journey</h2>
                <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                  Optional
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

          {/* Right — sidebar (2/5) */}
          <div className="lg:col-span-2 space-y-4">

            {/* Your stats */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Your Stats</h2>
              {[
                { label: 'Age',         value: age !== null ? `${age} yrs` : null },
                { label: 'Height',      value: profile?.height_cm ? formatFeetInches(profile.height_cm) : null },
                { label: 'Cancer Type', value: form.cancer_type || null },
                { label: 'Stage',       value: form.cancer_stage || null },
                { label: 'Diagnosed',   value: form.diagnosis_date ? formatDate(form.diagnosis_date) : null },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between py-2.5
                                            border-b border-gray-50 last:border-0">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {label}
                  </span>
                  <span className={`text-sm font-semibold ${value ? 'text-gray-900' : 'text-gray-300'}`}>
                    {value ?? '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* Account */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
              <h2 className="text-base font-semibold text-gray-800">Account</h2>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50">
                <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 shadow-sm
                                flex items-center justify-center text-base flex-shrink-0">
                  {profile?.google_id ? '🔵' : '🔑'}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-700">
                    {profile?.google_id ? 'Google Account' : 'Email & Password'}
                  </p>
                  <p className="text-xs text-gray-400 truncate max-w-[140px]">{profile?.email}</p>
                </div>
              </div>
              {profile?.created_at && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" clipRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" />
                  </svg>
                  Member since {new Date(profile.created_at).toLocaleDateString('en-US', {
                    month: 'long', year: 'numeric',
                  })}
                </div>
              )}
            </div>

            {/* Tip card */}
            <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-3xl border border-violet-100 p-5">
              <p className="text-xs font-semibold text-violet-700 mb-1">💡 Did you know?</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Completing your profile helps us personalise your weekly health score and give more accurate recommendations.
              </p>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}
