#![allow(clippy::items_after_test_module)]

const ONE_XLM: i128 = 10_000_000; // 1 XLM in stroops;

pub const fn to_stroops(num: u64) -> i128 {
    (num as i128) * ONE_XLM
}

#[cfg(not(test))]
stellar_registry::import_asset!("xlm");

#[allow(unused)]
pub const SERIALIZED_ASSET: [u8; 4] = [0, 0, 0, 0];

#[cfg(not(test))]
#[allow(unused)]
pub fn token_client<'a>(env: &'a soroban_sdk::Env) -> soroban_sdk::token::TokenClient<'a> {
    soroban_sdk::token::TokenClient::new(env, &xlm::contract_id(env))
}

#[cfg(not(test))]
#[allow(unused)]
pub fn register(env: &soroban_sdk::Env, _admin: &soroban_sdk::Address) {
    let balance = token_client(env).try_balance(&env.current_contract_address());
    if balance.is_err() {
        env.deployer().with_stellar_asset(SERIALIZED_ASSET).deploy();
    }
}

#[cfg(test)]
#[allow(clippy::module_inception)]
#[allow(clippy::items_after_test_module)]
mod xlm {
    use super::*;
    const XLM_KEY: &soroban_sdk::Symbol = &soroban_sdk::symbol_short!("XLM");

    pub fn contract_id(env: &soroban_sdk::Env) -> soroban_sdk::Address {
        env.storage()
            .instance()
            .get::<_, soroban_sdk::Address>(XLM_KEY)
            .expect("XLM contract not initialized. Please deploy the XLM contract first.")
    }

    pub fn register(
        env: &soroban_sdk::Env,
        admin: &soroban_sdk::Address,
    ) -> soroban_sdk::testutils::StellarAssetContract {
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        env.storage().instance().set(XLM_KEY, &sac.address());
        stellar_asset_client(env).mint(admin, &to_stroops(10_000));
        sac
    }

    #[allow(unused)]
    pub fn stellar_asset_client<'a>(
        env: &'a soroban_sdk::Env,
    ) -> soroban_sdk::token::StellarAssetClient<'a> {
        soroban_sdk::token::StellarAssetClient::new(env, &contract_id(env))
    }
    /// Create a Stellar Asset Client for the asset which provides an admin interface
    pub fn token_client<'a>(env: &'a soroban_sdk::Env) -> soroban_sdk::token::TokenClient<'a> {
        soroban_sdk::token::TokenClient::new(env, &contract_id(env))
    }
}

#[cfg(test)]
pub use xlm::*;
