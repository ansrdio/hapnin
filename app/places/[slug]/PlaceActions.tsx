"use client";

import { useEffect, useState } from "react";
import { mapsHref } from "@/app/components/EventMap";
import { TrackedLink } from "@/app/components/Track";

// The "what can I do next" row on a place page. Every outbound action is
// tracked (place_website_clicked, …) — these are the pilot's proof that a
// Hapnin page sent someone to the business.

const btn =
  "inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-cream transition-colors hover:border-gold hover:text-gold";

export function PlaceActions({
  placeId,
  name,
  website,
  instagram,
  phone,
  address,
  lat,
  lng,
}: {
  placeId: string;
  name: string;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}) {
  // The directions link depends on the device (Apple Maps vs Google Maps), so it's built in the browser.
  const [directions, setDirections] = useState<string | null>(null);
  useEffect(() => {
    if (address) setDirections(mapsHref({ lat, lng, label: name, address }));
  }, [address, lat, lng, name]);

  const subject = { place_id: placeId };
  if (!website && !instagram && !phone && !address) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {website && (
        <TrackedLink href={website} external name="place_website_clicked" subject={subject} className={btn} ariaLabel={`${name} website (opens in a new tab)`}>
          Website <span aria-hidden="true">↗</span>
        </TrackedLink>
      )}
      {instagram && (
        <TrackedLink href={`https://www.instagram.com/${instagram}/`} external name="place_instagram_clicked" subject={subject} className={btn} ariaLabel={`${name} on Instagram, @${instagram} (opens in a new tab)`}>
          Instagram <span aria-hidden="true">↗</span>
        </TrackedLink>
      )}
      {address && directions && (
        <TrackedLink href={directions} external name="place_directions_clicked" subject={subject} className={btn} ariaLabel={`Directions to ${name} (opens your maps app)`}>
          Directions <span aria-hidden="true">↗</span>
        </TrackedLink>
      )}
      {phone && (
        <TrackedLink href={`tel:${phone}`} external name="place_phone_clicked" subject={subject} className={btn} ariaLabel={`Call ${name}`}>
          Call
        </TrackedLink>
      )}
    </div>
  );
}
