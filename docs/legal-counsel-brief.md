# Legal counsel brief - Astroid Lounge (DRAFT, pending engagement)

> **Status:** drafted 2026-04-22, **not yet sent**.
> Send this to a gaming/crypto-aware lawyer when you're ready to engage.
> Estimated cost for the first round: ~$1.5-3k NZD for a 2-3 hour
> engagement; pick a NZ-based crypto/gaming practice (Glaister Ennor,
> MinterEllisonRuddWatts, or Lane Neave all have crypto practices).
>
> The full reasoning behind every line below is in the chat thread that
> built out the Lounge skeleton. The short version: this brief is
> structured as facts + specific yes/no questions, because that gets
> sharper answers than "am I able to do this?"

---

## Why this brief exists

You drafted a quick version of this question and asked me to sanity-check it
before sending. The original was internally inconsistent (mentioned "fees" in
a no-buy-in product) and missing context the lawyer needs to give a useful
answer. This is the rewritten version. Use it as-is, or trim if the lawyer
prefers a tighter intake.

## Operator profile (fill in before sending)

- **Operating entity:** [PRÓSPERA ENTITY NAME], registered in [JURISDICTION]
- **In-flight gaming licence:** [JURISDICTION], status: [pending / drafting / etc.]
- **My personal residence:** New Zealand
- **Token under discussion:** $ASTROID, SPL token on Solana mainnet, mint
  `8NwtzwGm4CV8Hm4fJXR69ac1MxDYuSaN3A9HVyikpump`

## Brief to send to counsel

I'm helping a Solana token project ($ASTROID) and want to operate a community
freeroll poker product through my [Próspera-registered entity name]. I'm
personally NZ-resident.

**Mechanics:**

- Texas Hold'em, multi-table tournament format only (no cash games).
- **No buy-in, no fees, no rake.** No player ever pays the operator anything
  to play.
- Prize pools are funded exclusively from the $ASTROID project treasury (~$[X]
  USDC per tournament). The operator does not collect any player-paid amount
  and does not retain any portion of the prize pool.
- Entry is gated on holding $ASTROID (an SPL token freely traded on DEXs).
  The token is *held* by the player, *not consumed* at entry, *not
  transferred to the operator*, and was *not sold by the operator at an entry
  price*. Holding is a community-membership signal, not consideration.
- Players self-custody throughout. The operator never holds player funds.
  Prize payouts are signed by the operator (multisig) to winners' wallets
  after each tournament.
- The codebase is open-source from day one (decentralization posture: anyone
  can fork and run a frontend; protocol behaviour is auditable on-chain).

**Compliance baseline already in place:**

- Geoblocking at the network edge: OFAC-sanctioned countries; gambling-restricted
  countries (FR, SG, AE, etc.); my own country **NZ** (deliberately, to remove
  operator-home exposure); UK and AU; restricted US states (NV, NY, WA, MI, ID).
- Self-attestation door check: age 18+/21+, location, US-Person status,
  promotional-drop understanding.
- Promotional-drop framing: prizes are "promotional appreciation drops at
  operator discretion," not "winnings."
- I have a separate poker licence application in flight in [JURISDICTION] -
  status: [pending / drafting / etc.].

**Questions I'd like you to answer:**

1. Does this product, as described, constitute "remote interactive gambling"
   under the NZ Gambling Act 2003? Is the freeroll structure plus geoblock-of-NZ
   enough to put it outside the Act's scope?
2. Does my personal NZ residence create exposure that the offshore entity does
   not shield against? If so, what mitigations should I add?
3. Does token-holding-as-entry-gate constitute "consideration" under any of:
   NZ, US (federal sweepstakes case law), UK, AU, EU?
4. Does the in-flight poker licence application affect this? Should I pause it,
   fold this into it, or operate the freeroll independently of it?
5. What licences (if any) does the [Próspera] entity need to operate this as
   described?
6. What AML/CFT registration or obligations apply to the entity? To me
   personally?
7. Are there marketing restrictions I need to follow even though the site is
   geoblocked (e.g., social media targeting, influencer relationships)?
8. Is $ASTROID at risk of being classified as a security in any jurisdiction
   in a way that would change the consideration analysis above?
9. Open-source-from-day-one - does this materially help my legal posture, or
   is it neutral?
10. What ongoing record-keeping, reporting, or audit obligations apply?

---

## Pre-send checklist (5-min sanity pass)

Before pasting the brief above into an email or intake form:

- [ ] Replace `[PRÓSPERA ENTITY NAME]` and `[JURISDICTION]` (3 places)
- [ ] Replace `[X]` with realistic per-tournament prize pool size in USDC
- [ ] Replace the in-flight licence `[JURISDICTION]` and status
- [ ] Confirm the geoblock list still matches what's in
      [`app/lib/geoblock.ts`](../app/lib/geoblock.ts) (it may drift between
      this brief and the live code)
- [ ] Decide whether to attach a link to the GitHub repo so the lawyer can
      see the open-source claim is real (recommended)

## What to do with the answer

When the lawyer responds, three artefacts come out of it:

1. **A "go / no-go / change X first" verdict** - record this in
   `docs/legal-counsel-response.md` (create then) so the reasoning is
   preserved with the code.
2. **The entity name + jurisdiction string** to wire into the
   `LegalEntity` config block I deferred building (item 3 from the
   earlier todo). Once you have it, I can add it in 15 minutes and it
   will surface across the footer, ToS, and Privacy automatically.
3. **A counsel-reviewed ToS + Privacy** to replace the placeholder
   stubs at [`app/terms/page.tsx`](../app/terms/page.tsx) and
   [`app/privacy/page.tsx`](../app/privacy/page.tsx). The placeholder
   banners on those pages are loud red on purpose - so they can't ship
   accidentally.
