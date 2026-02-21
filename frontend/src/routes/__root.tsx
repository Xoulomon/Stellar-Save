import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

export const Route = createRootRoute({
	component: () => (
		<>
			<div className="app-container">
				<nav
					className="glass"
					style={{
						padding: "1rem 2rem",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						position: "sticky",
						top: 0,
						zIndex: 100,
						marginBottom: "2rem",
					}}>
					<Link
						to="/"
						style={{
							fontSize: "1.5rem",
							fontWeight: "bold",
							color: "var(--text-main)",
							fontFamily: "var(--font-heading)",
						}}>
						Stellar-Save
					</Link>
					<div style={{ display: "flex", gap: "2rem" }}>
						<Link
							to="/"
							className="[&.active]:font-bold"
							style={{ color: "var(--text-muted)" }}>
							Home
						</Link>
						<Link
							to="/profile"
							className="[&.active]:font-bold"
							style={{ color: "var(--text-muted)" }}>
							Profile
						</Link>
					</div>
				</nav>
				<main className="container">
					<Outlet />
				</main>
			</div>
			<TanStackRouterDevtools />
		</>
	),
});
