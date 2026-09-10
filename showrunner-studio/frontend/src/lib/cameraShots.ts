// cameraShots.ts — Camera / shot-grammar library. Ready-to-use formula prompts
// that drop straight into a scene's Action or the Seedance CAMERA MOTION field.
// Professional formula:
//   [Shot size] + [Angle] + [Movement + speed] + [Subject/Action] + [Lens/Lighting] + [What the shot reveals]

export interface CameraShot {
  name: string;
  formula: string;
}

export interface ShotCategory {
  title: string;
  blurb: string;
  shots: CameraShot[];
}

export const SHOT_FORMULA =
  "[Shot size] + [Angle] + [Movement + speed] + [Subject/Action] + [Lens/Lighting] + [What the shot reveals]";

export const SHOT_LIBRARY: ShotCategory[] = [
  {
    title: "Static & Focal Control",
    blurb: "Hold the frame; direct the eye with focus and isolated motion.",
    shots: [
      { name: "Locked-Off", formula: "Wide shot, eye-level, locked-off static camera. A detective stands under a neon sign. 35mm lens, moody lighting. Reveals the isolated atmosphere." },
      { name: "Rack Focus", formula: "Close-up, rack focus. Focus starts sharp on a glass, shifting smoothly to the woman behind. 85mm, dim lighting. Reveals the subject of her gaze." },
      { name: "Micro-Reaction", formula: "Close-up face. [actor: eyes] [action: two quick saccades left] [constraint: head locked]. Soft lighting. Reveals sudden realization without body warping." },
      { name: "Limb Isolation", formula: "Medium shot. [actor: right wrist] [action: subtle wave] [constraint: shoulder locked]. Desk lamp lighting. Emphasizes a precise dismissal gesture." },
      { name: "Soft Focus", formula: "Medium shot, static camera. Silhouette of a child running in slow motion. Soft focus, hazy golden hour. Reveals a nostalgic, dream-like memory." },
    ],
  },
  {
    title: "Depth & Verticality",
    blurb: "Push, pull, rise and drop to build scale and tension.",
    shots: [
      { name: "Dolly In", formula: "Medium close-up, slow dolly push-in over 5s. The detective inspects a torn photo. Shallow depth, harsh spotlight. Builds quiet, intense tension." },
      { name: "Pull-Back", formula: "Close-up, slow camera pull-back. Starts on a child's hand, retreating to reveal a vast, glowing carnival. Wide lens. Establishes immense scale." },
      { name: "Dolly Zoom (Vertigo)", formula: "Medium shot, dolly zoom. Camera tracks backward while zooming in on the face. Subject size stays constant while the background stretches unnaturally. High contrast. Reveals sudden panic." },
      { name: "Crane Up", formula: "Full shot, slow crane up. Camera rises from the subject on a roof. 24mm lens, golden hour. Triumphant reveal of the sprawling city skyline." },
      { name: "Pedestal Down", formula: "Wide shot, smooth pedestal down. Camera drops vertically behind a brick wall. Deep focus, cold moonlight. Reveals a hidden figure crouching below." },
    ],
  },
  {
    title: "Lateral & Tracking",
    blurb: "Move parallel to or behind the subject for parallax and momentum.",
    shots: [
      { name: "Truck Right", formula: "Full shot, slow truck right. Camera moves parallel to a running horse. Motion blur, cinematic lighting. Creates 3D parallax depth revealing pursuit speed." },
      { name: "Tracking", formula: "Medium shot, steady tracking. Camera follows a runner from behind. 35mm lens, dawn light. Locks the viewer strictly into the character's momentum." },
      { name: "Steadicam", formula: "Full shot, Steadicam follow. Camera glides smoothly behind a woman in a crowded market. Natural daylight. Reveals the bustling environment seamlessly." },
      { name: "Pan Left", formula: "Wide shot, slow pan left over 6s. Camera pivots horizontally from a burning car to a distant siren. 50mm, night lighting. Reveals approaching danger." },
      { name: "Arc Shot", formula: "Medium shot, slow 90-degree arc. Camera curves around a seated hacker. Glowing screen light. Adds dynamic motion to a static subject." },
    ],
  },
  {
    title: "Dynamic & Transitional",
    blurb: "High-energy moves for reveals, cuts and adrenaline.",
    shots: [
      { name: "180° Orbit", formula: "Full shot, smooth 180-degree orbit. Camera circles a dancer holding a pose. Studio lighting. Reveals the subject's form in complete 3D space." },
      { name: "Handheld", formula: "Close-up, handheld camera with subtle natural shake. Two people whispering. 50mm, warm light. Brings a raw, intimate documentary realism." },
      { name: "Whip Pan", formula: "Medium shot, rapid whip pan. Camera streaks with motion blur from drummer to singer. Stage lighting. Energetically connects subjects instantly." },
      { name: "Crash Zoom", formula: "Wide shot, extremely fast crash zoom. Camera snaps instantly into a macro shot of a bomb timer. Stark light. Forces sudden, shocking emphasis." },
      { name: "FPV Dive", formula: "Extreme wide, fast FPV drone dive. Camera plummets off a cliff edge over the ocean. Aggressive speed, high-energy lighting. Delivers massive adrenaline." },
    ],
  },
  {
    title: "Micro-Motions (locked frame)",
    blurb: "Motion tokens that move one body part while the rest of the frame stays locked — prevents AI warping.",
    shots: [
      { name: "Wrist Wave", formula: "A seated person at a wooden desk, daylight. [actor: right wrist] [action: small side-to-side wave] [magnitude: small] [timing: 2.0–3.0s, once] [constraint: shoulder and elbow steady] [negative: no camera movement, no left-hand motion]." },
      { name: "Eye Saccades", formula: "Close-up face, soft light. [actor: eyes] [action: two quick saccades left→center] [timing: within first second] [constraint: head locked, expression neutral] [negative: no smile, no blink during saccades]." },
      { name: "Page Flip", formula: "Overhead shot of an open notebook. [actor: right index finger] [action: slide page corner and flip] [magnitude: single page] [timing: 1.5–2.5s] [constraint: wrist minimal, forearm anchored to table] [negative: no camera move]." },
      { name: "Head Tilt", formula: "Medium shot. [actor: head] [action: small tilt right then return] [magnitude: 5–7°] [timing: 1.0–1.4s] [constraint: shoulders level] [negative: no smile, no eye shift]." },
      { name: "Fabric Flutter", formula: "Portrait with light breeze. [actor: jacket hem] [action: brief flutter] [timing: 0.8–1.2s] [constraint: hair and foliage still] [negative: no global wind]." },
    ],
  },
  {
    title: "Complex & Phased Motion",
    blurb: "Multi-stage moves and transitions that keep spatial coherence.",
    shots: [
      { name: "Multi-Frame Dive", formula: "The character performs a graceful dive from the cliff into the air. Gravity-accurate falling motion. His jacket flaps violently in the wind. Smooth transition between the standing pose and the falling pose. Cinematic motion blur." },
      { name: "360° Orbit (with landmark)", formula: "360-degree camera orbit. The camera circles completely around the wizard. As the camera moves behind his back, we clearly see the golden dragon emblem on his cape. The camera continues to circle back to his front. Dusty atmosphere, magic particles swirling. Keep character consistency strict." },
      { name: "Truck Right (action parallax)", formula: "Side tracking shot (Truck Right). The camera moves parallel to the samurai riding the horse at high speed. Motion blur on the background bamboo trees, but the samurai remains sharp. Sparks flying from hooves. Dynamic angle, cinematic speed." },
      { name: "Phased Arc + Rise", formula: "The camera arcs around the seated figure, then rises above the table to reveal the empty chairs surrounding her." },
      { name: "Combined Dolly + Tilt", formula: "Close-up shot, slow dolly forward while tilting up slightly, revealing subject's face, cinematic quality with shallow depth of field, 4-second duration, professional smooth movement." },
    ],
  },
];
