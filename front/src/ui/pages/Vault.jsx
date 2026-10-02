import {Header} from "../components/Header.jsx";
import {useContext, useEffect, useState} from "react";
import {MyContext} from "../../core/Context.jsx";
import {Vaults} from "../../service/contracts.js";
import MyContract from "../../service/Contract.jsx";
import {Button, Col, FormControl, Row} from "react-bootstrap";
import {DistributeToMarkets} from "../components/DistributeToMarkets.jsx";
import {WithdrawFull} from "../components/WithdrawFull.jsx";

export const Vault = () => {
    const {wallet} = useContext(MyContext)

    const actions = ["deposit", "withdrawPart"]

    const [amount, setAmount] = useState("");

    const [vaults, setVaults] = useState([])

    useEffect(()=>{
        if(wallet){
            const vaults_ = [];
            Vaults.forEach(v => {
                vaults_.push(new MyContract(v.abi, v.address));
            })
            setVaults(vaults_);
            console.log("vaults: ", vaults_)
        }
    },[])

    const handle = async (vault, action) => {
        await vault[action](amount)
    }

    return (
        <>
            <Header />
            {wallet ?
                vaults.map((vault, i) => (
                    <div key={i} className="container">
                        <h2>vault  {i + 1} {vault.address}</h2>
                        <Row className={"container2"}>
                            <Col className={"column"}>
                            {actions.map((action,i ) => (
                                <div key={i}>
                                    <h3>{action}</h3>
                                    <FormControl
                                        type={"number"}
                                        min={0}
                                        placeholder={"100"}
                                        onChange={e => setAmount(e.target.value)}
                                    />
                                    <Button className="containerButton" onClick={() => handle(vault, action)}>
                                            {action}
                                    </Button>
                                </div>
                            ))}
                            </Col>
                            <Col className={"column"}>
                               <DistributeToMarkets contract={vault}/>
                            </Col>
                            <Col className={"column"}>
                                <WithdrawFull contract={vault} />
                            </Col>
                        </Row>
                    </div>
                ))
            : "no wallet provided"}
        </>
    )
}