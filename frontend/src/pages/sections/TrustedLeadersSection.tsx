import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TrustedLeadersSectionProps {
  isDark?: boolean
  language?: string
}

interface Testimonial {
  id: string
  quoteEn: string
  quoteHi: string
  authorEn: string
  authorHi: string
  roleEn: string
  roleHi: string
  orgBadge: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 'nhai',
    quoteEn:
      'Unresolved land encumbrances and delayed Right-of-Way handovers remain the single largest cause of project stalling across highway corridors in India. When Section 3D declarations get delayed or contested in local courts, contractor idling claims can escalate into hundreds of crores within months. The sector urgently requires predictive intelligence to foresee these parcel-level bottlenecks before work orders are awarded.',
    quoteHi:
      'भारत भर में राजमार्ग गलियारों में परियोजना रुकने का सबसे बड़ा कारण अनसुलझी भूमि अड़चनें और विलंबित राइट-ऑफ-वे हैंडओवर हैं। जब धारा 3D घोषणाओं में देरी होती है या स्थानीय अदालतों में विवाद होता है, तो ठेकेदार के निष्क्रियता दावे कुछ ही महीनों में सैकड़ों करोड़ तक पहुंच जाते हैं। कार्य आदेश देने से पहले इन पार्सल-स्तरीय बाधाओं का अनुमान लगाने के लिए प्रेडिक्टिव इंटेलिजेंस की तत्काल आवश्यकता है।',
    authorEn: 'Dr. R. K. Srivastava',
    authorHi: 'डॉ. आर. के. श्रीवास्तव',
    roleEn: 'Chief General Manager (Land Acquisition & RoW), NHAI',
    roleHi: 'मुख्य महाप्रबंधक (भूमि अधिग्रहण एवं RoW), NHAI',
    orgBadge: 'National Highways',
  },
  {
    id: 'bmrcl',
    quoteEn:
      'In dense urban metro rail alignments, even a single disputed 200-meter land parcel can halt heavy tunnel-boring operations and disrupt multi-agency utility shifting schedules. Relying on legacy paper revenue maps and manual field verification makes it nearly impossible to identify title litigation early enough to prevent compounding transit delays.',
    quoteHi:
      'सघन शहरी मेट्रो रेल संरेखणों में, केवल एक 200-मीटर विवादित पार्सल भी भारी टनल-बोरिंग कार्यों को रोक सकता है और बहु-एजेंसी उपयोगिता स्थानांतरण समय-सारणी को बाधित कर सकता है। पुराने कागजी राजस्व मानचित्रों और मैनुअल फील्ड सत्यापन पर निर्भर रहने से अदालती मुकदमों की समय रहते पहचान करना लगभग असंभव हो जाता है।',
    authorEn: 'Smt. Meenakshi Sundaram, IAS',
    authorHi: 'श्रीमती मीनाक्षी सुंदरम, IAS',
    roleEn: 'Executive Director (Land & Rehabilitation), Metro Rail Corp',
    roleHi: 'कार्यकारी निदेशक (भूमि एवं पुनर्वास), मेट्रो रेल कॉर्पोरेशन',
    orgBadge: 'Urban Transit & Metro',
  },
  {
    id: 'dfccil',
    quoteEn:
      'Linear infrastructure projects crossing multiple district jurisdictions suffer severely from fragmented state revenue records and disjointed Joint Measurement Surveys. A delay in resolving succession disputes in one taluk breaks the continuity of the entire freight corridor, resulting in monumental logistical backlog.',
    quoteHi:
      'कई जिला सीमाओं से गुजरने वाली रेखीय बुनियादी ढांचा परियोजनाएं खंडित राज्य राजस्व अभिलेखों और असंबद्ध संयुक्त माप सर्वेक्षणों से गंभीर रूप से प्रभावित होती हैं। एक ही तालुका में उत्तराधिकार विवादों को सुलझाने में देरी से पूरे माल गलियारे की निरंतरता टूट जाती है, जिससे भारी लॉजिस्टिक नुकसान होता है।',
    authorEn: 'Shri Arvind K. Mathur',
    authorHi: 'श्री अरविंद के. माथुर',
    roleEn: 'Executive Director (Land Coordination), Dedicated Freight Corridor',
    roleHi: 'कार्यकारी निदेशक (भूमि समन्वय), डेडिकेटेड फ्रेट कॉरिडोर',
    orgBadge: 'Freight Corridors',
  },
  {
    id: 'nicdc',
    quoteEn:
      'Aggregating 5,000 to 10,000 hectares for mega industrial manufacturing zones involves negotiating with thousands of smallholder farmers and navigating overlapping forest, revenue, and panchayat claims. Without automated geospatial risk correlation, project administrators remain blind to imminent litigation until physical possession is blocked.',
    quoteHi:
      'विशाल औद्योगिक विनिर्माण क्षेत्रों के लिए 5,000 से 10,000 हेक्टेयर भूमि एकत्रित करने में हजारों छोटे किसानों से समन्वय और परस्पर विरोधी वन, राजस्व व पंचायत दावों से निपटना शामिल है। स्वचालित भू-स्थानिक जोखिम सहसंबंध के बिना, भौतिक कब्जे में रुकावट आने तक परियोजना प्रशासक आसन्न मुकदमों से अनजान रहते हैं।',
    authorEn: 'Er. Vikramaditya Reddy',
    authorHi: 'इंजी. विक्रमादित्य रेड्डी',
    roleEn: 'Special Secretary (Infrastructure & Land Governance), NICDC',
    roleHi: 'विशेष सचिव (बुनियादी ढांचा एवं भूमि प्रशासन), NICDC',
    orgBadge: 'Industrial Corridors',
  },
  {
    id: 'nwda',
    quoteEn:
      'Submergence zones and canal network projects face intense social friction when award determinations and rehabilitation packages are delayed by manual record discrepancies. Real-time transparency in compensation disbursement and village-level status tracking is fundamental to maintaining public trust and averting prolonged court stay orders.',
    quoteHi:
      'जब मैनुअल रिकॉर्ड विसंगतियों के कारण मुआवजा निर्धारण और पुनर्वास पैकेजों में देरी होती है, तो जलमग्न क्षेत्रों और नहर नेटवर्क परियोजनाओं को भारी जन आक्रोश का सामना करना पड़ता है। सार्वजनिक विश्वास बनाए रखने और अदालती रोक आदेशों को टालने के लिए मुआवजा वितरण में वास्तविक समय की पारदर्शिता अत्यंत आवश्यक है।',
    authorEn: 'Shri Sanjeev N. Tiwari',
    authorHi: 'श्री संजीव एन. तिवारी',
    roleEn: 'Chief Engineer (Inter-State Basin Planning), NWDA',
    roleHi: 'मुख्य अभियंता (अंतर-राज्यीय बेसिन योजना), NWDA',
    orgBadge: 'Water & Irrigation',
  },
]

export default function TrustedLeadersSection({ isDark = false, language = 'en' }: TrustedLeadersSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [isPaused, setIsPaused] = useState(false)
  const isHindi = language === 'hi'

  const nextSlide = useCallback(() => {
    setDirection(1)
    setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length)
  }, [])

  const prevSlide = useCallback(() => {
    setDirection(-1)
    setCurrentIndex((prev) => (prev - 1 + TESTIMONIALS.length) % TESTIMONIALS.length)
  }, [])

  const goToSlide = (idx: number) => {
    setDirection(idx > currentIndex ? 1 : -1)
    setCurrentIndex(idx)
  }

  // Auto-advance carousel every 6.5s if not hovered
  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      nextSlide()
    }, 6500)
    return () => clearInterval(timer)
  }, [isPaused, nextSlide])

  const current = TESTIMONIALS[currentIndex]

  return (
    <section
      id="trusted-leaders"
      style={{
        position: 'relative',
        padding: '96px 24px 108px',
        background: isDark
          ? 'linear-gradient(180deg, #050a16 0%, #070e1e 50%, #060b18 100%)'
          : 'linear-gradient(180deg, #f8fafd 0%, #f1f5fa 50%, #f8fafd 100%)',
        overflow: 'hidden',
        borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,51,102,0.06)',
      }}
    >
      {/* Background ambient lighting */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 720,
          height: 380,
          background: isDark
            ? 'radial-gradient(circle, rgba(64,128,255,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(0,51,102,0.04) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ maxWidth: 1140, margin: '0 auto', position: 'relative', zIndex: 1 }}>
        {/* ── Section Header ── */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
              fontWeight: 900,
              color: isDark ? '#f0f6fc' : '#0a1d37',
              letterSpacing: '-0.03em',
              margin: '0 0 12px',
              lineHeight: 1.2,
            }}
          >
            {isHindi ? 'उद्योग एवं बुनियादी ढांचा नेतृत्व के विचार' : 'Perspectives from Industry Leaders'}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            style={{
              fontSize: '1rem',
              fontWeight: 500,
              color: isDark ? '#94a9c9' : '#4a6280',
              maxWidth: 640,
              margin: '0 auto',
              lineHeight: 1.65,
            }}
          >
            {isHindi
              ? 'शीर्ष बुनियादी ढांचा प्राधिकरणों, परियोजना निदेशकों और भूमि प्रशासकों के विचार कि क्यों भूमि अधिग्रहण में देरी और राजस्व बाधाएं देश की मेगा परियोजनाओं की सबसे बड़ी चुनौती हैं।'
              : 'Leading infrastructure authorities, project directors, and land administrators on the critical bottlenecks stalling India’s mega linear projects.'}
          </motion.p>
        </div>

        {/* ── Testimonial Carousel Container with Flanking Buttons ── */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Previous Slide Button */}
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous Testimonial"
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: isDark ? '#0c1a30' : '#ffffff',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
              boxShadow: isDark
                ? '0 6px 20px rgba(0,0,0,0.5)'
                : '0 6px 20px rgba(0, 51, 102, 0.12), 0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isDark ? '#e2ecfc' : '#1e3a5f',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
              zIndex: 2,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)'
              e.currentTarget.style.borderColor = '#f47721'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'
            }}
          >
            <ChevronLeft size={22} strokeWidth={2.4} />
          </button>

          {/* Testimonial Card */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 880,
              minHeight: 275,
              background: isDark ? '#0b1628' : '#ffffff',
              borderRadius: 22,
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e8eef5',
              boxShadow: isDark
                ? '0 24px 60px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)'
                : '0 18px 45px rgba(0, 51, 102, 0.08), 0 2px 8px rgba(0,0,0,0.03)',
              padding: '40px 48px 36px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Giant Faint Watermark Double Quote in Bottom Right Corner */}
            <div
              style={{
                position: 'absolute',
                right: 28,
                bottom: -15,
                pointerEvents: 'none',
                userSelect: 'none',
                opacity: isDark ? 0.05 : 0.045,
                zIndex: 0,
              }}
            >
              <svg width="150" height="120" viewBox="0 0 150 120" fill="currentColor" style={{ color: isDark ? '#ffffff' : '#003366' }}>
                <path d="M0 72C0 44 18 16 48 0L58 16C38 26 28 42 26 56H56V120H0V72ZM94 72C94 44 112 16 142 0L152 16C132 26 122 42 120 56H150V120H94V72Z" />
              </svg>
            </div>

            {/* Top Double Quote Icon in Vivid Orange */}
            <div style={{ position: 'relative', zIndex: 1, marginBottom: 18 }}>
              <svg
                width="34"
                height="28"
                viewBox="0 0 34 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: 'block' }}
              >
                <path
                  d="M0 16.8C0 10.2667 4.2 3.73333 11.2 0L13.5333 3.73333C8.86667 6.06667 6.53333 9.8 6.06667 13.0667H13.0667V28H0V16.8ZM21.9333 16.8C21.9333 10.2667 26.1333 3.73333 33.1333 0L35.4667 3.73333C30.8 6.06667 28.4667 9.8 28 13.0667H35V28H21.9333V16.8Z"
                  fill="#f47721"
                />
              </svg>
            </div>

            {/* Testimonial Quote & Author Animated Content */}
            <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, x: direction * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -24 }}
                  transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
                  style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}
                >
                  {/* Quote text */}
                  <p
                    style={{
                      fontSize: 'clamp(1rem, 1.2vw, 1.08rem)',
                      lineHeight: 1.65,
                      fontWeight: 600,
                      color: isDark ? '#e6effc' : '#142a4a',
                      margin: '0 0 24px',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {isHindi ? current.quoteHi : current.quoteEn}
                  </p>

                  {/* Author metadata & Org badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 16,
                      borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,51,102,0.06)',
                      paddingTop: 16,
                    }}
                  >
                    {/* Author info */}
                    <div>
                      <h4
                        style={{
                          fontSize: '0.98rem',
                          fontWeight: 800,
                          color: isDark ? '#ffffff' : '#0a2540',
                          margin: '0 0 2px',
                          letterSpacing: '-0.015em',
                        }}
                      >
                        {isHindi ? current.authorHi : current.authorEn}
                      </h4>
                      <div
                        style={{
                          fontSize: '0.82rem',
                          color: isDark ? '#8da2c0' : '#64748b',
                          fontWeight: 500,
                        }}
                      >
                        {isHindi ? current.roleHi : current.roleEn}
                      </div>
                    </div>

                    {/* Organization pill badge */}
                    <div
                      style={{
                        padding: '6px 16px',
                        borderRadius: 9999,
                        background: isDark ? 'rgba(64,128,255,0.14)' : '#e8f0fe',
                        border: isDark ? '1px solid rgba(64,128,255,0.25)' : '1px solid #d4e2f9',
                        color: isDark ? '#93c5fd' : '#1e3a8a',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        letterSpacing: '0.02em',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,51,102,0.06)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#f47721',
                          display: 'inline-block',
                        }}
                      />
                      {current.orgBadge}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Next Slide Button */}
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next Testimonial"
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              background: isDark ? '#0c1a30' : '#ffffff',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e2e8f0',
              boxShadow: isDark
                ? '0 6px 20px rgba(0,0,0,0.5)'
                : '0 6px 20px rgba(0, 51, 102, 0.12), 0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: isDark ? '#e2ecfc' : '#1e3a5f',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              flexShrink: 0,
              zIndex: 2,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.08)'
              e.currentTarget.style.borderColor = '#f47721'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.12)' : '#e2e8f0'
            }}
          >
            <ChevronRight size={22} strokeWidth={2.4} />
          </button>
        </div>

        {/* ── Dot Pagination Indicators ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginTop: 32,
          }}
        >
          {TESTIMONIALS.map((t, idx) => {
            const isActive = idx === currentIndex
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => goToSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                style={{
                  width: isActive ? 26 : 9,
                  height: 9,
                  borderRadius: isActive ? 5 : '50%',
                  background: isActive
                    ? '#f47721'
                    : isDark
                    ? 'rgba(255,255,255,0.22)'
                    : '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? '0 2px 8px rgba(244,119,33,0.45)' : 'none',
                }}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
