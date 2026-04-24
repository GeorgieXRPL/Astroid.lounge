// =====================================================================
// Astroid Lounge - Promotional drop payouts (SCAFFOLD)
// =====================================================================
// SCAFFOLD ONLY. DO NOT DEPLOY TO MAINNET.
//
// This program is the trust-minimised back-end for the Lounge's
// promotional appreciation drops. The design intent:
//
//   - The operator (Pr\u00f3spera entity) signs to *initialise* a
//     tournament, *fund* its prize vault from the project treasury,
//     *record winners* once a tournament concludes, and *cancel*
//     tournaments that never run. The operator must be a multisig
//     (e.g. Squads) so a single compromised key cannot move funds.
//
//   - Winners self-claim their share. The operator does NOT push
//     payouts; instead the program enforces the deterministic split
//     (set at tournament initialisation) and lets each winner sign a
//     `claim_prize` instruction against the tournament vault.
//
//   - The vault PDA (one per tournament) holds the drop USDC. After
//     all winners have claimed (or after a long claim window expires),
//     the operator can sweep any remainder back to the treasury.
//
// SECURITY ITEMS THAT STILL NEED AUDIT BEFORE DEPLOY:
//   - Replay protection on `set_winners` (currently single-shot but
//     not seeded with a nonce; an attacker controlling the operator
//     key could in principle re-call - confirm desired behaviour).
//   - Reentrancy on `claim_prize` (Anchor protects against the worst
//     cases but the explicit ordering of CPI vs state writes here
//     deserves a fresh pair of eyes).
//   - Integer-overflow paths in the bps math (deliberately uses
//     u128 intermediate, but worth a checker pass).
//   - The "claim window" + "sweep remainder" semantics are NOT yet
//     implemented; only the happy path through claim is.
//   - Token-2022 vs classic SPL token: this scaffold targets classic
//     SPL token. If the prize mint is Token-2022, the CPI signatures
//     change.
//
// LEGAL ITEMS THAT STILL NEED LAWYER SIGNOFF BEFORE DEPLOY:
//   - That a deterministic on-chain payout split is compatible with
//     the "operator discretion" framing in the Lounge ToS.
//   - That winners self-claiming (vs operator pushing) doesn't
//     change the regulatory posture.
//   - That the vault PDA being controlled by the program (not the
//     operator) is consistent with the entity's gaming licence
//     application, once that lands.
// =====================================================================

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("LoungePayouts1111111111111111111111111111111");

// ---------- constants ----------

/// Maximum winners per tournament. Bound on `payout_bps` length and
/// on the `winners` array. Keeps account size deterministic.
pub const MAX_WINNERS: usize = 32;

/// Total basis points (must always equal 10_000 for a complete split).
pub const TOTAL_BPS: u16 = 10_000;

// ---------- program ----------

#[program]
pub mod astroid_lounge_payouts {
    use super::*;

    /// Create a tournament's on-chain state and its dedicated vault.
    /// Called once per tournament by the operator.
    pub fn initialize_tournament(
        ctx: Context<InitializeTournament>,
        tournament_id: [u8; 16],
        payout_bps: Vec<u16>,
    ) -> Result<()> {
        require!(
            !payout_bps.is_empty() && payout_bps.len() <= MAX_WINNERS,
            LoungeError::InvalidPayoutStructure
        );

        let total: u32 = payout_bps.iter().map(|b| *b as u32).sum();
        require!(
            total as u16 == TOTAL_BPS,
            LoungeError::PayoutBpsMustSumTo10000
        );

        let t = &mut ctx.accounts.tournament;
        t.bump = ctx.bumps.tournament;
        t.vault_bump = ctx.bumps.vault;
        t.tournament_id = tournament_id;
        t.operator = ctx.accounts.operator.key();
        t.prize_mint = ctx.accounts.prize_mint.key();
        t.payout_bps = payout_bps;
        t.funded_amount = 0;
        t.winners = vec![];
        t.status = TournamentStatus::Initialized;

        emit!(TournamentInitialized {
            tournament_id,
            operator: t.operator,
            prize_mint: t.prize_mint,
        });

        Ok(())
    }

    /// Operator transfers `amount` of the prize mint from the
    /// treasury ATA into the tournament vault. May be called multiple
    /// times before play opens; rejected once status moves past
    /// `Funded`.
    pub fn fund_tournament(ctx: Context<FundTournament>, amount: u64) -> Result<()> {
        let t = &mut ctx.accounts.tournament;
        require!(
            matches!(t.status, TournamentStatus::Initialized | TournamentStatus::Funded),
            LoungeError::CannotFundInThisStatus
        );
        require!(amount > 0, LoungeError::AmountMustBePositive);

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.treasury_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.operator.to_account_info(),
                },
            ),
            amount,
        )?;

        t.funded_amount = t
            .funded_amount
            .checked_add(amount)
            .ok_or(LoungeError::ArithmeticOverflow)?;
        t.status = TournamentStatus::Funded;

        emit!(TournamentFunded {
            tournament_id: t.tournament_id,
            amount,
            total_funded: t.funded_amount,
        });

        Ok(())
    }

    /// Operator records the winners (in finishing order) once the
    /// tournament concludes. Single-shot: must be `Funded`, becomes
    /// `Concluded`. Length must equal `payout_bps.len()`.
    pub fn set_winners(ctx: Context<SetWinners>, winners: Vec<Pubkey>) -> Result<()> {
        let t = &mut ctx.accounts.tournament;
        require!(
            matches!(t.status, TournamentStatus::Funded),
            LoungeError::CannotSetWinnersInThisStatus
        );
        require!(
            winners.len() == t.payout_bps.len(),
            LoungeError::WinnerCountMismatch
        );

        t.winners = winners.clone();
        t.status = TournamentStatus::Concluded;

        emit!(WinnersRecorded {
            tournament_id: t.tournament_id,
            winner_count: winners.len() as u8,
        });

        Ok(())
    }

    /// A winner claims their share. The program checks the caller
    /// against the recorded winners list, looks up their finishing
    /// position, computes the deterministic share, and transfers it.
    /// Idempotent in the sense that a second call by the same winner
    /// finds zero remaining and reverts.
    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        let t = &mut ctx.accounts.tournament;
        require!(
            matches!(t.status, TournamentStatus::Concluded),
            LoungeError::CannotClaimInThisStatus
        );

        let claimer = ctx.accounts.claimer.key();
        let position = t
            .winners
            .iter()
            .position(|w| *w == claimer)
            .ok_or(LoungeError::CallerIsNotAWinner)?;

        // Mark this position claimed by overwriting with the default
        // pubkey. Cheap, in-line replay protection.
        require!(
            t.winners[position] != Pubkey::default(),
            LoungeError::ShareAlreadyClaimed
        );
        t.winners[position] = Pubkey::default();

        let bps = t.payout_bps[position] as u128;
        let funded = t.funded_amount as u128;
        let share = funded
            .checked_mul(bps)
            .ok_or(LoungeError::ArithmeticOverflow)?
            .checked_div(TOTAL_BPS as u128)
            .ok_or(LoungeError::ArithmeticOverflow)? as u64;
        require!(share > 0, LoungeError::ShareIsZero);

        let tournament_id = t.tournament_id;
        let vault_bump = t.vault_bump;
        let seeds = &[
            b"vault".as_ref(),
            tournament_id.as_ref(),
            std::slice::from_ref(&vault_bump),
        ];
        let signer = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.claimer_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer,
            ),
            share,
        )?;

        emit!(PrizeClaimed {
            tournament_id,
            claimer,
            position: position as u8,
            amount: share,
        });

        Ok(())
    }

    /// Operator cancels a tournament that has not concluded and
    /// sweeps the vault back to the treasury ATA. Refunds happen
    /// only via this path; players cannot trigger refunds.
    pub fn cancel_tournament(ctx: Context<CancelTournament>) -> Result<()> {
        let t = &mut ctx.accounts.tournament;
        require!(
            matches!(t.status, TournamentStatus::Initialized | TournamentStatus::Funded),
            LoungeError::CannotCancelInThisStatus
        );

        let amount = ctx.accounts.vault.amount;
        if amount > 0 {
            let tournament_id = t.tournament_id;
            let vault_bump = t.vault_bump;
            let seeds = &[
                b"vault".as_ref(),
                tournament_id.as_ref(),
                std::slice::from_ref(&vault_bump),
            ];
            let signer = &[&seeds[..]];

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.vault.to_account_info(),
                        to: ctx.accounts.treasury_ata.to_account_info(),
                        authority: ctx.accounts.vault.to_account_info(),
                    },
                    signer,
                ),
                amount,
            )?;
        }

        t.status = TournamentStatus::Cancelled;
        t.funded_amount = 0;

        emit!(TournamentCancelled {
            tournament_id: t.tournament_id,
            refunded_amount: amount,
        });

        Ok(())
    }
}

// ---------- accounts ----------

#[account]
pub struct Tournament {
    pub bump: u8,
    pub vault_bump: u8,
    pub tournament_id: [u8; 16],
    pub operator: Pubkey,
    pub prize_mint: Pubkey,
    pub payout_bps: Vec<u16>,   // length 1..=MAX_WINNERS
    pub funded_amount: u64,
    pub winners: Vec<Pubkey>,   // empty until set_winners
    pub status: TournamentStatus,
}

impl Tournament {
    /// Static size budget. Conservative; over-allocates rather than
    /// undersizing, so realloc paths are not needed for the v1 cut.
    pub const SIZE: usize = 8        // discriminator
        + 1                         // bump
        + 1                         // vault_bump
        + 16                        // tournament_id
        + 32                        // operator
        + 32                        // prize_mint
        + 4 + 2 * MAX_WINNERS       // payout_bps Vec
        + 8                         // funded_amount
        + 4 + 32 * MAX_WINNERS      // winners Vec
        + 1;                        // status enum
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TournamentStatus {
    Initialized,
    Funded,
    Concluded,
    Cancelled,
}

// ---------- contexts ----------

#[derive(Accounts)]
#[instruction(tournament_id: [u8; 16])]
pub struct InitializeTournament<'info> {
    #[account(mut)]
    pub operator: Signer<'info>,

    #[account(
        init,
        payer = operator,
        space = Tournament::SIZE,
        seeds = [b"tournament", tournament_id.as_ref()],
        bump
    )]
    pub tournament: Account<'info, Tournament>,

    /// Per-tournament vault that holds the funded prize tokens. The
    /// authority is the vault PDA itself; that means only this
    /// program (signed via the seeds) can move tokens out of it.
    #[account(
        init,
        payer = operator,
        seeds = [b"vault", tournament_id.as_ref()],
        bump,
        token::mint = prize_mint,
        token::authority = vault
    )]
    pub vault: Account<'info, TokenAccount>,

    pub prize_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundTournament<'info> {
    #[account(mut, address = tournament.operator)]
    pub operator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.tournament_id.as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        seeds = [b"vault", tournament.tournament_id.as_ref()],
        bump = tournament.vault_bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, token::mint = tournament.prize_mint)]
    pub treasury_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SetWinners<'info> {
    #[account(address = tournament.operator)]
    pub operator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.tournament_id.as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.tournament_id.as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        seeds = [b"vault", tournament.tournament_id.as_ref()],
        bump = tournament.vault_bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = tournament.prize_mint,
        token::authority = claimer
    )]
    pub claimer_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelTournament<'info> {
    #[account(address = tournament.operator)]
    pub operator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.tournament_id.as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        seeds = [b"vault", tournament.tournament_id.as_ref()],
        bump = tournament.vault_bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut, token::mint = tournament.prize_mint)]
    pub treasury_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ---------- events ----------

#[event]
pub struct TournamentInitialized {
    pub tournament_id: [u8; 16],
    pub operator: Pubkey,
    pub prize_mint: Pubkey,
}

#[event]
pub struct TournamentFunded {
    pub tournament_id: [u8; 16],
    pub amount: u64,
    pub total_funded: u64,
}

#[event]
pub struct WinnersRecorded {
    pub tournament_id: [u8; 16],
    pub winner_count: u8,
}

#[event]
pub struct PrizeClaimed {
    pub tournament_id: [u8; 16],
    pub claimer: Pubkey,
    pub position: u8,
    pub amount: u64,
}

#[event]
pub struct TournamentCancelled {
    pub tournament_id: [u8; 16],
    pub refunded_amount: u64,
}

// ---------- errors ----------

#[error_code]
pub enum LoungeError {
    #[msg("Payout structure must be 1..=MAX_WINNERS entries")]
    InvalidPayoutStructure,
    #[msg("Payout basis points must sum to 10000")]
    PayoutBpsMustSumTo10000,
    #[msg("Tournament cannot be funded in its current status")]
    CannotFundInThisStatus,
    #[msg("Tournament cannot have winners set in its current status")]
    CannotSetWinnersInThisStatus,
    #[msg("Tournament cannot be claimed against in its current status")]
    CannotClaimInThisStatus,
    #[msg("Tournament cannot be cancelled in its current status")]
    CannotCancelInThisStatus,
    #[msg("Winner list length must match payout structure length")]
    WinnerCountMismatch,
    #[msg("Caller is not a recorded winner of this tournament")]
    CallerIsNotAWinner,
    #[msg("Caller has already claimed their share")]
    ShareAlreadyClaimed,
    #[msg("Computed share is zero - check funded amount")]
    ShareIsZero,
    #[msg("Amount must be positive")]
    AmountMustBePositive,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}
