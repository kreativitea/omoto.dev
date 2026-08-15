/**
 * Parallel-track timeline.
 *
 * Two careers run down the page against one shared time axis — paid work on one
 * side, community work on the other — so the fact that they overlap is visible
 * rather than something the reader has to work out from dates.
 *
 * Two things make this more than absolute positioning:
 *
 *   1. Concurrent roles must not collide. Discover Nikkei runs from 2018 to now,
 *      straight through ACCJ, Waffle, COPANI and Hackbright. Bars are packed
 *      into lanes with the classic greedy interval algorithm: sort by start,
 *      then drop each into the first lane whose last bar has already ended.
 *
 *   2. Some roles are genuinely both. A working advisory sits in neither column
 *      honestly, so `track: "both"` straddles the axis instead of picking a side.
 */

/** "2019-12" | "2019" | "" (present) → fractional year, e.g. 2019.917 */
function toYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const [y, m] = String(value).split('-').map(Number);
  return y + (m ? (m - 1) / 12 : 0);
}

/**
 * Greedy interval packing. Returns the lane index for each entry, and the
 * total lane count needed.
 *
 * Entries are sorted most-recent-first for display, but packed in start order,
 * which is what makes the greedy choice optimal.
 */
function assignLanes(entries, now, minSpan = 0) {
  // Pack against the space the *label* needs, not just the dates. A four-month
  // role is an 11px bar carrying a ~50px label, so two short consecutive roles
  // collide on screen even though they never overlap in time. Padding each
  // interval to a minimum visual length pushes those onto separate lanes.
  const packed = entries
    .map((e, i) => {
      const from = toYear(e.start);
      const to = toYear(e.end) ?? now;
      return { i, from, to: Math.max(to, from + minSpan) };
    })
    .sort((a, b) => a.from - b.from);

  const laneEnds = [];           // last occupied year per lane
  const lanes = new Array(entries.length).fill(0);

  for (const item of packed) {
    // first lane that is free by the time this one starts
    let lane = laneEnds.findIndex((end) => end <= item.from);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = item.to;
    lanes[item.i] = lane;
  }
  return { lanes, laneCount: Math.max(1, laneEnds.length) };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** First line of detail for the expanded state. */
function detailOf(e) {
  return e.note || (e.bullets && e.bullets[0]) || '';
}

/* The design height of the track, in px, matching --tl-height in the CSS.
   Card fitting has to happen at build time, so this is the one number both
   sides have to agree on. */
const TRACK_PX = 480;

/**
 * Estimated rendered height of a card, so we can decide at build time whether
 * it fits without colliding. Deliberately a slight over-estimate — being wrong
 * in this direction collapses a card that might just have fitted, which is far
 * better than two cards overlapping.
 */
function cardHeight(e, expanded) {
  const lines = (s, per) => Math.max(1, Math.ceil(String(s || '').length / per));
  if (!expanded) return 20;                      // org, clipped to one line
  let h = 12 + lines(e.role, 18) * 19 + lines(e.org, 20) * 17 + 15;
  const d = detailOf(e);
  if (d) h += Math.min(3, lines(d, 22)) * 15;   // 3 = the CSS line-clamp
  return h;
}

/** A human label for the span, e.g. "2019 – 2025" or "2018 – now". */
function spanLabel(e) {
  const a = String(e.start).slice(0, 4);
  const b = e.end ? String(e.end).slice(0, 4) : 'now';
  return a === b ? a : `${a} – ${b}`;
}

/**
 * @param {object} cv       parsed _data/cv.json
 * @param {number} nowYear  the present, as a fractional year
 */
export function timeline(cv, nowYear) {
  const all = [
    ...cv.experience.map((e) => ({ ...e, track: e.track || 'career' })),
    ...cv.community.map((e) => ({ ...e, track: e.track || 'community' })),
  ].filter((e) => e.start);

  const now = nowYear;
  const starts = all.map((e) => toYear(e.start));
  const ends = all.map((e) => toYear(e.end) ?? now);
  const min = Math.floor(Math.min(...starts));
  const max = Math.ceil(Math.max(...ends));
  const span = max - min;

  // Pack each side independently; "both" is packed with neither, since it
  // occupies the middle and cannot collide with either column.
  const groups = {
    career: all.filter((e) => e.track === 'career'),
    both: all.filter((e) => e.track === 'both'),
    community: all.filter((e) => e.track === 'community'),
  };

  // Compact is a single line — just the organisation — so the packer only has
  // to keep one line of clearance. The expanded card is raised above its
  // neighbours rather than pushing them aside, so it needs no room reserved.
  const minSpan = (24 / 480) * span;

  const rendered = {};
  for (const [track, entries] of Object.entries(groups)) {
    const { lanes, laneCount } = assignLanes(entries, now, minSpan);

    // Expanded by default; collapse only where a card would run into the next
    // one in its lane. Space is claimed in importance order, so when two
    // compete the more important one keeps its detail.
    const byLane = {};
    entries.forEach((e, i) => (byLane[lanes[i]] ||= []).push(i));
    const openState = new Array(entries.length).fill(false);

    for (const idxs of Object.values(byLane)) {
      const pos = (i) => (toYear(entries[i].start) - min) / span;
      const ordered = [...idxs].sort((a, b) => pos(a) - pos(b));
      const claimed = [];                        // [top, bottom] already taken
      const byImportance = [...idxs].sort(
        (a, b) => (entries[a].importance ?? 99) - (entries[b].importance ?? 99));

      for (const i of byImportance) {
        const top = pos(i) * TRACK_PX;
        const next = ordered[ordered.indexOf(i) + 1];
        const limit = next === undefined ? TRACK_PX : pos(next) * TRACK_PX;
        const want = cardHeight(entries[i], true);
        const fitsBelow = top + want <= limit;
        const clashes = claimed.some(([t, b]) => top < b && top + want > t);
        if (fitsBelow && !clashes) {
          openState[i] = true;
          claimed.push([top, top + want]);
        } else {
          claimed.push([top, top + cardHeight(entries[i], false)]);
        }
      }
    }

    rendered[track] = { laneCount, html: entries.map((e, i) => {
      const from = (toYear(e.start) - min) / span;
      const to = (( toYear(e.end) ?? now) - min) / span;
      const lane = lanes[i];
      const ongoing = !e.end;
      const open = openState[i];
      // Compact by default so bars stay legible at a glance; the detail is in
      // the DOM (so it is read by screen readers and found by ctrl-F) and is
      // revealed on hover, focus or tap rather than injected on scroll.
      return `<li class="tl-bar${ongoing ? ' is-ongoing' : ''}${open ? ' is-open' : ''}"
        style="--from:${from.toFixed(4)};--to:${to.toFixed(4)};--lane:${lane};--lanes:${laneCount}">
        <span class="tl-bar-line" aria-hidden="true"></span>
        <button type="button" class="tl-bar-body">
          <span class="tl-bar-org">${esc(e.org)}</span>
          <span class="tl-bar-more">
            <b>${esc(e.role)}</b>
            <span class="tl-bar-when">${esc(spanLabel(e))}</span>
            ${detailOf(e) ? `<span class="tl-bar-detail">${esc(detailOf(e))}</span>` : ''}
          </span>
        </button>
      </li>`;
    }).join('\n') };
  }

  // A tick every other year, plus both ends.
  const ticks = [];
  for (let y = min; y <= max; y++) {
    if ((y - min) % 3 !== 0 && y !== max) continue;
    ticks.push(`<li class="tl-tick" style="--at:${((y - min) / span).toFixed(4)}"><span>${y}</span></li>`);
  }

  return `<div class="tl" style="--span:${span}">
  <div class="tl-col tl-col--career">
    <h3 class="tl-head">Career</h3>
    <ul class="tl-bars" style="--lanes:${rendered.career.laneCount}">
${rendered.career.html}
    </ul>
  </div>

  <div class="tl-axis"><ul class="tl-ticks">${ticks.join('')}</ul></div>

  <div class="tl-col tl-col--community">
    <h3 class="tl-head">Community</h3>
    <ul class="tl-bars" style="--lanes:${rendered.community.laneCount}">
${rendered.community.html}
    </ul>
  </div>

  ${rendered.both.html ? `<ul class="tl-bars tl-bars--both">\n${rendered.both.html}\n  </ul>` : ''}
</div>`;
}

export { assignLanes, toYear };
