import {Header} from "../components/Header.jsx";
import {useEffect, useState} from "react";
import {Markets, Vaults} from "../../service/contracts.js";
import MyContract from "../../service/Contract.jsx";
import {Col, Row} from "react-bootstrap";

export const Dashboard = () => {
    const [vaults, setVaults] = useState([]);
    const [markets, setMarkets] = useState([]);

    useEffect(() => {
        let vaultsData = []
        Vaults.forEach(async (v)=>{
            vaultsData.push(new MyContract(v.abi, v.address))
        });
        (async()=>{
            vaultsData = await Promise.all(
                vaultsData.map(async (v)=>{
                    const contract = new MyContract(v.abi, v.address);
                    return await contract.getVault();
                })
            )
            setVaults(vaultsData)
        })()
        console.log("vaultsData: ", vaultsData)

        let marketsData = []
        Markets.forEach(async (m)=>{
            marketsData.push(new MyContract(m.abi, m.address))
        });
        (async()=>{
            marketsData = await Promise.all(
                marketsData.map(async (m)=>{
                    const contract = new MyContract(m.abi, m.address);
                    return await contract.getMarket();
                })
            )
            setMarkets(marketsData)
        })()
        console.log("marketsData: ", marketsData)
    },[])

    return (
        <>
            <Header />
            <Row>
                {vaults.map((vault,i)=>(
                    <Col className={"column"} key={vault}>
                        <h2>{vault[2]}</h2>
                        <p>address: {Markets[i].address}</p>
                        <p>assetToken:  {vault[0]}</p>
                        <p>APY:         {vault[1]}</p>
                        <p>assets:      {vault[3]}</p>
                        <p>totalSupply: {vault[4]}</p>
                        <p>assetTokens: {vault[5]}</p>
                    </Col>
                ))}
            </Row>
            <Row>
                {markets.map((market,i)=>(
                    <Col className={"column"} key={market}>
                        <h2>{market[0]}</h2>
                        <p>address: {Markets[i].address}</p>
                        <p>borrowPrice:        {market[1]}</p>
                        <p>collateralPrice:    {market[2]}</p>
                        <p>LLTV:               {market[3]}</p>
                        <p>blocksPerYear:      {market[4]}</p>
                        <p>lastAccureBlock:    {market[5]}</p>
                        <p>currentBorrowIndex: {market[6]}</p>
                        <p>InterestRate:       {market[7]}</p>
                        <p>vault:              {market[8]}</p>
                        <p>admin:              {market[9]}</p>
                        <p>collateralToken:    {market[10]}</p>
                        <p>borrowToken:        {market[11]}</p>
                        <p>collateralShare:    {market[12]}</p>
                        <p>borrowShare:        {market[13]}</p>
                        <p>borrowTokens:       {market[14]}</p>
                        <p>collateralTokens:   {market[15]}</p>
                        <p>protocol revenue:   30% Fee     </p>
                    </Col>
                ))}
            </Row>
        </>
    )
}