// Real guided meditations and breathwork — not filler copy, and not
// hundreds of interchangeable tracks either: each one here is built on a
// specific, named, well-documented technique (cited in its own `basis`,
// same discipline as js/features/focus/guided-sessions.ts, which this
// shares its beat-builders and player with), written in plain, warm
// language with no diagnostic or clinical framing. These offer a
// technique for something everyone feels sometimes — they never suggest
// there's something wrong with the person using them.
//
// The library spans five real, distinct frameworks (see MEDITATE_CATEGORIES
// below), not one wellness voice reskinned repeatedly:
//   - MBSR (Kabat-Zinn) — the body scan, and the breath-focused attention
//     "A Quiet Mind" builds on.
//   - CBT/ACT-adjacent techniques — RAIN and acceptance-based coping with
//     what is/isn't in your control.
//   - Kristin Neff's self-compassion research, plus metta/loving-kindness
//     as a separate, outward-facing practice with its own evidence base.
//   - Named breathing protocols with a physiological mechanism — 4-7-8,
//     the physiological sigh, box breathing, and Progressive Muscle
//     Relaxation (Jacobson) for sleep.
// Each build*() function's doc comment below names its specific source.
//
// This is real support, not a substitute for a therapist, and it never
// claims otherwise — see the "not a substitute for a therapist or a
// diagnosis" note on the Meditate screen and the same "Not medical
// advice" framing the whole app carries. This screen deliberately does
// not carry crisis-line content (a 988-style mention was removed from
// here in an earlier pass) — it stays a wellness practice, not a stand-in
// for a crisis resource or clinical care.
import { breathBeat, proseBeat } from '../../lib/guided-session.js';
/** RAIN — Recognize, Allow, Investigate, Nurture — a widely-taught
 *  mindfulness approach (Tara Brach and others) for sitting with a
 *  difficult emotion instead of pushing it away or being swept up in it. */
function buildSadness() {
    const beats = [
        proseBeat('Find a quiet place to sit, and let your eyes close if that feels right.', 1.5),
        proseBeat("We'll use four simple steps to sit with what you're feeling, rather than push it away.", 1),
        proseBeat('First, recognize. Just name it, quietly, to yourself: this is sadness.', 3),
        proseBeat("Second, allow. You don't have to fix it or make it leave. Just let it be here.", 3),
        proseBeat('Notice where it sits in your body. Your chest, your throat, behind your eyes.', 3.5),
        proseBeat("There's no need to change what you find. Just notice it, with a little curiosity.", 3),
        proseBeat("Fourth, nurture. What would you say to a friend who felt this way?", 3),
        proseBeat('Try offering yourself those same words, quietly.', 2.5),
        proseBeat("Sadness moves through, in its own time. You don't have to rush it.", 2.5),
        proseBeat("When you're ready, let your eyes open. You've given it real room to be here.", 2),
    ];
    return {
        id: 'sadness',
        category: 'stress',
        name: 'Sitting with Sadness',
        description: 'A four-step way to sit with sadness instead of pushing it away.',
        basis: 'RAIN (Recognize, Allow, Investigate, Nurture) — a widely-taught mindfulness approach to difficult emotion.',
        beats,
    };
}
/** Noticing anger's physical signature and creating a real pause before
 *  reacting — a standard cognitive-defusion + body-awareness approach,
 *  not suppression (the goal isn't to make the anger disappear). */
function buildAnger() {
    const beats = [
        proseBeat('Wherever you are, however you feel right now, that\'s fine. Let\'s just notice it.', 2),
        proseBeat('Anger has a real physical signature. Scan for it — jaw, shoulders, hands, chest.', 3.5),
        proseBeat('Wherever you find it, you don\'t need to relax it yet. Just notice it\'s there.', 3),
        proseBeat('Now, a slow breath — in through your nose, and a long breath out, longer than the in.', 2),
        breathBeat('Breathe in', 'in', 4),
        breathBeat('And out, slow, all the way', 'out', 6),
        breathBeat('Breathe in', 'in', 4),
        breathBeat('Out, slow, all the way', 'out', 6),
        proseBeat('That long exhale is doing real work — it\'s telling your body it can stand down.', 3),
        proseBeat('The situation hasn\'t changed. But you\'ve created a small gap before you respond to it.', 3),
        proseBeat('That gap is the whole point. You get to choose what happens in it.', 2.5),
    ];
    return {
        id: 'anger',
        category: 'stress',
        name: 'Working with Anger',
        description: 'Notice anger\'s physical signature, and create a real pause before reacting.',
        basis: 'Body-awareness plus extended-exhale breathing — a standard combination for down-regulating physiological arousal before responding.',
        beats,
    };
}
/** Grief-focused mindfulness — grounding through an anchor (breath,
 *  sound, touch) is the well-documented core technique across mindfulness
 *  approaches to bereavement; this doesn't try to resolve grief, only to
 *  offer somewhere steady to stand inside it. */
function buildGrief() {
    const beats = [
        proseBeat('Settle in wherever you are. There\'s nothing to do here except be where you are.', 2),
        proseBeat('Grief doesn\'t need to be fixed in the next few minutes. That\'s not what this is for.', 2.5),
        proseBeat('Instead, let\'s find one steady thing to hold onto. Your breath is always available.', 3),
        breathBeat('Breathe in, slowly', 'in', 4),
        breathBeat('And out', 'out', 5),
        breathBeat('In again', 'in', 4),
        breathBeat('And out', 'out', 5),
        proseBeat('If a wave of feeling comes, that\'s allowed. Come back to this breath as your anchor.', 3.5),
        proseBeat('You can also anchor to sound — notice whatever you can hear right now, without judging it.', 3.5),
        proseBeat('Or to touch — your feet on the floor, your hands resting somewhere.', 3),
        proseBeat('Whatever you\'re carrying is real, and it\'s allowed to be here with you right now.', 3),
        proseBeat('There\'s no timeline for this. You can return to this anchor any time you need to.', 2.5),
    ];
    return {
        id: 'grief',
        category: 'stress',
        name: 'A Meditation for Grief',
        description: 'A steady anchor — breath, sound, or touch — to hold onto inside grief.',
        basis: 'Grounding-anchor mindfulness, the common technique across mindfulness-based approaches to bereavement support.',
        beats,
    };
}
/** Acceptance-based coping with uncertainty/change — distinguishing what
 *  can and can't be controlled is a core CBT/ACT technique, applied here
 *  without any clinical framing. */
function buildChange() {
    const beats = [
        proseBeat('Whatever\'s shifting in your life right now, let\'s make a little space to sit with it.', 2),
        proseBeat('Uncertainty is uncomfortable because it asks you to not know. That discomfort is normal.', 3),
        proseBeat('Ask yourself: what here is actually in my control, right now, today?', 3.5),
        proseBeat('Hold onto that answer, whatever it is, even if it\'s small.', 2.5),
        proseBeat('And what\'s outside your control? Let yourself set that part down, just for these few minutes.', 3.5),
        proseBeat('You don\'t have to solve the whole change today. Just the next small, true step.', 3),
        proseBeat('Breathe in, and as you do, notice you\'re still here, still capable, still standing.', 3.5),
        proseBeat('Change asks a lot. It doesn\'t mean you\'re doing it wrong if it feels hard.', 2.5),
        proseBeat('Carry the one thing you can control with you as you go.', 2),
    ];
    return {
        id: 'change',
        category: 'stress',
        name: 'Adapting to Change',
        description: 'Steadying through uncertainty by separating what you can and can\'t control.',
        basis: 'Acceptance-based coping — distinguishing controllable from uncontrollable, a core technique from CBT/ACT.',
        beats,
    };
}
/** Breath awareness plus a brief body scan — a standard combination for
 *  interrupting a worry spiral by shifting attention onto something
 *  concrete and present. */
function buildAnxiety() {
    const beats = [
        proseBeat('If your mind is racing, that\'s exactly what we\'re here to work with.', 2),
        proseBeat('You don\'t need to stop the thoughts. Just give your attention somewhere else to rest.', 3),
        proseBeat('Start with your breath. Don\'t change it yet — just notice it, in and out.', 3.5),
        breathBeat('Now, in', 'in', 4),
        breathBeat('Hold, gently', 'hold', 2),
        breathBeat('And out, slow', 'out', 5),
        breathBeat('In', 'in', 4),
        breathBeat('Hold', 'hold', 2),
        breathBeat('Out, slow', 'out', 5),
        proseBeat('Now bring attention to your feet. Just the sensation of them, on the floor or against your shoes.', 3.5),
        proseBeat('Up to your hands — resting, however they\'re resting.', 3),
        proseBeat('Your shoulders — see if they can drop, even slightly.', 3),
        proseBeat('If a worry pulls you away, that\'s fine. Just come back to your breath, or your hands, or your feet.', 3.5),
        proseBeat('You\'re here, right now, and right now you\'re okay.', 2.5),
    ];
    return {
        id: 'anxiety',
        category: 'stress',
        name: 'Easing Anxiety',
        description: 'Breath awareness and a brief body scan, to interrupt a worry spiral.',
        basis: 'Breath-focused attention plus body scanning — a standard combination for shifting attention off racing thoughts.',
        beats,
    };
}
/** Kristin Neff's self-compassion break — three components (mindfulness,
 *  common humanity, self-kindness), one of the most widely-studied
 *  structured self-compassion practices. */
function buildSelfCompassion() {
    const beats = [
        proseBeat('Bring to mind something that\'s been hard for you lately. Not the hardest thing — something manageable.', 3),
        proseBeat('First: this is a moment of difficulty. Just say that to yourself, plainly.', 3),
        proseBeat('Second: difficulty is part of being human. You\'re not alone in struggling — everyone does.', 3.5),
        proseBeat('Others have felt what you\'re feeling right now. This connects you to people, not apart from them.', 3.5),
        proseBeat('Third: can you offer yourself some kindness here? Try placing a hand on your chest, if that feels right.', 3.5),
        proseBeat('What do you need to hear right now? Try telling yourself that, in your own words.', 3.5),
        proseBeat('You\'d offer this kindness to a friend without a second thought. You\'re allowed to offer it to yourself.', 3),
        proseBeat('That\'s the whole practice — noticing, remembering you\'re not alone, and being kind about it.', 2.5),
    ];
    return {
        id: 'self-compassion',
        category: 'connection',
        name: 'A Self-Compassion Break',
        description: 'Three steps — mindfulness, common humanity, kindness — for a hard moment.',
        basis: "Kristin Neff's self-compassion break, one of the most widely-studied structured self-compassion practices.",
        beats,
    };
}
/** Loving-kindness (metta) — traditional phrases of goodwill, offered in
 *  stages outward from yourself. Distinct from the self-compassion break
 *  above (which is self-directed only): metta specifically builds warmth
 *  toward others, with its own separate evidence base — Fredrickson et
 *  al. (2008) found sustained loving-kindness practice increased positive
 *  emotion and social connection over weeks of daily use. */
function buildLovingKindness() {
    const beats = [
        proseBeat('Settle in, and let your breathing find its own natural rhythm.', 2),
        proseBeat("We'll offer a few simple phrases of goodwill — first to yourself, then outward.", 2.5),
        proseBeat('Start with yourself. Silently, or quietly: may I be safe.', 3),
        proseBeat('May I be healthy.', 2),
        proseBeat('May I be at ease.', 2),
        proseBeat("However that feels — easy, awkward, anything — that's fine. Keep going.", 3),
        proseBeat('Now bring to mind someone you care about easily. Picture them clearly.', 3),
        proseBeat('Offer them the same: may you be safe.', 2.5),
        proseBeat('May you be healthy.', 2),
        proseBeat('May you be at ease.', 2),
        proseBeat('Now think of someone neutral — someone you neither like nor dislike much. A cashier, a neighbor.', 3.5),
        proseBeat('Offer them the same three: safe, healthy, at ease.', 3),
        proseBeat("This is the harder step, and that's exactly the point — warmth that only reaches people you already love isn't the whole practice.", 3.5),
        proseBeat('Finally, widen it out. May all beings be safe, healthy, and at ease.', 3.5),
        proseBeat("You don't have to feel it perfectly. Offering it at all is the practice.", 2.5),
    ];
    return {
        id: 'loving-kindness',
        category: 'connection',
        name: 'Loving-Kindness',
        description: 'Traditional phrases of goodwill, offered outward from yourself to everyone.',
        basis: 'Metta (loving-kindness meditation) — a traditional practice with its own distinct evidence base; Fredrickson et al. (2008) found sustained practice increased positive emotion and social connection.',
        beats,
    };
}
/** A structured gratitude reflection — specific, not generic, which the
 *  research on gratitude practice consistently finds matters more than
 *  the quantity of things named. */
function buildGratitude() {
    const beats = [
        proseBeat('Let\'s take a few minutes to notice what\'s actually going right, in specific detail.', 2),
        proseBeat('Think of one person who\'s helped you, recently or long ago. Picture them clearly.', 3.5),
        proseBeat('What specifically did they do? Not just "they were kind" — what exactly happened?', 3.5),
        proseBeat('Let yourself really feel that, for a moment.', 2.5),
        proseBeat('Now think of one small thing today that went well. It can be genuinely small.', 3.5),
        proseBeat('And one thing about your own body or mind that you don\'t usually thank — that you\'re grateful works the way it does.', 4),
        proseBeat('Specific gratitude, not general gratitude, is what actually shifts how a day feels.', 3),
        proseBeat('Carry one of these with you — let it be the thing you notice again later today.', 2.5),
    ];
    return {
        id: 'gratitude',
        category: 'connection',
        name: 'A Gratitude Practice',
        description: 'A specific, not generic, reflection on what\'s actually going right.',
        basis: 'Structured gratitude reflection — research on gratitude practice consistently finds specificity matters more than quantity.',
        beats,
    };
}
/** Recalling a real instance of having gotten through something hard —
 *  strengths-recall is a standard resilience-building technique, distinct
 *  from just "thinking positive." */
function buildResilience() {
    const beats = [
        proseBeat('Think of one specific time you got through something genuinely hard.', 3),
        proseBeat('Not the outcome — the getting-through. What did you actually do, day by day?', 3.5),
        proseBeat('Maybe you asked for help. Maybe you just kept showing up. Whatever it was, it worked.', 3.5),
        proseBeat('That capacity is still yours. It didn\'t disappear when that situation ended.', 3),
        proseBeat('Whatever you\'re facing now doesn\'t erase what you\'ve already proven you can do.', 3),
        proseBeat('You don\'t need to feel confident to be resilient. You just need to keep going, your way.', 3),
        proseBeat('Take one breath, and let that memory sit with you as evidence, not just a nice thought.', 3),
    ];
    return {
        id: 'resilience',
        category: 'connection',
        name: 'Building Resilience',
        description: 'Recalling real evidence of your own capacity to get through hard things.',
        basis: 'Strengths-recall, a standard resilience-building technique distinct from generic positive thinking.',
        beats,
    };
}
/** A foundational breath-awareness practice — the "home base" technique
 *  nearly every other mindfulness practice builds on. Deliberately the
 *  simplest thing in this library. */
function buildQuietMind() {
    const beats = [
        proseBeat('Sit comfortably, and let your eyes close, or soften your gaze downward.', 2),
        proseBeat('There\'s nothing to achieve here. Just notice your breath, exactly as it already is.', 3),
        breathBeat('In', 'in', 4),
        breathBeat('Out', 'out', 4),
        breathBeat('In', 'in', 4),
        breathBeat('Out', 'out', 4),
        proseBeat('Your mind will wander. That\'s not a mistake — that\'s just what minds do.', 3),
        proseBeat('When you notice it\'s wandered, just come back to the breath. No judgment, just return.', 3.5),
        breathBeat('In', 'in', 4),
        breathBeat('Out', 'out', 4),
        breathBeat('In', 'in', 4),
        breathBeat('Out', 'out', 4),
        proseBeat('That returning, over and over, is the whole practice. It\'s not a distraction from it.', 3),
        proseBeat('Let your eyes open whenever you\'re ready.', 2),
    ];
    return {
        id: 'quiet-mind',
        category: 'focus',
        name: 'A Quiet Mind',
        description: 'Foundational breath-awareness — the practice nearly everything else builds on.',
        basis: 'Basic mindfulness of breath (anapanasati / breath-focused mindfulness), the foundational technique across most meditation traditions.',
        beats,
    };
}
/** A genuinely brief single-breath reset — for a moment with no time to
 *  spare, not a shortened version of a longer practice. */
function buildQuickReset() {
    const beats = [
        proseBeat('Wherever you are, right now, just pause for a moment.', 1.5),
        breathBeat('One slow breath in', 'in', 4),
        breathBeat('And a slow breath out — longer than the in', 'out', 6),
        proseBeat('That\'s it. One real breath, fully noticed, is worth more than none.', 2.5),
        proseBeat('Back to whatever\'s next, whenever you\'re ready.', 1.5),
    ];
    return {
        id: 'quick-reset',
        category: 'focus',
        name: 'A Quick Reset',
        description: 'One real, fully-noticed breath — for when there\'s genuinely no time to spare.',
        basis: 'A minimal single-cycle extended-exhale breath, the smallest unit of the technique behind every longer breathwork practice here.',
        beats,
    };
}
/** The MBSR body scan — Jon Kabat-Zinn's foundational Mindfulness-Based
 *  Stress Reduction practice, and one of MBSR's two core formal exercises
 *  alongside sitting meditation. Attention moves sequentially through the
 *  body, region by region, simply noticing whatever sensation (or absence
 *  of sensation) is there — no attempt to relax or change anything, which
 *  is what distinguishes it from progressive muscle relaxation below. */
function buildBodyScan() {
    const beats = [
        proseBeat('Lie down or sit somewhere supported, and let your eyes close.', 2),
        proseBeat("We're going to move attention slowly through your body, one region at a time. Nothing to fix, just to notice.", 3),
        proseBeat('Start with your left foot. Toes, the sole, the top of the foot. Whatever is there — warmth, pressure, nothing at all.', 4),
        proseBeat('If you notice nothing, that\'s a real, valid observation too. Just move on.', 3),
        proseBeat('Up to your left ankle and calf. Notice, without trying to change anything you find.', 3.5),
        proseBeat('Your left knee and thigh. Just attention, resting there for a moment.', 3),
        proseBeat('Now the same journey up your right leg — foot, calf, knee, thigh. Take your time.', 3.5),
        proseBeat("Your hips and lower back, wherever they're making contact with what's beneath you.", 3.5),
        proseBeat('Your belly, rising and falling on its own. Your chest, doing the same.', 3),
        proseBeat('Your hands — palms, fingers, the backs of your hands. Then up through your arms to your shoulders.', 4),
        proseBeat('Your neck and throat. Your jaw — a common place to hold tension without noticing.', 3.5),
        proseBeat('Your face — eyes, forehead, scalp. And finally, the whole body at once, as one field of sensation.', 4),
        proseBeat("You didn't need to change anything to do this practice right. Noticing was the entire task.", 3.5),
        proseBeat('Let your eyes open whenever you\'re ready.', 2),
    ];
    return {
        id: 'body-scan',
        category: 'focus',
        name: 'Full Body Scan',
        description: 'Attention moved slowly, region by region, through the whole body.',
        basis: "The MBSR body scan (Jon Kabat-Zinn) — one of Mindfulness-Based Stress Reduction's two core formal practices, alongside sitting meditation.",
        beats,
    };
}
/** Progressive Muscle Relaxation (Edmund Jacobson, 1938) adapted for
 *  pre-sleep wind-down — tensing, then releasing, each major muscle group
 *  in sequence. The deliberate tense/release contrast (not just "relax")
 *  is what distinguishes PMR from the body scan above, and is
 *  well-supported as a pre-sleep technique for reducing the physical
 *  arousal that keeps a racing body from settling into sleep. */
function buildSleepWindDown() {
    const group = (name) => [
        proseBeat(`Now, ${name}. Squeeze — not painfully, just firmly — and hold it.`, 4),
        proseBeat('Hold that tension a moment longer...', 3),
        proseBeat('And release, all at once. Let it go completely loose. Notice the difference.', 6),
    ];
    const beats = [
        proseBeat('Lie down in bed, in whatever position feels right for sleep.', 2),
        proseBeat("We're going to tense, then release, each part of your body in turn. The release is the point — notice how different loose feels from tense.", 4),
        ...group('curl your toes and tighten your feet'),
        ...group('tighten your calves and thighs'),
        ...group('clench your hands into fists and tighten your arms'),
        ...group('press your shoulders up toward your ears'),
        ...group('scrunch your face — eyes, jaw, forehead, all of it'),
        proseBeat('Let your whole body settle now, heavier than before, into whatever is holding you up.', 4),
        breathBeat('One slow breath in through your nose', 'in', 4),
        breathBeat('And a long, slow breath out — let your body sink further', 'out', 7),
        proseBeat('There\'s nowhere else to be right now. Let your mind follow your body toward rest.', 3.5),
    ];
    return {
        id: 'sleep-wind-down',
        category: 'sleep',
        name: 'Wind-Down for Sleep',
        description: 'Tense, then release, each muscle group — a real pre-sleep relaxation technique.',
        basis: "Progressive Muscle Relaxation (Edmund Jacobson, 1938), adapted for pre-sleep wind-down — the tense/release contrast is well-supported for reducing pre-sleep physical arousal.",
        beats,
    };
}
/** 4-7-8 breathing — inhale 4, hold 7, exhale 8. Often called the
 *  "relaxing breath": the extended exhale activates the vagus nerve and
 *  the parasympathetic ("rest and digest") nervous system, with measured
 *  improvements to heart-rate variability and blood pressure in
 *  controlled studies. */
function buildFourSevenEight() {
    const cycle = [breathBeat('Breathe in', 'in', 4), breathBeat('Hold', 'hold', 7), breathBeat('Breathe out', 'out', 8)];
    const beats = [
        proseBeat('Sit with your back reasonably straight, and rest your tongue behind your upper front teeth.', 2.5),
        proseBeat("In through your nose for four, hold for seven, out through your mouth for eight. Follow the ring.", 1.5),
    ];
    for (let i = 0; i < 4; i++)
        beats.push(...cycle);
    beats.push(proseBeat('Let your breathing return to normal. Even a few rounds is real.', 1.5));
    return {
        id: 'four-seven-eight',
        category: 'breathwork',
        name: '4-7-8 Breathing',
        description: 'Inhale 4, hold 7, exhale 8 — often called the "relaxing breath."',
        basis: '4-7-8 breathing, shown in controlled studies to improve heart-rate variability and lower blood pressure via extended-exhale vagal activation.',
        beats,
    };
}
/** Cyclic sighing / the physiological sigh — a double inhale (a long one,
 *  then a short top-up) followed by a long, slow exhale. A 2023 Stanford
 *  study (Balban et al.) found this pattern produced greater mood
 *  improvement than mindfulness meditation itself over a month of daily
 *  practice, and reduced breathing rate more than other techniques
 *  tested. */
function buildPhysiologicalSigh() {
    const cycle = [
        breathBeat('Breathe in through your nose', 'in', 2),
        breathBeat('A second short sip of air, on top', 'in', 1.5),
        breathBeat('Now let it all out, slowly, through your mouth', 'out', 6),
    ];
    const beats = [
        proseBeat('This one has two inhales in a row, then one long exhale. It feels a little unusual — that\'s normal.', 3),
        proseBeat('Breathe in deeply through your nose, then take a second, shorter sip of air on top of it.', 3.5),
        proseBeat('Then let it all go, slowly, through your mouth. Follow the ring.', 2),
    ];
    for (let i = 0; i < 6; i++)
        beats.push(...cycle);
    beats.push(proseBeat('Let your breath settle back to normal. That\'s the whole technique.', 1.5));
    return {
        id: 'physiological-sigh',
        category: 'breathwork',
        name: 'Physiological Sigh',
        description: 'A double inhale, then one long exhale — a fast-acting mood and stress reset.',
        basis: 'Cyclic sighing (the physiological sigh) — a 2023 Stanford study found it improved mood more than mindfulness meditation over a month of daily practice.',
        beats,
    };
}
/** Box (square) breathing — inhale 4, hold 4, exhale 4, hold 4. A
 *  tactical breathing pattern used in military and first-responder
 *  stress-inoculation training — distinct from 4-7-8's longer, more
 *  sedating exhale-dominant pattern: box breathing's four equal phases
 *  make it easier to sustain under real, active stress, which is exactly
 *  the context it was designed for. */
function buildBoxBreathing() {
    const cycle = [
        breathBeat('Breathe in', 'in', 4),
        breathBeat('Hold', 'hold', 4),
        breathBeat('Breathe out', 'out', 4),
        breathBeat('Hold, empty', 'holdEmpty', 4),
    ];
    const beats = [proseBeat('Four equal counts: in, hold, out, hold. Follow the ring.', 2)];
    for (let i = 0; i < 5; i++)
        beats.push(...cycle);
    beats.push(proseBeat("Let your breath return to normal whenever you're ready.", 1.5));
    return {
        id: 'box-breathing',
        category: 'breathwork',
        name: 'Box Breathing',
        description: 'Four equal counts — in, hold, out, hold — a steady pattern built for real stress.',
        basis: 'Box (square) breathing — a tactical breathing technique used in military and first-responder stress-inoculation training for its equal, sustainable phase lengths.',
        beats,
    };
}
export const MEDITATIONS = Object.freeze([
    buildQuietMind(),
    buildBodyScan(),
    buildSadness(),
    buildAnger(),
    buildGrief(),
    buildChange(),
    buildAnxiety(),
    buildSelfCompassion(),
    buildLovingKindness(),
    buildGratitude(),
    buildResilience(),
    buildQuickReset(),
    buildSleepWindDown(),
]);
export const BREATHWORK = Object.freeze([
    buildFourSevenEight(),
    buildPhysiologicalSigh(),
    buildBoxBreathing(),
]);
export const ALL_MEDITATE_SESSIONS = Object.freeze([...MEDITATIONS, ...BREATHWORK]);
export function getMeditateSession(id) {
    return ALL_MEDITATE_SESSIONS.find((s) => s.id === id);
}
const CATEGORY_META = Object.freeze([
    {
        id: 'stress',
        label: 'Working With Stress & Difficult Emotions',
        description: 'RAIN, cognitive reframing, and grounding for anger, anxiety, sadness, grief, and change.',
    },
    {
        id: 'connection',
        label: 'Self-Compassion & Connection',
        description: "Kristin Neff's self-compassion break, loving-kindness, gratitude, and resilience.",
    },
    {
        id: 'focus',
        label: 'Focus & Grounding',
        description: 'Breath-focused attention and the MBSR body scan — the "home base" practices.',
    },
    {
        id: 'sleep',
        label: 'Sleep Prep',
        description: 'Progressive muscle relaxation to wind the body down before sleep.',
    },
    {
        id: 'breathwork',
        label: 'Breathwork',
        description: 'Named, structured breathing patterns — 4-7-8, the physiological sigh, and box breathing.',
    },
]);
/** Every session grouped under its real category, in a fixed, meaningful
 *  order — this, not MEDITATIONS/BREATHWORK, is what the picker UI should
 *  render from. MEDITATIONS/BREATHWORK stay exported for the trend/test
 *  code that only needs the flat "is this a sit or a breathing exercise"
 *  split. */
export const MEDITATE_CATEGORIES = Object.freeze(CATEGORY_META.map((meta) => ({
    ...meta,
    sessions: Object.freeze(ALL_MEDITATE_SESSIONS.filter((s) => s.category === meta.id)),
})));
//# sourceMappingURL=meditations.js.map