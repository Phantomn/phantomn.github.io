/**
 * Font Awesome icons used across the site.
 * Import from here instead of @fortawesome/* to keep icon usage consistent.
 * Add new icons as needed: import from the right FA package, then re-export.
 */
import {
  faBars,
  faDownload,
  faMagnifyingGlass,
  faMoon,
  faSun,
} from "@fortawesome/free-solid-svg-icons";
import {
  faGithub,
  faLinkedin,
  faXTwitter,
} from "@fortawesome/free-brands-svg-icons";

export const icons = {
  bars: faBars,
  download: faDownload,
  magnifyingGlass: faMagnifyingGlass,
  moon: faMoon,
  sun: faSun,
  github: faGithub,
  linkedin: faLinkedin,
  xTwitter: faXTwitter,
} as const;

export type IconName = keyof typeof icons;
