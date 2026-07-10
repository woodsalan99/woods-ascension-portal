"use client";

import { useId, useState } from "react";

export function CampaignPicker({
  campaigns,
  defaultName = "",
  defaultId = "",
}: {
  campaigns: { id: number; name: string }[];
  defaultName?: string;
  defaultId?: string;
}) {
  const listId = useId();
  const [name, setName] = useState(defaultName);
  const [campaignId, setCampaignId] = useState(defaultId);

  return (
    <>
      <input
        list={listId}
        name="name"
        placeholder="Campaign name"
        className="border p-1"
        value={name}
        onChange={(e) => {
          const value = e.target.value;
          setName(value);
          const match = campaigns.find((c) => c.name === value);
          if (match) setCampaignId(String(match.id));
        }}
        required
      />
      <datalist id={listId}>
        {campaigns.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <input
        name="smartleadCampaignId"
        placeholder="Smartlead campaign ID"
        className="border p-1"
        value={campaignId}
        onChange={(e) => setCampaignId(e.target.value)}
        required
      />
    </>
  );
}
