// CLI for running scrapers locally. Examples:
//   npm run scrape:la-rec
//   npm run scrape:all
// Loads .env.local automatically via dotenv.

import { config as loadEnv } from 'dotenv';
loadEnv({ path: '.env.local' });
loadEnv(); // also load plain .env if present

import { laRecScraper } from './la_rec';
import { runScraper } from './runner';
import { Scraper } from '../lib/types';

const scrapers: Record<string, Scraper> = {
  la_rec: laRecScraper,
  // santa_monica: santaMonicaScraper,  // coming next
};

async function main() {
  const target = process.argv[2] ?? 'all';
  const targets = target === 'all' ? Object.keys(scrapers) : [target];

  for (const t of targets) {
    const scraper = scrapers[t];
    if (!scraper) {
      console.error(`Unknown scraper: ${t}`);
      continue;
    }
    console.log(`\n=== Running ${t} ===`);
    try {
      const result = await runScraper(scraper, 7);
      console.log(`  ✓ ${result.facilities} facilities, ${result.slots} slots, ${result.available} available`);
    } catch (err) {
      console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
