import {Link} from "react-router-dom";
import {MyContext} from "../../core/Context.jsx";
import {useContext} from "react";

export const Header = () => {
    const {wallet, logout} = useContext(MyContext)
    return(
        <div className="navbar" style={{backgroundColor: "#937dd2", color: "#fff"}}>
            <h1>professional 2026</h1>
            <p> Current wallet : {wallet || "empty"}</p>
            <Link to="/" className="btn" style={{color: "#fff"}}>User page</Link>
            <Link to="/dashboard" className="btn" style={{color: "#fff"}}>Dashboard</Link>
            {wallet ?
                <>
                    <Link to="/market"  className="btn" style={{color: "#fff"}}>Markets</Link>
                    <Link to="/vault" className="btn" style={{color: "#fff"}}>Vaults</Link>
                    <Link to="/" className="btn" style={{color: "#fff"}} onClick={logout}>Logout</Link>
                </>
            : null}
        </div>
    )
}