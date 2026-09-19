import { describe, expect, it } from "vitest";
import { parseTransactionEmail } from "@/lib/transaction-parser";

describe("parseTransactionEmail — real Kotak811 UPI alerts", () => {
  // Verbatim shape of the emails this actually mis-parsed in production:
  // every one of these was booked as a CREDIT (money in) when they are
  // payments going out, because the footer contained the word "credit".
  const upiBody = (amount: string, payee: string) =>
    `If you are unable to view the below e-mailer, please click here . Dear customer, You have successfully made a UPI payment of INR ${amount} towards ${payee} through the Kotak811 App. More details below. UPI ID: paytm.s21dyii@pty Date: 21-Aug-26 UPI Reference Number: 659931290315 Have concerns regarding this payment? Visit https://kapps.kotak.com/FraudPreLogin or call us at 1860 266 0811 to report. Digitally yours, Kotak811 Copyright Disclaimer Privacy Policy`;

  it("reads a UPI payment as a DEBIT, not a credit", () => {
    const result = parseTransactionEmail("Kotak811 - UPI payment", upiBody("140.00", "ANIL"));
    expect(result).toMatchObject({
      direction: "DEBIT",
      amount: "140.00",
      merchant: "ANIL",
      bankName: "Kotak",
    });
  });

  it("extracts multi-word merchant names", () => {
    expect(parseTransactionEmail("alert", upiBody("760.00", "MAHANANDI HOSPITAL"))).toMatchObject({
      direction: "DEBIT",
      amount: "760.00",
      merchant: "MAHANANDI HOSPITAL",
    });
    expect(
      parseTransactionEmail("alert", upiBody("220.00", "New Prakash Home appliance"))
    ).toMatchObject({ merchant: "New Prakash Home appliance" });
  });

  it("never picks up unsubscribe footer text as the merchant", () => {
    const result = parseTransactionEmail("alert", upiBody("60.00", "CHANDRAKALA"));
    expect(result?.merchant).toBe("CHANDRAKALA");
    expect(result?.merchant).not.toMatch(/marketing|e-mails/i);
  });

  it("still finds the payee when the subject line also contains the amount", () => {
    // Regression: the subject sentence has the amount and the direction but
    // no payee, so locking onto the first amount-bearing sentence dropped
    // every merchant name in production.
    const result = parseTransactionEmail(
      "UPI payment of INR 140.00 was successful",
      upiBody("140.00", "ANIL")
    );
    expect(result).toMatchObject({ direction: "DEBIT", amount: "140.00", merchant: "ANIL" });
  });

  it("skips a mutual fund payout notice — the money hasn't moved yet", () => {
    const body =
      "Dear Suhrid Marwah, Your redemption request in Kotak MNC Fund Regular Plan - Growth has been processed with a value date of 04-Sep-2026 for 35.667 Units and payout for Rs.443.45 will be scheduled on 08-Sep-2026. In case you have opted for direct credit, then the redemption proceeds will be directly credited to your bank account as per the mandate provided by you. In case of NRIs redemption is subject to deduction of tax at source.";
    expect(parseTransactionEmail("Redemption confirmation", body)).toBeNull();
  });
});

describe("parseTransactionEmail — card and account alerts", () => {
  it("parses a card-spend debit alert", () => {
    const result = parseTransactionEmail(
      "Transaction alert",
      "Rs.500.00 spent on your HDFC Bank Card ending 1234 at AMAZON on 12-01-25."
    );
    expect(result).toMatchObject({
      direction: "DEBIT",
      amount: "500.00",
      merchant: "AMAZON",
      bankName: "HDFC",
      lastFourDigits: "1234",
    });
  });

  it("parses an account credit alert", () => {
    const result = parseTransactionEmail(
      "Credit Alert",
      "Your ICICI Bank A/c XX5678 has been credited with INR 15,000.00 on 02-02-25."
    );
    expect(result).toMatchObject({
      direction: "CREDIT",
      amount: "15000.00",
      bankName: "ICICI",
      lastFourDigits: "5678",
    });
  });

  it("is not fooled by a 'Credit Card' footer on a debit", () => {
    const result = parseTransactionEmail(
      "Alert",
      "Rs.250.00 has been debited from your account. Manage your Credit Card preferences online. Credit Card customers can call 1800-000-000."
    );
    expect(result?.direction).toBe("DEBIT");
  });
});

describe("parseTransactionEmail — real bank credit alerts", () => {
  it("reads an IMPS credit where the amount is written 'Rs. 122.00'", () => {
    // Regression: the full stop in "Rs." split the sentence before the
    // number, so the amount vanished and the email was silently dropped.
    const result = parseTransactionEmail(
      "IMPS Credit Transaction",
      "Dear SUHRID MARWAH We wish to inform you that your account xx0574 is credited by Rs. 122.00 on 11-Aug-2026 for IMPS transaction. Please find the details as below: Sender Name: NAVI REDEMPTION ACCOUNT API Sender Mobile No: 919XXXX20154 IMPS Reference No: 622382144100"
    );
    expect(result).toMatchObject({
      direction: "CREDIT",
      amount: "122.00",
      merchant: "NAVI REDEMPTION ACCOUNT API",
      lastFourDigits: "0574",
    });
  });

  it("reads a UPI reversal credit", () => {
    const result = parseTransactionEmail(
      "Notification regarding your recent UPI transaction !",
      "Dear Customer, Rs. 1.00 is credited to your Kotak Bank Account XXXXXX0574 for reversal of UPI transaction 658997437546."
    );
    expect(result).toMatchObject({ direction: "CREDIT", amount: "1.00", bankName: "Kotak" });
  });

  it("does not import a failed payment", () => {
    expect(
      parseTransactionEmail(
        "Payment failed for ZAVE SHOPPING TECH PRIVATE LIMITED",
        "Your payment of Rs. 499.00 to ZAVE SHOPPING TECH PRIVATE LIMITED has failed and will be credited back."
      )
    ).toBeNull();
  });
});

describe("parseTransactionEmail — refuses to guess", () => {
  it("returns null when there is no amount", () => {
    expect(parseTransactionEmail("Statement ready", "Your monthly statement is now available.")).toBeNull();
  });

  it("returns null when the amount sentence has no direction language", () => {
    expect(parseTransactionEmail("Reminder", "Your bill of Rs.500.00 is due on 10-01-25.")).toBeNull();
  });

  it("returns null when the sentence is both debit and credit", () => {
    expect(
      parseTransactionEmail("Refund", "Rs.200.00 debited earlier has now been refunded to you.")
    ).toBeNull();
  });

  it("never fabricates merchant or last-4 when absent", () => {
    const result = parseTransactionEmail("Debit alert", "Rs.750.00 debited from your account.");
    expect(result).toMatchObject({ direction: "DEBIT", amount: "750.00", merchant: null, lastFourDigits: null });
  });

  it("rejects a zero amount", () => {
    expect(parseTransactionEmail("Alert", "Rs.0.00 debited from your account.")).toBeNull();
  });

  it("handles the rupee symbol and comma-separated thousands", () => {
    const result = parseTransactionEmail("Alert", "₹12,345.67 credited to your SBI account.");
    expect(result).toMatchObject({ direction: "CREDIT", amount: "12345.67", bankName: "SBI" });
  });
});
