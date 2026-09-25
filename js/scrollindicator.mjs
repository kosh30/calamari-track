// Where a thin scroll indicator's thumb sits beside a scrolling area, so a
// page taller than its window says so. No Qt; tested with `node --test js/`.
//
// Both inputs come from Flickable's visibleArea: `position` is yPosition, the
// share of the content above the window, and `ratio` is heightRatio, the share
// of the content the window shows. Does everything fit (ratio 1), there is
// nothing to indicate and nothing is drawn — the page then looks exactly as it
// did before there was an indicator.

// The thumb in a `track` px tall run, at least `floor` px long so a very long
// page still shows a thumb rather than a dot.
export function thumb(position, ratio, track, floor) {
  if (!isFinite(position) || !isFinite(ratio) || !isFinite(track) || !isFinite(floor)) return hidden()
  if (ratio <= 0 || ratio >= 1 || track <= 0) return hidden()
  const height = Math.min(track, Math.max(floor, ratio * track))
  return { visible: true, y: clamp(position * track, 0, track - height), height: height }
}

function hidden() {
  return { visible: false, y: 0, height: 0 }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max))
}
