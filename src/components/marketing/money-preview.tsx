import { SpendingActivity } from "@/components/dashboard/spending-activity";

const months = [
  { name: "September", income: 60000, days: [1200,850,0,2400,950,1860,980,790,3200,430,680,920,0,2200,710,350,1780,620,490,950,3100,620,950,1190,2500,590,900,2160,950,3070] },
  { name: "October", income: 65000, days: [820,1200,540,2750,630,1450,890,470,3200,750,1050,1650,450,900,1980,320,760,2800,1150,680,1260,720,3100,980,810,1320,730,2150,1270,580,1690] },
  { name: "November", income: 65000, days: [640,920,1320,480,2710,680,1420,760,990,1620,840,2600,390,980,1150,640,1530,2170,520,1830,610,1090,3300,460,980,1200,850,1520,610,1670] },
];

export function MoneyPreview() {
  return <SpendingActivity months={months} currency="INR" initialMonth={1} sample />;
}
