import { Link, Navigate } from 'react-router-dom';

function PulseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h4l2.2-4.5L14 17l2.2-4H20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h4l2.5-5 3.5 9 2.5-5H20" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9a7 7 0 0 1 14 0v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 12 2-2" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 14c0-5 4-8 12-8 0 8-3 12-8 12-2.2 0-4-1.8-4-4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15c2-2 4.5-4 8-6" />
    </svg>
  );
}

function HeartLeafIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 20s-6.5-3.8-8.6-7.6C1.8 9.5 3 6 6.5 6c2.1 0 3.3 1.1 4 2.3C11.2 7.1 12.4 6 14.5 6 18 6 19.2 9.5 20.6 12.4 18.5 16.2 12 20 12 20Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c1.6-1.8 3.6-3 6-3" />
    </svg>
  );
}

export default function WelcomePage() {
  const token = localStorage.getItem('token');

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#f7efe2]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8rem] top-[-6rem] h-[22rem] w-[22rem] rounded-full bg-[#ffcf8b] opacity-70 blur-3xl" />
        <div className="absolute right-[-6rem] top-[8rem] h-[18rem] w-[18rem] rounded-full bg-[#f59e7b] opacity-40 blur-3xl" />
        <div className="absolute bottom-[-5rem] left-[15%] h-[16rem] w-[16rem] rounded-full bg-[#f4d76a] opacity-35 blur-3xl" />
        <div className="absolute bottom-[8rem] right-[12%] h-[14rem] w-[14rem] rounded-full bg-[#8fd3b6] opacity-25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-[#111111] text-white shadow-[0_14px_26px_rgba(17,17,17,0.18)]">
              <PulseIcon />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">HealthScore</div>
              <div className="text-sm text-stone-600">Cancer survivorship care</div>
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <Link
              to="/login"
              className="rounded-full border border-stone-300/80 bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 backdrop-blur transition-colors hover:bg-white"
            >
              Log in
            </Link>
          </div>
        </header>

        <main className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12 lg:py-12">
          <section className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-600 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Built for weekly recovery routines
            </div>

            <div className="relative overflow-hidden rounded-[2.4rem] border border-white/60 bg-white/55 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-6">
              <div className="absolute -right-10 -top-8 h-28 w-28 rounded-full bg-[#f8d08b] opacity-70 blur-2xl" />
              <div className="absolute bottom-0 left-0 h-24 w-24 rounded-tr-[2rem] bg-[#ffe3d1]" />
              <div className="relative grid gap-4 sm:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-3">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111111] text-white">
                    <HeartLeafIcon />
                  </div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">One weekly rhythm</div>
                  <div className="text-3xl font-medium leading-tight tracking-tight text-stone-950 sm:text-[2.4rem]">
                    See movement, healthy-weight signals, and food habits together.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-[1.5rem] bg-[#fff4d6] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Move</div>
                    <div className="mt-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-stone-800">
                      <ActivityIcon />
                    </div>
                    <div className="mt-3 text-sm font-medium text-stone-900">Activity each week</div>
                  </div>
                  <div className="rounded-[1.5rem] bg-[#ffe6dc] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Measure</div>
                    <div className="mt-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-stone-800">
                      <ScaleIcon />
                    </div>
                    <div className="mt-3 text-sm font-medium text-stone-900">Weight and waist</div>
                  </div>
                  <div className="col-span-2 rounded-[1.5rem] bg-[#e6f6ef] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Reflect</div>
                        <div className="mt-2 text-sm font-medium text-stone-900">Questionnaire-based food habit review</div>
                      </div>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 text-stone-800">
                        <LeafIcon />
                      </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/70">
                      <div className="h-2 w-[72%] rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-6 max-w-2xl text-base leading-7 text-stone-700 sm:text-lg">
              HealthScore helps cancer survivors review movement, healthy-weight signals, and food-pattern habits in one bright, structured weekly check-in.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                {
                  icon: <ActivityIcon />,
                  color: 'bg-[#fff4d6]',
                  title: 'Move each week',
                  text: 'Fitbit or manual logging',
                },
                {
                  icon: <ScaleIcon />,
                  color: 'bg-[#ffe6dc]',
                  title: 'Watch healthy-weight signals',
                  text: 'Weight and waist trends',
                },
                {
                  icon: <LeafIcon />,
                  color: 'bg-[#e6f6ef]',
                  title: 'Reflect on food habits',
                  text: 'Weekly questionnaire check-in',
                },
              ].map((item) => (
                <div key={item.title} className={`rounded-[1.5rem] border border-white/60 ${item.color} p-4 shadow-[0_10px_24px_rgba(15,23,42,0.06)]`}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/80 text-stone-800">
                    {item.icon}
                  </div>
                  <div className="mt-4 text-base font-semibold tracking-tight text-stone-950">{item.title}</div>
                  <div className="mt-2 text-sm leading-6 text-stone-700">{item.text}</div>
                </div>
              ))}
            </div>
          </section>

          <aside className="lg:justify-self-end">
            <div className="relative mx-auto w-full max-w-[33rem]">
              <div className="absolute -left-5 top-10 hidden h-28 w-28 rounded-[2rem] bg-white/30 backdrop-blur lg:block" />
              <div className="absolute -right-4 bottom-12 hidden h-24 w-24 rounded-full border border-white/40 bg-[#f8d08b]/40 backdrop-blur lg:block" />

              <div className="relative overflow-hidden rounded-[2.2rem] border border-white/60 bg-white/70 p-4 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:p-5">
                <div className="rounded-[1.9rem] bg-[linear-gradient(135deg,_#121212_0%,_#221a18_45%,_#10221e_100%)] p-5 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-300">This week</div>
                      <div className="mt-2 text-2xl font-semibold tracking-tight">Your health view at a glance</div>
                    </div>
                    <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                      Survivorship focus
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-[1.3rem] bg-white/8 p-4">
                      <div className="text-4xl font-semibold tracking-tight">5.8</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-stone-400">Weekly score / 7</div>
                    </div>
                    <div className="rounded-[1.3rem] bg-white/8 p-4">
                      <div className="text-4xl font-semibold tracking-tight">9/9</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-stone-400">Sections complete</div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div className="h-2 w-[82%] rounded-full bg-gradient-to-r from-emerald-300 via-emerald-400 to-cyan-300" />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.5rem] bg-[#fff7df] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Activity</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">142</div>
                    <div className="mt-1 text-sm text-stone-600">Minutes logged this week</div>
                  </div>
                  <div className="rounded-[1.5rem] bg-[#fce8e0] p-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Body metrics</div>
                    <div className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">72.5</div>
                    <div className="mt-1 text-sm text-stone-600">Current saved weight in kg</div>
                  </div>
                </div>

                <div className="mt-4 rounded-[1.7rem] bg-[#edf7f0] p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Why it feels different</div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {[
                      { value: '1', label: 'weekly check-in' },
                      { value: '3', label: 'core habit areas' },
                      { value: '7', label: 'point score model' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[1.2rem] bg-white/75 px-3 py-4 text-center">
                        <div className="text-2xl font-semibold tracking-tight text-stone-950">{item.value}</div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-stone-500">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Link
                    to="/register"
                    className="inline-flex flex-1 items-center justify-center rounded-[1.35rem] bg-[#111111] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
                  >
                    Create account
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex flex-1 items-center justify-center rounded-[1.35rem] border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
