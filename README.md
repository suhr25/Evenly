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
