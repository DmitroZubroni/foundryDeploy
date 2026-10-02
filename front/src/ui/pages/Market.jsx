import {Header} from "../components/Header.jsx";
import {useContext, useEffect, useState} from "react";
import {MyContext} from "../../core/Context.jsx";
import {Markets} from "../../service/contracts.js";
import MyContract from "../../service/Contract.jsx";
import {Button, Col, FormControl, Row} from "react-bootstrap";
import {WithdrawFull} from "../components/WithdrawFull.jsx";
import {RepayFull} from "../components/RepayFull.jsx";

export const Market = () => {
    const {wallet} = useContext(MyContext)

    const actions = ["supply", "borrow", "repayPart", "withdrawPart"]

    const [amount, setAmount] = useState("");

    const [markets, setMarkets] = useState([])

    useEffect(()=>{
        if(wallet){
            const markets_ = [];
            Markets.forEach(m => {
                markets_.push(new MyContract(m.abi, m.address));
            })
            setMarkets(markets_);
            console.log("markets: ", markets_)
        }
    },[])

    const handle = async (market, action) => {
        await market[action](amount)
    }

    return (
        <>
            <Header />
            {wallet ?
                markets.map((market, i) => (
                    <div key={i} className="container">
                        <h2>market  {i + 1} {market.address}</h2>
                        <Row className={"container2"}>
                            <Col className={"column"}>
                                {actions.map((action, i) => (
                                    <div key={i}>
                                        <h3>{action}</h3>
                                        <FormControl
                                            type={"number"}
                                            min={0}
                                            placeholder={"100"}
                                            onChange={e => setAmount(e.target.value)}
                                        />
                                        <Button className="containerButton" onClick={() => handle(market, action)}>
                                            {action}
                                        </Button>
                                    </div>
                                ))}
                            </Col>
                            <Col className={"column"}>
                                <RepayFull contract={market}/>
                            </Col>
                            <Col className={"column"}>
                                <WithdrawFull contract={market} />
                            </Col>
                        </Row>
                    </div>
                ))
                : "no wallet provided"}
        </>
    )
}