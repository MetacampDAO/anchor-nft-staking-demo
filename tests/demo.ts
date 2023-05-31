import * as anchor from "@project-serum/anchor";
import { web3 } from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Demo } from "../target/types/demo";
import { assert } from "chai";
import {
  airdrop1Sol,
  getTokenAccounts,
  getUserInfo,
  getUserStakeInfo,
  initMetaplex,
} from "./utils";

describe("demo", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Demo as Program<Demo>;
  // const nftPayer = web3.Keypair.generate();
  const staker = web3.Keypair.generate();
  let nftCollection = null;
  let nftMint = null;

  it("Setup", async () => {
    try {
      await airdrop1Sol(program, staker.publicKey);
      // Create NFT Collection
      const { nftCollection: nftCollectionX, nftMint: nftMintX } =
        await initMetaplex(program.provider.connection, staker);
      // Update NFT State
      nftCollection = new web3.PublicKey(nftCollectionX);
      nftMint = new web3.PublicKey(nftMintX);
    } catch (error) {
      process.exit(1);
    }
  });

  it("Test Stake Instruction", async () => {
    const userStakeInfo = getUserStakeInfo(program, staker.publicKey, nftMint);
    const userInfo = getUserInfo(program, staker.publicKey);

    const { userNftAccount, pdaNftAccount } = await getTokenAccounts(
      nftMint,
      staker.publicKey,
      userStakeInfo
    );

    const tx = await program.methods
      .stake()
      .accounts({
        userInfo: userInfo,
        stakingInfo: userStakeInfo,
        initializer: staker.publicKey,
        userNftAccount: userNftAccount,
        pdaNftAccount: pdaNftAccount,
        mint: nftMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([staker])
      .rpc();

    const userInfoAfter = await program.account.userInfo.fetch(userInfo);

    assert.equal(userInfoAfter.activeStake, 1);

    console.log("Your transaction signature", tx);
  });

  it("Redeem", async () => {
    const userStakeInfo = getUserStakeInfo(program, staker.publicKey, nftMint);
    const userInfo = getUserInfo(program, staker.publicKey);

    const { pdaNftAccount } = await getTokenAccounts(
      nftMint,
      staker.publicKey,
      userStakeInfo
    );

    const userStakeInfoBefore = await program.account.userStakeInfo.fetch(
      userStakeInfo
    );
    const userInfoBefore = await program.account.userInfo.fetch(userInfo);

    const tx = await program.methods
      .redeem()
      .accounts({
        userInfo: userInfo,
        stakingInfo: userStakeInfo,
        payer: staker.publicKey,
        pdaNftAccount: pdaNftAccount,
        mint: nftMint,
      })
      .signers([staker])
      .rpc();

    const userStakeInfoAfter = await program.account.userStakeInfo.fetch(
      userStakeInfo
    );
    const userInfoAfter = await program.account.userInfo.fetch(userInfo);

    assert.notEqual(
      userStakeInfoBefore.lastStakeRedeem,
      userStakeInfoAfter.lastStakeRedeem
    );
    assert.notEqual(userInfoBefore.pointBalance, userInfoAfter.pointBalance);

    console.log("Your transaction signature", tx);
  });

  it("Unstake", async () => {
    const userStakeInfo = getUserStakeInfo(program, staker.publicKey, nftMint);
    const userInfo = getUserInfo(program, staker.publicKey);

    const { userNftAccount, pdaNftAccount } = await getTokenAccounts(
      nftMint,
      staker.publicKey,
      userStakeInfo
    );

    const tx = await program.methods
      .unstake()
      .accounts({
        userInfo: userInfo,
        stakingInfo: userStakeInfo,
        initializer: staker.publicKey,
        userNftAccount: userNftAccount,
        pdaNftAccount: pdaNftAccount,
        mint: nftMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([staker])
      .rpc();

    const userInfoAfter = await program.account.userInfo.fetch(userInfo);

    assert.equal(userInfoAfter.activeStake, 0);

    console.log("Your transaction signature", tx);
  });
});
