export type TransactionDirection = "DEBIT" | "CREDIT";

export interface ParsedTransaction {
  direction: TransactionDirection;
  amount: string;
  merchant: string | null;
  bankName: string | null;
  lastFourDigits: string | null;
}

const AMOUNT_PATTERN = /(?:rs\.?|inr|₹)\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i;

// Money leaving the account. Phrase-based on purpose: a bare \bdebit\b or
// \bcredit\b matches boilerplate like "Credit Card" or "direct credit" that
// appears in the footer of nearly every bank email, which silently flips the
// direction of real transactions.
const DEBIT_PHRASES = [
  /\bpayment of\b/i,
  /\bmade a (?:upi )?payment\b/i,
  /\bhas been debited\b/i,
  /\bdebited\b/i,
  /\bspent\b/i,
  /\bpaid to\b/i,
  /\bwithdrawn\b/i,
  /\bwithdrawal of\b/i,
  /\bpurchase of\b/i,
];

const CREDIT_PHRASES = [
  /\bhas been credited\b/i,
  /\bcredited to\b/i,
  /\bcredited\b/i,
  /\breceived\b/i,
  /\brefund(?:ed)?\b/i,
  /\bdeposited\b/i,
  /\bcashback of\b/i,
];

// Announcements of something that hasn't happened yet (mutual fund payout
// notices, scheduled transfers). Importing these would book money that never
// moved, so they're rejected outright.
const FUTURE_TENSE = /\bwill be (?:scheduled|credited|debited|processed|transferred|paid)\b/i;

const LAST_FOUR_PATTERN = /(?:ending(?:\s+(?:in|with))?|xx+|\*{2,})\s*([0-9]{4})\b/i;

// Merchant/payee, scoped to the transaction sentence only.
const MERCHANT_PATTERNS = [
  /\btowards\s+(.+?)\s+(?:through|via|using|on|from)\b/i,
  /\bpaid to\s+(.+?)\s+(?:through|via|using|on|from)\b/i,
  /\bat\s+(.+?)\s+(?:on|using|through|via)\b/i,
  /\bto\s+(.+?)\s+(?:through|via|using|on)\b/i,
];

const BANK_NAMES = [
  "HDFC",
  "ICICI",
  "SBI",
  "Axis",
  "Kotak",
  "IndusInd",
  "IDFC First",
  "Yes Bank",
  "RBL",
  "Standard Chartered",
  "HSBC",
  "AU Small Finance",
  "Federal Bank",
  "Bank of Baroda",
  "PNB",
  "American Express",
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(text: string): string {
  return (
    text
      .replace(/\s+/g, " ")
      // "Rs. 122.00" would otherwise be split into two sentences between the
      // abbreviation and the number, hiding the amount from the parser
      // entirely. Dropping the full stop keeps the amount intact.
      .replace(/\b(rs|inr)\.\s*(?=\d)/gi, "$1 ")
      .trim()
  );
}

/** Sentences containing an amount. The only parts of the email that
 * actually describe the transaction. Everything else is greeting, footer,
 * marketing and legal boilerplate that produces false matches. Subject and
 * body usually both mention the amount, but only one of them names the
 * payee, so every candidate gets parsed and the richest result wins. */
function transactionSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => AMOUNT_PATTERN.test(s));
}

/**
 * Accepts a captured string only if it reads like a payee name rather than a
 * chunk of the surrounding sentence. The capture patterns are necessarily
 * loose (banks phrase these a dozen ways), so this is where over-capture gets
 * rejected. A wrong name is worse than no name.
 */
function cleanMerchant(raw: string): string | null {
  const merchant = raw.trim().replace(/[.,;:]+$/, "");
  if (merchant.length < 2 || merchant.length > 60) return null;
  if (merchant.split(/\s+/).length > 7) return null;
  // A sentence fragment starts with a function word; a real name doesn't.
  if (/^(your|the|this|that|a|an|of|for|to|and)\b/i.test(merchant)) return null;
  // Names don't contain amounts or transaction verbs. These mean the
  // pattern swallowed part of the sentence.
  if (AMOUNT_PATTERN.test(merchant)) return null;
  if (/\b(credited|debited|spent|paid|payment|inform|transaction)\b/i.test(merchant)) return null;
  if (/\b(any further|marketing|e-mails?|click here|unsubscribe)\b/i.test(merchant)) return null;
  return merchant;
}

/**
 * Extracts amount + direction from a bank alert email, plus best-effort
 * merchant/bank/last-4. Deliberately conservative: anything it can't read
 * confidently returns null instead of a guess, because a wrong amount or
 * direction becomes a wrong financial record the user has to find and undo.
 */
function parseSentence(sentence: string, fullText: string): ParsedTransaction | null {
  if (FUTURE_TENSE.test(sentence)) return null;

  const amountMatch = sentence.match(AMOUNT_PATTERN);
  if (!amountMatch) return null;
  const amount = amountMatch[1].replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return null;

  const isDebit = DEBIT_PHRASES.some((p) => p.test(sentence));
  const isCredit = CREDIT_PHRASES.some((p) => p.test(sentence));
  if (isDebit === isCredit) return null;

  let merchant: string | null = null;
  for (const pattern of MERCHANT_PATTERNS) {
    const match = sentence.match(pattern);
    if (match) {
      merchant = cleanMerchant(match[1]);
      if (merchant) break;
    }
  }

  // Incoming transfers name the counterparty in a structured field further
  // down the email rather than in the amount sentence.
  if (!merchant) {
    const sender = fullText.match(/\bsender name\s*:\s*(.+?)\s*(?:sender|imps|ref|remarks|upi|$)/i);
    if (sender) merchant = cleanMerchant(sender[1]);
  }

  const lastFourMatch = sentence.match(LAST_FOUR_PATTERN) ?? fullText.match(LAST_FOUR_PATTERN);

  return {
    direction: isDebit ? "DEBIT" : "CREDIT",
    amount,
    merchant,
    bankName:
      BANK_NAMES.find((bank) => new RegExp(`\\b${escapeRegExp(bank)}\\b`, "i").test(fullText)) ?? null,
    lastFourDigits: lastFourMatch ? lastFourMatch[1] : null,
  };
}

export function parseTransactionEmail(subject: string, body: string): ParsedTransaction | null {
  const text = normalize(`${subject}. ${body}`);

  let best: ParsedTransaction | null = null;
  for (const sentence of transactionSentences(text)) {
    const candidate = parseSentence(sentence, text);
    if (!candidate) continue;
    if (candidate.merchant) return candidate;
    best ??= candidate;
  }
  return best;
}
