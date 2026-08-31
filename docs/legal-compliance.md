# Legal & Compliance Guide

> **Disclaimer**: This document is for informational purposes only and does not constitute legal advice. Stellar-Save is an open-source software project. Operators, deployers, and users are solely responsible for ensuring their use of this software complies with applicable laws in their jurisdiction. Consult a qualified legal professional before deploying or operating this system in a commercial or regulated context.

---

## Table of Contents

1. [Terms of Service](#terms-of-service)
2. [Privacy Policy](#privacy-policy)
3. [Regulatory Considerations by Region](#regulatory-considerations-by-region)
4. [Compliance Checklist](#compliance-checklist)
5. [Disclaimer Templates](#disclaimer-templates)

---

## Terms of Service

The following is a template terms of service for operators deploying Stellar-Save. Adapt it to your jurisdiction and use case before publishing.

---

### Template: Terms of Service

**Last updated**: [DATE]

**Service**: [YOUR SERVICE NAME] powered by Stellar-Save

#### 1. Acceptance of Terms

By accessing or using this service, you agree to be bound by these Terms of Service. If you do not agree, do not use the service.

#### 2. Description of Service

This service provides a decentralized rotational savings and credit association (ROSCA) platform built on the Stellar blockchain. Members contribute fixed amounts each cycle and receive the pooled funds on a rotating basis. All transactions are executed by smart contracts on the Stellar network and are irreversible once confirmed.

#### 3. Eligibility

You must be at least 18 years old and legally permitted to participate in savings or financial arrangements in your jurisdiction. By using this service, you represent that you meet these requirements.

#### 4. No Financial Advice

Nothing on this platform constitutes financial, investment, legal, or tax advice. Participation in savings groups involves risk, including the risk of smart contract bugs, network failures, and counterparty default. You participate at your own risk.

#### 5. Irreversibility of Transactions

All contributions and payouts are executed on-chain and are irreversible. The operator and the Stellar-Save software project have no ability to reverse, refund, or modify on-chain transactions.

#### 6. User Responsibilities

You are responsible for:
- Securing your Stellar wallet and private keys
- Ensuring your contributions are made on time
- Complying with applicable laws in your jurisdiction
- Verifying group terms before joining

#### 7. Limitation of Liability

To the maximum extent permitted by law, the operator and the Stellar-Save open-source project are not liable for any loss of funds, missed payouts, smart contract failures, or any other damages arising from use of this service.

#### 8. Modifications

The operator reserves the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance.

#### 9. Governing Law

These terms are governed by the laws of [JURISDICTION]. Disputes shall be resolved in the courts of [JURISDICTION].

---

## Privacy Policy

The following is a template privacy policy. Adapt it to reflect your actual data practices.

---

### Template: Privacy Policy

**Last updated**: [DATE]

#### 1. Data We Collect

**On-chain data (public)**: All Stellar wallet addresses, contribution amounts, and payout records are stored on the Stellar blockchain and are publicly visible to anyone.

**Off-chain data (if applicable)**: If you use a frontend or backend service operated by [OPERATOR], we may collect:
- Wallet address (public key)
- Browser/device information for analytics
- IP address for security and abuse prevention

We do not collect names, email addresses, or government-issued identification unless explicitly required by local law and disclosed separately.

#### 2. How We Use Data

- To operate the savings group smart contracts
- To display your contribution history and group status
- To detect and prevent abuse or fraud
- To comply with applicable legal obligations

#### 3. Data Sharing

We do not sell your data. On-chain data is inherently public on the Stellar network. Off-chain data is not shared with third parties except:
- As required by law or court order
- With service providers who process data on our behalf under confidentiality agreements

#### 4. Data Retention

On-chain data is permanent and cannot be deleted. Off-chain data is retained for [PERIOD] or as required by law.

#### 5. Your Rights

Depending on your jurisdiction, you may have rights to access, correct, or delete your off-chain data. Contact [CONTACT] to exercise these rights. Note that on-chain data cannot be deleted.

#### 6. Cookies

[DESCRIBE COOKIE USAGE OR STATE "We do not use cookies."]

#### 7. Contact

For privacy inquiries: [CONTACT EMAIL OR CHANNEL]

---

## Regulatory Considerations by Region

> This section provides a high-level overview of regulatory considerations. It is not exhaustive and is not legal advice. Requirements change frequently — always verify with a local legal professional.

### Nigeria

- **CBN regulations**: The Central Bank of Nigeria regulates financial services. Informal savings groups (Ajo/Esusu) have a long legal history but digital/blockchain implementations may attract scrutiny under the CBN's fintech regulatory framework.
- **SEC Nigeria**: The Securities and Exchange Commission Nigeria has issued guidance on digital assets. Operators should review the [SEC Nigeria Digital Assets Framework](https://sec.gov.ng).
- **AML/CFT**: Anti-money laundering and counter-terrorism financing obligations apply to financial service providers. Assess whether your deployment triggers these obligations.
- **Recommendation**: Obtain a legal opinion before operating commercially in Nigeria.

### European Union

- **MiCA (Markets in Crypto-Assets Regulation)**: Applies from 2024. Operators offering crypto-asset services in the EU may need to register or obtain authorisation.
- **GDPR**: The General Data Protection Regulation applies to any processing of EU residents' personal data. Ensure your privacy policy and data practices comply.
- **PSD2**: Payment services regulation may apply depending on how funds flow through the platform.
- **Recommendation**: Conduct a MiCA and GDPR assessment before EU deployment.

### United States

- **FinCEN**: Money services business (MSB) registration may be required if the platform facilitates money transmission. Consult FinCEN guidance on virtual currency.
- **State money transmission laws**: Many US states have separate money transmission licensing requirements.
- **SEC**: Depending on how groups are structured, interests in savings pools could be characterised as securities.
- **OFAC**: Sanctions compliance is mandatory. Do not facilitate transactions with sanctioned individuals or entities.
- **Recommendation**: US deployment requires legal counsel specialising in fintech and crypto regulation.

### United Kingdom

- **FCA**: The Financial Conduct Authority regulates financial services. Cryptoasset businesses must register with the FCA for AML purposes.
- **UK GDPR**: Equivalent to EU GDPR, applies post-Brexit.
- **Recommendation**: Review FCA cryptoasset registration requirements before UK deployment.

### Rest of Africa

- Regulatory frameworks for digital assets vary significantly across African jurisdictions.
- Countries including Kenya, Ghana, South Africa, and Rwanda have issued or are developing crypto regulatory frameworks.
- Consult local legal counsel in each target jurisdiction.

---

## Compliance Checklist

Use this checklist before deploying Stellar-Save in a production or commercial context.

### Legal Entity & Governance
- [ ] Legal entity established (if operating commercially)
- [ ] Terms of service drafted, reviewed by legal counsel, and published
- [ ] Privacy policy drafted, reviewed, and published
- [ ] Jurisdiction of operation identified and legal requirements assessed

### Financial Regulation
- [ ] Assessed whether money transmission licensing is required in target jurisdictions
- [ ] Assessed whether AML/CFT obligations apply and implemented controls if so
- [ ] OFAC/sanctions screening process in place (if serving US persons or using US infrastructure)
- [ ] Assessed applicability of securities law to savings group structures

### Data Protection
- [ ] GDPR / local data protection law compliance assessed
- [ ] Data processing activities documented
- [ ] User consent mechanisms implemented where required
- [ ] Data retention and deletion policies defined

### Smart Contract & Technical
- [ ] Smart contract audited by a qualified third party before mainnet deployment
- [ ] Incident response plan documented (see [docs/incident-response-plan.md](incident-response-plan.md))
- [ ] Disaster recovery plan documented (see [docs/disaster-recovery.md](disaster-recovery.md))
- [ ] Security disclosure policy published (see [SECURITY.md](../SECURITY.md))

### User Protection
- [ ] Clear risk disclosures presented to users before participation
- [ ] Irreversibility of on-chain transactions disclosed prominently
- [ ] No financial advice disclaimer displayed
- [ ] Minimum age requirement enforced or disclosed

### Ongoing
- [ ] Regulatory monitoring process in place to track law changes
- [ ] Annual legal review scheduled
- [ ] Community guidelines and code of conduct published

---

## Disclaimer Templates

### General Software Disclaimer

> Stellar-Save is open-source software provided "as is" without warranty of any kind, express or implied. The authors and contributors are not liable for any loss of funds, data, or other damages arising from the use of this software. Use at your own risk.

### Financial Activity Disclaimer

> Participation in savings groups on this platform involves financial risk, including but not limited to: smart contract vulnerabilities, network failures, loss of wallet access, and counterparty default. Nothing on this platform constitutes financial advice. You are solely responsible for your financial decisions.

### Regulatory Disclaimer

> This platform is not licensed as a financial institution, money services business, or payment service provider in any jurisdiction unless explicitly stated. Users are responsible for ensuring their participation complies with applicable laws in their jurisdiction.

### No Legal Advice Disclaimer

> This documentation does not constitute legal advice. The information provided is for general informational purposes only. Consult a qualified legal professional in your jurisdiction before deploying or operating this software commercially.

### Blockchain Irreversibility Disclaimer

> All transactions executed on the Stellar blockchain are irreversible. Once a contribution or payout is confirmed on-chain, it cannot be reversed, refunded, or modified by any party, including the platform operator.

---

## Further Reading

- [Stellar Network Terms of Service](https://www.stellar.org/terms-of-service)
- [Stellar Privacy Policy](https://www.stellar.org/privacy-policy)
- [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org)
- [COMMUNITY_GUIDELINES.md](../COMMUNITY_GUIDELINES.md)
- [SECURITY.md](../SECURITY.md)
- [docs/threat-model.md](threat-model.md)
