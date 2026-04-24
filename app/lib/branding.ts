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
  productTagline: 'A token-gated freeroll poker room for $ASTROID holders.',

  legalName: 'Astroid Lounge (community amenity supported by the Astroid project)',

  headlineCopy:
    'Free to enter. Funded by the project. Built for the community.',

  subheadCopy:
    'Hold $ASTROID, sit down at a table, play for prizes funded by the ' +
    'project treasury. The Lounge is freeroll only - we never charge you ' +
    'to play and we never accept buy-ins.',

  parentRelationship:
    'Astroid Lounge is supported in the background by the Astroid project ' +
    '(astroid.space). The Lounge is not a charity, is not affiliated with ' +
    'any hospital, and never solicits donations. Prize pools come from the ' +
    'project treasury, not from player money.',
} as const;
