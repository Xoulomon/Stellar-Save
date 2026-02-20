const dummyData = [
    {
        id: "TX-9A8B7C6D",
        hash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
        date: "Oct 24, 2026",
        time: "14:30:45",
        type: "Deposit",
        typeIcon: "📥",
        description: "Deposit to Savings Vault",
        amount: "+5,000.00 USDC",
        amountNum: 5000,
        status: "Completed",
        sender: "0xAbCd...Ef12",
        receiver: "Vault Contract",
        networkFee: "0.0012 ETH"
    },
    {
        id: "TX-5F4E3D2C",
        hash: "0x8b7a6c5d4e3f2a1b0c9d8e7f6a5b4c3d",
        date: "Oct 23, 2026",
        time: "09:15:12",
        type: "Swap",
        typeIcon: "💱",
        description: "Swap ETH for stETH",
        amount: "2.5 ETH",
        amountNum: 0,
        status: "Completed",
        sender: "0x12Fa...89Bc",
        receiver: "Uniswap Router",
        networkFee: "0.0045 ETH"
    },
    {
        id: "TX-1B2C3D4E",
        hash: "0x4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a",
        date: "Oct 22, 2026",
        time: "16:45:00",
        type: "Withdrawal",
        typeIcon: "📤",
        description: "Withdrawal to External Wallet",
        amount: "-1,000.00 USDT",
        amountNum: -1000,
        status: "Pending",
        sender: "Savings Vault",
        receiver: "0x98Fc...34De",
        networkFee: "0.0020 ETH"
    },
    {
        id: "TX-0F9E8D7C",
        hash: "0x7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f",
        date: "Oct 20, 2026",
        time: "11:20:33",
        type: "Staking",
        typeIcon: "🥩",
        description: "Stake into Liquid Pool",
        amount: "10,000.00 STRK",
        amountNum: 0,
        status: "Failed",
        sender: "0x12Fa...89Bc",
        receiver: "Staking Contract",
        networkFee: "0.0018 ETH"
    },
    {
        id: "TX-A1B2C3D4",
        hash: "0xe2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7",
        date: "Oct 18, 2026",
        time: "08:10:05",
        type: "Deposit",
        typeIcon: "📥",
        description: "Initial Funding",
        amount: "+10.0 ETH",
        amountNum: 10,
        status: "Completed",
        sender: "Binance Hot Wallet",
        receiver: "0x12Fa...89Bc",
        networkFee: "0.0008 ETH"
    }
];

function getStatusClass(status) {
    if (status === 'Completed') return 'status-completed';
    if (status === 'Pending') return 'status-pending';
    if (status === 'Failed') return 'status-failed';
    return '';
}

function getTypeClass(type) {
    if (type === 'Deposit') return 'deposit';
    if (type === 'Withdrawal') return 'withdrawal';
    if (type === 'Swap') return 'swap';
    return '';
}

function renderTable() {
    const tbody = document.getElementById('transactionTableBody');
    tbody.innerHTML = '';

    dummyData.forEach((tx, index) => {
        const tr = document.createElement('tr');
        tr.style.animationDelay = `${index * 0.1}s`;
        
        let amountClass = '';
        if (tx.amountNum > 0) amountClass = 'positive';

        tr.innerHTML = `
            <td>
                <div class="tx-date">
                    <span>${tx.date}</span>
                    <span class="tx-time">${tx.time}</span>
                </div>
            </td>
            <td>
                <div class="tx-type ${getTypeClass(tx.type)}">
                    ${tx.typeIcon} ${tx.type}
                </div>
            </td>
            <td>
                <div class="tx-desc">${tx.description}</div>
                <div class="tx-id">${tx.id}</div>
            </td>
            <td class="tx-amount ${amountClass}">${tx.amount}</td>
            <td>
                <span class="status-pill ${getStatusClass(tx.status)}">${tx.status}</span>
            </td>
            <td>
                <button class="btn btn-secondary btn-sm" onclick="openModal('${tx.id}')">Details</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openModal(txId) {
    const tx = dummyData.find(t => t.id === txId);
    if (!tx) return;

    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
        <div class="detail-row">
            <span class="detail-label">Transaction ID</span>
            <span class="detail-value monospace">${tx.id}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Status</span>
            <span class="status-pill ${getStatusClass(tx.status)}">${tx.status}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Date & Time</span>
            <span class="detail-value">${tx.date} at ${tx.time}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Type</span>
            <span class="detail-value">${tx.typeIcon} ${tx.type}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Amount</span>
            <span class="detail-value" style="font-weight:700;">${tx.amount}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Sender</span>
            <span class="detail-value monospace">${tx.sender}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Receiver</span>
            <span class="detail-value monospace">${tx.receiver}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Network Fee</span>
            <span class="detail-value">${tx.networkFee}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Tx Hash</span>
            <span class="detail-value monospace">${tx.hash.substring(0, 10)}...${tx.hash.substring(tx.hash.length - 8)}</span>
        </div>
    `;

    document.getElementById('txModal').classList.add('active');
}

function closeModal() {
    document.getElementById('txModal').classList.remove('active');
}

function triggerExport() {
    const toast = document.getElementById('toastMessage');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modal when clicking outside
document.getElementById('txModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    renderTable();
});
