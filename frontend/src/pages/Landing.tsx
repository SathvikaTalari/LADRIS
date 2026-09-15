/**
 * LADRIS — Premium Landing / Pre-Login Page
 * Inspired by Government Intelligence Platform aesthetics
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import {
  MapPin, ShieldCheck, Zap, Brain,
  ArrowRight, ChevronRight, Sun, Moon, Menu, X,
  AlertTriangle, TrendingUp,
  Globe, Accessibility, HelpCircle, LayoutGrid,
} from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import KeyComponentsSection from './sections/KeyComponentsSection'
import FeaturesRippleSection from './sections/FeaturesRippleSection'
import RolesConnectedSection from './sections/RolesConnectedSection'
import SystemArchitectureSection from './sections/SystemArchitectureSection'
import GisIntelligenceSection from './sections/GisIntelligenceSection'
import SmartAnalyticsSection from './sections/SmartAnalyticsSection'

/* ─── Feature cards data ────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: <Zap size={28} strokeWidth={1.8} />,
    title: 'Real-time Risk Scoring',
    desc: 'Know the risk early. LADRIS checks project data and shows whether a project has low, medium, or high delay risk.',
    color: '#4a6fa5',
  },
  {
    icon: <Brain size={28} strokeWidth={1.8} />,
    title: 'AI Decision Intelligence',
    desc: 'Get smarter decisions. AI studies past and current data to find risky patterns and help teams choose the right action early.',
    color: '#4a6fa5',
  },
  {
    icon: <MapPin size={28} strokeWidth={1.8} />,
    title: 'GIS Spatial Analytics',
    desc: 'See risk on the map. View project locations, high-risk areas, and district-wise patterns on an interactive GIS map for faster understanding.',
    color: '#4a6fa5',
  },
  {
    icon: <AlertTriangle size={28} strokeWidth={1.8} />,
    title: 'Predictive Bottleneck Detection',
    desc: 'Find problems before they grow. LADRIS  detects issues like approval, legal, compensation, and documentation delays before they seriously affect the project.',
    color: '#4a6fa5',
  },
  {
    icon: <TrendingUp size={28} strokeWidth={1.8} />,
    title: 'Analytics & Simulation',
    desc: 'Interactive corridor simulator for safe evaluation of policy changes, budget scenarios, and timeline alternatives before implementation.',
    color: '#7c5cfc',
  },
  {
    icon: <ShieldCheck size={28} strokeWidth={1.8} />,
    title: 'Secure Government Access',
    desc: 'Role-based access control aligned to Ministry hierarchy — Central, State, District and LA officers each get a tailored command view.',
    color: '#00b894',
  },
]



/* ─── Hero Slideshow data ───────────────────────────────────────────────── */
const HERO_SLIDES = [
  {
    src: '/slide_highway.jpg',
    ministry: 'Ministry of Road Transport & Highways (MoRTH)',
    caption: 'Keeping Highway Projects Moving',
    tag: 'Land Acquisition & Highways',
  },
  {
    src: '/slide_railway.jpg',
    ministry: 'Ministry of Railways',
    caption: 'Clearing the Way for Railway Projects',
    tag: 'Land Acquisition & Railways',
  },
  {
    src: '/slide_metro.jpg',
    ministry: 'Ministry of Housing & Urban Affairs (MoHUA)',
    caption: 'Supporting Faster Metro Development',
    tag: 'Land Acquisition & Metro ',
  },
  {
    src: '/slide_powergrid.jpg',
    ministry: 'Ministry of Power',
    caption: 'Keeping Power Projects on Track',
    tag: 'Land Acquisition & Power Grids',
  },
  {
    src: '/slide_airport.jpg',
    ministry: 'Ministry of Civil Aviation',
    caption: 'Supporting Timely Airport Development',
    tag: 'Land Acquisition & Airports',
  },
  {
    src: '/slide_urban_const.jpg',
    ministry: 'Ministry of Housing & Urban Affairs (MoHUA)',
    caption: 'Enabling Timely Urban Development',
    tag: 'Land Acquisition & Urban Projects',
  },
  {
    src: '/slide_industrial.jpg',
    ministry: 'Ministry of Commerce & Industry',
    caption: 'Enabling Faster Industrial Development',
    tag: 'Land Acquisition & Industrial Zones',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useThemeStore()
  const isDark = theme === 'dark'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSlide, setActiveSlide] = useState(0)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [activePanel, setActivePanel] = useState<'sitemap' | 'language' | 'accessibility' | 'help' | null>(null)
  const [language, setLanguage] = useState<'en' | 'hi'>('en')
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('normal')
  const [highContrast, setHighContrast] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [helpQuery, setHelpQuery] = useState('')
  const [helpAnswer, setHelpAnswer] = useState('')
  const [openDropdown, setOpenDropdown] = useState<'about' | 'help' | null>(null)
  const [mobileAboutOpen, setMobileAboutOpen] = useState(false)
  const [mobileHelpOpen, setMobileHelpOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollY } = useScroll()
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0])
  const heroY = useTransform(scrollY, [0, 400], [0, 80])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close dropdowns when clicking outside the nav
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Auto-advance slideshow every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % HERO_SLIDES.length)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  const goToSlide = (idx: number) => setActiveSlide(idx)
  const prevSlide = () => setActiveSlide(prev => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)
  const nextSlide = () => setActiveSlide(prev => (prev + 1) % HERO_SLIDES.length)

  const handleAccessDashboard = () => navigate('/login')

  // Accessibility effects — applied globally via <html> attributes
  useEffect(() => {
    const root = document.documentElement
    // Font size: sets root font-size so all rem-based elements scale proportionally
    root.style.fontSize = fontSize === 'large' ? '18px' : fontSize === 'xlarge' ? '20px' : ''
    // High contrast: toggles [data-high-contrast] CSS attribute
    if (highContrast) { root.setAttribute('data-high-contrast', 'true') }
    else { root.removeAttribute('data-high-contrast') }
    // Reduced motion: toggles [data-reduced-motion] CSS attribute
    if (reducedMotion) { root.setAttribute('data-reduced-motion', 'true') }
    else { root.removeAttribute('data-reduced-motion') }
    return () => {
      root.style.fontSize = ''
      root.removeAttribute('data-high-contrast')
      root.removeAttribute('data-reduced-motion')
    }
  }, [fontSize, highContrast, reducedMotion])

  // ── Smooth-scroll helper: navigates to any section by id,
  //    subtracting the actual sticky-header height + a small gap.
  //    Respects prefers-reduced-motion.
  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId)
    if (!target) return
    const header = document.querySelector('header') as HTMLElement | null
    const headerH = header ? header.getBoundingClientRect().height : 0
    const gap = 16
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerH - gap
    window.scrollTo({
      top: targetTop,
      behavior: prefersReduced ? 'auto' : 'smooth',
    })
  }

  const togglePanel = (panel: 'sitemap' | 'language' | 'accessibility' | 'help') =>
    setActivePanel(prev => (prev === panel ? null : panel))

  // ── IntersectionObserver: track which section is in view for active nav highlight
  useEffect(() => {
    const ids = ['features', 'analytics', 'gis-intelligence', 'architecture']
    const observers: IntersectionObserver[] = []
    ids.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { threshold: 0.2, rootMargin: '-10% 0px -60% 0px' }
      )
      obs.observe(el)
      observers.push(obs)
    })
    return () => observers.forEach(o => o.disconnect())
  }, [])

  const handleHelpQuery = (q: string) => {
    const query = q.toLowerCase().trim()
    if (!query) { setHelpAnswer(''); return }
    const matches: [string[], string][] = [
      [['login', 'sign in', 'access', 'credentials', 'password'], 'To login, click the "Login" button on the top-right or the "Access Dashboard" button. Use your government credentials. Roles are pre-assigned — contact your ministry admin if you cannot log in.'],
      [['role', 'permission', 'central', 'state', 'district', 'officer', 'la officer'], 'LADRIS supports four roles: Central, State, District, and LA Officer. Each role sees a tailored dashboard with data scoped to their jurisdiction and responsibilities.'],
      [['project', 'track', 'monitor', 'stage', 'status', 'progress'], 'In the Projects section, you can see all land acquisition projects with current stage (SIA, notification, award, possession), risk score, and timeline status.'],
      [['gis', 'map', 'location', 'spatial', 'district map', 'geography'], 'The GIS Map view shows all active projects plotted geographically. Use it to identify high-risk clusters, district-level patterns, and spatial delay concentrations.'],
      [['alert', 'notification', 'flagged', 'warn', 'critical'], 'Alerts are generated when a project exceeds expected stage durations or shows escalating risk. You can view and acknowledge alerts from the Alerts section in the dashboard.'],
      [['delay', 'delayed', 'bottleneck', 'slow', 'stuck', 'overdue'], 'Delays are detected using AI models trained on historical acquisition data. Key delay factors include SIA delays, incomplete documentation, legal disputes, compensation holdups, and coordination gaps.'],
      [['sia', 'social impact', 'assessment'], 'Social Impact Assessment (SIA) is the first mandatory stage in land acquisition. Delays here cascade into all downstream stages. LADRIS tracks SIA duration and flags overruns early.'],
      [['compensation', 'payment', 'award', 'disburse'], 'Compensation must be paid before possession can be taken. LADRIS monitors award and payment timelines and alerts when disbursement delays exceed allowed limits.'],
      [['analytics', 'report', 'chart', 'graph', 'data', 'statistic'], 'The Analytics section provides charts on risk distribution, stage-wise delay trends, ministry/state comparisons, and AI-predicted outcomes.'],
      [['dashboard', 'home', 'summary', 'overview'], 'The dashboard gives a high-level view of all projects, risk counts (high/medium/low), alerts, and key metrics. Navigate to Projects, GIS, or Analytics for deeper views.'],
      [['sitemap', 'site map', 'pages', 'sections', 'navigate'], 'Use the Site Map icon (grid icon) in the top bar to navigate to all major sections. You can also visit /sitemap for the full platform structure.'],
      [['language', 'hindi', 'english', 'translate'], 'Use the Globe icon in the top bar to switch between English and Hindi. All visible page content will be translated.'],
      [['accessibility', 'contrast', 'font size', 'motion', 'visual'], 'Use the Accessibility icon (person icon) in the top bar to adjust text size, enable high contrast mode, or reduce animations.'],
    ]
    for (const [keywords, answer] of matches) {
      if (keywords.some(k => query.includes(k))) { setHelpAnswer(answer); return }
    }
    setHelpAnswer('This question is outside the built-in help topics. For platform support, please contact your ministry\'s LADRIS administrator or refer to the official LADRIS Documentation section.')
  }

  const hi = language === 'hi'
  const T = {
    // Utility bar
    skipToMain: hi ? 'मुख्य सामग्री पर जाएं' : 'Skip to main content',
    language: hi ? 'भाषा' : 'Language',
    // Top gov bar
    govIndia: hi ? 'भारत सरकार' : 'भारत सरकार',
    govIndiaEn: hi ? 'भारत सरकार' : 'Government of India',
    ministry: hi ? 'ग्रामीण विकास मंत्रालय' : 'ग्रामीण विकास मंत्रालय',
    ministryEn: hi ? 'ग्रामीण विकास मंत्रालय' : 'Ministry of Rural Development',
    // Nav brand subtitle
    brandSub1: hi ? 'भूमि अधिग्रहण विलंब जोखिम' : 'Land Acquisition Delay Risk',
    brandSub2: hi ? 'बुद्धिमत्ता प्रणाली' : 'Intelligence System',
    // Nav links
    navFeatures: hi ? 'विशेषताएं' : 'Features',
    navArchitecture: hi ? 'आर्किटेक्चर' : 'Architecture',
    navAnalytics: hi ? 'विश्लेषण' : 'Analytics',
    navAbout: hi ? 'के बारे में' : 'About',
    navHelp: hi ? 'सहायता और प्रतिक्रिया' : 'Help & Feedback',
    navDocuments: hi ? 'दस्तावेज़' : 'Documents',
    navLogin: hi ? 'लॉगिन' : 'Login',
    // Hero
    heroTitle: hi ? 'LADRIS – भूमि अधिग्रहण विलंब जोखिम बुद्धिमत्ता प्रणाली' : 'LADRIS – Land Acquisition Delay Risk Intelligence System',
    heroSub: hi
      ? 'भूमि अधिग्रहण विलंबों का शीघ्र पता लगाने के लिए भविष्यवाणी विश्लेषण प्रणाली'
      : 'Predictive Analytics System for Early Detection of Land Acquisition Delays',
    heroCta1: hi ? 'डैशबोर्ड एक्सेस करें' : 'Access Dashboard',
    heroCta2: hi ? 'अधिक जानें' : 'Read More',
    // Carousel slide caption labels
    slideMinistry: (m: string) => hi ? m : m,  // ministry names stay as-is
    slideCaption: (c: string) => {
      const map: Record<string, string> = {
        'Keeping Highway Projects Moving': 'राजमार्ग परियोजनाएं सुचारू रखना',
        'Clearing the Way for Railway Projects': 'रेलवे परियोजनाओं के लिए मार्ग प्रशस्त करना',
        'Supporting Faster Metro Development': 'तेज़ मेट्रो विकास में सहायता',
        'Keeping Power Projects on Track': 'बिजली परियोजनाओं को ट्रैक पर रखना',
        'Supporting Timely Airport Development': 'समय पर हवाई अड्डा विकास में सहायता',
        'Enabling Timely Urban Development': 'समय पर शहरी विकास सक्षम करना',
        'Enabling Faster Industrial Development': 'तेज़ औद्योगिक विकास सक्षम करना',
      }
      return hi ? (map[c] || c) : c
    },
    // Overview section
    overviewTitle: hi ? 'अवलोकन' : 'Overview',
    overviewText: hi
      ? 'LADRIS  भूमि अधिग्रहण के लिए एक AI-संचालित निर्णय-सहायता मंच है। यह ऐतिहासिक और लाइव परियोजना डेटा का अध्ययन करता है, विलंब की संभावना की भविष्यवाणी करता है, मुख्य जोखिम कारकों की पहचान करता है, GIS मानचित्र पर जोखिम भरी परियोजनाएं दिखाता है, अलर्ट भेजता है और निवारक कार्रवाई की सिफारिश करता है।'
      : 'LADRIS  is an AI-powered decision-support platform for land acquisition. It studies historical and live project data, predicts delay probability, finds the main risk factors, shows risky projects on GIS maps, sends alerts and recommends preventive actions.',
    overviewCta1: hi ? 'डैशबोर्ड एक्सेस करें' : 'Access Dashboard',
    overviewCta2: hi ? 'अधिक जानें' : 'Read More',
    // Challenges section
    challengesTitle: hi ? 'भूमि अधिग्रहण में चुनौतियां' : 'Challenges in Land Acquisition',
    challengesSub: hi
      ? 'बुनियादी ढांचा परियोजनाओं के लिए भूमि अधिग्रहण को प्रशासन, कानून और समन्वय में गहरी चुनौतियों का सामना करना पड़ता है।'
      : 'Land acquisition for infrastructure projects faces deep-rooted challenges across administration, law, and coordination.',
    challenges: hi ? [
      { title: 'अनुमोदन में देरी', desc: 'बहुत अधिक अनुमोदन और धीमी सरकारी प्रक्रियाएं भूमि अधिग्रहण में देरी कर सकती हैं।' },
      { title: 'कानूनी और स्वामित्व विवाद', desc: 'भूमि विवाद और स्वामित्व संघर्ष अधिग्रहण को रोक सकते हैं और परियोजना प्रगति में दीर्घकालिक देरी कर सकते हैं।' },
      { title: 'मुआवजे में देरी', desc: 'देर से मुआवजा भूमि कब्जे को धीमा कर सकता है और भूमि मालिकों, अधिकारियों और परियोजना टीमों के लिए कठिनाइयां पैदा कर सकता है।' },
      { title: 'अधूरे दस्तावेज़', desc: 'लापता दस्तावेज और लंबित अधिसूचनाएं सत्यापन, अनुमोदन और भूमि अधिग्रहण प्रक्रिया को धीमा कर सकती हैं।' },
      { title: 'पुनर्वास की चुनौतियां', desc: 'धीमा पुनर्वास परिवारों को प्रभावित कर सकता है और भूमि अधिग्रहण में देरी कर सकता है।' },
      { title: 'समन्वय की कमी', desc: 'विभिन्न विभागों को मिलकर काम करना होता है, लेकिन धीमी संचार प्रतिक्रियाएं बाधाएं और देरी पैदा कर सकती हैं।' },
    ] : [
      { title: 'Approval Delays', desc: 'Too many approvals and slow government processes can hold up land acquisition and delay the overall infrastructure project.' },
      { title: 'Legal & Ownership Issues', desc: 'Land disputes and ownership conflicts can stop acquisition, create uncertainty, and delay project progress for a long time.' },
      { title: 'Compensation Delays', desc: 'Late compensation can slow land possession and create difficulties for landowners, authorities, and project teams during acquisition.' },
      { title: 'Incomplete Documents', desc: 'Missing documents and pending notifications can slow verification, approvals, and other important steps in the land acquisition process.' },
      { title: 'Rehabilitation Challenges', desc: 'Slow rehabilitation and resettlement can affect families and delay land acquisition, creating further impact on overall project implementation.' },
      { title: 'Coordination Gaps', desc: 'Different departments and agencies must work together, but slow communication and responses can create bottlenecks and delay project progress.' },
    ],
    // Features
    features: hi ? [
      { title: 'वास्तविक समय जोखिम स्कोरिंग', desc: 'जोखिम जल्दी जानें। LADRIS  परियोजना डेटा जांचता है और बताता है कि परियोजना में कम, मध्यम या उच्च विलंब जोखिम है।' },
      { title: 'AI निर्णय बुद्धिमत्ता', desc: 'बेहतर निर्णय लें। AI पिछले और वर्तमान डेटा का अध्ययन करता है और टीमों को सही कार्रवाई जल्दी चुनने में मदद करता है।' },
      { title: 'GIS स्थानिक विश्लेषण', desc: 'मानचित्र पर जोखिम देखें। परियोजना स्थान, उच्च जोखिम क्षेत्र और जिलावार पैटर्न देखें।' },
      { title: 'भविष्य संबंधी बाधा पहचान', desc: 'समस्याएं बढ़ने से पहले खोजें। LADRIS  अनुमोदन, कानूनी, मुआवजा और दस्तावेज़ीकरण विलंब का पता लगाता है।' },
      { title: 'विश्लेषण और सिमुलेशन', desc: 'नीति परिवर्तन, बजट परिदृश्य और समयरेखा विकल्पों के सुरक्षित मूल्यांकन के लिए इंटरैक्टिव कॉरिडोर सिम्युलेटर।' },
      { title: 'सुरक्षित सरकारी पहुंच', desc: 'मंत्रालय पदानुक्रम के अनुसार भूमिका-आधारित पहुंच नियंत्रण — केंद्र, राज्य, जिला और LA अधिकारी प्रत्येक को अनुकूलित दृश्य मिलता है।' },
    ] : FEATURES.map(f => ({ title: f.title, desc: f.desc })),
    // Mobile menu
    mobileGitHub: hi ? 'GitHub' : 'GitHub',
    // Footer
    footerCopy: hi ? '© 2026 LADRIS. सर्वाधिकार सुरक्षित। | निर्मित: ग्रामीण विकास मंत्रालय, भारत सरकार' : '© 2026 LADRIS. All rights reserved. | Built for Ministry of Rural Development, GoI',
    footerLinks: hi
      ? ['गोपनीयता', 'शर्तें', 'पहुंच-क्षमता', 'कुकीज़']
      : ['Privacy', 'Terms', 'Accessibility', 'Cookies'],
    // Utility panel labels
    siteMapLabel: hi ? 'साइट मैप' : 'Site Map',
    languageLabel: hi ? 'भाषा' : 'Language',
    accessLabel: hi ? 'पहुंच-क्षमता' : 'Accessibility',
    textSizeLabel: hi ? 'टेक्स्ट आकार' : 'Text Size',
    highContrast: hi ? 'उच्च कंट्रास्ट' : 'High Contrast',
    reducedMotion: hi ? 'कम मूवमेंट' : 'Reduced Motion',
    // Help panel
    helpLabel: hi ? 'LADRIS सहायता' : 'LADRIS Help',
    helpFaqs: hi ? [
      { q: 'डैशबोर्ड कैसे एक्सेस करें?', a: '"डैशबोर्ड एक्सेस करें" या "लॉगिन" पर क्लिक करें और अपने सरकारी क्रेडेंशियल से साइन इन करें। आपका व्यू भूमिका-आधारित है।' },
      { q: 'जोखिम स्तर का क्या अर्थ है?', a: 'कम (हरा) = सही दिशा में। मध्यम (पीला) = ध्यान दें। उच्च (लाल) = तत्काल हस्तक्षेप आवश्यक।' },
      { q: 'परियोजना स्थिति कैसे देखें?', a: 'डैशबोर्ड से परियोजनाएं खोलें और सभी भूमि अधिग्रहण परियोजनाएं चरण-वार स्थिति और विलंब संकेतकों के साथ देखें।' },
      { q: 'विलंब फ्लैग क्यों आते हैं?', a: 'SIA, अधिसूचना, पुरस्कार, मुआवजा या कानूनी चरण अपेक्षित समय सीमा पार करने पर विलंब फ्लैग किया जाता है।' },
      { q: 'जोखिम की गणना कैसे होती है?', a: 'LADRIS ऐतिहासिक पैटर्न, चरण अवधि, लंबित अनुमोदन और कानूनी विवादों के आधार पर AI से परियोजनाओं को स्कोर देता है।' },
    ] : [
      { q: 'How do I access the dashboard?', a: 'Click "Access Dashboard" or "Login" and sign in with your government credentials. Your view is role-based.' },
      { q: 'What do risk levels mean?', a: 'Low (green) = on track. Medium (yellow) = watch closely. High (red) = immediate intervention needed.' },
      { q: 'How do I view project status?', a: 'Go to Projects from the dashboard to see all acquisition projects with stage-wise status and delay indicators.' },
      { q: 'What causes delay flags?', a: 'Delays are flagged when SIA, notification, award, compensation or legal stages exceed expected timelines.' },
      { q: 'How is risk calculated?', a: 'LADRIS uses AI to score projects based on historical patterns, stage durations, pending approvals and legal disputes.' },
    ],
    askQuestion: hi ? 'एक और प्रश्न पूछें' : 'Ask another question',
    helpPlaceholder: hi ? 'जैसे: GIS मानचित्र कैसे उपयोग करें?' : 'e.g. How do I use GIS map?',
    askBtn: hi ? 'पूछें' : 'Ask',
    helpDisclaimer: hi ? 'केवल LADRIS प्लेटफ़ॉर्म विषयों तक सीमित।' : 'Limited to LADRIS platform topics only.',
    // Footer
    footerIntelligence: hi ? 'बुद्धिमत्ता प्लेटफ़ॉर्म' : 'Intelligence Platform',
    footerTagline: hi ? 'AI-संचालित भूमि अधिग्रहण बुद्धिमत्ता — वास्तविक समय जोखिम, तेज़ निर्णय' : 'AI-Powered Land Acquisition Intelligence — Real-time Risk, Faster Decisions',
    footerBuiltFor: hi ? 'ग्रामीण विकास मंत्रालय, भारत सरकार के लिए निर्मित।' : 'Built for Ministry of Rural Development, Government of India.',
    footerLocation: hi ? 'नई दिल्ली, भारत' : 'New Delhi, India',
    footerPlatformTitle: hi ? 'प्लेटफ़ॉर्म' : 'Platform',
    footerPlatformLinks: hi
      ? ['विशेषताएं', 'आर्किटेक्चर', 'विश्लेषण', 'GIS इंटेलिजेंस', 'दस्तावेज़ीकरण', 'सहायता और प्रतिक्रिया',]
      : ['Features', 'Architecture', 'Analytics', 'GIS Intelligence', 'Documentation', 'Help & Feedback'],
    footerPartnersTitle: hi ? 'आधिकारिक साझेदार' : 'Official Partners',
    footerPartners: hi ? [
      { name: 'रेल मंत्रालय', sub: 'भारत सरकार' },
      { name: 'सड़क परिवहन और राजमार्ग मंत्रालय', sub: 'और राजमार्ग (MoRTH)' },
      { name: 'राष्ट्रीय राजमार्ग प्राधिकरण', sub: 'भारत (NHAI)' },
      { name: 'भारी उद्योग मंत्रालय', sub: 'भारत सरकार' },
    ] : [
      { name: 'Ministry of Railways', sub: 'Government of India' },
      { name: 'Ministry of Road Transport', sub: 'and Highways (MoRTH)' },
      { name: 'National Highways Authority', sub: 'of India (NHAI)' },
      { name: 'Ministry of Heavy Industries', sub: 'Government of India' },
    ],
  }

  /* ── Color tokens based on theme ── */
  const colors = {
    bg: isDark ? '#060f1e' : '#f0f4f9',
    navBg: isDark
      ? scrolled ? 'rgba(6,15,30,0.92)' : 'rgba(6,15,30,0.7)'
      : scrolled ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)',
    navBorder: isDark ? 'rgba(244,119,33,0.15)' : 'rgba(0,51,102,0.12)',
    navText: isDark ? '#c9d8f0' : '#2b4263',
    logoText: isDark ? '#f0f6fc' : '#0a1d37',
    cardBg: isDark ? 'rgba(12,26,48,0.95)' : '#ffffff',
    cardBorder: isDark ? 'rgba(244,119,33,0.14)' : 'rgba(0,51,102,0.1)',
    overviewBg: isDark ? '#060f1e' : '#f0f4f9',
    sectionTitle: isDark ? '#f0f6fc' : '#0a1d37',
    sectionText: isDark ? '#94a9c9' : '#4a6280',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.bg,
      fontFamily: 'Inter, system-ui, sans-serif',
      color: colors.sectionTitle,
      overflowX: 'hidden',
      transition: 'background 0.3s ease',
    }}>

      {/* ════════════════════════════════════════════════════
           HEADER — Two-row government portal structure
           Row 1: Govt top bar (flag | ministry | utility icons)
           Row 2: Main navbar (emblem+logo | nav links | actions)
          ════════════════════════════════════════════════════ */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        boxShadow: scrolled
          ? (isDark ? '0 4px 28px rgba(0,0,0,0.6)' : '0 2px 12px rgba(0,51,102,0.14)')
          : 'none',
        transition: 'box-shadow 0.3s ease',
      }}>

        {/* ── ROW 1 · Government Identification Top Bar ── */}
        <div style={{
          background: isDark ? '#070c1b' : '#ffffff',
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}`,
          padding: '0 32px',
          height: 80,
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
        }}>

          {/* Left: Flag + हिंदी/English govt label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>

            {/* Indian Tricolor Flag — inline SVG, no background padding */}
            <svg width="30" height="48" viewBox="0 0 44 30" style={{ flexShrink: 0, borderRadius: 2, display: 'block' }} xmlns="http://www.w3.org/2000/svg">
              {/* Saffron */}
              <rect x="0" y="0" width="44" height="10" fill="#FF9933" />
              {/* White */}
              <rect x="0" y="10" width="44" height="10" fill="#FFFFFF" />
              {/* Green */}
              <rect x="0" y="20" width="44" height="10" fill="#138808" />
              {/* Ashoka Chakra */}
              <circle cx="22" cy="15" r="4.2" fill="none" stroke="#000080" strokeWidth="0.8" />
              <circle cx="22" cy="15" r="0.7" fill="#000080" />
              {[...Array(24)].map((_, i) => {
                const angle = (i * 15 * Math.PI) / 180
                return (
                  <line
                    key={i}
                    x1={22 + 0.7 * Math.cos(angle)}
                    y1={15 + 0.7 * Math.sin(angle)}
                    x2={22 + 4.2 * Math.cos(angle)}
                    y2={15 + 4.2 * Math.sin(angle)}
                    stroke="#000080"
                    strokeWidth="0.5"
                  />
                )
              })}
            </svg>
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: isDark ? '#c9d8f0' : '#1a2e4a', lineHeight: 1.25 }}>
                {T.govIndia}
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: 500, color: isDark ? '#5a7194' : '#5a7194' }}>
                {T.govIndiaEn}
              </div>
            </div>
          </div>

          {/* Center: Ministry name (Hindi + English) */}
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isDark ? '#c9d8f0' : '#1a2e4a', lineHeight: 1.3 }}>
              {T.ministry}
            </div>
            <div style={{ fontSize: '0.68rem', fontWeight: 500, color: isDark ? '#5a7194' : '#5a7194' }}>
              {T.ministryEn}
            </div>
          </div>

          {/* Right: Skip link + utility icon buttons + theme toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', flexWrap: 'wrap', position: 'relative' }}>
            <a href="#main-content" style={{
              fontSize: '0.68rem', fontWeight: 500, color: isDark ? '#4a6280' : '#64748b',
              textDecoration: 'none', marginRight: 4, whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = isDark ? '#7daaff' : '#003366')}
              onMouseLeave={e => (e.currentTarget.style.color = isDark ? '#4a6280' : '#64748b')}
            >
              {T.skipToMain}
            </a>

            {/* ── Site Map ── */}
            <div style={{ position: 'relative' }}>
              <button id="util-sitemap" title="Site Map" onClick={() => togglePanel('sitemap')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  background: activePanel === 'sitemap' ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,51,102,0.08)') : 'none',
                  border: `1px solid ${activePanel === 'sitemap' ? (isDark ? 'rgba(255,255,255,0.28)' : '#003366') : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}`,
                  color: activePanel === 'sitemap' ? (isDark ? '#c9d8f0' : '#003366') : (isDark ? '#6b84a8' : '#64748b'),
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.28)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)' }}
                onMouseLeave={e => { if (activePanel !== 'sitemap') { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' } }}
              ><LayoutGrid size={13} /></button>
              {activePanel === 'sitemap' && (
                <div style={{
                  position: 'absolute', top: 34, right: 0, zIndex: 600, minWidth: 200,
                  background: isDark ? '#0d1a2e' : '#ffffff', borderRadius: 10,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,51,102,0.14)', padding: '10px 0',
                }}>
                  <div style={{ padding: '4px 14px 8px', fontSize: '0.67rem', fontWeight: 700, color: isDark ? '#5a7194' : '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{T.siteMapLabel}</div>
                  {([
                    { label: 'Landing Page', path: '/landing' },
                    { label: 'Login', path: '/login' },
                    { label: 'Full Site Map →', path: '/sitemap', bold: true },
                  ] as { label: string; path: string; bold?: boolean }[]).map(item => (
                    <button key={item.label} onClick={() => { navigate(item.path); setActivePanel(null) }}
                      style={{
                        display: 'block', width: '100%', padding: '7px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
                        fontSize: '0.78rem', fontWeight: item.bold ? 700 : 500,
                        color: item.bold ? '#4080ff' : (isDark ? '#94a9c9' : '#334155'),
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,51,102,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >{item.label}</button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Language ── */}
            <div style={{ position: 'relative' }}>
              <button id="util-language" title="Language" onClick={() => togglePanel('language')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  background: activePanel === 'language' ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,51,102,0.08)') : 'none',
                  border: `1px solid ${activePanel === 'language' ? (isDark ? 'rgba(255,255,255,0.28)' : '#003366') : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}`,
                  color: activePanel === 'language' ? (isDark ? '#c9d8f0' : '#003366') : (isDark ? '#6b84a8' : '#64748b'),
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.28)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)' }}
                onMouseLeave={e => { if (activePanel !== 'language') { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' } }}
              ><Globe size={13} /></button>
              {activePanel === 'language' && (
                <div style={{
                  position: 'absolute', top: 34, right: 0, zIndex: 600, minWidth: 170,
                  background: isDark ? '#0d1a2e' : '#ffffff', borderRadius: 10,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,51,102,0.14)', padding: '10px 0',
                }}>
                  <div style={{ padding: '4px 14px 8px', fontSize: '0.67rem', fontWeight: 700, color: isDark ? '#5a7194' : '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase' }}>{T.languageLabel}</div>
                  {([{ code: 'en' as const, native: 'English' }, { code: 'hi' as const, native: 'हिंदी' }]).map(lang => (
                    <button key={lang.code} onClick={() => { setLanguage(lang.code); setActivePanel(null) }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 14px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s',
                        fontSize: '0.8rem', fontWeight: language === lang.code ? 700 : 500,
                        background: language === lang.code ? (isDark ? 'rgba(64,128,255,0.12)' : 'rgba(0,51,102,0.07)') : 'none',
                        color: language === lang.code ? (isDark ? '#7daaff' : '#003366') : (isDark ? '#94a9c9' : '#334155'),
                      }}
                      onMouseEnter={e => { if (language !== lang.code) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,51,102,0.04)' }}
                      onMouseLeave={e => { if (language !== lang.code) e.currentTarget.style.background = 'none' }}
                    >
                      <span>{lang.native}</span>
                      {language === lang.code && <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Accessibility ── */}
            <div style={{ position: 'relative' }}>
              <button id="util-accessibility" title="Accessibility" onClick={() => togglePanel('accessibility')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  background: activePanel === 'accessibility' ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,51,102,0.08)') : 'none',
                  border: `1px solid ${activePanel === 'accessibility' ? (isDark ? 'rgba(255,255,255,0.28)' : '#003366') : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}`,
                  color: activePanel === 'accessibility' ? (isDark ? '#c9d8f0' : '#003366') : (isDark ? '#6b84a8' : '#64748b'),
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.28)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)' }}
                onMouseLeave={e => { if (activePanel !== 'accessibility') { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' } }}
              ><Accessibility size={13} /></button>
              {activePanel === 'accessibility' && (
                <div style={{
                  position: 'absolute', top: 34, right: 0, zIndex: 600, minWidth: 220,
                  background: isDark ? '#0d1a2e' : '#ffffff', borderRadius: 10,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,51,102,0.14)', padding: '14px',
                }}>
                  <div style={{ fontSize: '0.67rem', fontWeight: 700, color: isDark ? '#5a7194' : '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>{T.accessLabel}</div>
                  {/* Text Size */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.74rem', fontWeight: 600, color: isDark ? '#94a9c9' : '#334155', marginBottom: 6 }}>{T.textSizeLabel}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['normal', 'large', 'xlarge'] as const).map(size => (
                        <button key={size} onClick={() => setFontSize(size)}
                          style={{
                            flex: 1, padding: '5px 0', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                            fontSize: size === 'xlarge' ? '0.85rem' : size === 'large' ? '0.8rem' : '0.75rem',
                            fontWeight: fontSize === size ? 700 : 500,
                            background: fontSize === size ? (isDark ? 'rgba(64,128,255,0.18)' : 'rgba(0,51,102,0.1)') : (isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'),
                            border: `1px solid ${fontSize === size ? (isDark ? 'rgba(64,128,255,0.4)' : '#003366') : (isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0')}`,
                            color: fontSize === size ? (isDark ? '#7daaff' : '#003366') : (isDark ? '#6b84a8' : '#64748b'),
                          }}
                        >{size === 'normal' ? 'A' : size === 'large' ? 'A+' : 'A++'}</button>
                      ))}
                    </div>
                  </div>
                  {/* Toggles */}
                  {([
                    { label: T.highContrast, value: highContrast, set: setHighContrast },
                    { label: T.reducedMotion, value: reducedMotion, set: setReducedMotion },
                  ] as { label: string; value: boolean; set: (v: boolean) => void }[]).map(opt => (
                    <div key={opt.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.78rem', color: isDark ? '#94a9c9' : '#334155' }}>{opt.label}</span>
                      <button onClick={() => opt.set(!opt.value)}
                        style={{
                          width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                          background: opt.value ? '#4080ff' : (isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'),
                        }}>
                        <span style={{ position: 'absolute', top: 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', display: 'block', left: opt.value ? 18 : 3 }} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Help ── */}
            <div style={{ position: 'relative' }}>
              <button id="util-help" title="Help" onClick={() => togglePanel('help')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                  background: activePanel === 'help' ? (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,51,102,0.08)') : 'none',
                  border: `1px solid ${activePanel === 'help' ? (isDark ? 'rgba(255,255,255,0.28)' : '#003366') : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0')}`,
                  color: activePanel === 'help' ? (isDark ? '#c9d8f0' : '#003366') : (isDark ? '#6b84a8' : '#64748b'),
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#c9d8f0' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.28)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)' }}
                onMouseLeave={e => { if (activePanel !== 'help') { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' } }}
              ><HelpCircle size={13} /></button>
              {activePanel === 'help' && (
                <div style={{
                  position: 'absolute', top: 34, right: 0, zIndex: 600, minWidth: 260, maxWidth: 300,
                  background: isDark ? '#0d1a2e' : '#ffffff', borderRadius: 10,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                  boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.6)' : '0 8px 24px rgba(0,51,102,0.14)', padding: '14px',
                }}>
                  <div style={{ fontSize: '0.67rem', fontWeight: 700, color: isDark ? '#5a7194' : '#94a3b8', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10 }}>{T.helpLabel}</div>
                  {T.helpFaqs.map(item => (
                    <div key={item.q} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: '0.76rem', fontWeight: 600, color: isDark ? '#c9d8f0' : '#0a1d37', marginBottom: 3 }}>{item.q}</div>
                      <div style={{ fontSize: '0.72rem', color: isDark ? '#5a7194' : '#64748b', lineHeight: 1.5 }}>{item.a}</div>
                    </div>
                  ))}

                  {/* ── More Help ── */}
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : '#e2e8f0'}` }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: isDark ? '#7daaff' : '#003366', marginBottom: 6 }}>{T.askQuestion}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder={T.helpPlaceholder}
                        value={helpQuery}
                        onChange={e => { setHelpQuery(e.target.value); if (!e.target.value) setHelpAnswer('') }}
                        onKeyDown={e => { if (e.key === 'Enter') handleHelpQuery(helpQuery) }}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.72rem', outline: 'none', background: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'}`, color: isDark ? '#c9d8f0' : '#334155' }}
                      />
                      <button onClick={() => handleHelpQuery(helpQuery)} style={{ padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#4080ff', color: '#fff', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 700 }}>{T.askBtn}</button>
                    </div>
                    {helpAnswer && (
                      <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 7, background: isDark ? 'rgba(64,128,255,0.08)' : 'rgba(0,51,102,0.05)', border: `1px solid ${isDark ? 'rgba(64,128,255,0.18)' : 'rgba(0,51,102,0.1)'}`, fontSize: '0.72rem', color: isDark ? '#94a9c9' : '#334155', lineHeight: 1.55 }}>
                        {helpAnswer}
                      </div>
                    )}
                    <div style={{ fontSize: '0.64rem', color: isDark ? '#3d5470' : '#94a3b8', marginTop: 6, lineHeight: 1.4 }}>{T.helpDisclaimer}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme toggle */}
            <button title={isDark ? 'Light mode' : 'Dark mode'} onClick={toggleTheme}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 5, background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`, cursor: 'pointer', color: isDark ? '#6b84a8' : '#64748b', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#facc15' : '#003366'; e.currentTarget.style.borderColor = isDark ? 'rgba(250,204,21,0.4)' : '#003366'; e.currentTarget.style.background = isDark ? 'rgba(250,204,21,0.08)' : 'rgba(0,51,102,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#6b84a8' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'; e.currentTarget.style.background = 'none' }}
            >
              {isDark ? <Sun size={13} /> : <Moon size={13} />}
            </button>

            {/* Click-outside backdrop */}
            {activePanel && (
              <div style={{ position: 'fixed', inset: 0, zIndex: 599 }} onClick={() => setActivePanel(null)} />
            )}
          </div>
        </div>

        {/* ── ROW 2 · Main Navigation Bar ── */}
        <div style={{
          background: isDark
            ? (scrolled ? 'rgba(5,10,22,0.98)' : 'rgba(5,10,22,0.95)')
            : (scrolled ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.98)'),
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: `1px solid ${isDark ? 'rgba(244,119,33,0.1)' : '#e2e8f0'}`,
          transition: 'background 0.3s ease',
        }}>
          <div style={{
            maxWidth: 1320, margin: '0 auto',
            padding: '0 32px', height: 85,
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 16,
          }}>

            {/* Left: Emblem + Gap + Logo + Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexShrink: 0 }}>
              {/* MoRTH Ashoka Emblem — pre-cropped: emblem + Hindi only, no English text */}
              <img
                src="/logo_morth_clean.png"
                alt="MoRTH Emblem"
                style={{ height: 46, width: 'auto', display: 'block', flexShrink: 0 }}
              />
              {/* logo.png + Brand text */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/logo.png" alt="LADRIS" style={{ width: 42, height: 42, objectFit: 'contain', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: isDark ? '#f0f6fc' : '#0a1d37', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                    LADRIS<span style={{ color: '#4080ff' }}></span>
                  </div>
                  <div style={{ fontSize: '0.45rem', fontWeight: 600, color: isDark ? '#4a6280' : '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>
                    {T.brandSub1}<br />
                    {T.brandSub2}
                  </div>
                </div>
              </div>
            </div>

            {/* Center: Nav Links — wrapped in a ref for outside-click detection */}
            <nav ref={dropdownRef} className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', flex: 1, justifyContent: 'center', position: 'relative' }}>
              {/* Features */}
              <button
                onClick={() => { setOpenDropdown(null); scrollToSection('features') }}
                style={{
                  background: activeSection === 'features' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '0 13px', height: 60,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.865rem', fontWeight: activeSection === 'features' ? 700 : 500,
                  color: activeSection === 'features' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'),
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  letterSpacing: '0.005em', transition: 'all 0.15s',
                  borderBottom: `3px solid ${activeSection === 'features' ? '#f47721' : 'transparent'}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366'; e.currentTarget.style.borderBottomColor = '#f47721'; e.currentTarget.style.background = isDark ? 'rgba(244,119,33,0.05)' : 'rgba(0,51,102,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.color = activeSection === 'features' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'); e.currentTarget.style.borderBottomColor = activeSection === 'features' ? '#f47721' : 'transparent'; e.currentTarget.style.background = activeSection === 'features' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none' }}
              >
                {T.navFeatures}
              </button>

              {/* Architecture */}
              <button
                onClick={() => { setOpenDropdown(null); scrollToSection('architecture') }}
                style={{
                  background: activeSection === 'architecture' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '0 13px', height: 60,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.865rem', fontWeight: activeSection === 'architecture' ? 700 : 500,
                  color: activeSection === 'architecture' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'),
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  letterSpacing: '0.005em', transition: 'all 0.15s',
                  borderBottom: `3px solid ${activeSection === 'architecture' ? '#f47721' : 'transparent'}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366'; e.currentTarget.style.borderBottomColor = '#f47721'; e.currentTarget.style.background = isDark ? 'rgba(244,119,33,0.05)' : 'rgba(0,51,102,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.color = activeSection === 'architecture' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'); e.currentTarget.style.borderBottomColor = activeSection === 'architecture' ? '#f47721' : 'transparent'; e.currentTarget.style.background = activeSection === 'architecture' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none' }}
              >
                {T.navArchitecture}
              </button>

              {/* Analytics */}
              <button
                onClick={() => { setOpenDropdown(null); scrollToSection('analytics') }}
                style={{
                  background: activeSection === 'analytics' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '0 13px', height: 60,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.865rem', fontWeight: activeSection === 'analytics' ? 700 : 500,
                  color: activeSection === 'analytics' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'),
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  letterSpacing: '0.005em', transition: 'all 0.15s',
                  borderBottom: `3px solid ${activeSection === 'analytics' ? '#f47721' : 'transparent'}`,
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366'; e.currentTarget.style.borderBottomColor = '#f47721'; e.currentTarget.style.background = isDark ? 'rgba(244,119,33,0.05)' : 'rgba(0,51,102,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.color = activeSection === 'analytics' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'); e.currentTarget.style.borderBottomColor = activeSection === 'analytics' ? '#f47721' : 'transparent'; e.currentTarget.style.background = activeSection === 'analytics' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none' }}
              >
                {T.navAnalytics}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55, flexShrink: 0 }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* About ▾ — with dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setOpenDropdown(prev => prev === 'about' ? null : 'about')}
                  style={{
                    background: openDropdown === 'about' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none',
                    border: 'none', cursor: 'pointer',
                    padding: '0 13px', height: 60,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.865rem', fontWeight: openDropdown === 'about' ? 700 : 500,
                    color: openDropdown === 'about' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'),
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                    letterSpacing: '0.005em', transition: 'all 0.15s',
                    borderBottom: `3px solid ${openDropdown === 'about' ? '#f47721' : 'transparent'}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366'; e.currentTarget.style.borderBottomColor = '#f47721'; e.currentTarget.style.background = isDark ? 'rgba(244,119,33,0.05)' : 'rgba(0,51,102,0.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = openDropdown === 'about' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'); e.currentTarget.style.borderBottomColor = openDropdown === 'about' ? '#f47721' : 'transparent'; e.currentTarget.style.background = openDropdown === 'about' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none' }}
                >
                  {T.navAbout}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ opacity: 0.55, flexShrink: 0, transform: openDropdown === 'about' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {/* About dropdown */}
                {openDropdown === 'about' && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 500,
                    minWidth: 230,
                    background: isDark ? '#0d1a2e' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    borderRadius: 6,
                    boxShadow: isDark ? '0 6px 24px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                  }}>
                    {([
                      { label: 'About the Project', route: '/about/project' },
                      { label: 'User Guide', route: '/about/user-guide' },
                      { label: 'Government Guidelines Compliance', route: '/about/compliance' },
                    ] as { label: string; route: string }[]).map((item, i, arr) => (
                      <button
                        key={item.route}
                        onClick={() => { setOpenDropdown(null); navigate(item.route) }}
                        style={{
                          display: 'block', width: '100%', padding: '11px 16px',
                          background: 'none', border: 'none',
                          borderBottom: i < arr.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}` : 'none',
                          textAlign: 'left', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: '0.855rem', fontWeight: 500,
                          color: isDark ? '#c9d8f0' : '#334155',
                          transition: 'background 0.12s, color 0.12s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,51,102,0.04)'; e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = isDark ? '#c9d8f0' : '#334155' }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Help & Feedback ▾ — with dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setOpenDropdown(prev => prev === 'help' ? null : 'help')}
                  style={{
                    background: openDropdown === 'help' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none',
                    border: 'none', cursor: 'pointer',
                    padding: '0 13px', height: 60,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    fontSize: '0.865rem', fontWeight: openDropdown === 'help' ? 700 : 500,
                    color: openDropdown === 'help' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'),
                    fontFamily: 'inherit', whiteSpace: 'nowrap',
                    letterSpacing: '0.005em', transition: 'all 0.15s',
                    borderBottom: `3px solid ${openDropdown === 'help' ? '#f47721' : 'transparent'}`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366'; e.currentTarget.style.borderBottomColor = '#f47721'; e.currentTarget.style.background = isDark ? 'rgba(244,119,33,0.05)' : 'rgba(0,51,102,0.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = openDropdown === 'help' ? (isDark ? '#f0f6fc' : '#003366') : (isDark ? '#94a9c9' : '#334155'); e.currentTarget.style.borderBottomColor = openDropdown === 'help' ? '#f47721' : 'transparent'; e.currentTarget.style.background = openDropdown === 'help' ? (isDark ? 'rgba(244,119,33,0.07)' : 'rgba(0,51,102,0.05)') : 'none' }}
                >
                  {T.navHelp}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ opacity: 0.55, flexShrink: 0, transform: openDropdown === 'help' ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}>
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>

                {/* Help dropdown */}
                {openDropdown === 'help' && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 500,
                    minWidth: 200,
                    background: isDark ? '#0d1a2e' : '#ffffff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}`,
                    borderRadius: 6,
                    boxShadow: isDark ? '0 6px 24px rgba(0,0,0,0.5)' : '0 4px 16px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                  }}>
                    {([
                      { label: 'Contact & Feedback', route: '/help/contact' },
                      { label: 'Privacy Policy', route: '/help/privacy' },
                      { label: 'Terms of Use', route: '/help/terms' },
                      { label: 'FAQ', route: '/help/faq' },
                    ] as { label: string; route: string }[]).map((item, i, arr) => (
                      <button
                        key={item.route}
                        onClick={() => { setOpenDropdown(null); navigate(item.route) }}
                        style={{
                          display: 'block', width: '100%', padding: '11px 16px',
                          background: 'none', border: 'none',
                          borderBottom: i < arr.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9'}` : 'none',
                          textAlign: 'left', cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: '0.855rem', fontWeight: 500,
                          color: isDark ? '#c9d8f0' : '#334155',
                          transition: 'background 0.12s, color 0.12s',
                          whiteSpace: 'nowrap',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,51,102,0.04)'; e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = isDark ? '#c9d8f0' : '#334155' }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents */}
              <button
                style={{
                  background: 'none',
                  border: 'none', cursor: 'pointer',
                  padding: '0 13px', height: 60,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: '0.865rem', fontWeight: 500,
                  color: isDark ? '#94a9c9' : '#334155',
                  fontFamily: 'inherit', whiteSpace: 'nowrap',
                  letterSpacing: '0.005em', transition: 'all 0.15s',
                  borderBottom: '3px solid transparent',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = isDark ? '#f0f6fc' : '#003366'; e.currentTarget.style.borderBottomColor = '#f47721'; e.currentTarget.style.background = isDark ? 'rgba(244,119,33,0.05)' : 'rgba(0,51,102,0.04)' }}
                onMouseLeave={e => { e.currentTarget.style.color = isDark ? '#94a9c9' : '#334155'; e.currentTarget.style.borderBottomColor = 'transparent'; e.currentTarget.style.background = 'none' }}
              >
                {T.navDocuments}
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55, flexShrink: 0 }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </nav>

            {/* Right: GitHub outlined + Login solid */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>

              {/* GitHub — outlined button */}
              <motion.button
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                onClick={() => window.open('https://github.com/SathvikaTalari/LADRIS', '_blank', 'noopener,noreferrer')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '7px 16px',
                  background: 'transparent',
                  border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.22)' : '#cbd5e1'}`,
                  borderRadius: 6, color: isDark ? '#c9d8f0' : '#334155',
                  fontWeight: 600, fontSize: '0.855rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.18s', letterSpacing: '0.005em',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.45)' : '#003366'
                  e.currentTarget.style.color = isDark ? '#ffffff' : '#003366'
                  e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,51,102,0.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.22)' : '#cbd5e1'
                  e.currentTarget.style.color = isDark ? '#c9d8f0' : '#334155'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {/* GitHub SVG icon */}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
                </svg>
                GitHub
              </motion.button>

              {/* Login — solid filled button */}
              <motion.button
                id="nav-login-btn"
                whileHover={{ scale: 1.04, translateY: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAccessDashboard}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 22px',
                  background: isDark ? 'linear-gradient(135deg,#4080ff,#7c5cfc)' : '#003366',
                  border: 'none', borderRadius: 6,
                  color: '#ffffff', fontWeight: 700,
                  fontSize: '0.875rem', cursor: 'pointer',
                  fontFamily: 'inherit', letterSpacing: '0.02em',
                  boxShadow: isDark ? '0 3px 14px rgba(64,128,255,0.4)' : '0 3px 12px rgba(0,51,102,0.35)',
                }}
              >
                {T.navLogin}
              </motion.button>

              {/* Mobile hamburger (hidden on desktop) */}
              <button
                className="landing-mobile-menu-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#94a9c9' : '#334155', padding: 4 }}
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {/* Mobile dropdown */}
          {mobileMenuOpen && (
            <div style={{
              background: isDark ? 'rgba(5,10,22,0.98)' : '#ffffff',
              borderTop: `1px solid ${isDark ? 'rgba(244,119,33,0.1)' : '#e2e8f0'}`,
              padding: '12px 24px 20px',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              {/* Features */}
              <button
                onClick={() => { setMobileMenuOpen(false); setTimeout(() => scrollToSection('features'), 80) }}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, color: isDark ? '#94a9c9' : '#334155', fontFamily: 'inherit' }}
              >{T.navFeatures}</button>

              {/* Architecture */}
              <button
                onClick={() => { setMobileMenuOpen(false); setTimeout(() => scrollToSection('architecture'), 80) }}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, color: isDark ? '#94a9c9' : '#334155', fontFamily: 'inherit' }}
              >{T.navArchitecture}</button>

              {/* Analytics */}
              <button
                onClick={() => { setMobileMenuOpen(false); setTimeout(() => scrollToSection('analytics'), 80) }}
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, color: isDark ? '#94a9c9' : '#334155', fontFamily: 'inherit' }}
              >{T.navAnalytics}</button>

              {/* About ▾ — expandable */}
              <button
                onClick={() => setMobileAboutOpen(p => !p)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', background: mobileAboutOpen ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,51,102,0.04)') : 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 8, fontSize: '0.9rem', fontWeight: mobileAboutOpen ? 600 : 500, color: isDark ? '#94a9c9' : '#334155', fontFamily: 'inherit' }}
              >
                <span>{T.navAbout}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ opacity: 0.55, transform: mobileAboutOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {mobileAboutOpen && (
                <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`, marginLeft: 12 }}>
                  {([
                    { label: 'About the Project', route: '/about/project' },
                    { label: 'User Guide', route: '/about/user-guide' },
                    { label: 'Government Guidelines Compliance', route: '/about/compliance' },
                  ] as { label: string; route: string }[]).map(item => (
                    <button key={item.route}
                      onClick={() => { setMobileMenuOpen(false); setMobileAboutOpen(false); navigate(item.route) }}
                      style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: 6, fontSize: '0.855rem', fontWeight: 400, color: isDark ? '#7a9abf' : '#475569', fontFamily: 'inherit' }}
                    >{item.label}</button>
                  ))}
                </div>
              )}

              {/* Help & Feedback ▾ — expandable */}
              <button
                onClick={() => setMobileHelpOpen(p => !p)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', textAlign: 'left', background: mobileHelpOpen ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,51,102,0.04)') : 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 8, fontSize: '0.9rem', fontWeight: mobileHelpOpen ? 600 : 500, color: isDark ? '#94a9c9' : '#334155', fontFamily: 'inherit' }}
              >
                <span>{T.navHelp}</span>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ opacity: 0.55, transform: mobileHelpOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {mobileHelpOpen && (
                <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2, borderLeft: `2px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0'}`, marginLeft: 12 }}>
                  {([
                    { label: 'Contact & Feedback', route: '/help/contact' },
                    { label: 'Privacy Policy', route: '/help/privacy' },
                    { label: 'Terms of Use', route: '/help/terms' },
                    { label: 'FAQ', route: '/help/faq' },
                  ] as { label: string; route: string }[]).map(item => (
                    <button key={item.route}
                      onClick={() => { setMobileMenuOpen(false); setMobileHelpOpen(false); navigate(item.route) }}
                      style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: 6, fontSize: '0.855rem', fontWeight: 400, color: isDark ? '#7a9abf' : '#475569', fontFamily: 'inherit' }}
                    >{item.label}</button>
                  ))}
                </div>
              )}

              {/* Documents */}
              <button
                style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 12px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500, color: isDark ? '#94a9c9' : '#334155', fontFamily: 'inherit' }}
              >{T.navDocuments}</button>

              <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`, display: 'flex', gap: 10 }}>
                <button onClick={() => window.open('https://github.com/SathvikaTalari/LADRIS', '_blank', 'noopener,noreferrer')} style={{ flex: 1, padding: '9px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: 'transparent', border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.2)' : '#cbd5e1'}`, color: isDark ? '#c9d8f0' : '#334155', fontWeight: 600, fontSize: '0.875rem' }}>GitHub</button>
                <button onClick={handleAccessDashboard} style={{ flex: 1, padding: '9px 0', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', background: '#003366', border: 'none', color: '#ffffff', fontWeight: 700, fontSize: '0.875rem' }}>{T.navLogin}</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ════ HERO SECTION ════ */}
      <div ref={heroRef} style={{ position: 'relative', overflow: 'hidden', minHeight: '440px' }}>

        {/* ── Slideshow background images (crossfade) ── */}
        {HERO_SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            style={{
              position: 'absolute', inset: 0, zIndex: 0,
              backgroundImage: `url(${slide.src})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 40%',
              opacity: i === activeSlide ? 1 : 0,
              transition: 'opacity 1.2s cubic-bezier(0.4,0,0.2,1)',
              // Ken-Burns zoom on the active slide
              transform: i === activeSlide ? 'scale(1.05)' : 'scale(1)',
              transformOrigin: 'center center',
            }}
          />
        ))}

        {/* Gradient overlays */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(180deg, rgba(6,15,30,0.52) 0%, rgba(6,15,30,0.22) 45%, rgba(6,15,30,0.78) 100%)',
        }} />
        {/* Left text fade */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(90deg, rgba(6,15,30,0.55) 0%, transparent 50%)',
        }} />

        {/* Subtle grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }} />

        <motion.div
          style={{ opacity: heroOpacity, y: heroY, position: 'relative', zIndex: 2 }}
        >
          <div style={{
            maxWidth: 1280, margin: '0 auto', minHeight: '440px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
          }}>
            <div style={{ textAlign: 'center' }}>
              {/* Main headline */}
              <motion.h1
                initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.75, delay: 0.1 }}
                style={{
                  fontSize: 'clamp(1.6rem, 3vw, 2.4rem)',
                  fontWeight: 900,
                  lineHeight: 1.15,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
                  marginBottom: 16,
                  textShadow: '0 2px 20px rgba(0,0,0,0.7), 0 1px 4px rgba(0,0,0,0.9)',
                  whiteSpace: 'nowrap',
                }}
              >
                {T.heroTitle}
              </motion.h1>

              {/* Sub-headline */}
              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.2 }}
                style={{
                  fontSize: '1.1rem',
                  color: 'rgba(255,255,255,0.88)',
                  lineHeight: 1.75,
                  marginBottom: 28,
                  fontWeight: 400,
                  textShadow: '0 1px 8px rgba(0,0,0,0.7)',
                  whiteSpace: 'nowrap',
                }}
              >
                {T.heroSub}
              </motion.p>


            </div>
          </div>
        </motion.div>

        {/* ── Slide caption (bottom-right) ── */}
        <div style={{
          position: 'absolute', bottom: 56, right: 40, zIndex: 10,
          textAlign: 'right',
          opacity: 0.92,
          pointerEvents: 'none',
          maxWidth: 360,
        }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700,
            color: 'rgba(255,255,255,0.6)', letterSpacing: '0.02em',
            marginBottom: 3,
          }}>
            {HERO_SLIDES[activeSlide].ministry}
          </div>
          <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.88)', fontWeight: 600, lineHeight: 1.3 }}>
            {T.slideCaption(HERO_SLIDES[activeSlide].caption)}
          </div>
        </div>

        {/* ── Prev / Next arrows ── */}
        <button
          onClick={prevSlide}
          style={{
            position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, background: 'rgba(6,15,30,0.55)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff', backdropFilter: 'blur(8px)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,119,33,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(6,15,30,0.55)')}
          aria-label="Previous slide"
        >
          <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button
          onClick={nextSlide}
          style={{
            position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, background: 'rgba(6,15,30,0.55)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%', width: 40, height: 40,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff', backdropFilter: 'blur(8px)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(244,119,33,0.7)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(6,15,30,0.55)')}
          aria-label="Next slide"
        >
          <ChevronRight size={18} />
        </button>

        {/* ── Navigation dots ── */}
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, display: 'flex', gap: 10, alignItems: 'center',
        }}>
          {HERO_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goToSlide(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === activeSlide ? 28 : 8,
                height: 8,
                borderRadius: 4,
                background: i === activeSlide ? '#f47721' : 'rgba(255,255,255,0.4)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: i === activeSlide ? '0 0 8px rgba(244,119,33,0.7)' : 'none',
              }}
            />
          ))}
        </div>
      </div>



      {/* ════ OVERVIEW SECTION ════ */}
      <section style={{
        background: colors.overviewBg,
        padding: '80px 40px',
      }}>
        <div style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 80, alignItems: 'start',
        }}
          className="landing-overview-grid"
        >
          {/* Left: Overview text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65 }}
          >

            <h2 style={{
              fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
              fontWeight: 900, letterSpacing: '-0.035em',
              color: colors.sectionTitle, lineHeight: 1.15,
              marginBottom: 20,
            }}>
              {T.overviewTitle}
            </h2>

            <p style={{
              fontSize: '0.95rem', lineHeight: 1.8,
              color: colors.sectionText, marginBottom: 36,
            }}>
              {T.overviewText}
            </p>

            {/* CTA pair */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <motion.button
                id="overview-access-dashboard-btn"
                whileHover={{ scale: 1.04, translateY: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleAccessDashboard}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '12px 28px',
                  background: isDark
                    ? 'linear-gradient(135deg, #4080ff 0%, #7c5cfc 100%)'
                    : 'linear-gradient(135deg, #003366 0%, #004a99 100%)',
                  border: 'none', borderRadius: 10,
                  color: '#ffffff', fontWeight: 800,
                  fontSize: '0.9375rem', cursor: 'pointer',
                  fontFamily: 'inherit',
                  boxShadow: isDark
                    ? '0 4px 20px rgba(64,128,255,0.4)'
                    : '0 4px 18px rgba(0,51,102,0.3)',
                  letterSpacing: '-0.01em',
                }}
              >
                {T.overviewCta1}
                <ArrowRight size={17} strokeWidth={2.5} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '11px 24px',
                  background: 'transparent',
                  border: `1.5px solid ${isDark ? 'rgba(64,128,255,0.35)' : 'rgba(0,51,102,0.3)'}`,
                  borderRadius: 10,
                  color: isDark ? '#7daaff' : '#003366',
                  fontWeight: 600, fontSize: '0.9375rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isDark ? 'rgba(64,128,255,0.08)' : 'rgba(0,51,102,0.06)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {T.overviewCta2}
                <ChevronRight size={16} />
              </motion.button>
            </div>
          </motion.div>

          {/* Right: Feature mini cards (2×2 grid) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.65, delay: 0.1 }}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
            }}
          >
            {T.features.slice(0, 4).map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.05 * i }}
                whileHover={{ translateY: -3 }}
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${colors.cardBorder}`,
                  borderRadius: 16,
                  padding: '24px 20px',
                  boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.45)' : '0 2px 12px rgba(0,51,102,0.08)',
                  transition: 'all 0.22s ease',
                  cursor: 'default',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `${FEATURES[i].color}55`
                  e.currentTarget.style.boxShadow = isDark
                    ? `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${FEATURES[i].color}22`
                    : `0 6px 24px rgba(0,51,102,0.14), 0 0 0 1px ${FEATURES[i].color}22`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = colors.cardBorder
                  e.currentTarget.style.boxShadow = isDark ? '0 4px 24px rgba(0,0,0,0.45)' : '0 2px 12px rgba(0,51,102,0.08)'
                }}
              >
                {/* Top accent line */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                  background: `linear-gradient(90deg, ${FEATURES[i].color}, transparent)`,
                  opacity: 0.6,
                }} />
                <div style={{ color: FEATURES[i].color, marginBottom: 14, display: 'flex', alignItems: 'center' }}>
                  {FEATURES[i].icon}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: colors.sectionTitle, marginBottom: 8, lineHeight: 1.3 }}>
                  {feat.title}
                </div>
                <p style={{ fontSize: '0.8rem', lineHeight: 1.65, color: colors.sectionText, margin: 0 }}>
                  {feat.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ════ CHALLENGES SECTION ════ */}
      <section style={{
        background: isDark ? '#07111f' : '#f5f8fc',
        padding: '80px 40px 60px',
        borderTop: `1px solid ${isDark ? 'rgba(74,111,165,0.12)' : 'rgba(74,111,165,0.1)'}`,
        borderBottom: `1px solid ${isDark ? 'rgba(74,111,165,0.12)' : 'rgba(74,111,165,0.1)'}`,
        overflow: 'hidden',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>

          {/* Section header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            style={{ textAlign: 'center', marginBottom: 52 }}
          >
            <h2 style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800,
              color: colors.sectionTitle, letterSpacing: '-0.03em',
              lineHeight: 1.2, marginBottom: 14,
            }}>
              {T.challengesTitle}
            </h2>
            <p style={{
              fontSize: '0.92rem', color: colors.sectionText,
              maxWidth: 560, margin: '0 auto', lineHeight: 1.75,
            }}>
              {T.challengesSub}
            </p>
          </motion.div>

          {/* 6 Challenge cards — 3×2 grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 20,
          }}>
            {T.challenges.map((challenge, i) => (
              <motion.div
                key={challenge.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.07 }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(74,111,165,0.4)'
                    ; (e.currentTarget as HTMLDivElement).style.boxShadow = isDark
                      ? '0 8px 28px rgba(0,0,0,0.4), 0 0 0 1px rgba(74,111,165,0.2)'
                      : '0 6px 22px rgba(74,111,165,0.12), 0 0 0 1px rgba(74,111,165,0.15)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = isDark ? 'rgba(74,111,165,0.14)' : 'rgba(74,111,165,0.1)'
                    ; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                }}
                style={{
                  background: colors.cardBg,
                  border: `1px solid ${isDark ? 'rgba(74,111,165,0.14)' : 'rgba(74,111,165,0.1)'}`,
                  borderRadius: 14, padding: '24px 22px',
                  cursor: 'default',
                  transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                  background: 'linear-gradient(90deg, #4a6fa5, transparent)',
                  borderRadius: '14px 14px 0 0',
                }} />

                {/* Number */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: isDark ? 'rgba(74,111,165,0.15)' : 'rgba(74,111,165,0.1)',
                  border: `1px solid ${isDark ? 'rgba(74,111,165,0.3)' : 'rgba(74,111,165,0.25)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 800, color: '#4a6fa5',
                  marginBottom: 14, flexShrink: 0,
                }}>
                  {String(i + 1).padStart(2, '0')}
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: '0.95rem', fontWeight: 700,
                  color: colors.sectionTitle, marginBottom: 8,
                  lineHeight: 1.3,
                }}>
                  {challenge.title}
                </h3>

                {/* Description */}
                <p style={{
                  fontSize: '0.83rem', color: colors.sectionText,
                  lineHeight: 1.7, margin: 0,
                }}>
                  {challenge.desc}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Bridge connector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.45 }}
            style={{ textAlign: 'center', marginTop: 52 }}
          >
            {/* Vertical line */}
            <div style={{
              width: 1, height: 40, background: `linear-gradient(to bottom, rgba(74,111,165,0.35), transparent)`,
              margin: '0 auto 20px',
            }} />

          </motion.div>

        </div>
      </section>

      {/* ════ KEY COMPONENTS SECTION ════ */}
      <div id="features" style={{ scrollMarginTop: 0 }}>
        <KeyComponentsSection isDark={isDark} language={language} />
      </div>

      {/* ════ ALL FEATURES SECTION ════ */}
      <FeaturesRippleSection isDark={isDark} language={language} />

      {/* ════ SMART ANALYTICS SECTION ════ */}
      <div id="analytics" style={{ scrollMarginTop: 0 }}>
        <SmartAnalyticsSection isDark={isDark} language={language} />
      </div>

      {/* ════ GIS INTELLIGENCE SECTION ════ */}
      <div id="gis-intelligence" style={{ scrollMarginTop: 0 }}>
        <GisIntelligenceSection isDark={isDark} language={language} />
      </div>

      {/* ════ ROLES SECTION ════ */}
      <RolesConnectedSection isDark={isDark} />

      {/* ════ SYSTEM ARCHITECTURE SECTION ════ */}
      <div id="architecture" style={{ scrollMarginTop: 0 }}>
        <SystemArchitectureSection isDark={isDark} />
      </div>

      {/* ════ [REMOVED OLD INLINE ARCHITECTURE] ════ */}
      <section style={{ display: 'none' }}>
        {/* Background decorative grid */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: isDark
            ? 'linear-gradient(rgba(64,128,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(64,128,255,0.04) 1px, transparent 1px)'
            : 'linear-gradient(rgba(0,51,102,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,51,102,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>

          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.6 }}
            style={{ textAlign: 'center', marginBottom: 72 }}
          >
            <p style={{
              fontSize: '1rem', color: colors.sectionText,
              maxWidth: 620, margin: '0 auto', lineHeight: 1.75,
            }}>
              LADRIS is built on a robust four-layer architecture engineered for high-throughput
              government operations — from raw data ingestion to AI-powered insights on the dashboard.
            </p>
          </motion.div>

          {/* Tier cards — horizontal flow on desktop, vertical on mobile */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 0,
            position: 'relative',
          }}
            className="arch-tier-grid"
          >
            {[
              {
                tier: '01',
                label: 'Data Layer',
                subtitle: 'Ingestion & Storage',
                color: '#f47721',
                glowColor: 'rgba(244,119,33,0.18)',
                borderColor: 'rgba(244,119,33,0.35)',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                ),
                items: ['PostgreSQL + PostGIS', 'GIS / Census 2011', 'BhoomiRashi Portal', 'data.gov.in API'],
              },
              {
                tier: '02',
                label: 'Processing Layer',
                subtitle: 'ETL & Computation',
                color: '#4080ff',
                glowColor: 'rgba(64,128,255,0.18)',
                borderColor: 'rgba(64,128,255,0.35)',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48 2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48 2.83-2.83" />
                  </svg>
                ),
                items: ['ETL Pipeline (3 Phases)', 'Risk Score Engine', 'Spatial Computations', 'Data Validation'],
              },
              {
                tier: '03',
                label: 'Intelligence Layer',
                subtitle: 'AI / ML & APIs',
                color: '#7c5cfc',
                glowColor: 'rgba(124,92,252,0.18)',
                borderColor: 'rgba(124,92,252,0.35)',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a5 5 0 0 1 5 5v4a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
                    <path d="M8 21v-2a4 4 0 0 1 8 0v2" />
                    <path d="M2 14h2m16 0h2" />
                  </svg>
                ),
                items: ['FastAPI Backend', 'ML Risk Predictor', 'WebSocket Alerts', 'REST / GraphQL'],
              },
              {
                tier: '04',
                label: 'Presentation Layer',
                subtitle: 'UI & Visualisation',
                color: '#00b894',
                glowColor: 'rgba(0,184,148,0.18)',
                borderColor: 'rgba(0,184,148,0.35)',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8m-4-4v4" />
                  </svg>
                ),
                items: ['React + Vite SPA', 'MapLibre GL Maps', 'Recharts Analytics', 'RBAC Role Views'],
              },
            ].map((tier, i) => (
              <motion.div
                key={tier.tier}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
                style={{ position: 'relative', display: 'flex' }}
              >
                {/* Connector arrow between tiers (except last) */}
                {i < 3 && (
                  <div style={{
                    position: 'absolute', right: -1, top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 10, display: 'flex', alignItems: 'center',
                  }}>
                    <div style={{
                      width: 22, height: 2,
                      background: `linear-gradient(90deg, ${tier.color}, ${[
                        '#4080ff', '#7c5cfc', '#00b894', '#4080ff'
                      ][i]})`,
                      opacity: 0.6,
                    }} />
                    <svg width="10" height="10" viewBox="0 0 10 10" style={{ flexShrink: 0 }}>
                      <path d="M1 5h8M6 2l3 3-3 3" stroke={tier.color} strokeWidth="1.6"
                        strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
                    </svg>
                  </div>
                )}

                {/* Tier Card */}
                <motion.div
                  whileHover={{ translateY: -5, boxShadow: `0 16px 48px ${tier.glowColor}` }}
                  transition={{ duration: 0.22 }}
                  style={{
                    flex: 1,
                    margin: '0 10px',
                    background: isDark
                      ? `linear-gradient(145deg, rgba(10,24,42,0.98) 0%, rgba(8,18,36,0.95) 100%)`
                      : 'rgba(255,255,255,0.92)',
                    border: `1px solid ${tier.borderColor}`,
                    borderRadius: 16,
                    padding: '32px 24px',
                    boxShadow: isDark
                      ? `0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`
                      : `0 4px 20px rgba(0,51,102,0.07)`,
                    display: 'flex', flexDirection: 'column',
                    cursor: 'default',
                    backdropFilter: 'blur(8px)',
                    transition: 'all 0.22s ease',
                  }}
                >
                  {/* Tier number + icon */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: 12,
                      background: isDark ? `${tier.glowColor}` : `${tier.glowColor}`,
                      border: `1px solid ${tier.borderColor}`,
                      color: tier.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {tier.icon}
                    </div>
                    <div style={{
                      fontSize: '2.2rem', fontWeight: 900, lineHeight: 1,
                      color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      letterSpacing: '-0.04em',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {tier.tier}
                    </div>
                  </div>

                  {/* Title block */}
                  <div style={{
                    fontSize: '1rem', fontWeight: 800,
                    color: colors.sectionTitle, marginBottom: 4,
                    letterSpacing: '-0.02em',
                  }}>
                    {tier.label}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', fontWeight: 600,
                    color: tier.color, marginBottom: 20,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {tier.subtitle}
                  </div>

                  {/* Tech items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                    {tier.items.map(item => (
                      <div key={item} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: tier.color, flexShrink: 0, opacity: 0.85,
                        }} />
                        <span style={{
                          fontSize: '0.8rem', color: colors.sectionText,
                          lineHeight: 1.4,
                        }}>{item}</span>
                      </div>
                    ))}
                  </div>

                  {/* Bottom accent bar */}
                  <div style={{
                    marginTop: 24, height: 3, borderRadius: 2,
                    background: `linear-gradient(90deg, ${tier.color}, transparent)`,
                    opacity: 0.5,
                  }} />
                </motion.div>
              </motion.div>
            ))}
          </div>

          {/* Data flow caption */}
          <motion.div
            initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
            viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.5 }}
            style={{
              textAlign: 'center', marginTop: 48,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <div style={{ height: 1, width: 60, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
            <span style={{ fontSize: '0.78rem', color: colors.sectionText, letterSpacing: '0.04em' }}>
              Bidirectional data flow — from ground truth to intelligence, in real time
            </span>
            <div style={{ height: 1, width: 60, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
          </motion.div>
        </div>

        {/* Responsive style for mobile grid */}
        <style>{`
          @media (max-width: 900px) {
            .arch-tier-grid {
              grid-template-columns: repeat(2, 1fr) !important;
            }
          }
          @media (max-width: 540px) {
            .arch-tier-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </section>

      {/* ════ FOOTER ════ */}
      <footer style={{
        background: '#0d1526',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontFamily: 'inherit',
      }}>
        {/* ── Main footer body ── */}
        <div style={{
          maxWidth: 1320, margin: '0 auto',
          padding: '56px 40px 40px',
          display: 'grid',
          gridTemplateColumns: '1.6fr 1fr 1.4fr',
          gap: 64,
        }}
          className="landing-footer-grid"
        >

          {/* ── Column 1: Brand + Contact ── */}
          <div>
            {/* Logo + Brand name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, overflow: 'hidden',
                background: 'rgba(64,128,255,0.12)',
                border: '1px solid rgba(64,128,255,0.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 4, flexShrink: 0,
              }}>
                <img src="/logo.png" alt="LADRIS" style={{ width: '100%', objectFit: 'contain' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '1.05rem', fontWeight: 800,
                  color: '#f0f6fc', letterSpacing: '-0.03em', lineHeight: 1.1,
                }}>
                  LADRIS<span style={{ color: '#4080ff' }}>·</span>AI
                </div>
                <div style={{ fontSize: '0.6rem', fontWeight: 600, color: '#546e96', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2 }}>
                  {T.footerIntelligence}
                </div>
              </div>
            </div>

            {/* Tagline in saffron orange */}
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f47721', marginBottom: 12, lineHeight: 1.4 }}>
              {T.footerTagline}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', marginBottom: 20, lineHeight: 1.6 }}>
              {T.footerBuiltFor}
            </div>

            {/* Contact lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Email */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                  support@ladris.gov.in
                </span>
              </div>
              {/* Location */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                  {T.footerLocation}
                </span>
              </div>
              {/* Phone */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.61 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.16 6.16l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                  +91-11-2338-XXXX (Ministry Helpline)
                </span>
              </div>
            </div>
          </div>

          {/* ── Column 2: Platform Links ── */}
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '0.02em', marginBottom: 20 }}>
              {T.footerPlatformTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {T.footerPlatformLinks.map((link, idx) => {
                const sectionMap: (string | null)[] = [
                  'features', 'architecture', 'analytics', 'gis-intelligence',
                  null, null, null,
                ]
                const sid = sectionMap[idx] ?? null
                return sid ? (
                  <button
                    key={link}
                    onClick={() => scrollToSection(sid)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit', fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', transition: 'color 0.15s', display: 'block' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f47721')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                  >{link}</button>
                ) : (
                  <a key={link} href="#" style={{ fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.15s', display: 'block' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#f47721')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
                  >{link}</a>
                )
              })}
            </div>
          </div>

          {/* ── Column 3: Official Partners ── */}
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f0f6fc', letterSpacing: '0.02em', marginBottom: 20 }}>
              {T.footerPartnersTitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {([
                { logo: '/logo_railways.png', idx: 0 },
                { logo: '/logo_morth.png', idx: 1 },
                { logo: '/logo_nhai.png', idx: 2 },
                { logo: '/logo_heavy_industries.png', idx: 3 },
              ] as { logo: string; idx: number }[]).map(({ logo, idx }) => {
                const p = T.footerPartners[idx]
                return (
                  <div
                    key={p.name}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, transition: 'all 0.18s', cursor: 'default' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                      <img src={logo} alt={p.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c9d8f0', lineHeight: 1.3 }}>{p.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{p.sub}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Bottom Copyright Bar ── */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '16px 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)' }}>
            {T.footerCopy}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {T.footerLinks.map((item, i, arr) => (
              <span key={item} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <a href="#" style={{
                  fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)',
                  textDecoration: 'none', transition: 'color 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.35)')}
                >
                  {item}
                </a>
                {i < arr.length - 1 && (
                  <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.78rem' }}>|</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </footer>


      {/* ════ Global Keyframes for landing page ════ */}
      <style>{`
        @keyframes lp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
        @media (max-width: 900px) {
          .landing-overview-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .landing-nav-links {
            display: none !important;
          }
          .landing-mobile-menu-btn {
            display: flex !important;
          }
          .landing-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
        }
        @media (max-width: 1100px) {
          .landing-footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 40px !important;
          }
        }

        /* ── Global Accessibility: High Contrast ── */
        [data-high-contrast] * {
          background-image: none !important;
          text-shadow: none !important;
          box-shadow: none !important;
        }
        [data-high-contrast] body,
        [data-high-contrast] #root,
        [data-high-contrast] header,
        [data-high-contrast] footer,
        [data-high-contrast] section,
        [data-high-contrast] nav,
        [data-high-contrast] div,
        [data-high-contrast] main {
          background: #000 !important;
          color: #fff !important;
          border-color: #fff !important;
        }
        [data-high-contrast] a,
        [data-high-contrast] button {
          color: #ffff00 !important;
          border-color: #ffff00 !important;
          background: #000 !important;
        }
        [data-high-contrast] img {
          filter: contrast(1.4) brightness(1.1);
        }
        [data-high-contrast] input,
        [data-high-contrast] textarea {
          background: #000 !important;
          color: #fff !important;
          border: 2px solid #fff !important;
        }

        /* ── Global Accessibility: Reduced Motion ── */
        [data-reduced-motion] *,
        [data-reduced-motion] *::before,
        [data-reduced-motion] *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
        }
      `}</style>
    </div>
  )
}
