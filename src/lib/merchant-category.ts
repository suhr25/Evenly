/**
 * Maps a merchant name from a bank alert to one of the seeded spend
 * categories.
 *
 * Deliberately a keyword table rather than an AI call: categorisation runs on
 * every imported transaction, so it must be instant, free, and above all
 * reproducible. The same merchant always lands in the same category, which
 * matters because these totals feed budgets.
 *
 * Returns null when nothing matches, which the caller turns into "Other".
 * Guessing wrongly is worse than not guessing: a misfiled expense silently
 * skews a budget, whereas "Other" is visibly unsorted and easy to correct.
 */

/** Must match category names seeded in prisma/seed.ts. */
export type CategoryName =
  | "Food"
  | "Grocery"
  | "Transport"
  | "Travel"
  | "Fuel"
  | "Shopping"
  | "Entertainment"
  | "Bills"
  | "Utilities"
  | "Health"
  | "Education";

/**
 * Order matters: the first matching rule wins, so specific merchants must
 * precede generic keywords. Fuel is checked before Transport because "Indian
 * Oil" is a fuel purchase, not a commute; Grocery precedes Shopping because
 * "DMart" is groceries despite matching a generic retail keyword.
 */
const RULES: ReadonlyArray<{ category: CategoryName; pattern: RegExp }> = [
  {
    category: "Fuel",
    pattern:
      /\b(petrol|diesel|fuel|hp\s*petrol|hpcl|indian\s*oil|indianoil|iocl|bharat\s*petroleum|bpcl|reliance\s*petro|shell\s*(petrol|fuel)?|nayara|essar)\b/i,
  },
  {
    category: "Grocery",
    pattern:
      /\b(zepto|blinkit|grofers|bigbasket|big\s*basket|dmart|d[-\s]?mart|jiomart|jio\s*mart|instamart|reliance\s*fresh|spencer|nature'?s\s*basket|kirana|provision|supermarket|super\s*market|grocer|grocery|vegetable|fruits?|dairy|milk|amul|mother\s*dairy)\b/i,
  },
  {
    category: "Food",
    pattern:
      /\b(swiggy|zomato|eatsure|faasos|behrouz|ovenstory|domino'?s|dominos|pizza\s*hut|mcdonald|kfc|burger\s*king|subway|starbucks|costa|cafe|caf[eé]|coffee|chai|restaurant|resto|dhaba|biryani|bakery|sweets|juice|barbeque|bbq|samosa|chaat|nukkad|bhavan|udupi|darshini|food|kitchen|eats|snack|tiffin|mess|canteen|brew|brews|foods|swish|munchmart|indori|rolls?|momos?|paratha|idli|dosa|thali|kulfi|icecream|ice\s*cream|baskin|naturals)\b/i,
  },
  {
    category: "Travel",
    pattern:
      /\b(irctc|railway|indigo|spicejet|air\s*india|vistara|akasa|goair|akasaair|makemytrip|make\s*my\s*trip|goibibo|cleartrip|yatra|ixigo|easemytrip|redbus|red\s*bus|abhibus|oyo|airbnb|booking\.com|treebo|fabhotels|hotel\b|resort|lodge|hostel)\b/i,
  },
  {
    category: "Transport",
    pattern:
      /\b(uber|ola\b|olacabs|rapido|namma\s*yatri|blusmart|blu\s*smart|metro|dmrc|bmtc|best\b|parking|toll|fastag|cab|taxi|auto\s*rickshaw|yulu|bounce|vogo)\b/i,
  },
  {
    category: "Utilities",
    pattern:
      /\b(electricity|bescom|mseb|msedcl|tneb|kseb|adani\s*electricity|tata\s*power|torrent\s*power|cesc|gas\s*(bill|agency)?|indane|hp\s*gas|bharatgas|water\s*board|jal\s*board|broadband|act\s*fibernet|hathway|excitel|tikona)\b/i,
  },
  {
    category: "Bills",
    pattern:
      /\b(airtel|jio\b|vodafone|\bvi\b|bsnl|mtnl|tata\s*play|dish\s*tv|d2h|recharge|postpaid|prepaid|insurance|premium|\blic\b|policybazaar|rent\b|maintenance|society|emi\b|loan\b)\b/i,
  },
  {
    category: "Health",
    pattern:
      /\b(apollo|pharmeasy|1mg|tata\s*1mg|netmeds|medplus|med\s*plus|wellness\s*forever|pharmacy|chemist|medical|hospital|clinic|nursing\s*home|diagnostic|pathology|dental|dentist|doctor|physio|gym|fitness|cult\.?fit|cultfit|healthkart|optical|eye\s*care)\b/i,
  },
  {
    category: "Education",
    pattern:
      /\b(udemy|coursera|unacademy|byju'?s?|vedantu|upgrad|simplilearn|great\s*learning|scaler|newton\s*school|physics\s*wallah|college|university|school|institute|academy|tuition|coaching|course|exam\s*fee|library|bookstore|book\s*store)\b/i,
  },
  {
    category: "Entertainment",
    pattern:
      /\b(netflix|prime\s*video|hotstar|disney|sonyliv|sony\s*liv|zee5|jiocinema|jio\s*cinema|spotify|gaana|wynk|youtube\s*premium|bookmyshow|book\s*my\s*show|\bpvr\b|inox|cinepolis|cinema|multiplex|gaming|steam|playstation|xbox|nintendo)\b/i,
  },
  {
    category: "Shopping",
    pattern:
      /\b(amazon|flipkart|myntra|ajio|meesho|nykaa|tatacliq|tata\s*cliq|snapdeal|shopsy|decathlon|lifestyle|pantaloons|westside|zara|uniqlo|croma|reliance\s*digital|vijay\s*sales|ikea|home\s*centre|urban\s*ladder|pepperfry|mr\s*diy|health\s*(and|&)\s*glow|store|mart|retail|enterprises|traders|appliance|electronics|boutique|fashion|apparel|footwear)\b/i,
  },
];

export function categoriseMerchant(merchant: string | null | undefined): CategoryName | null {
  if (!merchant) return null;
  const name = merchant.trim();
  if (name.length < 2) return null;

  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  return null;
}
