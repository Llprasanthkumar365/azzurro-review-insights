import { useEffect, useMemo, useState } from 'react'
import { BarChart3, ChevronDown, Download, RefreshCw, Search, SlidersHorizontal, Star, TrendingDown, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import './App.css'

interface Review { id: string; propertyId: string; property: string; rating: number; date: string; title: string; text: string; reviewer: string; country: string; source: string }
interface Metrics { average: number; previousAverage: number; reviewCount: number; positiveCount: number; negativeCount: number; propertyBreakdown: { id: string; name: string; shortName: string; average: number; count: number }[]; negativeTopics: { topic: string; count: number; percent: number }[]; trend: { date: string; positive: number; negative: number }[] }
const properties = [{ id: '', name: 'All properties' }, { id: 'paddington', name: 'Olympic Hotel Paddington' }, { id: 'potts-point', name: 'Potts Point' }, { id: 'central-sydney', name: 'Central Sydney' }, { id: 'darling-harbour', name: 'Darling Harbour' }]

function App() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [property, setProperty] = useState('')
  const [sentiment, setSentiment] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('23 Nov 2026, 09:41')

  const load = async () => {
    const params = new URLSearchParams()
    if (property) params.set('property', property)
    if (sentiment !== 'all') params.set('sentiment', sentiment)
    const [reviewsRes, metricsRes] = await Promise.all([fetch(`/api/reviews?${params}`), fetch('/api/metrics')])
    setReviews(await reviewsRes.json()); setMetrics(await metricsRes.json())
  }
  useEffect(() => { load() }, [property, sentiment])
  const filtered = useMemo(() => reviews.filter(r => !search || `${r.title} ${r.text} ${r.property}`.toLowerCase().includes(search.toLowerCase())).filter(r => r), [reviews, search])
  const change = metrics ? ((metrics.average - metrics.previousAverage) / (metrics.previousAverage || 1)) * 100 : 0

  const runScrape = async () => {
    setLoading(true)
    try { await fetch('/api/scrape', { method: 'POST' }); await load(); setLastUpdated(new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })) } finally { setLoading(false) }
  }
  const exportCsv = () => {
    const header = 'Date,Property,Rating,Reviewer,Country,Review\n'
    const rows = filtered.map(r => [r.date, r.property, r.rating, r.reviewer, r.country, r.text].map(v => `"${String(v).replaceAll('"', '""')}"`).join(','))
    const url = URL.createObjectURL(new Blob([header + rows.join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'azzurro-reviews.csv'; a.click(); URL.revokeObjectURL(url)
  }

  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">A</div><div><strong>Azzurro</strong><span>Review Insights</span></div></div><nav><button className="nav-item active"><BarChart3 size={18}/> Overview</button><button className="nav-item"><Star size={18}/> Reviews</button><button className="nav-item"><TrendingUp size={18}/> Trends</button></nav><div className="sidebar-footer"><span className="status-dot"/><div><strong>Collection active</strong><small>Last sync: {lastUpdated}</small></div></div></aside>
    <main>
      <header className="topbar"><div><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>Review Insights</h1></div><div className="actions"><button className="icon-button" onClick={exportCsv} title="Export CSV"><Download size={18}/></button><button className="refresh-button" onClick={runScrape} disabled={loading}><RefreshCw size={16} className={loading ? 'spinning' : ''}/>{loading ? 'Syncing...' : 'Refresh reviews'}</button></div></header>
      <section className="filters"><div className="select-wrap"><label>Property</label><select value={property} onChange={e => setProperty(e.target.value)}>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><ChevronDown size={15}/></div><div className="select-wrap"><label>Sentiment</label><select value={sentiment} onChange={e => setSentiment(e.target.value)}><option value="all">All reviews</option><option value="positive">Positive</option><option value="negative">Negative</option></select><ChevronDown size={15}/></div><div className="search-wrap"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reviews"/></div></section>
      <section className="kpi-grid">
        <article className="kpi-card featured"><div className="kpi-label"><span>Average rating</span><span className="period">THIS WEEK</span></div><div className="kpi-value">{metrics?.average.toFixed(1) ?? '—'}<span>/10</span></div><div className={`change ${change >= 0 ? 'up' : 'down'}`}>{change >= 0 ? <TrendingUp size={15}/> : <TrendingDown size={15}/>} {Math.abs(change).toFixed(1)}% <span>vs previous week</span></div></article>
        <article className="kpi-card"><div className="kpi-label">Reviews this week</div><div className="kpi-value">{metrics?.reviewCount ?? 0}</div><div className="mini-caption">{metrics?.positiveCount ?? 0} positive · {metrics?.negativeCount ?? 0} negative</div></article>
        <article className="kpi-card"><div className="kpi-label">Positive reviews</div><div className="kpi-value positive">{metrics?.positiveCount ?? 0}</div><div className="mini-caption">Rated 9.0 or higher</div></article>
        <article className="kpi-card"><div className="kpi-label">Needs attention</div><div className="kpi-value negative">{metrics?.negativeCount ?? 0}</div><div className="mini-caption">Rated 6.0 or lower</div></article>
      </section>
      <section className="analytics-grid"><article className="panel trend-panel"><div className="panel-header"><div><p>14-DAY TREND</p><h2>Positive & negative reviews</h2></div><div className="legend"><span className="positive-dot"/>Positive<span className="negative-dot"/>Negative</div></div><div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={metrics?.trend ?? []}><defs><linearGradient id="positive" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#19a974" stopOpacity={0.25}/><stop offset="95%" stopColor="#19a974" stopOpacity={0}/></linearGradient><linearGradient id="negative" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#d86565" stopOpacity={0.18}/><stop offset="95%" stopColor="#d86565" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#edf0ec" vertical={false}/><XAxis dataKey="date" tickFormatter={v => v.slice(5)} tick={{fontSize:11}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fontSize:11}} axisLine={false} tickLine={false}/><Tooltip/><Area type="monotone" dataKey="positive" stroke="#19a974" fill="url(#positive)" strokeWidth={2}/><Area type="monotone" dataKey="negative" stroke="#d86565" fill="url(#negative)" strokeWidth={2}/></AreaChart></ResponsiveContainer></div></article>
      <article className="panel topic-panel"><div className="panel-header"><div><p>NEGATIVE REVIEWS</p><h2>Recurring topics</h2></div></div><div className="topic-list">{metrics?.negativeTopics.slice(0, 5).map((item, index) => <div className="topic-row" key={item.topic}><div><span className="topic-rank">{index + 1}</span><strong>{item.topic}</strong></div><div className="topic-bar"><span style={{width: `${item.percent}%`}}/></div><b>{item.percent}%</b></div>)}</div></article></section>
      <section className="bottom-grid"><article className="panel property-panel"><div className="panel-header"><div><p>PORTFOLIO</p><h2>Rating by property</h2></div></div>{metrics?.propertyBreakdown.map(item => <div className="property-row" key={item.id}><div><strong>{item.shortName}</strong><small>{item.count} reviews</small></div><div className="rating-track"><span style={{width: `${item.average * 10}%`}}/></div><b>{item.average ? item.average.toFixed(1) : '—'}</b></div>)}</article>
      <article className="panel reviews-panel"><div className="panel-header"><div><p>GUEST FEEDBACK</p><h2>Recent reviews</h2></div><button className="filter-link"><SlidersHorizontal size={15}/> Filters</button></div><div className="review-list">{filtered.slice(0, 8).map(review => <article className="review-card" key={review.id}><div className={`sentiment-badge ${review.rating >= 9 ? 'good' : review.rating <= 6 ? 'bad' : 'neutral'}`}>{review.rating.toFixed(1)}</div><div className="review-main"><div className="review-meta"><strong>{review.property}</strong><span>{new Date(review.date).toLocaleDateString('en-AU', {day:'numeric',month:'short',year:'numeric'})}</span></div><h3>{review.title}</h3><p>{review.text}</p><small>{review.reviewer} · {review.country}</small></div></article>)}</div></article></section>
    </main>
  </div>
}
export default App
