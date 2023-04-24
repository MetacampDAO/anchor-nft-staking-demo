import * as web3 from "@solana/web3.js";
import {
  Metaplex,
  keypairIdentity,
  NftWithToken,
} from "@metaplex-foundation/js";

// create NFT
export const createNft = async (
  connection: web3.Connection,
  signer: web3.Keypair
): Promise<NftWithToken> => {
  // Setup Metaplex bundlrStorage and signer
  const metaplex = Metaplex.make(connection).use(keypairIdentity(signer));

  const uri =
    "https://nftstorage.link/ipfs/bafkreihthebbs5f3k4pbl2yse3i6n5hweboqes2upf2ckip75qdelfl5ge";

  // Send tx to Solana and create NFT
  const data = await metaplex.nfts().create({
    uri: uri,
    name: "DEMO",
    sellerFeeBasisPoints: 100,
    symbol: "DMO",
    // maxSupply: null
  });
  console.log(`Token Mint: ${data.nft.address.toString()}`);

  console.log(
    `Explorer: https://explorer.solana.com/address/${data.nft.address.toString()}?cluster=devnet`
  );

  // console.log(`NFT: ${JSON.stringify(data, null, 2)}`)

  return data.nft;
};

export const addAndVerifyCollection = async (
  connection: web3.Connection,
  signer: web3.Keypair,
  mintAddress: web3.PublicKey,
  collection: web3.PublicKey
) => {
  // Set up Metaplex with signer
  const metaplex = Metaplex.make(connection).use(keypairIdentity(signer));

  // Get "NftWithToken" type from mint address
  const nft = await metaplex.nfts().findByMint({ mintAddress });

  // Update metaplex data and add collection
  await metaplex.nfts().update({
    nftOrSft: nft,
    collection: collection,
  });

  console.log(
    `Token Mint: https://explorer.solana.com/address/${nft.address.toString()}?cluster=devnet`
  );

  console.log(
    `Waiting to verify collection ${collection} on mint ${mintAddress}... `
  );

  // verify collection by owner
  const { response } = await metaplex.nfts().verifyCollection({
    mintAddress: mintAddress,
    collectionMintAddress: collection,
    isSizedCollection: false,
  });

  console.log(
    `Verification: https://explorer.solana.com/signuature/${response.signature}?cluster=devnet`
  );

  return response.signature;
};
