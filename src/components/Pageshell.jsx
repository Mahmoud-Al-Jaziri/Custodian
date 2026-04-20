import NavBar from "./NavBar";

export default function PageShell({children}){
    return(
        <div className="relay-shell shadow-sm">
            <main className="relay-main px-4 pt-4 pb-2">
                {children}
            </main>
            <NavBar/>
        </div>
    )
}