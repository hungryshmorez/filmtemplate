// cameraShots.ts — Camera-move directory. Each formula drops into a clip's
// ACTION (camera movement lives in the Action alongside the physical action —
// there is no separate camera field). Sourced from the 46-clip / 7-category
// movement directory, plus focus/lens shots and locked-frame micro-motions.
import type { LibraryCategory } from "../components/PromptLibrary";

export const SHOT_FORMULA =
  "[Shot size] + [Angle] + [Movement + speed] + [Subject/Action] + [Lens/Lighting] + [What the shot reveals]";

export const SHOT_CATEGORIES: LibraryCategory[] = [
  {
    title: "Pan / Tilt",
    blurb: "Rotate from a fixed point — pivot horizontally or vertically.",
    entries: [
      { name: "Static shot", prompt: "locked-off static shot. Movement: hold one fixed camera position for the full clip. Speed: still and steady. Framing: keep the same angle, height, lens distance and composition. End: finish with the same framing and camera position." },
      { name: "Pan right", prompt: "pan right. Movement: rotate the camera horizontally from left to right from one fixed point. Speed: smooth constant rotation. Framing: keep the horizon level while new space enters from the right side of the frame. End: settle on a clear final composition." },
      { name: "Pan left", prompt: "pan left. Movement: rotate the camera horizontally from right to left from one fixed point. Speed: smooth constant rotation. Framing: keep the horizon level while new space enters from the left side of the frame. End: settle on a clear final composition." },
      { name: "Whip pan right", prompt: "whip pan right. Movement: rotate rapidly from the starting direction toward a new target on the right. Speed: fast snap with brief motion blur during the rotation. Framing: begin on one readable composition and land on a second readable target. End: settle into a sharp final frame." },
      { name: "Whip pan left", prompt: "whip pan left. Movement: rotate rapidly from the starting direction toward a new target on the left. Speed: fast snap with brief motion blur during the rotation. Framing: begin on one readable composition and land on a second readable target. End: settle into a sharp final frame." },
      { name: "Tilt up", prompt: "tilt up. Movement: rotate the camera upward from one fixed point. Speed: smooth constant tilt. Framing: keep the vertical subject or architecture centered as the frame travels upward. End: land on the upper target." },
      { name: "Tilt down", prompt: "tilt down. Movement: rotate the camera downward from one fixed point. Speed: smooth constant tilt. Framing: keep the vertical subject or architecture centered as the frame travels downward. End: land on the lower target." },
    ],
  },
  {
    title: "Zoom / Lens",
    blurb: "Change focal length — scale the frame without moving the camera body.",
    entries: [
      { name: "Slow zoom in", prompt: "slow zoom in. Movement: slowly increase lens focal length toward a tighter frame. Speed: gradual and even. Framing: keep the main visual target readable as it becomes larger in frame. End: finish on a stable tighter composition." },
      { name: "Slow zoom out", prompt: "slow zoom out. Movement: slowly decrease lens focal length toward a wider frame. Speed: gradual and even. Framing: keep the main visual target readable as more surrounding space appears. End: finish on a stable wider composition." },
      { name: "Fast zoom in", prompt: "fast zoom in. Movement: quickly increase lens focal length toward the main visual target. Speed: quick decisive zoom. Framing: keep the target centered or clearly readable during the scale change. End: finish on a stable tighter composition." },
      { name: "Fast zoom out", prompt: "fast zoom out. Movement: quickly decrease lens focal length away from the main visual target. Speed: quick decisive zoom. Framing: keep the target readable as the surrounding space appears. End: finish on a stable wider composition." },
      { name: "Crash zoom in", prompt: "crash zoom in. Movement: snap the lens rapidly toward the main visual target. Speed: very fast and punchy. Framing: keep the target readable through the sudden scale change. End: land on a bold tighter composition." },
      { name: "Crash zoom out", prompt: "crash zoom out. Movement: snap the lens rapidly away from the main visual target. Speed: very fast and punchy. Framing: keep the target readable as the surrounding space appears. End: land on a bold wider composition." },
    ],
  },
  {
    title: "Dolly / Track",
    blurb: "Move the camera body through the scene, often with the subject.",
    entries: [
      { name: "Dolly in", prompt: "dolly in. Movement: move the camera physically forward in a straight line toward the main subject. Speed: smooth controlled push. Framing: keep camera height, lens direction and subject position consistent while distance closes. End: finish in a tighter composition." },
      { name: "Dolly out", prompt: "dolly out. Movement: move the camera physically backward in a straight line away from the main subject. Speed: smooth controlled retreat. Framing: keep lens direction and camera height consistent while more environment enters frame. End: finish in a wider composition." },
      { name: "Tracking shot", prompt: "tracking shot. Movement: move through the scene with the main subject. Speed: match the subject's pace. Framing: keep the subject consistently readable while the environment moves around them. End: maintain a clear moving composition." },
      { name: "Follow shot / over-the-shoulder", prompt: "follow shot from behind. Movement: move behind the subject along their route at shoulder height. Speed: match the subject's pace. Framing: keep the back, shoulder or head as the foreground guide while the route ahead stays readable. End: continue following with the subject leading the frame." },
      { name: "Reverse tracking / walk-and-talk", prompt: "reverse tracking shot. Movement: move backward in front of the walking subject. Speed: match the subject's forward pace. Framing: keep front-facing face and body framing stable as the background moves behind them. End: hold a clear front-facing moving composition." },
      { name: "Side tracking", prompt: "side tracking shot. Movement: move parallel beside the subject along their direction of travel. Speed: match the subject's motion. Framing: keep the subject in side profile or three-quarter profile at a stable distance. End: continue the parallel movement with clear horizontal motion." },
      { name: "Low tracking", prompt: "low tracking shot. Movement: move at ground or below-waist height alongside the subject's movement path. Speed: match the subject, footsteps or wheels. Framing: keep the low detail readable while the ground plane moves through frame. End: finish with the low perspective clearly maintained." },
      { name: "Vehicle tracking", prompt: "vehicle tracking shot. Movement: move with the vehicle along its route. Speed: match the vehicle's pace. Framing: keep the vehicle stable in frame while the road or environment moves past. End: maintain a clear moving vehicle composition." },
      { name: "Chase shot", prompt: "chase shot. Movement: follow a moving subject quickly along the action route. Speed: fast, reactive and physically close. Framing: keep the subject visible while allowing energetic reframing. End: stay connected to the subject in motion." },
    ],
  },
  {
    title: "Physical Moves",
    blurb: "Translate or arc the whole camera for parallax and 3D form.",
    entries: [
      { name: "Truck right", prompt: "truck right. Movement: move the camera physically to the right on a straight horizontal path. Speed: smooth constant lateral travel. Framing: keep the lens facing the same direction while the scene slides across frame. End: finish on a clean lateral composition." },
      { name: "Truck left", prompt: "truck left. Movement: move the camera physically to the left on a straight horizontal path. Speed: smooth constant lateral travel. Framing: keep the lens facing the same direction while the scene slides across frame. End: finish on a clean lateral composition." },
      { name: "Pedestal up", prompt: "pedestal up. Movement: move the entire camera vertically upward in a straight line. Speed: smooth constant lift. Framing: keep the lens level and pointed in the same direction during the vertical move. End: finish with the higher framing clearly readable." },
      { name: "Pedestal down", prompt: "pedestal down. Movement: move the entire camera vertically downward in a straight line. Speed: smooth constant descent. Framing: keep the lens level and pointed in the same direction during the vertical move. End: finish with the lower framing clearly readable." },
      { name: "Slider right", prompt: "slider right. Movement: slide the camera a small distance to the right. Speed: slow controlled constant motion. Framing: keep foreground, subject and background layers readable as parallax shifts. End: finish on a refined composition with the new right-side angle visible." },
      { name: "Slider left", prompt: "slider left. Movement: slide the camera a small distance to the left. Speed: slow controlled constant motion. Framing: keep foreground, subject and background layers readable as parallax shifts. End: finish on a refined composition with the new left-side angle visible." },
      { name: "Push past / pass-by", prompt: "push past. Movement: move forward past a visible foreground object, edge or opening. Speed: smooth forward glide. Framing: let the foreground pass close to the lens while the space beyond becomes clearer. End: arrive inside or beyond the foreground layer." },
      { name: "Arc right", prompt: "arc right. Movement: move on a shallow curved path around the main subject toward the right side. Speed: smooth measured curve. Framing: keep distance, height and subject readability consistent while the angle changes. End: finish from a new right-side angle." },
      { name: "Arc left", prompt: "arc left. Movement: move on a shallow curved path around the main subject toward the left side. Speed: smooth measured curve. Framing: keep distance, height and subject readability consistent while the angle changes. End: finish from a new left-side angle." },
      { name: "Orbit clockwise", prompt: "clockwise orbit. Movement: circle clockwise around the main subject at a consistent radius. Speed: smooth controlled orbit. Framing: keep the subject centered while the background rotates around them. End: complete the intended arc or full circle with stable framing." },
      { name: "Orbit counterclockwise", prompt: "counterclockwise orbit. Movement: circle counterclockwise around the main subject at a consistent radius. Speed: smooth controlled orbit. Framing: keep the subject centered while the background rotates around them. End: complete the intended arc or full circle with stable framing." },
    ],
  },
  {
    title: "Human Camera",
    blurb: "Operator-held or body-mounted for energy and immediacy.",
    entries: [
      { name: "Handheld shot", prompt: "handheld shot. Movement: hold the camera at human operator height with natural body movement. Speed: responsive and organic. Framing: keep the subject readable while the frame has subtle sway and micro-adjustments. End: finish with a natural handheld composition." },
      { name: "Body-mounted / Snorricam", prompt: "body-mounted Snorricam. Movement: keep the camera fixed relative to the subject's torso or face while the subject moves. Speed: match the subject's body motion. Framing: keep the subject close, centered and facing the camera as the background moves around them. End: finish with the subject still locked in frame." },
    ],
  },
  {
    title: "Drone / Crane",
    blurb: "Travel through open vertical or aerial space.",
    entries: [
      { name: "Crane up", prompt: "crane up. Movement: travel smoothly upward through open space. Speed: slow controlled vertical lift. Framing: keep the subject or location readable as the camera rises. End: finish with the higher scale clearly visible." },
      { name: "Crane down", prompt: "crane down. Movement: travel smoothly downward through open space. Speed: slow controlled vertical descent. Framing: keep the subject or location readable as the camera descends. End: finish with the lower subject or destination clearly visible." },
      { name: "Drone push in", prompt: "drone push in. Movement: fly smoothly forward through open space toward the subject or destination. Speed: controlled aerial glide. Framing: keep the route and destination readable as the camera approaches. End: arrive at a closer aerial composition." },
      { name: "Drone pull back", prompt: "drone pull back. Movement: fly smoothly backward away from the subject or destination. Speed: controlled aerial retreat. Framing: keep the subject readable as more landscape appears. End: finish on a wider aerial composition." },
      { name: "Helicopter shot", prompt: "helicopter-style aerial shot. Movement: move from high altitude along a broad gradual flight path. Speed: steady controlled aerial motion. Framing: keep the landscape or distant moving subject readable at wide scale. End: finish on a stable high-altitude composition." },
    ],
  },
  {
    title: "Specials",
    blurb: "Signature and transition-friendly moves.",
    entries: [
      { name: "First-person view", prompt: "first-person view. Movement: move forward at human eye height from the character's perspective. Speed: natural walking or reaching pace. Framing: use visible hands, arms or body edges as the viewer's physical reference. End: arrive at the next point of action from the same point of view." },
      { name: "Tilt-shift (miniature)", prompt: "tilt-shift miniature view. Movement: hold or glide from a high angled view over the scene. Speed: small precise movement. Framing: keep a narrow band of sharp focus across the key subject area with soft blur above and below. End: finish with the miniature-scale view intact." },
      { name: "Infinite zoom", prompt: "infinite zoom. Movement: zoom continuously inward toward the exact center target. Speed: smooth accelerating zoom. Framing: keep the circular target centered as it expands. End: finish when the next visual world fills the frame." },
      { name: "Earth zoom out", prompt: "earth zoom out. Movement: pull upward from the starting point through street, city, landscape and planet scale. Speed: rapid expanding zoom out. Framing: keep the original location centered as scale grows. End: finish on a planet-scale view with the starting point still implied at center." },
      { name: "Time-lapse", prompt: "locked-camera time-lapse. Movement: hold one fixed camera position while time moves rapidly forward. Speed: fast time compression with a stable camera. Framing: keep the same composition and horizon as motion passes through the frame. End: finish from the same camera angle with visible passage of time." },
      { name: "Pass-through objects", prompt: "pass-through movement. Movement: move forward toward a visible object, surface or barrier and continue into the space beyond. Speed: smooth centered glide. Framing: keep the opening or surface centered as the transition point. End: arrive inside the revealed space beyond." },
    ],
  },
  {
    title: "Focus & Lens",
    blurb: "Direct the eye by shifting focus rather than moving the camera.",
    entries: [
      { name: "Rack focus", prompt: "rack focus. Focus starts sharp on the foreground subject, then shifts smoothly to reveal a second subject in the background. Shallow depth of field, dim intimate light. Reveals the true subject of attention." },
      { name: "Dolly zoom (Vertigo)", prompt: "dolly zoom (Vertigo effect). The camera tracks backward while zooming in on the subject's face; the subject's size stays constant in frame while the background stretches and elongates unnaturally. High contrast, sharp focus on the face. Disorienting, revealing sudden panic." },
      { name: "Soft focus", prompt: "static camera, soft focus. A silhouetted subject in slow motion, hazy golden-hour bloom, gentle diffusion. Reveals a nostalgic, dream-like memory." },
    ],
  },
  {
    title: "Micro-Motions (locked frame)",
    blurb: "Motion tokens that move one body part while the rest of the frame stays locked — prevents AI warping.",
    entries: [
      { name: "Wrist Wave", prompt: "A seated person at a wooden desk, daylight. [actor: right wrist] [action: small side-to-side wave] [magnitude: small] [timing: 2.0–3.0s, once] [constraint: shoulder and elbow steady] [negative: no camera movement, no left-hand motion]." },
      { name: "Eye Saccades", prompt: "Close-up face, soft light. [actor: eyes] [action: two quick saccades left→center] [timing: within first second] [constraint: head locked, expression neutral] [negative: no smile, no blink during saccades]." },
      { name: "Page Flip", prompt: "Overhead shot of an open notebook. [actor: right index finger] [action: slide page corner and flip] [magnitude: single page] [timing: 1.5–2.5s] [constraint: wrist minimal, forearm anchored to table] [negative: no camera move]." },
      { name: "Head Tilt", prompt: "Medium shot. [actor: head] [action: small tilt right then return] [magnitude: 5–7°] [timing: 1.0–1.4s] [constraint: shoulders level] [negative: no smile, no eye shift]." },
      { name: "Fabric Flutter", prompt: "Portrait with light breeze. [actor: jacket hem] [action: brief flutter] [timing: 0.8–1.2s] [constraint: hair and foliage still] [negative: no global wind]." },
    ],
  },
];
