export function buildUpiPayLink(options: {
  upiId: string;
  payeeName: string;
  amount: string;
  note?: string;
}): string {
  const params = new URLSearchParams({
    pa: options.upiId,
    pn: options.payeeName,
    am: options.amount,
    cu: "INR",
  });
  if (options.note) params.set("tn", options.note);
  return `upi://pay?${params.toString()}`;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
