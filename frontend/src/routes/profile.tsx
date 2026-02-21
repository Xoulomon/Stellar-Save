import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
	User,
	Settings,
	ShieldCheck,
	TrendingUp,
	History,
	Wallet,
	ChevronRight,
	Bell,
	Lock,
	Globe,
	Star,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: { staggerChildren: 0.1 },
		},
	};

	const itemVariants = {
		hidden: { y: 20, opacity: 0 },
		visible: { y: 0, opacity: 1 },
	};

	return (
		<motion.div
			className="profile-container"
			variants={containerVariants}
			initial="hidden"
			animate="visible">
			{/* 1. Profile Header */}
			<motion.div
				variants={itemVariants}
				className="profile-header glass-card mt-4"
				style={{
					borderRadius: "var(--radius-lg)",
					overflow: "hidden",
					position: "relative",
				}}>
				<div
					className="header-cover"
					style={{
						height: "160px",
						background: "linear-gradient(90deg, #3D8BFF 0%, #A855F7 100%)",
						opacity: 0.8,
					}}
				/>
				<div
					className="header-content"
					style={{
						padding: "0 2rem 2rem 2rem",
						marginTop: "-40px",
						display: "flex",
						alignItems: "flex-end",
						gap: "1.5rem",
						flexWrap: "wrap",
					}}>
					<div className="avatar-wrapper" style={{ position: "relative" }}>
						<div
							className="avatar"
							style={{
								width: "120px",
								height: "120px",
								borderRadius: "50%",
								background: "var(--bg-card)",
								border: "4px solid var(--bg-main)",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}>
							<User size={64} color="var(--primary)" />
						</div>
						<div
							className="status-badge"
							style={{
								position: "absolute",
								bottom: "10px",
								right: "10px",
								width: "24px",
								height: "24px",
								borderRadius: "50%",
								background: "var(--success)",
								border: "3px solid var(--bg-main)",
							}}
						/>
					</div>
					<div
						className="user-info"
						style={{ flex: 1, paddingBottom: "0.5rem" }}>
						<h2 style={{ fontSize: "2rem", marginBottom: "0.25rem" }}>
							Stellar Voyager
						</h2>
						<p
							style={{
								color: "var(--text-muted)",
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
							}}>
							GALX...7R3X <Wallet size={14} />
						</p>
					</div>
					<div
						className="header-actions"
						style={{ display: "flex", gap: "1rem", paddingBottom: "0.5rem" }}>
						<button
							className="glass"
							style={{
								padding: "0.75rem 1.5rem",
								borderRadius: "var(--radius-md)",
								color: "var(--text-main)",
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
							}}>
							<Settings size={18} /> Edit Profile
						</button>
					</div>
				</div>
			</motion.div>

			<div className="grid grid-cols-3 gap-6 mt-8">
				<div className="grid-col-1 grid gap-6" style={{ gridColumn: "span 1" }}>
					{/* 5. Reputation/Trust Score Display */}
					<motion.div
						variants={itemVariants}
						className="glass-card p-6"
						style={{ borderRadius: "var(--radius-lg)" }}>
						<div className="flex items-center justify-between mb-6">
							<h3
								style={{
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
								}}>
								<ShieldCheck size={20} color="var(--success)" /> Reputation
							</h3>
							<Star size={18} fill="var(--warning)" color="var(--warning)" />
						</div>
						<div
							className="trust-score-viz"
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								margin: "1.5rem 0",
							}}>
							<div
								style={{
									position: "relative",
									width: "120px",
									height: "120px",
								}}>
								<svg width="120" height="120" viewBox="0 0 120 120">
									<circle
										cx="60"
										cy="60"
										r="54"
										fill="none"
										stroke="var(--border)"
										strokeWidth="8"
									/>
									<circle
										cx="60"
										cy="60"
										r="54"
										fill="none"
										stroke="var(--success)"
										strokeWidth="8"
										strokeDasharray="339.292"
										strokeDashoffset="33.929"
										strokeLinecap="round"
										transform="rotate(-90 60 60)"
									/>
								</svg>
								<div
									style={{
										position: "absolute",
										top: "50%",
										left: "50%",
										transform: "translate(-50%, -50%)",
										textAlign: "center",
									}}>
									<span style={{ fontSize: "1.75rem", fontWeight: "bold" }}>
										94
									</span>
									<div
										style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
										SCORE
									</div>
								</div>
							</div>
							<p
								style={{
									marginTop: "1rem",
									textAlign: "center",
									color: "var(--text-muted)",
									fontSize: "0.875rem",
								}}>
								You are in the top 5% of savers! Keep it up to unlock lower
								fees.
							</p>
						</div>
					</motion.div>

					{/* 4. Settings Section (Quick Access) */}
					<motion.div
						variants={itemVariants}
						className="glass-card p-6"
						style={{ borderRadius: "var(--radius-lg)" }}>
						<h3 className="mb-4">Settings</h3>
						<div className="settings-list flex flex-col gap-2">
							{[
								{ icon: Bell, label: "Notifications", value: "On" },
								{ icon: Lock, label: "Security", value: "High" },
								{ icon: Globe, label: "Language", value: "English" },
							].map((item, i) => (
								<div
									key={i}
									className="settings-item flex items-center justify-between p-3"
									style={{
										borderRadius: "var(--radius-sm)",
										transition: "background 0.2s",
									}}>
									<div className="flex items-center gap-3">
										<item.icon size={18} color="var(--text-dim)" />
										<span>{item.label}</span>
									</div>
									<div className="flex items-center gap-2">
										<span
											style={{
												color: "var(--text-dim)",
												fontSize: "0.875rem",
											}}>
											{item.value}
										</span>
										<ChevronRight size={16} color="var(--text-dim)" />
									</div>
								</div>
							))}
						</div>
					</motion.div>
				</div>

				<div className="grid gap-6" style={{ gridColumn: "span 2" }}>
					{/* 3. Statistics */}
					<motion.div
						variants={itemVariants}
						className="grid grid-cols-3 gap-4">
						{[
							{
								label: "Total Saved",
								value: "12,450 XLM",
								icon: TrendingUp,
								color: "var(--primary)",
							},
							{
								label: "Groups Completed",
								value: "18",
								icon: Star,
								color: "var(--secondary)",
							},
							{
								label: "Active Groups",
								value: "3",
								icon: History,
								color: "var(--success)",
							},
						].map((stat, i) => (
							<div
								key={i}
								className="glass-card p-4"
								style={{ borderRadius: "var(--radius-lg)" }}>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
										marginBottom: "0.75rem",
									}}>
									<stat.icon size={18} color={stat.color} />
									<span
										style={{
											color: "var(--text-muted)",
											fontSize: "0.875rem",
										}}>
										{stat.label}
									</span>
								</div>
								<div style={{ fontSize: "1.25rem", fontWeight: "bold" }}>
									{stat.value}
								</div>
							</div>
						))}
					</motion.div>

					{/* 2. Participation History */}
					<motion.div
						variants={itemVariants}
						className="glass-card p-6"
						style={{ borderRadius: "var(--radius-lg)", flex: 1 }}>
						<div className="flex items-center justify-between mb-6">
							<h3
								style={{
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
								}}>
								<History size={20} color="var(--primary)" /> Participation
								History
							</h3>
							<button
								style={{
									color: "var(--primary)",
									background: "none",
									border: "none",
									fontSize: "0.875rem",
								}}>
								View All
							</button>
						</div>

						<div className="history-list flex flex-col gap-4">
							{[
								{
									name: "Alpha Savers Pool",
									date: "Oct 24, 2025",
									amount: "500 XLM",
									status: "Completed",
									color: "var(--success)",
								},
								{
									name: "Weekly Stash #12",
									date: "Nov 02, 2025",
									amount: "250 XLM",
									status: "Completed",
									color: "var(--success)",
								},
								{
									name: "Stellar Moon Shot",
									date: "Nov 15, 2025",
									amount: "1,200 XLM",
									status: "Active",
									color: "var(--primary)",
								},
								{
									name: "Emergency Fund B",
									date: "Dec 01, 2025",
									amount: "100 XLM",
									status: "Active",
									color: "var(--primary)",
								},
							].map((item, i) => (
								<div
									key={i}
									className="history-item flex items-center justify-between p-4"
									style={{
										background: "rgba(255,255,255,0.02)",
										borderRadius: "var(--radius-md)",
										border: "1px solid var(--border)",
									}}>
									<div className="flex flex-col">
										<span style={{ fontWeight: "500" }}>{item.name}</span>
										<span
											style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
											{item.date}
										</span>
									</div>
									<div style={{ fontWeight: "bold" }}>{item.amount}</div>
									<div
										style={{
											padding: "0.25rem 0.75rem",
											borderRadius: "20px",
											fontSize: "0.75rem",
											background: `${item.color}20`,
											color: item.color,
											border: `1px solid ${item.color}40`,
										}}>
										{item.status}
									</div>
								</div>
							))}
						</div>
					</motion.div>
				</div>
			</div>

			<style>{`
        .profile-container {
          padding-bottom: 4rem;
        }
        .settings-item:hover {
          background: rgba(255,255,255,0.05);
          cursor: pointer;
        }
        .p-6 { padding: 1.5rem; }
        .p-4 { padding: 1rem; }
        .p-3 { padding: 0.75rem; }
        .mb-4 { margin-bottom: 1rem; }
        .mb-6 { margin-bottom: 1.5rem; }
      `}</style>
		</motion.div>
	);
}
