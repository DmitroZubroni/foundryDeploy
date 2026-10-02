import {Button, ButtonGroup} from "react-bootstrap";

export const RepayFull = ({contract}) => {
    const handle = async () => {
        await contract.repayFull();
    }

    return (
        <>
            <h2>полное погашение</h2>
            <ButtonGroup>
                <Button className={"containerButton"} onClick={() => handle()}>
                    repayFull
                </Button>
            </ButtonGroup>
        </>
    )
}