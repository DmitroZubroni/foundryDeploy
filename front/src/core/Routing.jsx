import {createBrowserRouter} from "react-router-dom";
import {User} from "../ui/pages/User.jsx";
import {Market} from "../ui/pages/Market.jsx";
import {Vault} from "../ui/pages/Vault.jsx";
import {Dashboard} from "../ui/pages/Dashboard.jsx";

const routes = [
    {
        element: <User/>,
        path: "/"
    },
    {
        element: <Market/>,
        path: "/market"
    },
    {
        element: <Vault/>,
        path: "/vault"
    },
    {
        element: <Dashboard/>,
        path: "/dashboard"
    }
]

const router = createBrowserRouter(routes)
export default router