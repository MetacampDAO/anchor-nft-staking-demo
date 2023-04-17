# How it works

1. User can stake their NFTs, which rewards them 1 point per hour per NFT
2. User can redeem their points anytime
3. User can unstake their NFT, which will trigger

# Accounts

## UserInfo

A user can only have 1 UserInfo. This account tracks the total points accumulated by the user and the current active staked NFT.

## UserStakeInfo

A user can have multiple UserStakeInfo. Each UserStakeInfo tracks the state of each staked NFT, such as the time the NFT was staked, the last time it was redeemed, and the current state.

# Instruction

## Stake

- If required, initialize `UserInfo`, `UserStakeInfo`, and token account for `UserStakeInfo`.
- Transfer NFT from the user token account to the token account owned by `UserStakeInfo`.
- Update data field of `UserInfo`and `UserStakeInfo`

## Redeem

- Calculate points based on `last_stake_redeem` from `UserStakeInfo` and update balance in `UserInfo`

## Unstake

- Transfer NFT back to the user token account from token account owned by `UserStakeInfo`.
- Calculate points based on `last_stake_redeem` from `UserStakeInfo` and update balance in `UserInfo`
