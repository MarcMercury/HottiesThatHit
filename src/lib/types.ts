// Shared types used by all scrapers and the API.
// Every scraper produces ScrapedSlot[]; the runner normalizes into the DB.

export interface ScrapedFacility {
  externalId: string;
  name: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  numCourts?: number;
  surface?: string;
  lights?: boolean;
}

export interface ScrapedSlot {
  facilityExternalId: string;
  courtNumber?: string;
  startTime: Date;
  endTime: Date;
  available: boolean;
  priceCents?: number;
  bookingUrl?: string;
}

export interface ScrapeResult {
  facilities: ScrapedFacility[];
  slots: ScrapedSlot[];
}

// Every scraper implements this interface.
// `daysAhead` controls how far into the future we look.
export interface Scraper {
  sourceId: string;
  scrape(daysAhead: number): Promise<ScrapeResult>;
}
