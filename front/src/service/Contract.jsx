import {ethers} from "ethers";

export default class MyContract  {
    provider;
    signer;
    contract;
    abi;
    address;

    constructor(abi, address) {
        this.abi = abi;
        this.address = address;
    }

    async deploy(){
        if (window.ethereum == null) {
            this.provider = ethers.getDefaultProvider()
        }
        else {
            this.provider = new ethers.BrowserProvider(window.ethereum)
        }
        this.signer = await this.provider.getSigner()
        this.contract = new ethers.Contract(this.address, this.abi, this.signer)
    }

    async supply(amount){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.supply(amount);
    }

    async borrow(amount){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.borrow(amount);
    }

    async repayPart(amount){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.repayPart(amount);
    }

    async repayFull(){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.repayFull();
    }

    async withdrawPart(amount){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.withdrawPart(amount);
    }

    async withdrawFull(){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.withdrawFull();
    }

    async distributeToMarkets(address1, address2, address3){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.destributeToMarkets(address1, address2, address3); // distribute
    }

    async deposit(amount){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.deposit(amount);
    }

    async getVault() {
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.getVault();
    }

    async getMarket(){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.getMarket();
    }

    async getUserVault(){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.getUserVault();
    }

    async getUserMarket(){
        if(!this.contract){
            await this.deploy()
        }
        return await this.contract.getUserMarket();
    }
}