# NotiLab — Admin Panel

## Overview

The NotiLab admin panel is a complete content-management and digital-marketing system, designed to support the different roles and workflows of a modern newsroom.

## System Access

### Access URLs
- **Admin panel**: `/admin`
- **Admin login**: `/admin/login`

### Test Credentials

> ⚠️ **Security notice (2026-09-04).** The credentials this section used to list (`admin@notilab.com` / `admin123`) do **not** match the code. `app/api/admin/auth/route.ts` authenticates against a hardcoded three-entry array in which all three accounts share the published bcrypt test-vector hash for the string `password`, with no `NODE_ENV` gate — so those accounts work in production, and the password is `password`, not `admin123`. `lib/admin-auth.ts` additionally falls back to the literal `"your-secret-key"` when `JWT_SECRET` is unset, which means admin tokens can be forged.
>
> This is a live defect tracked as **ROADMAP #23**, not a documentation error to paper over. The real credentials are deliberately not restated here. Once #23 lands, staff accounts move to the database and this section should describe the seeding process instead.

## Roles and Permissions

### 1. **REDATOR** (Writer)
- Create and edit news drafts
- Use AI tools for content generation
- Submit articles for review
- Access the automated research system

### 2. **REVISOR** (Reviewer)
- Review submitted articles
- Approve or reject content
- Add comments and feedback
- Edit content during review

### 3. **SUPERVISOR**
- Full system access
- User and permission management
- Final content approval
- Access to all metrics and analytics

### 4. **MARKETING**
- Digital marketing tools
- Campaign and newsletter management
- Engagement analytics
- A/B testing and optimisation

### 5. **CRIADOR_CONTEUDO** (Content Creator)
- Multimedia content creation
- Image and asset management
- Templates and layouts
- Collaboration with writers

## Core Features

### 🏠 Main Dashboard
- **Real-time metrics**: active users, published articles, views
- **Interactive charts**: user and content analytics
- **Activity feed**: latest actions in the system
- **Pending tasks**: by role and priority

### 📝 Content Management System (CMS)
- **Rich editor**: advanced formatting with preview
- **Category management**: customisable colours and organisation
- **Image upload**: drag & drop with automatic optimisation
- **Tags and metadata**: SEO and organisation
- **Scheduling**: programmed publication

### 🤖 AI News Generator
- **Trend analysis**: trending topics detected automatically
- **Automated researcher**: finds sources and references
- **Professional templates**: different article styles
- **Custom generation**: driven by specific prompts
- **Quality analysis**: SEO and readability metrics

### 🔄 Workflow System
- **Visual kanban**: drag and drop between stages
- **Review queue**: organised by priority and deadline
- **Comment system**: structured feedback
- **Full history**: every change tracked
- **Notifications**: automatic alerts per role

### 📊 Marketing Tools
- **Complete analytics**: engagement and conversion metrics
- **Campaign management**: email marketing and automation
- **Social media**: post scheduling and analysis
- **SEO tools**: optimisation and monitoring
- **A/B testing**: conversion tests and optimisation
- **Lead management**: integrated CRM with scoring

## System Navigation

### Main Sidebar
\`\`\`
📊 Dashboard
📝 News Management
🏷️ Categories
🤖 AI Generator
🔄 Workflow
👥 Users (Supervisor)
📈 Marketing
⚙️ Settings
\`\`\`

### Keyboard Shortcuts
- `Ctrl + N`: New article
- `Ctrl + S`: Save draft
- `Ctrl + P`: Preview
- `Ctrl + Enter`: Submit for review

## Content Workflow

### 1. **Creation** (Writer)
- Use the AI generator or write manually
- Add images and formatting
- Configure metadata and SEO
- Save as a draft

### 2. **Review** (Reviewer)
- Receive a notification of new content
- Review quality and accuracy
- Add comments where needed
- Approve or request changes

### 3. **Final Approval** (Supervisor)
- Final content review
- Compliance check
- Schedule publication
- Publish to the site

### 4. **Marketing** (Marketing)
- Create promotional campaigns
- Schedule social media posts
- Configure newsletters
- Monitor performance

## Integrations and APIs

### AI and Automation
- **OpenAI GPT**: content generation
- **Sentiment analysis**: automatic classification
- **Keyword extraction**: automatic SEO
- **Smart summaries**: automatic TL;DR

### Social Networks
- **Twitter/X**: automatic posts
- **Facebook**: integrated campaigns
- **LinkedIn**: professional content
- **Instagram**: stories and posts

### Analytics
- **Google Analytics**: full integration
- **Custom metrics**: specific KPIs
- **Automatic reports**: sent by email
- **Custom dashboards**: per role

## Advanced Settings

### Personalisation
- **Themes**: dark/light mode
- **Languages**: PT, EN, ES
- **Notifications**: email, push, in-app
- **Workflows**: customisable per category

### Security
- **JWT authentication**: signed tokens
- **Granular roles**: specific permissions
- **Full audit trail**: every action logged
- **Automatic backup**: data protected

> ⚠️ See the security notice under **Test Credentials** above. Two of the four
> claims in this subsection are currently weaker in practice than they read:
> JWT signing falls back to a published literal, and the role check in
> `lib/admin-auth.ts` treats every listed role as sufficient for any admin
> route — there is no per-route role granularity today.

## Metrics and KPIs

### Content
- **Published articles**: by period and author
- **Approval rate**: workflow efficiency
- **Average time**: creation to publication
- **Engagement**: views, likes, shares

### Users
- **Productivity**: articles per writer
- **Quality**: approval rate
- **Collaboration**: comments and feedback
- **Performance**: individual metrics

### Marketing
- **ROI**: return on investment
- **Conversions**: conversion rate
- **Reach**: impressions and reach
- **Engagement**: interactions and time on page

## Support and Maintenance

### Backup and Recovery
- **Automatic backup**: daily at 02:00
- **Versioning**: change history
- **Recovery**: point-in-time recovery
- **Export**: data in JSON/CSV

### Monitoring
- **Health checks**: system status
- **Performance**: speed metrics
- **Errors**: centralised log
- **Alerts**: automatic notifications

### Updates
- **Automatic deploy**: CI/CD pipeline
- **Rollback**: safe reversion
- **Feature flags**: gradual rollout
- **Tests**: staging environment

## Troubleshooting

### Common Problems
1. **Login not working**: check credentials and role
2. **Upload fails**: check file size and format
3. **AI not responding**: check API keys
4. **Workflow stuck**: check permissions

### Logs and Debugging
- **Admin logs**: `/admin/logs`
- **API status**: `/admin/health`
- **Performance**: `/admin/metrics`
- **Errors**: browser console

## Contact and Support

For technical support or questions about the system:
- **Email**: admin@notilab.com
- **Slack**: #notilab-admin
- **Documentation**: `/admin/docs`
- **Status**: status.notilab.com
