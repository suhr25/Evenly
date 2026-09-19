"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { AddCardDialog } from "@/components/cards/add-card-dialog";
import { MyCardsClient } from "@/components/cards/my-cards-client";
import { BestCardClient } from "@/components/recommendations/best-card-client";
import { DiscoverCardsClient } from "@/components/discovery/discover-cards-client";

type CardsTab = "my-cards" | "best-card" | "discover";

function parseTab(value: string | null): CardsTab {
  return value === "best-card" || value === "discover" ? value : "my-cards";
}

const TAB_DESCRIPTIONS: Record<CardsTab, string> = {
  "my-cards": "The cards you own. Recommendations only ever come from this list.",
  "best-card": "Tell us what you're buying. We'll pick the best of your own cards for it.",
  discover:
    "Cards you don't currently own. Nothing here is added to your portfolio unless you add it yourself.",
};

export function CardsTabsClient({ currency }: { currency: string }) {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<CardsTab>(() => parseTab(searchParams.get("tab")));

  return (
    <div className="flex flex-col gap-6 pb-16 md:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cards</h1>
          <p className="text-sm text-muted-foreground">{TAB_DESCRIPTIONS[tab]}</p>
        </div>
        {tab === "my-cards" && <AddCardDialog />}
      </div>

      <Tabs value={tab} onValueChange={(v) => v && setTab(v as CardsTab)}>
        <AnimatedTabs
          aria-label="Cards view"
          items={[
            { value: "my-cards", label: "My Cards" },
            { value: "best-card", label: "Best Card" },
            { value: "discover", label: "Discover" },
          ]}
          value={tab}
          onValueChange={(v) => setTab(v as CardsTab)}
        />

        <TabsContent value="my-cards" className="flex flex-col gap-4">
          <MyCardsClient currency={currency} />
        </TabsContent>
        <TabsContent value="best-card" className="flex flex-col gap-4">
          <BestCardClient currency={currency} />
        </TabsContent>
        <TabsContent value="discover" className="flex flex-col gap-4">
          <DiscoverCardsClient currency={currency} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
