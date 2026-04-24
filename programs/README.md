# `programs/` - Solana on-chain payouts (SCAFFOLD)

> This directory holds the optional Solana program for trust-minimised
> drop payouts. **It is a scaffold. It must not be deployed to mainnet
> in its current state.**

## What lives here

```
programs/
  astroid-lounge-payouts/        Anchor program in Rust
    src/lib.rs                   instruction set + account layouts
    Cargo.toml                   crate manifest
    Xargo.toml                   BPF target tweaks
  client/                        TypeScript client + tests (TBD)
```

## Why bother with an on-chain payout layer at all?

The Lounge can ship a perfectly functional v1 with off-chain payouts: the
operator signs a USDC transfer to each winner from a hardware wallet
once a tournament concludes. That is fast, cheap, and requires no audit.

The on-chain program exists for the case where the operator wants to
*remove themselves from the payout decision* once a tournament is
funded. That move buys two things:

1. **Stronger "no operator discretion at payout time"** posture for the
   ToS/legal framing. The operator funds a vault, declares the winner
   list, and from that moment forward winners self-claim deterministic
   shares. The operator cannot redirect, withhold, or reassign funds.
2. **A cleaner audit trail.** Every claim is an on-chain event. Hand
   history can be reconciled against payouts trivially.

Trade-offs:

- Audit cost: ~ $15-40k USD for a reputable Solana auditor.
- Less flexibility for edge cases (chip-chops, disconnect refunds).
- Operator must run a real multisig (e.g. Squads) - the program
  trusts the `operator` pubkey for state transitions, so single-key
  custody is unacceptable.

## Status

| Component | Status |
| --------- | ------ |
| `initialize_tournament` | scaffolded |
| `fund_tournament` | scaffolded |
| `set_winners` | scaffolded |
| `claim_prize` | scaffolded |
| `cancel_tournament` | scaffolded |
| Claim window / sweep timer | NOT IMPLEMENTED |
| Token-2022 support | NOT IMPLEMENTED (classic SPL only) |
| TypeScript client | NOT IMPLEMENTED |
| Integration tests | NOT IMPLEMENTED |
| Security audit | NOT STARTED |
| Lawyer review of on-chain payout flow | NOT STARTED |

## Pre-deploy checklist

Before this program touches mainnet, **all of the following** must be
true. No exceptions, no shortcuts.

- [ ] Third-party audit (OtterSec, Neodyme, Halborn, or equivalent) has
      signed off on the program.
- [ ] All audit findings fixed; re-review obtained.
- [ ] TypeScript client + integration test suite covers every
      instruction across every reachable status transition.
- [ ] Operator authority is a multisig (Squads or equivalent) - **not**
      a single-key wallet.
- [ ] Program ID has been generated with `anchor keys list` and the
      placeholder in `lib.rs` + `Anchor.toml` has been replaced.
- [ ] Program is deployed first to devnet, then to mainnet only after a
      full month of devnet integration testing with real flow.
- [ ] Counsel has reviewed: that on-chain deterministic payouts are
      compatible with the "operator discretion" framing in the Lounge
      ToS, that winners self-claiming doesn't change the regulatory
      posture, and that the licence application (when issued)
      contemplates an on-chain payout vehicle.
- [ ] Upgrade authority is intentionally chosen (immutable / multisig
      / dao) and documented.

## Local toolchain bootstrap

```bash
# Install Rust + Solana + Anchor (one-time, takes a while)
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.31.1 && avm use 0.31.1

# Build (from repo root)
anchor build

# Test against a local validator
anchor test
```

The Anchor toolchain is **not** required to develop the rest of the
Lounge. The Next.js app builds and runs without any Solana toolchain
installed. This program is opt-in for whoever picks up the on-chain
payout work.

## Where the off-chain side lives

When the on-chain program is wired up, the Next.js side will need:

- A `app/lib/payoutsProgram.ts` wrapper that builds + sends instructions
  using the operator's hardware wallet for ops moves, and connects each
  player's wallet for `claim_prize`.
- A schema migration adding `tournament_payout_program_id` and
  `tournament_vault_pubkey` to `poker_tournaments`.

Both are out of scope for this scaffold. Treat the scaffold as
documentation-of-intent rather than running infrastructure.
