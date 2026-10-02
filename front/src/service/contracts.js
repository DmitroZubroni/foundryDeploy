import marketABI from './marketABI.json';
import vaultABI from './vaultABI.json';
import addresses from './addresses.json';

export const Markets = [
    { address: addresses.market1, abi: marketABI, title: "Market1" },
    { address: addresses.market2, abi: marketABI, title: "Market2" },
    { address: addresses.market3, abi: marketABI, title: "Market3" },
];

export const Vaults = [
    { address: addresses.vault1, abi: vaultABI, title: "Vault1" },
    { address: addresses.vault2, abi: vaultABI, title: "Vault2" },
];
