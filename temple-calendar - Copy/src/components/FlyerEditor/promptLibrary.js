// ─── AI Image Prompt Library ──────────────────────────────────────────────────
// Keyword-matched prompts for Hindu temple events.
// Each entry has keywords (matched against event title) and a detailed prompt.

const BASE_STYLE = `ultra-realistic Indian devotional calendar art style, 4K resolution, highly detailed, symmetrical composition, sharp focus, rich vibrant colors, divine golden glow, professional spiritual poster, centered composition, empty space at top and bottom for text overlays, NO TEXT in image, NO WORDS, NO LETTERS`;

const PROMPT_LIBRARY = [
  {
    keywords: ['abhishekam', 'thirumanjanam', 'snapanam'],
    prompt: `Lord Venkateswara (Balaji) black granite idol being bathed in sacred panchamruta abhishekam — milk, honey, curd, ghee and rose water cascading over the idol, marigold and jasmine flowers floating around, silver and gold ritual vessels, priests hands holding vessels, soft golden temple lamp light reflecting off the wet idol, temple sanctum background with hanging bells and lamps, deep devotional atmosphere`,
  },
  {
    keywords: ['kalyanam', 'brahmotsavam', 'thirukalyanam', 'wedding', 'celestial'],
    prompt: `Divine celestial wedding (Kalyanam) of Lord Venkateswara in golden silk pitambaram and Goddess Padmavathi in red and gold silk saree, both wearing elaborate temple jewelry and floral garlands, garland exchange moment (mala badal), celestial flowers raining from above, golden mandapam with pillars, Vedic priests performing rituals with sacred fire, pink and gold color palette, soft divine light`,
  },
  {
    keywords: ['venkateswara', 'venkateshwara', 'balaji', 'srinivasa', 'tirupati', 'tirumala'],
    prompt: `Lord Venkateswara (Balaji) standing in full divine glory in Tirumala temple sanctum, majestic black stone idol with sacred white and red namam tilak on forehead, golden Kirita crown encrusted with diamonds, heavy diamond and ruby temple jewelry covering chest, long flower garlands of roses and jasmine reaching to feet, four arms — upper arms holding golden Sudarshana Chakra and Panchajanya Shankha, lower right hand in Abhaya mudra blessing devotees, lower left hand pointing downward, wrapped in golden silk pitambaram, divine golden aura surrounding the idol, stone temple pillars with intricate carvings, hanging bronze lamps (deepam) flickering, sacred atmosphere`,
  },
  {
    keywords: ['ganapathi', 'ganesh', 'ganesha', 'ganpati', 'vinayaka', 'chaturthi', 'siddhi'],
    prompt: `Lord Ganesha seated gracefully on a golden lotus throne, large elephant head with a single broken tusk, wide gentle eyes with divine expression, large curved trunk turned slightly left (considered auspicious), four arms — holding golden modak sweet in lower right, lotus flower in upper right, broken tusk in lower left, water lily in upper left, wearing saffron silk dhoti, heavy gold jewelry and crown adorned with gems, marigold garland around neck, small mouse vehicle (Mooshika) at feet, warm saffron and gold color palette, divine golden aura`,
  },
  {
    keywords: ['lakshmi', 'varalakshmi', 'kojagara', 'diwali', 'deepavali', 'dhanteras'],
    prompt: `Goddess Mahalakshmi standing on a fully bloomed pink lotus rising from water, dressed in red and gold silk saree with gold zari border, wearing elaborate gold temple jewelry — necklaces, earrings, armlets, bangles, and crown, four arms — upper two arms holding pink lotus flowers, lower left arm holding a golden pot overflowing with gold coins cascading down, lower right hand in Varada mudra (gift giving gesture), flanked by two white elephants on either side showering water from trunks, soft pink and gold background with more lotus flowers, divine radiant glow`,
  },
  {
    keywords: ['shiva', 'shivaratri', 'rudra', 'mahashivratri', 'shiv'],
    prompt: `Lord Shiva in deep meditation seated on Mount Kailash peak, white snow mountain background, crescent moon in matted hair (jata), sacred Ganga river flowing from hair, third eye on forehead (closed in meditation), wearing rudraksha mala necklace, vibhuti ash on forehead and body, tiger skin draped around waist, blue throat (Neelakantha), golden trishul (trident) planted beside him, small Nandi bull seated nearby, blue and silver color palette, serene cosmic atmosphere, soft moonlight`,
  },
  {
    keywords: ['lingam', 'lingabhishek'],
    prompt: `Shiva Lingam in temple sanctum being adorned with sacred bilva leaves, white flowers, and vibhuti ash, silver and gold ritual vessels containing milk and water, brass deepam lamps glowing around the lingam, stone temple floor with rangoli patterns, priests hands in ritual gesture, soft warm lamp light, deeply devotional temple atmosphere`,
  },
  {
    keywords: ['krishna', 'janmashtami', 'govinda', 'gopal', 'radha', 'vrindavan', 'gokulashtami'],
    prompt: `Lord Krishna in his youth standing in Vrindavan forest, playing a golden flute with eyes half-closed in divine bliss, peacock feather in crown, wearing yellow silk pitambaram, garland of forest flowers, beautiful blue complexion, cows and calves grazing in green meadow behind, Yamuna river flowing in background, golden sunset light filtering through trees, soft divine glow, radiant and joyful expression`,
  },
  {
    keywords: ['rama', 'ram', 'ramanavami', 'sita', 'hanuman', 'ramayana', 'ramnavami'],
    prompt: `Sri Ram Darbar — Lord Rama seated on golden throne wearing golden crown and yellow silk, Goddess Sita seated beside him in red silk saree, Lakshmana standing to the right holding bow and arrow, Hanuman kneeling devotedly at Rama's feet with folded hands, golden Ayodhya palace background with pillars and flower decorations, warm gold and saffron color palette, divine royal atmosphere`,
  },
  {
    keywords: ['murugan', 'subramanya', 'skanda', 'karthikeyan', 'vaikasi', 'thaipusam'],
    prompt: `Lord Murugan standing tall and powerful, holding golden Vel (spear) in right hand, beautiful peacock (mayil) spreading colorful feathers beside him, wearing red and gold silk with temple jewelry, divine youthful face with serene smile, two wives Valli and Devasena flanking on either side, South Indian temple gopuram background with intricate carvings, bright gold and red color palette, divine aura`,
  },
  {
    keywords: ['durga', 'navaratri', 'navratri', 'devi', 'shakti', 'ambika', 'kali', 'chamundi'],
    prompt: `Goddess Durga seated on her lion vehicle (vahana), ten arms each holding different divine weapons — trishul, chakra, sword, bow, arrow, conch, lotus, mace, shield and thunderbolt, wearing deep red silk saree with gold border, elaborate gold crown, diamond and gold temple jewelry, fierce yet compassionate expression, defeated demon Mahishasura beneath the lion, golden and red color palette with divine warrior energy, dramatic divine light`,
  },
  {
    keywords: ['saraswati', 'saraswathi', 'vidyarambham', 'ayudha'],
    prompt: `Goddess Saraswati seated gracefully on a pure white swan, wearing pure white silk saree symbolizing purity, four arms — holding veena (musical instrument) in two arms, sacred scriptures (Vedas) in one hand, lotus flower in another, pearl and gold jewelry, serene beautiful face with gentle smile, white lotus flowers surrounding her, soft white and golden light background, peaceful and scholarly divine atmosphere`,
  },
  {
    keywords: ['festival', 'utsav', 'mahotsav', 'celebration', 'jayanti', 'pournami', 'purnima'],
    prompt: `Vibrant Hindu festival celebration scene, beautifully decorated temple gopuram illuminated with golden lights, foreground filled with colorful marigold and jasmine flower garlands, brass deepam oil lamps arranged symmetrically, devotees in traditional silk sarees and dhotis, rangoli with lotus pattern on temple floor, saffron and gold color palette, joyful devotional atmosphere, warm evening light`,
  },
  {
    keywords: ['pooja', 'puja', 'archana', 'homam', 'havan', 'yagam', 'yajna'],
    prompt: `Sacred Hindu pooja ritual, ornate silver and gold puja thali filled with kumkum, turmeric, flowers, camphor, incense sticks, a lit deepam lamp casting warm golden light, priests hands in ritual mudra gesture, temple bells hanging, stone pillars of temple sanctum visible, rose petals scattered on the floor, soft devotional golden light, deeply spiritual atmosphere`,
  },
  // ── Default ───────────────────────────────────────────────────────────────
  {
    keywords: [],
    prompt: `Lord Venkateswara (Balaji) standing in full divine glory in Tirumala temple sanctum, majestic black stone idol, golden Kirita crown, heavy diamond temple jewelry, long flower garlands, four arms holding Chakra and Shankha, right hand in Abhaya mudra blessing, golden silk pitambaram, divine golden aura, stone temple pillars, hanging bronze deepam lamps, sacred devotional atmosphere`,
  },
];

/**
 * Auto-selects the best prompt based on the event title and type.
 * Falls back to the default Venkateswara prompt if no keywords match.
 */
export const buildPrompt = (event) => {
  const combined = `${(event?.title || '')} ${(event?.type || '')}`.toLowerCase();

  const match = PROMPT_LIBRARY.find(p =>
    p.keywords.length > 0 && p.keywords.some(kw => combined.includes(kw))
  ) || PROMPT_LIBRARY[PROMPT_LIBRARY.length - 1];

  return `${match.prompt}. ${BASE_STYLE}`;
};
