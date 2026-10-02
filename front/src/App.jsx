import {ContextProvider} from "./core/Context.jsx";
import {RouterProvider} from "react-router-dom";
import router from "./core/Routing.jsx";

function App() {

  return (
    <ContextProvider>
      <RouterProvider router={router}></RouterProvider>
    </ContextProvider>
  )
}

export default App
