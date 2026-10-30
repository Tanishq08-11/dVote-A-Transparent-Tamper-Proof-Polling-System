import { ethers } from 'ethers';
import dVoteABI from '../contracts/dVoteABI.json';

// Default Sepolia Testnet Contract Address placeholder
// (Can be updated whenever deployed to Sepolia or a local node)
export const DVOTE_CONTRACT_ADDRESS = "0x0edc75A652D8ad2347f3Ad9BF86F47fD5626c6Ef";
export const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

// Initial mock proposals for demonstration and local testing
export const INITIAL_MOCK_PROPOSALS = [
  {
    id: 0,
    title: "Implement ERC-4337 Account Abstraction as Primary Standard",
    description: "Proposal to adopt smart contract wallets natively across governance to eliminate seed phrases and enable sponsored gas transactions.",
    creator: "0x1290f845a968962306d15aCAd9130DFF5863c467",
    voteCountYes: 14,
    voteCountNo: 3,
    deadline: Math.floor(Date.now() / 1000) + 86400 * 2, // 2 days from now (Active)
    exists: true
  },
  {
    id: 1,
    title: "Allocate 50 ETH Community Grant for Decentralized Identity (DID)",
    description: "Grant funding proposal for researching and building zero-knowledge privacy identity verifications for community voters.",
    creator: "0x9876543210987654321098765432109876543210",
    voteCountYes: 8,
    voteCountNo: 11,
    deadline: Math.floor(Date.now() / 1000) + 3600 * 4, // 4 hours from now (Active)
    exists: true
  },
  {
    id: 2,
    title: "Upgrade Quadratic Voting Algorithm for Treasury Distribution",
    description: "Research initiative to replace 1-wallet-1-vote with quadratic voting to minimize whale dominance in treasury allocation decisions.",
    creator: "0x4567890123456789012345678901234567890123",
    voteCountYes: 22,
    voteCountNo: 2,
    deadline: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (Closed)
    exists: true
  }
];

/**
 * Checks if MetaMask / injected provider is present
 */
export function isMetaMaskInstalled() {
  return typeof window !== 'undefined' && Boolean(window.ethereum);
}

/**
 * Connect to user's wallet via window.ethereum
 */
export async function connectWallet() {
  if (!isMetaMaskInstalled()) {
    throw new Error("No Web3 wallet found. Please install MetaMask to interact with live blockchain.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();

  return {
    provider,
    signer,
    account: accounts[0],
    chainId: Number(network.chainId)
  };
}

/**
 * Get read/write contract instance
 */
export function getContract(signerOrProvider, contractAddress = DVOTE_CONTRACT_ADDRESS) {
  return new ethers.Contract(contractAddress, dVoteABI, signerOrProvider);
}

/**
 * Formats wallet address for clean UI display (0x1234...5678)
 */
export function formatAddress(address) {
  if (!address) return "";
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}
