# Program Entity Relational Diagram
![Ride Hailing (9)](https://github.com/MetacampDAO/anchor-nft-staking-demo/assets/34192730/e42b76b9-6249-44a2-876a-1bcbd6834f3c)

# How it works
1. User can stake their NFTs, which rewards them 1 point per second per NFT
2. User can redeem their points anytime
3. User can unstake their NFT, which will redeem any uncollected amount 

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

# Further upgrade

1. Allow any collection to create their owned staking pool
2. Complete NFT collection verification checking
3. Allow one click stake all, redeem all, and unstake all
