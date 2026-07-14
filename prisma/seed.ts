import { PrismaClient, Priority, NewsStatus } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting NotiLab seed (100+ articles, trends, AI data)...")

  // ========================
  // 1. CATEGORIES
  // Active per docs/editor/content-focus.md (+ Addendum v1.1): desporto, mocambique,
  // africa-do-sul, filmes, general. The rest are retired (kept for existing News rows'
  // referential integrity, not routed to).
  // ========================
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "politica" },
      update: {},
      create: { name: "Política", slug: "politica", description: "Notícias sobre política nacional e internacional", color: "#007BFF", icon: "landmark" },
    }),
    prisma.category.upsert({
      where: { slug: "desporto" },
      update: {},
      create: { name: "Desporto", slug: "desporto", description: "Futebol mundial, Real Madrid e bastidores das equipas top de Portugal, Inglaterra e Espanha", color: "#39FF14", icon: "trophy" },
    }),
    prisma.category.upsert({
      where: { slug: "mocambique" },
      update: {},
      create: { name: "Moçambique", slug: "mocambique", description: "Política de Moçambique", color: "#E60000", icon: "landmark" },
    }),
    prisma.category.upsert({
      where: { slug: "africa-do-sul" },
      update: {},
      create: { name: "África do Sul", slug: "africa-do-sul", description: "Xenofobia e questões sociais na África do Sul", color: "#FFB612", icon: "alert-triangle" },
    }),
    prisma.category.upsert({
      where: { slug: "filmes" },
      update: {},
      create: { name: "Cinema & Séries", slug: "filmes", description: "Crítica e notícias de cinema e séries — Netflix, Prime Video, Marvel; ação, comédia e doramas", color: "#7c3aed", icon: "clapperboard" },
    }),
    prisma.category.upsert({
      where: { slug: "cultura" },
      update: {},
      create: { name: "Cultura", slug: "cultura", description: "Arte, música, cinema e eventos culturais", color: "#FF6B35", icon: "palette" },
    }),
    prisma.category.upsert({
      where: { slug: "economia" },
      update: {},
      create: { name: "Economia", slug: "economia", description: "Mercados financeiros e economia", color: "#FFD23F", icon: "trending-up" },
    }),
    prisma.category.upsert({
      where: { slug: "leis" },
      update: {},
      create: { name: "Leis", slug: "leis", description: "Legislação e mudanças jurídicas", color: "#9B59B6", icon: "scale" },
    }),
    prisma.category.upsert({
      where: { slug: "tecnologia" },
      update: {},
      create: { name: "Tecnologia", slug: "tecnologia", description: "Tech, IA, inovação e startups", color: "#00D4FF", icon: "cpu" },
    }),
    prisma.category.upsert({
      where: { slug: "ciencia" },
      update: {},
      create: { name: "Ciência", slug: "ciencia", description: "Ciência, saúde e investigação", color: "#2ECC71", icon: "flask-conical" },
    }),
    prisma.category.upsert({
      where: { slug: "general" },
      update: {},
      create: { name: "Geral", slug: "general", description: "Notícias sem categoria específica identificada", color: "#8899A6", icon: "newspaper" },
    }),
  ])

  const catMap: Record<string, string> = {}
  for (const c of categories) catMap[c.slug] = c.id

  console.log(`✅ ${categories.length} categories created`)

  // ========================
  // 2. DEMO USER
  // ========================
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@notilab.com" },
    update: {},
    create: {
      email: "demo@notilab.com",
      name: "Utilizador Demo",
      points: 150,
      level: "2",
      preferences: {
        create: { categories: ["politica", "desporto", "tecnologia"] },
      },
    },
  })
  console.log("✅ Demo user created")

  // ========================
  // 3. NEWS SOURCES
  // ========================
  const sources = await Promise.all([
    prisma.newsSource.upsert({
      where: { name: "GNews" },
      update: {},
      create: { name: "GNews", type: "gnews", url: "https://gnews.io", priority: 80 },
    }),
    prisma.newsSource.upsert({
      where: { name: "NewsAPI" },
      update: {},
      create: { name: "NewsAPI", type: "newsapi", url: "https://newsapi.org", priority: 75 },
    }),
    prisma.newsSource.upsert({
      where: { name: "NotiLab Internal" },
      update: {},
      create: { name: "NotiLab Internal", type: "manual", priority: 90 },
    }),
  ])
  console.log(`✅ ${sources.length} news sources created`)

  // ========================
  // 4. 100+ NEWS ARTICLES
  // ========================
  const articlesData = [
    // POLITICS (20)
    { title: "EU Parliament Approves Landmark AI Safety Act", slug: "eu-ai-safety-act", summary: "The most comprehensive AI regulation in history sets global standards.", categorySlug: "leis", priority: Priority.HIGH, trending: true, sentiment: "neutral", readTime: 8, importance: 95 },
    { title: "NATO Summit Agrees on Expanded Cyber Defense Treaty", slug: "nato-cyber-defense-treaty", summary: "Alliance members commit to mutual cyber defense as digital threats grow.", categorySlug: "politica", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 6, importance: 88 },
    { title: "Portugal Announces New Digital Citizenship Program", slug: "portugal-digital-citizenship", summary: "New initiative aims to attract tech talent to Portugal with streamlined visa process.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 72 },
    { title: "G20 Leaders Reach Historic Climate Finance Agreement", slug: "g20-climate-finance", summary: "$500 billion pledged annually for developing nations' green transition.", categorySlug: "politica", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 7, importance: 90 },
    { title: "EU Digital Markets Act Enforcement Begins Against Big Tech", slug: "eu-dma-enforcement", summary: "Apple, Google, and Meta face strict new competition rules in Europe.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "neutral", readTime: 6, importance: 78 },
    { title: "UN General Assembly Adopts AI Ethics Framework", slug: "un-ai-ethics-framework", summary: "193 nations agree on principles for responsible AI development.", categorySlug: "politica", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 85 },
    { title: "Portugal PM Announces €2B Technology Investment Fund", slug: "portugal-tech-investment", summary: "Government backs startups and AI research with major funding package.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 70 },
    { title: "European Elections 2026: Key Issues and Predictions", slug: "european-elections-2026", summary: "Climate, AI regulation, and migration dominate the campaign landscape.", categorySlug: "politica", priority: Priority.NORMAL, trending: true, sentiment: "neutral", readTime: 8, importance: 75 },
    { title: "Brazil and EU Sign Landmark Free Trade Agreement", slug: "brazil-eu-trade-deal", summary: "Historic trade deal opens new markets for both economies.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 6, importance: 72 },
    { title: "Global Summit on Digital Privacy Produces New Framework", slug: "global-privacy-summit", summary: "30 countries agree on cross-border data protection standards.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 68 },
    { title: "BRICS Expansion: 6 New Members Join Economic Bloc", slug: "brics-expansion-2026", summary: "Growing coalition reshapes global economic power dynamics.", categorySlug: "politica", priority: Priority.HIGH, trending: true, sentiment: "neutral", readTime: 7, importance: 82 },
    { title: "Portugal Legalizes Four-Day Work Week for Public Sector", slug: "portugal-four-day-week", summary: "Government employees transition to shorter work weeks in pilot program.", categorySlug: "politica", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 4, importance: 76 },
    { title: "International Court Rules on Climate Accountability", slug: "international-court-climate", summary: "Landmark ruling holds fossil fuel companies accountable for climate damage.", categorySlug: "leis", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 6, importance: 88 },
    { title: "New EU Migration Pact Takes Effect", slug: "eu-migration-pact", summary: "Reformed asylum system aims to balance security and humanitarian obligations.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "neutral", readTime: 7, importance: 70 },
    { title: "Portugal's Tourism Tax Generates €500M in First Year", slug: "portugal-tourism-tax", summary: "Sustainable tourism fund exceeds expectations, investing in infrastructure.", categorySlug: "politica", priority: Priority.LOW, trending: false, sentiment: "positive", readTime: 4, importance: 55 },
    { title: "African Union and EU Launch Joint Development Initiative", slug: "au-eu-development", summary: "Billion-euro partnership focuses on education, health, and renewable energy.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 65 },
    { title: "WHO Declares End of Global Health Emergency", slug: "who-health-emergency-end", summary: "Major milestone as pandemic preparedness systems prove effective.", categorySlug: "politica", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 4, importance: 85 },
    { title: "Portugal Leads EU in Renewable Energy Integration", slug: "portugal-renewable-leader", summary: "Country achieves 85% renewable electricity, setting continental record.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 73 },
    { title: "Global Minimum Tax Agreement Reaches 140 Countries", slug: "global-minimum-tax", summary: "International corporate tax reform eliminates major tax havens.", categorySlug: "economia", priority: Priority.HIGH, trending: false, sentiment: "positive", readTime: 6, importance: 80 },
    { title: "Arctic Council Agrees on New Environmental Protections", slug: "arctic-environmental-protections", summary: "Expanded conservation zones and shipping regulations take effect.", categorySlug: "politica", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 62 },

    // SPORTS (20)
    { title: "Champions League Quarter-Finals Produce Stunning Upsets", slug: "champions-league-upsets", summary: "Underdogs advance as powerhouses stumble in thrilling matches.", categorySlug: "desporto", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 5, importance: 70 },
    { title: "Benfica Wins Liga Portugal Title in Dramatic Final Day", slug: "benfica-liga-title", summary: "Eagles clinch championship with last-minute victory on final matchday.", categorySlug: "desporto", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 6, importance: 82 },
    { title: "World Cup 2026: Host Cities and Schedule Revealed", slug: "world-cup-2026-schedule", summary: "48-team tournament spans US, Canada, and Mexico.", categorySlug: "desporto", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 7, importance: 88 },
    { title: "Cristiano Ronaldo Announces International Retirement", slug: "ronaldo-retirement", summary: "Portuguese legend steps back from national team after 22 years.", categorySlug: "desporto", priority: Priority.HIGH, trending: true, sentiment: "neutral", readTime: 5, importance: 90 },
    { title: "F1: New Team Enters Championship for 2027 Season", slug: "f1-new-team-2027", summary: "Andretti Cadillac confirmed as 11th team on the Formula 1 grid.", categorySlug: "desporto", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 4, importance: 65 },
    { title: "Sporting CP Reaches Champions League Semi-Finals", slug: "sporting-champions-semis", summary: "Historic run continues as Lisbon club beats Bayern Munich.", categorySlug: "desporto", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 80 },
    { title: "Olympics 2028: New Sports Include Breakdancing and Cricket", slug: "olympics-2028-new-sports", summary: "LA Games add five new disciplines to attract younger audiences.", categorySlug: "desporto", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 58 },
    { title: "Porto Signs Three Major Players in January Transfer Window", slug: "porto-january-transfers", summary: "Ambitious signings signal Porto's push for European glory.", categorySlug: "desporto", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 55 },
    { title: "Women's Football: Portugal Qualifies for 2027 World Cup", slug: "portugal-women-wc-2027", summary: "National women's team makes history with first World Cup qualification.", categorySlug: "desporto", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 78 },
    { title: "NBA Expands to Europe with New London Franchise", slug: "nba-london-franchise", summary: "Basketball goes global as NBA confirms first European team.", categorySlug: "desporto", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 5, importance: 72 },
    { title: "Tennis: Portuguese Player Reaches Grand Slam Quarter-Final", slug: "portuguese-tennis-slam", summary: "Breakthrough at Australian Open puts Portuguese tennis on the map.", categorySlug: "desporto", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 4, importance: 68 },
    { title: "Rugby World Cup 2027 Draw Completed", slug: "rugby-wc-2027-draw", summary: "Groups revealed for the expanded tournament in Australia.", categorySlug: "desporto", priority: Priority.LOW, trending: false, sentiment: "neutral", readTime: 3, importance: 45 },
    { title: "Esports: Portuguese Team Wins Valorant Champions Tour", slug: "portuguese-esports-valorant", summary: "Local team shocks the world at global esports championship.", categorySlug: "desporto", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 4, importance: 62 },
    { title: "Football: VAR System Gets Major AI Upgrade", slug: "var-ai-upgrade", summary: "New semi-automated offside technology debuts in all major leagues.", categorySlug: "desporto", priority: Priority.NORMAL, trending: false, sentiment: "neutral", readTime: 4, importance: 58 },
    { title: "Cycling: Volta a Portugal Goes International for First Time", slug: "volta-portugal-international", summary: "Tour route extends into Spain and France for 2026 edition.", categorySlug: "desporto", priority: Priority.LOW, trending: false, sentiment: "positive", readTime: 3, importance: 42 },
    { title: "Surfing: Nazaré Wave Record Broken Again", slug: "nazare-wave-record", summary: "New 30-meter wave record set at Portugal's famous big wave spot.", categorySlug: "desporto", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 3, importance: 68 },
    { title: "UFC Announces First Event in Lisbon", slug: "ufc-lisbon-event", summary: "Mixed martial arts comes to Portugal's capital in historic card.", categorySlug: "desporto", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 3, importance: 52 },
    { title: "Cricket World Cup: Portugal's Breakthrough Performance", slug: "portugal-cricket-wc", summary: "Associate nation surprises with group stage wins against Test nations.", categorySlug: "desporto", priority: Priority.LOW, trending: false, sentiment: "positive", readTime: 4, importance: 48 },
    { title: "Swimming: New World Record Set at European Championships", slug: "swimming-european-record", summary: "Portuguese swimmer breaks 200m freestyle record in Budapest.", categorySlug: "desporto", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 3, importance: 65 },
    { title: "Golf: Ryder Cup 2027 Venue Announced in Portugal", slug: "ryder-cup-portugal-2027", summary: "Algarve resort selected as host for prestigious golf event.", categorySlug: "desporto", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 55 },

    // ECONOMY (20)
    { title: "Global Markets Rally After Central Banks Signal Rate Cuts", slug: "markets-rally-rate-cuts", summary: "Stock markets surge as Fed and ECB hint at coordinated reductions.", categorySlug: "economia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 85 },
    { title: "Digital Euro Pilot Program Launches in 12 Countries", slug: "digital-euro-pilot", summary: "ECB begins real-world testing of digital currency.", categorySlug: "economia", priority: Priority.HIGH, trending: true, sentiment: "neutral", readTime: 6, importance: 82 },
    { title: "Bitcoin Surpasses $150,000 as Institutional Adoption Grows", slug: "bitcoin-150k", summary: "Cryptocurrency reaches new all-time high amid growing mainstream acceptance.", categorySlug: "economia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 78 },
    { title: "Portugal's GDP Growth Outpaces EU Average", slug: "portugal-gdp-growth", summary: "Economy expands 3.2% as tech sector drives unprecedented growth.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 72 },
    { title: "Green Bonds Market Surpasses $5 Trillion", slug: "green-bonds-5t", summary: "Sustainable finance reaches milestone as climate investment accelerates.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 68 },
    { title: "AI Companies Now 40% of S&P 500 Market Cap", slug: "ai-sp500-market-cap", summary: "Tech giants' AI divisions drive record stock market valuations.", categorySlug: "economia", priority: Priority.HIGH, trending: true, sentiment: "neutral", readTime: 6, importance: 80 },
    { title: "Portugal's Housing Market Shows Signs of Cooling", slug: "portugal-housing-market", summary: "New regulations and increased supply begin to moderate price growth.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "neutral", readTime: 5, importance: 65 },
    { title: "European Central Bank Cuts Rates for Third Consecutive Time", slug: "ecb-rate-cut-third", summary: "Interest rates drop to 2.5% as inflation stabilizes across eurozone.", categorySlug: "economia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 4, importance: 85 },
    { title: "Lisbon Ranked Top European Tech Hub for Startups", slug: "lisbon-tech-hub-ranking", summary: "City overtakes Berlin in startup ecosystem rankings for first time.", categorySlug: "economia", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 4, importance: 72 },
    { title: "Global Supply Chains Fully Recovered, Report Shows", slug: "supply-chains-recovered", summary: "Two years of restructuring produce more resilient global trade networks.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 60 },
    { title: "Inflation Falls Below 2% in Most EU Countries", slug: "eu-inflation-below-2", summary: "Price stability returns as energy costs normalize across Europe.", categorySlug: "economia", priority: Priority.HIGH, trending: false, sentiment: "positive", readTime: 4, importance: 78 },
    { title: "Portugal Exports Reach Record €100B", slug: "portugal-exports-record", summary: "Manufacturing and technology drive export growth to all-time high.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 65 },
    { title: "Venture Capital Investment in Europe Hits €80B", slug: "european-vc-80b", summary: "EU tech ecosystem attracts record investment amid AI boom.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 68 },
    { title: "Unemployment in Portugal Drops to Historic Low of 5.1%", slug: "portugal-unemployment-low", summary: "Labor market strength driven by tech and services sectors.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 3, importance: 70 },
    { title: "Oil Prices Stabilize as Renewable Energy Reduces Demand", slug: "oil-prices-renewable-impact", summary: "Structural shift in energy markets keeps crude below $60/barrel.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "neutral", readTime: 5, importance: 62 },
    { title: "Remote Work Creates €15B Digital Nomad Economy in Portugal", slug: "portugal-digital-nomad-economy", summary: "Foreign remote workers boost local economies in Lisbon, Porto, and Algarve.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 5, importance: 65 },
    { title: "European Union Launches Digital Wallet for All Citizens", slug: "eu-digital-wallet", summary: "eID wallet integrates payments, ID verification, and health records.", categorySlug: "economia", priority: Priority.NORMAL, trending: true, sentiment: "neutral", readTime: 5, importance: 72 },
    { title: "Portugal's Minimum Wage Rises to €900 per Month", slug: "portugal-minimum-wage-900", summary: "Latest increase continues government plan to reach €1000 by 2028.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 3, importance: 68 },
    { title: "Real Estate Investment Trusts Expand in Portuguese Market", slug: "portugal-reits-expansion", summary: "New financial instruments attract international property investors.", categorySlug: "economia", priority: Priority.LOW, trending: false, sentiment: "neutral", readTime: 4, importance: 50 },
    { title: "EU Carbon Border Tax Impact: First Year Results", slug: "eu-carbon-border-tax", summary: "CBAM generates €8B and drives manufacturing changes across industries.", categorySlug: "economia", priority: Priority.NORMAL, trending: false, sentiment: "neutral", readTime: 6, importance: 65 },

    // TECHNOLOGY (25)
    { title: "Google Launches Gemini 3: Most Capable AI Model Yet", slug: "google-gemini-3-launch", summary: "New AI system reasons across text, images, audio, and video simultaneously.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 6, importance: 92 },
    { title: "SpaceX Successfully Tests Starship for Mars Mission", slug: "spacex-starship-mars-test", summary: "Fully reusable rocket nails most ambitious flight yet.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 88 },
    { title: "Breakthrough: Solar Efficiency Hits 50%", slug: "solar-efficiency-50-percent", summary: "MIT researchers achieve record panel efficiency that could revolutionize clean energy.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 85 },
    { title: "Quantum Computer Solves Problem Impossible for Classical Machines", slug: "quantum-computing-breakthrough", summary: "IBM's 10,000-qubit processor demonstrates clear quantum advantage.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 7, importance: 90 },
    { title: "OpenAI Launches AGI Research Lab with $10B Investment", slug: "openai-agi-lab-10b", summary: "New dedicated facility focuses exclusively on artificial general intelligence.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "neutral", readTime: 6, importance: 88 },
    { title: "Apple Unveils AI-Native Operating System: appleOS", slug: "apple-ai-native-os", summary: "Revolutionary OS embeds AI in every interaction, from files to apps.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 6, importance: 85 },
    { title: "Brain-Computer Interface Restores Speech in Paralyzed Patient", slug: "bci-speech-restoration", summary: "Neuralink competitor achieves medical breakthrough with speech decoding.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 90 },
    { title: "Self-Driving Cars Now Legal in All EU Countries", slug: "self-driving-legal-eu", summary: "Harmonized regulation allows Level 4 autonomous vehicles on European roads.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "neutral", readTime: 5, importance: 82 },
    { title: "Solid-State Batteries Achieve 1000km EV Range", slug: "solid-state-batteries-1000km", summary: "Toyota mass-produces next-generation batteries that charge in 10 minutes.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 85 },
    { title: "Meta's AR Glasses Sell 10 Million Units in First Quarter", slug: "meta-ar-glasses-10m", summary: "Lightweight augmented reality glasses achieve mainstream consumer adoption.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 4, importance: 72 },
    { title: "Cybersecurity Alert: Critical Vulnerability in Major Platforms", slug: "cybersecurity-critical-alert", summary: "Zero-day exploit affects millions of devices, patches being deployed.", categorySlug: "tecnologia", priority: Priority.URGENT, trending: true, sentiment: "negative", readTime: 4, importance: 88 },
    { title: "Nuclear Fusion Reactor Achieves Net Energy Gain", slug: "nuclear-fusion-net-energy", summary: "ITER facility produces more energy than consumed for first sustained period.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 6, importance: 95 },
    { title: "AI Drug Discovery Produces Three New Cancer Treatments", slug: "ai-drug-discovery-cancer", summary: "Machine learning-designed molecules enter Phase 3 clinical trials.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 90 },
    { title: "6G Networks Begin Testing in South Korea and Finland", slug: "6g-networks-testing", summary: "Next-generation wireless promises 100x speed improvement over 5G.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 65 },
    { title: "GitHub Copilot Now Writes 60% of Code at Top Companies", slug: "github-copilot-60-percent", summary: "AI coding assistants transform software development practices globally.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: true, sentiment: "neutral", readTime: 5, importance: 75 },
    { title: "Deepfake Detection Tool Achieves 99.5% Accuracy", slug: "deepfake-detection-tool", summary: "New AI system can identify synthetic media in real-time across platforms.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 72 },
    { title: "Robotics: Humanoid Robots Enter Manufacturing Workforce", slug: "humanoid-robots-manufacturing", summary: "Figure and Tesla bots deployed in BMW and Amazon warehouses.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: true, sentiment: "neutral", readTime: 5, importance: 78 },
    { title: "Portugal's Tech Sector Creates 50,000 New Jobs", slug: "portugal-tech-50k-jobs", summary: "AI and cybersecurity positions drive unprecedented hiring boom.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 68 },
    { title: "Web4: Decentralized AI Web Protocol Gains Traction", slug: "web4-decentralized-ai", summary: "New internet protocol combines AI agents with blockchain for trustless interactions.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: false, sentiment: "neutral", readTime: 6, importance: 62 },
    { title: "CRISPR Gene Therapy Cures Sickle Cell Disease in Trial", slug: "crispr-sickle-cell-cure", summary: "100% of trial participants show complete disease remission after treatment.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 92 },
    { title: "Microsoft Achieves Carbon Negative Operations", slug: "microsoft-carbon-negative", summary: "Tech giant removes more carbon than it emits across all facilities.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 65 },
    { title: "3D Printing Produces First Transplantable Human Organ", slug: "3d-printed-organ-transplant", summary: "Bioprinted kidney successfully transplanted in groundbreaking procedure.", categorySlug: "tecnologia", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 92 },
    { title: "AI Weather Prediction Now More Accurate Than Traditional Models", slug: "ai-weather-prediction", summary: "Machine learning forecasts beat supercomputer models by 25% accuracy.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 68 },
    { title: "Autonomous Drone Delivery Launches in Lisbon", slug: "drone-delivery-lisbon", summary: "Wing and CTT partner for first European urban drone delivery network.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 60 },
    { title: "New Programming Language 'Mojo' Replaces Python in AI", slug: "mojo-programming-language", summary: "High-performance language designed for AI achieves widespread adoption.", categorySlug: "tecnologia", priority: Priority.NORMAL, trending: false, sentiment: "neutral", readTime: 5, importance: 55 },

    // CULTURE (15)
    { title: "Lisbon Named European Capital of Culture 2027", slug: "lisbon-culture-capital-2027", summary: "City's vibrant arts scene recognized with prestigious European designation.", categorySlug: "cultura", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 4, importance: 72 },
    { title: "Portuguese Film Wins Palme d'Or at Cannes", slug: "portuguese-film-cannes", summary: "Director's debut feature captures top prize at world's most prestigious film festival.", categorySlug: "cultura", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 4, importance: 80 },
    { title: "AI-Generated Art Sells for $5M at Christie's", slug: "ai-art-christies-5m", summary: "Controversy erupts as AI artwork breaks records at major auction house.", categorySlug: "cultura", priority: Priority.NORMAL, trending: true, sentiment: "neutral", readTime: 5, importance: 72 },
    { title: "Fado Gets UNESCO Living Heritage Boost with Modern Fusion", slug: "fado-unesco-modern-fusion", summary: "Traditional Portuguese music evolves with electronic and jazz influences.", categorySlug: "cultura", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 62 },
    { title: "Global Streaming Platforms Invest €2B in Portuguese Content", slug: "streaming-portuguese-content", summary: "Netflix, Amazon, and Disney greenlight 30+ Portuguese-language productions.", categorySlug: "cultura", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 4, importance: 68 },
    { title: "Virtual Reality Museum Opens in Porto", slug: "vr-museum-porto", summary: "World's first fully VR museum features immersive art experiences.", categorySlug: "cultura", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 3, importance: 58 },
    { title: "Portuguese Author Wins Nobel Prize in Literature", slug: "portuguese-nobel-literature", summary: "Third Portuguese Nobel laureate recognized for innovative literary voice.", categorySlug: "cultura", priority: Priority.HIGH, trending: true, sentiment: "positive", readTime: 5, importance: 88 },
    { title: "Rock in Rio Lisbon 2026 Breaks Attendance Records", slug: "rock-in-rio-2026-records", summary: "Festival draws 500,000 attendees across four days of performances.", categorySlug: "cultura", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 3, importance: 60 },
    { title: "AI Restores Lost Paintings by Portuguese Masters", slug: "ai-restores-paintings", summary: "Machine learning reconstructs damaged artworks from the Age of Discovery.", categorySlug: "cultura", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 65 },
    { title: "Coimbra University Library Gets €50M Digital Renovation", slug: "coimbra-library-digital", summary: "Historic Joanina Library integrates AI preservation with centuries-old collection.", categorySlug: "cultura", priority: Priority.LOW, trending: false, sentiment: "positive", readTime: 4, importance: 52 },
    { title: "Portuguese Video Game Studio Raises €30M", slug: "portuguese-game-studio-30m", summary: "Indie studio's upcoming title attracts major publisher backing.", categorySlug: "cultura", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 3, importance: 55 },
    { title: "Contemporary Art Biennale Returns to Lisbon", slug: "lisbon-art-biennale", summary: "International exhibition brings 200+ artists to the capital.", categorySlug: "cultura", priority: Priority.LOW, trending: false, sentiment: "positive", readTime: 3, importance: 48 },
    { title: "Portuguese Language Reaches 300 Million Speakers", slug: "portuguese-300m-speakers", summary: "Language growth driven by demographics in Brazil and Africa.", categorySlug: "cultura", priority: Priority.NORMAL, trending: false, sentiment: "positive", readTime: 4, importance: 60 },
    { title: "New Study: Intermittent Fasting Shows Cognitive Benefits", slug: "intermittent-fasting-cognitive", summary: "Large-scale trial reveals significant brain health improvements.", categorySlug: "cultura", priority: Priority.NORMAL, trending: true, sentiment: "positive", readTime: 5, importance: 70 },
    { title: "AI Composer Creates Symphony Performed by London Philharmonic", slug: "ai-symphony-london", summary: "First AI-generated orchestral work performed at Royal Albert Hall.", categorySlug: "cultura", priority: Priority.NORMAL, trending: true, sentiment: "neutral", readTime: 4, importance: 68 },
  ]

  // Unsplash placeholder images
  const unsplashImages = [
    "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&q=80",
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&q=80",
    "https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?w=600&q=80",
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80",
    "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&q=80",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80",
    "https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=600&q=80",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&q=80",
    "https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=600&q=80",
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?w=600&q=80",
  ]

  let createdCount = 0
  for (let i = 0; i < articlesData.length; i++) {
    const a = articlesData[i]
    const hoursAgo = Math.floor(Math.random() * 168) // 0-7 days ago
    const publishedAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000)

    try {
      await prisma.news.upsert({
        where: { slug: a.slug },
        update: {},
        create: {
          title: a.title,
          slug: a.slug,
          content: `<p>${a.summary}</p><p>This is a detailed article about ${a.title.toLowerCase()}. In-depth coverage and analysis follows with expert opinions and data-driven insights.</p>`,
          summary: a.summary,
          imageUrl: unsplashImages[i % unsplashImages.length],
          sourceUrl: `https://notilab.com/news/${a.slug}`,
          sourceName: "NotiLab",
          publishedAt,
          categoryId: catMap[a.categorySlug],
          tags: a.title.split(" ").filter(w => w.length > 4).slice(0, 3).map(w => w.toLowerCase()),
          trending: a.trending,
          priority: a.priority,
          status: NewsStatus.PUBLISHED,
          sentiment: a.sentiment,
          readTime: a.readTime,
          importanceScore: a.importance,
        },
      })
      createdCount++
    } catch {
      // Skip duplicates silently
    }
  }

  console.log(`✅ ${createdCount} articles created`)

  // ========================
  // 5. AI-PROCESSED ARTICLES (ArticleAI for top 10)
  // ========================
  const topArticles = await prisma.news.findMany({
    where: { importanceScore: { gte: 85 } },
    take: 10,
    orderBy: { importanceScore: "desc" },
  })

  const aiExplanations = [
    {
      tldr: "A fundamental shift in how AI is governed globally.",
      whyItMatters: "This regulation will determine whether AI helps or harms humanity over the next decade.",
      explainLikeIm10: "The big group of countries made rules for smart robots so they play fair and don't trick people! 🤖",
    },
    {
      tldr: "A scientific breakthrough that could change everything about energy.",
      whyItMatters: "Achieving net energy gain from fusion means unlimited clean energy is now a matter of engineering, not physics.",
      explainLikeIm10: "Scientists made a mini-sun that gives us more energy than it takes to start it. It's like magic but real! ☀️",
    },
    {
      tldr: "Gene editing can now cure genetic diseases permanently.",
      whyItMatters: "This isn't just treating symptoms — it's fixing the root cause at the DNA level, opening doors for thousands of genetic conditions.",
      explainLikeIm10: "Doctors found a way to fix tiny mistakes in people's bodies that make them sick. Like using an eraser to fix a spelling mistake in your DNA! 🧬",
    },
    {
      tldr: "AI is now the dominant force in global markets.",
      whyItMatters: "When 40% of the world's largest stock index is AI companies, every investor and worker is affected.",
      explainLikeIm10: "Robot companies are now worth almost half of all the biggest companies. That's a LOT of robots! 🤑",
    },
    {
      tldr: "The football legend says goodbye to international duty.",
      whyItMatters: "End of an era that defined Portuguese football and inspired a generation of players worldwide.",
      explainLikeIm10: "The super famous football player from Portugal is done playing for his country's team. He scored SO many goals! ⚽",
    },
    {
      tldr: "Computers can now print real human organs for transplant.",
      whyItMatters: "This could end organ donor waiting lists and save millions of lives every year.",
      explainLikeIm10: "Scientists can now 3D print body parts like kidneys, just like printing a toy but for inside your body! 🏥",
    },
    {
      tldr: "The world's biggest football tournament gets its roadmap.",
      whyItMatters: "48 teams, 3 countries, and billions watching — this will be the biggest sporting event in history.",
      explainLikeIm10: "The BIGGEST football party EVER is coming! More teams than ever before playing in three different countries! ⚽🎉",
    },
    {
      tldr: "AI found new ways to fight cancer that humans missed.",
      whyItMatters: "Molecule design that took years now takes weeks, accelerating treatment for the leading cause of death globally.",
      explainLikeIm10: "Smart computers found new medicines to help sick people get better. They figured it out super fast! 💊",
    },
    {
      tldr: "Cars can now drive themselves legally across all of Europe.",
      whyItMatters: "This transforms transportation, urban planning, and millions of driving jobs permanently.",
      explainLikeIm10: "Robot cars can now drive by themselves in every country in Europe. No driver needed! 🚗🤖",
    },
    {
      tldr: "Batteries that charge in minutes and last 1000km are now real.",
      whyItMatters: "This removes the last major barrier to electric vehicle mass adoption worldwide.",
      explainLikeIm10: "New super batteries can charge faster than eating lunch and drive your car from Lisbon to Paris without stopping! ⚡🔋",
    },
  ]

  let aiCount = 0
  for (let i = 0; i < topArticles.length; i++) {
    const article = topArticles[i]
    const aiData = aiExplanations[i % aiExplanations.length]

    try {
      await prisma.articleAI.upsert({
        where: { articleId: article.id },
        update: {},
        create: {
          articleId: article.id,
          summary: article.summary || article.title,
          tldr: aiData.tldr,
          whyItMatters: aiData.whyItMatters,
          explainLikeIm10: aiData.explainLikeIm10,
          importanceScore: article.importanceScore || 85,
        },
      })
      aiCount++
    } catch {
      // Skip
    }
  }
  console.log(`✅ ${aiCount} ArticleAI records created`)

  // ========================
  // 6. TRENDING TOPICS (10)
  // ========================
  const trends = [
    { keyword: "AI Regulation EU", searchVolume: 2100000, category: "Technology", region: "PT" },
    { keyword: "Climate Summit 2026", searchVolume: 1800000, category: "Politics", region: "PT" },
    { keyword: "Quantum Computing", searchVolume: 1200000, category: "Science", region: "PT" },
    { keyword: "Champions League", searchVolume: 980000, category: "Sports", region: "PT" },
    { keyword: "Digital Euro", searchVolume: 870000, category: "Economy", region: "PT" },
    { keyword: "Space Tourism", searchVolume: 750000, category: "Science", region: "PT" },
    { keyword: "Cybersecurity Alert", searchVolume: 650000, category: "Technology", region: "PT" },
    { keyword: "EV Battery Tech", searchVolume: 520000, category: "Technology", region: "PT" },
    { keyword: "World Cup 2026", searchVolume: 3200000, category: "Sports", region: "PT" },
    { keyword: "Nuclear Fusion", searchVolume: 1500000, category: "Science", region: "PT" },
  ]

  let trendCount = 0
  for (const t of trends) {
    try {
      await prisma.trendingTopic.upsert({
        where: { keyword: t.keyword },
        update: { searchVolume: t.searchVolume },
        create: t,
      })
      trendCount++
    } catch {
      // Skip
    }
  }
  console.log(`✅ ${trendCount} trending topics created`)

  // ========================
  // 7. DEMO DIGEST SUBSCRIPTION
  // ========================
  await prisma.digestSubscription.upsert({
    where: { email: "demo@notilab.com" },
    update: {},
    create: {
      email: "demo@notilab.com",
      userId: demoUser.id,
      frequency: "daily",
      categories: ["politica", "tecnologia", "economia"],
      isActive: true,
    },
  })
  console.log("✅ Demo digest subscription created")

  // ========================
  // SUMMARY
  // ========================
  const totalArticles = await prisma.news.count()
  const totalAI = await prisma.articleAI.count()
  const totalTrends = await prisma.trendingTopic.count()
  console.log(`\n🎉 Seed complete!`)
  console.log(`   📰 ${totalArticles} articles`)
  console.log(`   🤖 ${totalAI} AI-processed articles`)
  console.log(`   🔥 ${totalTrends} trending topics`)
  console.log(`   👤 1 demo user + digest subscription`)
  console.log(`   📡 ${sources.length} news sources`)
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
