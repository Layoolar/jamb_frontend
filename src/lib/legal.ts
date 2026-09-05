/**
 * Links to the published policies.
 *
 * App Store 5.1.1(i) requires the privacy policy to be reachable from inside
 * the app, not only from the store listing. These are surfaced at sign-up and
 * in Profile; removing either surface is a rejection, not a tidy-up.
 *
 * The rules page is here too because the Terms fold it in by reference, and it
 * is the page that answers "is this gambling?" for anyone who asks.
 */

import { Linking } from 'react-native';

/**
 * The live policy site. Verified serving /privacy, /terms and
 * /competition-rules on 05 Sep 2026.
 *
 * Deliberately NOT sabipass.com — that domain is not ours and currently serves
 * a HugeDomains "for sale" page. Sending a reviewer there would fail 5.1.1(i)
 * more comprehensively than having no link at all.
 *
 * When the real domain lands, change this line or set EXPO_PUBLIC_SITE_URL.
 * The store listing's privacy-policy URL has to be updated to match.
 */
const SITE = (
  process.env.EXPO_PUBLIC_SITE_URL ?? 'https://jamb-web-sandy.vercel.app'
).replace(/\/$/, '');

export const LEGAL = {
  privacy: `${SITE}/privacy`,
  terms: `${SITE}/terms`,
  rules: `${SITE}/competition-rules`,
} as const;

/**
 * Opens a policy in the system browser.
 *
 * Silent on failure: a browser that refuses to open is not worth an error
 * dialog thrown across a half-finished sign-up.
 */
export async function openLegal(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    // Nothing useful to say and nothing for the user to do about it.
  }
}
