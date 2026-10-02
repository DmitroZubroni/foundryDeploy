import {useState} from "react";
import {Button, FormControl, FormGroup} from "react-bootstrap";

export const DistributeToMarkets = ({contract}) => {

    const [address1, setAddress1] = useState("");
    const [address2, setAddress2] = useState("");
    const [address3, setAddress3] = useState("");

    const handle = async (address1, address2, address3) => {
        await contract.distributeToMarkets(address1, address2, address3);
    }

    return (
        <>
            <FormGroup>
                <h2>распределение по markets</h2>
                <FormControl
                    type={"address"}
                    placeholder={"0x000000"}
                    value={address1}
                    onChange={e => setAddress1(e.target.value)}
                />
                <hr/>
                <FormControl
                    type={"address"}
                    placeholder={"0x000000"}
                    value={address2}
                    onChange={e => setAddress2(e.target.value)}
                />
                <hr/>
                <FormControl
                    type={"address"}
                    placeholder={"0x000000"}
                    value={address3}
                    onChange={e => setAddress3(e.target.value)}
                />
            </FormGroup>
            <Button className="containerButton" onClick={() => handle(address1, address2, address3)}>
                distributeToMarkets
            </Button>
        </>
    )
}