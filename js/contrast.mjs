// How far a colour may step back from the theme's foreground before it stops
// being readable on the theme's background. No Qt; tested with
// `node --test js/`.
//
// The panel asks for a contrast, not for an opacity, and that is the whole
// point. Blending the foreground towards a near-black background barely costs
// contrast; towards a near-white one it collapses. Measured on the running
// shell, one and the same opacity left a secondary label at 5.1:1 on Solitude
// and at 2.8:1 on Catppuccin Latte — readable on the one, not on the other.
// A light/dark switch would only move the guesswork to a threshold; themes sit
// everywhere between, and they also differ in how much room they leave between
// their own foreground and background at all (11:1 against 6.5:1 for those
// two).
//
// `Color.muted` is not the way out: Latte sets it to #acb0be, 1.9:1 on its own
// background.
//
// Colours are QML colors, so { r, g, b } in 0..1.

// WCAG's floors, so the panel can ask for a meaning instead of a number: 4.5:1
// for text at the sizes we use, 3:1 for something you only have to make out.
export const TEXT = 4.5
export const CONTROL = 3

// The contrast ratio of two colours: 1 for a colour against itself, 21 for
// black against white.
export function ratio(a, b) {
  const [dark, light] = [luminance(a), luminance(b)].sort((x, y) => x - y)
  return (light + 0.05) / (dark + 0.05)
}

// `foreground` laid over `background` at `alpha`, which is what painting it at
// that opacity comes to.
export function mix(foreground, background, alpha) {
  const channel = (key) => foreground[key] * alpha + background[key] * (1 - alpha)
  return { r: channel("r"), g: channel("g"), b: channel("b") }
}

// What the panel paints its quieter things at where a theme leaves the room:
// a stepped-back label, the scroll bar, and something you cannot press. These
// were picked by eye on a dark theme. The floors above are what keeps them
// honest on every other one.
const QUIET = 0.62
const MARK = 0.55
const INERT = 0.35

// Those three for a given theme, each raised until it clears its floor. A
// floor is a floor and not a target: on a theme with room to spare the chosen
// strength stands, and only where the theme is tight does it give way.
export function strengths(foreground, background) {
  const raised = (wanted, minimum) => Math.max(wanted, alphaFor(foreground, background, minimum))
  return {
    quiet: raised(QUIET, TEXT),
    mark: raised(MARK, CONTROL),
    inert: raised(INERT, CONTROL),
  }
}

// The smallest opacity at which `foreground` still stands at `minimum` against
// `background` — the quietest the colour is allowed to be. 1 when the
// foreground does not reach `minimum` by itself, because then there is nothing
// to give away.
export function alphaFor(foreground, background, minimum) {
  if (ratio(foreground, background) < minimum) return 1
  // Contrast grows with the opacity, so the answer can be cornered. Twenty
  // halvings put it well inside a 1/255 step of a channel.
  let low = 0
  let high = 1
  for (let i = 0; i < 20; i++) {
    const middle = (low + high) / 2
    if (ratio(mix(foreground, background, middle), background) < minimum) low = middle
    else high = middle
  }
  return high
}

// sRGB relative luminance, the one the contrast ratio is defined on.
function luminance(color) {
  const linear = (value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b)
}
