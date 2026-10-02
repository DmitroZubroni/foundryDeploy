import {createContext, useState} from "react";

const MyContext = createContext({})

const ContextProvider = ({ children }) => {

    const [wallet, setWallet] = useState(localStorage.getItem("wallet") || "")

    const login = async() => {
        const accounts = await window.ethereum.request({method: "eth_requestAccounts"})
        const account = accounts[0]
        setWallet(account)
        localStorage.setItem("wallet", account)
        console.log("wallet added:", account)
    }

    const logout = async() => {
        setWallet("")
        localStorage.removeItem("wallet")
        console.log("wallet removed")
    }

    const values={
        login,
        logout,
        wallet
    }
    return <MyContext.Provider value={values}>{children}</MyContext.Provider>
}

export { MyContext, ContextProvider }