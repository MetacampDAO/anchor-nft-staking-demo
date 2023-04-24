import * as anchor from "@project-serum/anchor";
import { web3 } from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Demo } from "../target/types/demo";
import { Metaplex } from "@metaplex-foundation/js";
import { assert } from "chai";
import { addAndVerifyCollection, createNft } from "./metaplex";

const airdrop1Sol = async (program: Program<Demo>, pubkey: web3.PublicKey) => {
  await program.provider.connection.confirmTransaction(
    await program.provider.connection.requestAirdrop(pubkey, 1e9)
  );
};

const getProgramPdaInfo = async (
  connection: web3.Connection,
  mint: web3.PublicKey,
  staker: web3.PublicKey,
  userStakeInfo: web3.PublicKey
) => {
  const metaplex = new Metaplex(connection);
  const { metadataAddress } = await metaplex
    .nfts()
    .findByMint({ mintAddress: mint });

  const userNftAccount = await getAssociatedTokenAddress(mint, staker);

  const pdaNftAccount = await getAssociatedTokenAddress(
    mint,
    userStakeInfo,
    true
  );

  return { metadataAddress, userNftAccount, pdaNftAccount };
};

const getUserInfo = (
  program: anchor.Program<Demo>,
  userPubkey: web3.PublicKey
) => {
  const [userInfo, _userInfoBump] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(anchor.utils.bytes.utf8.encode("user")),
      userPubkey.toBuffer(),
    ],
    program.programId
  );
  return userInfo;
};

const getUserStakeInfo = (
  program: anchor.Program<Demo>,
  userPubkey: web3.PublicKey,
  nftMint: web3.PublicKey
) => {
  const [userStakeInfo, _userStakeInfoBump] =
    web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(anchor.utils.bytes.utf8.encode("stake_info")),
        userPubkey.toBuffer(),
        nftMint.toBuffer(),
      ],
      program.programId
    );
  return userStakeInfo;
};

const initMetaplex = async (
  connection: web3.Connection,
  signer: web3.Keypair
) => {
  console.log("Creating collection ...");
  // Create collection NFT
  const collection = await createNft(connection, signer);
  console.log(`Collection ${collection.address} created`);

  console.log("Creating NFT ...");
  // Create NFT
  const nft = await createNft(connection, signer);
  console.log(`NFT ${nft.address} created`);

  console.log("Adding and verifying Collection NFT to Mint NFT ... ");
  // Add and verify NFT to collection
  const signature = await addAndVerifyCollection(
    connection,
    signer,
    nft.address,
    collection.address
  );
  console.log(`Collection NFT added to Mint NFT ${signature}`);

  return { nftCollection: collection.address, nftMint: nft.address };
};

describe("demo", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.Demo as Program<Demo>;
  // const nftPayer = web3.Keypair.generate();
  const staker = web3.Keypair.generate();
  let nftCollection = null;
  let nftMint = null;

  it("Setup", async () => {
    await airdrop1Sol(program, staker.publicKey);

    // Create NFT Collection
    const { nftCollection: nftCollectionX, nftMint: nftMintX } =
      await initMetaplex(program.provider.connection, staker);
    // Update NFT State
    nftCollection = new web3.PublicKey(nftCollectionX);
    nftMint = new web3.PublicKey(nftMintX);
  });

  it("Stake", async () => {
    const userStakeInfo = getUserStakeInfo(program, staker.publicKey, nftMint);
    const userInfo = getUserInfo(program, staker.publicKey);

    const { userNftAccount, pdaNftAccount, metadataAddress } =
      await getProgramPdaInfo(
        program.provider.connection,
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
        nftMetadata: metadataAddress,
        mint: nftMint,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([staker])
      .rpc();

    const userStakeInfoAfter = await program.account.userStakeInfo.fetch(
      userStakeInfo
    );
    const userInfoAfter = await program.account.userInfo.fetch(userInfo);

    assert.equal(userInfoAfter.activeStake, 1);

    console.log("Your transaction signature", tx);
  });

  it("Redeem", async () => {
    const userStakeInfo = getUserStakeInfo(program, staker.publicKey, nftMint);
    const userInfo = getUserInfo(program, staker.publicKey);

    const { pdaNftAccount } = await getProgramPdaInfo(
      program.provider.connection,
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

    const { userNftAccount, pdaNftAccount } = await getProgramPdaInfo(
      program.provider.connection,
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
