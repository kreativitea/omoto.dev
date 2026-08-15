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

function assignLanes(entries, now) {
  const packed = entries
    .map((e, i) => ({ i, from: toYear(e.start), to: toYear(e.end) ?? now }))
    .sort((a, b) => a.from - b.from);

  const laneEnds = [];
  const lanes = new Array(entries.length).fill(0);
  for (const item of packed) {
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
    const { lanes, laneCount } = assignLanes(entries, now);
    const bars = entries.map((e, i) => {
      // The axis runs newest at the top, oldest at the bottom, matching the
      // order the detail column is read in. So a bar's TOP is its end date and
      // its BOTTOM is its start — the inverse of the obvious mapping.
      const from = (max - (toYear(e.end) ?? now)) / span;
      const to = (max - toYear(e.start)) / span;
      const kind = e.kind ? ` is-${e.kind}` : '';
      return `      <li class="track-bar${e.end ? '' : ' is-ongoing'}${kind}" data-key="${keyOf(e)}"
        style="--from:${from.toFixed(4)};--to:${to.toFixed(4)};--lane:${lanes[i]};--lanes:${laneCount}">
        <span class="track-line" aria-hidden="true"></span>
        <span class="track-label">${esc(e.org)}<i>${esc(spanLabel(e))}</i></span>
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

export { assignLanes, toYear };
