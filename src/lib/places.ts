// Google Places API (New) — review count, rating, and the most recent
// reviews for a client's Google Business Profile.
//
// Uses a plain API key (not OAuth): Places is a public-data API, and the
// key is stored per-client in ClientIntegration.credentials like every
// other secret rather than as a global env var, so different clients can
// use different Google Cloud projects.
const PLACES_BASE = "https://places.googleapis.com/v1";

export type PlaceSummary = {
  placeId: string;
  name: string;
  rating: number | null;
  reviewCount: number;
};

export type PlaceReview = {
  author: string;
  rating: number;
  text: string;
  publishedAt: Date;
};

// Resolves a business to its stable Place ID from name + address. Used once
// at setup so nobody has to hunt for the ID by hand.
export async function findPlace(params: { apiKey: string; query: string }): Promise<PlaceSummary | null> {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": params.apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({ textQuery: params.query }),
  });
  if (!res.ok) throw new Error(`Places findPlace failed: ${res.status} ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as {
    places?: Array<{ id: string; displayName?: { text?: string }; rating?: number; userRatingCount?: number }>;
  };
  const p = json.places?.[0];
  if (!p) return null;
  return {
    placeId: p.id,
    name: p.displayName?.text ?? "",
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? 0,
  };
}

export async function fetchPlaceDetails(params: {
  apiKey: string;
  placeId: string;
}): Promise<{ summary: PlaceSummary; reviews: PlaceReview[] }> {
  const url = `${PLACES_BASE}/places/${params.placeId}?fields=id,displayName,rating,userRatingCount,reviews`;
  const res = await fetch(url, { headers: { "X-Goog-Api-Key": params.apiKey } });
  if (!res.ok) throw new Error(`Places fetchPlaceDetails failed: ${res.status} ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as {
    id: string;
    displayName?: { text?: string };
    rating?: number;
    userRatingCount?: number;
    reviews?: Array<{
      rating?: number;
      text?: { text?: string };
      originalText?: { text?: string };
      publishTime?: string;
      authorAttribution?: { displayName?: string };
    }>;
  };

  return {
    summary: {
      placeId: json.id,
      name: json.displayName?.text ?? "",
      rating: json.rating ?? null,
      reviewCount: json.userRatingCount ?? 0,
    },
    // Places returns at most ~5 reviews and gives no stable per-review id,
    // which is why ReviewItem dedupes on (author, reviewedAt).
    reviews: (json.reviews ?? []).map((r) => ({
      author: r.authorAttribution?.displayName ?? "Someone",
      rating: r.rating ?? 5,
      text: r.text?.text ?? r.originalText?.text ?? "",
      publishedAt: r.publishTime ? new Date(r.publishTime) : new Date(),
    })),
  };
}
