import { execFileSync } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceDir = join(root, "video_ref_nikulina");
const reviewDir = join(root, "scratch_check", "broll_master_review");

const R = (id, start, end, content, people, action, setting, mood, functions, quality) => ({
  RANGE_ID: id,
  START: start,
  END: end,
  OBSERVED_CONTENT: content,
  PEOPLE_VISIBLE: people,
  ACTION: action,
  SETTING: setting,
  MOOD: mood,
  EDITORIAL_FUNCTION: functions,
  QUALITY_NOTES: quality,
});

const rangesByFile = {
  "IMG_0195.MOV": [
    R("BR001", 0.2, 2.8, "A woman offers/holds a bouquet while a man faces her; both smile in a modern kitchen.", "Two adults; woman and man", "Bouquet exchange and warm conversation", "Modern home kitchen", "Warm, playful, domestic", ["INTIMACY", "RELATIONSHIP_CHEMISTRY", "PLEASURE"], "Stable portrait wide shot; faces readable but subjects occupy lower half of frame."),
    R("BR002", 3.0, 5.8, "The couple leans closer while talking beside the kitchen counter.", "Two adults", "Close conversation and affectionate lean-in", "Modern home kitchen", "Tender, anticipatory", ["INTIMACY", "RELATIONSHIP_CHEMISTRY"], "Continuous static framing; good short reaction insert."),
    R("BR003", 6.2, 9.1, "The man lifts/holds the woman in a full-body embrace beside the counter.", "Two adults", "Lift and embrace", "Modern home kitchen", "Joyful, physically affectionate", ["INTIMACY", "RELATIONSHIP_CHEMISTRY", "PLEASURE"], "Clear action silhouette; man's back briefly dominates frame."),
    R("BR004", 9.3, 13.7, "The woman sits on the counter with a wine glass while the man prepares food nearby.", "Two adults", "Cooking, sitting together, casual drinking", "Modern home kitchen", "Relaxed, domestic, adult", ["INTIMACY", "PACE_RESET", "RELATIONSHIP_CHEMISTRY"], "Low-key natural action; useful as mature everyday-life texture."),
    R("BR005", 14.0, 18.2, "The couple raises wine glasses, moves face-to-face, and approaches a kiss.", "Two adults", "Toast and near-kiss", "Modern home kitchen", "Celebratory, intimate", ["PLEASURE", "INTIMACY", "RELATIONSHIP_CHEMISTRY"], "Strong ending action; leave a few frames before source end when extracting."),
  ],
  "IMG_0398.MOV": [
    R("BR006", 0.0, 1.8, "Camera reveals an ornate painted ceiling, chandeliers, red walls, and dark wood.", "Visitors only at frame edge", "Upward architectural reveal", "Historic gallery or ceremonial interior", "Awe, grandeur, contemplation", ["REFLECTION", "AUTHORITY", "VISUAL_METAPHOR"], "Handheld tilt with some blur; strongest as a sub-1.5-second establishing shot."),
    R("BR007", 2.0, 9.8, "A dressed-up couple stands close together and looks upward around the ornate room.", "Two principal adults plus background visitors", "Shared looking and quiet reaction", "Historic gallery or ceremonial interior", "Curious, reflective, cultured", ["RELATIONSHIP_CHEMISTRY", "REFLECTION", "CLUB_BRAND"], "Dutch angle and wide phone lens; background foot traffic is visible."),
    R("BR008", 10.0, 14.6, "Camera leaves the couple and sweeps back to the ceiling and full red-walled room.", "Background visitors", "Room and ceiling reveal", "Historic gallery or ceremonial interior", "Expansive, reflective", ["REFLECTION", "PACE_RESET", "TRANSITION_MASK"], "Motion blur at the start of the tilt; settle on later ceiling frames."),
  ],
  "IMG_0409.MOV": [
    R("BR009", 0.3, 5.4, "Downward view of two people's legs and shoes walking together on wet paving.", "Two adults visible from the knees down", "Walking in step", "Rainy city pavement", "Grounded, kinetic, intimate", ["GROUNDING", "MOVEMENT", "RELATIONSHIP_CHEMISTRY"], "Handheld and intentionally rough; strongest 1-2-second portions have both sets of feet visible."),
    R("BR010", 6.0, 10.8, "Smiling couple walks under a black umbrella in a moving selfie composition.", "Two adults", "Walking, laughing, sharing umbrella", "Rainy city street", "Light, playful, connected", ["RELATIONSHIP_CHEMISTRY", "MOVEMENT", "PLEASURE"], "Wide-angle phone motion and tilted horizon; faces remain readable."),
    R("BR011", 11.0, 14.2, "The couple leans into one another under the umbrella, moving into a nuzzle/near-kiss.", "Two adults", "Affectionate lean-in", "Rainy city street", "Tender, spontaneous", ["INTIMACY", "RELATIONSHIP_CHEMISTRY"], "Close selfie framing; umbrella dominates upper frame."),
    R("BR012", 14.3, 16.5, "They pull back smiling and continue moving together.", "Two adults", "Shared smile while walking", "Rainy city street", "Joyful, easy", ["PLEASURE", "MOVEMENT", "PACE_RESET"], "Good reaction beat; avoid the whip to pavement after 16.5 s."),
  ],
  "IMG_1769.MOV": [
    R("BR013", 0.3, 4.8, "A woman in a black evening dress and gloves faces camera at a restaurant table, adjusting her hair.", "One adult woman", "Direct gaze and composed hair adjustment", "Dark mirrored restaurant", "Controlled, elegant, self-possessed", ["AUTHORITY", "CLUB_BRAND", "REFLECTION"], "Slow-motion feel; warm low light, sharp face, tableware at bottom edge."),
    R("BR014", 5.0, 10.8, "The woman relaxes into expressive conversation, resting her chin near a gloved hand.", "One adult woman", "Talking and gesturing", "Dark mirrored restaurant", "Intimate, candid, confident", ["VULNERABILITY", "AUTHORITY", "CLUB_BRAND"], "Strong facial micro-expression; visually resembles a premium portrait interview."),
    R("BR015", 11.0, 16.1, "Her expression opens into a broad smile and laughter toward the camera/operator.", "One adult woman", "Smiling and laughing", "Dark mirrored restaurant", "Warm, joyful, inviting", ["PLEASURE", "CLUB_BRAND", "PACE_RESET"], "Cleanest emotional payoff in the file; slight hand movement near end."),
  ],
  "IMG_1770.MOV": [
    R("BR016", 0.3, 3.2, "A seated couple settles into frame shoulder-to-shoulder at a set restaurant table.", "Two adults", "Settling and posing together", "Dark mirrored restaurant", "Warm, composed", ["RELATIONSHIP_CHEMISTRY", "CLUB_BRAND"], "Stable close portrait; plates and cutlery visible."),
    R("BR017", 3.3, 8.2, "The woman wraps an arm around the man; they exchange close looks and smiles.", "Two adults", "Embrace, eye contact, smiling", "Dark mirrored restaurant", "Affectionate, playful", ["INTIMACY", "RELATIONSHIP_CHEMISTRY"], "Strong two-face framing and genuine reactions."),
    R("BR018", 8.3, 12.2, "The couple moves into a playful nuzzle/near-kiss and laughs.", "Two adults", "Near-kiss and laughter", "Dark mirrored restaurant", "Flirtatious, pleasurable", ["INTIMACY", "PLEASURE", "RELATIONSHIP_CHEMISTRY"], "Highly readable action; avoid implying consent claims with this image alone."),
    R("BR019", 12.3, 20.5, "They hold sustained eye contact and converse at very close distance.", "Two adults", "Quiet conversation and mutual gaze", "Dark mirrored restaurant", "Attentive, intimate, thoughtful", ["RELATIONSHIP_CHEMISTRY", "REFLECTION", "INTIMACY"], "Low movement but strong faces; suited to short overlays."),
    R("BR020", 21.0, 27.8, "Animated touch and conversation build into shared laughter.", "Two adults", "Gesturing, touching shoulder, laughing", "Dark mirrored restaurant", "Alive, mutual, joyful", ["RELATIONSHIP_CHEMISTRY", "PLEASURE"], "One of the strongest non-kiss chemistry ranges; both reactions visible."),
    R("BR021", 28.0, 38.8, "The woman rests against the man; the couple cuddles and alternates between camera and each other.", "Two adults", "Cuddling and leaning on shoulder", "Dark mirrored restaurant", "Secure, tender, calm", ["INTIMACY", "RELATIONSHIP_CHEMISTRY", "VULNERABILITY"], "Sustained usable action with minimal camera movement."),
    R("BR022", 39.0, 48.1, "They turn back toward each other and end in another playful, laughing exchange.", "Two adults", "Conversation, affectionate looks, laughter", "Dark mirrored restaurant", "Warm, spontaneous", ["RELATIONSHIP_CHEMISTRY", "PLEASURE", "PACE_RESET"], "Good natural ending; preserve headroom before file end."),
  ],
  "IMG_1779.MP4": [
    R("BR023", 0.2, 5.4, "Mirrored telephoto view of the couple in a close embrace; the woman cups the man's face.", "Two adults plus mirror reflections", "Face touch and embrace", "Golden mirrored bar/restaurant", "Sensual, intimate", ["INTIMACY", "RELATIONSHIP_CHEMISTRY"], "Warm but heavily yellow; decorative vertical edge partly occludes frame."),
    R("BR024", 5.5, 10.4, "The man lowers his head into the woman's chest/neck area while they remain embraced.", "Two adults plus reflections", "Deep sensual embrace", "Golden mirrored bar/restaurant", "Erotic, private, vulnerable", ["INTIMACY", "VULNERABILITY"], "Potentially too sexually explicit for broad use; crop and platform context require approval."),
    R("BR025", 10.5, 14.6, "They lift their faces back toward one another, hands still at cheek and waist.", "Two adults plus reflections", "Near-kiss and face touch", "Golden mirrored bar/restaurant", "Tender, charged", ["INTIMACY", "RELATIONSHIP_CHEMISTRY"], "Strong close silhouette; mirrored duplicates may read as busy under subtitles."),
  ],
  "IMG_1784.MP4": [
    R("BR026", 0.2, 8.7, "A sustained full-body embrace is seen through mirrored vertical rails, mostly from behind the man.", "Two adults", "Holding a long embrace", "Golden mirrored corridor/bar", "Secure, intimate, contained", ["INTIMACY", "RELATIONSHIP_CHEMISTRY", "TRANSITION_MASK"], "Stable and highly usable as a 1-second splice mask; becomes occluded near the end."),
  ],
  "IMG_1785.MP4": [
    R("BR027", 0.0, 4.8, "Mirrored corridor establishes as staff/background figures pass and the principal woman enters deeper in frame.", "Principal woman distant; background staff/visitors", "Entrance and corridor reveal", "Warm mirrored corridor", "Anticipatory, luxurious", ["CLUB_BRAND", "TRANSITION_MASK", "PACE_RESET"], "Early foreground traffic and soft focus; use only a settled subsection."),
    R("BR028", 5.0, 10.5, "Woman in a backless black dress turns toward camera holding a martini and makes direct eye contact.", "One adult woman", "Turn, pose, direct gaze", "Warm mirrored corridor", "Confident, magnetic, self-possessed", ["AUTHORITY", "CLUB_BRAND", "PLEASURE"], "Cinematic shallow depth; strong portrait composition."),
    R("BR029", 10.6, 18.5, "She rotates into profile/back view, raises the martini, and holds a poised stance.", "One adult woman", "Slow turn and drink pose", "Warm mirrored corridor", "Elegant, reflective, sensual", ["REFLECTION", "PLEASURE", "CLUB_BRAND"], "Very polished but fashion-coded; avoid over abstract psychological claims."),
    R("BR030", 18.6, 26.5, "The woman touches her hair, tips her head, and turns back with a small smile.", "One adult woman", "Hair touch, head turn, smile", "Warm mirrored corridor", "Playful, self-aware", ["PLEASURE", "AUTHORITY", "PACE_RESET"], "Excellent micro-actions; background bokeh supports subtitles."),
    R("BR031", 27.0, 30.5, "Camera whips away into corridor lights and reflective abstract blur.", "No clearly readable person", "Fast pan/defocus", "Mirrored corridor", "Disorienting, transitional", ["TRANSITION_MASK", "VISUAL_METAPHOR"], "Intentionally blurred; use only as a very short transition, never as representational footage."),
  ],
  "IMG_1786.MP4": [
    R("BR032", 0.2, 5.0, "Woman turns into a closer portrait with martini and direct gaze.", "One adult woman", "Turn toward camera and pose", "Warm mirrored corridor/bar", "Confident, controlled", ["AUTHORITY", "CLUB_BRAND", "PLEASURE"], "Closer than IMG_1785; clean face and glass highlights."),
    R("BR033", 5.1, 14.5, "She presents profile and back while slowly lifting the martini.", "One adult woman", "Slow profile turn and sip setup", "Warm mirrored corridor/bar", "Elegant, sensual, reflective", ["REFLECTION", "PLEASURE", "CLUB_BRAND"], "Sustained slow action; backless styling is prominent."),
    R("BR034", 14.6, 23.5, "The woman holds the glass near her face, looks down, and shifts posture gradually.", "One adult woman", "Contemplative drink pose", "Warm mirrored corridor/bar", "Introspective, poised", ["REFLECTION", "SOLITUDE", "PACE_RESET"], "Low motion makes a clean thought beat; fashion/editorial tone remains strong."),
    R("BR035", 23.6, 32.5, "She rotates back toward camera and settles into a direct, subtle smile.", "One adult woman", "Turn, eye contact, smile", "Warm mirrored corridor/bar", "Assured, inviting", ["AUTHORITY", "PLEASURE", "CLUB_BRAND"], "Strong final portrait with stable warm bokeh."),
    R("BR036", 32.6, 35.5, "She approaches/passes near the lens, leaving a partial close crop and open corridor.", "One adult woman, partially cropped", "Move past camera", "Warm mirrored corridor/bar", "Transitional, immediate", ["MOVEMENT", "TRANSITION_MASK"], "Partial body crop; useful only for a short wipe-like exit."),
  ],
  "IMG_1787.MOV": [
    R("BR037", 0.2, 8.0, "Two people hold hands in a dark car while rain and pedestrians are visible through the side window.", "Two adults represented mainly by clasped hands", "Holding hands during travel", "Back seat of car, rainy city", "Tender, uncertain, vulnerable", ["VULNERABILITY", "INTIMACY", "RELATIONSHIP_CHEMISTRY"], "Very dark lower frame; rain texture and hands remain legible."),
    R("BR038", 8.1, 17.0, "Clasped hands remain in foreground as graffiti, brake lights, and city movement slide past outside.", "Two adults represented by hands", "Sustained handhold during moving journey", "Back seat of car, rainy city", "Reflective, connected, in transit", ["REFLECTION", "MOVEMENT", "INTIMACY", "VISUAL_METAPHOR"], "Strong moving background; hands intermittently sink into shadow."),
    R("BR039", 17.1, 25.5, "Rain-streaked window and moving night lights dominate as the joined hands sit lower and darker.", "Hands partially visible; pedestrians outside", "Continuing ride through rain", "Back seat of car, rainy city", "Melancholic, contemplative", ["REFLECTION", "PACE_RESET", "TRANSITION_MASK"], "Low exposure; best for a brief atmospheric insert, not detail-dependent storytelling."),
  ],
  "IMG_1790.MP4": [
    R("BR040", 0.0, 2.5, "Empty mirrored corridor with a brief foreground/lens occlusion.", "No principal person clearly visible", "Corridor establishment", "Warm mirrored corridor", "Mysterious, anticipatory", ["TRANSITION_MASK", "CLUB_BRAND"], "Occlusion at about 2 s; choose a clean sub-second if used."),
    R("BR041", 2.8, 13.8, "Woman in a long black backless dress walks away from camera down a symmetrical corridor.", "One adult woman, seen from behind", "Walking away", "Warm mirrored corridor", "Independent, solitary, enigmatic", ["SOLITUDE", "MOVEMENT", "VISUAL_METAPHOR", "CLUB_BRAND"], "Strong centered geometry; backless fashion styling is prominent."),
    R("BR042", 14.0, 18.7, "At the far end she slows, turns sideways, and looks back toward camera.", "One adult woman", "Stop and look back", "Warm mirrored corridor", "Reflective, self-possessed", ["REFLECTION", "AUTHORITY", "VISUAL_METAPHOR"], "Subject is small but silhouette and turn read clearly."),
    R("BR043", 18.8, 20.8, "The woman exits frame, leaving the mirrored corridor empty.", "No principal person", "Exit and hold on empty space", "Warm mirrored corridor", "Afterthought, closure", ["PACE_RESET", "TRANSITION_MASK", "SOLITUDE"], "Dark and low-action; useful only as a short tail or card background."),
  ],
  "IMG_1791.MP4": [
    R("BR044", 0.1, 4.4, "Woman walks toward camera from the far end of the mirrored corridor, gesturing as she approaches.", "One adult woman", "Approach and expressive hand gesture", "Warm mirrored corridor", "Assertive, playful", ["AUTHORITY", "MOVEMENT", "CLUB_BRAND"], "Full-body symmetry and clean approach; dark exposure."),
    R("BR045", 4.5, 8.9, "She reaches medium/close framing with direct gaze and a broad smile.", "One adult woman", "Approach, eye contact, smile", "Warm mirrored corridor", "Warm, charismatic, confident", ["AUTHORITY", "PLEASURE", "CLUB_BRAND"], "Strong face but final frame becomes very close; leave an extraction handle."),
  ],
  "IMG_1792.MP4": [
    R("BR046", 0.0, 0.75, "Very brief rear view of woman walking down the mirrored corridor.", "One adult woman", "Walking away", "Warm mirrored corridor", "Stylized, transitional", ["MOVEMENT", "TRANSITION_MASK"], "Already edited into a sub-second montage shot; no extraction flexibility."),
    R("BR047", 0.75, 2.7, "Close detail of a suited man's hand, watch, and martini at the bar.", "One adult man, torso/hands only", "Holding martini at bar", "Warm luxury bar", "Composed, adult, polished", ["PLEASURE", "CLUB_BRAND", "PACE_RESET"], "Clean insert detail; face is mostly absent."),
    R("BR048", 2.7, 6.9, "Mirrored close embrace between the dressed-up couple.", "Two adults", "Embrace and face touch", "Golden mirrored bar", "Sensual, intimate", ["INTIMACY", "RELATIONSHIP_CHEMISTRY", "TRANSITION_MASK"], "Derived montage segment with hard cuts at both ends; overlaps imagery in IMG_1779."),
    R("BR049", 6.9, 8.8, "Woman seen from back/profile holding a martini in the mirrored corridor.", "One adult woman", "Drink pose", "Warm mirrored corridor/bar", "Elegant, reflective", ["REFLECTION", "PLEASURE", "CLUB_BRAND"], "Short pre-edited segment; overlaps imagery in IMG_1785/1786."),
    R("BR050", 8.8, 10.5, "Woman appears at distance in the mirrored corridor.", "One adult woman", "Corridor movement/pose", "Warm mirrored corridor", "Enigmatic, transitional", ["SOLITUDE", "TRANSITION_MASK"], "Short, dark montage beat."),
    R("BR051", 10.5, 14.0, "Return to the man's martini and suited torso at the bar.", "One adult man, torso/hands only", "Holding and lightly moving martini", "Warm luxury bar", "Measured, polished", ["PLEASURE", "CLUB_BRAND", "PACE_RESET"], "Stable detail; repeated visual from BR047."),
  ],
  "IMG_8706.MOV": [
    R("BR052", 0.2, 2.0, "Downward ultra-wide view of two people's shoes walking side by side on city pavement.", "Two adults visible from legs down", "Walking in step", "Daytime city street", "Grounded, purposeful", ["GROUNDING", "MOVEMENT", "RELATIONSHIP_CHEMISTRY"], "4K/60 source but strong fisheye; brief and shaky."),
    R("BR053", 2.1, 10.8, "Well-dressed couple walks arm-in-arm in a daytime city selfie, talking as buildings rise behind them.", "Two adults plus pedestrians", "Walking and talking arm-in-arm", "Daytime central-city street", "Connected, energetic, aspirational", ["MOVEMENT", "RELATIONSHIP_CHEMISTRY", "CLUB_BRAND"], "Highest resolution source; ultra-wide distortion and tilted horizon are pronounced."),
    R("BR054", 11.0, 20.5, "Their conversation breaks into laughter and eye contact while they continue walking.", "Two adults plus pedestrians", "Laughing and looking at each other", "Daytime central-city street", "Joyful, mutual, alive", ["PLEASURE", "RELATIONSHIP_CHEMISTRY", "MOVEMENT"], "Strong authentic interaction; camera bob from walking."),
    R("BR055", 20.6, 28.5, "The pair keeps moving arm-in-arm, trading affectionate glances before camera drops toward pavement.", "Two adults plus pedestrians", "Walking and exchanging glances", "Daytime central-city street", "Warm, companionable", ["RELATIONSHIP_CHEMISTRY", "MOVEMENT", "PACE_RESET"], "Good mid-range frames; avoid final camera drop after 28.5 s."),
  ],
};

const beat = (id, label, primary, alternative, interval, insert, duration, why, audio, keepFace) => ({
  BEAT_ID: id,
  SEMANTIC_BEAT: label,
  PRIMARY_CANDIDATE: primary,
  ALTERNATIVE_CANDIDATE: alternative,
  SOURCE_INTERVAL: interval,
  INSERT_POSITION: insert,
  RECOMMENDED_DURATION: duration,
  WHY_IT_FITS: why,
  WHAT_AUDIO_CONTINUES_UNDER_IT: audio,
  KEEP_FACE_INSTEAD: keepFace,
});

const reelMappings = [
  {
    reel: "R01",
    title: "Fear of Losing Yourself",
    overall: "ONE OPTIONAL INSERT. Use BR041 once; keep the contract, grounding payoff, and club offer on Evgeniia.",
    beats: [
      beat("R01-B1", "Adapting from fear until you lose yourself", "BR041 — IMG_1790.MP4", "BR037 — IMG_1787.MOV", "00:03.200–00:07.800", "Over the first concise occurrence of `теряешь себя`; do not cover the hook setup.", "1.2–1.5 s", "A solitary walk away is a readable metaphor for self-loss without inventing a literal conflict.", "Evgeniia: `...ты просто теряешь себя...`", "NO"),
      beat("R01-B2", "Clear contract, consent, and direction", "KEEP_TALKING_HEAD", "NONE — no visual can carry the precise ethical terms", "N/A", "Keep Evgeniia visible through the three-part list.", "0 s", "The face and exact words establish authority; lifestyle footage would turn specificity into mood.", "Evgeniia's full contract/consent/direction list.", "YES"),
      beat("R01-B3", "Standing on your ground / remaining in your center", "KEEP_TALKING_HEAD", "BR052 — IMG_8706.MOV", "N/A (backup 00:00.200–00:02.000)", "Keep the payoff and gestures visible; feet are backup only if a pace reset is needed.", "0 s recommended; backup 0.8–1.0 s", "The metaphor is already explicit and the speaker's embodiment is stronger than literal feet.", "Evgeniia: `стоять на своей земле... оставаясь в своём центре`.", "YES"),
      beat("R01-B4", "Club imprint / taking the feeling into life", "KEEP_TALKING_HEAD", "NONE", "N/A", "Keep host and any approved club overlay visible.", "0 s", "This is an authority and conversion beat, not a lifestyle montage beat.", "Evgeniia's club/imprint conclusion.", "YES"),
    ],
  },
  {
    reel: "R02",
    title: "A Connection Does Not Need a Future to Have Value",
    overall: "ONE OPTIONAL INSERT. Use mutual laughter rather than a kiss; keep consent and good-intentions language on faces.",
    beats: [
      beat("R02-B1", "Over-responsibility and knowing there is no shared future", "KEEP_TALKING_HEAD", "BR037 — IMG_1787.MOV", "N/A (backup 00:00.200–00:03.000)", "Keep the English question and Evgeniia/Andrew reaction visible.", "0 s", "The question is nuanced; rain/handholding risks prescribing a relationship story that is not stated.", "The retained English opening question.", "YES"),
      beat("R02-B2", "The unique pleasure/value created by two people together", "BR020 — IMG_1770.MOV", "BR054 — IMG_8706.MOV", "00:21.000–00:27.800", "Over `make their day, week, month better` or `the two of you together are completely unique`.", "1.5–2.0 s", "Mutual touch and laughter show chemistry without requiring a kiss or implying permanence.", "Andrew's English value/uniqueness sentence.", "NO"),
      beat("R02-B3", "Good intentions, consent, and not causing harm", "KEEP_TALKING_HEAD", "NONE — do not illustrate consent with generic intimacy", "N/A", "Keep Andrew speaking and Evgeniia reacting.", "0 s", "The ethical guardrail must remain attached to the speaking person; romantic imagery could falsely certify consent.", "Andrew's full consent/good-intentions clause.", "YES"),
      beat("R02-B4", "Entering lightly without pressure or expectations", "KEEP_TALKING_HEAD", "BR012 — IMG_0409.MOV", "N/A (backup 00:14.300–00:16.500)", "Use the source face for the landing; umbrella smile is only a fallback breath before it.", "0 s recommended; backup 0.8–1.0 s", "The clean spoken landing is stronger and avoids adding a second B-roll moment to an already long Reel.", "Andrew: `you enter into something lightly, without any expectations`.", "YES"),
    ],
  },
  {
    reel: "R03",
    title: "Dominance Is Not Control",
    overall: "KEEP_TALKING_HEAD throughout. Available intimacy footage would blur the distinction between regulation and control.",
    beats: [
      beat("R03-B1", "Calm, order, planning, and a stronger nervous system", "KEEP_TALKING_HEAD", "NONE", "N/A", "Evgeniia's descriptive list and gestures.", "0 s", "Her delivery earns the nervous-system conclusion; generic elegance cannot represent regulation honestly.", "Evgeniia's complete calm/structure list.", "YES"),
      beat("R03-B2", "A dominant does not absorb you or decide for you", "KEEP_TALKING_HEAD", "NONE", "N/A", "Keep the direct corrective statement on face.", "0 s", "This conceptual correction needs facial authority and readable captions.", "Evgeniia: `Доминант — это не тот...`", "YES"),
      beat("R03-B3", "Stabilization when you fall apart", "KEEP_TALKING_HEAD", "BR037 — IMG_1787.MOV (not recommended)", "N/A", "Keep the final payoff visible.", "0 s", "Handholding would sentimentalize a precise nervous-system claim; use the punch overlay instead.", "Evgeniia's stabilization payoff.", "YES"),
    ],
  },
  {
    reel: "R04",
    title: "Compromise vs Consensus",
    overall: "ONE OPTIONAL TRANSITION MASK after transcript approval. Do not cover the third-solution payoff.",
    beats: [
      beat("R04-B1", "Repeated compromise did not work", "KEEP_TALKING_HEAD", "NONE", "N/A", "Keep the concrete Paris/problem example on the speaker/couple tile.", "0 s", "No available footage shows disagreement; affectionate footage would contradict this beat.", "The retained 00:47:16.370–00:47:25.490 problem statement.", "YES"),
      beat("R04-B2", "Editorial jump from concrete example to the general principle", "BR026 — IMG_1784.MP4", "BR048 — IMG_1792.MP4", "00:01.000–00:06.500", "Across the approved audio splice from the example into `мы можем прийти...`.", "1.0–1.5 s", "The stable embrace honestly signals relationship context and cleanly masks the large source-time jump.", "The tail of the example transitions directly into the opening of the principle; no B-roll audio is used.", "NO"),
      beat("R04-B3", "Holding opposites until a third solution emerges", "KEEP_TALKING_HEAD", "NONE", "N/A", "Return to Evgeniia before `что-то третье` and stay through the payoff.", "0 s", "The concept is abstract and transcript-sensitive; the face and term must remain legible.", "Evgeniia's consensus/coniunctio/third-solution explanation.", "YES"),
    ],
  },
  {
    reel: "R05",
    title: "Adult Love Is Conditional",
    overall: "KEEP_TALKING_HEAD throughout. The provocative language and Andrew's reaction are the visual event.",
    beats: [
      beat("R05-B1", "The habit of proving worth is embedded in the psyche", "KEEP_TALKING_HEAD", "NONE", "N/A", "Keep the repaired earlier start on Evgeniia.", "0 s", "No lifestyle shot can represent the causal argument without becoming decorative.", "Evgeniia's proposed earlier opening clause.", "YES"),
      beat("R05-B2", "Adult love is conditional / transition out of the child part", "KEEP_TALKING_HEAD", "NONE", "N/A", "Keep faces and reactions visible.", "0 s", "This is the provocative thesis and needs ownership by the speaker.", "Evgeniia's adult-love/child-part contrast.", "YES"),
      beat("R05-B3", "Conditions and boundaries can structure and strengthen", "KEEP_TALKING_HEAD", "BR004 — IMG_0195.MOV (not recommended)", "N/A", "Keep the embodied, profane payoff visible.", "0 s", "Domestic couple footage would soften the specific claim and hide the strongest reaction beat.", "Evgeniia's conditions/boundaries/structure payoff.", "YES"),
    ],
  },
  {
    reel: "R06",
    title: "What Do You Actually Know Is True?",
    overall: "KEEP_TALKING_HEAD throughout. Alternating speakers and reactions are already the edit structure.",
    beats: [
      beat("R06-B1", "What do I know to be true?", "KEEP_TALKING_HEAD", "NONE", "N/A", "Evgeniia's opening direct question.", "0 s", "The direct address is the hook; B-roll would interrupt it.", "Evgeniia's question.", "YES"),
      beat("R06-B2", "How much evidence is enough for trust?", "KEEP_TALKING_HEAD", "NONE", "N/A", "Andrew's counter-question and the reaction.", "0 s", "Alternating faces show the relational exchange better than symbolic evidence imagery.", "Andrew's evidence/trust question.", "YES"),
      beat("R06-B3", "Separate facts from anxiety and expectation", "KEEP_TALKING_HEAD", "NONE", "N/A", "Preserve speaker changes and final factual list.", "0 s", "The content depends on exact verbal distinctions; aesthetic footage would reduce clarity.", "The retained fact/reality questions from both speakers.", "YES"),
    ],
  },
  {
    reel: "R07",
    title: "Kneeling / Returning to the Body",
    overall: "ONE OPTIONAL GROUNDING INSERT from the original rainy-walk source; unlike the previously rejected umbrella selfie range, this range actually shows feet.",
    beats: [
      beat("R07-B1", "Kneeling as calming, grounding, and returning to the body", "BR009 — IMG_0409.MOV", "BR052 — IMG_8706.MOV", "00:00.600–00:04.800", "Over `чтобы заземлиться... вернуться в тело`, after the reframing clause is visible on Evgeniia.", "1.0–1.4 s", "Feet moving on wet ground provide a literal grounding/body cue without romantic faces.", "Evgeniia's `успокоиться / заземлиться / вернуться в тело` list.", "NO"),
      beat("R07-B2", "Container, one question at a time, and reduced anxiety", "KEEP_TALKING_HEAD", "NONE", "N/A", "Keep Evgeniia's physiological mechanism on face.", "0 s", "The explanation is precise and cannot be carried by lifestyle footage.", "The complete endorphin/container/anxiety explanation.", "YES"),
      beat("R07-B3", "Guest's lived bodily discomfort and embodied thought", "KEEP_TALKING_HEAD", "NONE", "N/A", "Keep Andrew visible through his proof.", "0 s", "His facial delivery is the evidence; replacing it would weaken authenticity.", "Andrew's retained English lived-experience segment.", "YES"),
    ],
  },
  {
    reel: "R08",
    title: "Where Do You Fall Apart?",
    overall: "KEEP_TALKING_HEAD throughout. The material is transcript-sensitive and clinically loaded; glamour B-roll would be misleading.",
    beats: [
      beat("R08-B1", "Study your internal parts and notice where you fall apart", "KEEP_TALKING_HEAD", "NONE", "N/A", "Keep the opening term and gesture visible after C11 approval.", "0 s", "The key word is blocked; visual clarity and subtitles take priority.", "Evgeniia's C11-dependent opening.", "YES"),
      beat("R08-B2", "Observe how you relate and enter deep self-reflection", "KEEP_TALKING_HEAD", "BR034 — IMG_1786.MP4 (not recommended)", "N/A", "Keep Evgeniia visible.", "0 s", "A posed solitary portrait looks reflective but would aestheticize rather than explain self-observation.", "Evgeniia's self-reflection sentence.", "YES"),
      beat("R08-B3", "Protective forms, childhood trauma, and psyche splitting", "KEEP_TALKING_HEAD", "NONE", "N/A", "No B-roll over the clinically loaded passage.", "0 s", "Lifestyle or intimacy imagery could imply diagnosis or a causal story about visible people.", "The retained protective-parts/trauma passage.", "YES"),
      beat("R08-B4", "Do not force parts into generic archetypes; name your own", "KEEP_TALKING_HEAD", "NONE", "N/A", "Stay on the speaker through the punch.", "0 s", "The conceptual landing and punch card are stronger than any available visual metaphor.", "Evgeniia's archetypes/naming conclusion.", "YES"),
    ],
  },
];

const ratioToNumber = (ratio) => {
  const [a, b] = String(ratio || "0/1").split("/").map(Number);
  return b ? a / b : 0;
};

const mediaFiles = readdirSync(sourceDir)
  .filter((name) => /\.(mov|mp4)$/i.test(name))
  .sort((a, b) => a.localeCompare(b));

const sources = mediaFiles.map((name) => {
  const fullPath = join(sourceDir, name);
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", fullPath], { encoding: "utf8" }));
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.filter((stream) => stream.codec_type === "audio");
  const rotation = Number(video.side_data_list?.find((item) => Number.isFinite(item.rotation))?.rotation ?? video.tags?.rotate ?? 0);
  const quarterTurn = Math.abs(rotation) % 180 === 90;
  const displayWidth = quarterTurn ? video.height : video.width;
  const displayHeight = quarterTurn ? video.width : video.height;
  const duration = Number(probe.format.duration);
  const usefulRanges = (rangesByFile[name] || []).map((range) => ({ SOURCE_FILE: `video_ref_nikulina/${name}`, ...range }));
  return {
    filename: name,
    source_file: `video_ref_nikulina/${name}`,
    duration_seconds: duration,
    coded_resolution: `${video.width}x${video.height}`,
    display_resolution: `${displayWidth}x${displayHeight}`,
    orientation: displayHeight > displayWidth ? "PORTRAIT" : displayWidth > displayHeight ? "LANDSCAPE" : "SQUARE",
    rotation_degrees: rotation,
    fps: Number(ratioToNumber(video.avg_frame_rate).toFixed(3)),
    fps_fraction: video.avg_frame_rate,
    nominal_rate_fraction: video.r_frame_rate,
    video_codec: video.codec_name || "unknown",
    audio_presence: audio.length > 0,
    audio_streams: audio.map((stream) => ({
      index: stream.index,
      codec: stream.codec_name || "unknown",
      codec_tag: stream.codec_tag_string || null,
      sample_rate_hz: Number(stream.sample_rate) || null,
      channels: stream.channels || null,
    })),
    size_bytes: Number(probe.format.size),
    contact_sheet: `scratch_check/broll_master_review/contact_sheets/${basename(name, /\.[^.]+$/.exec(name)?.[0])}.jpg`,
    detail_sheet_1fps: `scratch_check/broll_master_review/detail_sheets/${basename(name, /\.[^.]+$/.exec(name)?.[0])}_1fps.jpg`,
    useful_ranges: usefulRanges,
  };
});

const totalDuration = sources.reduce((sum, source) => sum + source.duration_seconds, 0);
const totalRanges = sources.reduce((sum, source) => sum + source.useful_ranges.length, 0);

const catalog = {
  schema_version: 1,
  generated_at: "2026-08-19",
  source_directory: "video_ref_nikulina",
  expected_source_files_from_request: 15,
  discovered_source_files: sources.length,
  source_count_discrepancy: sources.length === 15 ? null : `Request said 15; only ${sources.length} MOV/MP4 originals exist in the specified directory. No public/ or reference/ substitute was added.`,
  total_duration_seconds: Number(totalDuration.toFixed(6)),
  useful_ranges_found: totalRanges,
  review_directory: "scratch_check/broll_master_review",
  review_material: {
    representative_contact_sheets: sources.length,
    one_fps_detail_sheets: sources.length,
    total_sheets: sources.length * 2,
    cell_timing_note: "Contact sheets: 12 row-major samples at approximately n*duration/12. Detail sheets: row-major cell n is approximately second n, starting at 0.",
  },
  originals_modified: false,
  sources,
};

const seconds = (value) => {
  const minutes = Math.floor(value / 60);
  const remainder = value - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(3).padStart(6, "0")}`;
};

const md = [];
md.push("# B-roll master catalog", "", "STATUS=READY_FOR_HUMAN_BROLL_REVIEW  ", "ORIGINAL_FILES_MODIFIED=NO  ", `SOURCE_FILES_DISCOVERED=${sources.length}  `, "SOURCE_FILES_EXPECTED_BY_REQUEST=15  ", `TOTAL_DURATION=${seconds(totalDuration)}  `, `USEFUL_RANGES_FOUND=${totalRanges}  `, "");
md.push("> The specified directory contains 14 original MOV/MP4 files, not 15. The inventory covers every media file actually present. Files in `reference/` duplicate a subset; files in `public/` are derived assets and were intentionally excluded.", "");
md.push("## Review material", "", "- Representative 12-frame sheets: `scratch_check/broll_master_review/contact_sheets/`", "- Detailed 1 fps sheets: `scratch_check/broll_master_review/detail_sheets/`", "- Cell order is left-to-right, top-to-bottom. On detailed sheets, cell 0 is approximately 00:00, cell 1 is 00:01, and so on.", "");
md.push("## Technical inventory", "", "| File | Duration | Display resolution | Orientation | FPS avg (nominal) | Video | Audio |", "|---|---:|---:|---|---:|---|---|");
for (const source of sources) {
  const audioText = source.audio_streams.map((stream) => `${stream.codec}${stream.codec_tag ? `/${stream.codec_tag}` : ""} ${stream.sample_rate_hz || "?"} Hz ${stream.channels || "?"}ch`).join("; ");
  md.push(`| \`${source.filename}\` | ${seconds(source.duration_seconds)} | ${source.display_resolution} (coded ${source.coded_resolution}, rot ${source.rotation_degrees}°) | ${source.orientation} | ${source.fps} (${source.nominal_rate_fraction}) | ${source.video_codec} | ${audioText || "NONE"} |`);
}
md.push("");
for (const source of sources) {
  md.push(`## ${source.filename}`, "", `DURATION=${seconds(source.duration_seconds)}  `, `RESOLUTION=${source.display_resolution} display; ${source.coded_resolution} coded; rotation ${source.rotation_degrees}°  `, `ORIENTATION=${source.orientation}  `, `FPS=${source.fps} average; nominal ${source.nominal_rate_fraction}  `, `VIDEO_CODEC=${source.video_codec}  `, `AUDIO_PRESENCE=${source.audio_presence ? "YES" : "NO"}  `, `CONTACT_SHEET=\`${source.contact_sheet}\`  `, `DETAIL_SHEET=\`${source.detail_sheet_1fps}\`  `, "");
  for (const range of source.useful_ranges) {
    const editorialFunctions = Array.isArray(range.EDITORIAL_FUNCTION) ? range.EDITORIAL_FUNCTION.join(" / ") : String(range.EDITORIAL_FUNCTION);
    md.push(`### ${range.RANGE_ID}`, "", `SOURCE_FILE=\`${range.SOURCE_FILE}\`  `, `START=${seconds(range.START)}  `, `END=${seconds(range.END)}  `, `OBSERVED_CONTENT=${range.OBSERVED_CONTENT}  `, `PEOPLE_VISIBLE=${range.PEOPLE_VISIBLE}  `, `ACTION=${range.ACTION}  `, `SETTING=${range.SETTING}  `, `MOOD=${range.MOOD}  `, `EDITORIAL_FUNCTION=${editorialFunctions}  `, `QUALITY_NOTES=${range.QUALITY_NOTES}  `, "");
  }
}

const mappingMd = [];
mappingMd.push("# Eight Reels — B-roll mapping", "", "STATUS=READY_FOR_HUMAN_BROLL_REVIEW  ", "REELS_MAPPED=8/8  ", "TIMELINES_AUTHORIZED=NO  ", "REEL_RENDERS_AUTHORIZED=NO  ", "EXACT_RANGES_EXTRACTED_TO_PACKAGES=NO  ", "");
mappingMd.push("This mapping reads `EIGHT_REELS_EDITORIAL_REVIEW.md` and references range IDs from `BROLL_MASTER_CATALOG.md`. B-roll remains optional. Primary insert recommendations are unique across the series: R01/BR041, R02/BR020, R04/BR026, and R07/BR009. R03, R05, R06, and R08 intentionally remain talking-head only.", "");
for (const reel of reelMappings) {
  mappingMd.push(`## ${reel.reel} — ${reel.title}`, "", `OVERALL_RECOMMENDATION=${reel.overall}  `, "");
  for (const item of reel.beats) {
    mappingMd.push(`### ${item.BEAT_ID} — ${item.SEMANTIC_BEAT}`, "", `PRIMARY_CANDIDATE=${item.PRIMARY_CANDIDATE}  `, `ALTERNATIVE_CANDIDATE=${item.ALTERNATIVE_CANDIDATE}  `, `SOURCE_INTERVAL=${item.SOURCE_INTERVAL}  `, `INSERT_POSITION=${item.INSERT_POSITION}  `, `RECOMMENDED_DURATION=${item.RECOMMENDED_DURATION}  `, `WHY_IT_FITS=${item.WHY_IT_FITS}  `, `WHAT_AUDIO_CONTINUES_UNDER_IT=${item.WHAT_AUDIO_CONTINUES_UNDER_IT}  `, `KEEP_FACE_INSTEAD=${item.KEEP_FACE_INSTEAD}  `, "");
  }
}
mappingMd.push("## Series-level guardrails", "", "- Do not use BR020 over consent/good-intentions language; it belongs only to the value/chemistry beat.", "- Do not use BR024 without explicit platform/editorial approval; it is the most sexually explicit range.", "- Do not use fashion-coded solo footage to illustrate trauma, internal parts, regulation, evidence, or consent.", "- Prefer the four unique primary insert moments. Alternatives are fallbacks, not permission to repeat the same visual motif.", "- Only after human approval should exact render-used slices be extracted into a Reel package. Never copy full originals into package `public/` directories.", "");

const reviewReadme = [
  "# B-roll visual review sheets",
  "",
  `This directory covers all ${sources.length} MOV/MP4 originals found in \`video_ref_nikulina/\`.`,
  "",
  "- `contact_sheets/<stem>.jpg`: 12 representative frames, row-major. Cell n is sampled at approximately n × duration / 12.",
  "- `detail_sheets/<stem>_1fps.jpg`: one frame per second, row-major. Cell 0 ≈ 00:00, cell 1 ≈ 00:01, etc.",
  "- Exact editorial intervals and quality notes are in `BROLL_MASTER_CATALOG.md` and `.json` at the repository root.",
  "",
  "The source media was read only. These JPEGs are lightweight review derivatives and are not render assets.",
  "",
].join("\n");

writeFileSync(join(root, "BROLL_MASTER_CATALOG.json"), `${JSON.stringify(catalog, null, 2)}\n`);
writeFileSync(join(root, "BROLL_MASTER_CATALOG.md"), `${md.join("\n")}\n`);
writeFileSync(join(root, "EIGHT_REELS_BROLL_MAPPING.md"), `${mappingMd.join("\n")}\n`);
writeFileSync(join(reviewDir, "README.md"), reviewReadme);

console.log(`BROLL_SOURCE_FILES=${sources.length}`);
console.log(`TOTAL_DURATION_SECONDS=${totalDuration.toFixed(6)}`);
console.log(`USEFUL_RANGES_FOUND=${totalRanges}`);
console.log(`CONTACT_SHEETS_CREATED=${sources.length * 2}`);
console.log("REELS_MAPPED=8/8");
