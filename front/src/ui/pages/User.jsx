import {MyContext} from "../../core/Context.jsx";
import {useContext, useEffect, useState} from "react";
import {Header} from "../components/Header.jsx";
import {Button} from "react-bootstrap";
import {Markets, Vaults} from "../../service/contracts.js";
import MyContract from "../../service/Contract.jsx";

export const User = () =>{
    const {wallet, login} = useContext(MyContext)

    const [vaults, setVaults] = useState([]);
    const [markets, setMarkets] = useState([]);

    useEffect(() => {
        if(wallet){
            let vaultsData = []
            Vaults.forEach(async (v)=>{
                vaultsData.push(new MyContract(v.abi, v.address))
            });
            (async()=>{
                vaultsData = await Promise.all(
                    vaultsData.map(async (v)=>{
                        const contract = new MyContract(v.abi, v.address);
                        return await contract.getUserVault();
                    })
                )
                setVaults(vaultsData)
            })()
            console.log("vaultData: ", vaultsData)

            let marketsData = []
            Markets.forEach(async (m)=>{
                marketsData.push(new MyContract(m.abi, m.address))
            });
            (async()=>{
                marketsData = await Promise.all(
                    marketsData.map(async (m)=>{
                        const contract = new MyContract(m.abi, m.address);
                        return await contract.getUserMarket();
                    })
                )
                setMarkets(marketsData)
            })()
            console.log("marketsData: ", marketsData)
        }
    },[wallet])


    return(
        <>
        <Header/>
            {wallet ?
                <>
                {vaults.map((item, i)=>(
                    <div className="container" key={i}>
                        <h2>vault {i + 1} {Vaults[i].address}</h2>
                        <p>depositTokens: {item[0]}</p>
                        <p>depositShare: {item[1]}</p>
                    </div>
                ))}
                {markets.map((item, i)=>(
                    <div className="container" key={i}>
                        <h2>market {i + 1} {Markets[i].address}</h2>
                        <p>userBorrowIndexAtEntry: {item[0]}</p>
                        <p>collateralShare: {item[1]}</p>
                        <p>borrowShare: {item[2]}</p>
                        <p>LTV: {item[3]}</p>
                        <p>borrowTokens: {item[4]}</p>
                        <p>collateralTokens: {item[5]}</p>
                    </div>
                ))}
                </>
            :
                <Button onClick={login} className={"containerButton"}> Login </Button>
            }
        </>
    )
}
