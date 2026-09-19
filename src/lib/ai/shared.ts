export const DEFAULT_CATEGORIES = [
  "Food",
  "Shopping",
  "Transport",
  "Entertainment",
  "Bills",
  "Health",
  "Education",
  "Other",
];

export function extractJson<T>(text: string): T {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error("AI response did not contain JSON");
  return JSON.parse(match[0]) as T;
}
