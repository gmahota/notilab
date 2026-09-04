# NotiLab - Admin Panel

## Overview

The NotiLab admin panel is a complete content management and digital marketing system, designed to support the different roles and workflows of a modern newsroom.

## Accessing the System

### Access URL
- **Admin Panel**: `/admin`
- **Admin Login**: `/admin/login`

### Test Credentials
\`\`\`
Email: admin@notilab.com
Password: admin123
Role: SUPERVISOR
\`\`\`

## Roles and Permissions

### 1. **REDATOR** (Writer)
- Create and edit news drafts
- Use AI tools for content generation
- Submit articles for review
- Access to the automatic research system

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
- A/B testing and optimization

### 5. **CRIADOR_CONTEUDO** (Content Creator)
- Multimedia content creation
- Image and asset management
- Templates and layouts
- Collaboration with writers

## Main Features

### 🏠 Main Dashboard
- **Real-time metrics**: Active users, published news, views
- **Interactive charts**: User and content analytics
- **Activity feed**: Latest actions in the system
- **Pending tasks**: By role and priority

### 📝 Content Management System (CMS)
- **Rich editor**: Advanced formatting with preview
- **Category management**: Customizable colors and organization
- **Image upload**: Drag & drop with automatic optimization
- **Tags and metadata**: SEO and organization
- **Scheduling**: Scheduled publication

### 🤖 AI News Generator
- **Trend analysis**: Trending topics automatically
- **Automatic researcher**: Search for sources and references
- **Professional templates**: Different article styles
- **Custom generation**: Based on specific prompts
- **Quality analysis**: SEO and readability metrics

### 🔄 Workflow System
- **Visual Kanban**: Drag and drop between stages
- **Review queue**: Organized by priority and deadline
- **Comment system**: Structured feedback
- **Full history**: Tracking of all changes
- **Notifications**: Automatic alerts by role

### 📊 Marketing Tools
- **Full analytics**: Engagement and conversion metrics
- **Campaign management**: Email marketing and automation
- **Social media**: Post scheduling and analysis
- **SEO tools**: Optimization and monitoring
- **A/B testing**: Conversion and optimization testing
- **Lead management**: Integrated CRM with scoring

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
- Use the AI generator or create manually
- Add images and formatting
- Configure metadata and SEO
- Save as draft

### 2. **Review** (Reviewer)
- Receive notification of new content
- Review quality and accuracy
- Add comments if needed
- Approve or request changes

### 3. **Final Approval** (Supervisor)
- Final content review
- Compliance check
- Publication scheduling
- Publish on the site

### 4. **Marketing** (Marketing)
- Create promotional campaigns
- Schedule social media posts
- Configure newsletters
- Monitor performance

## Integrations and APIs

### AI and Automation
- **OpenAI GPT**: Content generation
- **Sentiment analysis**: Automatic classification
- **Keyword extraction**: Automatic SEO
- **Smart summaries**: Automatic TL;DR

### Social Media
- **Twitter/X**: Automatic posts
- **Facebook**: Integrated campaigns
- **LinkedIn**: Professional content
- **Instagram**: Stories and posts

### Analytics
- **Google Analytics**: Full integration
- **Custom metrics**: Specific KPIs
- **Automatic reports**: Sent by email
- **Custom dashboards**: By role

## Advanced Settings

### Customization
- **Themes**: Dark/Light mode
- **Languages**: PT, EN, ES
- **Notifications**: Email, push, in-app
- **Workflows**: Customization by category

### Security
- **JWT Authentication**: Secure tokens
- **Granular roles**: Specific permissions
- **Full audit trail**: Log of all actions
- **Automatic backup**: Protected data

## Metrics and KPIs

### Content
- **Published articles**: By period and author
- **Approval rate**: Workflow efficiency
- **Average time**: Creation to publication
- **Engagement**: Views, likes, shares

### Users
- **Productivity**: Articles per writer
- **Quality**: Approval rate
- **Collaboration**: Comments and feedback
- **Performance**: Individual metrics

### Marketing
- **ROI**: Return on investment
- **Conversions**: Conversion rate
- **Reach**: Impressions and reach
- **Engagement**: Interactions and time

## Support and Maintenance

### Backup and Recovery
- **Automatic backup**: Daily at 02:00
- **Versioning**: Change history
- **Recovery**: Point-in-time recovery
- **Export**: Data in JSON/CSV

### Monitoring
- **Health checks**: System status
- **Performance**: Speed metrics
- **Errors**: Centralized log
- **Alerts**: Automatic notifications

### Updates
- **Automatic deploy**: CI/CD pipeline
- **Rollback**: Safe reversion
- **Feature flags**: Gradual activation
- **Tests**: Staging environment

## Troubleshooting

### Common Issues
1. **Login doesn't work**: Check credentials and role
2. **Upload fails**: Check size and format
3. **AI doesn't respond**: Check API keys
4. **Workflow stuck**: Check permissions

### Logs and Debug
- **Admin logs**: `/admin/logs`
- **API status**: `/admin/health`
- **Performance**: `/admin/metrics`
- **Errors**: Browser console

## Contact and Support

For technical support or questions about the system:
- **Email**: admin@notilab.com
- **Slack**: #notilab-admin
- **Documentation**: `/admin/docs`
- **Status**: status.notilab.com
