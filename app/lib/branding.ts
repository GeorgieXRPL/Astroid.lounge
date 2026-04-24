/**
 * @fileoverview Single source of truth for Lounge brand strings.
 *
 * The Lounge is a SEPARATE brand from astroid.space. We do not reuse
 * Astroid's logo, palette, or copy directly - the brands relate the
 * way (e.g.) Twitch and Amazon relate. Astroid is the parent project;
 * the Lounge is a community amenity supported in the background.
 *
 * If you find yourself adding a parent-brand reference here, ask
 * whether the Lounge can stand on its own first.
 */
export const branding = {
  productName: 'Astroid Lounge',
  productShortName: 'Lounge',
  productTagline:
    'A token-gated freeroll poker room for $ASTROID holders. Promotional ' +
    'appreciation drops, awarded at operator discretion.',

  legalName: 'Astroid Lounge (community amenity supported by the Astroid project)',

  headlineCopy:
    'Free to enter. No buy-ins. Built for the community.',

  /**
   * Wording note: every reference to "prizes" elsewhere in the UI
   * routes through this string (or its `*Promotional*` siblings) so
   * the legal framing stays consistent. The Lounge does not "pay
   * winnings" - it issues "promotional appreciation drops" at the
   * operator's discretion. That distinction is small in plain
   * English and large in regulatory English.
   */
  subheadCopy:
    'Hold $ASTROID, sit down at a table, and you may receive a promotional ' +
    'appreciation drop from the Astroid project treasury. The Lounge is ' +
    'freeroll only - we never charge you to play, never accept buy-ins, ' +
    'and any drop is at the operator\u2019s discretion, not a contractual ' +
    'right earned by play.',

  promotionalDisclosure:
    'Drops are promotional, not winnings. They are sponsored by the Astroid ' +
    'project treasury as a thank-you to community members and may be paused, ' +
    'modified, or cancelled at any time without notice. Holding $ASTROID is ' +
    'not an entry fee, not consideration, and not an investment in the Lounge.',

  parentRelationship:
    'Astroid Lounge is supported in the background by the Astroid project ' +
    '(astroid.space). The Lounge is not a casino, is not a charity, is not ' +
    'affiliated with any hospital, and never solicits donations. Promotional ' +
    'drops come from the project treasury, not from player money.',
} as const;
