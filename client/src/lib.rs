//! Stellar Horizon API client for Stellar-Save project.
//!
//! Provides `HorizonService` for querying accounts, balances, and transactions.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use url::Url;

/// Default Stellar Horizon endpoints.
pub const TESTNET_HORIZON: &str = "https://horizon-testnet.stellar.org";
pub const MAINNET_HORIZON: &str = "https://horizon.stellar.org";

/// Custom errors for HorizonService.
#[derive(Error, Debug)]
pub enum HorizonError {
    #[error("HTTP request failed: {0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("JSON parsing failed: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("Invalid Horizon URL: {0}")]
    InvalidUrl(String),
    #[error("Account not found: {0}")]
    AccountNotFound(String),
    #[error("API error: {status} - {title}: {detail}")]
    ApiError {
        status: u16,
        title: String,
        detail: String,
    },
}

/// Simplified Stellar Account response from Horizon.
#[derive(Debug, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub account_id: String,
    pub sequence: String,
    pub balances: Vec<Balance>,
    pub flags: u32,
    pub master_key_weight: u32,
    pub low_threshold: u32,
    pub med_threshold: u32,
    pub high_threshold: u32,
    pub num_funded: u32,
    pub thresholds: Vec<u8>,
    pub signers: Vec<Signer>,
}

/// Asset balance.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Balance {
    pub balance: String,
    pub buying_liabilities: String,
    pub selling_liabilities: String,
    pub asset_code: Option<String>,
    pub asset_issuer: Option<String>,
    pub is_authorized: bool,
}

/// Signer details.
#[derive(Debug, Serialize, Deserialize)]
pub struct Signer {
    pub account: String,
    pub public_key: String,
    pub weight: u32,
}

/// Simplified transaction.
#[derive(Debug, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub paged_navigation_token: Option<String>,
    pub protocol_version: u32,
    pub successful: bool,
    pub hash: String,
    pub ledger: Ledger,
    pub created_at: String,
    pub source_account: String,
    pub fee_paid: u32,
    pub fee_charged: u32,
    pub max_fee: String,
    pub operation_count: u32,
    pub envelope_xdr: String,
    pub result_xdr: String,
    pub result_meta_xdr: String,
}

/// Ledger info.
#[derive(Debug, Serialize, Deserialize)]
pub struct Ledger {
    pub sequence: u32,
    pub close_time: String,
    pub num: u32,
    pub hash: String,
}

/// Core HorizonService for Stellar API interactions.
#[derive(Debug, Clone)]
pub struct HorizonService {
    client: Client,
    base_url: Url,
}

impl HorizonService {
    /// Create new service with Horizon endpoint.
    pub fn new(network: &str) -> Result<Self, HorizonError> {
        let base_url = match network {
            "testnet" => TESTNET_HORIZON.parse()?,
            "mainnet" => MAINNET_HORIZON.parse()?,
            url => Url::parse(url).map_err(|_| HorizonError::InvalidUrl(url.to_string()))?,
        };

        let client = Client::builder()
            .user_agent("stellar-save-client/0.1")
            .build()?;

        Ok(Self { client, base_url })
    }

    /// Get account details and balances.
    pub async fn get_account(&self, public_key: &str) -> Result<Account, HorizonError> {
        let url = self.base_url.join(&format!("accounts/{}", public_key))?;
        let resp = self
            .client
            .get(url)
            .send()
            .await?
            .error_for_status()?;

        let account: Account = resp.json().await?;

        Ok(account)
    }

    /// Get account balances (native + assets).
    pub async fn get_balances(&self, public_key: &str) -> Result<Vec<Balance>, HorizonError> {
        let account = self.get_account(public_key).await?;
        Ok(account.balances)
    }

    /// Get recent transaction history.
    pub async fn get_transaction_history(
        &self,
        public_key: &str,
        limit: Option<u32>,
    ) -> Result<Vec<Transaction>, HorizonError> {
        let mut url = self.base_url.join(&format!("accounts/{}/transactions", public_key))?;
        if let Some(limit) = limit {
            url.query_pairs_mut()
                .append_pair("limit", &limit.to_string());
        }

        let resp = self.client.get(url).send().await?.error_for_status()?;
        let transactions_page: TransactionsPage = resp.json().await?;

        Ok(transactions_page.transactions)
    }
}

/// Transactions response page (Horizon pagination).
#[derive(Debug, Serialize, Deserialize)]
struct TransactionsPage {
    #[serde(rename = "_embedded")]
    embedded: Embedded,
}

#[derive(Debug, Serialize, Deserialize)]
struct Embedded {
    records: Vec<Transaction>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_new_testnet() {
        let service = HorizonService::new("testnet").unwrap();
        assert_eq!(service.base_url.as_str(), TESTNET_HORIZON);
    }

    #[tokio::test]
    async fn test_new_mainnet() {
        let service = HorizonService::new("mainnet").unwrap();
        assert_eq!(service.base_url.as_str(), MAINNET_HORIZON);
    }
}
