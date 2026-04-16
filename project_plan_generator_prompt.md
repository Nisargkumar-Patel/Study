# Universal Project Plan Generator Prompt

> Paste your idea below this prompt. The AI will analyze it deeply and produce a complete execution plan — from MVP to scale — with the least budget possible.

---

## PROMPT (Copy everything below this line)

---

You are a senior technical product strategist, full-stack architect, and startup advisor with 15+ years of experience shipping products from zero to millions of users. I will give you a raw idea. Your job is to deeply analyze it and produce a **complete, actionable project plan** covering every aspect from building to scaling to marketing — optimized for the **lowest possible budget**.

### MY IDEA:

```
[PASTE YOUR IDEA HERE]
```

---

### INSTRUCTIONS — Analyze the idea above and produce ALL of the following sections:

---

## SECTION 1: IDEA DEEP ANALYSIS

### 1.1 Core Problem Statement
- What exact problem does this solve?
- Who feels this pain the most? (Be specific — job title, demographic, situation)
- How are people currently solving this problem? (Existing alternatives)
- Why do current solutions fail or fall short?

### 1.2 Value Proposition
- One-line pitch (under 15 words)
- What is the unique angle that makes this different?
- Why would someone switch from their current solution to this?

### 1.3 Feasibility Check
- Technical feasibility: Can this be built with current technology? Any blockers?
- Market feasibility: Is there proven demand? (Search volume, competitor revenue, forum complaints)
- Legal/regulatory concerns: Any compliance, licensing, or data privacy issues?
- Rate this idea: Score from 1-10 on (a) Market demand (b) Technical complexity (c) Competition level (d) Revenue potential

### 1.4 Risk Assessment
- Top 5 risks that could kill this project
- Mitigation strategy for each risk
- What assumptions are we making that could be wrong?

---

## SECTION 2: USER & MARKET RESEARCH

### 2.1 Target Audience
- Primary user persona (name, age, role, daily frustration, income level)
- Secondary user persona
- Total Addressable Market (TAM) estimate
- Serviceable Addressable Market (SAM) estimate

### 2.2 Competitor Analysis
| Competitor | What They Do Well | Where They Fail | Pricing | Monthly Traffic (est.) |
|------------|-------------------|-----------------|---------|----------------------|
| [Name]     |                   |                 |         |                      |

- Direct competitors (same solution)
- Indirect competitors (different solution, same problem)
- What gap in the market does our idea fill?

### 2.3 Pricing Strategy
- Recommend a pricing model (freemium, subscription, one-time, usage-based, ad-supported)
- Justify why this model fits
- Suggested price points with reasoning
- Revenue projection: Month 1, Month 6, Month 12 (conservative, moderate, optimistic)

---

## SECTION 3: TECHNICAL ARCHITECTURE

### 3.1 Recommended Tech Stack
Choose the **cheapest stack that scales well**. For each choice, explain WHY.

| Layer | Technology | Why This Choice | Monthly Cost |
|-------|-----------|-----------------|--------------|
| Frontend | | | |
| Backend | | | |
| Database | | | |
| Auth | | | |
| Hosting | | | |
| File Storage | | | |
| Email/Notifications | | | |
| Analytics | | | |
| CI/CD | | | |
| Monitoring | | | |

### 3.2 System Architecture Diagram
Provide an ASCII or text-based architecture diagram showing:
- Client apps → API Gateway → Backend services → Database
- Third-party integrations
- Background job processing
- Caching layer (if needed)

### 3.3 Database Schema
- List all entities/tables with key fields
- Relationships between entities
- Indexing strategy for performance

### 3.4 API Design
- List all API endpoints (method, path, description)
- Authentication flow
- Rate limiting strategy

---

## SECTION 4: API & THIRD-PARTY SERVICES CONFIGURATION

> **This section is designed so you can easily swap/edit API keys and services.**

For each external service the project needs, provide:

```
┌─────────────────────────────────────────────────────┐
│ SERVICE: [Service Name]                             │
│ PURPOSE: [What it does in your app]                 │
│ PROVIDER: [Recommended provider]                    │
│ FREE TIER: [What you get for free]                  │
│ PAID TIER: [When you'd need to pay, and how much]   │
│ SIGNUP URL: [Where to get the API key]              │
│ ENV VARIABLE: [e.g., SERVICE_API_KEY=your_key_here] │
│ ALTERNATIVES: [Other providers that do the same]    │
│ CAN SELF-HOST?: [Yes/No — if yes, how]              │
└─────────────────────────────────────────────────────┘
```

Provide this block for EVERY external dependency. Group them:

**4.1 Essential APIs** (app won't work without these)

**4.2 Enhancement APIs** (nice to have, can launch without)

**4.3 Infrastructure Services** (hosting, DB, storage, email)

**4.4 Environment Variables Template**
```env
# ============================================
# CORE SERVICES
# ============================================
DATABASE_URL=
SECRET_KEY=

# ============================================
# AUTHENTICATION
# ============================================
AUTH_PROVIDER_KEY=
AUTH_PROVIDER_SECRET=

# ============================================
# THIRD-PARTY APIs (edit these with your keys)
# ============================================
SERVICE_1_API_KEY=
SERVICE_2_API_KEY=

# ============================================
# EMAIL / NOTIFICATIONS
# ============================================
EMAIL_SERVICE_KEY=

# ============================================
# STORAGE
# ============================================
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

# ============================================
# ANALYTICS & MONITORING
# ============================================
ANALYTICS_KEY=
ERROR_TRACKING_DSN=
```

---

## SECTION 5: FEATURE BREAKDOWN & ROADMAP

### 5.1 MVP Features (Launch in 2-4 weeks)
| # | Feature | Priority | Complexity | User Story |
|---|---------|----------|------------|------------|
| 1 | | P0 - Must have | | As a [user], I want [feature] so that [benefit] |

### 5.2 Phase 2 Features (Month 2-3)
| # | Feature | Priority | Complexity | User Story |
|---|---------|----------|------------|------------|

### 5.3 Phase 3 Features (Month 4-6)
| # | Feature | Priority | Complexity | User Story |
|---|---------|----------|------------|------------|

### 5.4 Future Vision (6-12 months)
- Features that would make this a category leader
- Integration opportunities
- Platform expansion (mobile, desktop, API)

---

## SECTION 6: DEVELOPMENT EXECUTION PLAN

### 6.1 Sprint Breakdown
For each sprint (1 sprint = 1 week):

**Sprint 1: [Theme]**
- [ ] Task 1 — estimated hours
- [ ] Task 2 — estimated hours
- Deliverable: [What's working by end of sprint]

Continue for all sprints through MVP launch.

### 6.2 Development Best Practices
- Git branching strategy
- Code review process
- Testing strategy (unit, integration, e2e)
- Deployment pipeline

### 6.3 Solo Developer vs Team
- If building alone: prioritized task order, what to skip for now
- If hiring: what roles to hire first, where to find affordable developers (Upwork, Toptal, local, etc.), expected rates

---

## SECTION 7: BUDGET BREAKDOWN

### 7.1 Pre-Launch Costs
| Item | Cost | Notes |
|------|------|-------|
| Domain | | |
| Hosting (first 3 months) | | |
| API costs (estimated) | | |
| Design assets | | |
| Legal (ToS, Privacy Policy) | | |
| **TOTAL PRE-LAUNCH** | | |

### 7.2 Monthly Operating Costs
| Item | 100 Users | 1K Users | 10K Users | 100K Users |
|------|-----------|----------|-----------|------------|
| Hosting | | | | |
| Database | | | | |
| API calls | | | | |
| Email service | | | | |
| Storage | | | | |
| Monitoring | | | | |
| **TOTAL/MONTH** | | | | |

### 7.3 Cost Optimization Tips
- Free tier strategies (how to stay free as long as possible)
- When to upgrade and what triggers it
- Self-hosting options to reduce costs
- Caching strategies to reduce API calls

---

## SECTION 8: LAUNCH STRATEGY

### 8.1 Pre-Launch (2 weeks before)
- [ ] Set up landing page with email capture
- [ ] Create social media accounts
- [ ] Write 3-5 blog posts / content pieces
- [ ] Identify 10 communities where target users hang out
- [ ] Reach out to 20 potential beta testers

### 8.2 Launch Day Checklist
- [ ] Post on Product Hunt (best day/time, title formula, first comment strategy)
- [ ] Post on Hacker News (Show HN format)
- [ ] Post on relevant subreddits (list specific subreddits)
- [ ] Post on Indie Hackers
- [ ] Email beta testers and early signups
- [ ] Personal network outreach

### 8.3 First Week After Launch
- Monitor and respond to all feedback
- Fix critical bugs within hours
- Track key metrics: signups, activation, retention

---

## SECTION 9: MARKETING & GROWTH PLAN

### 9.1 Marketing Channels (ranked by ROI for low budget)

| Channel | Strategy | Cost | Expected Impact | Timeline |
|---------|----------|------|-----------------|----------|
| SEO | | Free | | 3-6 months |
| Content Marketing | | Free | | 2-4 months |
| Social Media | | Free | | 1-3 months |
| Community Building | | Free | | 1-2 months |
| Paid Ads | | $XX/day | | Immediate |
| Partnerships | | Free | | 2-3 months |
| Email Marketing | | Free tier | | Ongoing |

### 9.2 Content Strategy
- 10 blog post topics that target buyer-intent keywords
- 5 comparison posts (Your App vs Competitor)
- 3 tutorial/how-to posts
- Social media posting schedule (platform, frequency, content type)

### 9.3 SEO Strategy
- Primary keywords to target (with search volume estimates)
- Long-tail keywords for quick wins
- Technical SEO checklist
- Backlink building tactics (free methods)

### 9.4 Community & Viral Growth
- Where does your target audience hang out online? (specific forums, Discord servers, Slack groups, subreddits, Twitter/X communities)
- Referral program design
- Word-of-mouth triggers (what makes users share this?)

### 9.5 Paid Marketing (when budget allows)
- Recommended starting budget: $X/day
- Best platform to advertise on and why
- Ad creative strategy
- Target ROAS/CPA goals

---

## SECTION 10: SCALING STRATEGY

### 10.1 Technical Scaling
- When to add caching (Redis/Memcached)
- When to add a CDN
- Database scaling: read replicas, sharding triggers
- Horizontal scaling: containerization, load balancing
- Microservices: when/if to break the monolith

### 10.2 Team Scaling
- First hire recommendations
- Org structure at 5, 10, 25 people
- Culture and process recommendations

### 10.3 Business Scaling
- When to raise funding (if ever) — bootstrapping vs VC
- Partnership and integration opportunities
- Geographic expansion considerations
- Platform expansion roadmap (web → mobile → API → enterprise)

---

## SECTION 11: METRICS & KPIs

### 11.1 North Star Metric
- The ONE metric that best captures value delivered to users

### 11.2 Tracking Dashboard
| Metric | Target (Month 1) | Target (Month 3) | Target (Month 6) | Tool |
|--------|-------------------|-------------------|-------------------|------|
| Signups | | | | |
| DAU/MAU | | | | |
| Activation Rate | | | | |
| Retention (Day 7) | | | | |
| Churn Rate | | | | |
| MRR | | | | |
| CAC | | | | |
| LTV | | | | |

---

## SECTION 12: LEGAL & COMPLIANCE

- Privacy Policy requirements
- Terms of Service essentials
- Data protection (GDPR, CCPA if applicable)
- Cookie consent requirements
- Open source license considerations
- Trademark/IP considerations

---

## FORMAT RULES:
1. Be extremely specific — no vague advice like "use a good database." Name the exact tool, version, and config.
2. Every cost must have a dollar amount or "Free."
3. Every timeline must have a specific week/month number.
4. Prioritize free and open-source tools over paid ones.
5. If self-hosting saves money, explain the tradeoff.
6. Include command-line setup instructions where relevant.
7. All API/service recommendations must include the signup URL and free tier limits.
8. Write as if the reader will follow this plan step-by-step starting tomorrow.

---

## EXAMPLE USAGE:

```
### MY IDEA:

An app that lets freelancers automatically generate and send invoices 
by connecting to their time tracking tools. It should support Toggl, 
Clockify, and Harvest. Clients receive a payment link via email.
```

The AI will then produce a 3000-5000 word plan covering ALL 12 sections above, fully customized to this specific idea.

---

*This prompt template is designed to work with Claude, GPT-4, Gemini, or any capable LLM. For best results, use a model with a large context window (100K+ tokens).*
