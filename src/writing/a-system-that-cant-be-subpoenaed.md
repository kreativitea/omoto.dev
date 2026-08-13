---
title: A system that can’t be subpoenaed
date: 2026-07-30
summary: Four years moving location history to the device, and what privacy by design costs once it has to survive a launch review.
drafts: 6
touched: 2 Aug
draft: true
wash:
  seed: subpoena-2026
  palette: sumi
---

<!--
  PLACEHOLDER. Written by Claude from the June 2026 CV, in an approximation of
  Mike's voice — these are not his words. Rewrite before removing `draft: true`.
-->

The cheapest way to protect a location history is to never let it leave the phone. That sentence
took four years to ship.

Every surface in Maps that asks you to review a place you have just visited used to work by asking
a server what you had been doing lately. The server knew, so the server could be compelled to say.

## What changed

The targeting model moved onto the device. The server stopped answering *where has this person
been* and started answering *here are the places within a region, ranked*. The phone does the
intersection locally and never reports the result back.

- Candidate places are fetched by coarse region, not by trajectory.
- Matching happens client-side against on-device history.
- Only the interaction is logged — never the reason it was shown.

> A geofence warrant asks a company to turn over everyone who was near a place at a time. You
> cannot comply with a question you have made yourself unable to answer.

## What it costs

The cost is real and it arrives before the benefit. Solicitation volume — the metric the team is
judged on — falls for two quarters while the model relearns on a smaller feature set. The only way
through is to have written down, in advance and in front of witnesses, how large you expected the
dip to be and how long you would tolerate it.

We did. It recovered in five months, and the legal exposure went to zero, which is a number that
appears on no dashboard I was ever reviewed against.
