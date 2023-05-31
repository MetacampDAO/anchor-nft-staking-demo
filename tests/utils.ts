import * as anchor from "@project-serum/anchor";
import { Program, web3 } from "@project-serum/anchor";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Demo } from "../target/types/demo";
import { addAndVerifyCollection, createNft } from "./metaplex";

export const airdrop1Sol = async (
  program: Program<Demo>,
  pubkey: web3.PublicKey
) => {
  await program.provider.connection.confirmTransaction(
    await program.provider.connection.requestAirdrop(pubkey, 1e9)
  );
};

export const getTokenAccounts = async (
  mint: web3.PublicKey,
  staker: web3.PublicKey,
  userStakeInfo: web3.PublicKey
) => {
  const userNftAccount = await getAssociatedTokenAddress(mint, staker);

  const pdaNftAccount = await getAssociatedTokenAddress(
    mint,
    userStakeInfo,
    true
  );

  return { userNftAccount, pdaNftAccount };
};

export const getUserInfo = (
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

export const getUserStakeInfo = (
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

export const initMetaplex = async (
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
