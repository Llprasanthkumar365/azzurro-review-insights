import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'data', 'reviews.json');
const app = express();
app.use(cors());
app.use(express.json());

const properties = [
  { id: 'paddington', name: 'Olympic Hotel Paddington', shortName: 'Paddington', url: 'https://www.booking.com/hotel/au/olympic-paddington.html' },
  { id: 'potts-point', name: 'Potts Point', shortName: 'Potts Point', url: 'https://www.booking.com/hotel/au/venus-potts-point-sydney.html' },
  { id: 'central-sydney', name: 'Central Sydney', shortName: 'Central Sydney', url: 'https://www.booking.com/hotel/au/venus-surry-hills.html' },
  { id: 'darling-harbour', name: 'Darling Harbour', shortName: 'Darling Harbour', url: 'https://www.booking.com/hotel/au/chateau-de-venus.html' }
];

function readReviews() {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function writeReviews(reviews) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(reviews, null, 2));
}

const topicRules = {
  Cleanliness: ['clean', 'dirty', 'dust', 'tidy', 'housekeeping', 'bathroom'],
  'Check-in': ['check-in', 'check in', 'reception', 'arrival', 'booking'],
  Staff: ['staff', 'receptionist', 'manager', 'friendly', 'rude', 'helpful', 'service'],
  Noise: ['noise', 'noisy', 'loud', 'sound', 'street'],
  Facilities: ['wifi', 'lift', 'elevator', 'aircon', 'air conditioning', 'parking', 'pool', 'facility'],
  Location: ['location', 'central', 'walk', 'station', 'near', 'area'],
  'Room condition': ['room', 'bed', 'shower', 'old', 'broken', 'bedroom', 'hot water'],
  'Value': ['value', 'price', 'expensive', 'money', 'cost', 'worth']
};

function classify(text) {
  const lower = text.toLowerCase();
  return Object.entries(topicRules).filter(([, words]) => words.some(word => lower.includes(word))).map(([topic]) => topic);
}
function startOfWeek(date) {
  const d = new Date(date); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - d.getDay()); return d;
}

function getMetrics(reviews) {
  const now = new Date('2026-11-23T12:00:00Z');
  const currentStart = startOfWeek(now);
  const previousStart = new Date(currentStart); previousStart.setDate(previousStart.getDate() - 7);
  const nextWeek = new Date(currentStart); nextWeek.setDate(nextWeek.getDate() + 7);
  const current = reviews.filter(r => { const d = new Date(r.date); return d >= currentStart && d < nextWeek; });
  const previous = reviews.filter(r => { const d = new Date(r.date); return d >= previousStart && d < currentStart; });
  const average = rows => rows.length ? rows.reduce((s, r) => s + r.rating, 0) / rows.length : 0;
  const negative = current.filter(r => r.rating <= 6);
  const positive = current.filter(r => r.rating >= 9);
  const topicCounts = {};
  for (const review of negative) for (const topic of classify(review.text)) topicCounts[topic] = (topicCounts[topic] || 0) + 1;
  const negativeTopics = Object.entries(topicCounts).map(([topic, count]) => ({ topic, count, percent: negative.length ? Math.round(count / negative.length * 100) : 0 })).sort((a, b) => b.count - a.count);
  const propertyBreakdown = properties.map(property => {
    const rows = current.filter(r => r.propertyId === property.id);
    return { id: property.id, name: property.name, shortName: property.shortName, average: average(rows), count: rows.length };
  });
  const trendMap = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    trendMap[d.toISOString().slice(0, 10)] = { date: d.toISOString().slice(0, 10), positive: 0, negative: 0 };
  }
  for (const review of reviews) if (trendMap[review.date]) {
    if (review.rating >= 9) trendMap[review.date].positive++;
    if (review.rating <= 6) trendMap[review.date].negative++;
  }
  return { average: average(current), previousAverage: average(previous), reviewCount: current.length, positiveCount: positive.length, negativeCount: negative.length, propertyBreakdown, negativeTopics, trend: Object.values(trendMap) };
}

async function scrapeProperty(property) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(property.url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AzzurroReviewInsights/1.0)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const found = [];
    $('[data-testid="review-card"], .review_item, [itemprop="review"]').each((_, card) => {
      const $card = $(card);
      const text = $card.find('[data-testid="review-comment"], .review_content, [itemprop="reviewBody"]').text().trim();
      const ratingText = $card.find('[data-testid="review-score"], .review-score-badge, [itemprop="ratingValue"]').text().trim().replace(',', '.');
      const rating = Number.parseFloat(ratingText);
      const dateText = $card.find('[data-testid="review-date"], .review-date, [itemprop="datePublished"]').attr('datetime') || $card.find('[data-testid="review-date"], .review-date').text().trim();
      if (text && Number.isFinite(rating) && dateText) {
        const date = new Date(dateText);
        found.push({ id: `${property.id}-${Buffer.from(`${text}-${dateText}-${rating}`).toString('base64').slice(0, 24)}`, propertyId: property.id, property: property.name, rating, date: Number.isNaN(date.getTime()) ? dateText : date.toISOString().slice(0, 10), title: text.slice(0, 80), text, reviewer: $card.find('[data-testid="reviewer-name"], .reviewer_name').text().trim() || 'Guest', country: $card.find('[data-testid="reviewer-country"], .reviewer_country').text().trim() || '', source: 'booking.com' });
      }
    });
    return { property: property.id, collected: found.length, reviews: found };
  } finally { clearTimeout(timeout); }
}

app.get('/api/properties', (_, res) => res.json(properties));
app.get('/api/reviews', (req, res) => {
  let reviews = readReviews();
  const { property, from, to, sentiment } = req.query;
  if (property) reviews = reviews.filter(r => r.propertyId === property);
  if (from) reviews = reviews.filter(r => r.date >= from);
  if (to) reviews = reviews.filter(r => r.date <= to);
  if (sentiment === 'positive') reviews = reviews.filter(r => r.rating >= 9);
  if (sentiment === 'negative') reviews = reviews.filter(r => r.rating <= 6);
  res.json(reviews.sort((a, b) => b.date.localeCompare(a.date)));
});
app.get('/api/metrics', (_, res) => res.json(getMetrics(readReviews())));
app.post('/api/scrape', async (_, res) => {
  const existing = readReviews(); const existingIds = new Set(existing.map(r => r.id)); const results = []; let added = 0;
  for (const property of properties) {
    try {
      const result = await scrapeProperty(property);
      for (const review of result.reviews) if (!existingIds.has(review.id)) { existing.push(review); existingIds.add(review.id); added++; }
      results.push(result);
    } catch (error) { results.push({ property: property.id, collected: 0, error: error.message }); }
  }
  writeReviews(existing);
  res.json({ added, results, lastUpdated: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, 'dist')));
app.use((_, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Azzurro Review Insights running at http://localhost:${port}`));
