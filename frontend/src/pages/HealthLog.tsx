import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/layout/Layout';
import { ScoreModal } from '../components/health-log';
import type { WeeklyScore } from '../components/health-log';
import {
  getWeeklyQuestionnaire,
  getWeeklyScoreHistory,
  saveWeeklyQuestionnaire,
  type WeeklyDietAnswers,
  type WeeklyScoreResponse,
} from '../services/dailyLogService';

const toDateStr = (d: Date) => d.toISOString().split('T')[0];

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getCurrentWeekStart(): string {
  return toDateStr(mondayOf(new Date()));
}

function getRecentWeekStarts(count = 12): string[] {
  const starts: string[] = [];
  const current = mondayOf(new Date());
  for (let i = 0; i < count; i++) {
    const d = new Date(current);
    d.setDate(current.getDate() - i * 7);
    starts.push(toDateStr(d));
  }
  return starts;
}

const CURRENT_WEEK_START = getCurrentWeekStart();
const WEEKLY_CACHE_KEY = 'weekly_questionnaire_cache_v1';

const EMPTY_ANSWERS: WeeklyDietAnswers = {
  q29: null,
  q30: null,
  q31: null,
  q32: null,
  q33: null,
  q34: null,
  q35: null,
  q36: null,
  q37: null,
};

type Option = { value: string; label: string };
type Question = {
  id: keyof WeeklyDietAnswers;
  title: string;
  subtitle?: string;
  options: Option[];
  examples?: string[];
  portionNote?: string;
};

const BASE_QUESTIONS: Question[] = [
  {
    id: 'q29',
    title: 'How many portions of fruit and non-starchy vegetables do you eat per day?',
    subtitle: 'Do not count potatoes, sweet potatoes, or yucca.',
    portionNote: 'Portion guide',
    examples: [
      '1 portion fruit = 1 apple, pear, orange, banana, peach, kiwi, or slice of melon/watermelon',
      '1 portion fruit = 2-3 clementines, figs, plums, or apricots',
      '1 portion fruit = 1 handful strawberries, grapes, or cherries',
      '1 portion vegetables = 1 big bowl of salad',
      '1 portion vegetables = 1 bowl of vegetable soup/minestrone',
      '1 portion vegetables = 1 small plate of cooked vegetables',
      '1 portion vegetables = 1 medium tomato or 1 large carrot',
    ],
    options: [
      { value: '5_plus_day', label: '5 portions or more/day' },
      { value: '4_day', label: '4 portions/day' },
      { value: '2_3_day', label: '2-3 portions/day' },
      { value: '1_day', label: '1 portion/day' },
      { value: 'lt_1_day', label: 'Less than 1 portion/day' },
      { value: 'none', label: "I don't usually eat fruit and vegetables" },
    ],
  },
  {
    id: 'q30',
    title: 'How many portions of beans/pulses do you eat per week?',
    portionNote: 'Portion guide',
    examples: [
      '1 portion = 1 bowl lentils, chickpeas, peas, or black/pinto/white beans',
      '1 portion = 1 legume salad',
      '1 portion = 1 serving red beans and rice',
      '1 portion = 1 serving refried beans',
    ],
    options: [
      { value: '4_plus_week', label: '4 portions or more/week' },
      { value: '3_week', label: '3 portions/week' },
      { value: '2_week', label: '2 portions/week' },
      { value: '1_week', label: '1 portion/week' },
      { value: 'lt_1_week', label: 'Less than 1 portion/week' },
      { value: 'none', label: "I don't usually eat pulses" },
    ],
  },
  {
    id: 'q31',
    title: 'How often do you eat whole grains?',
    portionNote: 'Serving examples',
    examples: [
      '1 serving = 2 slices wholegrain bread',
      '1 serving = 1 whole wheat tortilla',
      '1 serving = 1 plate cooked wholegrain pasta, brown rice, or quinoa',
      '1 serving = 1 small bowl oatmeal/porridge (wholegrain, low-sugar)',
      'Examples: wholegrain cereals such as muesli, porridge, All-Bran',
    ],
    options: [
      { value: 'multi_day', label: 'Multiple times/day' },
      { value: 'daily', label: 'Once a day' },
      { value: '4_6_week', label: '4-6 times/week' },
      { value: '1_3_week', label: '1-3 times/week' },
      { value: 'lt_1_week', label: 'Less than once a week' },
      { value: 'none', label: "I don't usually eat whole grains" },
    ],
  },
  {
    id: 'q32',
    title: 'How often do you eat fast or processed foods and snacks?',
    portionNote: 'Examples (frequency-based)',
    examples: [
      'Examples: salty snacks (crisps, salty nuts, crackers)',
      'Examples: pizza, lasagne, nuggets, croquettes, fries/chips',
      'Examples: pre-prepared/frozen dishes and takeaways',
      'Examples: mayonnaise, ketchup, mustard, cream cheese',
    ],
    options: [
      { value: '4_plus_week', label: '4 times or more/week' },
      { value: '3_week', label: '3 times/week' },
      { value: '2_week', label: 'Twice/week' },
      { value: '1_week', label: 'Once/week' },
      { value: 'lt_1_week', label: 'Less than once/week' },
      { value: 'none', label: "I don't usually eat fast or processed food" },
    ],
  },
  {
    id: 'q33',
    title: 'How often do you eat sweets and pastries?',
    portionNote: 'Examples (frequency-based)',
    examples: [
      'Examples: biscuits, doughnuts, croissants, cakes',
      'Examples: chocolate bars and sweets',
      'Examples: ice cream and desserts (flan, pudding, creme brulee)',
      'Examples: sugary breakfast cereals',
    ],
    options: [
      { value: '4_plus_week', label: '4 times or more/week' },
      { value: '3_week', label: '3 times/week' },
      { value: '2_week', label: 'Twice/week' },
      { value: '1_week', label: 'Once/week' },
      { value: 'lt_1_week', label: 'Less than once/week' },
      { value: 'none', label: "I don't usually eat sweets and pastries" },
    ],
  },
  {
    id: 'q34',
    title: 'How many portions of red meat do you eat per week?',
    portionNote: 'Portion guide',
    examples: [
      '1 portion = 1 steak about palm-size',
      '1 portion = 2-3 lamb or pork chops',
      '1 portion = minced meat serving (e.g., 2-3 meatballs/bolognese)',
      '1 portion = 1 serving of liver or kidney',
    ],
    options: [
      { value: '6_plus_week', label: '6 portions or more/week' },
      { value: '4_5_week', label: '4-5 portions/week' },
      { value: '3_week', label: '3 portions/week' },
      { value: '1_2_week', label: '1-2 portions/week' },
      { value: 'lt_1_week', label: 'Less than 1 portion/week' },
      { value: 'none', label: "I don't usually eat red meat" },
    ],
  },
  {
    id: 'q35',
    title: 'How often do you eat processed meat?',
    portionNote: 'Portion guide',
    examples: [
      '1 portion = 2-3 slices ham, bacon, deli turkey, salami, or bologna',
      '1 portion = 1 sausage, 1 hot dog, or 1 non-homemade hamburger',
      '1 portion = 1 can of foie-gras/pate',
      '1 portion = 1 polish sausage',
    ],
    options: [
      { value: '4_plus_week', label: '4 portions or more/week' },
      { value: '3_week', label: '3 portions/week' },
      { value: '2_week', label: '2 portions/week' },
      { value: '1_week', label: '1 portion/week' },
      { value: 'lt_1_week', label: 'Less than 1 portion/week' },
      { value: 'none', label: "I don't usually eat processed meat" },
    ],
  },
  {
    id: 'q36',
    title: 'How often do you have sugary drinks?',
    portionNote: '1 portion = 1 glass (250 ml)',
    examples: [
      'Examples: non-diet soft drinks (cola, tonic, iced tea)',
      'Examples: energy drinks, sports drinks, sweetened waters',
      'Examples: sugary milkshakes and cocoa-based drinks',
      'Examples: store-bought sugary coffee/tea drinks',
      'Examples: fruit drinks/juices with added sugar and nectars',
    ],
    options: [
      { value: '1_plus_day', label: '1 drink or more/day' },
      { value: '4_6_week', label: '4-6 drinks/week' },
      { value: '2_3_week', label: '2-3 drinks/week' },
      { value: '1_week', label: '1 drink/week' },
      { value: 'lt_1_week', label: 'Less than 1 drink/week' },
      { value: 'none', label: "I don't usually have sugary drinks" },
    ],
  },
];

const ALCOHOL_MALE: Question = {
  id: 'q37',
  title: 'How often do you have an alcoholic drink? (Male thresholds)',
  portionNote: 'Drink examples',
  examples: [
    '1 drink = 1 small glass of wine (125 ml)',
    '1 drink = 1 can or bottle of beer (330 ml)',
    '1 drink = 1 shot of spirits or liqueur (25 ml)',
    '1 drink = 1 small glass of champagne (125 ml)',
    'Note: a double shot (50 ml) counts as 2 drinks',
  ],
  options: [
    { value: 'gt_2_day', label: 'More than 2 drinks/day' },
    { value: '1_2_day', label: '1-2 drinks/day' },
    { value: '4_6_week', label: '4-6 drinks/week' },
    { value: '1_3_week', label: '1-3 drinks/week' },
    { value: 'lt_1_week', label: 'Less than 1 drink/week' },
    { value: 'none', label: "I don't usually have alcoholic drinks" },
  ],
};

const ALCOHOL_FEMALE: Question = {
  id: 'q37',
  title: 'How often do you have an alcoholic drink? (Female thresholds)',
  portionNote: 'Drink examples',
  examples: [
    '1 drink = 1 small glass of wine (125 ml)',
    '1 drink = 1 can or bottle of beer (330 ml)',
    '1 drink = 1 shot of spirits or liqueur (25 ml)',
    '1 drink = 1 small glass of champagne (125 ml)',
    'Note: a double shot (50 ml) counts as 2 drinks',
  ],
  options: [
    { value: 'gt_1_day', label: 'More than 1 drink/day' },
    { value: '1_day', label: '1 drink/day' },
    { value: '4_6_week', label: '4-6 drinks/week' },
    { value: '1_3_week', label: '1-3 drinks/week' },
    { value: 'lt_1_week', label: 'Less than 1 drink/week' },
    { value: 'none', label: "I don't usually have alcoholic drinks" },
  ],
};

function toModalScore(data: WeeklyScoreResponse): WeeklyScore {
  const risk = `${data.risk_level} Risk`;
  const riskCol = data.risk_level === 'Low'
    ? 'text-green-600'
    : data.risk_level === 'Moderate'
      ? 'text-amber-600'
      : 'text-red-500';

  return {
    components: data.components,
    total: Number(data.total_score ?? 0),
    maxPossible: Number(data.max_possible_score ?? 0),
    risk,
    riskCol,
    daysLogged: Number(data.days_answered ?? 0),
    avgFV: null,
    avgFiber: null,
    totalRed: 0,
    totalProc: 0,
    avgSSB: null,
    avgEth: null,
    latestBMI: null,
  };
}

function formatWeekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

export default function HealthLog() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const gender = String(user.gender || '').toLowerCase() === 'female' ? 'female' : 'male';

  const [selectedWeek, setSelectedWeek] = useState(CURRENT_WEEK_START);
  const [weekOptions, setWeekOptions] = useState<string[]>([...getRecentWeekStarts(12)]);
  const [answers, setAnswers] = useState<WeeklyDietAnswers>(EMPTY_ANSWERS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [score, setScore] = useState<WeeklyScore | null>(null);
  const [showScore, setShowScore] = useState(false);
  const [lastCalculatedAt, setLastCalculatedAt] = useState<string | null>(null);

  const questions = useMemo(() => {
    return [...BASE_QUESTIONS, gender === 'female' ? ALCOHOL_FEMALE : ALCOHOL_MALE];
  }, [gender]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const history = await getWeeklyScoreHistory(52);
        const historyWeeks = history.map(h => h.week_start_date.split('T')[0]);
        const merged = Array.from(new Set([...historyWeeks, ...getRecentWeekStarts(12)])).sort().reverse();
        setWeekOptions(merged);
      } catch (err) {
        console.error(err);
      }
    };

    loadHistory();
  }, []);

  useEffect(() => {
    const loadWeek = async () => {
      try {
        setLoading(true);
        setError(null);
        setSaveMsg(null);
        setAnswers(EMPTY_ANSWERS);
        setScore(null);

        const data = await getWeeklyQuestionnaire(selectedWeek);
        if (data) {
          setAnswers({ ...EMPTY_ANSWERS, ...data.answers });
          setLastCalculatedAt(data.calculated_at || null);
          writeWeekCache(selectedWeek, data);
        } else {
          setLastCalculatedAt(null);
        }
      } catch (err) {
        console.error(err);
        const cached = readWeekCache(selectedWeek);
        if (cached) {
          setAnswers({ ...EMPTY_ANSWERS, ...cached.answers });
          setLastCalculatedAt(cached.calculated_at || null);
          setError('Could not reach server. Loaded your local saved copy for this week.');
        } else {
          setError(err instanceof Error ? err.message : 'Could not load saved questionnaire for this week.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadWeek();
  }, [selectedWeek]);

  const answeredCount = Object.values(answers).filter(v => v !== null).length;
  const totalQuestions = 9;
  const allAnswered = answeredCount === totalQuestions;

  const onSelect = (id: keyof WeeklyDietAnswers, value: string) => {
    setAnswers(prev => ({ ...prev, [id]: value }));
    setSaveMsg(null);
  };

  const writeWeekCache = (weekStart: string, payload: WeeklyScoreResponse) => {
    try {
      const raw = localStorage.getItem(WEEKLY_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      parsed[weekStart] = payload;
      localStorage.setItem(WEEKLY_CACHE_KEY, JSON.stringify(parsed));
    } catch (e) {
      console.error('Failed to write questionnaire cache', e);
    }
  };

  const readWeekCache = (weekStart: string): WeeklyScoreResponse | null => {
    try {
      const raw = localStorage.getItem(WEEKLY_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed[weekStart] ?? null;
    } catch (e) {
      console.error('Failed to read questionnaire cache', e);
      return null;
    }
  };

  const onSaveAndScore = async () => {
    if (!allAnswered) return;

    try {
      setSaving(true);
      setError(null);
      const data = await saveWeeklyQuestionnaire(selectedWeek, answers);
      setScore(toModalScore(data));
      setLastCalculatedAt(data.calculated_at || null);
      setSaveMsg('Weekly questionnaire saved.');
      writeWeekCache(selectedWeek, data);
      setShowScore(true);

      setWeekOptions(prev => {
        if (prev.includes(selectedWeek)) return prev;
        return [...prev, selectedWeek].sort().reverse();
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save questionnaire.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Weekly Diet Questionnaire</h1>
            <p className="text-sm text-gray-500 mt-1">{formatWeekLabel(selectedWeek)}</p>
          </div>

          <div className="w-full sm:w-64">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Week</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              {weekOptions.map((week) => (
                <option key={week} value={week}>{formatWeekLabel(week)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 px-4 py-3 rounded-lg border bg-blue-50 border-blue-200 text-blue-800 text-sm">
          Fill all 9 sections to compute your weekly score. Save and compute will appear only after all questions are answered.
        </div>

        <div className="mb-6 text-right">
          <p className="text-2xl font-bold text-gray-900">{answeredCount}<span className="text-base text-gray-400">/{totalQuestions}</span></p>
          <p className="text-xs text-gray-400 uppercase tracking-wide">Questions answered</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {saveMsg && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {saveMsg}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
            <span className="ml-3 text-sm text-gray-500">Loading questionnaire...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-5">
                  <div className="lg:col-span-3 p-5">
                    <h2 className="text-sm font-semibold text-gray-900">{q.title}</h2>
                    {q.subtitle && <p className="text-xs text-gray-500 mt-1">{q.subtitle}</p>}
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {q.options.map((opt) => {
                        const selected = answers[q.id] === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => onSelect(q.id, opt.value)}
                            className={`text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                              selected
                                ? 'bg-blue-50 border-blue-400 text-blue-700'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-gradient-to-br from-slate-50 to-gray-50 border-t lg:border-t-0 lg:border-l border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        {q.portionNote || 'Examples'}
                      </p>
                      <span className="text-[10px] font-medium text-slate-400">From screener guide</span>
                    </div>
                    {q.examples?.length ? (
                      <ul className="space-y-2">
                        {q.examples.map((example) => (
                          <li key={example} className="text-xs text-slate-600 leading-relaxed flex gap-2">
                            <span className="mt-1 inline-block w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                            <span>{example}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500">Select the option that best reflects your usual intake.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <div className="sticky bottom-4 bg-white/95 backdrop-blur border border-gray-200 rounded-xl p-4 shadow-sm">
              {allAnswered ? (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">All sections completed. You can compute your weekly score now.</p>
                    {lastCalculatedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Last calculated: {new Date(lastCalculatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onSaveAndScore}
                    disabled={saving}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold transition-all disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save and Compute Score'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Please complete all sections ({answeredCount}/{totalQuestions}) to unlock score computation.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {showScore && score && (
        <ScoreModal score={score} onClose={() => setShowScore(false)} />
      )}
    </Layout>
  );
}
