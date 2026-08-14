/**
 * NewsFeed.jsx
 * Left sidebar — premium dark theme redesign
 * Matches the navy/gold CalendarGrid aesthetic
 */
import React, { useState } from 'react';

const FESTIVAL_INFO = {
  0: [
    { icon:'🛕', title:'Vaikunta Ekadasi', info:'The most sacred Ekadasi — gates of Vaikuntha are open. Observing this fast is said to liberate souls from the cycle of birth and death.' },
    { icon:'🌾', title:'Pongal', info:'The 4-day harvest festival of Tamil Nadu — Bhogi, Thai Pongal, Mattu Pongal, and Kaanum Pongal. Decorated cows are worshipped on Mattu Pongal.' },
    { icon:'🪷', title:'Thai Pusam', info:'Lord Murugan\'s victory over Soorapadman. Devotees carry ornate Kavadi as an act of thanksgiving and devotion.' },
  ],
  1: [
    { icon:'🔱', title:'Maha Shivaratri', info:'The Great Night of Shiva — Lord Shiva performs the cosmic Tandava dance. Devotees fast and keep night-long vigil.' },
    { icon:'☀️', title:'Ratha Saptami', info:'Celebrates Sun God (Surya) turning his chariot northward. Lord Venkateswara is taken on the Garuda Vahana procession at Tirumala.' },
    { icon:'🎵', title:'Saraswati Puja', info:'Goddess Saraswati blesses students, musicians, and artists. Place books and instruments at her feet for blessings.' },
  ],
  2: [
    { icon:'🌅', title:'Ugadi', info:'Telugu and Kannada New Year. The Ugadi Pachadi (six-taste dish) symbolizes life\'s six experiences.' },
    { icon:'🌈', title:'Holi', info:'Festival of colors celebrating Holika Dahan — the victory of devotee Prahlada and the divine love of Radha-Krishna.' },
    { icon:'📿', title:'Adi Shankaracharya Jayanti', info:'Birth anniversary of the great 8th-century philosopher who revived Sanatana Dharma.' },
  ],
  3: [
    { icon:'🏹', title:'Sri Rama Navami', info:'Birthday of Lord Rama, the 7th avatar of Vishnu. Read Sundara Kanda, fast, and offer Panakam (jaggery drink) to the Lord.' },
    { icon:'🦅', title:'Brahmotsavam', info:'The 9-day Tirumala Brahmotsavam is the grandest festival. Lord appears on different vahanas (vehicles) each day.' },
    { icon:'🙏', title:'Hanuman Jayanti', info:'Birthday of Lord Hanuman. Recite Hanuman Chalisa 108 times. Offer sindoor and jasmine for strength and protection.' },
  ],
  4: [
    { icon:'☸️', title:'Buddha Purnima', info:'Celebrates the birth, enlightenment, and Nirvana of Gautama Buddha. Light butter lamps and offer lotus flowers.' },
    { icon:'💰', title:'Akshaya Tritiya', info:'The most auspicious day — any good work begun today is never-diminishing. Associated with Goddess Lakshmi.' },
    { icon:'🦁', title:'Narasimha Jayanti', info:'Lord Narasimha emerged from a pillar to protect Prahlada. Chant Narasimha Kavacham for protection.' },
  ],
  5: [
    { icon:'🎡', title:'Jagannath Rath Yatra', info:'Lord Jagannath rides massive chariots through Puri. Pulling the Rath rope is said to grant liberation (Moksha).' },
    { icon:'🌳', title:'Vata Savitri Vrat', info:'Married women fast and circle the Banyan tree — remembering Savitri\'s legendary devotion.' },
  ],
  6: [
    { icon:'📚', title:'Guru Purnima', info:'Day to honor your Guru (spiritual teacher). Sage Vyasa composed the Mahabharata and Puranas.' },
    { icon:'🌧️', title:'Karkidaka Ramayana', info:'The entire month is dedicated to reading the Ramayana aloud at dusk with oil lamps.' },
  ],
  7: [
    { icon:'🍃', title:'Krishna Janmashtami', info:'Lord Krishna was born at midnight in Mathura prison. Fast until midnight, then celebrate with Dahi Handi and bhajans.' },
    { icon:'🌺', title:'Varalakshmi Vratam', info:'Most important Lakshmi festival for South Indian families. Worship Kalasham as Goddess Lakshmi.' },
    { icon:'🪢', title:'Raksha Bandhan', info:'Sacred bond of protection between siblings. The Rakhi thread carries the sister\'s prayers of protection.' },
  ],
  8: [
    { icon:'🐘', title:'Ganesh Chaturthi', info:'Lord Ganesha\'s birthday. Offer modak, red flowers, and Durva grass. Install an eco-friendly clay Ganesh idol at home.' },
    { icon:'🌸', title:'Onam', info:'Kerala\'s 13-day harvest festival. King Mahabali visits his beloved Kerala.' },
  ],
  9: [
    { icon:'⚔️', title:'Navaratri', info:'Nine nights worshipping the nine forms of Goddess Durga. Each night has a specific color to wear.' },
    { icon:'📖', title:'Vijayadasami / Dussehra', info:'Victory of Goddess Saraswati on the 10th day. Begin new studies or start learning music.' },
  ],
  10: [
    { icon:'🪔', title:'Diwali', info:'Festival of Lights — Goddess Lakshmi visits homes that are lit and clean. Light diyas at dusk, create Rangoli, and offer sweets.' },
    { icon:'🔥', title:'Karthigai Deepam', info:'The fire of Lord Shiva on Arunachala hill symbolizes infinite light.' },
  ],
  11: [
    { icon:'🌟', title:'Vaikunta Ekadasi', info:'The Vaikunta Dwaram (Northern Door) of Tirumala opens. Queue overnight for Uttara Dwara Darshanam.' },
    { icon:'🪷', title:'Margazhi Season', info:'The sacred 30-day month — Goddess Andal\'s Thiruppavai hymns are recited. Temple visits at dawn grant special blessings.' },
  ],
};

const DID_YOU_KNOW = [
  { icon:'🛕', fact:'Sri Venkateswara Temple at Tirumala is the richest temple in the world, receiving over 50,000 devotees daily.' },
  { icon:'🌺', fact:'The Tirumala Laddu Prasadam has a GI (Geographical Indication) tag — it can only be made at Tirumala with the original recipe.' },
  { icon:'💈', fact:'Devotees offer their hair (Thonsure) at Tirumala as a symbol of surrender of ego to the Lord.' },
  { icon:'🔔', fact:'The bells (Ghanta) at a temple purify the atmosphere. The sound Om reverberates when a bell is struck correctly.' },
  { icon:'🌿', fact:'Tulasi (Holy Basil) is the most sacred plant in Vaishnava tradition — offered to Lord Vishnu and believed to purify the air.' },
  { icon:'🐘', fact:'Temple elephants are considered Lord Ganesha\'s representatives. They bless devotees by touching their heads with the trunk.' },
  { icon:'🍛', fact:'Annadanam (free food offering) is the highest form of charity — "Anna daata sukhi bhava" (May the food-giver be blessed).' },
  { icon:'🌸', fact:'Lotus (Padma) grows in muddy water yet remains pure — it symbolizes the soul remaining unstained by worldly attachments.' },
];

const SEVA_INFO = [
  { name: 'Suprabhatam Seva',      time: '9:00 AM',  desc: 'Morning awakening prayer — sacred Suprabhatam hymns greet the Lord', icon: '🌅' },
  { name: 'Nitya Archana',         time: '10:00 AM', desc: 'Daily flower worship with chanting of the Lord\'s 108 holy names',    icon: '🌸' },
  { name: 'Deeparadhana & Archana',time: '6:30 PM',  desc: 'Evening lamp offering — Mangala Harathi with sacred flames',         icon: '🪔' },
  { name: 'Ekantha Seva',          time: '7:30 PM',  desc: 'Sacred closing ceremony — Lord\'s night rest ritual',                icon: '🌙' },
];
const TYPE_COLORS = {
  pooja:'#f97316', festival:'#dc2626', holiday:'#dc2626',
  kalyanam:'#eab308', abhishekam:'#f97316', class:'#0d9488',
};

export default function NewsFeed({ events = [], currentDate, variant = 'default' }) {
  const [activeTab, setActiveTab] = useState('news');
  // ── Effect C CSS injected once ───────────────────────────────────────────────
  React.useEffect(() => {
    if (document.getElementById('nf-shimmer-style')) return;
    const s = document.createElement('style');
    s.id = 'nf-shimmer-style';
    s.textContent = `
      @keyframes nfShimmer { 0%,100%{opacity:0.2;transform:translateX(-120%) rotate(5deg)} 50%{opacity:0.7;transform:translateX(120%) rotate(5deg)} }
      @keyframes nfPulse   { 0%,100%{box-shadow:0 0 0 0 transparent} 50%{box-shadow:0 0 20px 2px #c9943a18} }
      @keyframes nfCorner  { 0%,100%{opacity:0.4} 50%{opacity:1} }
      .nf-festival-card { animation: nfPulse 4s ease-in-out infinite; }
      .nf-shimmer-wrap { position:relative; overflow:hidden; }
      .nf-shimmer-wrap::after {
        content:''; position:absolute; inset:0;
        background: linear-gradient(105deg, transparent 30%, #e8c87810 50%, transparent 70%);
        animation: nfShimmer 4s ease-in-out infinite;
        pointer-events:none;
      }
    `;
    document.head.appendChild(s);
  }, []);
  const month = currentDate ? currentDate.getMonth() : new Date().getMonth();
  const year  = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
  const monthName = (currentDate || new Date()).toLocaleDateString('en-US', { month:'long' });

  const festivalItems = FESTIVAL_INFO[month] || [];
  const todayFact    = DID_YOU_KNOW[(month * 3 + new Date().getDate()) % DID_YOU_KNOW.length];

  const templeEvents = events
    .filter(e => e.type !== 'panchang')
    .sort((a,b) => new Date(a.date) - new Date(b.date));
  const templeHighlights = {
    eventCount: templeEvents.length,
    majorFestivals: templeEvents.filter(e => ['festival','holiday','kalyanam'].includes((e.type || '').toLowerCase())).length,
    abhishekamsThisWeek: templeEvents.filter(e => (e.title || '').toLowerCase().includes('abhishekam')).slice(0, 7).length,
  };
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const todayEvents = events.filter(e => e.date === todayDateStr);
  const todayPanchang = todayEvents.find(e => e.type === 'panchang') || null;
  function getTodayField(key) {
    if (!todayPanchang) return '—';
    if (todayPanchang[key]) return todayPanchang[key];
    const raw = todayPanchang.title || '';
    if (key === 'tithi') {
      const m = raw.match(/^([A-Za-z\s]+?)\s+\d/);
      return m ? m[1].trim() : '—';
    }
    if (key === 'nakshatra') {
      const parts = raw.split(/\s*[-–]\s*/);
      if (parts[1]) {
        const m = parts[1].match(/^([A-Za-z\s]+?)\s+\d/);
        return m ? m[1].trim() : '—';
      }
    }
    return '—';
  };

  const spotlight = festivalItems[2] || festivalItems[0] || { icon:'🛕', title:'Temple Festival', info:'Featured festival details will appear here.' };

  if (variant === 'public_spotlight') {
    return (
      <div style={{ width: '100%', fontFamily: 'Georgia, serif' }}>
        <div style={{ background:'linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.00))', border:'1px solid rgba(212,175,55,0.14)', borderRadius:12, overflow:'hidden', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
          <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(212,175,55,0.12)' }}>
            <div style={{ fontSize:10, color:'#8e6d41', textTransform:'uppercase', letterSpacing:'0.10em', fontWeight:700, marginBottom:4 }}>Temple Updates</div>
            <div style={{ fontSize:'1.05rem', fontWeight:800, color:'#f5e7c2', marginBottom:4 }}>{monthName} {year}</div>
            <div style={{ fontSize:'0.78rem', color:'#f1d185', lineHeight:1.45 }}>Sample Temple Name · Your City, ST</div>
            </div>

          <div style={{ display:'flex', borderBottom:'1px solid rgba(212,175,55,0.12)' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1,
                  padding: '10px 6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: 'Georgia, serif',
                  letterSpacing: '0.03em',
                  background: activeTab === tab.id ? '#fff8ee' : 'transparent',
                  color: activeTab === tab.id ? '#f1d185' : '#9a7442',
                  borderBottom: activeTab === tab.id ? '2px solid #c9943a' : '2px solid transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'news' && (
            <div style={{ padding:'12px', display:'grid', gap:12 }}>
              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(212,175,55,0.16)', borderRadius:12, padding:'14px' }}>
                <div style={{ fontSize:'2rem', fontWeight:700, color:'#f5e7c2', marginBottom:10 }}>Temple Highlights</div>
                <div style={{ display:'grid', gap:8, color:'#edd8a3', fontSize:'0.95rem', lineHeight:1.55 }}>
                  <div>◆ {templeHighlights.eventCount} events this month</div>
                  <div>◆ {templeHighlights.majorFestivals} major festivals</div>
                  <div>◆ {templeHighlights.abhishekamsThisWeek} abhishekams this week</div>
                </div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.015)', border:'1px solid rgba(212,175,55,0.16)', borderRadius:12, padding:'14px' }}>
                <div style={{ fontSize:'1.85rem', fontWeight:700, color:'#f5e7c2', marginBottom:10 }}>Today at the Temple</div>
                <div style={{ background:'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00))', border:'1px solid rgba(212,175,55,0.10)', borderRadius:10, padding:'10px 12px', color:'#dcbc81', lineHeight:1.7, fontSize:'0.95rem' }}>
                  <div>◆ Nakshatra: {getTodayField('nakshatra')}</div>
                  <div>◆ Tithi: {getTodayField('tithi')}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize:'1.85rem', fontWeight:700, color:'#f5e7c2', margin:'4px 0 10px' }}>Festival Spotlight</div>
                <div className="nf-festival-card" style={{ border:'1px solid rgba(212,175,55,0.20)', borderRadius:14, overflow:'hidden', background:'linear-gradient(180deg, rgba(255,255,255,0.015), rgba(255,255,255,0.005))', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.03)' }}>
                  <div style={{ height:320, background:'radial-gradient(circle at center, rgba(255,190,120,0.16), rgba(0,0,0,0.0) 42%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.00)), linear-gradient(180deg, #fdf6e9 0%, #fef3e3 100%)', display:'flex', alignItems:'flex-end' }}>
                    <div style={{ width:'100%', padding:'16px 16px 18px', background:'linear-gradient(180deg, rgba(0,0,0,0.00), rgba(0,0,0,0.28) 40%, rgba(0,0,0,0.52) 100%)' }}>
                      <div style={{ fontSize:'2.1rem', marginBottom:6 }}>{spotlight.icon}</div>
                      <div style={{ fontSize:'1.15rem', fontWeight:700, color:'#f7e2b5', marginBottom:6 }}>{spotlight.title}</div>
                      <div style={{ fontSize:'0.9rem', color:'#f5e7c2', lineHeight:1.6 }}>{spotlight.info}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'events' && (
            <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:8 }}>
              {templeEvents.length === 0 ? (
                <div style={{ color:'#8e6d41', textAlign:'center', padding:'24px 0' }}>No events this month yet</div>
              ) : templeEvents.map((event, i) => {
                const d = new Date(event.date + 'T12:00:00');
                const color = TYPE_COLORS[event.type] || '#c9943a';
                return (
                  <div key={event.id || i} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 12px', background:'#fef9f0', border:'1px solid rgba(212,175,55,0.12)', borderLeft:`3px solid ${color}`, borderRadius:10 }}>
                    <div style={{ width:38, textAlign:'center', flexShrink:0 }}>
                      <div style={{ fontSize:'1.1rem', fontWeight:800, color }}>{d.getDate()}</div>
                      <div style={{ fontSize:'0.62rem', color:'#8e6d41', textTransform:'uppercase' }}>{d.toLocaleDateString('en-US', { weekday:'short' })}</div>
                    </div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ fontSize:'0.9rem', fontWeight:700, color:'#f5e7c2' }}>{event.title}</div>
                      {event.time && <div style={{ fontSize:'0.75rem', color:'#caa364', marginTop:2 }}>🕐 {event.time}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {activeTab === 'seva' && (
            <div style={{ padding:'12px', display:'grid', gap:8 }}>
              {SEVA_INFO.map((seva, i) => (
                <div key={i} style={{ padding:'12px', background:'#fef9f0', border:'1px solid rgba(212,175,55,0.12)', borderLeft:'3px solid #c9943a', borderRadius:10 }}>
                  <div style={{ fontSize:'0.92rem', fontWeight:700, color:'#f5e7c2', marginBottom:4 }}>{seva.icon} {seva.name}</div>
                  <div style={{ fontSize:'0.76rem', color:'#caa364', marginBottom:4 }}>{seva.time}</div>
                  <div style={{ fontSize:'0.82rem', color:'#dfc28f', lineHeight:1.55 }}>{seva.desc}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const tabs = [
    { id:'news',   label:'🗞️ Festival Info' },
    { id:'events', label:'📅 This Month'    },
    { id:'seva',   label:'🛕 Daily Seva'    },
  ];

  const tabBase = {
    flex: 1, padding: '8px 4px', border: 'none', cursor: 'pointer',
    fontSize: 10, fontWeight: 700, fontFamily: 'Georgia, serif',
    letterSpacing: '0.03em', transition: 'all 0.15s',
  };
  return (
    <div style={{ width: '100%', fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <div style={{
        background: 'var(--cf-bg-deep)',
        borderRadius: '10px 10px 0 0',
        padding: '14px 16px',
        border: '1px solid var(--cf-border)',
        borderBottom: 'none',
      }}>
        <div style={{ fontSize: 10, color: 'var(--cf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3, fontWeight: 700 }}>
          Temple Updates
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--cf-text-primary)' }}>
          {monthName} {year}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--cf-text-muted)', marginTop: 2 }}>
          Sample Temple Name · Your City, ST
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--cf-bg-deep)', borderLeft: '1px solid var(--cf-border)', borderRight: '1px solid var(--cf-border)', borderBottom: '1px solid var(--cf-border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              ...tabBase,
              background: activeTab === tab.id ? 'var(--cf-bg-surface)' : 'transparent',
              color: activeTab === tab.id ? 'var(--cf-accent)' : 'var(--cf-text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--cf-accent)' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        background: 'var(--cf-bg-surface)',
        borderRadius: '0 0 10px 10px',
        border: '1px solid var(--cf-border)',
        borderTop: 'none',
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 240px)',
        minHeight: 480,
      }}>

        {/* ── FESTIVAL INFO ── */}
        {activeTab === 'news' && (
          <div>
            {/* Did You Know card */}
            <div style={{
              margin: '12px 12px 0',
              padding: '12px 14px',
              background: 'var(--cf-accent-glow)',
              border: '1px solid var(--cf-border-accent)',
              borderLeft: '3px solid var(--cf-accent)',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cf-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                ✨ Did You Know?
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--cf-text-primary)', lineHeight: 1.6 }}>
                {todayFact.icon} {todayFact.fact}
              </div>
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--cf-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                🗓 Festivals This Month
              </div>
              {festivalItems.length === 0 ? (
                <div style={{ color: 'var(--cf-text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>
                  No featured festivals this month
                </div>
              ) : festivalItems.map((item, i) => (
                <div key={i} style={{
                  padding: '10px 12px',
                  background: 'var(--cf-bg-card)',
                  border: '1px solid var(--cf-border)',
                  borderLeft:'3px solid #dc2626',
                  borderRadius: 8,
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:'40%', background:'linear-gradient(180deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0) 100%)', pointerEvents:'none' }} />
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--cf-text-primary)', marginBottom: 4, position:'relative' }}>
                    {item.icon} {item.title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--cf-text-muted)', lineHeight: 1.6, position:'relative' }}>
                    {item.info}
                  </div>
                </div>
              ))}
            </div>

           
          </div>
        )}

        {/* ── THIS MONTH'S EVENTS ── */}
        {activeTab === 'events' && (
          <div style={{ padding:'12px' }}>
            {templeEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#7a5a30' }}>
                <div style={{ fontSize: '2rem', marginBottom: 10 }}>🛕</div>
                <div style={{ fontSize: '0.9rem' }}>No events this month yet</div>
              </div>
            ) : templeEvents.map((event, i) => {
              const d = new Date(event.date + 'T12:00:00');
              const dayName = d.toLocaleDateString('en-US', { weekday:'short' });
              const dayNum  = d.getDate();
              const color   = TYPE_COLORS[event.type] || '#c9943a';
              return (
                <div key={event.id || i} style={{
                  display:'flex', gap:10, alignItems:'flex-start',
                  padding: '10px 12px', marginBottom: 6,
                  background: 'var(--cf-bg-card)',
                  border: '1px solid var(--cf-border)',
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 8, position:'relative', overflow:'hidden',
                }}>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:'40%', background:'linear-gradient(180deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0) 100%)', pointerEvents:'none' }} />
                  <div style={{ textAlign: 'center', flexShrink: 0, width: 38, position:'relative' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color, lineHeight: 1 }}>{dayNum}</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--cf-text-muted)', textTransform: 'uppercase' }}>{dayName}</div>
                  </div>
                  <div style={{ flex:1, minWidth:0, position:'relative' }}>
                    <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--cf-text-primary)', lineHeight: 1.35 }}>
                      {event.title}
                    </div>
                    {event.time && (
                      <div style={{ fontSize: '0.73rem', color: 'var(--cf-text-muted)', marginTop: 2 }}>🕐 {event.time}</div>
                    )}
                    {event.description && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--cf-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── DAILY SEVA ── */}
        {activeTab === 'seva' && (
          <div style={{ padding:'12px' }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--cf-text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
              Daily Sevas at Sample Temple Name. Contact the temple office for participation and sponsorship.
            </div>
            {SEVA_INFO.map((seva, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: '12px 14px', marginBottom: 7,
                background: 'var(--cf-bg-card)',
                border: '1px solid var(--cf-border)',
                borderLeft: '3px solid var(--cf-accent)',
                borderRadius: 8, position:'relative', overflow:'hidden',
              }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'40%', background:'linear-gradient(180deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0) 100%)', pointerEvents:'none' }} />
                <div style={{ fontSize: '1.3rem', flexShrink: 0, lineHeight: 1, marginTop: 2, position:'relative' }}>
                  {seva.icon}
                </div>
                <div style={{ flex:1, position:'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 5 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--cf-text-primary)' }}>
                    {seva.name}
                    </div>
                    <div style={{
                      fontSize: '0.78rem', fontWeight: 700, color: 'var(--cf-accent)',
                      background: 'var(--cf-accent-glow)', border: '1px solid var(--cf-border-accent)',
                      padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                    }}>
                      🕐 {seva.time}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--cf-text-muted)', lineHeight: 1.6 }}>
                    {seva.desc}
                  </div>
                </div>
              </div>
            ))}
            <div style={{
              marginTop: 10, padding: '10px 12px',
              background: 'var(--cf-accent-glow)', border: '1px solid var(--cf-border-accent)',
              borderRadius: 8,
              fontSize: '0.8rem', color: 'var(--cf-text-primary)', lineHeight: 1.6,
            }}>
              🙏 <strong>Sponsor a Seva</strong> — a great way to receive the Lord's blessings. Call 303-660-9555 to book.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
