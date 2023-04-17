use anchor_lang::{prelude::*, solana_program};
use anchor_spl::associated_token::{AssociatedToken};
use anchor_spl::token::{self, TokenAccount, Token, Mint};
use mpl_token_metadata::state::{TokenMetadataAccount, Metadata};
use solana_program::sysvar::clock::Clock;

declare_id!("4RJD7nTLNu3AKGzu82FBLjwKZDJrczBfamffteQRvfV3");

// const COLLECTION_ADDRESS: &str = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";
const HOUR: u64 = 3600;

#[program]
pub mod demo {
    use anchor_spl::token::Transfer;

    use super::*;

    pub fn stake(ctx: Context<Stake>) -> Result<()> {
        
        // Check if user_info has been initialized
        if !ctx.accounts.user_info.is_initialized {
            ctx.accounts.user_info.is_initialized = true;
            ctx.accounts.user_info.point_balance = 0;
            ctx.accounts.user_info.active_stake = 0;
        }

        // Check if Metadata is valid
        let metadata: Metadata = Metadata::from_account_info(&ctx.accounts.nft_metadata.to_account_info())?;
        let collection = metadata.collection.unwrap();
        msg!("Collection ID is: {}", collection.key);

        // if collection.key != Pubkey::from_str(COLLECTION_ADDRESS).unwrap() && collection.verified {
        //     return err!(ErrorCode::InvalidNftCollection)
        // }

        // Proceed to transfer
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_nft_account.to_account_info(),
            to: ctx.accounts.pda_nft_account.to_account_info(),
            authority: ctx.accounts.initializer.to_account_info()
        };
        let token_transfer_context = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(token_transfer_context, 1)?;

        // Populate staking_info info
        ctx.accounts.staking_info.token_account = ctx.accounts.user_nft_account.key();
        ctx.accounts.staking_info.stake_start_time = Clock::get().unwrap().unix_timestamp as u64;
        ctx.accounts.staking_info.last_stake_redeem = Clock::get().unwrap().unix_timestamp as u64;
        ctx.accounts.staking_info.stake_state = StakeState::Stake;

        // Add user_info active stake count by 1
        ctx.accounts.user_info.active_stake = ctx.accounts.user_info.active_stake.checked_add(1).unwrap();
        
        Ok(())
    }
    
    pub fn redeem(ctx: Context<Redeem>) -> Result<()> {
        
        // Calculate rewards
        let current_time = Clock::get().unwrap().unix_timestamp as u64;
        let amount = (current_time - ctx.accounts.staking_info.last_stake_redeem) / HOUR;

        // Add amount to user_info point balance
        ctx.accounts.user_info.point_balance = ctx.accounts.user_info.point_balance.checked_add(amount).unwrap();
        
        // Update staking_info last stake_redeem
        ctx.accounts.staking_info.last_stake_redeem = current_time;

        Ok(())
    }

    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        // Proceed to transfer
        let auth_bump = *ctx.bumps.get("staking_info").unwrap();
        let seeds = &[
            b"stake_info".as_ref(),
            &ctx.accounts.initializer.key().to_bytes(),
            &ctx.accounts.mint.key().to_bytes(),
            &[auth_bump],
        ];
        let signer = &[&seeds[..]];
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_accounts = Transfer {
            from: ctx.accounts.pda_nft_account.to_account_info(),
            to: ctx.accounts.user_nft_account.to_account_info(),
            authority: ctx.accounts.staking_info.to_account_info()
        };
        let token_transfer_context = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::transfer(token_transfer_context, 1)?;

        // Calculate any remaining balance
        let current_time = Clock::get().unwrap().unix_timestamp as u64;
        let amount = (current_time - ctx.accounts.staking_info.last_stake_redeem) / HOUR;

        ctx.accounts.user_info.point_balance = ctx.accounts.user_info.point_balance.checked_add(amount).unwrap();
        ctx.accounts.staking_info.last_stake_redeem = current_time;
        
        ctx.accounts.staking_info.stake_state = StakeState::Unstake;

        ctx.accounts.user_info.active_stake = ctx.accounts.user_info.active_stake.checked_sub(1).unwrap();

        Ok(())
    }

}

//* Allow user to stake their NFT to get rewards at a rate of 1 Point per Hour
// User transfer NFT to PDA, create staking info if required, then start counter
// User redeem points
// User unstake points

#[derive(Accounts)]
pub struct Stake<'info> {
    // Check account seed and init if required
    #[account(init_if_needed, seeds=[b"user", initializer.key().as_ref()], bump, payer = initializer, space= UserInfo::len() )]
    pub user_info: Account<'info, UserInfo>,
    // Check account seed and init if required
    #[account(init_if_needed, seeds=[b"stake_info", initializer.key().as_ref(), mint.key().as_ref()], bump, payer = initializer, space= UserStakeInfo::len() )]
    pub staking_info: Account<'info, UserStakeInfo>,
    // Check if initializer is signer, mut is required to reduce lamports (fees)
    #[account(mut)]
    pub initializer: Signer<'info>,
    // Check if token account owner is the initializer and check if token amount = 1
    #[account(
        mut,
        constraint = user_nft_account.owner.key() == initializer.key(),
        constraint = user_nft_account.amount == 1
    )]
    pub user_nft_account: Account<'info, TokenAccount>,
    // Init if needed
    #[account(
        init_if_needed,
        payer = initializer, // If init required, payer will be initializer
        associated_token::mint = mint, // If init required, mint will be set to Mint
        associated_token::authority = staking_info // If init required, authority set to PDA
    )]
    pub pda_nft_account: Account<'info, TokenAccount>,
    // metadata required to check for collection verification
    /// CHECK: Account will be validated in processor
    pub nft_metadata: AccountInfo<'info>,
    // mint is required to create new account for PDA and for checking
    pub mint: Account<'info, Mint>,
    // Token Program required to call transfer instruction
    pub token_program: Program<'info, Token>,
    // ATA Program required to create ATA for pda_nft_account
    pub associated_token_program: Program<'info, AssociatedToken>,
    // System Program requred since a new account may be created and there's a deduction of lamports (fees/rent)
    pub system_program: Program<'info, System>,
    // Rent required to get Rent
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Redeem<'info> {
    // Check account seed, mut required to increase amount
    #[account(mut, seeds=[b"user", payer.key().as_ref()], bump )]
    pub user_info: Account<'info, UserInfo>,
    // Check account seed, mut required to update redeem time
    #[account(mut, seeds=[b"stake_info", payer.key().as_ref(), mint.key().as_ref()], bump)]
    pub staking_info: Account<'info, UserStakeInfo>,
    // Check if payer is signer, mut is required to reduce lamports (fees)
    #[account(mut)]
    pub payer: Signer<'info>,
    // Check if accounts has correct owner, mint and has amount of 1
    #[account(
        constraint = pda_nft_account.owner == staking_info.key(),
        constraint = pda_nft_account.mint == mint.key(),
        constraint = pda_nft_account.amount == 1,
    )]
    pub pda_nft_account: Account<'info, TokenAccount>,
    // mint is required to check staking_info and pda_nft_account
    pub mint: Account<'info, Mint>,
    // System Program requred for deduction of lamports (fees)
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds=[b"user", initializer.key().as_ref()], bump )]
    pub user_info: Account<'info, UserInfo>,
    // Check account seed and init if required
    #[account(
        mut, seeds=[b"stake_info", initializer.key().as_ref(), mint.key().as_ref()], bump,
        constraint = user_nft_account.key() == staking_info.token_account
    )]
    pub staking_info: Account<'info, UserStakeInfo>,
    // Check if initializer is signer, mut is required to reduce lamports (fees)
    #[account(mut)]
    pub initializer: Signer<'info>,
    // Check if token account owner is correct owner, mint and has amount of 0
    #[account(
        mut,
        constraint = user_nft_account.owner.key() == initializer.key(),
        constraint = user_nft_account.mint == mint.key(),
        constraint = user_nft_account.amount == 0
    )]
    pub user_nft_account: Account<'info, TokenAccount>,
    // Check if accounts has correct owner, mint and has amount of 1
    #[account(
        mut,
        constraint = pda_nft_account.owner == staking_info.key(),
        constraint = pda_nft_account.mint == mint.key(),
        constraint = pda_nft_account.amount == 1,
    )]
    pub pda_nft_account: Account<'info, TokenAccount>,
    // mint is required to check staking_info, user_nft_account, and pda_nft_account
    pub mint: Account<'info, Mint>,
    // Token Program required to call transfer instruction
    pub token_program: Program<'info, Token>,
    // System Program requred for deduction of lamports (fees)
    pub system_program: Program<'info, System>,
}

#[account]
pub struct UserInfo {
    is_initialized: bool,
    point_balance: u64,
    active_stake: u16,
}

#[account]
pub struct UserStakeInfo {
    token_account: Pubkey,
    stake_start_time: u64,
    last_stake_redeem: u64,
    stake_state: StakeState,
}

const DISCRIMINATOR: usize = 8;
const PUBKEY:usize = 32;
const BOOL:usize = 1;
const U64:usize = 8;
const U16:usize = 2;
const STATE:usize = 1;

impl UserInfo {
    fn len() -> usize {
        DISCRIMINATOR + BOOL + U64 + U16
    }
}

impl UserStakeInfo {
    fn len() -> usize {
        DISCRIMINATOR + PUBKEY + U64 + U64 + STATE
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
enum StakeState {
    Stake,
    Unstake
}

#[error_code]
pub enum ErrorCode {
    #[msg("NFT isn't part of collection")]
    InvalidNftCollection,
}