/**
 * src/components/NewsFeed.jsx
 * Left sidebar — festival news feed, month events, misc info
 * LARGE FONTS — full sidebar width used
 */
import React, { useState } from 'react';

const FESTIVAL_INFO = {
  0: [
    { icon:'🛕', title:'Vaikunta Ekadasi', info:'The most sacred Ekadasi — gates of Vaikuntha are open. Observing this fast is said to liberate souls from the cycle of birth and death.' },
    { icon:'🌾', title:'Pongal', info:'The 4-day harvest festival of Tamil Nadu — Bhogi, Thai Pongal, Mattu Pongal, and Kaanum Pongal. Decorated cows are worshipped on Mattu Pongal.' },
    { icon:'🪷', title:'Thai Pusam', info:'Lord Murugan\'s victory over Soorapadman. Devotees carry ornate Kavadi as an act of thanksgiving and devotion.' },
  ],
  1: [
    { icon:'🔱', title:'Maha Shivaratri', info:'The Great Night of Shiva — Lord Shiva performs the cosmic Tandava dance. Devotees fast and keep night-long vigil. Shiva Lingam is worshipped with milk, honey, and Bilva leaves.' },
    { icon:'☀️', title:'Ratha Saptami', info:'Celebrates Sun God (Surya) turning his chariot northward. Lord Venkateswara is taken on the Garuda Vahana procession at Tirumala.' },
    { icon:'🎵', title:'Saraswati Puja', info:'Goddess Saraswati blesses students, musicians, and artists. Place books and instruments at her feet for blessings.' },
  ],
  2: [
    { icon:'🌅', title:'Ugadi', info:'Telugu and Kannada New Year. The Ugadi Pachadi (six-taste dish) symbolizes life\'s six experiences. Mango leaf Toran at the door brings prosperity.' },
    { icon:'🌈', title:'Holi', info:'Festival of colors celebrating Holika Dahan — the victory of devotee Prahlada and the divine love of Radha-Krishna.' },
    { icon:'📿', title:'Adi Shankaracharya Jayanti', info:'Birth anniversary of the great 8th-century philosopher who revived Sanatana Dharma and established the four Mathas across India.' },
  ],
  3: [
    { icon:'🏹', title:'Sri Rama Navami', info:'Birthday of Lord Rama, the 7th avatar of Vishnu. Read Sundara Kanda, fast, and offer Panakam (jaggery drink) to the Lord.' },
    { icon:'🦅', title:'Brahmotsavam', info:'The 9-day Tirumala Brahmotsavam is the grandest festival. Lord appears on different vahanas (vehicles) each day.' },
    { icon:'🙏', title:'Hanuman Jayanti', info:'Birthday of Lord Hanuman. Recite Hanuman Chalisa 108 times. Offer sindoor (vermilion) and jasmine for strength and protection.' },
  ],
  4: [
    { icon:'☸️', title:'Buddha Purnima', info:'Celebrates the birth, enlightenment, and Nirvana of Gautama Buddha. Light butter lamps and offer lotus flowers.' },
    { icon:'💰', title:'Akshaya Tritiya', info:'The most auspicious day of the year — any good work begun today is never-diminishing (Akshaya). Associated with Goddess Lakshmi.' },
    { icon:'🦁', title:'Narasimha Jayanti', info:'Lord Narasimha emerged from a pillar to protect Prahlada. Chant Narasimha Kavacham for protection from all evils.' },
  ],
  5: [
    { icon:'🎡', title:'Jagannath Rath Yatra', info:'Lord Jagannath rides massive chariots through Puri. Pulling the Rath rope is said to grant liberation (Moksha).' },
    { icon:'🌳', title:'Vata Savitri Vrat', info:'Married women fast and circle the Banyan tree with sacred thread — remembering Savitri\'s legendary devotion.' },
  ],
  6: [
    { icon:'📚', title:'Guru Purnima', info:'Day to honor your Guru (spiritual teacher). Sage Vyasa composed the Mahabharata and Puranas. Light the lamp of knowledge.' },
    { icon:'🌧️', title:'Karkidaka Ramayana', info:'The entire month is dedicated to reading the Ramayana aloud at dusk with oil lamps — a Kerala tradition.' },
  ],
  7: [
    { icon:'🍃', title:'Krishna Janmashtami', info:'Lord Krishna was born at midnight in Mathura prison. Fast until midnight, then celebrate with Dahi Handi and bhajans.' },
    { icon:'🌺', title:'Varalakshmi Vratam', info:'Most important Lakshmi festival for South Indian families. Worship Kalasham as Goddess Lakshmi for Ashta Lakshmi blessings.' },
    { icon:'🪢', title:'Raksha Bandhan', info:'Sacred bond of protection between siblings. The Rakhi thread carries the sister\'s prayers of protection.' },
  ],
  8: [
    { icon:'🐘', title:'Ganesh Chaturthi', info:'Lord Ganesha\'s birthday. Offer modak, red flowers, and Durva grass. Install an eco-friendly clay Ganesh idol at home.' },
    { icon:'🌸', title:'Onam', info:'Kerala\'s 13-day harvest festival. King Mahabali visits his beloved Kerala. The Pookalam flower carpet grows more elaborate each day.' },
  ],
  9: [
    { icon:'⚔️', title:'Navaratri', info:'Nine nights worshipping the nine forms of Goddess Durga. Each night has a specific color to wear. Golu doll display on odd-numbered steps.' },
    { icon:'📖', title:'Vijayadasami / Dussehra', info:'Victory of Goddess Saraswati on the 10th day. Begin new studies or start learning music. Ayudha Puja — worship tools of your trade.' },
  ],
  10: [
    { icon:'🪔', title:'Diwali', info:'Festival of Lights — Goddess Lakshmi visits homes that are lit and clean. Light diyas at dusk, create Rangoli, and offer sweets.' },
    { icon:'🔥', title:'Karthigai Deepam', info:'The fire of Lord Shiva on Arunachala hill symbolizes infinite light. Light a row of diyas from your home to the temple.' },
  ],
  11: [
    { icon:'🌟', title:'Vaikunta Ekadasi', info:'The Vaikunta Dwaram (Northern Door) of Tirumala opens. Queue overnight for Uttara Dwara Darshanam — grants liberation from rebirth.' },
    { icon:'🪷', title:'Margazhi Season', info:'The sacred 30-day month — Goddess Andal\'s Thiruppavai hymns are recited. Temple visits at dawn grant special blessings.' },
  ],
};

const DID_YOU_KNOW = [
  { icon:'🛕', fact:'Sri Venkateswara Temple at Tirumala is the richest temple in the world, receiving over 50,000 devotees daily.' },
  { icon:'🌺', fact:'The Tirumala Laddu Prasadam has a GI (Geographical Indication) tag — it can only be made at Tirumala with the original recipe.' },
  { icon:'💈', fact:'Devotees offer their hair (Thonsure) at Tirumala as a symbol of surrender of ego to the Lord.' },
  { icon:'🔔', fact:'The bells (Ghanta) at a temple purify the atmosphere. The sound Om reverberates when a bell is struck correctly.' },
  { icon:'🌿', fact:'Tulasi (Holy Basil) is the most sacred plant in Vaishnava tradition — offered to Lord Vishnu and believed to purify the air.' },
  { icon:'🐘', fact:'Temple elephants (Gaja) are considered Lord Ganesha\'s representatives. They bless devotees by touching their heads with the trunk.' },
  { icon:'🍛', fact:'Annadanam (free food offering) is the highest form of charity — "Anna daata sukhi bhava" (May the food-giver be blessed).' },
  { icon:'🌸', fact:'Lotus (Padma) grows in muddy water yet remains pure — it symbolizes the soul remaining unstained by worldly attachments.' },
];

const SEVA_INFO = [
  {
    name: 'Venkateswara Suprabhatam Seva',
    time: '9:00 AM',
    desc: 'Morning awakening prayer — devotees greet the Lord with sacred Suprabhatam hymns',
    icon: '🌅',
  },
  {
    name: 'Venkateswara Nitya Archana',
    time: '10:00 AM',
    desc: 'Daily flower worship with chanting of the Lord\'s 108 holy names',
    icon: '🌸',
  },
  {
    name: 'Deeparadhana & Archana',
    time: '6:30 PM',
    desc: 'Evening lamp offering — Mangala Harathi with sacred flames and Archana',
    icon: '🪔',
  },
  {
    name: 'Ekantha Seva',
    time: '7:30 PM',
    desc: 'Sacred closing ceremony — Lord\'s night rest ritual ending the day\'s worship',
    icon: '🌙',
  },
];

export default function NewsFeed({ events = [], currentDate }) {
  const [activeTab, setActiveTab] = useState('news');
  const month = currentDate ? currentDate.getMonth() : new Date().getMonth();
  const year  = currentDate ? currentDate.getFullYear() : new Date().getFullYear();
  const monthName = (currentDate || new Date()).toLocaleDateString('en-US', { month:'long' });

  const festivalItems = FESTIVAL_INFO[month] || [];
  const todayFact    = DID_YOU_KNOW[(month * 3 + new Date().getDate()) % DID_YOU_KNOW.length];

  const templeEvents = events
    .filter(e => e.type !== 'panchang')
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  const typeColors = {
    pooja:'#f97316', festival:'#8b5cf6', holiday:'#3b82f6',
    kalyanam:'#ec4899', abhishekam:'#10b981',
  };
  const tabs = [
    { id:'news',   label:'🗞️ Festival Info' },
    { id:'events', label:'📅 This Month'    },
    { id:'seva',   label:'🛕 Daily Seva'    },
  ];

  return (
    <div style={{ width:'100%', fontFamily:"'Georgia', serif" }}>

      {/* Header */}
      <div style={{
        background:'linear-gradient(135deg, #92400e, #b45309)',
        borderRadius:'12px 12px 0 0', padding:'14px 16px',
      }}>
        <div style={{ fontSize:'0.7rem', color:'#fcd34d', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:3 }}>
          Temple Updates
        </div>
        <div style={{ fontSize:'1.15rem', fontWeight:'700', color:'white' }}>
          {monthName} {year}
        </div>
        <div style={{ fontSize:'0.78rem', color:'#fde68a', marginTop:2 }}>
          Sri Venkateswara Swamy Temple · Castle Rock CO
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', background:'#fffbeb', borderLeft:'1px solid #fed7aa', borderRight:'1px solid #fed7aa' }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            flex:1, padding:'9px 4px', border:'none', cursor:'pointer',
            fontSize:'0.7rem', fontWeight: activeTab===tab.id ? '700' : '500',
              color: activeTab===tab.id ? '#92400e' : '#9ca3af',
              background: activeTab===tab.id ? 'white' : 'transparent',
            borderBottom: activeTab===tab.id ? '2.5px solid #b45309' : '2.5px solid transparent',
            transition:'all 0.15s',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{
        background:'white', borderRadius:'0 0 12px 12px',
        border:'1px solid #fed7aa', borderTop:'none',
        overflowY:'auto', maxHeight:'calc(100vh - 240px)', minHeight:480,
      }}>

        {/* ── FESTIVAL INFO ── */}
        {activeTab === 'news' && (
          <div>
            <div style={{
              margin:'12px 12px 0', padding:'12px 14px',
              background:'linear-gradient(135deg, #fffbeb, #fef3c7)',
              border:'1px solid #fde68a', borderRadius:10,
            }}>
              <div style={{ fontSize:'0.72rem', fontWeight:'700', color:'#b45309', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
                ✨ Did You Know?
              </div>
              <div style={{ fontSize:'0.88rem', color:'#374151', lineHeight:1.6 }}>
                {todayFact.icon} {todayFact.fact}
              </div>
            </div>

            <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ fontSize:'0.72rem', fontWeight:'700', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                🗓 Festivals This Month
              </div>
              {festivalItems.length === 0 ? (
                <div style={{ color:'#9ca3af', fontSize:'0.9rem', textAlign:'center', padding:'20px 0' }}>
                  No featured festivals this month
                </div>
              ) : festivalItems.map((item, i) => (
                <div key={i} style={{
                  padding:'11px 13px', background:'#fafafa',
                  border:'1px solid #f3f4f6', borderRadius:10,
                  borderLeft:'3px solid #f97316',
                }}>
                  <div style={{ fontSize:'0.9rem', fontWeight:'700', color:'#92400e', marginBottom:5 }}>
                    {item.icon} {item.title}
                  </div>
                  <div style={{ fontSize:'0.82rem', color:'#6b7280', lineHeight:1.6 }}>
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
              <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af' }}>
                <div style={{ fontSize:'2.2rem', marginBottom:10 }}>🛕</div>
                <div style={{ fontSize:'0.95rem' }}>No events this month yet</div>
              </div>
            ) : templeEvents.map((event, i) => {
              const d = new Date(event.date + 'T12:00:00');
              const dayName = d.toLocaleDateString('en-US', { weekday:'short' });
              const dayNum  = d.getDate();
              const color = typeColors[event.type] || '#6b7280';
              return (
                <div key={event.id || i} style={{
                  display:'flex', gap:10, alignItems:'flex-start',
                  padding:'10px 12px', marginBottom:7,
                  background:'white', border:'1px solid #f3f4f6',
                  borderLeft:`3px solid ${color}`, borderRadius:10,
                }}>
                  <div style={{ textAlign:'center', flexShrink:0, width:40 }}>
                    <div style={{ fontSize:'1.15rem', fontWeight:'800', color, lineHeight:1 }}>{dayNum}</div>
                    <div style={{ fontSize:'0.65rem', color:'#9ca3af', textTransform:'uppercase' }}>{dayName}</div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:'0.88rem', fontWeight:'700', color:'#111827', lineHeight:1.35 }}>
                      {event.title}
                    </div>
                    {event.time && (
                      <div style={{ fontSize:'0.75rem', color:'#6b7280', marginTop:3 }}>🕐 {event.time}</div>
                    )}
                    {event.description && (
                      <div style={{ fontSize:'0.73rem', color:'#9ca3af', marginTop:2,
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
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
            <div style={{ fontSize:'0.78rem', color:'#9ca3af', marginBottom:12, lineHeight:1.6 }}>
              Daily Sevas at Sri Venkateswara Temple. Contact temple for participation and sponsorship.
            </div>
            {SEVA_INFO.map((seva, i) => (
              <div key={i} style={{
                display:'flex', gap:12, alignItems:'flex-start',
                padding:'14px 16px', marginBottom:8,
                background: i % 2 === 0 ? '#fffbeb' : 'white',
                border:'1px solid #fef3c7',
                borderLeft:'4px solid #f97316',
                borderRadius:10,
              }}>
                <div style={{ fontSize:'1.5rem', flexShrink:0, lineHeight:1, marginTop:3 }}>
                  {seva.icon}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'center', marginBottom:5, flexWrap:'wrap', gap:6 }}>
                    <div style={{ fontSize:'1rem', fontWeight:'800', color:'#92400e' }}>
                    {seva.name}
                    </div>
                    <div style={{ fontSize:'0.9rem', fontWeight:'700', color:'white',
                      background:'linear-gradient(135deg,#b45309,#d97706)',
                      padding:'4px 12px', borderRadius:20, whiteSpace:'nowrap',
                    }}>
                      🕐 {seva.time}
                    </div>
                  </div>
                  <div style={{ fontSize:'0.88rem', color:'#6b7280', lineHeight:1.6 }}>
                    {seva.desc}
                  </div>
                </div>
              </div>
            ))}
            <div style={{
              marginTop:12, padding:'11px 13px', background:'#f0fdf4',
              border:'1px solid #bbf7d0', borderRadius:9,
              fontSize:'0.82rem', color:'#15803d', lineHeight:1.6,
            }}>
              🙏 <strong>Sponsor a Seva</strong> — a great way to receive Lord's blessings. Call 303-660-9555 to book.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
