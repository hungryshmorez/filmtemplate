// storyTemplates.ts — Genre story-engine library, sourced from the Showrunner AI
// Beta Tester Guide (14 TV narrative engines + 14 feature-film 3-act suites).
//
// Two roles in the app:
//  1. Brainstorm scaffolding: offered when writing an episode (or a movie act
//     breakdown) so the Script Creation Engine prompt can be seeded with a
//     concrete narrative shape instead of a blank page.
//  2. Seed library that grows organically — when the user finalizes an
//     episode, the app can strip a general reusable template out of it and
//     add it back here (see `learnedTemplates` in db.ts, wired from the UI).

export type Genre =
  | "Comedy"
  | "Sitcom"
  | "Drama"
  | "Reality TV"
  | "Sci-Fi"
  | "Anime"
  | "Fantasy"
  | "Family"
  | "Western"
  | "Crime"
  | "Action & Adventure"
  | "Romance"
  | "Horror"
  | "Live Action";

export const GENRES: Genre[] = [
  "Comedy",
  "Sitcom",
  "Drama",
  "Reality TV",
  "Sci-Fi",
  "Anime",
  "Fantasy",
  "Family",
  "Western",
  "Crime",
  "Action & Adventure",
  "Romance",
  "Horror",
  "Live Action",
];

// --- TV: 5-beat story engines + episodic/serialized templates --------------

export interface FiveBeat {
  label: string;
  description: string;
}

export interface TvTemplate {
  name: string;
  format: string; // "Episodic" | "Serialized" | "Episodic/Serialized" | "Episodic/Multi-Part"
  concept: string;
  mechanics: string;
}

export interface TvGenreEngine {
  genre: Genre;
  engineName: string;
  coreEngine: string;
  beats: FiveBeat[];
  templates: TvTemplate[];
}

export const TV_GENRE_ENGINES: TvGenreEngine[] = [
  {
    genre: "Comedy",
    engineName: "Cinematic Character Arc Engine",
    coreEngine:
      "Comedy television operates on character-driven flaws colliding with escalating external absurdity. The humor stems from characters rigidly applying their flawed logic to solve problems, creating escalating chaos until reality forces an adjustment.",
    beats: [
      { label: "The Setup", description: "Introduce the protagonist in their ordinary world, clearly establishing their central character flaw, eccentric habit, or bizarre workplace dynamic." },
      { label: "The Complication", description: "An unexpected external catalyst forces the protagonist out of their comfort zone, presenting a problem that cannot be ignored." },
      { label: "The Struggle", description: "A sequence of escalating comedic set-pieces as the protagonist attempts to resolve the issue using their deeply flawed reasoning, making things worse." },
      { label: "The Darkest Hour", description: "The humor pauses; their flawed logic finally backfires catastrophically, costing them something they genuinely care about." },
      { label: "The Resolution", description: "The protagonist succeeds (or fails hilariously) by finally adapting their approach, earning a small victory and establishing a humorous new baseline." },
    ],
    templates: [
      { name: "The A/B Plot Collision", format: "Episodic", concept: "The main characters tackle an absurd, high-stakes central goal (A-plot), while secondary characters handle a trivial, mundane task (B-plot).", mechanics: "Both storylines progress in parallel with rapid cross-cutting. At the climax, the physical mechanics or consequences of the mundane B-plot unexpectedly crash into the A-plot, resolving both in a chaotic explosion of slapstick and revelation." },
      { name: "The Escalating Lie", format: "Episodic", concept: "A character tells a small, innocent white lie to avoid minor discomfort, embarrassment, or social obligation.", mechanics: "To prevent the lie from being discovered, they are forced to fabricate increasingly elaborate cover-ups, enlisting accomplices and renting props until the deception snowballs into a massive, unmanageable public spectacle that collapses in front of everyone." },
    ],
  },
  {
    genre: "Sitcom",
    engineName: "Circular Reset Engine",
    coreEngine:
      "Sitcoms rely on a strictly circular narrative engine. Characters begin at a comfortable baseline, endure escalating interpersonal chaos, learn a very minor emotional lesson, and return to the same baseline by the credits.",
    beats: [
      { label: "The Cold Open", description: "A quick, self-contained comedic vignette establishing the status quo (e.g. workplace banter or housemate friction over something trivial)." },
      { label: "The Inciting Incident", description: "A misunderstanding occurs, an unwelcome task arrives, or an overly ambitious wacky scheme is hatched." },
      { label: "The Escalation", description: "The characters double down on their initial mistake; the scheme spins wildly out of control as complications multiply." },
      { label: "The Climax", description: "Everything blows up in an embarrassing, highly public confrontation where the truth is exposed to all parties." },
      { label: "The Reset", description: "Brief emotional grounding; characters share a laugh, absorb a minor penalty, and land back at the exact baseline for next week." },
    ],
    templates: [
      { name: "The Bottle Episode", format: "Episodic", concept: "The entire main cast is physically trapped in a single confined location (an elevator, a breakroom, or stuck subway car) for the full episode.", mechanics: "Stripped of external distractions, a minor petty grievance escalates into an explosive shouting match, airing long-buried resentments before culminating in a sweet, emotional reconciliation that bonds the group." },
      { name: "The Misguided Scheme", format: "Episodic", concept: "A character desires something they cannot afford or achieve through standard means (money, status, or an exclusive club invite).", mechanics: "They drag an unwilling sidekick into an overly complicated shortcut plan. The scheme fails conspicuously at the worst possible moment, resetting the status quo." },
    ],
  },
  {
    genre: "Drama",
    engineName: "Power Dynamic & Secret Engine",
    coreEngine:
      "Television drama is driven by interpersonal power dynamics, hidden secrets, and escalating emotional stakes. Unlike comedy, drama deals with permanent consequences — decisions alter relationships, alliances, and status permanently.",
    beats: [
      { label: "The Status Quo", description: "Introduce deeply flawed, complex characters operating within a tense, fragile social or familial power structure." },
      { label: "The Catalyst", description: "An external or internal event forces a difficult, high-stakes choice, disrupting the fragile peace." },
      { label: "Rising Action", description: "Long-held secrets slowly surface; shifting allegiances form and break as pressure mounts on every character." },
      { label: "The Boiling Point", description: "The emotional or physical climax where all hidden truths, betrayals, and simmering resentments explode into open confrontation." },
      { label: "The Fallout", description: "Characters are left dealing with the irreversible consequences of their actions, establishing a permanent, darker status quo." },
    ],
    templates: [
      { name: "The Power Vacuum", format: "Serialized", concept: "A dominant leader, corporate CEO, or patriarch steps down, is incapacitated, or is abruptly murdered.", mechanics: "A multi-episode or season-long arc where remaining characters form temporary alliances, backstab rivals, and vie for control, culminating in the rise of a new, more ruthless status quo." },
      { name: "The Unraveling Secret", format: "Episodic", concept: "A single episode centers on a character desperately attempting to conceal a damaging financial, romantic, or legal truth.", mechanics: "Despite tactical cover-ups and deception, an ally discovers the truth, permanently altering their trust and relationship dynamic." },
    ],
  },
  {
    genre: "Reality TV",
    engineName: "Manufactured Drama Engine",
    coreEngine:
      "Reality TV and docu-series utilize a strict formula of manufactured pressure, rivalries, direct-to-camera confessionals, and high-tension public evaluations to drive weekly viewer engagement.",
    beats: [
      { label: "The Introduction", description: "Introduce the cast, establish the episode's location, and outline the rules, stakes, and penalties of the day's challenge." },
      { label: "The Task", description: "The cast attempts the challenge; collaborative pressure causes underlying rivalries and gossip to bubble to the surface." },
      { label: "The Drama", description: "A major interpersonal confrontation, breakdown, or accusation of sabotage occurs and is dissected in private confessionals." },
      { label: "The Elimination / Judging", description: "The tense, dramatic panel evaluation where judges deliver harsh critiques and reveal who wins and who is sent home." },
      { label: "The Aftermath", description: "Tearful exit interviews, parting words, and a dramatic cliffhanger teasing next week's escalating drama." },
    ],
    templates: [
      { name: "The Elimination Arc", format: "Episodic/Serialized", concept: "Contestants prepare for a specialized performance or technical challenge with survival on the line.", mechanics: "Cross-cuts rapidly between rehearsal room conflict, the high-stakes live performance, biting judge commentary, and a suspenseful elimination." },
      { name: "The Orchestrated Dinner Party", format: "Episodic", concept: "The ensemble cast is forced into an upscale, enclosed social setting with open alcohol and conversational catalysts.", mechanics: "An old rumor is brought up during drinks; a screaming match ensues across the table, ending with someone dramatically storming out." },
    ],
  },
  {
    genre: "Sci-Fi",
    engineName: "Speculative Inquiry Engine",
    coreEngine:
      "Science fiction explores the 'what if' of advanced technology, altered reality, and the unknown cosmos. The engine balances intellectual problem-solving with the existential terror of encountering phenomena beyond human understanding.",
    beats: [
      { label: "The Anomaly", description: "A disruption to the known rules of physics, digital architecture, or biology is detected (a strange signal, glitch in reality, or ship malfunction)." },
      { label: "The Investigation", description: "The crew deploys scientific logic, sensor arrays, and technology to analyze and categorize the threat." },
      { label: "The Complication", description: "Known technology fails, the AI goes rogue, or the anomaly mutates into a significantly more dangerous entity." },
      { label: "The Hypothesis", description: "A highly risky, theoretical solution is proposed under extreme life-support time pressure." },
      { label: "The Execution", description: "Implementing the experimental fix at the last possible second, narrowly escaping and forever altering their understanding of the universe." },
    ],
    templates: [
      { name: "Anomaly of the Week", format: "Episodic", concept: "The crew encounters a localized space-time anomaly, spatial organism, or rogue automated process.", mechanics: "Standard protocols fail; the chief engineer or science officer improvises an untested technological countermeasure to escape." },
      { name: "The Ongoing Conspiracy", format: "Serialized", concept: "The protagonist discovers a tiny, overlooked data irregularity pointing to a massive government or corporate cover-up.", mechanics: "Over multiple episodes, they evade shadowy assassins while unearthing one terrifying piece of the conspiracy puzzle at a time." },
    ],
  },
  {
    genre: "Anime",
    engineName: "Limit-Break Escalation Engine",
    coreEngine:
      "Shonen and narrative anime follow a steep escalation curve driven by idealism and personal growth. Conflicts test the protagonist's philosophy as much as their physical combat skill, pushing them past human limits.",
    beats: [
      { label: "The Dream", description: "Establish the protagonist's grand, seemingly impossible goal and their baseline power level within their world." },
      { label: "The Inciting Attack", description: "A sudden, overwhelming antagonist or rival appears, showcasing a vastly superior level of power." },
      { label: "Defeat & Training", description: "The hero is thoroughly outmatched, undergoes rigorous training, endures suffering, and confronts inner doubt." },
      { label: "The Awakening", description: "Pushed to the absolute brink of death, the hero unlocks a new form, technique, or philosophical realization." },
      { label: "The Victory", description: "The immediate enemy is defeated, but the final moments reveal an even more formidable, cosmic threat on the horizon." },
    ],
    templates: [
      { name: "The Tournament Arc", format: "Serialized", concept: "The hero enters a structured, high-stakes competition featuring unique fighters from rival factions.", mechanics: "Each multi-episode bracket match pits contrasting abilities and ideologies against each other, building to a limit-breaking finale." },
      { name: "The 'Slice of Life' Breather", format: "Episodic", concept: "High-stakes combat pauses for a mundane group activity (a beach trip, seasonal festival, or cooking contest).", mechanics: "Low-stakes character humor allows the ensemble to bond emotionally before the next deadly story arc begins." },
    ],
  },
  {
    genre: "Fantasy",
    engineName: "Mythic Quest & Lore Engine",
    coreEngine:
      "Fantasy television is rooted in the classic Hero's Journey, expansive world-building, and ancient magical systems. The engine balances party dynamics, magical lore exploration, and the struggle against corrupting dark forces.",
    beats: [
      { label: "The Call", description: "The protagonist is pulled from their ordinary rural or urban life into a larger magical or prophecy-driven conflict." },
      { label: "The Journey Begins", description: "Assembling an adventuring party with diverse capabilities (warrior, mage, rogue), establishing the rules and costs of magic." },
      { label: "The Trial", description: "A mini-boss, magical curse, or treacherous terrain tests the group's trust, unity, and resourcefulness." },
      { label: "The Darkest Hour", description: "A major defeat occurs, a key magical artifact is lost, or an elder mentor is sacrificed to protect the party." },
      { label: "The Triumph", description: "Combining newly unlocked magical mastery, tactical synergy, and sheer resolve to defeat the dark forces." },
    ],
    templates: [
      { name: "Monster of the Week", format: "Episodic", concept: "The party arrives in a remote village plagued by a specific beast, curse, or haunted relic.", mechanics: "They investigate local folklore, identify the creature's vulnerability, execute the hunt, collect the bounty, and hit the road." },
      { name: "Political Intrigue", format: "Serialized", concept: "Multiple noble houses, guilds, and magical factions vie for control of the imperial throne.", mechanics: "Episodes focus on closed-door alliances, royal betrayals, targeted assassinations, and the onset of an all-out magical civil war." },
    ],
  },
  {
    genre: "Family",
    engineName: "Generational Harmony Engine",
    coreEngine:
      "Family television revolves around wholesome, low-stakes conflicts rooted in generational dynamics, empathy, and household trust. The narrative engine tests family loyalty before re-affirming that love overcomes misunderstandings.",
    beats: [
      { label: "The Misunderstanding", description: "A generational clash occurs (kids trying to hide a broken heirloom or a bad report card from parents)." },
      { label: "The Cover-Up", description: "The children go to elaborate, goofy, and overly complicated lengths to keep the truth concealed." },
      { label: "The Reveal", description: "The parents inevitably discover the truth, resulting in grounded, humorous household chaos." },
      { label: "The Heart-to-Heart", description: "The comedy pauses for an honest, vulnerable conversation about trust, responsibility, and mutual respect." },
      { label: "The Hug", description: "A warm, emotionally satisfying resolution where everyone reaffirms that family unity comes above all else." },
    ],
    templates: [
      { name: "The Parent Trap", format: "Episodic", concept: "The kids attempt a coordinated scheme to manipulate their parents into granting permission for a risky activity.", mechanics: "The parents see through the scheme immediately and play along to teach the kids a humorous, heartwarming lesson." },
      { name: "The Unwanted Guest", format: "Episodic", concept: "A new dynamic is introduced when an eccentric relative or grandparent moves into the household temporarily.", mechanics: "The protagonist feels displaced and acts out, but eventually discovers common ground and forms a deep, lasting bond." },
    ],
  },
  {
    genre: "Western",
    engineName: "Frontier Justice & Honor Engine",
    coreEngine:
      "The Western narrative engine explores themes of frontier lawlessness, individualism, and the moral cost of violence. It centers on isolated settlements on the edge of civilization defended by reluctant, wandering gunslingers.",
    beats: [
      { label: "The Arrival", description: "A solitary, weathered stranger or lawman rides into an isolated, vulnerable frontier settlement." },
      { label: "The Provocation", description: "A ruthless land baron, mining company, or outlaw gang pushes the peaceful townsfolk past their breaking point." },
      { label: "The Reluctance", description: "The stranger attempts to avoid local politics, but is forced to draw iron when innocents are harmed." },
      { label: "High Noon", description: "The ultimate, high-tension standoff or tactical shootout in the center of town against overwhelming odds." },
      { label: "The Departure", description: "Justice and order are restored; unable to settle into civilian life, the stranger rides off into the sunset." },
    ],
    templates: [
      { name: "The Town Defense", format: "Episodic/Multi-Part", concept: "A peaceful community is threatened with annihilation by an approaching mercenary gang.", mechanics: "A hired gunslinger fortifies the town, builds choke points, and trains the timid locals to stand their ground in a final shootout." },
      { name: "The Bounty Hunt", format: "Episodic", concept: "A bounty hunter tracks an elusive fugitive across harsh, treacherous wilderness.", mechanics: "After surviving ambushes and capturing the target, the lawman uncovers evidence that the fugitive was framed, creating a moral dilemma." },
    ],
  },
  {
    genre: "Crime",
    engineName: "Investigative Whodunit Engine",
    coreEngine:
      "The Crime procedural is an analytical engine driven by forensic discovery, witness psychology, and deductive logic. It satisfies the audience's desire for intellectual problem-solving and the moral restoration of justice.",
    beats: [
      { label: "The Teaser", description: "The crime is committed or a body is discovered in an unusual location by an innocent bystander." },
      { label: "The Investigation", description: "Detectives arrive, secure the scene, collect physical forensics, and interview the obvious suspect." },
      { label: "The Red Herring", description: "The initial suspect's alibi checks out; a major plot twist shatters the detective's theory." },
      { label: "The Breakthrough", description: "A tiny, overlooked forensic clue or timeline inconsistency blows the entire case open." },
      { label: "The Confession / Arrest", description: "Detectives corner the true culprit in an intense interrogation room, dismantling their alibi until they confess." },
    ],
    templates: [
      { name: "The Procedural", format: "Episodic", concept: "A self-contained whodunit case investigated and completely resolved within a single 45-minute episode.", mechanics: "Methodical processing from initial crime scene to lab analysis, false leads, interrogation breakthroughs, and arrest." },
      { name: "The Cat-and-Mouse", format: "Serialized", concept: "A brilliant detective and an elusive serial killer become mutually obsessed over a season-long investigation.", mechanics: "The killer leaves personalized clues, forcing the detective to cross legal and ethical boundaries to anticipate their next strike." },
    ],
  },
  {
    genre: "Action & Adventure",
    engineName: "High-Octane Momentum Engine",
    coreEngine:
      "Action and adventure television is fueled by kinetic momentum, physical stakes, ticking clocks, and tactical set-pieces. The engine prioritizes relentless pacing, teamwork, and hostile-environment improvisation.",
    beats: [
      { label: "The Cold Open", description: "Starts mid-mission with an explosive car chase, rooftop shootout, or daring prison escape." },
      { label: "The Briefing", description: "The core stakes are established (disarm a weapon, recover a stolen asset, or rescue a captured operative)." },
      { label: "The Infiltration", description: "The team executes a synchronized, highly choreographed plan to penetrate the enemy stronghold." },
      { label: "The Trap", description: "A sudden betrayal, security lockdown, or enemy ambush blows their cover, putting the heroes on the defensive." },
      { label: "The Escape", description: "A massive, explosive tactical victory and extraction against overwhelming odds, securing the objective." },
    ],
    templates: [
      { name: "The Heist / Extraction", format: "Episodic", concept: "The squad is assigned an impossible recovery mission inside a fortified facility.", mechanics: "A slick planning montage is followed by an immediate breakdown on the ground, forcing the team to improvise a chaotic escape." },
      { name: "The Fugitive Run", format: "Serialized", concept: "The protagonist is framed for an institutional failure and forced on the run from both police and real villains.", mechanics: "They must evade capture across multiple cities while gathering fragmented evidence to expose the true conspirators." },
    ],
  },
  {
    genre: "Romance",
    engineName: "Emotional Proximity Engine",
    coreEngine:
      "Television romance is powered by the emotional and physical distance between two people. The engine thrives on forced proximity, witty banter, vulnerable revelations, and external forces that keep lovers apart.",
    beats: [
      { label: "The Meet-Cute", description: "The leads cross paths in an awkward or contentious encounter, establishing initial friction." },
      { label: "The Spark", description: "Forced proximity or shared work lowers their emotional defenses, revealing undeniable chemistry." },
      { label: "The Complication", description: "An ex reappears, a hidden secret is exposed, or a professional obligation pulls them apart just as they connect." },
      { label: "The Grand Gesture", description: "One character swallows their pride, takes a major emotional risk, and races to confess their feelings." },
      { label: "The Union", description: "A definitive romantic confession and passionate kiss, sealing their commitment to a shared future." },
    ],
    templates: [
      { name: "The Will-They-Won't-They", format: "Serialized", concept: "Two leads share intense romantic chemistry across multiple seasons without fully committing.", mechanics: "Near-misses, interruptions, and external relationships maintain simmering romantic tension before breakthrough moments." },
      { name: "The Fake Relationship", format: "Episodic/Multi-Part", concept: "Two characters pretend to date for mutual social or professional benefit (fooling family or a boss).", mechanics: "Selling the facade sparks genuine feelings, which are thrown into crisis when the underlying deception is exposed." },
    ],
  },
  {
    genre: "Horror",
    engineName: "Dread & Survival Engine",
    coreEngine:
      "Horror television is built on pacing, subverting safe spaces, escalating dread, and the terror of isolation. The engine strips characters of rational control, plunging them into raw survival against malevolent forces.",
    beats: [
      { label: "False Security", description: "Establish the normal world where characters feel safe, accompanied by subtle, dismissed anomalies." },
      { label: "The Hook", description: "An unsettling, disturbing discovery confirms the presence of an active supernatural or physical threat." },
      { label: "The Escalation", description: "Unexplainable occurrences multiply; technology fails, communication is cut, and characters become paranoid." },
      { label: "The Climax", description: "The monster or killer is fully revealed in a bloody, desperate fight for physical survival." },
      { label: "The Lingering Dread", description: "The protagonist survives and escapes, but a final disturbing twist reveals the evil was not truly destroyed." },
    ],
    templates: [
      { name: "The Haunted Location", format: "Episodic", concept: "Characters enter an isolated structure (abandoned hospital or cabin) with a violent occult history.", mechanics: "Psychological disorientation escalates into lethal physical danger as the location's dark past traps them inside." },
      { name: "The Psychological Spiral", format: "Serialized/Episodic", concept: "The protagonist experiences terrifying hallucinations that peers dismiss as mental instability.", mechanics: "They isolate themselves to investigate, only to discover the entity is 100% real and already inside their home." },
    ],
  },
  {
    genre: "Live Action",
    engineName: "Realistic Grounding Engine",
    coreEngine:
      "Live action is a medium that shifts animated or stylized properties into realistic physics, grounded emotional consequences, and tangible physical stakes, balancing nostalgic references with gritty visual realism.",
    beats: [
      { label: "Grounding the World", description: "Translating cartoon logic into tangible physical environments with believable weight and texture." },
      { label: "The Hero's Call", description: "A reluctant, psychologically grounded take on the protagonist accepting extraordinary responsibilities." },
      { label: "The Spectacle", description: "High-budget visual set-pieces showcasing what stylized powers and creatures look like in physical reality." },
      { label: "The Climax", description: "A high-consequence final confrontation that tests character psychology as much as spectacle." },
      { label: "The Franchise Setup", description: "A narrative coda or post-credits sequence teasing the next major story expansion." },
    ],
    templates: [
      { name: "The Grounded Adaptation", format: "Episodic", concept: "Takes an episodic, cartoonish storyline from the source material and condenses it into a 45-minute dramatic teleplay.", mechanics: "Emphasizes character angst, moral stakes, and realistic VFX while preserving iconic dialogue and character beats." },
      { name: "The Lore Expansion", format: "Serialized/Episodic", concept: "Takes a minor, unexplained background detail from original animated lore and builds a full narrative arc around it.", mechanics: "Deepens world-building and character backstories while integrating seamlessly into the primary live-action plot." },
    ],
  },
];

// --- Film: full 3-act breakdowns, Classic vs. Subverted arc per genre ------

export interface ActBreakdown {
  actI: string[];
  actII: string[];
  actIII: string[];
}

export interface FilmTemplate {
  name: string;
  arc: "Classic Arc" | "Subverted Arc";
  acts: ActBreakdown;
}

export interface FilmGenreSuite {
  genre: Genre;
  templates: FilmTemplate[];
}

export const FILM_GENRE_SUITES: FilmGenreSuite[] = [
  {
    genre: "Comedy",
    templates: [
      { name: "The Fish Out of Water", arc: "Classic Arc", acts: {
        actI: ["Status Quo: An eccentric, unconventional character thrives in their niche, chaotic world.", "Inciting Incident: Circumstances force them into a formal, highly conservative institution.", "Plot Point 1: The protagonist commits to succeeding in the new environment using their unorthodox habits."],
        actII: ["Rising Action: Comedic clashes occur as the protagonist baffles authority figures and breaks protocols.", "Midpoint: An unconventional solution delivers an unexpected victory, earning peer admiration.", "All Hope Lost: A rigid formal evaluation exposes their lack of traditional credentials, leading to public failure.", "Plot Point 2: They realize they must blend their authentic instincts with necessary discipline."],
        actIII: ["Climax: A high-stakes institutional challenge where the protagonist combines both skill sets to save the day.", "Resolution: The institution becomes more flexible, and the protagonist earns respect on their own terms."],
      }},
      { name: "The Misfit Mission", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: A group of bizarre outsiders live peacefully on the fringes of an ordinary town.", "Inciting Incident: A local corporate giant threatens to bulldoze their community hub.", "Plot Point 1: The misfits unite behind an absurd plan to infiltrate the corporate headquarters."],
        actII: ["Rising Action: Bizarre training montages and reconnaissance missions where each member displays quirky specialties.", "Midpoint: Infiltrating the outer perimeter succeeds through sheer luck and misunderstanding.", "All Hope Lost: Inside the vault, their lack of coordination traps them in a high-security lockdown.", "Plot Point 2: Instead of mimicking professional thieves, they decide to weaponize their unpredictable chaos."],
        actIII: ["Climax: A slapstick showdown in the boardroom that inadvertently broadcasts the executive's crimes live.", "Resolution: The hub is saved, and the misfits celebrate their collective oddity."],
      }},
    ],
  },
  {
    genre: "Sitcom",
    templates: [
      { name: "The Road Trip", arc: "Classic Arc", acts: {
        actI: ["Status Quo: The ensemble enjoys their comfortable, static routine in their regular hangout.", "Inciting Incident: A mandatory out-of-state event forces the entire group to travel together.", "Plot Point 1: Budget shortages force them into a single beat-up vehicle, beginning the cross-country trip."],
        actII: ["Rising Action: Missed exits, vehicle breakdowns, and quirky roadside attractions escalate cabin fever.", "Midpoint: An accidental detour leaves them stranded at an odd motel, airing long-buried grievances.", "All Hope Lost: The vehicle is wrecked with hours to spare; the group splinters in frustration.", "Plot Point 2: A heartfelt conversation reunites them, and they improvise an absurd collective ride."],
        actIII: ["Climax: The group crashes the destination event disheveled but united, saving the day with collective honesty.", "Resolution: The ride home is peaceful, their core bonds renewed."],
      }},
      { name: "The Big Event", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: The ensemble takes on organizing a massive, high-profile gala or wedding.", "Inciting Incident: Several characters tell separate, self-serving lies to VIP guests to secure personal perks.", "Plot Point 1: The event begins; the hosts must maintain coordinated deceptions simultaneously."],
        actII: ["Rising Action: Scrambling between rooms, changing outfits, and fabricating alibis as VIPs cross paths.", "Midpoint: The event appears to be a triumph, but the conflicting lies become structurally entangled.", "All Hope Lost: A physical bottleneck forces every guest into one room; the entire web of lies collapses at once.", "Plot Point 2: Stripped of their facade, the group decides to embrace the truth and improvise."],
        actIII: ["Climax: An unscripted, honest performance that turns the disaster into an unforgettable evening.", "Resolution: The event is hailed as an eccentric masterpiece, and the group laughs off the chaos."],
      }},
    ],
  },
  {
    genre: "Drama",
    templates: [
      { name: "The Fall from Grace", arc: "Classic Arc", acts: {
        actI: ["Status Quo: An ambitious, talented protagonist operates at the top of their field, driven by a need for control.", "Inciting Incident: A rare opportunity emerges that requires a single, seemingly minor moral compromise.", "Plot Point 1: The protagonist crosses that ethical line, rationalizing it as a necessary evil."],
        actII: ["Rising Action: Professional success grows, but concealing the original misdeed requires calculated cruelty.", "Midpoint: The protagonist reaches their peak position, but their closest allies begin to pull away.", "All Hope Lost: An investigation closes in; to survive, the protagonist betrays their closest confidant.", "Plot Point 2: Completely isolated, they realize their ambition has destroyed everything meaningful."],
        actIII: ["Climax: A public ceremony where the protagonist accepts their ultimate award in profound emotional ruin.", "Resolution: The protagonist sits in their empty office, successful and completely alone."],
      }},
      { name: "The Family Crucible", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: An estranged family gathers at an ancestral home for a holiday or estate settlement.", "Inciting Incident: A buried financial or relational document is uncovered in the study.", "Plot Point 1: A blizzard traps the family inside, cutting off all communication and escape."],
        actII: ["Rising Action: Polite conversation devolves into passive-aggressive barbs as historical favoritism is recalled.", "Midpoint: The discovered secret is revealed over dinner, shattering the family's manufactured image.", "All Hope Lost: The family head breaks down, admitting the secret was used to control everyone for decades.", "Plot Point 2: The siblings realize their shared resentment was manufactured by an impossible standard."],
        actIII: ["Climax: An open, unfiltered confrontation where all members voice their genuine grievances without politeness.", "Resolution: The storm clears; the family departs without a fairy-tale fix, but with clear boundaries and mutual respect."],
      }},
    ],
  },
  {
    genre: "Reality TV",
    templates: [
      { name: "The Doomed Production", arc: "Classic Arc", acts: {
        actI: ["Status Quo: A documentary crew follows an egotistical creator trying to launch a late-night show.", "Inciting Incident: Executive funding requires producing a live pilot broadcast within 48 hours.", "Plot Point 1: The creator hires a cheap, eccentric crew of amateurs to meet the deadline."],
        actII: ["Rising Action: On-camera meltdowns, broken teleprompters, and clashes between the host and head of security.", "Midpoint: Leaked disastrous rehearsal footage goes viral, turning the production into a national joke.", "All Hope Lost: The main celebrity guest walks out ten minutes before airtime; the studio power cuts out.", "Plot Point 2: The creator gives an honest confessional and decides to broadcast the unscripted chaos live."],
        actIII: ["Climax: The live broadcast goes out with improvised segments, technical errors, and raw, accidental humor.", "Resolution: The pilot becomes a cult sensation for its honesty, securing a full series pickup."],
      }},
      { name: "The Meaningless Competition", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: A community of intensely competitive eccentrics obsess over a trivial local title.", "Inciting Incident: The long-time champion retires, leaving the trophy open to new competitors.", "Plot Point 1: Contenders enter and begin disproportionate, obsessive training regimens."],
        actII: ["Rising Action: Petty sabotage, absurd psychological warfare, and intense personal posturing during preliminary rounds.", "Midpoint: The top two rivals advance to the finals after executing ridiculous routines.", "All Hope Lost: An audit reveals every finalist broke minor rules, leading to total disqualification.", "Plot Point 2: The rivals realize their self-worth was tied to an inexpensive, meaningless award."],
        actIII: ["Climax: The finalists stage an unsanctioned, private showdown purely for personal closure.", "Resolution: A mutual tie brings genuine satisfaction; they leave the trophy behind in the dirt."],
      }},
    ],
  },
  {
    genre: "Sci-Fi",
    templates: [
      { name: "The Cosmic Anomaly", arc: "Classic Arc", acts: {
        actI: ["Status Quo: A deep-space scientific outpost monitors a seemingly empty sector of space.", "Inciting Incident: Deep sensors detect a non-linear cosmic/digital anomaly expanding toward the station.", "Plot Point 1: Communications are severed; the research team must study and neutralize it alone."],
        actII: ["Rising Action: The anomaly distorts time, shifts physical geometry, and induces auditory hallucinations.", "Midpoint: An EVA scan reveals the anomaly is a sentient entity attempting to make contact.", "All Hope Lost: Automated containment systems fail; the anomaly threatens to consume the station's core.", "Plot Point 2: The lead scientist realizes physical containment is impossible and that cognitive synthesis is needed."],
        actIII: ["Climax: The scientist merges their consciousness with the anomaly to safely guide it away from the station.", "Resolution: The anomaly disperses peacefully; the surviving crew witnesses a new star form from the event."],
      }},
      { name: "The Dystopian Glitch", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: A data processor works quietly inside a gleaming, hyper-regulated simulated metropolis.", "Inciting Incident: The worker notices a recurring physical glitch in the city architecture.", "Plot Point 1: The protagonist follows the glitch and joins an underground movement of awakeners."],
        actII: ["Rising Action: Learning the city is a computational construct; evading automated security hunter-drones.", "Midpoint: The rebels access the mainframe infrastructure, viewing the server towers powering the simulation.", "All Hope Lost: The rebellion leader is captured and reprogrammed; the protagonist is cornered in the central server.", "Plot Point 2: The protagonist realizes the simulation cannot resolve logical paradoxes and inputs self-contradictory code."],
        actIII: ["Climax: The logic loop cascades through the system, dissolving the artificial sky and walls.", "Resolution: The simulation falls, leaving humanity to step out into a real, forgotten world."],
      }},
    ],
  },
  {
    genre: "Anime",
    templates: [
      { name: "The Standalone Epic", arc: "Classic Arc", acts: {
        actI: ["Status Quo: The hero and companions arrive at an isolated floating sanctuary during an annual festival.", "Inciting Incident: An ancient sealed warlord awakens, seizing the island's core to power an ancient engine.", "Plot Point 1: The island is enclosed in a barrier, cutting off outside aid; the heroes split up to disable power conduits."],
        actII: ["Rising Action: Battles against the warlord's lieutenants across varied magical environments.", "Midpoint: The protagonist confronts the warlord directly and is decisively beaten, their weapon destroyed.", "All Hope Lost: The super-engine reaches critical charge; the island begins falling from the sky.", "Plot Point 2: The island's ancestral spirit grants the hero a temporary power boost fueled by their inner resolve."],
        actIII: ["Climax: A high-altitude aerial battle where the hero unleashes their awakened form and shatters the engine.", "Resolution: The sanctuary stabilizes; the companions celebrate with the liberated locals and set sail again."],
      }},
      { name: "The Surreal Crossover", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: A lonely youth wanders away from their rural hometown during a seasonal festival.", "Inciting Incident: Crossing an ancient shrine bridge, they inadvertently step into a vibrant spirit realm.", "Plot Point 1: The gateway closes at dusk; to survive, the youth takes a service job at a mystical bathhouse."],
        actII: ["Rising Action: The youth learns the metaphysical rules of the realm while assisting supernatural patrons.", "Midpoint: They befriend a cursed spirit who is losing their identity to spiritual corruption.", "All Hope Lost: The spirit rampages through the bathhouse; the youth's memories of their human life begin to fade.", "Plot Point 2: Remembering their true name restores the youth's clarity, allowing them to purify the spirit."],
        actIII: ["Climax: A final trial set by the realm's ruler where the youth chooses empathy over magic to win freedom.", "Resolution: The bridge reopens; the youth returns to the human world, quiet and mature, with subtle proof of their adventure."],
      }},
    ],
  },
  {
    genre: "Fantasy",
    templates: [
      { name: "The Hero's Journey", arc: "Classic Arc", acts: {
        actI: ["Status Quo: A humble artisan lives quietly in the shadow of a fallen empire.", "Inciting Incident: A dying knight entrusts them with an ancient artifact, warning of the Dark Lord's return.", "Plot Point 1: Shadow-beasts attack the village; the artisan flees, committing to deliver the relic to the Sun Citadel."],
        actII: ["Rising Action: The artisan recruits a sellsword and an outcast mage; they overcome wilderness trials and ambushes.", "Midpoint: The party retrieves a necessary focus stone from a sunken temple, forming a tight bond.", "All Hope Lost: An ambush at the Citadel gates leaves the mentor dead and the artifact in enemy hands.", "Plot Point 2: The artisan realizes true strength lies in the unity of the realm's peoples, not the artifact alone."],
        actIII: ["Climax: Infiltration of the Dark Citadel, using coordinated tactics to destroy the artifact and the Dark Lord.", "Resolution: Reconstruction begins under an egalitarian council; the artisan returns home as a leader."],
      }},
      { name: "The Magical Heist", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: A crew of cynical outcasts operate in the criminal underbelly of a magical city.", "Inciting Incident: A mysterious patron hires them to steal back a dangerous relic held in the Arch-Mage's fortress.", "Plot Point 1: The crew accepts and starts mapping the fortress's elemental wards and patrol patterns."],
        actII: ["Rising Action: Infiltrating the fortress during a solstice gala, bypassing magical security with counter-spells.", "Midpoint: Breaching the vault, they discover the relic is actively sustaining the city's protective barrier.", "All Hope Lost: The patron triggers alarms and locks the crew inside with the city inquisitors.", "Plot Point 2: The crew decides to replace the relic with an enchanted decoy and expose the patron's scheme."],
        actIII: ["Climax: A chase across the city's spires, using illusions to trap the patron and protect the barrier.", "Resolution: The barrier holds; the crew keeps the patron's deposit and slips back into the shadows."],
      }},
    ],
  },
  {
    genre: "Family",
    templates: [
      { name: "The Magical Secret", arc: "Classic Arc", acts: {
        actI: ["Status Quo: Siblings struggle to adjust to a new town while their parents work long hours.", "Inciting Incident: They discover a lost baby mythical creature in the nearby forest.", "Plot Point 1: The kids sneak the creature home, promising to keep it hidden and find its family."],
        actII: ["Rising Action: Comedic close calls as the creature's magical antics cause chaos around the house and school.", "Midpoint: A local government inspector spots energy anomalies and begins investigating the neighborhood.", "All Hope Lost: The creature falls ill away from its habitat; the parents discover the mess and call authorities.", "Plot Point 2: The kids explain the stakes; the parents believe them and step up to protect the family."],
        actIII: ["Climax: A neighborhood chase in the family minivan to outrun government agents and reach the forest portal.", "Resolution: The creature returns home safely; the family bond is renewed, with parents reprioritizing family time."],
      }},
      { name: "The Perspective Swap", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: An overworked parent and a rebellious teen constantly argue over household duties.", "Inciting Incident: An argument over an antique relic triggers an overnight body swap.", "Plot Point 1: Unable to reverse it immediately, both must attend the other's critical day (corporate pitch / final exams)."],
        actII: ["Rising Action: Disastrous attempts to navigate high school cliques and boardroom negotiations.", "Midpoint: Each manages a small victory using the other's perspective, gaining empathy for their daily burdens.", "All Hope Lost: The teen freezes during the pitch; the parent ruins a friendship at school.", "Plot Point 2: They team up, coaching each other through the final challenges with newfound respect."],
        actIII: ["Climax: A joint presentation where they finish each other's ideas, saving both the pitch and school standing.", "Resolution: The swap reverses; they return to their lives with deep mutual understanding."],
      }},
    ],
  },
  {
    genre: "Western",
    templates: [
      { name: "The Vengeance Trail", arc: "Classic Arc", acts: {
        actI: ["Status Quo: A retired gunslinger lives a quiet farming life in an isolated valley.", "Inciting Incident: An outlaw gang burns the homestead, leaving the gunslinger for dead.", "Plot Point 1: The protagonist retrieves their revolvers and sets out across the frontier for retribution."],
        actII: ["Rising Action: Tracking the gang through lawless towns, eliminating lieutenants one by one.", "Midpoint: Meeting an orphan reveals the gunslinger's own past violence originally sparked this feud.", "All Hope Lost: Ambushed in a desert canyon; wounded, without water or ammunition.", "Plot Point 2: They realize revenge won't heal the past, but stopping the gang is necessary to protect the valley."],
        actIII: ["Climax: A tense shootout in the gang's mountain stronghold, concluding with a final duel against the leader.", "Resolution: The gang is broken; the gunslinger hands their badge to a deputy and rides off into the sunset."],
      }},
      { name: "The Town Defense", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: A quiet mining community discovers a rich vein, drawing the attention of a ruthless land baron.", "Inciting Incident: The baron demands the town sell their land or face an incoming mercenary army.", "Plot Point 1: The town hires an aging, cynical drifter to organize a defense."],
        actII: ["Rising Action: The drifter trains storekeepers and farmers to handle rifles and construct fortifications.", "Midpoint: A skirmish repels the baron's advance scouts, giving the townsfolk a false sense of security.", "All Hope Lost: Half the townspeople panic and attempt to flee as the main mercenary force surrounds the town.", "Plot Point 2: The drifter adapts the plan to use mining explosives and natural bottlenecks instead of an open shootout."],
        actIII: ["Climax: The mercenaries charge the main street, only to be funneled into mining traps and crossfires, routing the force.", "Resolution: The baron is arrested; the townspeople stand self-sufficient, while the drifter declines reward and rides on."],
      }},
    ],
  },
  {
    genre: "Crime",
    templates: [
      { name: "The Hardboiled Noir", arc: "Classic Arc", acts: {
        actI: ["Status Quo: A cynical private investigator handles low-rent cases in a corrupt, rain-slicked city.", "Inciting Incident: A wealthy socialite hires the detective to locate her missing sister.", "Plot Point 1: The detective inspects the sister's ransacked apartment, uncovering connections to city hall."],
        actII: ["Rising Action: Witnesses are silenced; dirty cops warn the detective to drop the inquiry.", "Midpoint: The detective discovers the sister was killed after uncovering evidence of institutional graft.", "All Hope Lost: The PI is framed for the murder, assaulted by corrupt officers, and dropped by the client.", "Plot Point 2: An honest beat cop helps the PI escape custody to secure the original blackmail evidence."],
        actIII: ["Climax: A confrontation at an elite private club where the PI tricks the corrupt leaders into exposing their scheme on record.", "Resolution: Indictments are handed down, but the PI returns to their modest office, realistic about the city's nature."],
      }},
      { name: "The Perfect Crime", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: A master thief plans a final score: robbing the secure vault of a corrupt casino mogul.", "Inciting Incident: The thief recruits a crew of specialists: hacker, acrobat, demolitions expert, and an insider.", "Plot Point 1: The team initiates the heist during a televised championship boxing event."],
        actII: ["Rising Action: Navigating biometric sensors and security patrols through synchronized timing.", "Midpoint: Entering the vault, they discover the cash was moved and replaced with tracking markers.", "All Hope Lost: Federal agents surround the building; the insider reveals themselves as undercover and arrests the crew.", "Plot Point 2: Flashbacks reveal the arrest was staged—the crew used the “agents” to escort the real loot out via evidence vans."],
        actIII: ["Climax: The casino mogul is detained for financial fraud while the crew reconvenes at a private airfield.", "Resolution: The team divides their earnings on a tropical beach, having pulled off the heist in plain sight."],
      }},
    ],
  },
  {
    genre: "Action & Adventure",
    templates: [
      { name: "The Global Race", arc: "Classic Arc", acts: {
        actI: ["Status Quo: A top operative lives off the grid following a compromised mission.", "Inciting Incident: A rogue syndicate steals the launch codes for a particle-beam satellite.", "Plot Point 1: The operative is reinstated and dispatched to track the physical control key across global markets."],
        actII: ["Rising Action: High-speed vehicle pursuits through city streets, rooftop chases, and hand-to-hand combat.", "Midpoint: The operative secures the key at a mountain facility, but the syndicate captures their handler.", "All Hope Lost: A trade goes wrong; the key is lost, and the operative is stranded in an oceanic trench.", "Plot Point 2: The operative survives using field gear and tracks the satellite signal to an Arctic launch base."],
        actIII: ["Climax: Infiltration of the Arctic base, engaging in a final duel to abort the satellite firing with seconds to spare.", "Resolution: The platform is neutralized; the operative officially retires, vanishing back off the grid."],
      }},
      { name: "The Die Hard Scenario", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: An off-duty cop visits their estranged spouse at an executive skyscraper party.", "Inciting Incident: Paramilitary mercenaries seize the building, cutting communications and taking hostages.", "Plot Point 1: The cop slips into the elevator shafts, armed only with a sidearm and a radio."],
        actII: ["Rising Action: Methodically taking down isolated patrol units, gathering equipment, and delaying the heist.", "Midpoint: The cop establishes radio contact with an outside officer, gaining tactical support.", "All Hope Lost: The mercenary leader deduces the cop's identity and singles out the spouse as a primary hostage.", "Plot Point 2: The mercenaries rig the rooftop with explosives; the cop uses a fire hose to escape the blast."],
        actIII: ["Climax: A final shootout in the executive suite, using concealed weapons to defeat the leader and save the spouse.", "Resolution: Hostages are freed; the cop and spouse reconcile as emergency services arrive."],
      }},
    ],
  },
  {
    genre: "Romance",
    templates: [
      { name: "Enemies to Lovers", arc: "Classic Arc", acts: {
        actI: ["Status Quo: Two rival architects compete fiercely for a major municipal design contract.", "Inciting Incident: The city board requires a single joint proposal for either firm to be considered.", "Plot Point 1: Forced into a shared office, they establish ground rules for a reluctant partnership."],
        actII: ["Rising Action: Professional friction turns into creative respect during late-night drafting sessions.", "Midpoint: A site-visit trip leads to a breakthrough dinner and their first real romantic spark.", "All Hope Lost: An old cutthroat memo is leaked, making it look like one partner used the other for intellectual property.", "Plot Point 2: Both retreat behind emotional walls, preparing uninspired individual proposals."],
        actIII: ["Climax: At the city council presentation, one lead abandons their solo pitch to publicly defend their partner's vision and declare their feelings.", "Resolution: They win the contract together and step out into the city for a romantic embrace."],
      }},
      { name: "The Second Chance", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: Former college sweethearts live separate, successful, but guarded lives in different cities.", "Inciting Incident: The mutual wedding of their best friends brings them back to their hometown for a week.", "Plot Point 1: Assigned as Maid of Honor and Best Man, they are forced into daily wedding coordination."],
        actII: ["Rising Action: Familiar humor resurfaces; visiting old landmarks brings up memories of why they fell in love.", "Midpoint: A quiet lakeside talk reveals that career timing, rather than a lack of love, caused their original split.", "All Hope Lost: The reception ends; morning flights to opposite coasts create an immediate, painful deadline.", "Plot Point 2: One realizes that waiting for ideal circumstances is an excuse, racing to the departure gate."],
        actIII: ["Climax: Intercepting the other at the boarding gate, offering a sincere promise to build a life together.", "Resolution: They board the plane together, ready to commit to their shared future."],
      }},
    ],
  },
  {
    genre: "Horror",
    templates: [
      { name: "The Cursed Media", arc: "Classic Arc", acts: {
        actI: ["Status Quo: An archivist works in an isolated historical society basement processing donated media.", "Inciting Incident: Discovering an uncataloged 1970s Super 8 film, they project it and view an occult ritual.", "Plot Point 1: Auditory distortions and video static begin manifesting in the archivist's home."],
        actII: ["Rising Action: Researching the footage reveals every participant disappeared within a week of viewing.", "Midpoint: A film historian is consulted, only to be attacked by an unseen force during the call.", "All Hope Lost: Paranoia mounts; reflections warp, and the entity begins physically appearing in shadows.", "Plot Point 2: The archivist realizes the entity spreads through observation and decides to incinerate all reels."],
        actIII: ["Climax: A confrontation in the archive lab as the film manifests physically; the archivist ignites the vault.", "Resolution: The archivist escapes at dawn, but static flickering across the car radio hints that the curse remains."],
      }},
      { name: "The Survival Cabin", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: A group of estranged childhood friends rent an off-grid cabin for a reunion weekend.", "Inciting Incident: Cut power cables and strange markings outside indicate a threat in the surrounding woods.", "Plot Point 1: When one friend steps outside and is dragged away, the survivors barricade the doors."],
        actII: ["Rising Action: A predatory creature tests the cabin's perimeter, dismantling windows and doors.", "Midpoint: The group injures the creature with a hunting rifle, but infighting breaks out over who unlatched the door.", "All Hope Lost: The creature breaches the roof; two friends are lost, and the survivors are forced into the cellar.", "Plot Point 2: The survivors realize the creature hunts by tracking sound and adrenaline, resolving to remain quiet and set a trap."],
        actIII: ["Climax: Luring the creature into the basement fuel bay, the final survivors detonate the propane tanks.", "Resolution: A lone, injured survivor emerges onto the main highway at sunrise as sirens approach."],
      }},
    ],
  },
  {
    genre: "Live Action",
    templates: [
      { name: "The Grounded Origin", arc: "Classic Arc", acts: {
        actI: ["Status Quo: An iconic animated hero is introduced as a grounded, anxious young adult facing urban pressures.", "Inciting Incident: A dangerous industrial incident grants them raw, volatile physical powers.", "Plot Point 1: Pursued by corporate security forces, the protagonist goes into hiding to understand their abilities."],
        actII: ["Rising Action: Testing their abilities in back alleys, dealing with the physical strain and real-world consequences.", "Midpoint: Intervening in a public emergency reveals their presence to an ideologically opposed rival.", "All Hope Lost: Collateral damage turns public sentiment hostile; the rival abducts someone close to the hero.", "Plot Point 2: The hero accepts their responsibility, constructing their signature grounded suit and equipment."],
        actIII: ["Climax: A grounded showdown at a city landmark, defeating the rival through tactical skill rather than raw power.", "Resolution: The protagonist accepts their dual life, watching over the city skyline from above."],
      }},
      { name: "The Legacy Sequel", arc: "Subverted Arc", acts: {
        actI: ["Status Quo: Decades after legendary events, the original heroes are retired, cynical, or living in seclusion.", "Inciting Incident: A modern technological or cosmic threat emerges, rendering standard defense systems obsolete.", "Plot Point 1: A young, determined prodigy tracks down the retired veteran, seeking training and guidance."],
        actII: ["Rising Action: Clashing philosophies between classic physical intuition and modern analytical tactics.", "Midpoint: An initial skirmish ends in defeat, proving the new villain has studied the veteran's historical playbook.", "All Hope Lost: The veteran is captured; the younger team members lose confidence and consider retreating.", "Plot Point 2: The prodigy combines the veteran's foundational wisdom with modern tactical innovations."],
        actIII: ["Climax: A multi-generational assault on the villain's base, where the veteran creates an opening for the prodigy to land the decisive blow.", "Resolution: The veteran steps back for good, passing the symbolic mantle to the new generation."],
      }},
    ],
  },
];

export function getTvEngine(genre: string | null | undefined): TvGenreEngine | null {
  return TV_GENRE_ENGINES.find((g) => g.genre === genre) ?? null;
}

export function getFilmSuite(genre: string | null | undefined): FilmGenreSuite | null {
  return FILM_GENRE_SUITES.find((g) => g.genre === genre) ?? null;
}

// --- Rendered brainstorm block, injected into the Write Script prompt -------

export function renderTvEngineBrief(engine: TvGenreEngine): string {
  const beats = engine.beats.map((b, i) => `${i + 1}. ${b.label}: ${b.description}`).join("\n");
  const templates = engine.templates
    .map((t) => `Template — ${t.name} (${t.format}):\n  Concept: ${t.concept}\n  Mechanics: ${t.mechanics}`)
    .join("\n\n");
  return [
    `GENRE: ${engine.genre} — ${engine.engineName}`,
    `Core engine: ${engine.coreEngine}`,
    "",
    "5-Beat Timeline:",
    beats,
    "",
    "Specialized templates (pick one or blend, or ignore and go original):",
    templates,
  ].join("\n");
}

export function renderFilmTemplateBrief(suite: FilmGenreSuite, templateName?: string): string {
  const templates = templateName ? suite.templates.filter((t) => t.name === templateName) : suite.templates;
  const rendered = templates
    .map((t) => {
      const acts = [
        `Act I (Setup & Catalyst):\n  - ${t.acts.actI.join("\n  - ")}`,
        `Act II (Confrontation & Escalation):\n  - ${t.acts.actII.join("\n  - ")}`,
        `Act III (Resolution & Climax):\n  - ${t.acts.actIII.join("\n  - ")}`,
      ].join("\n");
      return `Template — ${t.name} (${t.arc}):\n${acts}`;
    })
    .join("\n\n");
  return [`GENRE: ${suite.genre} — Feature Film Three-Act Suite`, "", rendered].join("\n");
}
