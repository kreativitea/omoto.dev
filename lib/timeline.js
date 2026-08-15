/**
 * Work-history rail.
 *
 * The detail is the page; this is orientation beside it. A narrow sticky rail
 * shows both careers against one time axis — paid work on one side, community
 * on the other — so the overlap stays visible without competing with the
 * reading column for space.
 *
 * Bars carry no permanent labels. Cramming role and organisation into a narrow
 * rail is what turned the previous attempt into a cluttered chart rather than a
 * work history; here the label belongs to whichever entry you are actually
 * reading, and the page highlights it as you scroll.
 *
 * Concurrent roles are packed into lanes with the classic greedy interval
 * algorithm — sort by start, drop each into the first lane already free —
 * because Discover Nikkei alone runs through four other commitments.
 */

/** "2019-12" | "2019" → fractional year. null/empty means ongoing. */
function toYear(value) {
  if (value === null || value === undefined || value === '') return null;
  const [y, m] = String(value).split('-').map(Number);
  return y + (m ? (m - 1) / 12 : 0);
}

/**
 * Work out which lane each entry occupies, moment by moment.
 *
 * A bar is not committed to one lane for its whole life. Lanes are packed
 * against the spine and recomputed at every event, so a bar pushed outward by
 * an overlap steps back in as soon as that overlap clears: Discover Nikkei
 * starts in lane 1 behind Hackbright and moves to lane 0 the moment Hackbright
 * ends. Distance from the centre then means something at every height — how
 * much else was running at that time — instead of recording which bar happened
 * to claim a lane first.
 *
 * Returns one array of {from, to, lane} segments per entry. Consecutive
 * segments at the same lane are merged, so a bar that never moves is a single
 * segment and renders as a plain straight line.
 */
function laneSegments(entries, now) {
  // A point in time — a degree year with no stated span — has zero duration, so
  // no slice would ever contain it and it would render as nothing at all. Give
  // those a hairline width purely so they take part in the packing; the drawn
  // length comes from the CSS floor, not from this.
  const POINT = 0.05;
  const iv = entries.map((e, i) => {
    const from = toYear(e.start);
    return { i, from, to: Math.max(toYear(e.end) ?? now, from + POINT) };
  });
  const times = [...new Set(iv.flatMap((v) => [v.from, v.to]))].sort((a, b) => a - b);
  const segs = entries.map(() => []);

  for (let t = 0; t < times.length - 1; t++) {
    const a = times[t], b = times[t + 1];
    // Everything running across this slice, packed inward in start order so the
    // longest-standing commitment holds the innermost lane.
    const active = iv
      .filter((v) => v.from <= a && v.to >= b)
      .sort((x, y) => x.from - y.from || x.i - y.i);

    active.forEach((v, lane) => {
      const last = segs[v.i][segs[v.i].length - 1];
      if (last && last.lane === lane && Math.abs(last.to - a) < 1e-9) last.to = b;
      else segs[v.i].push({ from: a, to: b, lane });
    });
  }

  const laneCount = Math.max(1, ...segs.flat().map((s) => s.lane + 1));
  return { segs, laneCount };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Stable id shared by a rail bar and its detail entry, so the two can be linked.
 *
 * Falls back to a slug of the organisation, but an entry may set `key`
 * explicitly — necessary as soon as one organisation appears twice. Code
 * Chrysalis is both a seven-year volunteer commitment and, since July, paid
 * advisory work; slugging the org alone would give both the same id and the
 * highlight would silently track only one of them.
 */
export function keyOf(entry) {
  if (entry && entry.key) return String(entry.key);
  return String(entry.org).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function spanLabel(e) {
  const a = String(e.start).slice(0, 4);
  const b = e.end ? String(e.end).slice(0, 4) : 'now';
  return a === b ? a : `${a}–${b}`;
}

/**
 * @param {object} cv       parsed _data/cv.json
 * @param {number} nowYear  the present, as a fractional year
 */
export function timeline(cv, nowYear) {
  const all = [
    ...cv.experience.map((e) => ({ ...e, track: e.track || 'career' })),
    // Schooling sits under the career track — same side, and after the axis
    // inversion below it lands at the bottom, which is where it belongs both
    // chronologically and in the reading.
    ...(cv.education || []).map((e) => ({
      ...e, org: e.school, role: e.credential, track: 'career', kind: 'education',
    })),
    ...cv.community.map((e) => ({ ...e, track: e.track || 'community' })),
  ].filter((e) => e.start);

  const now = nowYear;
  const min = Math.floor(Math.min(...all.map((e) => toYear(e.start))));
  const max = Math.ceil(Math.max(...all.map((e) => toYear(e.end) ?? now)));
  const span = max - min;

  const groups = {
    career: all.filter((e) => e.track === 'career'),
    both: all.filter((e) => e.track === 'both'),
    community: all.filter((e) => e.track === 'community'),
  };

  const renderTrack = (entries, track) => {
    if (!entries.length) return '';
    const { segs, laneCount } = laneSegments(entries, now);

    // The axis runs newest at the top, so a later year maps to a smaller y.
    const y = (year) => (max - year) / span;

    const bars = entries.map((e, i) => {
      const parts = segs[i];
      const kind = e.kind ? ` is-${e.kind}` : '';
      const k = keyOf(e);

      const lines = parts.map((s) =>
        `<span class="track-seg" style="--top:${y(s.to).toFixed(4)};` +
        `--bot:${y(s.from).toFixed(4)};--lane:${s.lane}"></span>`).join('');

      // Where a bar changes lane, a short horizontal run joins the two
      // verticals so it reads as one continuous mark stepping inward.
      const jogs = parts.slice(1).map((s, n) => {
        const prev = parts[n];
        const lo = Math.min(prev.lane, s.lane);
        const width = Math.abs(prev.lane - s.lane);
        return `<span class="track-jog" style="--at:${y(s.to === prev.from ? s.to : prev.to).toFixed(4)};` +
               `--lane:${lo};--width:${width}"></span>`;
      }).join('');

      // The label belongs at the bar's newest end, on whichever lane it sits in
      // there — that is where the eye arrives when reading downward.
      const head = parts.reduce((best, s) => (y(s.to) < y(best.to) ? s : best), parts[0]);

      return `      <li class="track-bar${e.end ? '' : ' is-ongoing'}${kind}" data-key="${k}"
        style="--label-at:${y(head.to).toFixed(4)};--label-lane:${head.lane}">
        <a class="track-hit" href="#${k}">
          ${lines}${jogs}
          <span class="track-label">${esc(e.org)}<i>${esc(spanLabel(e))}</i></span>
        </a>
      </li>`;
    }).join('\n');

    return `    <ul class="track-bars track-bars--${track}" style="--lanes:${laneCount}">\n${bars}\n    </ul>`;
  };

  const ticks = [];
  for (let y = min; y <= max; y++) {
    if ((y - min) % 3 !== 0 && y !== max) continue;
    ticks.push(`<li style="--at:${((max - y) / span).toFixed(4)}"><span>${y}</span></li>`);
  }

  return `<aside class="worktrack" aria-label="Career and community over time">
  <p class="track-key"><span class="track-key--career">Career</span><span class="track-key--community">Community</span></p>
  <div class="track-body">
${renderTrack(groups.career, 'career')}
    <ul class="track-ticks">${ticks.join('')}</ul>
${renderTrack(groups.community, 'community')}
${renderTrack(groups.both, 'both')}
  </div>
</aside>`;
}

export { laneSegments, toYear };
