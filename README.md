# Evenly

> A modern personal finance platform to track, understand, and manage your money from one place.

Evenly is a full-stack personal finance management platform designed to give users a clear view of their financial life through a single, intuitive dashboard.

Instead of simply showing account balances, Evenly helps users understand their spending patterns, track transactions, manage budgets, monitor financial goals, and make better decisions with their money.

---

## Features

### Financial Dashboard

Get a complete overview of your finances from one place.

- Total balance overview
- Income and expense tracking
- Spending breakdown
- Recent transactions
- Financial summaries
- Visual charts and insights

### Transaction Management

Keep track of everyday financial activity.

- Add income and expenses
- Categorize transactions
- Edit and delete transactions
- Search and filter transactions
- Track transaction history

### Spending Analytics

Understand where your money is going.

- Category-wise spending
- Income vs. expenses
- Spending trends
- Interactive visualizations
- Financial summaries

### Budget & Goal Tracking

Create better financial habits by setting targets.

- Set spending budgets
- Track financial goals
- Monitor progress
- View remaining budget
- Track progress over time

### Secure Authentication

Evenly uses Google authentication to provide a simple and secure sign-in experience.

- Google OAuth
- Auth.js
- Secure server-side sessions
- User-specific financial data

### AI-Powered Financial Insights

Evenly integrates AI capabilities to help turn financial data into useful insights.

- Analyze spending patterns
- Generate financial summaries
- Provide contextual insights
- Help users understand their financial behaviour

### Receipt Storage

Receipts can be associated with transactions and stored using object storage.

- S3-compatible storage
- Receipt upload support
- Transaction-linked receipts
- Storage abstraction for local development

### PayPal Sandbox Demo

Suggested settlements have a **Pay with PayPal** button (marked *PayPal Sandbox Demo*) next to the existing UPI, reminder and **Mark as paid** options, which are unchanged.

> **What this is, and is not.** The payer's sandbox payment goes to the *configured sandbox merchant account*. It does **not** transfer money to the other group member, and Evenly does not implement peer-to-peer payouts. Evenly uses the verified PayPal capture as proof of payment so the normal settlement logic (balances, income sync) can record it.

**Flow**

1. A signed-in group member clicks *Pay with PayPal*. `POST /api/groups/:id/paypal/orders` takes only the recipient member id. The server checks group membership, derives the payer from the session, computes the amount from current balances, and creates a PayPal Orders v2 order.
2. The dialog shows the original amount, the sandbox charge and the demo rate (if converted) *before* approval. The buyer approves through PayPal's JS SDK.
3. `POST /api/groups/:id/paypal/capture` re-reads the order from PayPal, checks reference, merchant, amount and currency, re-checks that balances have not changed, captures, verifies the capture is `COMPLETED`, and only then records the settlement.

**Currency handling.** PayPal's [supported currency list](https://developer.paypal.com/docs/reports/reference/paypal-supported-currencies/) does not include INR, and Evenly defaults to INR. Evenly never relabels INR as USD and has no built-in rate. The charge is made in `PAYPAL_CHARGE_CURRENCY` using the fixed `PAYPAL_DEMO_EXCHANGE_RATE` you configure (INR per 1 USD, for example `83`; this is not a market rate). Without a rate, a group whose currency differs from the charge currency cannot use PayPal. Both amounts, both currencies and the rate are stored on `PayPalPayment`; the settlement is recorded in the original currency. A group's currency is the paying user's profile currency, as elsewhere in Evenly.

**Safety properties**

- Credentials and access tokens stay on the server; only `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is public. `PAYPAL_BASE_URL` must be the sandbox host.
- Idempotency: `PayPal-Request-Id` is derived from the payment row for both order creation and capture; a partial unique index allows one open attempt per group/payer/recipient; order, capture and settlement ids are unique. Double clicks and retries converge on one order, one capture, one settlement.
- Pending captures record nothing until PayPal reports `COMPLETED` (press *Check status*). Declined payments mark the attempt `FAILED`. An unapproved order can simply be abandoned; reopening the dialog reuses it, or replaces it if the amount changed or it is over two hours old.
- If PayPal captured but the database write failed, the row stays `CAPTURED`; retrying reconciles it without a second capture call.
- If balances change before capture, no charge is made (`CANCELLED`). If they change after capture, no settlement is recorded and the attempt becomes `NEEDS_REVIEW` with a reason, so it can be refunded from the sandbox dashboard rather than silently recorded wrongly.

**Setup**

1. Sign in at <https://developer.paypal.com/dashboard/> and open **Apps & Credentials**, **Sandbox** tab.
2. Create an app (type *Merchant*) or use *Default Application*. Copy its **Client ID** and **Secret**.
3. Open **Testing tools > Sandbox accounts**. Note the *Business* account's **Merchant ID** (account details) — this is the account that receives payments. Use a *Personal* sandbox account as the buyer.
4. Fill in `.env` (see `.env.example`): `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID`, `PAYPAL_DEMO_EXCHANGE_RATE` (and optionally `PAYPAL_CHARGE_CURRENCY`). `NEXT_PUBLIC_*` is inlined at build time, so restart `npm run dev` / rebuild after changing it.
5. Apply the migration: `npx prisma migrate deploy` (or `npm run db:migrate` in development). It adds the `PayPalPayment` table and a hand-written partial unique index.

**End-to-end demo**

1. Create a group with two members who each have an Evenly account, and add an expense so one owes the other.
2. As the member who owes, open the group and click **Pay with PayPal** on the suggested settlement.
3. Check the amounts and demo rate, then log in with the sandbox *Personal* buyer account and approve.
4. Confirm the settlement appears in history, balances update, and the recipient sees the income entry. In the sandbox Business account's activity, the payment appears as received by the merchant.

Automated tests (`npm test`) use mocked PayPal and database layers. A real sandbox payment has to be verified manually with your own credentials.

### Responsive Experience

The application is designed to work across:

- Desktop
- Tablet
- Mobile

---

# Architecture

```text
                         ┌─────────────────────┐
                         │      User           │
                         │  Desktop / Mobile   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   AWS Amplify       │
                         │   Next.js Hosting   │
                         └──────────┬──────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
          ┌─────────────────┐             ┌─────────────────┐
          │    Auth.js      │             │   Application   │
          │  Google OAuth   │             │     Server      │
          └─────────────────┘             └────────┬────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────────┐
                                        │       Prisma        │
                                        │        ORM          │
                                        └──────────┬──────────┘
                                                   │
                                                   ▼
                                        ┌─────────────────────┐
                                        │     AWS RDS         │
                                        │     PostgreSQL      │
                                        └─────────────────────┘

                                                   │
                                                   ▼
                                        ┌─────────────────────┐
                                        │      Amazon S3      │
                                        │  Receipt Storage    │
                                        └─────────────────────┘
