---
title: Instructor notes
---
# Instructor notes

How to run this as a team course. It works as written for a solo learner; this
file is what changes when there are 4–12 engineers and a fixed calendar.

## Shape

- **8 weekly sessions of 45 minutes.** One hour of prep before each: run the
  week's `solutions/lab.py` yourself so you know where the bodies are buried.
- **Everyone does the lab alone.** The sessions are for the *derive* and *break*
  steps, which are the parts that need a room.
- **Split the week's work across the week, not the weekend.** The labs are
  2–3 hours; blocking them into one sitting means nobody finishes.
- **Pair the "explain back" paragraphs.** Written before the session, read aloud
  in 2 minutes, then one question from you. This is your assessment data.

## Session template (45 min)

| Min | Segment |
|---|---|
| 0–5 | Cold open: one question from last week's material, no notes |
| 5–15 | Two people read their "explain back" paragraph; group attacks it |
| 15–25 | Live derive on the whiteboard: one worked number, by hand |
| 25–40 | Break-it demo, run live. Predict first, as a group, then run |
| 40–45 | Hand out next week; name the two traps to expect |

The 25–40 slot is the expensive part and the reason to meet at all. Do not move
it to a recording.

## Checkpoint questions (use verbatim)

**W1** A model reports loss 1.4 nats with a 50k-token vocabulary. What is
perplexity, and why is it not comparable to a model with a 32k vocabulary?

**W2** Your prompt has two spaces after every period. What happens to your token
bill and which of your metrics notice?

**W3** Your model trains fine but the loss is suspiciously low. Give the two most
likely bugs, and the one-line check for each.

**W4** Loss goes flat at 4.1 and nothing improves. Name three causes in the order
you would check them.

**W5** A stakeholder asks for "more creative" output. What do you change, what do
you measure, and what do you refuse to change?

**W6** Your verifier is 96% accurate. What happens to an RLVR run after 2000
steps, and what is the cheapest mitigation?

**W7** p95 latency doubled after adding 4k tokens of retrieval context. What
dominates, and which of your three levers is cheapest?

**W8** Your eval says 82% ± 6% before the change and 85% ± 6% after. Ship or not,
and what do you say in the review?

## Grading rubric (per week, 0–3)

- **3** — tests green, can explain the mechanism, and the break-it writeup
  predicts correctly before observing.
- **2** — tests green, explanation correct but read back from the README.
- **1** — tests green by copying `solutions/`, cannot explain it.
- **0** — tests not green and no diagnosis written.

A 1 is not a pass. The whole point of the course is the explanation, and a
copied lab produces a confident engineer who cannot debug their own pipeline —
which is the failure mode you are trying to avoid hiring.

## Failure modes you will see (and the fix)

| Symptom | Real cause | Fix |
|---|---|---|
| Everything works, nothing is learned | copied solutions | delete `solutions/` from their checkout for a week |
| "Attention is complicated" | skipped the hand calculation | make them do week 3's 3-token example on paper, in the session |
| Loss curve panic | no fixed seed | make determinism a rule: same seed, same loss curve |
| Eval arguments | no intervals | week 8's `sample_size` function, used on their own numbers |
| "Let's just use the API" | they never felt the cost | have them price their own feature with week 7's arithmetic |

## Compressing for a half-day workshop

Keep weeks 1, 3, 5, 8. Use `solutions/` for the code, keep the derives, keep the
break-its (they are 5 minutes each and carry most of the intuition). Drop weeks
2, 4, 6, 7 to reading. That is ~5 hours and gets the four ideas that change how
someone reasons about LLM systems.

## What not to do

- Do not lecture the transformer diagram. They have seen it. Break it instead.
- Do not accept "it works" as a lab report. Ask what it would look like if it
  were wrong.
- Do not run the course without doing the labs yourself. Every week has one trap
  that only shows up when you type it (rank ordering in BPE, `pe == 1` in kappa,
  `q` caching in the KV cache).
